-- 033_wheel_balance.sql
-- Rééquilibrage de la roue de la fortune : la rendre nettement moins avantageuse.
--
-- Avant : 22 % « Rien », ~78 % de gain (souvent petit) → ressenti « trop généreux ».
-- Après : 45 % « Rien », gains majoritairement < coût du tour (20), gros lots rares.
-- Poids total = 100. Espérance ≈ 10 jetons-équivalents par tour de 20 (maison gagnante).
--
-- Tunable sans redéploiement : ce ne sont que des UPDATE de poids/lots/couleurs.

UPDATE orienta_wheel_segments SET weight = 45, reward_value = 0,   label = 'Rien',     color = '#aeb6c2' WHERE idx = 0;
UPDATE orienta_wheel_segments SET weight = 22, reward_value = 5,   label = '🪙 5',     color = '#5ec5ad' WHERE idx = 4;
UPDATE orienta_wheel_segments SET weight = 14, reward_value = 10,  label = '🪙 10',    color = '#0a9e84' WHERE idx = 1;
UPDATE orienta_wheel_segments SET weight = 8,  reward_value = 25,  label = '🪙 25',    color = '#d98a14' WHERE idx = 2;
UPDATE orienta_wheel_segments SET weight = 4,  reward_value = 1,   label = '🛡️',       color = '#3b82f6' WHERE idx = 3;
UPDATE orienta_wheel_segments SET weight = 3,  reward_value = 50,  label = '🪙 50',    color = '#f0603f' WHERE idx = 6;
UPDATE orienta_wheel_segments SET weight = 2,  reward_value = 1,   label = '➕',        color = '#22a06b' WHERE idx = 5;
UPDATE orienta_wheel_segments SET weight = 2,  reward_value = 100, label = '💎 100',   color = '#e8b84b' WHERE idx = 7;
