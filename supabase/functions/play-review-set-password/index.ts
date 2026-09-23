import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorized, isValidReviewPassword } from './logic.ts';

// One-time (or occasional-rotation) admin action: sets a fixed password
// on the dedicated Google Play review account (PLAY_REVIEW_EMAIL), so a
// reviewer can sign in with a memorable, unchanging email+password pair
// instead of visiting a separate link for a fresh code each time. This
// function is never called by the app itself and never runs during an
// actual review — only by the founder, once, to configure or rotate the
// password. The runtime login path (apps/mobile's otp-verification.tsx)
// calls supabase.auth.signInWithPassword() directly against Supabase's
// own rate-limited endpoint; nothing here is in that request path.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const providedSecret = url.searchParams.get('secret');
  const expectedSecret = Deno.env.get('PLAY_REVIEW_SECRET');

  if (!isAuthorized(providedSecret, expectedSecret)) {
    return new Response('Not found', { status: 404 });
  }

  const password = url.searchParams.get('password');
  if (!isValidReviewPassword(password)) {
    return new Response('password must be exactly 6 digits (it has to fit the app\'s OTP box UI)', {
      status: 400,
    });
  }

  const reviewEmail = Deno.env.get('PLAY_REVIEW_EMAIL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!reviewEmail || !supabaseUrl || !serviceKey) {
    return new Response('Not configured', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  // generateLink's 'magiclink' type creates the user if it doesn't exist
  // yet and always returns the full user record either way — reused here
  // just to resolve PLAY_REVIEW_EMAIL to a user id without a separate
  // lookup call.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: reviewEmail,
  });

  if (linkError || !linkData?.user?.id) {
    console.error('play-review-set-password: could not resolve review user:', linkError);
    return new Response('Could not resolve review account', { status: 500 });
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(linkData.user.id, {
    password,
  });

  if (updateError) {
    console.error('play-review-set-password: updateUserById failed:', updateError);
    return new Response('Could not set password', { status: 500 });
  }

  return new Response('Password set.', { status: 200 });
});
