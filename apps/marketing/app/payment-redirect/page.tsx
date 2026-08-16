// https bridge between Razorpay's payment-link callback_url (must be a
// real https:// URL — it rejects the app's own mobile://+exp:// schemes
// directly) and the app's real deep link. This used to be a Supabase
// Edge Function, but Supabase's shared *.supabase.co domain silently
// rewrites any text/html Edge Function response to text/plain (a
// documented platform limitation, not something fixable in the function
// itself — https://github.com/orgs/supabase/discussions/35627), so the
// "Return to app" link never even rendered as a clickable element.
// Hosting this on the marketing site's own Vercel domain (zen-z.site)
// avoids that rewrite entirely. The page itself is static and reads
// only URL query params — no Supabase calls, so the same deployment
// serves both the dev and prod app builds.
//
// Deliberately offers a real tap target rather than relying solely on
// the auto-redirect script below: in-app browser contexts (Chrome
// Custom Tabs / SFSafariViewController, which is what
// WebBrowser.openAuthSessionAsync uses) commonly swallow programmatic
// navigation to a non-http(s) scheme silently. Either way, the app
// re-fetches the booking's actual payment_status from the database
// once it regains focus rather than trusting this page or its query
// params — only razorpay-webhook is trusted to mark a booking paid.
const ALLOWED_SCHEMES = ['mobile://', 'exp://'];

function isAllowedRedirectTarget(to: string | undefined): to is string {
  return !!to && ALLOWED_SCHEMES.some((scheme) => to.startsWith(scheme));
}

function buildDeepLinkTarget(
  to: string,
  searchParams: Record<string, string | string[] | undefined>
): string {
  const deepLink = new URL(to);
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'to' || value === undefined) continue;
    deepLink.searchParams.set(key, Array.isArray(value) ? value[0] : value);
  }
  return deepLink.toString();
}

export default async function PaymentRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const to = typeof params.to === 'string' ? params.to : undefined;

  const pageStyle: React.CSSProperties = {
    fontFamily: '-apple-system, sans-serif',
    background: '#0b0b0d',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    margin: 0,
    padding: 24,
    textAlign: 'center',
  };

  if (!isAllowedRedirectTarget(to)) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Invalid redirect</h1>
          <p style={{ color: '#a0a3ab' }}>This link is missing or malformed.</p>
        </div>
      </div>
    );
  }

  const target = buildDeepLinkTarget(to, params);
  const paid = params.razorpay_payment_link_status === 'paid';
  const heading = paid ? 'Your invitation is sealed' : "We didn't receive your payment";
  const subtext = paid
    ? "Tap below to head back — we'll confirm everything there."
    : 'Tap below to head back and try again.';

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 360 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>{heading}</h1>
        <p style={{ color: '#a0a3ab', marginBottom: 24 }}>{subtext}</p>
        <a
          className="button"
          href={target}
          style={{
            display: 'inline-block',
            background: '#fff',
            color: '#000',
            fontWeight: 600,
            padding: '14px 28px',
            borderRadius: 10,
            textDecoration: 'none',
          }}
        >
          Return to app
        </a>
        <script
          // Best-effort automatic hand-off — see the module comment above
          // for why the tap-based link stays as the primary path.
          dangerouslySetInnerHTML={{ __html: `window.location.href = ${JSON.stringify(target)};` }}
        />
      </div>
    </div>
  );
}
