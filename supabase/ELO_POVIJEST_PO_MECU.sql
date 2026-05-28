-- Bela Arena ELO povijest po meču
-- Pokreni jednom u Supabase SQL Editoru.
-- Ovo sprema ELO prije i poslije svake završene utakmice za obje ekipe.

create table if not exists public.team_elo_history (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  opponent_team_id uuid references public.teams(id) on delete cascade,
  team_elo_before integer not null default 1000,
  opponent_elo_before integer not null default 1000,
  expected_score numeric not null default 0,
  result numeric not null default 0,
  score_for integer not null default 0,
  score_against integer not null default 0,
  elo_change integer not null default 0,
  team_elo_after integer not null default 1000,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create index if not exists team_elo_history_team_id_idx
  on public.team_elo_history(team_id);

create index if not exists team_elo_history_tournament_id_idx
  on public.team_elo_history(tournament_id);

create index if not exists team_elo_history_played_at_idx
  on public.team_elo_history(played_at);

create or replace function public.bela_expected_score(team_elo numeric, opponent_elo numeric)
returns numeric
language sql
immutable
as $$
  select 1 / (1 + power(10, (opponent_elo - team_elo) / 400));
$$;

create or replace function public.bela_points_bonus(score_for numeric, score_against numeric)
returns numeric
language sql
immutable
as $$
  select greatest(-6, least(6, (coalesce(score_for, 0) - coalesce(score_against, 0)) / 50));
$$;

create or replace function public.rebuild_team_elo_history()
returns void
language plpgsql
as $$
declare
  match_row record;
  elo_a numeric;
  elo_b numeric;
  expected_a numeric;
  expected_b numeric;
  result_a numeric;
  result_b numeric;
  change_a integer;
  change_b integer;
begin
  delete from public.team_elo_history;

  create temp table if not exists tmp_bela_elo (
    team_id uuid primary key,
    elo numeric not null
  ) on commit drop;

  truncate tmp_bela_elo;

  for match_row in
    select *
    from public.matches
    where status = 'finished'
      and winner_id is not null
      and team_a_id is not null
      and team_b_id is not null
    order by coalesce(finished_at, updated_at, created_at), created_at, id
  loop
    insert into tmp_bela_elo(team_id, elo)
    values (match_row.team_a_id, 1000), (match_row.team_b_id, 1000)
    on conflict (team_id) do nothing;

    select elo into elo_a from tmp_bela_elo where team_id = match_row.team_a_id;
    select elo into elo_b from tmp_bela_elo where team_id = match_row.team_b_id;

    result_a := case when match_row.winner_id = match_row.team_a_id then 1 else 0 end;
    result_b := case when match_row.winner_id = match_row.team_b_id then 1 else 0 end;
    expected_a := public.bela_expected_score(elo_a, elo_b);
    expected_b := public.bela_expected_score(elo_b, elo_a);

    change_a := round(32 * (result_a - expected_a) + public.bela_points_bonus(match_row.score_a, match_row.score_b));
    change_b := round(32 * (result_b - expected_b) + public.bela_points_bonus(match_row.score_b, match_row.score_a));

    insert into public.team_elo_history (
      tournament_id,
      match_id,
      team_id,
      opponent_team_id,
      team_elo_before,
      opponent_elo_before,
      expected_score,
      result,
      score_for,
      score_against,
      elo_change,
      team_elo_after,
      played_at
    ) values
    (
      match_row.tournament_id,
      match_row.id,
      match_row.team_a_id,
      match_row.team_b_id,
      round(elo_a),
      round(elo_b),
      expected_a,
      result_a,
      coalesce(match_row.score_a, 0),
      coalesce(match_row.score_b, 0),
      change_a,
      greatest(100, round(elo_a + change_a)),
      coalesce(match_row.finished_at, match_row.updated_at, match_row.created_at, now())
    ),
    (
      match_row.tournament_id,
      match_row.id,
      match_row.team_b_id,
      match_row.team_a_id,
      round(elo_b),
      round(elo_a),
      expected_b,
      result_b,
      coalesce(match_row.score_b, 0),
      coalesce(match_row.score_a, 0),
      change_b,
      greatest(100, round(elo_b + change_b)),
      coalesce(match_row.finished_at, match_row.updated_at, match_row.created_at, now())
    );

    update tmp_bela_elo
    set elo = greatest(100, elo_a + change_a)
    where team_id = match_row.team_a_id;

    update tmp_bela_elo
    set elo = greatest(100, elo_b + change_b)
    where team_id = match_row.team_b_id;
  end loop;
end;
$$;

create or replace function public.rebuild_team_elo_history_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.rebuild_team_elo_history();
  return null;
end;
$$;

drop trigger if exists trg_rebuild_team_elo_history_on_matches on public.matches;

create trigger trg_rebuild_team_elo_history_on_matches
after insert or update or delete on public.matches
for each statement
execute function public.rebuild_team_elo_history_trigger();

select public.rebuild_team_elo_history();

-- Ako želiš realtime i za ELO povijest:
alter table public.team_elo_history replica identity full;

alter publication supabase_realtime add table public.team_elo_history;
