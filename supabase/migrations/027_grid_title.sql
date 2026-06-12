-- Titre optionnel donné par le créateur à sa grille communautaire.
-- Saisi dans la modale de fin de création, affiché aux joueurs à l'emplacement
-- du bandeau d'info de la page de jeu (là où apparaît « Mode rejeu… »).
ALTER TABLE orienta_grids ADD COLUMN IF NOT EXISTS title text;
