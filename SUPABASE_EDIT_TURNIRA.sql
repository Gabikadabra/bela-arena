-- Ako si već pokrenuo SQL za score limite i setove, ne moraš ništa dodatno mijenjati.
-- Ovaj SQL je siguran za ponovno pokretanje jer koristi IF NOT EXISTS.

alter table public.tournaments
add column if not exists group_score_limit integer not null default 701;

alter table public.tournaments
add column if not exists knockout_score_limit integer not null default 1001;

alter table public.tournaments
add column if not exists group_best_of integer not null default 1;

alter table public.tournaments
add column if not exists knockout_best_of integer not null default 3;

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
