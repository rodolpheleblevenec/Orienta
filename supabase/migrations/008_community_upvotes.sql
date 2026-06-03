-- ════════════════════════════════════════════════════════════════
-- 008 — Upvotes communautaires + notifications
-- ----------------------------------------------------------------
-- NOTE: la base live ("Rental Supervision") utilise des tables
-- préfixées `orienta_`, avec RLS DÉSACTIVÉ partout (accès via clé
-- anon, sans Supabase Auth). On reste cohérent : pas de RLS ici.
-- IDs en gen_random_uuid() comme le reste de la base.
-- ════════════════════════════════════════════════════════════════

-- ── Table des upvotes (1 par joueur / grille) ──────────────────
CREATE TABLE IF NOT EXISTS orienta_grid_upvotes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id    uuid NOT NULL REFERENCES orienta_grids(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES orienta_users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (grid_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_grid_upvotes_grid ON orienta_grid_upvotes(grid_id);
CREATE INDEX IF NOT EXISTS idx_grid_upvotes_user ON orienta_grid_upvotes(user_id);

-- ── Compteur dénormalisé sur les grilles (tri "meilleures") ────
ALTER TABLE orienta_grids ADD COLUMN IF NOT EXISTS upvotes_count int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_grids_upvotes_count ON orienta_grids(upvotes_count DESC);

-- Backfill au cas où des upvotes existeraient déjà
UPDATE orienta_grids g
SET upvotes_count = sub.c
FROM (SELECT grid_id, count(*) AS c FROM orienta_grid_upvotes GROUP BY grid_id) sub
WHERE sub.grid_id = g.id;

-- ── Trigger AFTER INSERT : +1 compteur + notification au créateur ──
CREATE OR REPLACE FUNCTION fn_grid_upvote_inserted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_pseudo     text;
BEGIN
  -- incrémente le compteur
  UPDATE orienta_grids
  SET upvotes_count = upvotes_count + 1
  WHERE id = NEW.grid_id
  RETURNING creator_id INTO v_creator_id;

  -- notifie le créateur (sauf auto-upvote — déjà bloqué côté UI)
  IF v_creator_id IS NOT NULL AND v_creator_id <> NEW.user_id THEN
    SELECT pseudo INTO v_pseudo FROM orienta_users WHERE id = NEW.user_id;
    INSERT INTO orienta_notifications (user_id, type, payload)
    VALUES (
      v_creator_id,
      'upvote',
      jsonb_build_object('player_pseudo', v_pseudo, 'grid_id', NEW.grid_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grid_upvote_inserted ON orienta_grid_upvotes;
CREATE TRIGGER trg_grid_upvote_inserted
  AFTER INSERT ON orienta_grid_upvotes
  FOR EACH ROW EXECUTE FUNCTION fn_grid_upvote_inserted();

-- ── Trigger AFTER DELETE : -1 compteur (pas de notif retirée) ──
CREATE OR REPLACE FUNCTION fn_grid_upvote_deleted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE orienta_grids
  SET upvotes_count = GREATEST(upvotes_count - 1, 0)
  WHERE id = OLD.grid_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_grid_upvote_deleted ON orienta_grid_upvotes;
CREATE TRIGGER trg_grid_upvote_deleted
  AFTER DELETE ON orienta_grid_upvotes
  FOR EACH ROW EXECUTE FUNCTION fn_grid_upvote_deleted();

-- NB: RLS volontairement non activé (cohérence avec les autres
--     tables orienta_, accès via clé anon).
