# Organizacija projekta

Projekt je posložen tako da se kasnije lakše dodaju nove mogućnosti bez kopanja po cijeloj aplikaciji.

## App router

Next.js route grupe koriste zagrade, npr. `(admin)`, ali one ne ulaze u URL.

Primjer:

- `app/(admin)/admin/page.tsx` i dalje otvara `/admin`
- `app/(public)/turniri/page.tsx` i dalje otvara `/turniri`
- `app/(auth)/login/page.tsx` i dalje otvara `/login`

## Gdje dodavati nove stvari

- Nova javna stranica: `app/(public)/naziv-stranice/page.tsx`
- Nova admin stranica: `app/(admin)/admin/naziv-stranice/page.tsx`
- Nova API ruta: `app/(system)/api/naziv/route.ts`
- Nova zajednička komponenta: `components/...`
- Nova funkcija za turnire/rezultate: `lib/...`
- Novi SQL: `supabase/migrations/...`
