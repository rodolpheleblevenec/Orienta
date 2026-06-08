-- 019 — Pause du chrono pendant l'absence du joueur
-- Quand le joueur quitte la grille (onglet en arrière-plan, retour au hub…), le
-- chrono ne doit pas continuer à tourner mais se mettre en pause.
--
-- Le temps de jeu reste calculé côté serveur (anti-triche) à partir de started_at,
-- mais on en soustrait désormais le temps passé en pause :
--   temps effectif = (now - started_at) - paused_seconds - (paused_at ? now - paused_at : 0)
--
--   • paused_at      : instant serveur où la partie est mise en pause (NULL = active)
--   • paused_seconds : total déjà cumulé en pause (hors pause en cours)
--
-- Seul le serveur horodate les transitions (Edge Function pause-play / start-play) :
-- le client ne fournit jamais de durée.

ALTER TABLE orienta_plays
  ADD COLUMN IF NOT EXISTS paused_at      timestamptz,
  ADD COLUMN IF NOT EXISTS paused_seconds integer NOT NULL DEFAULT 0;
