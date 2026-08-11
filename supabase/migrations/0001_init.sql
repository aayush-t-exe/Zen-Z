-- ============================================
-- 0001_init.sql
-- Full schema from docs/PRODUCT_SPEC.md, updated per
-- docs/ARCHITECTURE.md for dual auth (phone OR email, neither required
-- to be both). This is the first migration for a brand-new Supabase
-- project — run in order, do not hand-edit tables in the dashboard
-- after this.
-- ============================================

-- ============================================
-- PROFILES (dual auth: phone OR email, never both required)
-- ============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text not null,
  gender text check (gender in ('male','female','other','prefer_not_to_say')),
  year_of_study smallint,
  photo_url text, -- founder-only visibility, enforced below
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_identity_check check (email is not null or phone is not null)
);

-- Auto-create a profiles row regardless of which auth method was used,
-- so every other table can reference profiles.id uniformly.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', 'New user')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- MODULAR PERSONALITY FRAMEWORK
-- ============================================
create table personality_dimensions (
  id serial primary key,
  key text unique not null,
  label text not null,
  created_at timestamptz default now()
);

create table personality_questions (
  id serial primary key,
  prompt text not null,
  question_type text not null
    check (question_type in ('single_select','multi_select','scale')),
  display_order int not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table personality_question_options (
  id serial primary key,
  question_id int references personality_questions(id) on delete cascade,
  label text not null,
  display_order int not null
);

create table personality_option_weights (
  option_id int references personality_question_options(id) on delete cascade,
  dimension_id int references personality_dimensions(id) on delete cascade,
  weight numeric not null,
  primary key (option_id, dimension_id)
);

create table personality_scale_mappings (
  question_id int references personality_questions(id) on delete cascade,
  dimension_id int references personality_dimensions(id) on delete cascade,
  multiplier numeric not null default 1,
  primary key (question_id, dimension_id)
);

create table personality_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  question_id int references personality_questions(id),
  selected_option_ids int[],
  scale_value numeric,
  created_at timestamptz default now(),
  unique (user_id, question_id)
);

create table personality_scores (
  user_id uuid references profiles(id) on delete cascade,
  dimension_id int references personality_dimensions(id) on delete cascade,
  score numeric not null,
  updated_at timestamptz default now(),
  primary key (user_id, dimension_id)
);

-- ============================================
-- ACTIVITIES & SLOTS (all three live from day 1 — is_live default true)
-- ============================================
create table activity_types (
  id serial primary key,
  name text not null,
  emoji text,
  is_live boolean default true,
  min_group_size int default 4,
  max_group_size int default 5
);

create table slots (
  id uuid primary key default gen_random_uuid(),
  activity_type_id int references activity_types(id),
  slot_datetime timestamptz not null,
  status text default 'open' check (status in ('open','matching','closed')),
  reveal_venue_at timestamptz
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
);

-- ============================================
-- VENUES / GROUPS / MESSAGES / FEEDBACK / REPORTS / NO-SHOWS / REFERRALS
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
  venue_id uuid references venues(id),
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

-- Admin allow-list — no public admin signup path
create table admin_users (
  id uuid primary key references auth.users(id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
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

create policy "self read profile" on profiles
  for select using (auth.uid() = id);
create policy "self update profile" on profiles
  for update using (auth.uid() = id);
create policy "admin read all profiles" on profiles
  for select using (auth.uid() in (select id from admin_users));

-- Groupmate-visible info excludes photo_url entirely — the mobile app
-- queries ONLY this view for match-reveal/group-chat member info.
create view group_member_public as
  select id, full_name, year_of_study
  from profiles;
alter view group_member_public set (security_invoker = true);

create policy "members read groupmate public info" on profiles
  for select using (
    exists (
      select 1 from group_members gm1
      join group_members gm2 on gm1.group_id = gm2.group_id
      join bookings b1 on b1.id = gm1.booking_id
      join bookings b2 on b2.id = gm2.booking_id
      where b1.user_id = auth.uid() and b2.user_id = profiles.id
    )
  );

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

create policy "own bookings" on bookings
  for select using (auth.uid() = user_id);
create policy "own bookings insert" on bookings
  for insert with check (auth.uid() = user_id);
create policy "admin manage all bookings" on bookings
  for all using (auth.uid() in (select id from admin_users));

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
    exists (select 1 from bookings b where b.id = group_members.booking_id and b.user_id = auth.uid())
    or exists (
      select 1 from group_members gm2 join bookings b2 on b2.id = gm2.booking_id
      where gm2.group_id = group_members.group_id and b2.user_id = auth.uid()
    )
  );

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

-- ============================================
-- STORAGE — private photo bucket, founder-only read access to others' photos
-- ============================================
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

-- ============================================
-- SEED: the three activity types, live from day 1
-- ============================================
insert into activity_types (name, emoji, is_live) values
  ('Cafes', '☕', true),
  ('Dinners', '🍽', true),
  ('Movies', '🎬', true);
