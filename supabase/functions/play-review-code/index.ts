import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorized, renderCodePage } from './logic.ts';

// Lets a Google Play reviewer sign into a fixed, dedicated review account
// (PLAY_REVIEW_EMAIL) without a real inbox to check — Zen-Z has no
// password-based auth to hand reviewers instead (see auth rule in
// CLAUDE.md), and Google's rejection of version code 2 asked specifically
// for "a dedicated test bypass ... that do[es] not require your account
// to be linked to our testing devices." Reviewer opens this URL (with the
// secret query param, from the Play Console "Sign in details" field),
// gets today's 6-digit code, and enters it on the app's normal
// verification screen — verifyOtp() there is completely unmodified.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const providedSecret = url.searchParams.get('secret');
  const expectedSecret = Deno.env.get('PLAY_REVIEW_SECRET');

  if (!isAuthorized(providedSecret, expectedSecret)) {
    return new Response('Not found', { status: 404 });
  }

  const reviewEmail = Deno.env.get('PLAY_REVIEW_EMAIL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!reviewEmail || !supabaseUrl || !serviceKey) {
    return new Response('Not configured', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: reviewEmail,
  });

  if (error || !data?.properties?.email_otp) {
    console.error('play-review-code: generateLink failed:', error);
    return new Response('Could not generate a code', { status: 500 });
  }

  return new Response(renderCodePage(data.properties.email_otp), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
