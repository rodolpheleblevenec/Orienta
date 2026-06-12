-- 028_boutique.sql
-- Boutique jetons — Phase 1 : moteur d'achat + cosmétiques + protège-série.
--
-- Donne un débouché aux jetons (gagnés via les quêtes, jusqu'ici sans dépense).
-- Un seul catalogue (orienta_shop_items) décrit chaque article via family + kind
-- + payload ; la possession permanente vit dans orienta_user_unlocks ; les effets
-- consommables incrémentent des compteurs dédiés sur orienta_users. Ajouter un
-- article = insérer une ligne catalogue (pas de migration).
--
-- PAS de pay-to-win : cosmétiques (cadres d'avatar, couleur/titre de classement)
-- + confort (protège-série). Les skins restent débloqués par l'XP (non vendus).
--
-- Sécurité (cf. mémoire project_security_definer_grants / project_security_rls) :
--   - RLS : SELECT public, AUCUNE policy d'écriture → écritures réservées au
--     service_role (Edge Function `shop`).
--   - Dépense = RPC SECURITY DEFINER + débit atomique gardé + REVOKE EXECUTE à
--     anon/authenticated (même pattern que claim_quest_reward en 025).

-- ── Colonnes joueur : cosmétiques équipés + compteurs consommables ───
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS equipped_frame       text;
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS equipped_title       text;
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS equipped_color       text;
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS equipped_victory     text;   -- réserve (Phase 3)
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS streak_freeze_tokens int NOT NULL DEFAULT 0;
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS extra_create_slots   int NOT NULL DEFAULT 0;   -- réserve (Phase 2)

-- ── Catalogue des articles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orienta_shop_items (
  code        text PRIMARY KEY,
  family      text NOT NULL CHECK (family IN ('cosmetic','convenience','social')),
  kind        text NOT NULL CHECK (kind IN ('unlock','consumable','action')),
  cost_jetons int  NOT NULL CHECK (cost_jetons >= 0),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- unlock     : {"slot":"frame|color|title|victory","value":"..."}
  -- consumable : {"counter":"streak_freeze_tokens|extra_create_slots","amount":1}
  -- action     : {"effect":"boost|gift"}   (Phase 3)
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Possession permanente (unlocks) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS orienta_user_unlocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES orienta_users(id) ON DELETE CASCADE,
  item_code   text NOT NULL REFERENCES orienta_shop_items(code) ON DELETE CASCADE,
  equipped    boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_code)        -- empêche le double-achat
);
CREATE INDEX IF NOT EXISTS user_unlocks_lookup ON orienta_user_unlocks (user_id);

-- ── RLS : lecture publique, écriture service_role uniquement ─────────
ALTER TABLE orienta_shop_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orienta_user_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_items_select"   ON orienta_shop_items;
DROP POLICY IF EXISTS "user_unlocks_select" ON orienta_user_unlocks;
CREATE POLICY "shop_items_select"   ON orienta_shop_items   FOR SELECT TO public USING (true);
CREATE POLICY "user_unlocks_select" ON orienta_user_unlocks FOR SELECT TO public USING (true);
-- (aucune policy INSERT/UPDATE/DELETE → écritures réservées au service_role)

-- ── Seed du catalogue Phase 1 (PRIX = placeholders à calibrer) ───────
INSERT INTO orienta_shop_items (code, family, kind, cost_jetons, payload, title, description, sort_order) VALUES
  ('streak_freeze',  'convenience','consumable', 40, '{"counter":"streak_freeze_tokens","amount":1}', 'Protège-série',   'Sauve ta série si tu rates un jour.',            10),
  ('frame_gold',     'cosmetic',   'unlock',      80, '{"slot":"frame","value":"gold"}',              'Cadre or',        'Un anneau doré autour de ton avatar.',           20),
  ('frame_reef',     'cosmetic',   'unlock',      80, '{"slot":"frame","value":"reef"}',              'Cadre récif',     'Un anneau corail lumineux autour de ton avatar.',21),
  ('color_coral',    'cosmetic',   'unlock',      40, '{"slot":"color","value":"#f0603f"}',           'Pseudo corail',   'Ton pseudo en corail dans le classement.',       30),
  ('color_aqua',     'cosmetic',   'unlock',      40, '{"slot":"color","value":"#0a9e84"}',           'Pseudo aqua',     'Ton pseudo en aqua dans le classement.',         31),
  ('title_explorer', 'cosmetic',   'unlock',      60, '{"slot":"title","value":"Explorateur"}',       'Titre Explorateur','Un titre affiché près de ton pseudo.',          40)
ON CONFLICT (code) DO NOTHING;

-- ── RPC purchase_item : achat unlock OU consommable (débit atomique) ─
-- Anti-double-débit : pour un unlock, on INSERT d'abord (ON CONFLICT DO NOTHING) ;
-- si déjà possédé → already_owned sans débit ; sinon débit ; si fonds insuffisants
-- → on retire la ligne et on renvoie l'erreur (pas de remboursement à gérer).
CREATE OR REPLACE FUNCTION public.purchase_item(p_user_id uuid, p_item_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text; v_cost int; v_payload jsonb; v_active boolean;
  v_counter text; v_amount int; v_ins int; v_bal int;
BEGIN
  SELECT kind, cost_jetons, payload, active
    INTO v_kind, v_cost, v_payload, v_active
    FROM orienta_shop_items WHERE code = p_item_code;
  IF NOT FOUND OR v_active = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_item');
  END IF;
  IF v_kind = 'action' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'use_dedicated_action');
  END IF;

  IF v_kind = 'unlock' THEN
    INSERT INTO orienta_user_unlocks (user_id, item_code)
      VALUES (p_user_id, p_item_code)
      ON CONFLICT (user_id, item_code) DO NOTHING;
    GET DIAGNOSTICS v_ins = ROW_COUNT;
    IF v_ins = 0 THEN
      SELECT jetons INTO v_bal FROM orienta_users WHERE id = p_user_id;
      RETURN jsonb_build_object('ok', true, 'already_owned', true,
                                'jetons', COALESCE(v_bal, 0), 'item_code', p_item_code);
    END IF;
  ELSIF v_kind = 'consumable' THEN
    v_counter := v_payload->>'counter';
    v_amount  := COALESCE((v_payload->>'amount')::int, 1);
    IF v_counter NOT IN ('streak_freeze_tokens', 'extra_create_slots') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'bad_counter');
    END IF;
  END IF;

  -- Débit atomique gardé : NOT FOUND = solde insuffisant.
  UPDATE orienta_users SET jetons = jetons - v_cost
    WHERE id = p_user_id AND jetons >= v_cost
    RETURNING jetons INTO v_bal;
  IF NOT FOUND THEN
    IF v_kind = 'unlock' THEN
      DELETE FROM orienta_user_unlocks WHERE user_id = p_user_id AND item_code = p_item_code;
    END IF;
    SELECT jetons INTO v_bal FROM orienta_users WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'jetons', COALESCE(v_bal, 0));
  END IF;

  -- Effet consommable (compteur whitelisté ci-dessus).
  IF v_kind = 'consumable' THEN
    IF v_counter = 'streak_freeze_tokens' THEN
      UPDATE orienta_users SET streak_freeze_tokens = streak_freeze_tokens + v_amount WHERE id = p_user_id;
    ELSIF v_counter = 'extra_create_slots' THEN
      UPDATE orienta_users SET extra_create_slots = extra_create_slots + v_amount WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'kind', v_kind, 'jetons', v_bal, 'item_code', p_item_code);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purchase_item(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── RPC equip_unlock : équipe/retire un cosmétique possédé ───────────
-- Les colonnes orienta_users.equipped_<slot> sont la source de vérité du rendu
-- (lues avec la row user, sans jointure). Un seul équipé par slot.
CREATE OR REPLACE FUNCTION public.equip_unlock(p_user_id uuid, p_item_code text, p_equip boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owned boolean;
  v_kind text; v_slot text; v_value text;
BEGIN
  SELECT true INTO v_owned FROM orienta_user_unlocks
    WHERE user_id = p_user_id AND item_code = p_item_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_owned'); END IF;

  SELECT kind, payload->>'slot', payload->>'value'
    INTO v_kind, v_slot, v_value
    FROM orienta_shop_items WHERE code = p_item_code;
  IF v_kind <> 'unlock' OR v_slot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_equippable');
  END IF;

  IF p_equip THEN
    -- Un seul équipé par slot : déséquiper les autres unlocks du même slot.
    UPDATE orienta_user_unlocks SET equipped = false
      WHERE user_id = p_user_id AND equipped = true
        AND item_code IN (SELECT code FROM orienta_shop_items WHERE payload->>'slot' = v_slot);
    UPDATE orienta_user_unlocks SET equipped = true
      WHERE user_id = p_user_id AND item_code = p_item_code;
    UPDATE orienta_users SET
      equipped_frame   = CASE WHEN v_slot = 'frame'   THEN v_value ELSE equipped_frame   END,
      equipped_color   = CASE WHEN v_slot = 'color'   THEN v_value ELSE equipped_color   END,
      equipped_title   = CASE WHEN v_slot = 'title'   THEN v_value ELSE equipped_title   END,
      equipped_victory = CASE WHEN v_slot = 'victory' THEN v_value ELSE equipped_victory END
      WHERE id = p_user_id;
  ELSE
    UPDATE orienta_user_unlocks SET equipped = false
      WHERE user_id = p_user_id AND item_code = p_item_code;
    UPDATE orienta_users SET
      equipped_frame   = CASE WHEN v_slot = 'frame'   THEN NULL ELSE equipped_frame   END,
      equipped_color   = CASE WHEN v_slot = 'color'   THEN NULL ELSE equipped_color   END,
      equipped_title   = CASE WHEN v_slot = 'title'   THEN NULL ELSE equipped_title   END,
      equipped_victory = CASE WHEN v_slot = 'victory' THEN NULL ELSE equipped_victory END
      WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'slot', v_slot, 'equipped', p_equip);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.equip_unlock(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- ── RPC consume_streak_freeze : consomme 1 jeton de protège-série ────
-- Appelée par check-attempt UNIQUEMENT quand un jour manqué casserait la série.
CREATE OR REPLACE FUNCTION public.consume_streak_freeze(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_used boolean;
BEGIN
  UPDATE orienta_users SET streak_freeze_tokens = streak_freeze_tokens - 1
    WHERE id = p_user_id AND streak_freeze_tokens > 0
    RETURNING true INTO v_used;
  RETURN COALESCE(v_used, false);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_streak_freeze(uuid) FROM PUBLIC, anon, authenticated;
