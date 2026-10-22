-- 004 : index de performance + garde-fou sur le solde initial.
-- Idempotent : peut être rejoué sans erreur.
-- Dépend de la 003 pour `applied_ops` (l'index est créé seulement si la table
-- existe, pour rester exécutable seul).

-- 1. Index de lecture : chaque requête filtre par user_id et trie par date.
create index if not exists transactions_user_occurred_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);

create index if not exists savings_goals_user_created_idx
  on public.savings_goals (user_id, created_at);

do $$
begin
  if to_regclass('public.applied_ops') is not null then
    execute 'create index if not exists applied_ops_user_idx on public.applied_ops (user_id)';
  end if;
end
$$;

-- 2. Le solde initial suit la même règle que les montants des transactions.
--    `not valid` évite de bloquer la migration si un historique contient des
--    valeurs négatives : les nouvelles écritures sont vérifiées immédiatement.
--    Une fois les données historiques propres, exécutez :
--      alter table public.profiles validate constraint profiles_opening_balance_check;
alter table public.profiles drop constraint if exists profiles_opening_balance_check;
alter table public.profiles
  add constraint profiles_opening_balance_check check (opening_balance >= 0) not valid;
