-- Bela Arena: Liga prvaka format - broj mečeva po ekipi u liga fazi
-- Pokreni u Supabase SQL Editoru ako kolona još ne postoji.

alter table public.tournaments
  add column if not exists league_match_count integer;

update public.tournaments
set league_match_count = coalesce(league_match_count, 8)
where tournament_format = 'league_knockout';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_league_match_count_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_league_match_count_check
    check (league_match_count is null or league_match_count between 1 and 16);
  end if;
end $$;
