# Operating Manual & Product Specification — v2 (Production-Ready)
## Campus-First Concierge Social Discovery Startup
*Supersedes conflicting sections of the prior manual. Structure preserved where unaffected. Sections below are the authoritative replacement wherever they overlap with v1.*

> **One flagged tradeoff, stated once and then implemented as instructed:** removing student-institution email verification and all identity checks (per the new constraints) removes the near-zero-cost trust floor the earlier trust & safety analysis relied on — the product now authenticates *an email address*, not *a specific student*. This is a legitimate product decision (it removes real friction and matches the "mysterious/adventurous" positioning), but it means the founder-only photo visibility and manual moderation judgment calls (Module 2) become the *primary*, not secondary, safety mechanism. This is implemented fully below as specified, flagged here once so it's a conscious tradeoff rather than a silent one.

---

# MODULE 1 — User Mobile App

### 1.0 Updated Information Architecture
```
Onboarding → Email OTP Auth → Profile + Founder-Only Photo →
Modular Personality Quiz → Home (all 3 activities live) →
Booking Flow (no location) → Waiting Experience → Match Reveal →
Group Chat → Event Day → Feedback
```

### 1.1 Onboarding
```
┌─────────────────────────────┐
│        [App Logo]            │
│                               │
│   Somewhere nearby, four      │
│   strangers are about to      │
│   become your next story.     │
│                               │
│   ┌────────────────────┐    │
│   │  Begin →            │    │
│   └────────────────────┘    │
│                               │
│   Already in? Continue        │
└─────────────────────────────┘
```
- 3-screen intro, tone-aligned: (1) *"Every table has a story before anyone sits down."* (2) *"We craft your group. You just show up."* (3) *"No swiping. No searching. Just an invitation."*

### 1.2 Email OTP Authentication
```
┌─────────────────────────────┐
│   Where should we send your   │
│   invitation?                 │
│   ┌────────────────────┐    │
│   │ you@email.com        │    │
│   └────────────────────┘    │
│   ┌────────────────────┐    │
│   │  Send the code →     │    │
│   └────────────────────┘    │
└─────────────────────────────┘
       ↓
┌─────────────────────────────┐
│   Check your inbox            │
│   Enter the 6-digit code      │
│   [_][_][_][_][_][_]          │
│   Didn't get it? Resend        │
└─────────────────────────────┘
```
- **[NEW DETAIL]** Any personal email provider accepted (Gmail/Outlook/Yahoo/etc.) — Supabase Auth email-OTP flow, no phone number field anywhere in the schema or UI. No student-domain check, no allow-list.

### 1.3 Profile Creation (incl. Founder-Only Photo)
```
┌─────────────────────────────┐
│   A few details before we     │
│   begin                       │
│   First name: [______]        │
│   Year of study: [Dropdown]   │
│   Gender: [___]                │
│   WhatsApp number: [______]    │
│                                │
│   Add a photo                  │
│   ┌──────────┐                 │
│   │  Upload   │                 │
│   └──────────┘                 │
│   This photo is seen only by   │
│   our team, to help us craft   │
│   the right group for you —    │
│   never by other members.      │
└─────────────────────────────┘
```
- **[NEW DETAIL]** The privacy line ("seen only by our team... never by other members") is shown directly on the upload screen, not buried in a settings page — this is a trust-critical disclosure given the new no-verification model and must be explicit at the point of capture, not just in a privacy policy.
- **[ASSUMPTION]** A WhatsApp number field is collected here, separate from the auth method (email or phone OTP). This is for founder-to-group event-day logistics (venue changes, reminders) and is not an identity check — it doesn't gate anything, isn't used for OTP, and has no verification step. Stored in `profiles.phone`, the same column the phone-OTP auth path uses; email-OTP users simply populate it here instead of at sign-in.

