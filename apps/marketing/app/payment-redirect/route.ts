// https bridge between PayU's payment return URL and the app's real deep
// link. This used to read a `to` query param that Razorpay's callback_url
// echoed back per-request (see git history), but PayU's Payment Links
// product only supports a static, dashboard-configured return URL — there
// is no per-request param to trust here. Instead, this looks the
// booking's slot up from a payment reference via
// slot_id_for_payment_reference() (supabase/migrations/
// 0069_payu_payment_reference_lookup.sql), a narrow SECURITY DEFINER RPC
// that crosses bookings' RLS wall without leaking user_id/payment_status/
// the booking id itself.
//
// CONFIRMED live (2026-08-29): a real ₹1 PayU test payment never actually
// redirected here at all — PayU's Payment Links product stays on its own
// hosted "Payment Completed" page with no continue button. This route is
// almost certainly dead code in practice; it's kept as a harmless
// defensive fallback in case behavior differs for other payment
// instruments/contexts we haven't tested, not as the real return path —
// payment.tsx polling the booking's payment_status after the checkout
// browser closes is the actual, primary way the app learns payment
// succeeded. If PayU ever does hit this route, note that what identifier
// it would pass back (its own txnid? mihpayid?) is unconfirmed, so the
// RPC lookup below by our own payment_id value may not even match.
//
// A Server Component can't receive a POST, so this stays a Route Handler
// exporting both GET and POST, in case PayU's return mechanics differ by
// payment instrument.
//
// Hosting this on the marketing site's own Vercel domain (zen-z.site)
// rather than a Supabase Edge Function avoids a documented platform
// limitation where the shared *.supabase.co domain silently rewrites
// text/html Edge Function responses to text/plain
// (https://github.com/orgs/supabase/discussions/35627), which would make
// the "Return to app" link never render as a clickable element.
//
// Deliberately offers a real tap target rather than relying solely on
// the auto-redirect script below: in-app browser contexts (Chrome Custom
// Tabs / SFSafariViewController, which is what
// WebBrowser.openAuthSessionAsync uses) commonly swallow programmatic
// navigation to a non-http(s) scheme silently. Either way, the app
// re-fetches the booking's actual payment_status from the database once
// it regains focus rather than trusting this page or its query params —
// only payu-webhook is trusted to mark a booking paid.
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MOBILE_DEEP_LINK_SCHEME = 'mobile://';

function pageHtml(heading: string, subtext: string, target: string | null): string {
  const button = target
    ? `<a class="button" href="${target}" style="display:inline-block;background:#fff;color:#000;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;">Return to app →</a>
       <script>window.location.href = ${JSON.stringify(target)};</script>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zen-Z</title>
  </head>
  <body style="font-family:-apple-system,sans-serif;background:#0b0b0d;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
    <div style="max-width:360px;">
      <h1 style="font-size:1.5rem;margin-bottom:8px;">${heading}</h1>
      <p style="color:#a0a3ab;margin-bottom:24px;">${subtext}</p>
      ${button}
    </div>
  </body>
</html>`;
}

function htmlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handlePayuReturn(txnid: string | null, status: string | null): Promise<NextResponse> {
  if (!txnid) {
    return htmlResponse(
      pageHtml('Invalid redirect', 'This link is missing or malformed.', null),
      400
    );
  }

  const { data: slotId, error } = await supabase.rpc('slot_id_for_payment_reference', {
    p_payment_id: txnid,
  });

  if (error || !slotId) {
    return htmlResponse(
      pageHtml('Invalid redirect', "We couldn't find this payment. Please return to the app and try again.", null),
      404
    );
  }

  const target = `${MOBILE_DEEP_LINK_SCHEME}payment-callback?slotId=${encodeURIComponent(slotId)}`;
  const paid = status === 'success';
  const heading = paid ? 'Your invitation is sealed' : "We didn't receive your payment";
  const subtext = paid
    ? "Tap below to head back — we'll confirm everything there."
    : 'Tap below to head back and try again.';

  return htmlResponse(pageHtml(heading, subtext, target));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  return handlePayuReturn(searchParams.get('txnid'), searchParams.get('status'));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentType = req.headers.get('Content-Type') || '';
  let txnid: string | null = null;
  let status: string | null = null;

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    txnid = body?.txnid ?? null;
    status = body?.status ?? null;
  } else {
    const form = await req.formData();
    txnid = (form.get('txnid') as string) ?? null;
    status = (form.get('status') as string) ?? null;
  }

  return handlePayuReturn(txnid, status);
}
