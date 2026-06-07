-- Bela Arena: knockout s repesažom
-- Gubitnik se može automatski poslati u repesaž preko loser_next_match_id/slot.

alter table public.matches
  add column if not exists loser_next_match_id uuid,
  add column if not exists loser_next_match_slot text,
  add column if not exists bracket_type text,
  add column if not exists bracket_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_next_match_slot_check'
  ) then
    alter table public.matches
      add constraint matches_next_match_slot_check
      check (next_match_slot is null or next_match_slot in ('A', 'B'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'matches_loser_next_match_slot_check'
  ) then
    alter table public.matches
      add constraint matches_loser_next_match_slot_check
      check (loser_next_match_slot is null or loser_next_match_slot in ('A', 'B'));
  end if;
end $$;

update public.matches
set bracket_type = coalesce(bracket_type, phase)
where bracket_type is null;

notify pgrst, 'reload schema';
