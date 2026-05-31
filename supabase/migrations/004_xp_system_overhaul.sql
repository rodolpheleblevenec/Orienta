-- New XP system: creators earn XP when others play their grids

-- Add xp and level fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp int DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level int DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_skin int DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pseudo text;

-- Update collective_progress table structure
ALTER TABLE collective_progress ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

-- RPC: Award XP when a grid is played (success or not)
-- Returns the XP earned by the player (including streak bonus)
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

  RETURN v_player_total_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This function should be called after a play is marked as completed
-- Call it from the app: SELECT award_xp_on_play(grid_id, player_id, success)