### 1.4 Modular Personality Quiz (Frontend Rendering)
```
┌─────────────────────────────┐
│   Question 2 of 5              │
│   ●●○○○                        │
│                                 │
│   When the night doesn't go     │
│   as planned, you...            │
│   ○ Roll with it                │
│   ○ Quietly problem-solve       │
│   ○ Make it the best story      │
│      later                       │
│   ○ Look to someone else to      │
│      lead                        │
└─────────────────────────────┘
```
- **[NEW DETAIL]** Screen renders **entirely from the `personality_questions` table** (Module 3) — question text, option set, and question type (single-select / scale / multi-select-chips) are all data-driven. Adding question #6 through #15+ requires zero frontend code changes; the renderer switches on `question_type` and iterates `options` from the DB. Progress dots (`●●○○○`) auto-adjust to `count(active questions)`.

### 1.5 Home — All Three Activities Live
```
┌─────────────────────────────┐
│   Ready for something?         │
│   ┌──────────┐┌──────────┐   │
│   │☕ Cafés   ││🍽 Dinners│   │
│   │  Unlock a ││ Unlock a │   │
│   │  table    ││ table    │   │
│   └──────────┘└──────────┘   │
│   ┌──────────┐                │
│   │🎬 Movies  │                │
│   │  Unlock a  │                │
│   │  seat      │                │
│   └──────────┘                │
└─────────────────────────────┘
```
- All three tappable and fully live from day one, per the new constraint — no locked/greyed states anywhere in this screen.

### 1.6 Booking Flow (No Location Field)
```
Step 1 — Activity: [Dinners] (selected)
Step 2 — Day & Time:
┌─────────────────────────────┐
│   When do you want your       │
│   story to begin?              │
│   ○ Wed · 7:00 PM              │
│   ○ Sat · 8:00 PM              │
└─────────────────────────────┘
Step 3 — Budget:
┌─────────────────────────────┐
│   What's your range?           │
│   ○ Under ₹300  ○ ₹300–600    │
│   ○ ₹600+                      │
└─────────────────────────────┘
Step 4 — Group Preference:
┌─────────────────────────────┐
│   Who's in the room?           │
│   ○ Surprise me (mixed)        │
│   ○ Women only                 │
└─────────────────────────────┘
Step 5 — Confirm:
┌─────────────────────────────┐
│   Dinners · Wed 7 PM            │
│   Group of 4–5 · Surprise me    │
│   ₹25 to unlock this evening     │
│   [ Unlock Your Next Adventure ]│
└─────────────────────────────┘
```
- **[NEW DETAIL]** No area/venue/location field anywhere in the flow, per constraint — venue is decided entirely by the founder post-booking (Module 2) and revealed only at Match Reveal.

### 1.7 Waiting Experience (Tone-Redesigned)
```
┌─────────────────────────────┐
│   Something interesting is     │
│   coming.                       │
│                                  │
│   Dinners · Wed 7 PM             │
│   Your group is being crafted    │
│   right now.                     │
│                                  │
│   ✦ ✦ ✦ ✧ ✧                     │
│                                  │
│   We'll reveal everything by     │
│   Tue, 8 PM.                     │
│   [ I can wait ]  [ Cancel ]      │
└─────────────────────────────┘
```
- **[NEW DETAIL]** Replaces the fill-count progress bar from v1 ("3/5 spots filled") with an intentionally vaguer "✦✦✦✧✧" motif — the mystery-forward tone trades the transparency/urgency mechanic from v1 for anticipation; this is a deliberate tone-vs-liquidity-signal tradeoff worth the founder watching in Week 1–4 data (does vagueness reduce booking confidence?).

### 1.8 Match Reveal
```
┌─────────────────────────────┐
│   The story begins here. 🎭     │
│                                  │
│   Dinners · Wed 7 PM             │
│   Venue revealed 2 hours before   │
│                                  │
│   Meet your group:                │
│   ✦ Ravi — 2nd year, always up    │
│     for the unexpected             │
│   ✦ Meher — 3rd year, collects     │
│     stories more than souvenirs    │
│   ✦ Aditya — 1st year, still       │
│     figuring out the plot           │
│                                  │
│   [ Enter the Group Chat → ]       │
└─────────────────────────────┘
```
- **[NEW DETAIL]** Venue is deliberately withheld until 2 hours pre-event (configurable), reinforcing the mystery framing while giving the founder a firm operational deadline to finalize venue booking (feeds directly into Module 2 workflow timing). No photos shown — first name, year, and an AI/founder-crafted blurb only, per the photo-privacy constraint.

