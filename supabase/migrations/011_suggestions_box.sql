-- ════════════════════════════════════════════════════════════════
-- 011 — Boîte à idées (suggestions joueurs → admin)
-- ----------------------------------------------------------------
-- Les joueurs envoient des idées depuis /profil. Elles remontent
-- dans l'onglet "Boîte à idées" de l'admin. Cohérent avec le reste
-- de la base : pas de RLS, IDs en gen_random_uuid().
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orienta_suggestions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES orienta_users(id) ON DELETE CASCADE,
  pseudo     text NOT NULL,                     -- copié à l'envoi (affichage admin sans jointure)
  content    text NOT NULL,
  status     text NOT NULL DEFAULT 'nouveau',   -- nouveau / vu / traite / rejete
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_created ON orienta_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON orienta_suggestions(status);

-- ── Trigger AFTER INSERT : notifie l'admin (cloche 🔔) ─────────────
-- (sauf si l'auteur est l'admin lui-même)
CREATE OR REPLACE FUNCTION fn_suggestion_inserted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM orienta_users WHERE pseudo = 'Rodolphe LE BLEVENEC' LIMIT 1;

  IF v_admin_id IS NOT NULL AND v_admin_id <> NEW.user_id THEN
    INSERT INTO orienta_notifications (user_id, type, payload)
    VALUES (
      v_admin_id,
      'suggestion',
      jsonb_build_object('player_pseudo', NEW.pseudo, 'suggestion_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suggestion_inserted ON orienta_suggestions;
CREATE TRIGGER trg_suggestion_inserted
  AFTER INSERT ON orienta_suggestions
  FOR EACH ROW EXECUTE FUNCTION fn_suggestion_inserted();

-- NB: RLS volontairement non activé (cohérence avec les autres tables orienta_).
