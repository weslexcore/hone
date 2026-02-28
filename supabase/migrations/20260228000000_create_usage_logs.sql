-- Usage logs table for tracking shared API key consumption per user.

create table usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  provider text not null,
  model text not null,
  created_at timestamptz default now() not null
);

-- Index for fast daily/monthly limit checks
create index idx_usage_logs_user_daily
  on usage_logs (user_id, created_at desc);

-- Row Level Security
alter table usage_logs enable row level security;

create policy "Users read own usage"
  on usage_logs for select
  using (auth.uid() = user_id);

create policy "Users insert own usage"
  on usage_logs for insert
  with check (auth.uid() = user_id);

-- Helper function: returns daily + monthly request counts for a user
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
