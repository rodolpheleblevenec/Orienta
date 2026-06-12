-- 030_boutique_social.sql
-- Boutique jetons — Phase 3 : social.
--   • Coup de projecteur (boost) : met une grille communautaire en avant (1/joueur/grille)
--   • Offrir des jetons : transfert atomique entre joueurs
--   • Feu d'artifice (cosmétique) : animation de victoire (slot 'victory', déjà prévu en 028)
--
-- RPC SECURITY DEFINER + REVOKE anon/authenticated, mêmes garde-fous que le reste
-- de la boutique (débit atomique gardé, anti-double, notifications).

-- ── Boost : compteur sur la grille + table 1 boost / joueur / grille ──
ALTER TABLE orienta_grids ADD COLUMN IF NOT EXISTS boost_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS orienta_grid_boosts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id    uuid NOT NULL REFERENCES orienta_grids(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES orienta_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grid_id, user_id)
);
CREATE INDEX IF NOT EXISTS grid_boosts_user ON orienta_grid_boosts (user_id);

ALTER TABLE orienta_grid_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grid_boosts_select" ON orienta_grid_boosts;
CREATE POLICY "grid_boosts_select" ON orienta_grid_boosts FOR SELECT TO public USING (true);

-- ── Articles Phase 3 (PRIX = placeholders) ───────────────────────────
INSERT INTO orienta_shop_items (code, family, kind, cost_jetons, payload, title, description, sort_order) VALUES
  ('boost_grid',        'social',   'action', 25, '{"effect":"boost"}',                  'Coup de projecteur', 'Mets une grille de la communauté en avant.', 60),
  ('gift_jetons',       'social',   'action',  0, '{"effect":"gift"}',                   'Offrir des jetons',  'Envoie des jetons à un autre joueur.',       61),
  ('victory_fireworks', 'cosmetic', 'unlock', 45, '{"slot":"victory","value":"fireworks"}', 'Feu d''artifice',  'Une animation spéciale à chaque victoire.',  62)
ON CONFLICT (code) DO NOTHING;

-- ── RPC boost_grid : 1 boost / joueur / grille, débit gardé, notif créateur ──
CREATE OR REPLACE FUNCTION public.boost_grid(p_user_id uuid, p_grid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cost int; v_creator uuid; v_ins int; v_bal int; v_count int;
BEGIN
  SELECT cost_jetons INTO v_cost FROM orienta_shop_items WHERE code = 'boost_grid' AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'boost_unavailable'); END IF;

  SELECT creator_id INTO v_creator FROM orienta_grids WHERE id = p_grid_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'grid_not_found'); END IF;
  IF v_creator = p_user_id THEN RETURN jsonb_build_object('ok', false, 'error', 'cannot_boost_own'); END IF;

  -- Anti-double : 1 boost par joueur et par grille.
  INSERT INTO orienta_grid_boosts (grid_id, user_id) VALUES (p_grid_id, p_user_id)
    ON CONFLICT (grid_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;
  IF v_ins = 0 THEN
    SELECT jetons INTO v_bal FROM orienta_users WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'already_boosted', true, 'jetons', COALESCE(v_bal, 0));
  END IF;

  -- Débit atomique ; rollback du boost si fonds insuffisants.
  UPDATE orienta_users SET jetons = jetons - v_cost
    WHERE id = p_user_id AND jetons >= v_cost RETURNING jetons INTO v_bal;
  IF NOT FOUND THEN
    DELETE FROM orienta_grid_boosts WHERE grid_id = p_grid_id AND user_id = p_user_id;
    SELECT jetons INTO v_bal FROM orienta_users WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'jetons', COALESCE(v_bal, 0));
  END IF;

  UPDATE orienta_grids SET boost_count = boost_count + 1 WHERE id = p_grid_id
    RETURNING boost_count INTO v_count;

  IF v_creator IS NOT NULL THEN
    INSERT INTO orienta_notifications (user_id, type, payload)
    VALUES (v_creator, 'grid_boosted', jsonb_build_object('grid_id', p_grid_id));
  END IF;

  RETURN jsonb_build_object('ok', true, 'jetons', v_bal, 'boost_count', v_count);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.boost_grid(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── RPC gift_jetons : transfert atomique entre joueurs + notif ───────
CREATE OR REPLACE FUNCTION public.gift_jetons(p_sender uuid, p_recipient uuid, p_amount int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bal int; v_is_system boolean; v_sender_pseudo text;
BEGIN
  IF p_amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_amount'); END IF;
  IF p_sender = p_recipient THEN RETURN jsonb_build_object('ok', false, 'error', 'self_gift'); END IF;

  SELECT is_system INTO v_is_system FROM orienta_users WHERE id = p_recipient;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'recipient_not_found'); END IF;
  IF COALESCE(v_is_system, false) THEN RETURN jsonb_build_object('ok', false, 'error', 'recipient_invalid'); END IF;

  -- Débit expéditeur (gardé), puis crédit destinataire — atomique dans la même fonction.
  UPDATE orienta_users SET jetons = jetons - p_amount
    WHERE id = p_sender AND jetons >= p_amount RETURNING jetons INTO v_bal;
  IF NOT FOUND THEN
    SELECT jetons INTO v_bal FROM orienta_users WHERE id = p_sender;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'jetons', COALESCE(v_bal, 0));
  END IF;
  UPDATE orienta_users SET jetons = jetons + p_amount WHERE id = p_recipient;

  SELECT pseudo INTO v_sender_pseudo FROM orienta_users WHERE id = p_sender;
  INSERT INTO orienta_notifications (user_id, type, payload)
  VALUES (p_recipient, 'jetons_gift', jsonb_build_object('amount', p_amount, 'from_pseudo', v_sender_pseudo));

  RETURN jsonb_build_object('ok', true, 'jetons', v_bal, 'amount', p_amount);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.gift_jetons(uuid, uuid, int) FROM PUBLIC, anon, authenticated;
