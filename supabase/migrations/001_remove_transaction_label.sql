-- À exécuter uniquement si la table transactions contient déjà la colonne label.
-- (Pour les installations neuves, supabase/schema.sql est déjà à jour.)
alter table public.transactions drop column label;