-- 034_wheel_simplify.sql
-- Roue de la fortune — version simplifiée + un peu plus favorable au joueur (rétention).
--
--   • On simplifie : 6 segments au lieu de 8 (on désactive « 🪙 5 » et « ➕ Création »).
--   • Plus favorable : moins de « Rien » (40 % au lieu de 45 %), gains revalorisés.
--   • Cohérence : plus de 💎 (il n'y a pas de diamant dans le jeu) → toujours 🪙.
--
-- Coût d'un tour : 🪙20. Poids total des segments actifs = 100.
-- Espérance ≈ 16 jetons-équivalents / tour (retour ~80 %, la maison garde ~20 %).

-- Segments retirés de la roue (simplification) — gardés en base, désactivés.
UPDATE orienta_wheel_segments SET active = false WHERE idx IN (4, 5);

-- Segments actifs : ladder propre, tout en 🪙 sauf le protège-série.
UPDATE orienta_wheel_segments SET active = true, weight = 40, reward_value = 0,   label = 'Rien',   color = '#aeb6c2' WHERE idx = 0;
UPDATE orienta_wheel_segments SET active = true, weight = 30, reward_value = 10,  label = '🪙 10',  color = '#0a9e84' WHERE idx = 1;
UPDATE orienta_wheel_segments SET active = true, weight = 14, reward_value = 25,  label = '🪙 25',  color = '#d98a14' WHERE idx = 2;
UPDATE orienta_wheel_segments SET active = true, weight = 6,  reward_value = 1,   label = '🛡️',     color = '#3b82f6' WHERE idx = 3;
UPDATE orienta_wheel_segments SET active = true, weight = 6,  reward_value = 50,  label = '🪙 50',  color = '#f0603f' WHERE idx = 6;
UPDATE orienta_wheel_segments SET active = true, weight = 4,  reward_value = 100, label = '🪙 100', color = '#e8b84b' WHERE idx = 7;
