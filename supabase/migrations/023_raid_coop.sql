-- 023_raid_coop.sql
-- Mode RAID (Boss d'Équipage) — coopératif temps réel.
-- La communauté (≥3 joueurs en ligne) affronte un boss sur un plateau partagé ;
-- chaque joueur tient un « organe » exclusif (Œil / Main / Capitaine au palier 3,
-- davantage en montant). L'autorité du combat est l'Edge Function `raid`
-- (service_role) : la solution ne sort jamais du serveur, l'info sémantique est
-- distribuée par organe. Ces tables ne stockent que l'ÉTAT (sessions, roster, essais).
--
-- Sécurité (cf. mémoire project_security_rls / project_security_definer_grants) :
--   - RLS : SELECT public (le client lit l'état), AUCUNE policy d'écriture → seules
--     les Edge Functions (service_role, qui bypass la RLS) écrivent.
--   - award_raid_victory : SECURITY DEFINER + search_path figé + REVOKE EXECUTE
--     à anon/authenticated (appelée uniquement par l'Edge Function).

-- ── Sessions de raid (source de vérité serveur) ──────────────────────
CREATE TABLE IF NOT EXISTS orienta_raid_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_key           text NOT NULL,                       -- définition côté lib (src/lib/raid.js)
  status             text NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting','active','won','lost','expired')),
  tier               int,                                  -- = nb d'organes, fixé au lancement
  perils             text[]  NOT NULL DEFAULT '{}',         -- {boussole,brouillard,derive}
  card_order         text[]  NOT NULL DEFAULT '{}',         -- identité neutre PARTAGÉE = handles opaques (c0..c3)
  assault_index      int     NOT NULL DEFAULT 0,
  assault_count      int     NOT NULL DEFAULT 3,
  attempts_remaining int     NOT NULL DEFAULT 3,
  assault_deadline   timestamptz,                           -- chrono par assaut
  lives              int     NOT NULL DEFAULT 2,            -- bouées
  max_hp             int     NOT NULL DEFAULT 300,
  current_hp         int     NOT NULL DEFAULT 300,
  board              jsonb   NOT NULL DEFAULT '{}',         -- état neutre {slot:{handle,rotation}} (handles opaques)
  is_test            boolean NOT NULL DEFAULT false,        -- arène ouverte par l'admin (bypass fenêtre)
  window_opens_at    timestamptz NOT NULL DEFAULT now(),
  window_closes_at   timestamptz NOT NULL DEFAULT (now() + interval '3 hours'),
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── Participants + rôle (organe) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS orienta_raid_participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES orienta_raid_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES orienta_users(id) ON DELETE CASCADE,
  pseudo     text,                                          -- copié à l'arrivée (affichage sans jointure)
  role       text CHECK (role IN ('oeil','main','vigie','cartographe','timonier',
                                   'mecanicien','capitaine','navigateur','sonar','horloger')),
  is_ready   boolean NOT NULL DEFAULT false,
  last_seen  timestamptz NOT NULL DEFAULT now(),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
-- Un organe ne peut être tenu que par un joueur à la fois dans une session.
CREATE UNIQUE INDEX IF NOT EXISTS raid_participants_role_uniq
  ON orienta_raid_participants(session_id, role) WHERE role IS NOT NULL;

-- ── Journal des essais d'équipe (audit / replay) ─────────────────────
CREATE TABLE IF NOT EXISTS orienta_raid_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES orienta_raid_sessions(id) ON DELETE CASCADE,
  assault_index int  NOT NULL,
  submitted_by  uuid REFERENCES orienta_users(id),
  answer        jsonb NOT NULL,
  correct_full  int, correct_rotation int, neither int,
  damage        int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Secrets de session (SERVEUR UNIQUEMENT — invisibles au client) ───
-- Les mots (orienta_word_cards) et indices (orienta_grids) sont lisibles
-- publiquement par id. Pour que le scoping par organe tienne, le client ne
-- reçoit JAMAIS les vrais ids : la session publique n'expose que des handles
-- opaques (c0..c3). Cette table garde la correspondance handle→vrai card_id,
-- les grilles, et les dernières couleurs — RLS activé SANS policy SELECT, donc
-- seul le service_role (Edge Function `raid`) y accède (pattern orienta_daily_active).
CREATE TABLE IF NOT EXISTS orienta_raid_session_secrets (
  session_id       uuid PRIMARY KEY REFERENCES orienta_raid_sessions(id) ON DELETE CASCADE,
  grid_ids         uuid[]  NOT NULL DEFAULT '{}',           -- séquence des grilles d'assaut
  card_map         jsonb   NOT NULL DEFAULT '{}',           -- assaut courant : { "c0": <card_id>, ... }
  slot_permutation int[]   NOT NULL DEFAULT '{0,1,2,3}',    -- péril « boussole faussée » (it. 3)
  decoy_handle     text,                                     -- péril « brouillard » (it. 3)
  last_feedback    jsonb,                                    -- { "<slot>": 'correct'|'rotation'|'wrong' } (lecture Capitaine)
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orienta_raid_session_secrets ENABLE ROW LEVEL SECURITY;
-- Pas de policy → table invisible au client (anon/authenticated). Service_role seul.

-- ── Progression communautaire des bosses ─────────────────────────────
ALTER TABLE orienta_collective_progress
  ADD COLUMN IF NOT EXISTS boss_index_cleared int NOT NULL DEFAULT 0;

-- ── RLS : lecture publique, écriture service_role uniquement ─────────
ALTER TABLE orienta_raid_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orienta_raid_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orienta_raid_attempts     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raid_sessions_select"     ON orienta_raid_sessions;
DROP POLICY IF EXISTS "raid_participants_select" ON orienta_raid_participants;
DROP POLICY IF EXISTS "raid_attempts_select"     ON orienta_raid_attempts;
CREATE POLICY "raid_sessions_select"     ON orienta_raid_sessions     FOR SELECT TO public USING (true);
CREATE POLICY "raid_participants_select" ON orienta_raid_participants FOR SELECT TO public USING (true);
CREATE POLICY "raid_attempts_select"     ON orienta_raid_attempts     FOR SELECT TO public USING (true);
-- (aucune policy INSERT/UPDATE/DELETE → écritures réservées au service_role)

-- ── Realtime : suivre l'état de session + roster côté client ─────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orienta_raid_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orienta_raid_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Récompense de victoire (XP collectif + déblocage + notifs) ───────
-- Appelée par l'Edge Function `raid` à la mort du boss. Crédite l'XP collectif
-- (jamais d'XP individuel ni d'entrée orienta_plays → le classement perso reste
-- propre), incrémente le palier de boss débloqué, et notifie chaque participant.
CREATE OR REPLACE FUNCTION public.award_raid_victory(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier    int;
  v_boss    text;
  v_reward  int;
  v_part    record;
BEGIN
  SELECT tier, boss_key INTO v_tier, v_boss
  FROM orienta_raid_sessions WHERE id = p_session_id;
  IF v_tier IS NULL THEN v_tier := 3; END IF;

  -- Récompense proportionnelle au palier (plus de joueurs = plus dur = plus d'XP).
  v_reward := 200 * v_tier;

  UPDATE orienta_collective_progress
    SET total_xp = total_xp + v_reward
    WHERE id = 1;
  PERFORM recalculate_collective_level();

  UPDATE orienta_collective_progress
    SET boss_index_cleared = boss_index_cleared + 1
    WHERE id = 1;

  -- Notifie chaque participant de la victoire d'équipage.
  FOR v_part IN
    SELECT user_id FROM orienta_raid_participants WHERE session_id = p_session_id
  LOOP
    INSERT INTO orienta_notifications (user_id, type, payload)
    VALUES (v_part.user_id, 'raid_victory',
            jsonb_build_object('boss_key', v_boss, 'tier', v_tier, 'xp', v_reward));
  END LOOP;

  RETURN v_reward;
END;
$function$;

-- Verrou : seules les Edge Functions (service_role) peuvent l'exécuter.
REVOKE EXECUTE ON FUNCTION public.award_raid_victory(uuid) FROM PUBLIC, anon, authenticated;
