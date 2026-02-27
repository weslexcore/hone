-- ============================================================
-- Hone — Supabase setup for shared API key usage tracking
-- Run this in the Supabase SQL editor after creating your project.
-- ============================================================

-- 1. Usage logs table
create table if not exists usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  provider text not null,
  model text not null,
  created_at timestamptz default now() not null
);

-- Indexes for fast limit checks
create index if not exists idx_usage_logs_user_daily
  on usage_logs (user_id, created_at desc);

-- 2. Row Level Security
alter table usage_logs enable row level security;

-- Users can read their own usage
create policy "Users read own usage"
  on usage_logs for select
  using (auth.uid() = user_id);

-- Authenticated users can insert their own usage
create policy "Users insert own usage"
  on usage_logs for insert
  with check (auth.uid() = user_id);

-- 3. Helper function for checking daily + monthly counts
create or replace function get_usage_counts(p_user_id uuid)
returns table(daily_count bigint, monthly_count bigint)
language sql stable
as $$
  select
    count(*) filter (where created_at > now() - interval '1 day') as daily_count,
    count(*) filter (where created_at > date_trunc('month', now())) as monthly_count
  from usage_logs
  where user_id = p_user_id;
$$;
