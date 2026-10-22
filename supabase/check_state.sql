-- Diagnostic (lecture seule) : état des migrations appliquées.
-- Collez ce script dans l'éditeur SQL de Supabase pour savoir quoi exécuter.
-- À exécuter dans son propre onglet ; il ne modifie rien.

-- 1. Tables présentes
select tablename
from pg_tables
where schemaname = 'public'
order by 1;

-- 2. Colonnes clés (client_id doit exister sur transactions ET savings_goals ;
--    deleted_at sur transactions = migration 005 appliquée)
select c.relname as table_name,
       a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as not_null
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'transactions', 'savings_goals', 'applied_ops')
  and a.attname in ('client_id', 'opening_balance', 'deleted_at')
  and a.attnum > 0
order by 1, 2;

-- 3. Contraintes attendues
select c.relname as table_name, con.conname, con.contype as type
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (con.conname like '%client_id%' or con.conname = 'profiles_opening_balance_check')
order by 1, 2;

-- 4. Fonctions attendues
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('adjust_goal', 'create_profile_for_new_user')
order by 1;