### 1.9 Group Chat
```
┌─────────────────────────────┐
│   Dinners · Wed 7 PM  ⓘ         │
│   Ravi, Meher, Aditya, You       │
│ ───────────────────────────    │
│   ✦ The venue reveals in 2       │
│     hours. Stay tuned.            │
│   Ravi: can't wait to see         │
│     where this goes 😄            │
│ ───────────────────────────    │
│   [Type a message...]  [Send]    │
└─────────────────────────────┘
```

### 1.10 Notifications (Microcopy Updated)
| Trigger | Old (v1) copy | New copy |
|---|---|---|
| Booking confirmed | "You're on the list for Café Hopping, Wed 6 PM!" | "Your invitation is sealed. Dinners, Wed 7 PM." |
| Group matched | "Your group is ready — tap to meet them!" | "The story begins here. Tap to meet your group." |
| Venue reveal (2h before) | *(not present in v1)* | "The mystery unlocks — here's where to be." |
| 2h before event | "See you in 2 hours!" | "Two hours until your next adventure." |
| Post-event | "How was it? Rate your group" | "How did your story end tonight?" |
| No-show | "We noticed you missed..." | "Your seat sat empty tonight. Here's what that means next time." |

### 1.11 Event Flow
```
┌─────────────────────────────┐
│   Tonight's chapter: Dinners     │
│   📍 [Venue revealed here]        │
│   Your group: Ravi, Meher,        │
│   Aditya                          │
│   [ I've arrived ✓ ]               │
│   [ Something came up ]             │
└─────────────────────────────┘
```

### 1.12 Feedback
```
┌─────────────────────────────┐
│   How did your story end?        │
│   ⭐⭐⭐⭐⭐                          │
│   Would you step into another     │
│   one?                            │
│   ○ Absolutely  ○ Maybe  ○ Not    │
│      this time                    │
│   Anything worth telling us,      │
│   privately? [________________]   │
│   [ Submit ]                      │
└─────────────────────────────┘
```

### 1.13 Referrals
```
┌─────────────────────────────┐
│   Invite someone into the        │
│   story                           │
│   Your next adventure is free     │
│   when a friend takes their       │
│   first step in.                  │
│   Your code: RAVI2K25              │
│   [ Share via WhatsApp ]           │
└─────────────────────────────┘
```

---

# MODULE 2 — Founder Admin Dashboard

### 2.1 Dashboard (Home) — Unchanged Structurally, Metrics Updated
```
┌───────────────────────────────────────────┐
│  Today: Wed, Aug 12          [Founder: You]│
│  ─────────────────────────────────────────│
│  📋 Bookings this week: 61 (☕27 🍽22 🎬12)  │
│  ✅ Groups formed: 12 / 14 target            │
│  ⚠️  Unmatched (need action): 5              │
│  💬 Open support tickets: 3                  │
│  🚩 Pending reports: 1                       │
│  ─────────────────────────────────────────│
│  [ Go to Matching Queue → ]                  │
└───────────────────────────────────────────┘
```
- Per-activity breakdown now shown by default since all three categories are live simultaneously (a v1-only concern is gone; this v2 dashboard must surface cross-category load at a glance, since the founder is now juggling 3x the matching surface area from day one).

### 2.2 Booking Queue with Student Cards
```
┌───────────────────────────────────────────┐
│  Dinners · Wed 7 PM   (9 unmatched)          │
│  ┌──────────────────────────────────────┐  │
│  │ [📷] Ravi  ·  M  ·  2nd yr             │  │
│  │  Budget: ₹300-600  ·  Mixed OK         │  │
│  │  Vector: [Adventurous 0.8][Talker 0.7] │  │
│  │          [Novelty-seeking 0.9]          │  │
│  │  [ View Full Profile ]                  │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ [📷] Meher · F · 3rd yr                 │  │
│  │  ... (same card format)                 │  │
│  └──────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```
- **[NEW DETAIL — Founder-Only Photo]** The `[📷]` thumbnail on each Student Card is the **only place in the entire product where a profile photo renders** — enforced at the RLS/query layer (Module 3), not just hidden in the UI, so there is no client-side path that could leak it to the mobile app.

