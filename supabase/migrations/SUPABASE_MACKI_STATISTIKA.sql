-- Bela Arena: Mački u unosu rezultata i statistici
-- Mački = jedna ekipa uzme sve štihove: štihovi 162:0 i +90 zvanja.

alter table if exists public.match_games
  add column if not exists team_a_macki boolean not null default false,
  add column if not exists team_b_macki boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_games'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'match_games_only_one_macki_check'
  ) then
    alter table public.match_games
      add constraint match_games_only_one_macki_check
      check (not (team_a_macki and team_b_macki));
  end if;
end $$;

alter table if exists public.team_ranking_stats
  add column if not exists macki_count integer not null default 0;
