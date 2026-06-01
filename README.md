# Bela Arena

Web aplikacija za organizaciju turnira u beli: prijave ekipa, ždrijeb, grupe, knockout, live rezultat, rang lista, zvanja, povijest, admin upravljanje i ručni unos rezultata.

## Pokretanje

```bash
npm install
npm run dev
```

Kopiraj `.env.local.example` u `.env.local` i upiši Supabase/Resend vrijednosti.

## Organizacija projekta

- `app/(public)` — javne stranice i stranice za korisnike
- `app/(admin)` — admin dio aplikacije
- `app/(auth)` — login, registracija i callback
- `app/(system)` — API rute
- `components/layout` — layout komponente, npr. navigacija
- `config` — statičke konfiguracije aplikacije
- `lib` — poslovna logika i Supabase helperi
- `supabase` — glavna shema i SQL migracije
- `docs` — bilješke, setup i povijest promjena

## Build

```bash
npm run build
```
