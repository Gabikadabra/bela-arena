-- Bela Arena realtime tablice
-- Pokreni u Supabase SQL Editoru ako želiš live update bez refreshanja stranice.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_games'
  ) then
    alter publication supabase_realtime add table public.match_games;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_sets'
  ) then
    alter publication supabase_realtime add table public.match_sets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'group_standings'
  ) then
    alter publication supabase_realtime add table public.group_standings;
  end if;
end $$;
