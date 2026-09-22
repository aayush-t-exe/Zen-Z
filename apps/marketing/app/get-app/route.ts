// Single link for the QR code / "get the app" CTA (see the JNU launch
// poster). A QR code just encodes one URL — it can't know what device
// scanned it — so this route does the platform check server-side from the
// User-Agent: Android goes straight to the Play Store, desktop goes
// straight to the web build, and iOS gets a short instructional page first.
//
// iOS has no App Store listing to send people to — the web build is the
// real destination there too — but "Add to Home Screen" (Safari's Share
// sheet) is not something people discover on their own, and the app's web
// build already ships the apple-touch-icon/manifest tags needed for it to
// install like a real app (apps/mobile/public/index.html). Whatever page
// is open when someone runs Add to Home Screen is what gets bookmarked, so
// this shows the steps *before* sending them into the app rather than
// after, and lets them continue in on their own once they've read it.
import { NextRequest, NextResponse } from 'next/server';

// Platform detection depends on reading the request's User-Agent, so this
// route can never be served from a cached/static response — force that
// explicitly rather than relying on Next.js inferring it, and mark every
// response no-store so neither the CDN nor the visitor's browser holds on
// to an old redirect target across a deploy.
export const dynamic = 'force-dynamic';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, must-revalidate' };

const WEB_APP_URL = 'https://zen-z-app.vercel.app';
// Same package id as ANDROID_PACKAGE in apps/mobile/src/app/(home)/profile.tsx.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.campussocial.app&hl=en';

function iosInstructionsPage(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zen-Z</title>
  </head>
  <body style="font-family:-apple-system,sans-serif;background:#0b0b0d;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
    <div style="max-width:360px;">
      <h1 style="font-size:1.4rem;margin-bottom:8px;">Get the full app on your Home Screen</h1>
      <p style="color:#a0a3ab;margin-bottom:28px;">Zen-Z isn't on the App Store yet, but you can add it to your Home Screen like a real app — full screen, its own icon, no browser bar.</p>

      <ol style="text-align:left;color:#fff;padding:0;margin:0 0 32px;list-style:none;">
        <li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:20px;">
          <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#fff;color:#000;font-weight:700;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">1</span>
          <span>Tap <strong>Continue to Zen-Z</strong> below to open the app.</span>
        </li>
        <li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:20px;">
          <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#fff;color:#000;font-weight:700;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">2</span>
          <span>In Safari, tap the <strong>Share</strong> icon
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style="vertical-align:-4px;margin:0 2px;"><path d="M8 1v12M4 5 8 1l4 4M1 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            in the toolbar.</span>
        </li>
        <li style="display:flex;gap:12px;align-items:flex-start;">
          <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#fff;color:#000;font-weight:700;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">3</span>
          <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
        </li>
      </ol>

      <a href="${WEB_APP_URL}" style="display:inline-block;background:#fff;color:#000;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;">Continue to Zen-Z →</a>
    </div>
  </body>
</html>`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userAgent = req.headers.get('user-agent') || '';
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);

  if (isAndroid) {
    return NextResponse.redirect(PLAY_STORE_URL, { status: 302, headers: NO_STORE_HEADERS });
  }

  if (isIOS) {
    return new NextResponse(iosInstructionsPage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE_HEADERS },
    });
  }

  return NextResponse.redirect(WEB_APP_URL, { status: 302, headers: NO_STORE_HEADERS });
}
