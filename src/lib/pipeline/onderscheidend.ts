import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DREMPELS, MODELLEN } from "@/lib/config/ai";
import {
  absoluteGrondSchema,
  onderscheidendVermogenSchema,
  taalSchema,
  type OnderscheidendVermogen,
} from "@/lib/schema/pipeline";
import type { CheckInvoer } from "@/lib/schema/records";
import { PipelineError, vraagClaude, type Verbruik } from "./claude";

/** Wat Claude teruggeeft. Het oordeel zelf rekenen we uit de scores, zodat het altijd op dezelfde manier tot stand komt. */
const antwoordSchema = z.object({
  gronden: z.array(
    z.object({
      grond: absoluteGrondSchema,
      score: z.number(),
      talen: z.array(taalSchema),
      toelichting: z.string(),
    }),
  ),
  uitleg: z.string(),
});

const SYSTEM = `Je beoordeelt of een merknaam onderscheidend genoeg is om als woordmerk in de Benelux te worden ingeschreven. Je doet wat de onderzoeker van het Benelux-Bureau voor de Intellectuele Eigendom (BOIP) doet bij de toetsing op absolute gronden.

De uitkomst leest een ondernemer zonder juridische kennis, vlak voordat hij honderden euro's betaalt voor een depot. BOIP betaalt dat geld niet terug bij een weigering. Een te gunstig oordeel kost hem dus geld; een te streng oordeel jaagt hem weg van een goede naam. Wees daarom eerlijk en precies, niet voorzichtig.

Beoordeel de naam altijd in verband met de opgegeven producten en diensten. "Appel" is beschrijvend voor fruit en sterk voor computers.

Geef voor elk van de zes gronden een score van 0 tot 100: de kans dat BOIP de naam op die grond weigert.
- beschrijvend: de naam beschrijft de soort, kwaliteit, bestemming, herkomst of een ander kenmerk van de producten of diensten. Een naam die alleen een toespeling maakt en nog een denkstap vraagt, is niet beschrijvend.
- gangbaar: de naam is in de branche of in het dagelijks taalgebruik een gewone aanduiding geworden voor deze producten of diensten.
- lovend: de naam is alleen een aanprijzing, zoals "Super", "Best" of "Premium", eventueel met een soortnaam.
- geografisch: de naam is een plaats of streek die het publiek kan zien als herkomst van de producten of diensten.
- misleidend: de naam wekt een verwachting over aard, kwaliteit of herkomst die volgens de omschrijving niet klopt.
- openbare_orde: de naam is beledigend, discriminerend of anderszins in strijd met de goede zeden.

Toets de betekenis in het Nederlands, Frans, Engels en Duits. BOIP weigert ook als de naam in een van de andere talen van de Benelux of in gangbaar Engels beschrijvend is. Noem bij elke grond de talen waarin het bezwaar speelt; laat de lijst leeg als er geen bezwaar is.

Zo ijk je de scores:
- 0 tot 39: geen of een klein bezwaar. Verzonnen woorden, bestaande woorden zonder verband met de producten, en toespelingen die een denkstap vragen.
- 40 tot 69: twijfel. De naam zit op de grens: een deel is beschrijvend, of de toespeling is erg direct. BOIP kan beide kanten op.
- 70 tot 100: BOIP weigert dit waarschijnlijk. Een combinatie van twee beschrijvende woorden blijft beschrijvend, ook aaneengeschreven of met een afwijkende spelling die je niet hoort.

Geef per grond een toelichting van één zin. Geef daarna een uitleg van precies twee zinnen in gewone taal, in de je-vorm, zonder juridische termen: wat is het oordeel en waarom. Zeg nooit dat een naam "vrij" of "veilig" is; dit oordeel gaat alleen over onderscheidend vermogen, niet over botsingen met andere merken.`;

export function oordeelUitScores(scores: number[]): OnderscheidendVermogen["oordeel"] {
  const hoogste = Math.max(...scores);
  if (hoogste >= DREMPELS.zwak) return "zwak";
  return hoogste >= DREMPELS.twijfel ? "twijfel" : "sterk";
}

/** Stap 1 van de pipeline: onderscheidend vermogen. */
export async function beoordeelOnderscheidendVermogen(
  client: Anthropic,
  invoer: CheckInvoer,
  model: string = MODELLEN.check,
): Promise<{ resultaat: OnderscheidendVermogen; ruw: unknown; verbruik: Verbruik }> {
  const { antwoord, verbruik } = await vraagClaude(client, {
    model,
    system: SYSTEM,
    schema: antwoordSchema,
    vraag: `Merknaam: ${invoer.naam}\n\nProducten en diensten, in de woorden van de ondernemer:\n${invoer.omschrijving}`,
  });

  // Elke grond precies één keer, in de vaste volgorde. Ontbreekt er een, dan is het antwoord onbruikbaar.
  const gronden = absoluteGrondSchema.options.map((grond) => {
    const g = antwoord.gronden.find((x) => x.grond === grond);
    if (!g) throw new PipelineError("De beoordeling is niet volledig. Probeer het opnieuw.");
    return { ...g, score: Math.round(Math.min(100, Math.max(0, g.score))) };
  });

  const resultaat = onderscheidendVermogenSchema.parse({
    gronden,
    oordeel: oordeelUitScores(gronden.map((g) => g.score)),
    uitleg: antwoord.uitleg,
  });
  return { resultaat, ruw: antwoord, verbruik };
}
