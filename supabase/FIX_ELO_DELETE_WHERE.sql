-- Bela Arena fix: DELETE requires a WHERE clause
-- Pokreni ovo jednom u Supabase SQL Editoru ako ti ždrijeb javlja:
-- Greška: DELETE requires a WHERE clause
-- Uzrok je bio rebuild_team_elo_history() koji je radio DELETE bez WHERE uvjeta.

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
  -- Supabase/pg-safeupdate traži WHERE uvjet za DELETE.
  delete from public.team_elo_history
  where id is not null;

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
    order by created_at, id
  loop
    insert into tmp_bela_elo(team_id, elo)
    values
      (match_row.team_a_id, 1000),
      (match_row.team_b_id, 1000)
    on conflict (team_id) do nothing;

    select elo into elo_a
    from tmp_bela_elo
    where team_id = match_row.team_a_id;

    select elo into elo_b
    from tmp_bela_elo
    where team_id = match_row.team_b_id;

    result_a := case
      when match_row.winner_id = match_row.team_a_id then 1
      else 0
    end;

    result_b := case
      when match_row.winner_id = match_row.team_b_id then 1
      else 0
    end;

    expected_a := public.bela_expected_score(elo_a, elo_b);
    expected_b := public.bela_expected_score(elo_b, elo_a);

    change_a := round(32 * (result_a - expected_a));
    change_b := round(32 * (result_b - expected_b));

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
    )
    values
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
      coalesce(match_row.created_at, now())
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
      coalesce(match_row.created_at, now())
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

select public.rebuild_team_elo_history();
