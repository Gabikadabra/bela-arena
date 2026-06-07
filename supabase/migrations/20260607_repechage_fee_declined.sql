-- Bela Arena: repesaž uplata - neplatiša/odustajanje
-- Ako ekipa ne plati repesaž, admin je može izbaciti iz repesaža.
-- Protivnik automatski prolazi dalje ako već postoji u repesaž meču.

alter table public.matches
  add column if not exists repechage_fee_declined boolean not null default false,
  add column if not exists repechage_fee_declined_at timestamp with time zone,
  add column if not exists repechage_forfeit_slot text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_repechage_forfeit_slot_check'
  ) then
    alter table public.matches
      add constraint matches_repechage_forfeit_slot_check
      check (repechage_forfeit_slot is null or repechage_forfeit_slot in ('A', 'B'));
  end if;
end $$;

notify pgrst, 'reload schema';
