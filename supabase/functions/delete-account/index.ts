import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTargetUserId, isAdminDeletion, photoStoragePath } from './logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Orchestrates account deletion for both the mobile self-service flow and
// the admin dashboard's delete action. Exists because photo cleanup can
// no longer happen inside the delete_own_account()/admin_delete_account()
// SQL functions — Supabase now blocks a raw SQL `DELETE` on
// storage.objects (a platform-level trigger forcing use of the real
// Storage API), so removing the photo has to be a separate, actual
// Storage API call, made *after* the RPC has already committed the
// security-critical part (PII scrub + auth ban). See
// 0077_delete_account_drop_broken_storage_delete.sql.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Identify the caller from their own JWT. A request body userId (the
    // admin path) is only ever a target, never trusted for identity.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let requestedUserId: string | undefined;
    try {
      const body = await req.json();
      requestedUserId = body?.userId;
    } catch {
      // No body, or not JSON — the self-delete path sends none.
    }

    const targetUserId = resolveTargetUserId(caller.id, requestedUserId);
    const isAdminPath = isAdminDeletion(caller.id, targetUserId);

    // Runs as the caller (not service role) so auth.uid() inside the RPC
    // is genuinely them — delete_own_account() only ever touches its own
    // caller by construction, and admin_delete_account() re-checks
    // admin_users itself. This function never re-implements that
    // authorization decision in JS; it just routes to the right RPC.
    const { error: rpcError } = isAdminPath
      ? await callerClient.rpc('admin_delete_account', { p_user_id: targetUserId })
      : await callerClient.rpc('delete_own_account');

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Best-effort photo cleanup, only attempted after the RPC above has
    // already succeeded — a storage-side failure here must never be able
    // to block or half-apply the account deletion itself. Needs the
    // service role: there is no RLS DELETE policy on storage.objects for
    // this bucket at all (neither self nor admin), and a SQL security
    // definer function can't do it either anymore — the real Storage API
    // is the only path left.
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { error: storageError } = await serviceClient.storage
      .from('profile-photos')
      .remove([photoStoragePath(targetUserId)]);

    if (storageError) {
      console.error(`delete-account: photo cleanup failed for ${targetUserId}:`, storageError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('delete-account error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
