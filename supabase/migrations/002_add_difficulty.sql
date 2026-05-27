-- Add difficulty level to grids
ALTER TABLE orienta_grids ADD COLUMN difficulty text NOT NULL DEFAULT 'moyen';
