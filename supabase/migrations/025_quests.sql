-- 025_quests.sql
-- Quêtes quotidiennes & hebdomadaires + monnaie « jetons ».
--
-- 3 mini-objectifs/jour (tirés d'un pool, rotation déterministe par date → mêmes
-- 3 pour tous ce jour-là) + quelques quêtes hebdo. La progression est mise à jour
-- par l'autorité du jeu (Edge Function check-attempt → apply_quest_progress) ; la
-- récompense (jetons) est créditée plus tard, au clic « Récupérer » (claim manuel).
--
-- Pas de job de reset destructif : chaque période a ses propres lignes, indexées
-- par period_key (jour = date Paris 'YYYY-MM-DD' ; semaine = ISO 'YYYY-Www').
-- Les anciennes lignes cessent simplement d'être requêtées.
--
-- Sécurité (cf. mémoire project_security_rls / project_security_definer_grants) :
--   - RLS : SELECT public, AUCUNE policy d'écriture → écritures réservées au
--     service_role (Edge Functions, qui bypass la RLS).
--   - Fonctions SECURITY DEFINER + search_path figé + REVOKE EXECUTE à
--     anon/authenticated (appelées uniquement par les Edge Functions).

-- ── Monnaie : jetons (porté par le joueur) ───────────────────────────
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS jetons int NOT NULL DEFAULT 0;

-- ── Catalogue des quêtes (définitions) ───────────────────────────────
CREATE TABLE IF NOT EXISTS orienta_quests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,          -- clé machine + graine du tirage
  scope             text NOT NULL CHECK (scope IN ('daily','weekly')),
  title             text NOT NULL,
  description       text NOT NULL,
  goal_type         text NOT NULL CHECK (goal_type IN (
                      'solve_daily',          -- réussir la grille du jour
                      'complete_community',   -- N grilles de la communauté (distinctes/jour)
                      'fast_solve',           -- réussir en < threshold_seconds
                      'flawless',             -- réussir au 1er essai
                      'complete_any',         -- N grilles (distinctes/jour)
                      'win_daily')),          -- réussir la grille du jour N fois (hebdo)
  target            int  NOT NULL DEFAULT 1,
  threshold_seconds int,                            -- pour fast_solve (sinon NULL)
  reward_jetons     int  NOT NULL DEFAULT 0,
  reward_xp         int  NOT NULL DEFAULT 0,        -- réserve (0 aujourd'hui : récompense = jetons)
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        int  NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Progression par joueur / quête / période ─────────────────────────
CREATE TABLE IF NOT EXISTS orienta_quest_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES orienta_users(id) ON DELETE CASCADE,
  quest_id     uuid NOT NULL REFERENCES orienta_quests(id) ON DELETE CASCADE,
  scope        text NOT NULL CHECK (scope IN ('daily','weekly')),  -- dénormalisé (filtrage)
  period_key   text NOT NULL,                       -- 'YYYY-MM-DD' (jour Paris) | 'YYYY-Www' (ISO)
  progress     int  NOT NULL DEFAULT 0,
  target       int  NOT NULL,                        -- snapshot (affichage stable)
  completed_at timestamptz,                          -- non-null => objectif atteint
  claimed_at   timestamptz,                          -- non-null => récompense créditée
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_id, period_key)
);
CREATE INDEX IF NOT EXISTS quest_progress_lookup
  ON orienta_quest_progress (user_id, scope, period_key);

-- ── RLS : lecture publique, écriture service_role uniquement ─────────
ALTER TABLE orienta_quests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orienta_quest_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quests_select"          ON orienta_quests;
DROP POLICY IF EXISTS "quest_progress_select"  ON orienta_quest_progress;
CREATE POLICY "quests_select"          ON orienta_quests         FOR SELECT TO public USING (true);
CREATE POLICY "quest_progress_select"  ON orienta_quest_progress FOR SELECT TO public USING (true);
-- (aucune policy INSERT/UPDATE/DELETE → écritures réservées au service_role)

