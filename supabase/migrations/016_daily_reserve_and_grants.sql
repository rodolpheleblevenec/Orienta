-- 016 — Grille du jour communautaire : réserve admin (sans date) + droits de création (grants)
--
-- Contexte : on abandonne le modèle calendaire (generate-daily-grid + dates pré-remplies).
-- Désormais :
--   • Le vainqueur d'un jour J gagne le droit de créer la grille du jour de J+3 (table grants).
--   • L'admin maintient une RÉSERVE de grilles SANS date, ordonnée par priorité ; on y pioche
--     quand un gagnant ne crée pas sa grille à temps (repli), puis une grille d'archive en dernier recours.
--
-- Discriminant « piste quotidienne » : avant, daily_date != null ⟺ grille du jour.
-- La réserve étant SANS date, on introduit une colonne explicite daily_status :
--   NULL        = grille communautaire (comportement inchangé)
--   'reserve'   = pool admin, sans date (reserve_priority renseigné)
--   'scheduled' = datée à un jour futur (grille créée par un gagnant pour J+3)
--   'published' = grille du jour en ligne / passée (datée)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Colonnes sur orienta_grids
-- ─────────────────────────────────────────────────────────────────────────────
alter table orienta_grids
  add column if not exists daily_status    text,
  add column if not exists reserve_priority integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orienta_grids_daily_status_check'
  ) then
    alter table orienta_grids
      add constraint orienta_grids_daily_status_check
      check (daily_status is null or daily_status in ('reserve', 'scheduled', 'published'));
  end if;
end $$;

-- Pioche de la réserve : reserve_priority croissant (le plus petit en premier).
create index if not exists orienta_grids_reserve_idx
  on orienta_grids (reserve_priority)
  where daily_status = 'reserve';

-- Sélection rapide de la grille d'un jour.
create index if not exists orienta_grids_daily_date_idx
  on orienta_grids (daily_date)
  where daily_date is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill : classer l'existant
--    • grilles datées passées / du jour  → 'published'
--    • grilles datées futures            → 'reserve' (date retirée, priorité séquentielle)
--    • grilles communautaires (daily_date NULL d'origine) → restent daily_status NULL
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Passées / aujourd'hui : on garde la date, statut 'published'.
update orienta_grids
set daily_status = 'published'
where daily_date is not null
  and daily_date <= (now() at time zone 'Europe/Paris')::date
  and daily_status is null;

-- 2b. Futures : on les verse dans la réserve (sans date), priorité = ordre chronologique d'origine.
with future_grids as (
  select id,
         row_number() over (order by daily_date asc) as rn
  from orienta_grids
  where daily_date is not null
    and daily_date > (now() at time zone 'Europe/Paris')::date
)
update orienta_grids g
set daily_status     = 'reserve',
    reserve_priority = future_grids.rn,
    daily_date       = null
from future_grids
where g.id = future_grids.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Table des droits de création (grants)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists orienta_grid_grants (
  id                 uuid primary key default gen_random_uuid(),
  winner_user_id     uuid not null references orienta_users(id) on delete cascade,
  source_grid_id     uuid not null references orienta_grids(id) on delete cascade,
  source_date        date not null,
  target_date        date not null,
  status             text not null default 'pending'
                       check (status in ('pending', 'claimed', 'expired')),
  created_grid_id    uuid references orienta_grids(id) on delete set null,
  deadline           timestamptz not null,
  onboarding_seen_at timestamptz,
  created_at         timestamptz not null default now(),
  -- Idempotence de la finalisation : un seul grant par grille gagnée et par date cible.
  constraint orienta_grid_grants_source_grid_unique unique (source_grid_id),
  constraint orienta_grid_grants_target_date_unique unique (target_date)
);

create index if not exists orienta_grid_grants_winner_idx
  on orienta_grid_grants (winner_user_id, status);
create index if not exists orienta_grid_grants_status_idx
  on orienta_grid_grants (status, target_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS : lecture publique (hub / modale d'accompagnement), écriture service-role uniquement
--    (calqué sur orienta_grids / orienta_notifications : SELECT using(true), pas de policy d'écriture).
-- ─────────────────────────────────────────────────────────────────────────────
alter table orienta_grid_grants enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orienta_grid_grants'
      and policyname = 'orienta_grid_grants_select'
  ) then
    create policy orienta_grid_grants_select
      on orienta_grid_grants for select
      to public
      using (true);
  end if;
end $$;
