-- 018 — Verrouille les droits d'exécution de award_xp_on_play
--
-- La migration 017 a recréé award_xp_on_play avec une NOUVELLE signature
-- (ajout de p_attempt_bonus). PostgreSQL accorde EXECUTE à PUBLIC par défaut
-- sur toute fonction nouvellement créée : la nouvelle surcharge était donc
-- appelable par les rôles `anon` et `authenticated` via /rest/v1/rpc/...,
-- permettant à un client de s'attribuer de l'XP arbitraire (la faille même que
-- le modèle « autorité unique côté serveur » ferme).
--
-- On rétablit le pattern des autres fonctions SECURITY DEFINER du projet
-- (add_user_xp, recalculate_*) : seuls `postgres` et `service_role` peuvent
-- l'exécuter. L'Edge Function check-attempt l'appelle via la service role key.
REVOKE EXECUTE ON FUNCTION public.award_xp_on_play(uuid, uuid, boolean, integer, integer)
  FROM PUBLIC, anon, authenticated;
