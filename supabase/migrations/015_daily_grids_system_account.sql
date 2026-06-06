-- ── Compte système propriétaire des grilles du jour ──────────────────────
-- Les grilles du jour ne doivent plus être attribuées à un joueur réel
-- (sinon il accumule l'XP créateur et reçoit les notifications de jeu).
--
-- NB : la correction one-time des données (réattribution des 14 grilles
-- existantes, retrait de l'XP déjà attribuée à Rodolphe + au collectif,
-- nettoyage des notifications) a été appliquée séparément en prod et n'est
-- pas rejouable — elle n'est donc pas incluse ici.

-- 1. Marqueur de compte "maison" (exclu du classement, ne gagne pas d'XP)
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2. Compte système "Orienta" (idempotent)
INSERT INTO orienta_users (pseudo, is_system)
SELECT 'Orienta', true
WHERE NOT EXISTS (SELECT 1 FROM orienta_users WHERE pseudo = 'Orienta');

-- 3. award_xp_on_play : le créateur "maison" (compte système OU grille sans
--    créateur) ne gagne aucune XP, et son XP n'alimente plus le collectif.
--    Corrige aussi l'inflation latente du collectif pour les grilles à
--    creator_id NULL générées automatiquement.
CREATE OR REPLACE FUNCTION public.award_xp_on_play(
  p_grid_id uuid, p_player_id uuid, p_success boolean, p_streak_bonus integer DEFAULT 0
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

  -- XP joueur : 25 si succès + bonus de série
  v_player_xp_earned := CASE WHEN p_success THEN 25 ELSE 0 END;
  v_player_xp_earned := v_player_xp_earned + p_streak_bonus;
  UPDATE orienta_users SET xp = xp + v_player_xp_earned WHERE id = p_player_id;
  PERFORM recalculate_user_level(p_player_id);

  -- Collectif : XP créateur (0 si maison) + XP joueur
  v_total_xp_earned := v_creator_xp_earned + v_player_xp_earned;
  UPDATE orienta_collective_progress SET total_xp = total_xp + v_total_xp_earned WHERE id = 1;
  PERFORM recalculate_collective_level();

  RETURN v_player_xp_earned;
END;
$function$;

-- 4. Supprime l'ancienne surcharge à 3 arguments (non utilisée, comportement obsolète)
DROP FUNCTION IF EXISTS public.award_xp_on_play(uuid, uuid, boolean);
