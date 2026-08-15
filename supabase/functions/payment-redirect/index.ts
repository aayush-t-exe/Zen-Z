import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isAllowedRedirectTarget, buildDeepLinkTarget, wasPaymentPaid } from './logic.ts';

// Razorpay's callback_url must be a real https:// URL — it will not
// accept a custom app scheme (e.g. `mobile://...` or `exp://...`)
// directly. This function is that https bridge: create-payment-order
// points Razorpay here, and this hands off to the app's actual deep
// link, forwarding along whatever Razorpay appended
// (razorpay_payment_id, razorpay_payment_link_status, etc).
//
// Deliberately a tap, not an automatic redirect: in-app browser
// contexts (Chrome Custom Tabs / SFSafariViewController, which is what
// WebBrowser.openAuthSessionAsync uses) commonly swallow programmatic
// navigation to a non-http(s) scheme silently, but do honor a direct
// user tap on a link. This is cosmetic only either way — the app
// re-fetches the booking's actual payment_status from the database
// once it regains focus rather than trusting this page or its query
// params, since only the razorpay-webhook function is trusted to mark
// a booking paid.
//
// `to` is restricted to known app URI schemes — anything else is
// rejected, so this can't be turned into an open redirect to an
// arbitrary external URL.
const ALLOWED_SCHEMES = ['mobile://', 'exp://'];

serve((req) => {
  const url = new URL(req.url);
  const to = url.searchParams.get('to');

  if (!isAllowedRedirectTarget(to, ALLOWED_SCHEMES)) {
    return new Response('Invalid or missing redirect target', { status: 400 });
  }

  const target = buildDeepLinkTarget(to, url.searchParams);
  const paid = wasPaymentPaid(url.searchParams);
  const heading = paid ? 'Your invitation is sealed' : "We didn't receive your payment";
  const subtext = paid
    ? "Tap below to head back — we'll confirm everything there."
    : 'Tap below to head back and try again.';

  const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, sans-serif; background: #0b0b0d; color: #fff;
             display: flex; align-items: center; justify-content: center; min-height: 100vh;
             margin: 0; padding: 24px; text-align: center; }
      .card { max-width: 360px; }
      h1 { font-size: 1.5rem; margin-bottom: 8px; }
      p { color: #a0a3ab; margin-bottom: 24px; }
      a.button { display: inline-block; background: #fff; color: #000; font-weight: 600;
                 padding: 14px 28px; border-radius: 10px; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${heading}</h1>
      <p>${subtext}</p>
      <a class="button" href="${target}">Return to app →</a>
    </div>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
