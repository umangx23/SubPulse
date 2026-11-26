-- SubPulse Normalized Supabase Schema (Email Auth + 4 Per-User Tables + Non-Recursive RLS)
-- Safe and idempotent to run on BOTH brand-new projects and databases upgrading from the legacy schema.
-- Run in Supabase Dashboard -> SQL Editor.

-- 0. Safely clean up legacy recursive workspace policies if those tables exist
do $$
begin
  drop policy if exists "Workspace access for members" on public.workspaces;
  drop policy if exists "Owner manages workspace" on public.workspaces;
exception when undefined_table then null;
end $$;

do $$
begin
  drop policy if exists "Members read workspace members" on public.workspace_members;
  drop policy if exists "Owner manages workspace members" on public.workspace_members;
exception when undefined_table then null;
end $$;

do $$
begin
  drop policy if exists "Read workspace subscriptions" on public.subscriptions;
  drop policy if exists "Edit workspace subscriptions" on public.subscriptions;
exception when undefined_table then null;
end $$;

-- 1. USER SETTINGS (1 row per authenticated Supabase user)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default 'User',
  initials text not null default 'SP',
  workspace_name text not null default 'Personal',
  currency text not null default 'USD' check (currency in ('USD', 'INR', 'EUR', 'GBP', 'CAD')),
  country text not null default 'United States',
  timezone text not null default 'UTC',
  theme text not null default 'dark' check (theme in ('light', 'dark', 'system')),
  monthly_budget_cap numeric(12, 2) not null default 250.00,
  annual_trim_goal numeric(12, 2) not null default 500.00,
  saved_ytd numeric(12, 2) not null default 0.00,
  cancelled_count_ytd integer not null default 0,
  category_caps jsonb not null default '{
    "Productivity & AI": 75,
    "Entertainment": 80,
    "Cloud & Utilities": 95,
    "Fitness": 50
  }'::jsonb,
  web_push_enabled boolean not null default false,
  email_fallback_enabled boolean not null default true,
  quiet_hours_start text not null default '22:00',
  quiet_hours_end text not null default '08:00',
  has_completed_onboarding boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. SUBSCRIPTIONS (Composite PK (user_id, id) prevents cross-user ID collisions)
create table if not exists public.subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  initials text not null default 'SP',
  avatar_bg text not null default 'bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary',
  category text not null check (category in ('Productivity & AI', 'Entertainment', 'Cloud & Utilities', 'Fitness')),
  price numeric(12, 2) not null default 0 check (price >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'INR', 'EUR', 'GBP', 'CAD')),
  cycle text not null default 'monthly' check (cycle in ('weekly', 'monthly', 'quarterly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'trial', 'paused', 'cancelled')),
  next_billing_date text not null,
  reminder_days smallint not null default 3 check (reminder_days in (1, 3, 7)),
  started_on text not null,
  payment_method text not null default '',
  is_shared boolean not null default false,
  split_count integer not null default 1 check (split_count >= 1),
  shared_members jsonb not null default '[]'::jsonb,
  manage_url text not null default '',
  notes text not null default '',
  price_change_delta numeric(12, 2),
  trial_ends_soon boolean not null default false,
  value_rating text not null default 'unrated' check (value_rating in ('worth', 'low', 'unrated')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Safe upgrade if public.subscriptions already existed from the legacy workspace schema
alter table public.subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'created_by'
  ) then
    execute 'update public.subscriptions set user_id = created_by where user_id is null';
    execute 'alter table public.subscriptions alter column created_by drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'workspace_id'
  ) then
    execute 'alter table public.subscriptions alter column workspace_id drop not null';
  end if;
end $$;

create unique index if not exists idx_subscriptions_user_id_unique
  on public.subscriptions (user_id, id);

-- 3. HOUSEHOLD MEMBERS (Per-user household split ledger)
create table if not exists public.household_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  initials text not null default 'HM',
  avatar_color text not null default 'bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary',
  role text not null default 'Editor' check (role in ('Owner', 'Editor', 'Viewer')),
  email text not null default '',
  settled_this_month boolean not null default false,
  custom_owes numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 4. ALERTS (Per-user in-app reminders & renewal notices)
create table if not exists public.alerts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  subscription_id text,
  title text not null,
  description text not null default '',
  timestamp_label text not null default 'Just now',
  type text not null default 'system' check (type in ('trial', 'price_hike', 'digest', 'system')),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Safe upgrade if public.alerts already existed from the legacy schema
alter table public.alerts
  add column if not exists timestamp_label text not null default 'Just now';
alter table public.alerts
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_alerts_user_id_unique
  on public.alerts (user_id, id);

-- Indexes for fast per-user reads
create index if not exists idx_subscriptions_user_active
  on public.subscriptions (user_id, updated_at desc)
  where archived_at is null;

create index if not exists idx_household_members_user
  on public.household_members (user_id, created_at asc);

create index if not exists idx_alerts_user
  on public.alerts (user_id, created_at desc);

-- Automatic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_household_members_updated_at on public.household_members;
create trigger trg_household_members_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_alerts_updated_at on public.alerts;
create trigger trg_alerts_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

-- Strict Non-Recursive Row Level Security (auth.uid() = user_id)
alter table public.user_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.household_members enable row level security;
alter table public.alerts enable row level security;

drop policy if exists "Users manage own user_settings" on public.user_settings;
create policy "Users manage own user_settings" on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own subscriptions" on public.subscriptions;
create policy "Users manage own subscriptions" on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own household_members" on public.household_members;
create policy "Users manage own household_members" on public.household_members
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own alerts" on public.alerts;
create policy "Users manage own alerts" on public.alerts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Ensure Supabase API roles can access the tables (protected by RLS above)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.alerts to authenticated;

-- Auto-create default user_settings row when a new email user registers
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  user_label text;
begin
  user_label := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'User');

  insert into public.user_settings (user_id, email, full_name, initials)
  values (new.id, coalesce(new.email, ''), user_label, upper(left(user_label, 2)))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Supabase Realtime on the 4 normalized tables (idempotent)
do $$
begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.subscriptions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.household_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.alerts;
exception when duplicate_object then null;
end $$;

-- Immediately refresh PostgREST schema cache so API requests recognize new tables
notify pgrst, 'reload schema';
