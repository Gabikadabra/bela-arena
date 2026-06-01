-- Bela Arena realtime za sve glavne tablice
-- Pokreni u Supabase SQL Editoru.

create or replace function public.enable_bela_realtime_for_table(table_name text)
returns void
language plpgsql
as $$
begin
  -- Dodaj samo prave tablice/partitioned tablice, ne viewove.
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = table_name
      and c.relkind in ('r', 'p')
  ) then
    execute format('alter table public.%I replica identity full', table_name);

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end if;
end;
$$;

select public.enable_bela_realtime_for_table('tournaments');
select public.enable_bela_realtime_for_table('teams');
select public.enable_bela_realtime_for_table('team_members');
select public.enable_bela_realtime_for_table('matches');
select public.enable_bela_realtime_for_table('match_games');
select public.enable_bela_realtime_for_table('match_sets');
select public.enable_bela_realtime_for_table('group_standings');
select public.enable_bela_realtime_for_table('profiles');
select public.enable_bela_realtime_for_table('team_ranking_stats');

drop function public.enable_bela_realtime_for_table(text);