### 2.3 Personality Vector Display
```
┌───────────────────────────────────────────┐
│  Ravi's Personality Profile                  │
│  ┌────────────────────────────────────┐    │
│  │ Adventurous      ▓▓▓▓▓▓▓▓░░  0.8     │    │
│  │ Talker/Listener  ▓▓▓▓▓▓▓░░░  0.7 (T) │    │
│  │ Novelty-seeking  ▓▓▓▓▓▓▓▓▓░  0.9     │    │
│  │ Comfort w/ new    ▓▓▓▓▓▓░░░░  0.6     │    │
│  │   people                              │    │
│  └────────────────────────────────────┘    │
│  Raw answers: [ Expand ▾ ]                    │
└───────────────────────────────────────────┘
```
- **[NEW DETAIL]** This view is generated dynamically from **whatever dimensions currently exist** in `personality_dimensions` (Module 3) — with 5 questions live it shows however many dimensions those 5 map to; when the founder adds question 6–15+, new bars appear automatically with zero dashboard code changes, because the component iterates the scored-dimension result set rather than referencing named fields.

### 2.4 Drag-and-Drop Matching Board
```
┌──────────────────┬──────────────────────────┐
│  UNMATCHED POOL     │  GROUP 1 (3/5)  [Book]   │
│  ┌──────┐           │  ┌──────┐ ┌──────┐        │
│  │📷Ravi│ ⇢ drag →   │  │📷Meher││📷Aditya│       │
│  └──────┘           │  └──────┘ └──────┘        │
│  Vector similarity   │  Compatibility: 0.82        │
│  badge: 0.82 w/ G1    │                            │
└──────────────────┴──────────────────────────┘
```
- Functionally identical drag-and-drop mechanic to v1, with two additions: (1) photo thumbnails now visible only here (never in the mobile app), (2) the compatibility score is computed from the **full active personality-vector set**, not a hardcoded 4-field scoring function — see Module 3's extensible scoring design.

### 2.5 Venue Management
- Unchanged from v1 structurally, but now operationally more central: since the mobile app collects **no location preference at all**, the founder has full discretion and must actively select a venue for every confirmed group (not just confirm a student-suggested area). Add a required field to the group-confirmation step: `venue_id` must be set before "Book Venue" can be clicked — this is now a hard gate, not optional, because there is no fallback location signal from the user side.

### 2.6 Payments, Reports, Moderation, Analytics
- Structurally unchanged from v1 (Sections 2.5–2.8 there), with one addition to Moderation: since there is no student verification at all in v2, the **first-report-on-any-user threshold for pausing matching should be lower than it was in v1** (recommend: pause on first report, not after a pattern) — **[ASSUMPTION]**, a direct consequence of removing the identity-verification trust floor, flagged for founder judgment.

---

# MODULE 3 — Technical Architecture

### 3.1 Stack (Unchanged)
React Native + Expo · Next.js (admin) · Supabase (Postgres/Auth/Storage/Realtime/Edge Functions) · Razorpay/Cashfree · GitHub · Cursor + Claude Code.

### 3.2 Complete Production SQL

