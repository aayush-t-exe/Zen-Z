# zen-z.site rebuild: "The Table"

Working plan for the `marketing-redesign` branch. The brief is `S:\Projects\ZenZ-Site\BRIEF.md`;
voice and facts follow `docs/CONTENT_CONSTITUTION.md`, `docs/PRODUCT_SPEC.md` and `CLAUDE.md`
(newest source wins). Never merged to `master` from here: Vercel deploys production from it.

## 1. Design system

**Idea.** Warm cream paper, Zen-Z red, a glossy red Z you can play with, hand-drawn doodles. A
friendly student telling you about a good evening, not an app selling a booking.

**Colour** (same family as the portfolio, `S:\portfolio\src\app\globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `paper` / `paper-2` | `#E9E3D5` / `#DFD8C8` | Most sections. Cream first. |
| `ink` / `ink-2` | `#0A0908` / `#141210` | Text on paper; three dramatic sections (feeling, chat, closing). |
| `red` | `#E10600` | Fills, the Z, big type, stickers. Never small text. |
| `red-deep` | `#A80400` | Red text on cream (6.1:1). |
| `red-text` | `#FF3B30` | Red text on ink (5.6:1). |
| `paper-muted` | `#5C564C` | Secondary text on cream (5.6:1). |
| `muted` | `#A39E94` | Secondary text on ink (7.4:1). |
| `butter` | `#F4C84A` | Sticker accent only (one warm second colour for pills). |

**Type.** Archivo variable (600–900, width 75–125) for display; Fraunces italic for warm
emphasis words; Instrument Sans for body; Caveat for handwritten margin notes only (not
preloaded). All via `next/font/google`, self-hosted at build, `display: swap`, size-adjusted
fallbacks, so no layout shift. No SF Pro, no Sitka.

**Texture and shape.** Film grain overlay (SVG noise, static under reduced motion). Curved
section edges (the portfolio's elliptical radius) where cream meets ink. Sticker language:
white keyline + soft drop shadow + slight rotation; trait pills; a rotating circular-text badge;
handwritten notes with scribble arrows and circles (inline SVG).

**Motion personality.** Bouncier than the portfolio: springs with a little overshoot
(`cubic-bezier(.34,1.56,.64,1)` for pops, real spring/verlet for the cord), nothing cinematic.
No mono section numbers, no scramble text, no tech talk.

## 2. Homepage (mobile-first)

| # | Section | Surface | Reference | Motion |
| --- | --- | --- | --- | --- |
| 1 | Hero: hanging Z, rolling sentence, campus chip, device CTA, phone + sticker scatter + QR sticker, proof line | cream | Charmling, 222, Locket, Bumble | Verlet cord + spring drag; slot-machine pills; sticker parallax + cursor drift; screen cycle |
| – | Sticky download pill (QR card on desktop, button on phones) | – | CRED, Grail | Springs in after the hero |
| 2 | The feeling (one honest paragraph) | ink, curved top | CRED, Opal | Words light grey → cream on scroll |
| 3 | How it works: 5 illustrated cards joined by one hand-drawn line | cream | Meetup | Line draws on scroll; cards pop |
| 4 | The plans shelf: one sticker card per activity with icon, group size, length, price | cream | Timeleft doodles | Hover/tap wobble |
| 5 | Try one question (real quiz Q3) dropping balls into trait columns | paper-2 | Timeleft, Grail | Ball drop with bounce, front-end only |
| 6 | Who builds your table (founder note + photo) | cream | – | Polaroid tilt |
| 7 | The fun only works if it's safe: chunky sticker cards | ink | FRND | Pop in |
| 8 | Your campus next: Jaipur line-art map, JNU pinned Live; "Want Zen-Z at your college?" | cream | BookMyShow line art | Pin pulse, path draw |
| 9 | The group chat (clearly an example) | ink | Cleo | Bubbles pop in on scroll |
| 10 | FAQ accordion (native `<details>`) | cream | – | Height spring |
| 11 | Closing CTA "Come sit." with Z glow, device-aware buttons, QR, Instagram | ink, curved top | – | Glow breathe |
| 12 | Footer with the operator/legal block | ink | – | none |

**Other pages.** About, Pricing, FAQ, Contact: illustrated headers, friendly cards. Legal pages
(Terms, Privacy, Refund, Community Guidelines, Delete Account): 680px reading column, sticky
contents on desktop, "Last updated" visible, no heavy motion. 404: "This table doesn't exist."

## 3. Motion map and tech

- `gsap` + `@gsap/react` (ScrollTrigger) for the scrubbed pieces: word reveal, line draw, chat
  bubbles. `useGSAP` with a scope, `gsap.matchMedia()` for desktop / mobile / reduced motion.
- `lenis` for smooth wheel scrolling on desktop; off for touch and reduced motion.
- Hanging Z: a hand-written verlet rope (DOM + SVG, ~150 lines), loaded after first paint. The
  server renders the Z as a still image hanging from a straight cord, so nothing depends on JS.
- Quiz balls: GSAP bounce into columns, no physics library. No three.js, no matter-js.
- Everything text is server-rendered and visible without JS. Reveal classes only hide content
  once JS has marked the document (`html.js`).
- Reduced motion: still Z, first option of each pill, no parallax, no physics, no grain jitter.

**Targets.** Lighthouse mobile Performance ≥ 90, Accessibility ≥ 95, Best Practices and SEO 100.
LCP ≤ 2.5s (the H1 is the LCP element on phones). Sized images, `next/font`.

**SEO.** `metadataBase` https://zen-z.site, canonical per page, OG + Twitter image (cream, red Z,
the sentence), `sitemap.xml`, `robots.txt`, `manifest`, favicon set from the app icon, JSON-LD
Organization + MobileApplication.

## 4. Assets and slots

- Brand: glossy Z (`assets/brand/z-glossy.webp`), Play feature graphic.
- Illustrations (`assets/art`): onboarding hands / gathering / invitation / tables, home match
  banner, booking time art / characters, home banner people, stars.
- 3D icons (`assets/icons`): cafés, dinners, movies, sports, cricket, football, pool, pickleball.
- App screens (`assets/screens`): 01-home … 07-payment, resized to 600w WebP.
- **Slots** (one-file swaps, see `lib/media.ts`): `public/media/zenz-demo.mp4` (+ webm, poster);
  founder photo `assets/founder/portrait.jpg`; meetup photo wall (none exists; the layout leaves
  room and `lib/media.ts` documents how to add it). No faked photos.

## 5. Contract-preservation checklist

- [ ] `/payment-redirect`: still a route handler, GET + POST; POST reads form data or JSON, GET
      reads `txnid`, `status`; no `txnid` → 400; `slot_id_for_payment_reference` with
      `p_payment_id`; error / no row → 404; found → 200 HTML linking and auto-redirecting to
      `mobile://payment-callback?slotId=<id>`. Only the HTML styling and copy change.
- [ ] `/get-app`: `dynamic = 'force-dynamic'`, `Cache-Control: no-store, must-revalidate`,
      Android → 302 Play (`&hl=en`), desktop/other → 302 `https://zen-z-app.vercel.app`, iOS → 200
      HTML, `IOS_CANNOT_INSTALL` regex byte-identical (mirrored in the mobile app), Safari steps
      page with "Continue to Zen-Z →", in-app page with `x-safari-https://`, copy link, "Skip for
      now". Only styling changes.
- [ ] `/privacy`, `/terms`, `/refund`, `/delete-account`, `/pricing`, `/contact`, `/about`,
      `/community-guidelines`, `/`, `/faq` all return 200 with their content.
- [ ] Operator footer on every page (incl. 404): Dhruv Goyal, address, email, both phones,
      Privacy, Terms, Refunds, Community Guidelines, Delete Account.
- [ ] `lib/supabase.ts` imported only by `payment-redirect`. Env vars unchanged.
- [ ] Dependencies added to `apps/marketing` only. No major upgrades.
- [ ] `scripts/contract-test.mjs` passes against `next build && next start`.

## 6. Facts used (and where they come from)

Live on Google Play since 24 Sep 2026 for JNU Jaipur; iPhone via `/get-app`. Email-code sign-in.
Photo seen only by the team. A few quiz questions (7 active, migration 0089–0095). Booking:
activity → fixed weekly time → budget band (skipped for sports) → mixed / women only / men only
→ optional +1. Groups of 4–5 (Box Cricket 10–14, Football 8–14, Pool and Pickleball 4), built
by hand; venue picked by the team. Venue and chat open 48h before, reminder 2h before.
Booking closes midnight IST two days before. Cafés and Dinners free since 28 Sep 2026 (0101);
Movies from ₹126 (0088); Box Cricket ₹221 · 2 hrs, Football ₹221 · 1 hr, 8-Ball Pool ₹70 · 1 hr,
Pickleball ₹129 · 1 hr. +1 doubles the price. Referral: ₹21 off your next Movie or Sports booking
when a friend's first paid booking goes through. Automatic full refund if no group forms or we
cancel; no refund on a no-show. Proof: 150+ students in the first 2 days, @zen_z.app 550+
followers and 140K+ views, live on Google Play, pitched at JNU Shark Tank (Sep 2026).
Weekly table capacity is **not stated** until confirmed (`lib/site.ts → tablesPerWeek`).
