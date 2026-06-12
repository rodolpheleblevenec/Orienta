-- 031_wheel.sql
-- Roue de la fortune — dépense des jetons pour un tirage aléatoire :
--   rien / petits gains / gros gains (jetons, protège-série, création en plus).
--
-- Hasard 100 % CÔTÉ SERVEUR (anti-triche) : la RPC spin_wheel débite, tire un
-- segment pondéré (random()), applique la récompense et renvoie le segment gagné.
-- Le client se contente d'animer la roue pour s'arrêter sur ce segment.
-- Segments paramétrables en base (poids/lots/couleurs) → tunables sans redéploiement.
--
-- RPC SECURITY DEFINER + REVOKE anon/authenticated (pattern boutique).

-- ── Segments de la roue ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orienta_wheel_segments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idx          int  NOT NULL UNIQUE,            -- position sur la roue (0..N-1, sens horaire)
  label        text NOT NULL,
  reward_type  text NOT NULL CHECK (reward_type IN ('nothing','jetons','streak_freeze','create_slot')),
  reward_value int  NOT NULL DEFAULT 0,
  weight       int  NOT NULL DEFAULT 1 CHECK (weight > 0),
  color        text NOT NULL DEFAULT '#cccccc',
  active       boolean NOT NULL DEFAULT true
);

ALTER TABLE orienta_wheel_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wheel_segments_select" ON orienta_wheel_segments;
CREATE POLICY "wheel_segments_select" ON orienta_wheel_segments FOR SELECT TO public USING (true);

-- ── Seed : 8 segments (poids total 100). EV ≈ 17 jetons-équivalents / spin de 20. ──
INSERT INTO orienta_wheel_segments (idx, label, reward_type, reward_value, weight, color) VALUES
  (0, 'Rien',         'nothing',       0,  22, '#c7ccd4'),
  (1, '🪙 10',        'jetons',       10,  20, '#0a9e84'),
  (2, '🪙 25',        'jetons',       25,  14, '#d98a14'),
  (3, '🛡️ Protège',   'streak_freeze', 1,  10, '#3b82f6'),
  (4, '🪙 5',         'jetons',        5,  20, '#5ec5ad'),
  (5, '➕ Création',   'create_slot',   1,   6, '#22a06b'),
  (6, '🪙 50',        'jetons',       50,   6, '#f0603f'),
  (7, '💎 100',       'jetons',      100,   2, '#e8b84b')
ON CONFLICT (idx) DO NOTHING;

-- ── Article boutique : un tour de roue ───────────────────────────────
INSERT INTO orienta_shop_items (code, family, kind, cost_jetons, payload, title, description, sort_order) VALUES
  ('wheel_spin', 'social', 'action', 20, '{"effect":"spin"}', 'Roue de la fortune', 'Tente ta chance : rien, ou des gains de ouf !', 70)
ON CONFLICT (code) DO NOTHING;

-- ── RPC spin_wheel : débit + tirage pondéré serveur + application du lot ──
CREATE OR REPLACE FUNCTION public.spin_wheel(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cost int; v_bal int; v_total int; v_rand int; v_acc int := 0;
  seg record; v_picked orienta_wheel_segments%ROWTYPE;
BEGIN
  SELECT cost_jetons INTO v_cost FROM orienta_shop_items WHERE code = 'wheel_spin' AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'wheel_unavailable'); END IF;

  -- Débit atomique gardé.
  UPDATE orienta_users SET jetons = jetons - v_cost
    WHERE id = p_user_id AND jetons >= v_cost RETURNING jetons INTO v_bal;
  IF NOT FOUND THEN
    SELECT jetons INTO v_bal FROM orienta_users WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'jetons', COALESCE(v_bal, 0));
  END IF;

  -- Tirage pondéré (aléatoire serveur).
  SELECT sum(weight) INTO v_total FROM orienta_wheel_segments WHERE active;
  v_rand := floor(random() * v_total);
  FOR seg IN SELECT * FROM orienta_wheel_segments WHERE active ORDER BY idx LOOP
    v_acc := v_acc + seg.weight;
    IF v_rand < v_acc THEN v_picked := seg; EXIT; END IF;
  END LOOP;

  -- Application de la récompense.
  IF v_picked.reward_type = 'jetons' AND v_picked.reward_value > 0 THEN
    UPDATE orienta_users SET jetons = jetons + v_picked.reward_value WHERE id = p_user_id RETURNING jetons INTO v_bal;
  ELSIF v_picked.reward_type = 'streak_freeze' THEN
    UPDATE orienta_users SET streak_freeze_tokens = streak_freeze_tokens + v_picked.reward_value WHERE id = p_user_id;
  ELSIF v_picked.reward_type = 'create_slot' THEN
    UPDATE orienta_users SET extra_create_slots = extra_create_slots + v_picked.reward_value WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'jetons', v_bal,
    'segment', jsonb_build_object(
      'idx', v_picked.idx, 'label', v_picked.label,
      'reward_type', v_picked.reward_type, 'reward_value', v_picked.reward_value));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.spin_wheel(uuid) FROM PUBLIC, anon, authenticated;
