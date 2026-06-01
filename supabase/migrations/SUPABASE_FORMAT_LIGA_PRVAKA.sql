-- Bela Arena: novi format Liga prvaka + dodatne postavke turnira
-- Pokreni u Supabase SQL Editoru prije deploya ako ove kolone još nemaš.

alter table public.tournaments
  add column if not exists group_size integer,
  add column if not exists knockout_size integer,
  add column if not exists league_rounds integer not null default 1;

update public.tournaments
set
  group_size = coalesce(group_size, 4),
  knockout_size = coalesce(knockout_size, 16),
  league_rounds = coalesce(league_rounds, 1)
where tournament_format in ('groups_knockout', 'league_knockout', 'round_robin');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_group_size_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_group_size_check
    check (group_size is null or group_size between 2 and 8);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_knockout_size_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_knockout_size_check
    check (knockout_size is null or knockout_size in (2, 4, 8, 16, 32, 64));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_league_rounds_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_league_rounds_check
    check (league_rounds in (1, 2));
  end if;
end $$;
