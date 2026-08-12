# Campus Social Admin Dashboard

Founder dashboard for managing group matching and student bookings.

## Features

- **Dashboard Home**: View metrics on bookings, groups formed, and pending moderation
- **Matching Queue**: View unmatched students for each activity/slot
- **Student Profiles**: View personality profiles and quiz responses
- **Authentication**: Email OTP login (admin-only access via `admin_users` table)

## Setup

### Environment Variables

Copy `.env.local.example` to `.env.local` and add your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the App

From the root directory:

```bash
npm run admin
```

The app will start on `http://localhost:3000`.

## Admin Access

Only users in the `admin_users` table can access the dashboard. To add a founder:

1. They sign up via `/login` with email OTP
2. Manually insert their user ID into `admin_users`:

```sql
insert into admin_users (id) values ('their-user-uuid');
```

## Next Phase: Matching Board

The drag-and-drop matching board (Milestone 13) will include:
- Drag students into groups
- Set group size (4–5)
- View compatibility scores
- Assign venues
- Confirm groups

## Architecture

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **Database**: Supabase (Postgres)
- **Photo Access**: Founder can see student photos (RLS enforced)
- **Auth**: Supabase Auth (email OTP)
