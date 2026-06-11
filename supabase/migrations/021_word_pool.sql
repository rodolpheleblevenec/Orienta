-- 021 — Pool de mots (nouvelle mécanique de composition des cartes)
--
-- Objectif : au lieu de piocher des cartes FIGÉES (toujours les mêmes 4 mots
-- ensemble), on tire des mots dans un pool et on COMPOSE les cartes à la volée
-- au moment de créer une grille. La carte composée est ensuite figée dans la
-- grille (orienta_word_cards + orienta_grid_cards) pour rester rejouable.
--
-- Coexistence : les anciennes grilles continuent de référencer leurs anciennes
-- cartes partagées, rien à migrer. Seul le TIRAGE change.
--
-- Les cartes composées sont insérées avec playable=false (par les Edge
-- Functions) : elles ne doivent JAMAIS repolluer un tirage (ni le pool de cartes
-- de l'admin, qui filtre playable=true). Elles ne portent que la solution.

-- ── Table pool ──
CREATE TABLE IF NOT EXISTS orienta_words (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text       text NOT NULL UNIQUE,
  playable   boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- ── RLS : lecture publique (comme orienta_word_cards), aucune écriture client ──
-- Le client lit le pool pour composer ses cartes ; les écritures (seed, curation)
-- passent par migration / service role uniquement.
ALTER TABLE orienta_words ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orienta_words' AND policyname = 'orienta_words_select'
  ) THEN
    CREATE POLICY orienta_words_select ON orienta_words FOR SELECT USING (true);
  END IF;
END $$;

-- ── Seed : reprise des mots existants ──
-- Tous les mots distincts des cartes actuelles deviennent le pool de départ
-- (le deck d'origine a des mots déjà uniques → ~1 172 mots). Idempotent.
-- Curation (désactiver quelques mots trop durs) = passe ultérieure.
DO $$
BEGIN
  IF to_regclass('public.orienta_word_cards') IS NOT NULL THEN
    INSERT INTO orienta_words (text)
    SELECT DISTINCT lower(btrim(w)) AS text
    FROM orienta_word_cards c
    CROSS JOIN LATERAL (VALUES (c.word_top), (c.word_right), (c.word_bottom), (c.word_left)) AS v(w)
    WHERE w IS NOT NULL AND btrim(w) <> ''
    ON CONFLICT (text) DO NOTHING;
  END IF;
END $$;
