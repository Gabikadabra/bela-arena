-- Bela Arena: odvojeni limiti bodova i odvojeni formati meča za grupe/knockout
-- Pokreni u Supabase SQL Editoru prije deploya nove verzije.

alter table public.tournaments
add column if not exists group_score_limit integer not null default 701;

alter table public.tournaments
add column if not exists knockout_score_limit integer not null default 1001;

alter table public.tournaments
add column if not exists group_best_of integer not null default 1;

alter table public.tournaments
add column if not exists knockout_best_of integer not null default 3;

-- Backfill za stare turnire. Ako si prije imao samo score_limit i match_format, ovo ih prebaci u nova polja.
update public.tournaments
set
  group_score_limit = coalesce(group_score_limit, score_limit, 701),
  knockout_score_limit = coalesce(knockout_score_limit, score_limit, 1001),
  group_best_of = coalesce(group_best_of, 1),
  knockout_best_of = coalesce(
    knockout_best_of,
    case match_format
      when 'best_of_5' then 5
      when 'best_of_3' then 3
      else 1
    end,
    3
  );

-- Opcionalno: osiguraj da vrijednosti budu samo 1, 3 ili 5.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_group_best_of_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_group_best_of_check
    check (group_best_of in (1, 3, 5));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_knockout_best_of_check'
  ) then
    alter table public.tournaments
    add constraint tournaments_knockout_best_of_check
    check (knockout_best_of in (1, 3, 5));
  end if;
end $$;
