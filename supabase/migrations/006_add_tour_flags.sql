-- Persist tutorial/tour completion state in DB so it survives device/browser changes

ALTER TABLE orienta_users
  ADD COLUMN IF NOT EXISTS tour_play_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tour_create_placement_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tour_create_clues_done boolean DEFAULT false;
