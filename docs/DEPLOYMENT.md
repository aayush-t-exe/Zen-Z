# Deployment runbook (Milestone 20)

This is the step-by-step checklist for getting the admin dashboard, the
marketing site, and a test build of the mobile app live. Account creation,
DNS changes, and interactive CLI logins can't be done from here — each step
below says who does it.

Domain: `zen-z.site`, purchased on Hostinger. Split:
- `admin.zen-z.site` → the Next.js admin dashboard (`apps/admin`)
- `zen-z.site` (apex) → the marketing site (`apps/marketing`)

Supabase projects (already provisioned, confirmed live via `supabase
projects list`):
- `campus-social-dev` — ref `vsdztarpdmeaxfrtxtcz`
- `campus-social-prod` — ref `hzydzyeyvfuokveujbki`

## 1. Vercel — admin dashboard

**You do this** (no Vercel CLI is authenticated on this machine):

1. Create/log into a Vercel account, "Add New Project", import this GitHub
   repo.
2. Set **Root Directory** to `apps/admin`. Vercel auto-detects the npm
   workspaces setup at the repo root and runs `npm install` there, then
   auto-detects Next.js — no `vercel.json` needed.
3. Environment variables:
   | Env | Production | Preview / Development |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://hzydzyeyvfuokveujbki.supabase.co` | `https://vsdztarpdmeaxfrtxtcz.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_in9PqwUIAa1OOmLErfFO2w_2fve-R4x` | `sb_publishable_h3JitSz-Jg36NvUzquQz4A_evcoAkIW` |

   These are publishable/anon keys — safe to paste in the dashboard, not
   secrets.
4. Domains tab → add `admin.zen-z.site`.
5. Settings → Git → **Ignored Build Step** → Custom, set to:
   ```
   git diff --quiet HEAD^ HEAD -- apps/admin packages || exit 1
   ```
   This skips a rebuild when a push only touches `apps/mobile` or
   `apps/marketing`.

## 2. Vercel — marketing site

**You do this:**

1. "Add New Project" again, same repo, **Root Directory** = `apps/marketing`.
   No env vars needed — it's static content, no Supabase calls.
2. Domains tab → add `zen-z.site` (apex).
3. Ignored Build Step → Custom:
   ```
   git diff --quiet HEAD^ HEAD -- apps/marketing || exit 1
   ```

## 3. Hostinger DNS records

**You do this**, in Hostinger's DNS zone editor for `zen-z.site`:

| Type | Host | Value |
|---|---|---|
| A | `@` | `76.76.21.21` (Vercel's current anycast IP) |
| CNAME | `admin` | `cname.vercel-dns.com` |

Vercel will show "Valid Configuration" on both domains once DNS propagates
(usually minutes, can take longer depending on Hostinger's TTL).

## 4. Brevo — email OTP (replaces Resend)

**You do this** (approved swap — Brevo's free tier is 300 emails/day vs.
Resend's 100/day):

1. Create a Brevo account.
2. Add and verify `zen-z.site` as a sending domain. Brevo's setup wizard
   gives you exact SPF (TXT), DKIM (CNAME), and DMARC (TXT) records to add
   at Hostinger — add whatever it shows you; these coexist fine with the A/
   CNAME records above (different record types, same zone).
3. Generate SMTP credentials (SMTP tab in Brevo).
4. Paste them into **both** Supabase projects' dashboards — Authentication
   → Emails → SMTP Settings:
   - `campus-social-dev` (needed too — the hosted dev project is currently
     on Supabase's own rate-limited mailer, not Brevo)
   - `campus-social-prod`

`supabase/config.toml`'s `[auth.email.smtp]` block stays commented out —
that only affects local `supabase start`, not these hosted projects, so
there's no repo change needed for this step.

## 5. Mobile — EAS test build (no app store submission)

Apple Developer Program / Google Play Console enrollment is explicitly
deferred until the app is fully tested — so this is a store-free internal
build, Android only. (Any device-installable iOS build — dev-client,
ad-hoc, or production — requires an active Apple Developer Program
membership for code signing; there's no way around that without enrolling,
so iOS distribution waits.)

**You do this** (needs an interactive browser login, can't run here):

```
cd apps/mobile
eas login
eas build --profile preview --platform android
```

The `preview` profile (`eas.json`) now builds a directly-installable APK
(added `android.buildType: apk` — it wasn't there before, and EAS defaults
to a non-sideloadable AAB regardless of distribution channel) pointed at
the **dev** Supabase project, since testing is still ongoing. Once the
build finishes, EAS gives you an internal-distribution install page/QR
code — no Play Console account needed. Scan it on an Android test device to
install.

## Verification checklist

- [ ] `https://admin.zen-z.site` loads the admin login screen
- [ ] `https://zen-z.site` loads the marketing page
- [ ] A test signup on `campus-social-dev` sends its OTP via Brevo (check
      Brevo's activity log, not Supabase's default mailer)
- [ ] Same check on `campus-social-prod`
- [ ] The EAS `preview` APK installs on an Android device and successfully
      loads data from the dev Supabase project
