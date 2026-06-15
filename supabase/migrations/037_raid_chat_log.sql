-- 037_raid_chat_log.sql
-- Journal du tchat d'équipage (audit / observation UX par l'admin).
--
-- Le tchat du RAID est diffusé en temps réel via Supabase Broadcast (instantané,
-- non persistant) — une fois la session terminée, les messages sont perdus.
-- Pour que l'admin puisse RELIRE comment une équipe s'est coordonnée (et améliorer
-- l'UX), on persiste désormais chaque message ici, en plus du broadcast.
--
-- Sécurité (cf. orienta_raid_session_secrets) : RLS activé SANS policy SELECT →
-- table invisible au client. Seul le service_role (Edge Function `raid`) écrit
-- (action `chat`, en fire-and-forget depuis le client) et lit (action
-- `admin-raid-detail`, réservée à l'admin). Le tchat n'est donc lisible que par
-- l'admin via l'Edge Function — jamais exposé aux autres joueurs.

CREATE TABLE IF NOT EXISTS orienta_raid_chat (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES orienta_raid_sessions(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES orienta_users(id) ON DELETE SET NULL,
  pseudo     text,                                   -- copié à l'envoi (affichage sans jointure)
  role       text,                                   -- organe au moment du message (null en lobby)
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raid_chat_session_idx
  ON orienta_raid_chat(session_id, created_at);

ALTER TABLE orienta_raid_chat ENABLE ROW LEVEL SECURITY;
-- Pas de policy → table invisible au client (anon/authenticated). Service_role seul.
