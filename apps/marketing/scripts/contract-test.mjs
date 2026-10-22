#!/usr/bin/env node
// Contract tests for zen-z.site. Run against a production build:
//
//   npx next build && npx next start -p 3107
//   npm run contract-test            (or: BASE=https://<preview>.vercel.app npm run contract-test)
//
// Checks the things other systems depend on: /get-app (printed on posters and
// T-shirts), /payment-redirect (PayU's return URL), every URL Google Play,
// PayU and the app link to, and the operator block PayU checks on every page.
// No dependencies; Node 22's fetch with redirect: 'manual'.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.BASE || process.argv[2] || 'http://localhost:3107').replace(/\/$/, '');
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(APP_DIR, '..', '..');

const PLAY = 'https://play.google.com/store/apps/details?id=com.campussocial.app&hl=en';
const WEB_APP = 'https://zen-z-app.vercel.app';
const NO_STORE = 'no-store, must-revalidate';

const UA = {
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Instagram 300.0.0.21.111 (iPhone15,2; iOS 18_0; en_IN; en-IN; scale=3.00; 1179x2556; 516170044)',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

const PAGES = [
  '/',
  '/about',
  '/pricing',
  '/faq',
  '/contact',
  '/privacy',
  '/terms',
  '/refund',
  '/community-guidelines',
  '/delete-account',
];

const OPERATOR_STRINGS = ['Dhruv Goyal', 'A-21, Anand Vihar', 'teamzenz003@gmail.com', '9460623157', '7069183086'];
const LEGAL_HREFS = ['/privacy', '/terms', '/refund', '/community-guidelines', '/delete-account'];

const results = [];
function record(group, name, ok, detail = '') {
  results.push({ group, name, ok, detail });
}

async function get(path, { ua, method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: { ...(ua ? { 'user-agent': ua } : {}), ...headers },
    body,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function expect(group, name, checks) {
  const failed = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  record(group, name, failed.length === 0, failed.join('; '));
}

// ───────────────────────────── /get-app ─────────────────────────────
async function testGetApp() {
  const g = '/get-app';

  let r = await get('/get-app', { ua: UA.android });
  expect(g, 'Android → 302 Play Store', [
    [r.status === 302, `status ${r.status}`],
    [r.headers.get('location') === PLAY, `location ${r.headers.get('location')}`],
    [(r.headers.get('cache-control') || '').includes(NO_STORE), `cache-control ${r.headers.get('cache-control')}`],
  ]);

  r = await get('/get-app', { ua: UA.iphoneSafari });
  expect(g, 'iPhone Safari → 200 Add to Home Screen steps', [
    [r.status === 200, `status ${r.status}`],
    [(r.headers.get('content-type') || '').includes('text/html'), `content-type ${r.headers.get('content-type')}`],
    [r.text.includes('Continue to Zen-Z'), 'missing "Continue to Zen-Z"'],
    [r.text.includes('zen-z-app.vercel.app'), 'missing web app URL'],
    [r.text.includes('Add to Home Screen'), 'missing "Add to Home Screen"'],
    [(r.headers.get('cache-control') || '').includes(NO_STORE), `cache-control ${r.headers.get('cache-control')}`],
  ]);

  r = await get('/get-app', { ua: UA.iphoneInstagram });
  expect(g, 'iPhone Instagram in-app → 200 "Open in Safari"', [
    [r.status === 200, `status ${r.status}`],
    [r.text.includes('Open this in Safari first'), 'missing "Open this in Safari first"'],
    [r.text.includes('x-safari-https://zen-z-app.vercel.app'), 'missing x-safari-https:// link'],
    [r.text.includes('navigator.clipboard.writeText'), 'missing copy-link fallback'],
    [r.text.includes('Skip for now'), 'missing "Skip for now"'],
    [(r.headers.get('cache-control') || '').includes(NO_STORE), `cache-control ${r.headers.get('cache-control')}`],
  ]);

  r = await get('/get-app', { ua: UA.iphoneChrome });
  expect(g, 'iPhone Chrome (CriOS) → 200 "Open in Safari"', [
    [r.status === 200, `status ${r.status}`],
    [r.text.includes('x-safari-https://'), 'missing x-safari-https:// link'],
    [!r.text.includes('Continue to Zen-Z'), 'got the Safari steps page instead'],
  ]);

  r = await get('/get-app', { ua: UA.windows });
  expect(g, 'Windows desktop → 302 web app', [
    [r.status === 302, `status ${r.status}`],
    [r.headers.get('location') === WEB_APP, `location ${r.headers.get('location')}`],
    [(r.headers.get('cache-control') || '').includes(NO_STORE), `cache-control ${r.headers.get('cache-control')}`],
  ]);
}

// ───────────────────────────── /payment-redirect ─────────────────────────────
async function testPaymentRedirect() {
  const g = '/payment-redirect';
  const fake = `fake-${Math.random().toString(36).slice(2, 10)}`;

  let r = await get('/payment-redirect');
  expect(g, 'GET, no params → 400', [[r.status === 400, `status ${r.status}`]]);

  r = await get(`/payment-redirect?txnid=${fake}&status=success`);
  expect(g, 'GET, unknown txnid → 404', [
    [r.status === 404, `status ${r.status}`],
    [!r.text.includes('mobile://'), 'deep link rendered for an unknown payment'],
  ]);

  r = await get('/payment-redirect', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ txnid: fake, status: 'success' }).toString(),
  });
  expect(g, 'POST form data, unknown txnid → 404', [[r.status === 404, `status ${r.status}`]]);

  r = await get('/payment-redirect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ txnid: fake, status: 'success' }),
  });
  expect(g, 'POST JSON, unknown txnid → 404', [[r.status === 404, `status ${r.status}`]]);

  r = await get('/payment-redirect', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'success' }).toString(),
  });
  expect(g, 'POST form data, no txnid → 400', [[r.status === 400, `status ${r.status}`]]);
}

