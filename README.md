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

**Sessie 2 (onderscheidend vermogen en klassenadvies)** is klaar en gedraaid tegen Claude:

- stap 1: `src/lib/pipeline/onderscheidend.ts`. Claude geeft een score per weigeringsgrond; het oordeel volgt uit de drempels in `src/lib/config/ai.ts`;
- stap 2: `src/lib/pipeline/klassen.ts`. De termen zijn nog niet gecontroleerd tegen de geharmoniseerde databank en staan daarom op "niet gevalideerd";
- testset van 33 namen: `tests/testset.ts`.

**Sessie 3 (zoekvarianten en registers)** is deels klaar:

- stap 3: `src/lib/pipeline/varianten.ts`. Vaste varianten zonder taalmodel, aangevuld door Claude (de aanvulling is nog niet tegen Claude gedraaid);
- zoeklaag met gezondheidscheck en cache van 24 uur: `src/lib/sources/zoek.ts`. Een uitgevallen bron levert altijd "niet bereikbaar" op, nooit nul treffers;
- EU-merken: `src/lib/sources/euipo.ts`, geschreven tegen de openbare specificatie van de officiële EUIPO-API (versie 1.1.0). Getest tegen de sandbox van EUIPO (testgegevens). De sandbox weigert af en toe een geldige aanroep; de adapter probeert het dan opnieuw. Productietoegang is nog niet aangevraagd;
- Benelux-merken: nog niet gekoppeld. `src/lib/sources/benelux.ts` meldt zich als niet bereikbaar tot er een bron gekozen is.

```bash
npm run test:bronnen
```

Die test draait zonder netwerk en zonder kosten.

**Sessie 4 (scoren en eindoordeel)** is geschreven; de vaste regels zijn getest, het deel dat Claude gebruikt is nog niet gedraaid:

- gelijkenis in schrijfwijze en klank zonder taalmodel: `src/lib/pipeline/gelijkenis.ts`;
- stap 5: `src/lib/pipeline/scoren.ts`. De meest gelijkende treffers (hooguit veertig) gaan naar Claude voor beeld, klank, betekenis en soortgelijkheid; het risico volgt daarna uit vaste regels in `src/lib/config/ai.ts`;
- stap 6: `src/lib/pipeline/aanvullend.ts`. Domeinnamen via RDAP; de handelsnaam (KvK) is nog niet gekoppeld;
- stap 7: `src/lib/pipeline/eindoordeel.ts`. De uitkomst volgt uit vaste regels en wordt door Claude verwoord. Met een uitgevallen register is "sterke kandidaat" uitgesloten;
- alles achter elkaar: `src/lib/pipeline/rapport.ts`.

```bash
npm test
```

```bash
npm run rapport -- "Trapvonk" "Fietsenwinkel met werkplaats"
```

`npm test` draait zonder netwerk en zonder kosten. `npm run rapport` heeft de sleutels van Anthropic en EUIPO nodig en kost geld per run.

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

Uitslag op 10 november 2026, met `--klassen`:

| Model | Goed | Kosten van de run | Duur |
|---|---|---|---|
| `claude-opus-5-5` | 33 van 33 | ongeveer $0,93 | 1 min 34 |
| `claude-haiku-5-5` | 32 van 33 | ongeveer $0,03 | 1 min 05 |

Haiku miste één grensgeval (Wolkenwerk: zwak in plaats van twijfel of sterk). Eén losse check met klassenadvies duurde 9,6 seconden op Opus.
De check en het rapport draaien allebei op Opus: dan kan het oordeel in het rapport nooit afwijken van dat in de check.

## Draaien

```bash
npm install
npm run dev
```

Kopieer `.env.example` naar `.env.local` en vul de sleutels in. De voorbeeldcheck werkt ook zonder sleutels.

## Let op

- Lees `AGENTS.md` voordat je Next.js-code schrijft: deze versie wijkt af van oudere versies.
- Gebruik in voorbeelden alleen verzonnen namen. Een bestaand merk mag alleen voorkomen als treffer in het register.
