-- Flag d'onboarding : le joueur a vu le bandeau de révélation de la section communautaire
-- (affiché une seule fois, après sa première grille terminée).
ALTER TABLE orienta_users
  ADD COLUMN IF NOT EXISTS community_unlocked_seen boolean DEFAULT false;

-- Backfill : les vétérans ayant déjà terminé au moins une grille ne verront pas le bandeau.
UPDATE orienta_users u
SET community_unlocked_seen = true
WHERE EXISTS (
  SELECT 1 FROM orienta_plays p
  WHERE p.player_id = u.id AND p.completed_at IS NOT NULL
);
