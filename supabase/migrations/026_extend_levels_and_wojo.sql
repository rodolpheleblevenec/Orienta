-- 024 — Extension des niveaux + annonce « nouveaux compagnons »
--
-- Contexte : les joueurs et le collectif approchent du niveau max (10).
--   • Niveaux individuels : 10 → 15  (paliers ajoutés : 13000, 21000, 33000, 52000, 80000)
--   • Niveaux collectifs   : 10 → 20  (×10 du perso pour 11–15, puis ~×1,6 jusqu'à 20)
-- Miroir des seuils côté front : src/lib/levels.js (LEVELS / LEVELS_COLLECTIVE).
--
-- Les deux fonctions ci-dessous reprennent À L'IDENTIQUE la structure live
-- (CASE, SECURITY DEFINER, SET search_path='public'). Les SIGNATURES sont
-- inchangées → CREATE OR REPLACE PRÉSERVE les privilèges existants : aucun
-- re-REVOKE anon/authenticated n'est nécessaire (le piège ne concerne que les
-- changements de signature).

-- ── 1) Niveau individuel : 15 paliers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_user_level(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_xp int;
  v_new_level int;
BEGIN
  SELECT xp INTO v_xp FROM orienta_users WHERE id = p_user_id;

  -- Seuils : 0,50,130,260,500,900,1600,2800,4800,8000,13000,21000,33000,52000,80000
  v_new_level := CASE
    WHEN v_xp >= 80000 THEN 15
    WHEN v_xp >= 52000 THEN 14
    WHEN v_xp >= 33000 THEN 13
    WHEN v_xp >= 21000 THEN 12
    WHEN v_xp >= 13000 THEN 11
    WHEN v_xp >= 8000  THEN 10
    WHEN v_xp >= 4800  THEN 9
    WHEN v_xp >= 2800  THEN 8
    WHEN v_xp >= 1600  THEN 7
    WHEN v_xp >= 900   THEN 6
    WHEN v_xp >= 500   THEN 5
    WHEN v_xp >= 260   THEN 4
    WHEN v_xp >= 130   THEN 3
    WHEN v_xp >= 50    THEN 2
    ELSE 1
  END;

  UPDATE orienta_users SET level = v_new_level WHERE id = p_user_id;
  RETURN v_new_level;
END;
$function$;

-- ── 2) Niveau collectif : 20 paliers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_collective_level()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_xp int;
  v_new_level int;
BEGIN
  SELECT total_xp INTO v_xp FROM orienta_collective_progress WHERE id = 1;

  -- Seuils : 0,500,1300,2600,5000,9000,16000,28000,48000,80000,
  --          130000,210000,330000,520000,800000,1250000,2000000,3200000,5000000,8000000
  v_new_level := CASE
    WHEN v_xp >= 8000000 THEN 20
    WHEN v_xp >= 5000000 THEN 19
    WHEN v_xp >= 3200000 THEN 18
    WHEN v_xp >= 2000000 THEN 17
    WHEN v_xp >= 1250000 THEN 16
    WHEN v_xp >= 800000  THEN 15
    WHEN v_xp >= 520000  THEN 14
    WHEN v_xp >= 330000  THEN 13
    WHEN v_xp >= 210000  THEN 12
    WHEN v_xp >= 130000  THEN 11
    WHEN v_xp >= 80000   THEN 10
    WHEN v_xp >= 48000   THEN 9
    WHEN v_xp >= 28000   THEN 8
    WHEN v_xp >= 16000   THEN 7
    WHEN v_xp >= 9000    THEN 6
    WHEN v_xp >= 5000    THEN 5
    WHEN v_xp >= 2600    THEN 4
    WHEN v_xp >= 1300    THEN 3
    WHEN v_xp >= 500     THEN 2
    ELSE 1
  END;

  UPDATE orienta_collective_progress SET level = v_new_level WHERE id = 1;
  RETURN v_new_level;
END;
$function$;

-- ── 3) Flag « modale nouveaux compagnons vue » ─────────────────────────────
-- ADD sans default → les lignes existantes valent NULL ;
-- backfill à false → les joueurs DÉJÀ inscrits voient la modale une fois ;
-- DEFAULT true ensuite → les futurs inscrits ne la voient jamais ;
-- puis NOT NULL.
ALTER TABLE orienta_users ADD COLUMN IF NOT EXISTS new_wojo_seen boolean;
UPDATE orienta_users SET new_wojo_seen = false WHERE new_wojo_seen IS NULL;
-- Les comptes système (ex. « Orienta ») ne se connectent pas : pas d'annonce.
UPDATE orienta_users SET new_wojo_seen = true WHERE is_system = true;
ALTER TABLE orienta_users ALTER COLUMN new_wojo_seen SET DEFAULT true;
ALTER TABLE orienta_users ALTER COLUMN new_wojo_seen SET NOT NULL;

-- ── 4) Recalcul one-shot ───────────────────────────────────────────────────
-- Les nouveaux seuils sont au-dessus de l'ancien max : personne ne « saute »
-- de niveau. C'est de l'hygiène (cohérence level ⇄ xp) et ça prépare le terrain.
SELECT recalculate_user_level(id) FROM orienta_users WHERE coalesce(is_system, false) = false;
SELECT recalculate_collective_level();
