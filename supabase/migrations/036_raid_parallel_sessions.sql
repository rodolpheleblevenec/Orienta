-- 036_raid_parallel_sessions.sql
-- Sessions de RAID EN PARALLÈLE : plusieurs combats ACTIFS simultanés, mais UN SEUL
-- lobby d'attente public à la fois (tout le monde s'y rassemble ; au lancement, le
-- combat se verrouille à son équipage et un nouveau lobby s'ouvre pour le groupe
-- suivant). On ne reste donc plus « une seule arène à la fois ».
--
-- Avant (035) : index unique sur (waiting|active) → une seule arène publique ouverte.
-- Après        : index unique sur (waiting)       → un seul LOBBY ; les actives ne bloquent plus.
--
-- La colonne générée is_open_public ne sert QU'À cet index (vérifié : non référencée
-- ailleurs). On la redéfinit (drop + recreate, car une generated column n'est pas
-- modifiable en place), puis on recrée l'index unique partiel.

DROP INDEX IF EXISTS raid_one_open_public;
ALTER TABLE orienta_raid_sessions DROP COLUMN IF EXISTS is_open_public;
ALTER TABLE orienta_raid_sessions ADD COLUMN is_open_public boolean
  GENERATED ALWAYS AS ((NOT is_test) AND status = 'waiting') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS raid_one_open_public
  ON orienta_raid_sessions ((is_open_public)) WHERE is_open_public;
