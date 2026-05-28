-- Bela Arena - TV dashboard i statusi meča
-- Pokreni jednom u Supabase SQL Editoru.
-- Dodaje opcionalna polja koja dashboard zna prikazati.

alter table public.matches
  add column if not exists result_status text not null default 'draft',
  add column if not exists table_number integer,
  add column if not exists admin_note text;

create index if not exists matches_tournament_result_status_idx
  on public.matches(tournament_id, result_status);

create index if not exists matches_tournament_table_number_idx
  on public.matches(tournament_id, table_number);

-- Dopuštene vrijednosti koje aplikacija može koristiti:
-- draft = rezultat još nije poslan
-- submitted = rezultat je upisan i čeka potvrdu/admin pregled
-- confirmed = rezultat potvrđen
-- disputed = sporan rezultat
-- no_show = ekipa se nije pojavila

alter table public.matches replica identity full;

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
end $$;
