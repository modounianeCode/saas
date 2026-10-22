-- 002 : objectifs d'épargne.
-- Idempotent : peut être rejoué sans erreur.

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  target_amount bigint not null check (target_amount > 0),
  current_amount bigint not null default 0 check (current_amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

drop policy if exists "Own savings goals only" on public.savings_goals;
create policy "Own savings goals only" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
