# Vlotmerk

Waarschijnlijke productnaam (vlotmerk.nl); de werktitel in de bouwbrief is Merknaamcheck. De naam staat op één plek: `src/lib/config/product.ts`.
Zusje van Merkkit: zelfde stack, zelfde ontwerpsysteem, ander product.
Een ondernemer vult een merknaam in en krijgt een risico-indicatie: is de naam onderscheidend, botst hij met bestaande merken en in welke klassen hoort hij.

**We geven een risico-indicatie, geen garantie.** Nergens in de interface staat "deze naam is vrij".

## Stand van zaken

**Sessie 1 (fundament)** is klaar:

- kit-specifieke code van Merkkit is eruit; ontwerpsysteem, login (magic link) en Supabase-koppeling staan er nog;
- tabellen: `supabase/migrations/0001_init.sql`;
- Zod-schema's per pipeline-stap: `src/lib/schema/pipeline.ts`; opgeslagen records: `src/lib/schema/records.ts`;
- tarieven van BOIP en onze prijzen: `src/lib/config/tarieven.ts`;
- interface voor registerbronnen: `src/lib/sources/types.ts`;
- één hard gecodeerde voorbeeldcheck: `src/lib/seed/trapvonk.json`, te zien op `/check/voorbeeld`.

**Sessie 2 (onderscheidend vermogen en klassenadvies)** is geschreven, maar nog niet tegen Claude gedraaid:

- stap 1: `src/lib/pipeline/onderscheidend.ts`. Claude geeft een score per weigeringsgrond; het oordeel volgt uit de drempels in `src/lib/config/ai.ts`;
- stap 2: `src/lib/pipeline/klassen.ts`. De termen zijn nog niet gecontroleerd tegen de geharmoniseerde databank en staan daarom op "niet gevalideerd";
- testset van 33 namen: `tests/testset.ts`.

De landingspagina heeft de drie stappen, de prijsvergelijking en het proces. De check zelf zit nog niet in de site: dat volgt met de betaalflow.

## Testset en losse check

Beide hebben een `ANTHROPIC_API_KEY` in de omgeving nodig en kosten geld per run.

```bash
npm run testset
```

```bash
npm run testset -- --klassen --model claude-haiku-5-5
```

```bash
npm run check -- "Trapvonk" "Fietsenwinkel met werkplaats"
```

De testset slaagt bij minimaal 90% goed. Draai hem na elke wijziging aan de prompts of de drempels.

## Draaien

```bash
npm install
npm run dev
```

Kopieer `.env.example` naar `.env.local` en vul de sleutels in. De voorbeeldcheck werkt ook zonder sleutels.

## Let op

- Lees `AGENTS.md` voordat je Next.js-code schrijft: deze versie wijkt af van oudere versies.
- Gebruik in voorbeelden alleen verzonnen namen. Een bestaand merk mag alleen voorkomen als treffer in het register.
