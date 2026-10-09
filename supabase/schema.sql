-- Exécutez ce script dans l'éditeur SQL de votre projet Supabase.
create type public.transaction_type as enum ('income', 'expense');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  opening_balance bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default gen_random_uuid() unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  amount bigint not null check (amount > 0),
  category text not null,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

create policy "Own profile only" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Own transactions only" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default gen_random_uuid() unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  target_amount bigint not null check (target_amount > 0),
  current_amount bigint not null default 0 check (current_amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

create policy "Own savings goals only" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

-- Journal des opérations hors ligne déjà appliquées (anti-double-rejeu).
create table public.applied_ops (
  op_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  applied_at timestamptz not null default now()
);
alter table public.applied_ops enable row level security;

-- Dépôt/retrait atomique et idempotent (voir migrations/003).
create or replace function public.adjust_goal(p_client_id uuid, p_delta bigint, p_op_id uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_new bigint;
  v_inserted bigint;
begin
  if v_user is null then
    raise exception 'Non authentifié';
  end if;

  with ins as (
    insert into public.applied_ops (op_id, user_id) values (p_op_id, v_user)
    on conflict (op_id) do nothing
    returning op_id
  )
  select count(*) into v_inserted from ins;

  if v_inserted = 0 then
    select current_amount into v_new
      from public.savings_goals
     where client_id = p_client_id and user_id = v_user;
    return v_new;
  end if;

  update public.savings_goals
     set current_amount = current_amount + p_delta
   where client_id = p_client_id
     and user_id = v_user
     and current_amount + p_delta >= 0
  returning current_amount into v_new;

  return v_new;
end;
$$;

revoke execute on function public.adjust_goal(uuid, bigint, uuid) from public, anon;
grant execute on function public.adjust_goal(uuid, bigint, uuid) to authenticated;
