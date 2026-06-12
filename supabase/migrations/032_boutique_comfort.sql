-- 032_boutique_comfort.sql
-- Boutique jetons — lot « confort & vitrine ».
--   • Retire « Toutes difficultés » (inutile) + le titre de flair (remplacé par le statut perso).
--   • Nouveaux cosmétiques : cadres laurier/couronne, thèmes d'interface, statut perso.
--   • Nouveau confort : jeton de renommage (changer son pseudo, avec garde-fous).
--
-- Les cadres + couleur de pseudo + statut s'affichent désormais UNIQUEMENT dans la
-- bulle « joueurs en ligne » (vitrine vue par tous). Cf. front OnlinePlayersPanel.
--
-- Sécurité (cf. mémoire project_security_definer_grants) : recréer une RPC SECURITY
-- DEFINER réaccorde EXECUTE à PUBLIC → on re-REVOKE anon/authenticated après chaque.

-- ── Colonnes joueur ──────────────────────────────────────────────────
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS equipped_theme text;
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS status_text    text;
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS rename_tokens  int NOT NULL DEFAULT 0;

-- ── Articles retirés (conservés en base, simplement désactivés → invisibles) ──
--   • unlock_all_difficulties : inutile
--   • title_explorer          : remplacé par le statut perso
--   • boost_grid              : on retire la mécanique « payer pour mettre en avant »
UPDATE orienta_shop_items SET active = false
  WHERE code IN ('unlock_all_difficulties', 'title_explorer', 'boost_grid');

-- ── Nouveaux articles (PRIX = placeholders à calibrer) ───────────────
INSERT INTO orienta_shop_items (code, family, kind, cost_jetons, payload, title, description, sort_order) VALUES
  -- Cadres (vitrine « En ligne »)
  ('frame_laurel',  'cosmetic',   'unlock',     120, '{"slot":"frame","value":"laurel"}', 'Cadre laurier',  'Une couronne de laurier dorée enlace ton avatar.',   22),
  ('frame_crown',   'cosmetic',   'unlock',     150, '{"slot":"frame","value":"crown"}',  'Cadre couronne', 'Une couronne royale posée sur ton avatar.',          23),
  -- Thèmes d'interface (équipés via slot=theme → colonne equipped_theme)
  ('theme_ocean',   'cosmetic',   'unlock',     100, '{"slot":"theme","value":"ocean"}',  'Thème Océan nuit', 'Habille toute l''appli d''un bleu nuit profond.',  60),
  ('theme_coral',   'cosmetic',   'unlock',     100, '{"slot":"theme","value":"coral"}',  'Thème Corail',     'Une ambiance chaude corail & sable.',              61),
  ('theme_abyss',   'cosmetic',   'unlock',     130, '{"slot":"theme","value":"abyss"}',  'Thème Abysse',     'Le mode sombre des grands fonds.',                 62),
  -- Statut / humeur perso (unlock → débloque l'éditeur ; texte libre ensuite)
  ('status_custom', 'cosmetic',   'unlock',      70, '{"feature":"status"}',              'Statut perso',     'Affiche une petite humeur près de ton pseudo (bulle « En ligne »).', 36),
  -- Renommage (consommable → compteur rename_tokens)
  ('rename_token',  'convenience','consumable',  90, '{"counter":"rename_tokens","amount":1}', 'Jeton de renommage', 'Change ton pseudo une fois.',                  12)
ON CONFLICT (code) DO NOTHING;

-- ── purchase_item : ajoute le compteur rename_tokens à la whitelist ──
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
    IF v_counter NOT IN ('streak_freeze_tokens', 'extra_create_slots', 'rename_tokens') THEN
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
    ELSIF v_counter = 'rename_tokens' THEN
      UPDATE orienta_users SET rename_tokens = rename_tokens + v_amount WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'kind', v_kind, 'jetons', v_bal, 'item_code', p_item_code);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purchase_item(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── equip_unlock : ajoute le slot « theme » (colonne equipped_theme) ──
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
      equipped_victory = CASE WHEN v_slot = 'victory' THEN v_value ELSE equipped_victory END,
      equipped_theme   = CASE WHEN v_slot = 'theme'   THEN v_value ELSE equipped_theme   END
      WHERE id = p_user_id;
  ELSE
    UPDATE orienta_user_unlocks SET equipped = false
      WHERE user_id = p_user_id AND item_code = p_item_code;
    UPDATE orienta_users SET
      equipped_frame   = CASE WHEN v_slot = 'frame'   THEN NULL ELSE equipped_frame   END,
      equipped_color   = CASE WHEN v_slot = 'color'   THEN NULL ELSE equipped_color   END,
      equipped_title   = CASE WHEN v_slot = 'title'   THEN NULL ELSE equipped_title   END,
      equipped_victory = CASE WHEN v_slot = 'victory' THEN NULL ELSE equipped_victory END,
      equipped_theme   = CASE WHEN v_slot = 'theme'   THEN NULL ELSE equipped_theme   END
      WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'slot', v_slot, 'equipped', p_equip);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.equip_unlock(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- ── rename_user : change le pseudo (consomme 1 jeton de renommage) ───
-- Garde-fous : longueur 2..24, caractères autorisés, pseudo non réservé, non pris
-- (insensible à la casse, hors soi-même). En cas de course (unique_violation) la
-- transaction interne est annulée → le jeton n'est pas consommé.
CREATE OR REPLACE FUNCTION public.rename_user(p_user_id uuid, p_new_pseudo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clean text; v_dummy boolean;
BEGIN
  v_clean := btrim(COALESCE(p_new_pseudo, ''));
  IF length(v_clean) < 2 OR length(v_clean) > 24 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_length');
  END IF;
  IF v_clean !~ '^[[:alnum:]À-ÿ ''-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_chars');
  END IF;
  IF lower(v_clean) = 'orienta' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reserved');
  END IF;

  PERFORM 1 FROM orienta_users
    WHERE lower(pseudo) = lower(v_clean) AND id <> p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'taken');
  END IF;

  -- Consomme un jeton (gardé). NOT FOUND = aucun jeton.
  UPDATE orienta_users SET rename_tokens = rename_tokens - 1
    WHERE id = p_user_id AND rename_tokens > 0
    RETURNING true INTO v_dummy;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_token');
  END IF;

  UPDATE orienta_users SET pseudo = v_clean WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'pseudo', v_clean);
EXCEPTION WHEN unique_violation THEN
  -- Course : un autre joueur a pris ce pseudo entre le contrôle et l'update.
  -- L'exception annule les écritures de ce bloc (jeton non consommé).
  RETURN jsonb_build_object('ok', false, 'error', 'taken');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rename_user(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── set_user_status : pose/efface le statut perso (exige l'unlock) ───
CREATE OR REPLACE FUNCTION public.set_user_status(p_user_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_owned boolean; v_clean text;
BEGIN
  SELECT true INTO v_owned FROM orienta_user_unlocks
    WHERE user_id = p_user_id AND item_code = 'status_custom';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_owned'); END IF;

  v_clean := NULLIF(btrim(COALESCE(p_status, '')), '');
  IF v_clean IS NOT NULL THEN v_clean := left(v_clean, 40); END IF;

  UPDATE orienta_users SET status_text = v_clean WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'status', v_clean);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_user_status(uuid, text) FROM PUBLIC, anon, authenticated;
