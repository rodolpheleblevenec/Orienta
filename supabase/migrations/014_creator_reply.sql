-- ════════════════════════════════════════════════════════════════
-- 014 — Réponse du créateur à un commentaire
-- ----------------------------------------------------------------
-- Un "commentaire" = un orienta_plays avec comment non-null. Le
-- créateur de la grille peut y répondre une fois (réponse éditable),
-- stockée directement sur le play porteur du commentaire.
-- Cohérence avec le reste de la base : pas de RLS, écriture via
-- l'Edge Function `social` (action `reply`) qui vérifie le créateur.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE orienta_plays
  ADD COLUMN IF NOT EXISTS creator_reply    text,
  ADD COLUMN IF NOT EXISTS creator_reply_at timestamptz;
