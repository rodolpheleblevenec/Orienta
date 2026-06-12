-- 035_raid_weekly_golive.sql
-- Go-live RAID : passage au modèle « boss de la semaine » + Hall of Fame + ouverture
-- publique à la demande. Le boss n'avance plus à chaque victoire : il est figé pour
-- toute la semaine (calcul de niveau côté lib/Edge à partir de RAID_LAUNCH_AT), et de
-- nombreux équipages l'affrontent. La récompense croît avec le niveau du boss.
--
-- Sécurité (cf. mémoire project_security_definer_grants) : award_raid_victory recréée
-- ci-dessous → on re-REVOKE EXECUTE à anon/authenticated en fin de migration.

-- ── (a) Rattacher chaque session à son niveau/semaine (figé à la création) ──
-- Sert le Hall of Fame (regrouper les victoires par semaine) ET la difficulté
-- (chaque palier a ses assauts/bouées/chrono/grilles). NULL = anciennes sessions / test.
ALTER TABLE orienta_raid_sessions ADD COLUMN IF NOT EXISTS boss_level int;

-- (défensif — déjà présents en prod via 023/027 ; garde l'idempotence de la migration)
ALTER TABLE orienta_raid_sessions ADD COLUMN IF NOT EXISTS card_order text[] NOT NULL DEFAULT '{}';
ALTER TABLE orienta_raid_sessions ADD COLUMN IF NOT EXISTS sonar_used boolean NOT NULL DEFAULT false;

-- ── (b) « Une seule arène publique ouverte à la fois » ───────────────────────
-- Arènes sérialisées : tout le monde converge dans le même combat (évite les
-- sous-groupes < min incapables de lancer). Colonne générée + index unique partiel =
-- garde-fou anti-double-spawn au niveau DB (deux ensure-public simultanés → un seul
-- INSERT réussit, l'autre attrape la violation et rejoint l'arène existante).
ALTER TABLE orienta_raid_sessions ADD COLUMN IF NOT EXISTS is_open_public boolean
  GENERATED ALWAYS AS ((NOT is_test) AND status IN ('waiting','active')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS raid_one_open_public
  ON orienta_raid_sessions ((is_open_public)) WHERE is_open_public;

-- ── (c) Hall of Fame : lookup rapide des victoires par semaine, triables par temps ──
CREATE INDEX IF NOT EXISTS raid_hof_idx
  ON orienta_raid_sessions (boss_level, status, ended_at) WHERE status = 'won';

-- ── (d) Récompense : ne pilote plus le boss ; croît avec le niveau ───────────
-- boss_index_cleared n'est plus utilisé pour CHOISIR le boss (le boss vient de la
-- semaine) → il devient un simple compteur total de victoires. Récompense collective
-- = 200 × tier × niveau (battre un boss plus haut rapporte beaucoup plus).
CREATE OR REPLACE FUNCTION public.award_raid_victory(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier    int;
  v_level   int;
  v_boss    text;
  v_reward  int;
  v_part    record;
BEGIN
  SELECT tier, COALESCE(boss_level, 1), boss_key
    INTO v_tier, v_level, v_boss
    FROM orienta_raid_sessions WHERE id = p_session_id;
  IF v_tier IS NULL THEN v_tier := 3; END IF;
  IF v_level IS NULL OR v_level < 1 THEN v_level := 1; END IF;

  -- Récompense croissante : palier (nb joueurs) × niveau du boss (semaine).
  v_reward := 200 * v_tier * v_level;

  UPDATE orienta_collective_progress
    SET total_xp = total_xp + v_reward
    WHERE id = 1;
  PERFORM recalculate_collective_level();

  -- Compteur total de victoires (ne choisit plus le boss).
  UPDATE orienta_collective_progress
    SET boss_index_cleared = boss_index_cleared + 1
    WHERE id = 1;

  -- Notifie chaque participant de la victoire d'équipage.
  FOR v_part IN
    SELECT user_id FROM orienta_raid_participants WHERE session_id = p_session_id
  LOOP
    INSERT INTO orienta_notifications (user_id, type, payload)
    VALUES (v_part.user_id, 'raid_victory',
            jsonb_build_object('boss_key', v_boss, 'tier', v_tier, 'level', v_level, 'xp', v_reward));
  END LOOP;

  RETURN v_reward;
END;
$function$;

-- Verrou : seules les Edge Functions (service_role) peuvent l'exécuter.
REVOKE EXECUTE ON FUNCTION public.award_raid_victory(uuid) FROM PUBLIC, anon, authenticated;
