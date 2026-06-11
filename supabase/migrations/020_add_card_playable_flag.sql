-- 020 — Flag « playable » sur les cartes
-- Permet de retirer une carte du TIRAGE de création (joueur + réserve admin)
-- sans la supprimer, donc sans casser les grilles déjà jouées qui la référencent
-- (la FK orienta_grid_cards.card_id empêche la suppression de telles cartes).
--
-- Seuls les tirages aléatoires filtrent sur ce flag :
--   • src/pages/create/CreatePage.jsx        (tirage joueur)
--   • src/pages/admin/DailyAdminPage.jsx     (tirage réserve admin)
-- Les grilles existantes restent jouables/rejouables (elles chargent les cartes
-- par id, sans filtre).

ALTER TABLE orienta_word_cards
  ADD COLUMN IF NOT EXISTS playable boolean NOT NULL DEFAULT true;

-- Cartes au vocabulaire trop difficile, mais verrouillées par des grilles déjà
-- jouées (impossible à supprimer) → on les sort du tirage.
UPDATE orienta_word_cards SET playable = false WHERE id IN (
  '4e8729e7-7cef-4107-a490-d0293eec705a', -- toucan · physalis · malléole · tailleur
  'd7faf89b-cf7f-4699-b74a-c5e0f4654cf6', -- lynx · épeautre · tympan · pompiste
  '8512eebc-14d1-42db-868d-a226f634b8a3', -- okapi · tapioca · scapula · ostéopathe
  '2bb008c7-0452-409f-820f-5e4585891948', -- suricate · boulgour · sacrum · sage-femme
  '1b503db3-640c-470a-8275-47e296efa99d', -- narval · fenugrec · luette · directeur
  '759a15df-fb84-43ee-820e-c3f8133c041d', -- wombat · tempeh · moissonneuse · zoologiste
  '70b6fbf3-c65b-434e-9f21-3b1e98e29199'  -- kinkajou · edamame · citerne · entomologiste
);
