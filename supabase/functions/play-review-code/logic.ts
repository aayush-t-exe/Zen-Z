// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

// Not timing-safe — deliberately so: this gates a single fixed, low-value
// review account (see docs/PLAY_STORE_SUBMISSION.md), not a real auth
// boundary. The actual protection is that PLAY_REVIEW_SECRET is a long
// random value set only as a Supabase function secret, never committed.
export function isAuthorized(providedSecret: string | null, expectedSecret: string | undefined): boolean {
  return Boolean(expectedSecret) && providedSecret === expectedSecret;
}

export function renderCodePage(code: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zen-Z review sign-in code</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { text-align: center; padding: 0 24px; }
      .code { font-size: 3rem; letter-spacing: 0.3em; font-weight: 700; margin: 1rem 0; }
      p { color: #aaa; max-width: 320px; margin: 0 auto; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="card">
      <p>Zen-Z sign-in code</p>
      <div class="code">${code}</div>
      <p>Enter this 6-digit code on the app's verification screen. Reload this page to get a fresh code if it expires.</p>
    </div>
  </body>
</html>`;
}
