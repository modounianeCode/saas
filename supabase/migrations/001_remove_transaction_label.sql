-- 001 : suppression de l'ancienne colonne "label" sur les transactions.
-- Idempotent : ne fait rien si la colonne n'existe pas (installation neuve ou
-- migration déjà appliquée).
alter table public.transactions drop column if exists label;
