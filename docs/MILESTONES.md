# Milestone tracker

We build one milestone at a time. Stop after each milestone and wait for the
founder's approval before continuing. No placeholder code, no skipped setup
steps, no TODOs left in anything marked done.

| # | Milestone | Status |
|---|---|---|
| 1 | Final Architecture | ✅ Done — see docs/ARCHITECTURE.md |
| 2 | Project Setup | ✅ Done — monorepo + Expo mobile scaffold |
| 3 | Supabase Setup | ✅ Done — dev/prod projects linked, schema deployed with RLS |
| 4 | Authentication (Email signup without confirmation) | ✅ Done — onboarding, profile creation, photo upload |
| 5 | Database | ✅ Done — personality dimensions & questions seeded |
| 6 | Storage | ✅ Done — photo access helpers & signed URLs |
| 7 | Mobile Navigation | ✅ Done — bottom tab nav with 4 sections |
| 8 | Onboarding | ✅ Done — splash + swipeable intro cards |
| 9 | Profile Creation | ✅ Done — name/year/gender/WhatsApp + founder-only photo upload |
| 10 | Personality System | ✅ Done — data-driven quiz + scoring |
| 11 | Booking Flow | ✅ Done — 5-step flow, no location field |
| 12 | Payments | ✅ Done — PayU order creation, Edge Function, mobile UI |
| 13 | Founder Dashboard | ✅ Done — dashboard, matching queue, drag-and-drop matching board, venue management |
| 14 | Matching Engine | ✅ Done — group_preference hard filter enforced in the matching board, payment-gated matching pool, admin Groups view |
| 15 | Group Chat | ✅ Done — 48h reveal gate on venue + chat (my_group_details view, time-gated RLS), realtime group chat, mobile booking status flow (sealed → matched → revealed) |
| 16 | Notifications | ✅ Done — Expo Push via a notifications_outbox queue, instant triggers (booking confirmed, group matched, no-show) plus a pg_cron-driven periodic scan (venue reveal, 2h-before reminder, post-event prompt), send-notifications Edge Function, mobile registration + tap routing |
| 17 | Reports & Moderation | ✅ Done — mobile in-chat reporting, admin reports queue (resolve/dismiss), permanent reporter/reported blocklist hard-gated in confirm_group(), matching board warning badge on open reports (no auto-pause, founder decision 2026-08-14) |
| 18 | Analytics | ✅ Done — admin /analytics page (dashboard-only, built from existing Supabase data): KPI cards, payment-conversion/repeat-booking meters, booking funnel, weekly bookings-by-activity and revenue charts (recharts), no-show trend, reports snapshot |
| 19 | Testing | ✅ Done — pgTAP tests for RLS/DB gates (photo privacy, confirm_group payment/blocklist/gender gates, 48h reveal gate, no-show block) run against the linked dev project (no Docker needed); Vitest for Edge Function pure logic and the admin app (compatibility scoring, matching-board placement rules, analytics calculations); Jest (jest-expo) for mobile lib helpers; GitHub Actions CI (lint/typecheck/test on every PR, pgTAP serialized via a concurrency group). Surfaced and fixed 3 pre-existing DB bugs along the way: dropped groupmate-visibility policy, missing gender/group_preference gate in confirm_group(), and missing venues RLS breaking the venue reveal feature entirely |
| 20 | Deployment | ⬜ |
| 21 | Production Checklist | ⬜ |
| — | Sports activity (founder addition, 2026-08-19) | ✅ Done — fourth home-screen category (Box Cricket, Football, 8-Ball Pool, Pickleball) with its own price/headcount/duration per game, one-off Saturday slot only; existing Café/Dinner/Movie slots trimmed to a single upcoming occurrence each. See docs/PRODUCT_SPEC.md §1.5a |

At each step: what we're building, why now, exactly what to create, every
command to run, every dependency to install, every file to create, folder
structure, complete production-ready code, how to test it, common mistakes
to avoid. Full detail in docs/PRODUCT_SPEC.md and docs/ARCHITECTURE.md.
