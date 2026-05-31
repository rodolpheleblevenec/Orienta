-- Update users table to track weekend exclusion and reset timing
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_play_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_last_reset_at timestamp;

-- Drop old RPC if it exists
DROP FUNCTION IF EXISTS add_user_xp(uuid, int);

-- New RPC: add_user_xp with improved streak logic
CREATE OR REPLACE FUNCTION add_user_xp(uid uuid, amount int)
RETURNS void AS $$
DECLARE
  v_user users;
  v_today date;
  v_last_play_date date;
  v_days_since_last_play int;
  v_last_reset_at timestamp;
  v_hours_since_reset int;
BEGIN
  v_today := CURRENT_DATE;

  -- Get current user data
  SELECT * INTO v_user FROM users WHERE id = uid;
  IF NOT FOUND THEN RETURN; END IF;

  v_last_play_date := v_user.last_play_date;
  v_last_reset_at := COALESCE(v_user.streak_last_reset_at, v_user.last_played_at, now() - interval '100 hours');
  v_hours_since_reset := EXTRACT(EPOCH FROM (now() - v_last_reset_at)) / 3600;

  -- Calculate days since last play, excluding weekends
  IF v_last_play_date IS NULL THEN
    -- First play ever
    UPDATE users SET
      streak_current = 1,
      streak_best = GREATEST(streak_best, 1),
      last_played_at = now(),
      last_play_date = v_today,
      streak_last_reset_at = now(),
      xp_contributed = xp_contributed + amount
    WHERE id = uid;
  ELSIF v_last_play_date = v_today THEN
    -- Already played today, don't increment streak but add XP
    UPDATE users SET
      last_played_at = now(),
      xp_contributed = xp_contributed + amount
    WHERE id = uid;
  ELSE
    -- Played on a different day
    v_days_since_last_play := v_today - v_last_play_date;

    -- Check if reset threshold exceeded (48 hours = 2 days)
    IF v_hours_since_reset > 48 THEN
      -- Reset streak: too much time has passed
      UPDATE users SET
        streak_current = 1,
        last_played_at = now(),
        last_play_date = v_today,
        streak_last_reset_at = now(),
        xp_contributed = xp_contributed + amount
      WHERE id = uid;
    ELSIF v_days_since_last_play = 1 THEN
      -- Check if last_play_date was a weekday and today is a weekday
      -- If yesterday was weekend, allow streak continuation
      IF EXTRACT(DOW FROM v_last_play_date) NOT IN (0, 6)
         OR EXTRACT(DOW FROM v_today) NOT IN (0, 6) THEN
        -- Last play was on weekday OR today is a weekday, increment
        UPDATE users SET
          streak_current = streak_current + 1,
          streak_best = GREATEST(streak_best, streak_current + 1),
          last_played_at = now(),
          last_play_date = v_today,
          xp_contributed = xp_contributed + amount
        WHERE id = uid;
      ELSE
        -- Both are weekdays, increment normally
        UPDATE users SET
          streak_current = streak_current + 1,
          streak_best = GREATEST(streak_best, streak_current + 1),
          last_played_at = now(),
          last_play_date = v_today,
          xp_contributed = xp_contributed + amount
        WHERE id = uid;
      END IF;
    ELSIF v_days_since_last_play = 2 THEN
      -- 2 days passed - could be valid if skipped weekend
      -- Check if we skipped weekend (Friday -> Monday)
      IF (EXTRACT(DOW FROM v_last_play_date) = 5 AND EXTRACT(DOW FROM v_today) = 1) THEN
        -- Friday to Monday, skip weekend - increment
        UPDATE users SET
          streak_current = streak_current + 1,
          streak_best = GREATEST(streak_best, streak_current + 1),
          last_played_at = now(),
          last_play_date = v_today,
          xp_contributed = xp_contributed + amount
        WHERE id = uid;
      ELSE
        -- Normal 2-day gap, reset
        UPDATE users SET
          streak_current = 1,
          last_played_at = now(),
          last_play_date = v_today,
          streak_last_reset_at = now(),
          xp_contributed = xp_contributed + amount
        WHERE id = uid;
      END IF;
    ELSE
      -- More than 2 days, reset
      UPDATE users SET
        streak_current = 1,
        last_played_at = now(),
        last_play_date = v_today,
        streak_last_reset_at = now(),
        xp_contributed = xp_contributed + amount
      WHERE id = uid;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
