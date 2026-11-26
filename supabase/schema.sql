-- SubPulse Supabase Schema (PostgreSQL + RLS + Auto-Setup Trigger)
-- Run this in your Supabase Dashboard -> SQL Editor

-- 1. PROFILES (extends Supabase auth.users)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default 'User',
  initials text not null default 'SP',
  avatar_url text,
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
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '08:00',
  passkey_lock_enabled boolean not null default false,
  has_completed_onboarding boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- 2. DEVICES / SESSIONS (cross-device presence & Web Push)
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  platform text not null default 'web',
  push_subscription jsonb,
  is_revoked boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_name)
);

-- 3. WORKSPACES (Personal or Household)
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Personal',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. WORKSPACE MEMBERS (Household collaboration & split settlement)
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  initials text not null,
  avatar_color text not null default 'bg-light-primary-container text-light-on-primary',
  email text not null,
  role text not null default 'Editor' check (role in ('Owner', 'Editor', 'Viewer')),
  settled_this_month boolean not null default false,
  custom_owes numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- 5. SUBSCRIPTIONS (Core recurring plans)
create table if not exists public.subscriptions (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  initials text not null,
  avatar_bg text not null,
  category text not null check (category in ('Productivity & AI', 'Entertainment', 'Cloud & Utilities', 'Fitness')),
  price numeric(12, 2) not null check (price >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'INR', 'EUR', 'GBP', 'CAD')),
  cycle text not null default 'monthly' check (cycle in ('weekly', 'monthly', 'quarterly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'trial', 'paused', 'cancelled')),
  next_billing_date date not null,
  reminder_days smallint not null default 3 check (reminder_days in (1, 3, 7)),
  started_on date not null default current_date,
  cancelled_on date,
  payment_method text not null default '',
  is_shared boolean not null default false,
  split_count integer not null default 1 check (split_count >= 1),
  shared_members jsonb not null default '[]'::jsonb,
  manage_url text not null default '',
  notes text not null default '',
  price_change_delta numeric(12, 2),
  trial_ends_soon boolean not null default false,
  value_rating text default 'unrated' check (value_rating in ('worth', 'low', 'unrated')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. ALERTS (In-app notification feed)
create table if not exists public.alerts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id text references public.subscriptions(id) on delete set null,
  title text not null,
  description text not null,
  type text not null check (type in ('trial', 'price_hike', 'digest', 'system')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_workspace on public.subscriptions(workspace_id, updated_at);
create index if not exists idx_devices_user on public.devices(user_id, last_active_at desc);
create index if not exists idx_alerts_user_unread on public.alerts(user_id, read, created_at desc);

-- Row-Level Security
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.alerts enable row level security;

create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own devices" on public.devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own alerts" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Workspace access for members" on public.workspaces
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
    )
  );
create policy "Owner manages workspace" on public.workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Members read workspace members" on public.workspace_members
  for select using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );
create policy "Owner manages workspace members" on public.workspace_members
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "Read workspace subscriptions" on public.subscriptions
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = subscriptions.workspace_id and wm.user_id = auth.uid()
    )
  );
create policy "Edit workspace subscriptions" on public.subscriptions
  for all using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = subscriptions.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('Owner', 'Editor')
    )
  );

-- Auto-create profile + Personal workspace when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_ws_id uuid;
  user_label text;
begin
  user_label := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User');

  insert into public.profiles (user_id, email, full_name, initials)
  values (new.id, new.email, user_label, upper(left(user_label, 2)));

  insert into public.workspaces (name, owner_id)
  values ('Personal', new.id)
  returning id into new_ws_id;

  insert into public.workspace_members (workspace_id, user_id, display_name, initials, email, role, settled_this_month)
  values (new_ws_id, new.id, user_label, upper(left(user_label, 2)), new.email, 'Owner', true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