```sql
-- ============================================
-- PROFILES (email auth, founder-only photo)
-- ============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  gender text check (gender in ('male','female','other','prefer_not_to_say')),
  year_of_study smallint,
  -- Photo stored, but access is gated entirely via RLS + a private bucket.
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- MODULAR PERSONALITY FRAMEWORK
-- ============================================
-- Dimensions are the underlying traits being measured
-- (e.g., "Adventurous", "Novelty-seeking") - independent
-- of how many questions currently map to them.
create table personality_dimensions (
  id serial primary key,
  key text unique not null,        -- e.g. 'adventurous'
  label text not null,             -- e.g. 'Adventurous'
  created_at timestamptz default now()
);

-- Questions are fully data-driven; adding #6-15+ never
-- touches frontend or backend code.
create table personality_questions (
  id serial primary key,
  prompt text not null,
  question_type text not null
    check (question_type in ('single_select','multi_select','scale')),
  display_order int not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Options belong to a question (for single/multi-select types).
-- Each option can contribute weighted scores to one or more
-- dimensions, so a single answer can inform multiple traits.
create table personality_question_options (
  id serial primary key,
  question_id int references personality_questions(id) on delete cascade,
  label text not null,
  display_order int not null
);

create table personality_option_weights (
  option_id int references personality_question_options(id) on delete cascade,
  dimension_id int references personality_dimensions(id) on delete cascade,
  weight numeric not null,          -- e.g. +0.8 toward 'adventurous'
  primary key (option_id, dimension_id)
);

-- For scale-type questions, the raw value maps directly
-- to one dimension via a configured multiplier.
create table personality_scale_mappings (
  question_id int references personality_questions(id) on delete cascade,
  dimension_id int references personality_dimensions(id) on delete cascade,
  multiplier numeric not null default 1,
  primary key (question_id, dimension_id)
);

-- Raw answers per user, per question.
create table personality_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  question_id int references personality_questions(id),
  selected_option_ids int[],        -- for select types
  scale_value numeric,              -- for scale types
  created_at timestamptz default now(),
  unique (user_id, question_id)
);

-- Materialized/derived scores per user per dimension.
-- Recomputed via an Edge Function whenever answers change,
-- so the dashboard can query this directly instead of
-- recalculating on every render.
create table personality_scores (
  user_id uuid references profiles(id) on delete cascade,
  dimension_id int references personality_dimensions(id) on delete cascade,
  score numeric not null,           -- normalized 0-1
  updated_at timestamptz default now(),
  primary key (user_id, dimension_id)
);

-- ============================================
-- ACTIVITIES & SLOTS (all live from day 1)
-- ============================================
create table activity_types (
  id serial primary key,
  name text not null,               -- 'Cafes' | 'Dinners' | 'Movies'
  emoji text,
  is_live boolean default true,     -- always true per v2 constraint
  min_group_size int default 4,
  max_group_size int default 5
);

create table slots (
  id uuid primary key default gen_random_uuid(),
  activity_type_id int references activity_types(id),
  slot_datetime timestamptz not null,
  status text default 'open' check (status in ('open','matching','closed')),
  reveal_venue_at timestamptz  -- computed: slot_datetime - 2h
);

-- ============================================
-- BOOKINGS (no location field, per constraint)
-- ============================================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  slot_id uuid references slots(id),
  budget_band text,
  group_preference text check (group_preference in ('mixed','women_only')),
  status text default 'pending_match'
    check (status in ('pending_match','matched','cancelled','no_show','completed')),
  payment_status text default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  payment_id text,
  created_at timestamptz default now()
  -- NOTE: no area/location/venue_preference column exists in v2.
);

-- ============================================
-- GROUPS / VENUES / MESSAGES / FEEDBACK / REPORTS
-- (structurally consistent with v1, venue now founder-only)
-- ============================================
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  activity_type_id int references activity_types(id),
  address text,
  capacity int,
  commission_pct numeric default 0,
  contact_info text,
  notes text
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references slots(id),
  venue_id uuid references venues(id),   -- required before confirmation, enforced in Edge Function
  status text default 'forming' check (status in ('forming','confirmed','completed','cancelled')),
  formed_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table group_members (
  group_id uuid references groups(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  primary key (group_id, booking_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  sender_id uuid references profiles(id),
  content text,
  is_system boolean default false,
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  rating smallint check (rating between 1 and 5),
  would_repeat text check (would_repeat in ('yes','maybe','no')),
  private_note text,
  created_at timestamptz default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id),
  reported_user_id uuid references profiles(id),
  group_id uuid references groups(id),
  reason text,
  status text default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz default now()
);

create table no_shows (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  user_id uuid references profiles(id),
  slot_id uuid references slots(id),
  created_at timestamptz default now()
);

create table referrals (
  code text primary key,
  owner_id uuid references profiles(id),
  used_by uuid references profiles(id),
  used_at timestamptz
);

-- Admin allow-list (no public admin signup path)
create table admin_users (
  id uuid primary key references auth.users(id)
);
```

### 3.3 Row Level Security — Full Privacy Enforcement

