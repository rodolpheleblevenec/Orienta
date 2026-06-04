-- 013_admin_stats.sql
-- Suivi des connexions joueurs pour les statistiques admin.
--
-- Une ligne par (joueur, jour) : enregistre qu'un joueur a ouvert l'app ce
-- jour-là. Alimentée par l'Edge Function `account` (action `seen`), en
-- service_role uniquement. RLS activé sans policy anon → table invisible au
-- client (cohérent avec le reste de l'archi sécurisée).

create table if not exists orienta_daily_active (
  user_id      uuid not null references orienta_users(id) on delete cascade,
  active_date  date not null,
  first_seen_at timestamp without time zone not null default now(),
  primary key (user_id, active_date)
);

create index if not exists orienta_daily_active_date_idx on orienta_daily_active (active_date);

alter table orienta_daily_active enable row level security;
-- Pas de policy : seul le service_role (Edge Functions) lit/écrit.

-- ── Backfill historique ──
-- On reconstitue les jours d'activité passés à partir des parties lancées
-- (orienta_plays.started_at), pour que les graphes ne démarrent pas vides.
insert into orienta_daily_active (user_id, active_date, first_seen_at)
select player_id, started_at::date, min(started_at)
from orienta_plays
where player_id is not null and started_at is not null
group by player_id, started_at::date
on conflict (user_id, active_date) do nothing;
