-- 005 : suppression réversible des transactions (soft delete).
-- Idempotent : peut être rejoué sans erreur.

-- Une suppression ne détruit plus la ligne : elle est marquée, ce qui permet
-- l'annulation (« Annuler ») et laisse une trace. Les lectures filtrent
-- `deleted_at is null`.
alter table public.transactions add column if not exists deleted_at timestamptz;

-- Index partiel : les requêtes courantes ne lisent que les lignes vivantes.
create index if not exists transactions_user_live_idx
  on public.transactions (user_id, occurred_on desc, created_at desc)
  where deleted_at is null;

-- Les opérations "delete_transaction" déjà présentes dans une file hors ligne
-- utilisent désormais cette même sémantique douce : aucun rejeu à adapter.
