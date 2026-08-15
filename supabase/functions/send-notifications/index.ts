import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { partitionByPushToken, chunk, buildExpoMessages, resolveTicketOutcome } from './logic.ts';

// Invoked every minute by the `notification-cycle` pg_cron job
// (0019_notifications.sql) with the project's own service-role key as its
// bearer token — there is no end-user JWT involved, unlike
// create-payment-order. Its only job is to flush notifications_outbox:
// enqueueing (both instant triggers and the periodic scheduled scan) all
// happens in Postgres, this function only talks to Expo's push API.

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

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: outboxRows, error: fetchError } = await supabase
      .from('notifications_outbox')
      .select('id, user_id, type, title, body, data, profiles:user_id ( push_token )')
      .eq('status', 'pending')
      .limit(200);

    if (fetchError) {
      throw fetchError;
    }

    const rows = (outboxRows ?? []) as any[];

    const { withToken, withoutToken } = partitionByPushToken(rows);

    if (withoutToken.length > 0) {
      await supabase
        .from('notifications_outbox')
        .update({ status: 'skipped', error: 'no_push_token' })
        .in('id', withoutToken.map((r) => r.id));
    }

    let sent = 0;
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
        const outcome = resolveTicketOutcome(response, tickets[j]);

        await supabase
          .from('notifications_outbox')
          .update({
            status: outcome.status,
            error: outcome.error,
            sent_at: outcome.status === 'sent' ? new Date().toISOString() : null,
          })
          .eq('id', batch[j].id);

        if (outcome.status === 'sent') sent++;
        else failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, skipped: withoutToken.length }),
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