-- ── Seed du pool (idempotent) ────────────────────────────────────────
INSERT INTO orienta_quests (code, scope, title, description, goal_type, target, threshold_seconds, reward_jetons, sort_order) VALUES
  ('daily_solve',     'daily', 'Grille du jour',  'Résous la grille du jour',                 'solve_daily',        1, NULL, 10, 1),
  ('daily_two_comm',  'daily', 'Explorateur',     'Termine 2 grilles de la communauté',       'complete_community', 2, NULL, 10, 2),
  ('daily_one_comm',  'daily', 'Curieux',         'Termine 1 grille de la communauté',        'complete_community', 1, NULL,  6, 3),
  ('daily_fast30',    'daily', 'Éclair',          'Résous une grille en moins de 30 s',       'fast_solve',         1,   30, 10, 4),
  ('daily_fast45',    'daily', 'Vif',             'Résous une grille en moins de 45 s',       'fast_solve',         1,   45,  8, 5),
  ('daily_flawless',  'daily', 'Sans faute',      'Résous une grille du premier essai',       'flawless',           1, NULL,  8, 6),
  ('daily_two_any',   'daily', 'Échauffement',    'Termine 2 grilles',                        'complete_any',       2, NULL,  8, 7),
  ('daily_three_any', 'daily', 'Marathon',        'Termine 3 grilles',                        'complete_any',       3, NULL, 12, 8),
  ('weekly_ten',      'weekly','Assidu',          'Termine 10 grilles cette semaine',         'complete_any',      10, NULL, 50, 1),
  ('weekly_daily3',   'weekly','Régularité',      'Réussis la grille du jour 3 fois',         'win_daily',          3, NULL, 60, 2),
  ('weekly_flawless5','weekly','Perfectionniste', 'Réussis 5 grilles sans faute cette semaine','flawless',          5, NULL, 50, 3)
ON CONFLICT (code) DO NOTHING;

