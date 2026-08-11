# Claude Code starter kit — campus social app

This folder is everything from our chat-based planning phase, turned into
files Claude Code will read automatically. Nothing here has been built yet —
no `npm install` has run, no Supabase project exists. This is the handoff
point from planning to building.

## How to use this

1. Install Claude Code (requires a Claude Pro plan or higher, or an API key):
   ```
   curl -fsSL https://claude.ai/install.sh | bash        # macOS/Linux/WSL
   ```
   (Windows: see the PowerShell/CMD install commands in Anthropic's docs at
   code.claude.com/docs/en/overview if you're not using WSL.)

2. Create your real project folder and copy everything from this kit into it:
   ```
   mkdir campus-social && cd campus-social
   # copy CLAUDE.md, docs/, and supabase/ from this kit into here
   git init
   ```

3. Start Claude Code in that folder:
   ```
   claude
   ```
   It reads `CLAUDE.md` automatically on startup — you don't need to paste
   anything or re-explain the project.

4. Your first message can be as simple as:
   > "Read CLAUDE.md and docs/MILESTONES.md. We're starting Milestone 2:
   > Project Setup. Walk me through it the way the docs describe — one step
   > at a time, wait for my approval before moving on."

## What's in here

- `CLAUDE.md` — the fast-reference brief, read every session
- `docs/PRODUCT_SPEC.md` — the full product spec (every screen, every table,
  every SOP)
- `docs/ARCHITECTURE.md` — every locked technical decision and why
- `docs/MILESTONES.md` — the 21-milestone build plan and current status
- `supabase/migrations/0001_init.sql` — the full schema, RLS, and storage
  policies, ready to run once a Supabase project exists (that's Milestone 3)

## Before Milestone 2 really gets moving, start these in parallel — they have real lead time

- DLT SMS registration with MSG91 (1-2 weeks)
- Razorpay business KYC
- Apple Developer Program enrollment
- Google Play Console account
- Resend account + domain verification

None of these block writing code today. They just shouldn't be started the
week you actually need them working.