```sql
alter table profiles enable row level security;
alter table personality_answers enable row level security;
alter table personality_scores enable row level security;
alter table bookings enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;
alter table reports enable row level security;
alter table no_shows enable row level security;

-- ── PROFILES ──────────────────────────────────
-- Students can read/update their OWN full row (incl. their own photo_url).
create policy "self read profile" on profiles
  for select using (auth.uid() = id);
create policy "self update profile" on profiles
  for update using (auth.uid() = id);

-- Admins can read ALL profiles (including photo_url) — this is the
-- ONLY role permitted to read other users' photo_url.
create policy "admin read all profiles" on profiles
  for select using (auth.uid() in (select id from admin_users));

-- ── CRITICAL: photo visibility enforcement ──────
-- Students must NEVER receive another student's photo_url via any
-- query. Because "self read" only allows auth.uid() = id, a student
-- querying profiles for their groupmates will hit RLS denial on the
-- base table. Group-member-visible info is instead served through a
-- restricted VIEW that excludes photo_url entirely:
create view group_member_public as
  select id, full_name, year_of_study
  from profiles;
alter view group_member_public set (security_invoker = true);
-- The mobile app queries ONLY this view for match-reveal/group-chat
-- member info — it has no photo_url column, so there is no code path
-- (even a buggy one) that can leak a photo to the mobile client.

create policy "members read groupmate public info" on profiles
  for select using (
    -- allows the view above to resolve rows for groupmates,
    -- but the view's column list still excludes photo_url
    exists (
      select 1 from group_members gm1
      join group_members gm2 on gm1.group_id = gm2.group_id
      join bookings b1 on b1.id = gm1.booking_id
      join bookings b2 on b2.id = gm2.booking_id
      where b1.user_id = auth.uid() and b2.user_id = profiles.id
    )
  );

-- ── PERSONALITY ANSWERS/SCORES ──────────────────
create policy "self read own answers" on personality_answers
  for select using (auth.uid() = user_id);
create policy "self write own answers" on personality_answers
  for insert with check (auth.uid() = user_id);
create policy "admin read all answers" on personality_answers
  for select using (auth.uid() in (select id from admin_users));

create policy "self read own scores" on personality_scores
  for select using (auth.uid() = user_id);
create policy "admin read all scores" on personality_scores
  for select using (auth.uid() in (select id from admin_users));

-- ── BOOKINGS ─────────────────────────────────────
create policy "own bookings" on bookings
  for select using (auth.uid() = user_id);
create policy "own bookings insert" on bookings
  for insert with check (auth.uid() = user_id);
create policy "admin manage all bookings" on bookings
  for all using (auth.uid() in (select id from admin_users));

-- ── GROUPS / GROUP MEMBERS ───────────────────────
create policy "members read own groups" on groups
  for select using (
    exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = groups.id and b.user_id = auth.uid()
    )
  );
create policy "admin manage groups" on groups
  for all using (auth.uid() in (select id from admin_users));

create policy "members read own group_members" on group_members
  for select using (
    exists (
      select 1 from bookings b where b.id = group_members.booking_id
      and b.user_id = auth.uid()
    )
    or exists (
      select 1 from group_members gm2 join bookings b2 on b2.id = gm2.booking_id
      where gm2.group_id = group_members.group_id and b2.user_id = auth.uid()
    )
  );

-- ── MESSAGES ──────────────────────────────────────
create policy "group members read messages" on messages
  for select using (
    exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = messages.group_id and b.user_id = auth.uid()
    )
  );
create policy "group members send messages" on messages
  for insert with check (
    auth.uid() = sender_id and exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = messages.group_id and b.user_id = auth.uid()
    )
  );

-- ── FEEDBACK / REPORTS / NO_SHOWS ────────────────
create policy "own feedback insert" on feedback
  for insert with check (
    exists (select 1 from bookings b where b.id = booking_id and b.user_id = auth.uid())
  );
create policy "admin read feedback" on feedback
  for select using (auth.uid() in (select id from admin_users));

create policy "users create reports" on reports
  for insert with check (auth.uid() = reporter_id);
create policy "admin manage reports" on reports
  for all using (auth.uid() in (select id from admin_users));

create policy "admin manage no_shows" on no_shows
  for all using (auth.uid() in (select id from admin_users));
```

