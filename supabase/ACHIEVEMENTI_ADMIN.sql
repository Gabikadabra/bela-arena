-- Bela Arena achievementi / admin medalje
-- Pokreni jednom u Supabase SQL Editoru.
-- Automatski achievementi se računaju u aplikaciji, a ova tablica sprema ručne admin titule.

create table if not exists public.team_manual_achievements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  achievement_key text not null,
  emoji text not null default '🏅',
  title text not null,
  description text not null,
  tone text not null default 'gold' check (tone in ('gold', 'green', 'blue', 'purple', 'red')),
  note text,
  awarded_by text default 'admin',
  created_at timestamptz not null default now(),
  unique (team_id, achievement_key)
);

create index if not exists team_manual_achievements_team_id_idx
  on public.team_manual_achievements(team_id);

create index if not exists team_manual_achievements_key_idx
  on public.team_manual_achievements(achievement_key);

create index if not exists team_manual_achievements_created_at_idx
  on public.team_manual_achievements(created_at);

alter table public.team_manual_achievements replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_manual_achievements'
  ) then
    alter publication supabase_realtime add table public.team_manual_achievements;
  end if;
end $$;
