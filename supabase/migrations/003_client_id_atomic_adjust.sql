-- 003 : idempotence + atomicité des opérations hors ligne.
-- Idempotent : peut être rejoué sans erreur, y compris sur une base où la
-- migration avait été partiellement appliquée.

-- 1. Clé d'idempotence générée côté client (remplace les ids `local-*` qui
--    n'existaient pas côté serveur lors du rejeu de l'outbox).
--    Ajout en plusieurs étapes : la colonne peut déjà exister avec ou sans
--    contrainte, et des lignes anciennes n'ont pas de valeur.
alter table public.transactions add column if not exists client_id uuid;
update public.transactions set client_id = gen_random_uuid() where client_id is null;
alter table public.transactions alter column client_id set default gen_random_uuid();
alter table public.transactions alter column client_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_client_id_key'
  ) then
    alter table public.transactions
      add constraint transactions_client_id_key unique (client_id);
  end if;
end
$$;

alter table public.savings_goals add column if not exists client_id uuid;
update public.savings_goals set client_id = gen_random_uuid() where client_id is null;
alter table public.savings_goals alter column client_id set default gen_random_uuid();
alter table public.savings_goals alter column client_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.savings_goals'::regclass
      and conname = 'savings_goals_client_id_key'
  ) then
    alter table public.savings_goals
      add constraint savings_goals_client_id_key unique (client_id);
  end if;
end
$$;

-- 2. Journal des opérations déjà appliquées (anti-double-rejeu).
--    Pas de policy RLS : réservée à la fonction security definer.
create table if not exists public.applied_ops (
  op_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  applied_at timestamptz not null default now()
);

alter table public.applied_ops enable row level security;

-- 3. Dépôt/retrait atomique et idempotent.
--    - atomique : `current_amount = current_amount + delta` en une seule
--      requête SQL (pas de lecture-addition-écriture côté client) ;
--    - idempotent : si l'op_id a déjà été appliqué, on ne réapplique pas
--      le delta (double rejeu inoffensif).
--    security invoker n'est pas possible (écriture dans applied_ops) :
--    security definer + `user_id = auth.uid()` partout = RLS respectée.
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
    -- Opération déjà appliquée : on renvoie l'état courant sans réappliquer.
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

  -- v_new = null si l'objectif est introuvable (ex. supprimé depuis un
  -- autre appareil) : l'opération est alors sans effet et peut être purgée.
  return v_new;
end;
$$;

revoke execute on function public.adjust_goal(uuid, bigint, uuid) from public, anon;
grant execute on function public.adjust_goal(uuid, bigint, uuid) to authenticated;
