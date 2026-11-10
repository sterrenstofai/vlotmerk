# Vlotmerk

Waarschijnlijke productnaam (vlotmerk.nl); de werktitel in de bouwbrief is Merknaamcheck. De naam staat op één plek: `src/lib/config/product.ts`.
Zusje van Merkkit: zelfde stack, zelfde ontwerpsysteem, ander product.
Een ondernemer vult een merknaam in en krijgt een risico-indicatie: is de naam onderscheidend, botst hij met bestaande merken en in welke klassen hoort hij.

**We geven een risico-indicatie, geen garantie.** Nergens in de interface staat "deze naam is vrij".

## Stand van zaken

Sessie 1 van de bouwbrief (fundament) is klaar:

- kit-specifieke code van Merkkit is eruit; ontwerpsysteem, login (magic link) en Supabase-koppeling staan er nog;
- tabellen: `supabase/migrations/0001_init.sql`;
- Zod-schema's per pipeline-stap: `src/lib/schema/pipeline.ts`; opgeslagen records: `src/lib/schema/records.ts`;
- tarieven van BOIP en onze prijzen: `src/lib/config/tarieven.ts`;
- interface voor registerbronnen: `src/lib/sources/types.ts`;
- één hard gecodeerde voorbeeldcheck: `src/lib/seed/trapvonk.json`, te zien op `/check/voorbeeld`.

De landingspagina is een kale versie (hero, registers, slot). De volledige invulling volgt in sessie 9.

## Draaien

```bash
npm install
npm run dev
```

Kopieer `.env.example` naar `.env.local` en vul de sleutels in. De voorbeeldcheck werkt ook zonder sleutels.

## Let op

- Lees `AGENTS.md` voordat je Next.js-code schrijft: deze versie wijkt af van oudere versies.
- Gebruik in voorbeelden alleen verzonnen namen. Een bestaand merk mag alleen voorkomen als treffer in het register.
