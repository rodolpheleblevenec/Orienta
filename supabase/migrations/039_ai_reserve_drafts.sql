-- Génération de grilles de réserve assistée par LLM.
-- Les grilles produites par la fonction `generate-reserve-grid` sont insérées en
-- BROUILLON (status='draft', daily_status='draft') : invisibles côté joueur tant
-- que l'admin ne les a pas relues/approuvées. Ces deux colonnes servent l'écran
-- de relecture admin.
--   • ai_generated : marque l'origine IA d'une grille (true) — distingue les
--     brouillons à relire des grilles humaines.
--   • ai_notes     : raisonnement libre du LLM en phase 1 (affinités des mots),
--     affiché à l'admin pour décider rapidement.
-- Idempotent : ré-applicable sans effet de bord.

ALTER TABLE orienta_grids ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;
ALTER TABLE orienta_grids ADD COLUMN IF NOT EXISTS ai_notes text;
