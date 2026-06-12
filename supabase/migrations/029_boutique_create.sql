-- 029_boutique_create.sql
-- Boutique jetons — Phase 2 : confort création.
--   • reroll des cartes (relancer le tirage de mots pendant la création)
--   • slot de création quotidien supplémentaire (au-delà de la limite de 1/jour)
--   • déblocage de toutes les difficultés (sauter facile→moyen→difficile)
--
-- Les colonnes supports (extra_create_slots) existent déjà depuis 028. On ajoute
-- ici les articles catalogue + 2 RPC SECURITY DEFINER (débit générique + conso de
-- slot), verrouillées comme les autres (REVOKE anon/authenticated).

-- ── Articles Phase 2 (PRIX = placeholders à calibrer) ────────────────
INSERT INTO orienta_shop_items (code, family, kind, cost_jetons, payload, title, description, sort_order) VALUES
  ('reroll_cards',            'convenience', 'action',     10, '{"effect":"reroll"}',              'Relancer les cartes', 'Re-tire de nouveaux mots pendant la création.',           50),
  ('extra_create_slot',       'convenience', 'consumable', 30, '{"counter":"extra_create_slots","amount":1}', 'Création en plus', 'Crée une grille communautaire de plus aujourd''hui.', 51),
  ('unlock_all_difficulties', 'convenience', 'unlock',     60, '{"feature":"all_difficulties"}',   'Toutes difficultés',  'Crée en Moyen et Difficile sans passer par les paliers.', 52)
ON CONFLICT (code) DO NOTHING;

-- ── RPC spend_jetons : débit générique atomique gardé (reroll, etc.) ─
CREATE OR REPLACE FUNCTION public.spend_jetons(p_user_id uuid, p_cost int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_bal int;
BEGIN
  IF p_cost < 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_cost'); END IF;
  UPDATE orienta_users SET jetons = jetons - p_cost
    WHERE id = p_user_id AND jetons >= p_cost
    RETURNING jetons INTO v_bal;
  IF NOT FOUND THEN
    SELECT jetons INTO v_bal FROM orienta_users WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'jetons', COALESCE(v_bal, 0));
  END IF;
  RETURN jsonb_build_object('ok', true, 'jetons', v_bal);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.spend_jetons(uuid, int) FROM PUBLIC, anon, authenticated;

-- ── RPC consume_create_slot : décrémente 1 slot de création supplémentaire ──
-- Appelée par create-grid APRÈS création réussie d'une 2e+ grille du jour.
CREATE OR REPLACE FUNCTION public.consume_create_slot(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_used boolean;
BEGIN
  UPDATE orienta_users SET extra_create_slots = extra_create_slots - 1
    WHERE id = p_user_id AND extra_create_slots > 0
    RETURNING true INTO v_used;
  RETURN COALESCE(v_used, false);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_create_slot(uuid) FROM PUBLIC, anon, authenticated;
