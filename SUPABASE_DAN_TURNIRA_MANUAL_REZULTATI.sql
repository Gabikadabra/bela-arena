-- Bela Arena: admin dodavanje ekipe na dan turnira + manualni rezultati + završetak turnira

alter table public.tournaments
  add column if not exists manual_score_entry boolean not null default false,
  add column if not exists finished_at timestamp with time zone;

alter table public.teams
  add column if not exists created_by_admin boolean not null default false,
  add column if not exists captain_user_id uuid,
  add column if not exists player_one text,
  add column if not exists player_two text,
  add column if not exists partner_email text,
  add column if not exists partner_user_id uuid,
  add column if not exists invite_status text not null default 'pending';

alter table public.teams
  alter column partner_email drop not null;

alter table public.matches
  add column if not exists sets_a integer not null default 0,
  add column if not exists sets_b integer not null default 0,
  add column if not exists result_status text not null default 'draft',
  add column if not exists finished_at timestamp with time zone;

-- Pusti statuse koje aplikacija koristi: draft/open/live/finished/closed za turnire,
-- pending/approved/rejected za ekipe, scheduled/waiting/active/live/finished za mečeve.
-- Ako imaš stare CHECK constraintove koji blokiraju ove statuse, makni ih ručno ili javi grešku koju Supabase izbaci.

alter table public.tournaments replica identity full;
alter table public.teams replica identity full;
alter table public.matches replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tournaments'
    ) then
      alter publication supabase_realtime add table public.tournaments;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'teams'
    ) then
      alter publication supabase_realtime add table public.teams;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'matches'
    ) then
      alter publication supabase_realtime add table public.matches;
    end if;
  end if;
end $$;
