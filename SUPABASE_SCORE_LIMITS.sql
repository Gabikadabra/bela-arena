-- Bela Arena: posebni limiti bodova za grupe i knockout
-- Pokreni ovo jednom u Supabase SQL Editoru prije deploya novog ZIP-a.

alter table public.tournaments
add column if not exists group_score_limit integer not null default 701;

alter table public.tournaments
add column if not exists knockout_score_limit integer not null default 1001;

-- Za stare turnire automatski postavi vrijednosti ako su prazne.
update public.tournaments
set
  group_score_limit = coalesce(group_score_limit, score_limit, 701),
  knockout_score_limit = coalesce(knockout_score_limit, score_limit, 1001);