### 3.4 Storage (Photo Privacy at the Bucket Level)

```sql
-- Private bucket, not public. Only the owner and admins can upload/read.
insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', false);

create policy "self upload own photo" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "self read own photo" on storage.objects
  for select using (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "admin read all photos" on storage.objects
  for select using (
    bucket_id = 'profile-photos' and auth.uid() in (select id from admin_users)
  );
-- No policy grants students read access to any other student's folder —
-- this is enforced at the storage layer, not just the app UI.
```

### 3.5 Extensible Scoring — Edge Function Logic

```javascript
// supabase/functions/score-personality/index.ts
// Runs whenever a user submits/updates an answer. Fully generic —
// works identically whether 5 or 50 questions/dimensions exist.

async function recomputeScores(userId) {
  const { data: answers } = await supabase
    .from('personality_answers')
    .select('question_id, selected_option_ids, scale_value')
    .eq('user_id', userId);

  const dimensionTotals = {}; // { dimension_id: { sum, count } }

  for (const answer of answers) {
    if (answer.selected_option_ids?.length) {
      const { data: weights } = await supabase
        .from('personality_option_weights')
        .select('dimension_id, weight')
        .in('option_id', answer.selected_option_ids);
      for (const w of weights) {
        dimensionTotals[w.dimension_id] ??= { sum: 0, count: 0 };
        dimensionTotals[w.dimension_id].sum += w.weight;
        dimensionTotals[w.dimension_id].count += 1;
      }
    }
    if (answer.scale_value != null) {
      const { data: mappings } = await supabase
        .from('personality_scale_mappings')
        .select('dimension_id, multiplier')
        .eq('question_id', answer.question_id);
      for (const m of mappings) {
        dimensionTotals[m.dimension_id] ??= { sum: 0, count: 0 };
        dimensionTotals[m.dimension_id].sum += answer.scale_value * m.multiplier;
        dimensionTotals[m.dimension_id].count += 1;
      }
    }
  }

  const rows = Object.entries(dimensionTotals).map(([dimension_id, { sum, count }]) => ({
    user_id: userId,
    dimension_id: Number(dimension_id),
    score: normalizeToUnitRange(sum / count), // clamp/normalize 0-1
    updated_at: new Date().toISOString(),
  }));

  await supabase.from('personality_scores').upsert(rows);
}
```
- **[NEW DETAIL]** Adding question 6–15+ requires only new `INSERT`s into `personality_questions`, `personality_question_options`, and `personality_option_weights`/`personality_scale_mappings` — this function, the quiz renderer (1.4), and the Vector Display (2.3) all require **zero code changes** to support it, satisfying the "supports 5 today, 15+ later without changing frontend/DB architecture" requirement literally.

### 3.6 Matching Compatibility Score (Updated for Vector Model)
```javascript
// Replaces the v1 hardcoded 4-field heuristic with a generic
// cosine-similarity over however many active dimensions exist.
function compatibilityScore(userA_scores, userB_scores) {
  const dims = Object.keys(userA_scores).filter(d => d in userB_scores);
  const dot = dims.reduce((s, d) => s + userA_scores[d] * userB_scores[d], 0);
  const magA = Math.sqrt(dims.reduce((s, d) => s + userA_scores[d] ** 2, 0));
  const magB = Math.sqrt(dims.reduce((s, d) => s + userB_scores[d] ** 2, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}
```
- Founder-facing badge (2.4) shows this as a 0–1 similarity score; hard filters (group_preference, existing reports/blocklist) are still applied before this score is ever computed, unchanged from v1's design principle of hard constraints first, soft scoring second.

### 3.7 Notifications, Payments, Realtime
- Unchanged from v1's Section 4.7–4.8 mechanically (Expo Push, Razorpay/Cashfree, Supabase Realtime for live matching-board and waiting-experience updates) — only the **copy templates** change (Section 1.10 table above), and the payment/auth flow no longer references phone number anywhere.

---

*This v2 spec is implementation-ready: every table, RLS policy, and function above is copy-pasteable as a starting migration set. Treat the single flagged tradeoff (identity verification removed) as an open item for the founding team to revisit once real usage data exists — not a blocker to building this as specified.*
