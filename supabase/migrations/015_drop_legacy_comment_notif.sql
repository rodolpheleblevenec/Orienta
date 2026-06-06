-- ════════════════════════════════════════════════════════════════
-- 015 — Décommissionne l'ancienne notif 'comment' (doublons)
-- ----------------------------------------------------------------
-- Avant la refacto sécurité, les notifs 'comment' étaient créées par
-- un trigger DB (trg_notify_comment → notify_creator_on_comment) sur
-- AFTER UPDATE OF comment de orienta_plays.
-- L'écriture des commentaires est désormais centralisée dans l'Edge
-- Function `social` (action `comment`), qui insère elle-même la notif.
-- Le trigger n'avait jamais été retiré → CHAQUE commentaire générait
-- 2 notifications identiques. On supprime l'ancien mécanisme.
-- ════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_notify_comment ON orienta_plays;
DROP FUNCTION IF EXISTS notify_creator_on_comment();

-- Nettoyage des doublons déjà en base : pour chaque (destinataire, grille,
-- texte de commentaire), on ne garde que la notification la plus ancienne.
DELETE FROM orienta_notifications a
USING orienta_notifications b
WHERE a.type = 'comment'
  AND b.type = 'comment'
  AND a.user_id = b.user_id
  AND a.payload->>'grid_id' IS NOT DISTINCT FROM b.payload->>'grid_id'
  AND a.payload->>'comment' IS NOT DISTINCT FROM b.payload->>'comment'
  AND a.created_at > b.created_at;