-- ── ensure_quest_period : matérialise (paresseusement) les lignes de la période ──
-- daily : tirage déterministe de 3 quêtes (mêmes pour tous ce jour). weekly : toutes.
-- Idempotent via la contrainte UNIQUE (ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION public.ensure_quest_period(
  p_user_id uuid, p_scope text, p_period_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_scope = 'daily' THEN
    INSERT INTO orienta_quest_progress (user_id, quest_id, scope, period_key, target)
    SELECT p_user_id, q.id, 'daily', p_period_key, q.target
    FROM (
      SELECT id, target FROM orienta_quests
      WHERE scope = 'daily' AND is_active = true
      ORDER BY hashtext(p_period_key || code)   -- mélange déterministe par période
      LIMIT 3
    ) q
    ON CONFLICT (user_id, quest_id, period_key) DO NOTHING;
  ELSIF p_scope = 'weekly' THEN
    INSERT INTO orienta_quest_progress (user_id, quest_id, scope, period_key, target)
    SELECT p_user_id, q.id, 'weekly', p_period_key, q.target
    FROM orienta_quests q
    WHERE q.scope = 'weekly' AND q.is_active = true
    ON CONFLICT (user_id, quest_id, period_key) DO NOTHING;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ensure_quest_period(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- ── apply_quest_progress : avance la progression depuis une partie finalisée ──
-- Appelée par check-attempt APRÈS la finalisation atomique (la partie a déjà
-- completed_at + success). Ne crédite RIEN (claim manuel) : marque seulement la
-- complétion + notifie. Idempotence : la partie est finalisée une seule fois
-- (CAS dans check-attempt), et on ne traite que les lignes encore non complétées.
CREATE OR REPLACE FUNCTION public.apply_quest_progress(
  p_user_id        uuid,
  p_success        boolean,
  p_time_seconds   int,
  p_attempts_count int,
  p_is_daily_grid  boolean,
  p_grid_id        uuid,
  p_daily_key      text,    -- 'YYYY-MM-DD' (jour Paris), fourni par check-attempt
  p_week_key       text     -- 'YYYY-Www'   (semaine ISO), fourni par check-attempt
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_inc int;
  v_first_today boolean;
  v_day_start timestamptz;
BEGIN
  IF NOT p_success THEN RETURN; END IF;  -- toutes les quêtes actuelles exigent un succès

  -- Création paresseuse : garantit les lignes même si le hub n'a jamais été ouvert.
  PERFORM ensure_quest_period(p_user_id, 'daily',  p_daily_key);
  PERFORM ensure_quest_period(p_user_id, 'weekly', p_week_key);

  -- Anti-rejeu : « première réussite de CETTE grille aujourd'hui (heure de Paris) ? »
  -- Minuit Paris du jour, converti en instant UTC (sûr DST grâce à AT TIME ZONE).
  v_day_start := (p_daily_key::date)::timestamp AT TIME ZONE 'Europe/Paris';
  SELECT count(*) = 1 INTO v_first_today
  FROM orienta_plays
  WHERE player_id = p_user_id AND grid_id = p_grid_id
    AND success = true AND completed_at IS NOT NULL
    AND completed_at >= v_day_start;

  FOR r IN
    SELECT qp.id AS prog_id, qp.quest_id, qp.progress, qp.target,
           q.goal_type, q.threshold_seconds, q.scope
    FROM orienta_quest_progress qp
    JOIN orienta_quests q ON q.id = qp.quest_id
    WHERE qp.user_id = p_user_id
      AND qp.completed_at IS NULL
      AND ( (qp.scope = 'daily'  AND qp.period_key = p_daily_key)
         OR (qp.scope = 'weekly' AND qp.period_key = p_week_key) )
  LOOP
    v_inc := 0;

    IF r.goal_type = 'solve_daily' AND p_is_daily_grid THEN
      v_inc := 1;
    ELSIF r.goal_type = 'win_daily' AND p_is_daily_grid AND v_first_today THEN
      v_inc := 1;
    ELSIF r.goal_type = 'fast_solve' AND p_time_seconds < COALESCE(r.threshold_seconds, 30) THEN
      v_inc := 1;
    ELSIF r.goal_type = 'flawless' AND p_attempts_count = 1 THEN
      v_inc := 1;
    ELSIF r.goal_type = 'complete_any' AND v_first_today THEN
      v_inc := 1;
    ELSIF r.goal_type = 'complete_community' AND p_is_daily_grid = false AND v_first_today THEN
      v_inc := 1;
    END IF;

    IF v_inc > 0 THEN
      UPDATE orienta_quest_progress
        SET progress = LEAST(progress + v_inc, target),
            completed_at = CASE WHEN progress + v_inc >= target THEN now() ELSE completed_at END
        WHERE id = r.prog_id;

      -- Notification sur la transition vers « accompli » (récompense à récupérer).
      IF (r.progress + v_inc) >= r.target THEN
        INSERT INTO orienta_notifications (user_id, type, payload)
        VALUES (p_user_id, 'quest_completed',
                jsonb_build_object('quest_id', r.quest_id, 'scope', r.scope));
      END IF;
    END IF;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_quest_progress(uuid, boolean, int, int, boolean, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- ── claim_quest_reward : crédite la récompense (jetons) une seule fois ──
-- Bascule claimed_at de façon atomique (gate completed_at non-null & claimed_at
-- null) puis crédite les jetons (+ XP individuel si un jour > 0). Un 2e claim ne
-- fait rien. Renvoie le détail + le nouveau solde de jetons.
CREATE OR REPLACE FUNCTION public.claim_quest_reward(
  p_user_id uuid, p_progress_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quest_id uuid;
  v_reward_jetons int;
  v_reward_xp int;
  v_jetons int;
BEGIN
  -- Réclame atomiquement : seule la 1re requête qui bascule claimed_at gagne.
  UPDATE orienta_quest_progress
    SET claimed_at = now()
    WHERE id = p_progress_id AND user_id = p_user_id
      AND completed_at IS NOT NULL AND claimed_at IS NULL
    RETURNING quest_id INTO v_quest_id;

  IF NOT FOUND THEN
    SELECT jetons INTO v_jetons FROM orienta_users WHERE id = p_user_id;
    RETURN jsonb_build_object('claimed', false, 'reward_jetons', 0, 'reward_xp', 0,
                              'jetons', COALESCE(v_jetons, 0));
  END IF;

  SELECT reward_jetons, reward_xp INTO v_reward_jetons, v_reward_xp
  FROM orienta_quests WHERE id = v_quest_id;
  v_reward_jetons := COALESCE(v_reward_jetons, 0);
  v_reward_xp := COALESCE(v_reward_xp, 0);

  UPDATE orienta_users SET jetons = jetons + v_reward_jetons WHERE id = p_user_id
    RETURNING jetons INTO v_jetons;

  -- XP individuel optionnel (réserve : 0 aujourd'hui). Pas de collectif pour les quêtes.
  IF v_reward_xp > 0 THEN
    UPDATE orienta_users SET xp = xp + v_reward_xp WHERE id = p_user_id;
    PERFORM recalculate_user_level(p_user_id);
  END IF;

  RETURN jsonb_build_object('claimed', true, 'reward_jetons', v_reward_jetons,
                            'reward_xp', v_reward_xp, 'jetons', v_jetons);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_quest_reward(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
