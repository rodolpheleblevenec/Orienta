ALTER TABLE orienta_users
  ADD COLUMN IF NOT EXISTS tutorial_modal_done boolean DEFAULT false;
