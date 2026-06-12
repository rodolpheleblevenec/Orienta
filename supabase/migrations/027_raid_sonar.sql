-- 027_raid_sonar.sql
-- Pouvoir « Sonar » du Capitaine : sonder UNE carte par assaut (le serveur lui
-- révèle si elle est parfaitement placée) avant de dépenser un essai.
-- On suit l'usage par assaut via un drapeau réinitialisé à chaque nouvel assaut.
ALTER TABLE orienta_raid_sessions
  ADD COLUMN IF NOT EXISTS sonar_used boolean NOT NULL DEFAULT false;
