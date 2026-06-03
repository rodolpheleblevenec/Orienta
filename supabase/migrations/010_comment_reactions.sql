-- ════════════════════════════════════════════════════════════════
-- 010 — Réactions emoji sur les messages (page Results)
-- ----------------------------------------------------------------
-- Un "message" = un orienta_plays avec comment non-null. Les
-- réactions référencent donc le play porteur du commentaire.
-- Cohérence avec le reste de la base : pas de RLS, IDs en
-- gen_random_uuid(), tables préfixées orienta_.
-- ════════════════════════════════════════════════════════════════

-- ── Table des réactions (1 par joueur / message / emoji) ───────
CREATE TABLE IF NOT EXISTS orienta_comment_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id    uuid NOT NULL REFERENCES orienta_plays(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES orienta_users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (play_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_play ON orienta_comment_reactions(play_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON orienta_comment_reactions(user_id);

-- NB: RLS volontairement non activé (cohérence avec les autres
--     tables orienta_, accès via clé anon).
