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

// Undocumented but long-standing iOS scheme: handing the OS an
// `x-safari-https://` URL opens it in Safari proper, which is the only way
// out of an in-app browser. It can be swallowed silently depending on who is
// hosting the web view, so nothing below relies on it alone.
const SAFARI_URL = WEB_APP_URL.replace(/^https:\/\//, 'x-safari-https://');

/**
 * iOS browsers that cannot install a web app at all: Add to Home Screen is
 * Safari's Share sheet and nobody else's. That covers other engines' iOS
 * wrappers (Chrome, Firefox, Edge) and, more importantly for the launch
 * poster, every in-app browser people land in from a scan or a shared link:
 * Google's own (a Lens scan opens there, not in Safari), Instagram, WhatsApp.
 *
 * Deliberately not exhaustive, and it can't be: Brave on iOS reports a User-
 * Agent identical to Safari's on purpose, so it is invisible here even though
 * it has no Add to Home Screen either. That's why the Safari page still
 * carries its own "not seeing it?" escape route rather than trusting this.
 */
const IOS_CANNOT_INSTALL =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|LinkedInApp|MicroMessenger|Twitter/i;

// The brand look for these pages ("The Table": cream paper, ink, Zen-Z red),
// as one inline <style> block. Route handlers can't use the site's CSS, and a
// QR scan should never wait on another request, so nothing here is external
// except the app icon, which is a plain file in public/.
const PAGE_CSS = `
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;min-height:100vh;min-height:100dvh;background:#E9E3D5;color:#0A0908;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    font-size:17px;line-height:1.5;display:flex;align-items:center;justify-content:center;
    padding:max(28px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))}
  .wrap{width:100%;max-width:400px;text-align:center}
  .icon{display:block;width:72px;height:72px;margin:0 auto 18px;border-radius:18px;
    box-shadow:0 0 0 3px #fff,0 10px 22px -8px rgba(10,9,8,.45);transform:rotate(-4deg)}
  h1{margin:0 0 10px;font-size:1.75rem;line-height:1.08;font-weight:800;letter-spacing:-.025em;text-wrap:balance}
  .lede{margin:0 0 26px;color:#5C564C}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:54px;
    padding:0 28px;border-radius:999px;background:#E10600;color:#fff;font-weight:700;font-size:1.05rem;
    text-decoration:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 4px 0 #A80400;
    -webkit-tap-highlight-color:transparent}
  .btn:active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 2px 0 #A80400}
  .steps{list-style:none;margin:0;padding:0;text-align:left;display:grid;gap:12px}
  .steps li{display:flex;gap:14px;align-items:flex-start;background:#F3EEE3;border:2px solid #0A0908;
    border-radius:20px;padding:14px 16px;box-shadow:0 4px 0 #0A0908}
  .steps li:nth-child(odd){transform:rotate(-.6deg)}
  .steps li:nth-child(even){transform:rotate(.6deg)}
  .n{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:#E10600;color:#fff;
    font-weight:800;font-size:.95rem;display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 2px #0A0908}
  .note{margin:24px 0 0;color:#5C564C;font-size:.875rem;line-height:1.55}
  .note a,.link{color:#A80400;font-weight:600;text-decoration:underline;text-underline-offset:3px}
  .link{background:none;border:none;padding:0;font:inherit;cursor:pointer}
  .skip{display:inline-block;margin-top:22px;color:#0A0908;font-size:.9375rem;font-weight:600;
    text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
  strong{font-weight:700}
`;

const SHARE_ICON =
  '<svg width="16" height="20" viewBox="0 0 16 20" fill="none" style="vertical-align:-4px;margin:0 2px;" aria-label="Share"><path d="M8 1v12M4 5 8 1l4 4M1 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#0A0908" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function step(n: number, body: string): string {
  return `<li><span class="n">${n}</span><span>${body}</span></li>`;
}

/**
 * Last resort for anyone the Safari hand-off doesn't work for: the address,
 * copyable, to paste into Safari by hand. Worth the few lines because the
 * `x-safari-https://` scheme can fail silently, and a scan that dead-ends is
 * a student who never opens the app at all.
 */
function copyLinkFallback(): string {
  return `<p class="note">
        Or open Safari yourself and go to
        <button type="button" class="link"
          onclick="navigator.clipboard.writeText('${WEB_APP_URL}').then(function(){this.textContent='zen-z-app.vercel.app (copied)'}.bind(this))">zen-z-app.vercel.app</button>
      </p>`;
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#E9E3D5" />
    <title>${title}</title>
    <style>${PAGE_CSS}</style>
  </head>
  <body>
    <main class="wrap">
      <img class="icon" src="/icon-192.png" width="72" height="72" alt="The Zen-Z app icon" />
${body}
    </main>
  </body>
</html>`;
}

function safariInstructionsPage(): string {
  return page(
    'Zen-Z',
    `      <h1>Put Zen-Z on your Home Screen</h1>
      <p class="lede">Zen-Z isn't on the App Store, but you can add it to your Home Screen and it works like an app: full screen, its own icon, no browser bar.</p>

      <ol class="steps">
        ${step(1, 'Tap <strong>Continue to Zen-Z</strong> below to open the app.')}
        ${step(2, `In Safari, tap the <strong>Share</strong> icon ${SHARE_ICON} in the toolbar.`)}
        ${step(3, 'Scroll down and tap <strong>Add to Home Screen</strong>.')}
      </ol>

      <p style="margin:28px 0 0;"><a class="btn" href="${WEB_APP_URL}">Continue to Zen-Z →</a></p>

      <p class="note">
        No <strong>Add to Home Screen</strong> in that menu? Then this isn't Safari, and only Safari can install it.
        <a href="${SAFARI_URL}">Open in Safari</a>.
      </p>`
  );
}

/**
 * Shown to browsers known to have no Add to Home Screen at all, where the
 * Safari steps would only send someone hunting for a menu item that isn't
 * there. Leads with the hand-off instead, and keeps the steps below it for
 * once they land.
 */
function openInSafariPage(): string {
  return page(
    'Zen-Z',
    `      <h1>Open this in Safari first</h1>
      <p class="lede">Zen-Z installs to your Home Screen from Safari, and only from Safari. The browser you're in right now can't do it.</p>

      <p style="margin:0 0 30px;"><a class="btn" href="${SAFARI_URL}">Open in Safari →</a></p>

      <ol class="steps">
        ${step(1, `Once Safari opens, tap the <strong>Share</strong> icon ${SHARE_ICON} in the toolbar.`)}
        ${step(2, 'Scroll down and tap <strong>Add to Home Screen</strong>.')}
      </ol>

${copyLinkFallback()}

      <a class="skip" href="${WEB_APP_URL}">Skip for now, just open Zen-Z</a>`
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userAgent = req.headers.get('user-agent') || '';
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);

  if (isAndroid) {
    return NextResponse.redirect(PLAY_STORE_URL, { status: 302, headers: NO_STORE_HEADERS });
  }

  if (isIOS) {
    const html = IOS_CANNOT_INSTALL.test(userAgent)
      ? openInSafariPage()
      : safariInstructionsPage();
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE_HEADERS },
    });
  }

  return NextResponse.redirect(WEB_APP_URL, { status: 302, headers: NO_STORE_HEADERS });
}
