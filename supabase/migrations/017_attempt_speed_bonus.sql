-- 017 — Bonus de rapidité joueur
-- Récompense la résolution d'une grille avant le 3e essai :
--   • +6 XP si résolue au 1er essai
--   • +3 XP si résolue au 2e essai
--   • 0 au 3e essai ou en cas d'échec
--
-- Le montant est calculé et passé par l'Edge Function check-attempt
-- (autorité unique du jeu). award_xp_on_play l'ajoute à l'XP du joueur et au
-- collectif, exactement comme le bonus de série (p_streak_bonus).

CREATE OR REPLACE FUNCTION public.award_xp_on_play(
  p_grid_id uuid, p_player_id uuid, p_success boolean,
  p_streak_bonus integer DEFAULT 0, p_attempt_bonus integer DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_creator_id uuid;
  v_creator_is_system boolean := false;
  v_creator_xp_earned int := 0;
  v_player_xp_earned int;
  v_total_xp_earned int;
BEGIN
  SELECT creator_id INTO v_creator_id FROM orienta_grids WHERE id = p_grid_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_creator_id = p_player_id THEN RETURN 0; END IF;

  -- Le créateur est-il un compte "maison" ?
  IF v_creator_id IS NOT NULL THEN
    SELECT is_system INTO v_creator_is_system FROM orienta_users WHERE id = v_creator_id;
  END IF;

  -- XP créateur : 15 base + 30 si succès — UNIQUEMENT pour un vrai joueur
  IF v_creator_id IS NOT NULL AND COALESCE(v_creator_is_system, false) = false THEN
    v_creator_xp_earned := 15;
    IF p_success THEN v_creator_xp_earned := v_creator_xp_earned + 30; END IF;
    UPDATE orienta_users SET xp = xp + v_creator_xp_earned WHERE id = v_creator_id;
    PERFORM recalculate_user_level(v_creator_id);
  END IF;

  -- XP joueur : 25 si succès + bonus de série + bonus de rapidité
  v_player_xp_earned := CASE WHEN p_success THEN 25 ELSE 0 END;
  v_player_xp_earned := v_player_xp_earned + p_streak_bonus + p_attempt_bonus;
  UPDATE orienta_users SET xp = xp + v_player_xp_earned WHERE id = p_player_id;
  PERFORM recalculate_user_level(p_player_id);

  -- Collectif : XP créateur (0 si maison) + XP joueur
  v_total_xp_earned := v_creator_xp_earned + v_player_xp_earned;
  UPDATE orienta_collective_progress SET total_xp = total_xp + v_total_xp_earned WHERE id = 1;
  PERFORM recalculate_collective_level();

  RETURN v_player_xp_earned;
END;
$function$;

-- Retire l'ancienne surcharge à 4 arguments (remplacée par la version à 5 args).
DROP FUNCTION IF EXISTS public.award_xp_on_play(uuid, uuid, boolean, integer);
