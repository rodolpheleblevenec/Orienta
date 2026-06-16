-- 038 — Chat général d'organisation (canal global, éphémère 10 min)
--
-- Un message = une ligne. Le live passe par Supabase Realtime broadcast sur le
-- canal stable 'orienta-general' (client→client). Cette table ne sert qu'à
-- l'historique au montage. ÉPHÉMÈRE : seules les 10 dernières minutes sont
-- servies, et les messages plus vieux sont purgés à chaque envoi (action post).
--
-- C'est le MÊME canal que le SAS (salle d'attente) du RAID — un canal général
-- d'organisation, surfacé à la fois dans la bulle flottante et dans le SAS.
--
-- Sécurité (cf. orienta_raid_chat) : RLS activé SANS policy → table invisible au
-- client (anon/authenticated). Lecture/écriture uniquement via l'Edge Function
-- `chat` (service_role).
create table if not exists orienta_chat (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references orienta_users(id) on delete set null,
  pseudo     text,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_orienta_chat_created on orienta_chat(created_at desc);

alter table orienta_chat enable row level security;
-- Pas de policy → service_role uniquement (Edge Function).
