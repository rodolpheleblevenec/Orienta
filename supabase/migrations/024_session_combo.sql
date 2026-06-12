-- 024_session_combo.sql
-- Combo de session — multiplicateur d'XP sur les réussites consécutives.
--
-- Enchaîner des grilles réussies dans une même « session » (fenêtre glissante de
-- 30 min, gérée dans l'Edge Function check-attempt) fait croître un multiplicateur
-- ×1,2 → ×2 sur l'XP du joueur. Un échec casse le combo.
--
-- L'autorité reste check-attempt (service_role) : il calcule comboSteps + le bonus
-- d'XP correspondant, persiste l'état (combo_count / combo_updated_at) et passe le
-- bonus à award_xp_on_play, qui l'ajoute exactement comme p_streak_bonus /
-- p_attempt_bonus — l'XP collective et le recalcul de niveau suivent sans divergence.
--
-- Sécurité (cf. mémoire project_security_definer_grants) : recréer une fonction
-- SECURITY DEFINER avec une NOUVELLE signature réaccorde EXECUTE à PUBLIC par
-- défaut → on RE-REVOKE anon/authenticated à la fin (piège corrigé en 018).

-- ── État du combo, porté par le joueur ───────────────────────────────
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS combo_count      int         NOT NULL DEFAULT 0;
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS combo_updated_at timestamptz;

-- ── award_xp_on_play : + bonus de combo (6e paramètre) ───────────────
-- Identique à 017, avec p_combo_bonus ajouté à l'XP joueur (et donc au collectif).
CREATE OR REPLACE FUNCTION public.award_xp_on_play(
  p_grid_id uuid, p_player_id uuid, p_success boolean,
  p_streak_bonus integer DEFAULT 0, p_attempt_bonus integer DEFAULT 0,
  p_combo_bonus integer DEFAULT 0
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

  -- XP joueur : 25 si succès + bonus de série + bonus de rapidité + bonus de combo
  v_player_xp_earned := CASE WHEN p_success THEN 25 ELSE 0 END;
  v_player_xp_earned := v_player_xp_earned + p_streak_bonus + p_attempt_bonus + p_combo_bonus;
  UPDATE orienta_users SET xp = xp + v_player_xp_earned WHERE id = p_player_id;
  PERFORM recalculate_user_level(p_player_id);

  -- Collectif : XP créateur (0 si maison) + XP joueur (combo inclus)
  v_total_xp_earned := v_creator_xp_earned + v_player_xp_earned;
  UPDATE orienta_collective_progress SET total_xp = total_xp + v_total_xp_earned WHERE id = 1;
  PERFORM recalculate_collective_level();

  RETURN v_player_xp_earned;
END;
$function$;

-- Retire l'ancienne surcharge à 5 arguments (remplacée par la version à 6 args).
DROP FUNCTION IF EXISTS public.award_xp_on_play(uuid, uuid, boolean, integer, integer);

-- Verrou : seules les Edge Functions (service_role) peuvent l'exécuter.
REVOKE EXECUTE ON FUNCTION public.award_xp_on_play(uuid, uuid, boolean, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
