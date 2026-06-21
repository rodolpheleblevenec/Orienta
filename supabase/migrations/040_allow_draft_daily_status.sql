-- Les grilles générées par l'IA sont insérées en brouillon avec
-- daily_status='draft' (piste explicite, hors réserve jouable et invisible joueur).
-- La contrainte d'origine (016) n'autorisait que reserve/scheduled/published →
-- on ajoute 'draft'. Idempotent (drop if exists puis recreate).
alter table orienta_grids drop constraint if exists orienta_grids_daily_status_check;
alter table orienta_grids
  add constraint orienta_grids_daily_status_check
  check (daily_status is null or daily_status in ('reserve', 'scheduled', 'published', 'draft'));
