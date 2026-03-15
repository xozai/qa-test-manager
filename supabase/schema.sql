-- ================================================================
-- QA Test Case Manager — Supabase Schema
-- Run this in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste & run
-- ================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Drop existing (for clean re-runs) ────────────────────────────────────────
drop table if exists run_results  cascade;
drop table if exists test_runs    cascade;
drop table if exists test_cases   cascade;
drop table if exists test_suites  cascade;
drop table if exists users        cascade;
drop function if exists update_updated_at cascade;

-- ── Users (QA team members — separate from Supabase Auth accounts) ───────────
create table users (
  id    uuid    primary key default gen_random_uuid(),
  name  text    not null,
  email text    not null unique,
  roles text[]  not null default '{}'
);

-- ── Test Suites ───────────────────────────────────────────────────────────────
create table test_suites (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text        not null default '',
  owner_id    uuid        references users(id) on delete set null,
  jira_number text        not null default '',
  is_hidden   boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- ── Test Cases ────────────────────────────────────────────────────────────────
create table test_cases (
  id             uuid        primary key default gen_random_uuid(),
  test_case_id   text        not null unique,   -- e.g. TC-001
  title          text        not null,
  description    text        not null default '',
  preconditions  text        not null default '',
  test_data      text        not null default '',
  steps          jsonb       not null default '[]',
  qa_status      text        not null default 'Not Run',
  uat_status     text        not null default 'Not Run',
  bat_status     text        not null default 'Not Run',
  priority       text        not null default 'Med',
  test_suite_id  uuid        references test_suites(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger test_cases_updated_at
  before update on test_cases
  for each row execute function update_updated_at();

-- ── Test Runs ─────────────────────────────────────────────────────────────────
create table test_runs (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  suite_ids    uuid[]      not null default '{}',
  executor_id  uuid        references users(id) on delete set null,
  tester_role  text        not null,
  created_at   timestamptz not null default now()
);

-- ── Run Results (one row per test case per run) ───────────────────────────────
create table run_results (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references test_runs(id) on delete cascade,
  test_case_id text not null,
  status       text not null default 'Not Run',
  notes        text not null default ''
);

-- ── Disable RLS (internal tool — enable + add policies for per-user isolation) ─
alter table users        disable row level security;
alter table test_suites  disable row level security;
alter table test_cases   disable row level security;
alter table test_runs    disable row level security;
alter table run_results  disable row level security;

-- ── Enable Realtime ───────────────────────────────────────────────────────────
-- Also enable via Dashboard → Database → Replication → enable for each table
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table test_suites;
alter publication supabase_realtime add table test_cases;
alter publication supabase_realtime add table test_runs;
alter publication supabase_realtime add table run_results;

-- ── Seed Data ─────────────────────────────────────────────────────────────────
insert into users (id, name, email, roles) values
  ('00000000-0000-0000-0001-000000000001', 'Alice Chen',    'alice.chen@company.com',    '{BSA,QA}'),
  ('00000000-0000-0000-0001-000000000002', 'Bob Martinez',  'bob.martinez@company.com',  '{Dev}'),
  ('00000000-0000-0000-0001-000000000003', 'Carol Johnson', 'carol.johnson@company.com', '{QA,UAT,BAT}');

insert into test_suites (id, name, description, owner_id, jira_number, is_hidden) values
  ('00000000-0000-0000-0002-000000000001', 'Auth',    'Authentication and authorization flows', '00000000-0000-0000-0001-000000000001', 'PROJ-101', false),
  ('00000000-0000-0000-0002-000000000002', 'Cart',    'Shopping cart and checkout flows',       '00000000-0000-0000-0001-000000000002', 'PROJ-102', false),
  ('00000000-0000-0000-0002-000000000003', 'Profile', 'User profile management',               '00000000-0000-0000-0001-000000000003', 'PROJ-103', false);

insert into test_cases
  (test_case_id, title, description, preconditions, test_data, steps, qa_status, uat_status, bat_status, priority, test_suite_id)
values
  ('TC-001', 'Successful Login', 'Verify user can log in with valid credentials',
   'User account exists', 'Email: test@company.com | Password: ValidPass123',
   '[{"id":"s1","action":"Navigate to login page","expectedResult":"Login form is displayed"},{"id":"s2","action":"Enter credentials and submit","expectedResult":"User is redirected to dashboard"}]',
   'Pass', 'Not Run', 'Not Run', 'High', '00000000-0000-0000-0002-000000000001'),

  ('TC-002', 'Login Fails with Invalid Password', 'Verify login is rejected for wrong password',
   'User account exists', 'Email: test@company.com | Password: WrongPass',
   '[{"id":"s1","action":"Enter valid email and invalid password","expectedResult":"Error message displayed"}]',
   'Pass', 'Not Run', 'Not Run', 'High', '00000000-0000-0000-0002-000000000001'),

  ('TC-003', 'Add Item to Cart', 'Verify user can add a product to cart',
   'User is logged in', 'Product ID: P-001',
   '[{"id":"s1","action":"Open product detail page","expectedResult":"Product details displayed"},{"id":"s2","action":"Click Add to Cart","expectedResult":"Cart icon shows updated count"}]',
   'Pass', 'Fail', 'Not Run', 'High', '00000000-0000-0000-0002-000000000002'),

  ('TC-004', 'Edit Profile Name', 'Verify user can update display name',
   'User is logged in', 'New Name: John Doe',
   '[{"id":"s1","action":"Navigate to profile settings","expectedResult":"Settings page displayed"},{"id":"s2","action":"Change name and save","expectedResult":"Success message shown"}]',
   'Pass', 'Pass', 'Not Run', 'Med', '00000000-0000-0000-0002-000000000003'),

  ('TC-005', 'Upload Profile Avatar', 'Verify user can upload avatar image',
   'User logged in, valid image available', 'File: avatar.jpg',
   '[{"id":"s1","action":"Open profile settings","expectedResult":"Profile page displayed"},{"id":"s2","action":"Select image and confirm upload","expectedResult":"Avatar updated"}]',
   'Blocked', 'Not Run', 'Not Run', 'Low', '00000000-0000-0000-0002-000000000003');
