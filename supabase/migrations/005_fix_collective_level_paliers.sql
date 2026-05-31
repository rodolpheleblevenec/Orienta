-- Fix collective level calculation with 10x harder paliers

-- RPC: Recalculate collective level based on XP
-- Paliers are 10x harder than individual: [0, 500, 1300, 2600, 5000, 9000, 16000, 28000, 48000, 80000]
CREATE OR REPLACE FUNCTION recalculate_collective_level()
RETURNS int AS $$
DECLARE
  v_paliers int[] := ARRAY[0, 500, 1300, 2600, 5000, 9000, 16000, 28000, 48000, 80000];
  v_current_xp int;
  v_new_level int;
  i int;
BEGIN
  -- Get current collective XP
  SELECT total_xp INTO v_current_xp FROM collective_progress WHERE id = 1;
  IF NOT FOUND THEN RETURN 1; END IF;

  -- Find the level based on XP thresholds
  v_new_level := 1;
  FOR i IN 1..array_length(v_paliers, 1) LOOP
    IF v_current_xp >= v_paliers[i] THEN
      v_new_level := i;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Update collective level
  UPDATE collective_progress
  SET level = v_new_level
  WHERE id = 1;

  RETURN v_new_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update award_xp_on_play to recalculate collective level after awarding XP
CREATE OR REPLACE FUNCTION award_xp_on_play(p_grid_id uuid, p_player_id uuid, p_success boolean, p_streak_bonus int DEFAULT 0)
RETURNS int AS $$
DECLARE
  v_creator_id uuid;
  v_creator_xp_earned int;
  v_player_xp_earned int;
  v_player_total_xp int;
BEGIN
  -- Get the creator of the grid
  SELECT creator_id INTO v_creator_id FROM grids WHERE id = p_grid_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_creator_id = p_player_id THEN RETURN 0; END IF; -- no XP for playing own grids

  -- XP for creator: 15 base + 30 bonus if success
  v_creator_xp_earned := 15;
  IF p_success THEN
    v_creator_xp_earned := v_creator_xp_earned + 30;
  END IF;

  -- XP for player: 25 if success, 0 if failure + streak bonus (individual only)
  v_player_xp_earned := CASE WHEN p_success THEN 25 ELSE 0 END;
  v_player_total_xp := v_player_xp_earned + p_streak_bonus;

  -- Update creator XP
  UPDATE users SET xp = xp + v_creator_xp_earned WHERE id = v_creator_id;

  -- Update player XP with streak bonus
  IF v_player_total_xp > 0 THEN
    UPDATE users SET xp = xp + v_player_total_xp WHERE id = p_player_id;
  END IF;

  -- Update collective XP: only base player XP (no streak bonus), with 10x harder paliers
  UPDATE collective_progress SET total_xp = total_xp + v_player_xp_earned WHERE id = 1;

  -- Recalculate collective level based on new XP total
  PERFORM recalculate_collective_level();

  RETURN v_player_total_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing collective level (call this once to reset the collective to the correct level)
SELECT recalculate_collective_level();