// ───────────────────────────── Pages + operator block ─────────────────────────────
function operatorChecks(html) {
  return [
    ...OPERATOR_STRINGS.map((s) => [html.includes(s), `missing "${s}"`]),
    ...LEGAL_HREFS.map((h) => [html.includes(`href="${h}"`), `missing link href="${h}"`]),
  ];
}

async function testPages() {
  for (const p of PAGES) {
    const r = await get(p);
    expect('pages', `${p} → 200 + operator block`, [
      [r.status === 200, `status ${r.status}`],
      [(r.headers.get('content-type') || '').includes('text/html'), `content-type ${r.headers.get('content-type')}`],
      ...operatorChecks(r.text),
    ]);
  }

  const missing = `/this-table-does-not-exist-${Date.now()}`;
  const r404 = await get(missing);
  expect('pages', '404 page → 404 + operator block', [[r404.status === 404, `status ${r404.status}`], ...operatorChecks(r404.text)]);

  for (const p of ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest']) {
    const r = await get(p);
    expect('seo', `${p} → 200`, [[r.status === 200, `status ${r.status}`]]);
  }
}

// ───────────────────────────── Static checks ─────────────────────────────
function regexLiteral(source) {
  const m = source.match(/IOS_CANNOT_INSTALL\s*=\s*(\/[^\n]+\/[a-z]*);/);
  return m ? m[1] : null;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function testStatic() {
  const g = 'static';
  const current = regexLiteral(readFileSync(join(APP_DIR, 'app/get-app/route.ts'), 'utf8'));
  let master = null;
  try {
    master = regexLiteral(
      execFileSync('git', ['show', 'master:apps/marketing/app/get-app/route.ts'], { cwd: REPO, encoding: 'utf8' })
    );
  } catch (e) {
    record(g, 'IOS_CANNOT_INSTALL matches master', false, `git show failed: ${e.message.split('\n')[0]}`);
  }
  if (master !== null) {
    expect(g, 'IOS_CANNOT_INSTALL identical to master', [
      [current !== null, 'regex not found in route.ts'],
      [current === master, `differs:\n    now:    ${current}\n    master: ${master}`],
    ]);
  }

  const mobile = readFileSync(join(REPO, 'apps/mobile/src/components/add-to-home-screen-banner.tsx'), 'utf8');
  const mobileRegex = mobile.match(/(\/CriOS[^\n]+\/[a-z]*);/);
  expect(g, 'IOS_CANNOT_INSTALL identical to the mobile banner mirror', [
    [mobileRegex !== null, 'regex not found in add-to-home-screen-banner.tsx'],
    [mobileRegex?.[1] === current, `differs: mobile ${mobileRegex?.[1]}`],
  ]);

  const importers = ['app', 'components', 'lib']
    .flatMap((d) => {
      try {
        return walk(join(APP_DIR, d));
      } catch {
        return [];
      }
    })
    .filter((f) => /from\s+['"](@\/lib\/supabase|(\.\.\/)+lib\/supabase|\.\/supabase)['"]/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(APP_DIR, f).replace(/\\/g, '/'));
  expect(g, 'lib/supabase imported only by app/payment-redirect/route.ts', [
    [importers.length === 1 && importers[0] === 'app/payment-redirect/route.ts', `importers: ${importers.join(', ') || 'none'}`],
  ]);
}

// ───────────────────────────── Run ─────────────────────────────
console.log(`Contract tests against ${BASE}\n`);
testStatic();
try {
  await testGetApp();
  await testPaymentRedirect();
  await testPages();
} catch (e) {
  record('network', `requests to ${BASE}`, false, e.cause?.code || e.message);
}

const width = Math.max(...results.map((r) => r.name.length)) + 2;
let group = '';
for (const r of results) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n${group}`);
  }
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}${r.ok ? '' : r.detail}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
