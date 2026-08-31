import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  partitionByPushToken,
  chunk,
  buildExpoMessages,
  resolveTicketOutcome,
  isAuthorizedCronCaller,
} from './logic.ts';

// Invoked every minute by the `notification-cycle` pg_cron job
// (0019_notifications.sql) with the project's own service-role key as its
// bearer token — there is no end-user JWT involved, unlike
// create-payment-order. Its only job is to flush notifications_outbox:
// enqueueing (both instant triggers and the periodic scheduled scan) all
// happens in Postgres, this function only talks to Expo's push API.
//
// Platform verify_jwt only checks that *some* validly-signed Supabase JWT
// was sent — the public anon key satisfies that too, so without this
// function checking its own caller, anyone holding the anon key (i.e.
// anyone, since it ships in every client) could invoke this directly and
// have it flush the outbox through Expo's push API on demand, bypassing
// the once-a-minute cron design entirely. The cron job's own Authorization
// header is literally the service-role key (0019_notifications.sql), so
// requiring an exact match is the same check that already gates
// razorpay-webhook's HMAC signature, just for a trusted-caller-only
// function instead of a signed-payload one.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo's documented per-request cap

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    if (!isAuthorizedCronCaller(req.headers.get('Authorization'), supabaseKey)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Atomically claims rows (pending, plus any 'sending' row stranded by a
    // prior invocation that crashed mid-batch — see claim_pending_
    // notifications, 0063) by flipping them to 'sending' in the same
    // statement via FOR UPDATE SKIP LOCKED. This is what makes two
    // overlapping invocations of this function (the cron is fire-and-
    // forget every minute — nothing stops a slow run from still being in
    // flight when the next one starts) safe: neither can claim a row the
    // other already has.
    const { data: claimedRows, error: claimError } = await supabase.rpc('claim_pending_notifications', {
      p_limit: 200,
    });

    if (claimError) {
      throw claimError;
    }

    const rows = (claimedRows ?? []) as any[];

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profileRows, error: profilesError } = userIds.length
      ? await supabase.from('profiles').select('id, push_token').in('id', userIds)
      : { data: [], error: null };

    if (profilesError) {
      throw profilesError;
    }

    const pushTokenByUserId = new Map((profileRows ?? []).map((p: any) => [p.id, p.push_token]));
    const rowsWithProfile = rows.map((r) => ({ ...r, profiles: { push_token: pushTokenByUserId.get(r.user_id) ?? null } }));

    const { withToken, withoutToken } = partitionByPushToken(rowsWithProfile);

    if (withoutToken.length > 0) {
      await supabase
        .from('notifications_outbox')
        .update({ status: 'skipped', error: 'no_push_token' })
        .in('id', withoutToken.map((r) => r.id));
    }

    let sent = 0;
    let retried = 0;
    let failed = 0;

    for (const batch of chunk(withToken, BATCH_SIZE)) {
      const messages = buildExpoMessages(batch);

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json().catch(() => ({}));
      const tickets = Array.isArray(result?.data) ? result.data : [];

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const attemptCount = (row.retry_count ?? 0) + 1;
        const outcome = resolveTicketOutcome(response, tickets[j], attemptCount);

        await supabase
          .from('notifications_outbox')
          .update({
            status: outcome.status,
            error: outcome.error,
            sent_at: outcome.status === 'sent' ? new Date().toISOString() : null,
            retry_count: attemptCount,
          })
          .eq('id', row.id);

        if (outcome.clearPushToken) {
          await supabase.from('profiles').update({ push_token: null }).eq('id', row.user_id);
        }

        if (outcome.status === 'sent') sent++;
        else if (outcome.status === 'pending') retried++;
        else failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, retried, failed, skipped: withoutToken.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
