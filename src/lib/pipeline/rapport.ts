import type Anthropic from "@anthropic-ai/sdk";
import { reportSchema, type CheckInvoer, type Report } from "@/lib/schema/records";
import type { RegisterSource } from "@/lib/sources/types";
import { zoekInBronnen, type ZoekCache } from "@/lib/sources/zoek";
import { aanvullendeChecks } from "./aanvullend";
import type { Verbruik } from "./claude";
import { maakEindoordeel } from "./eindoordeel";
import { adviseerKlassen, type TermValidator } from "./klassen";
import { beoordeelOnderscheidendVermogen } from "./onderscheidend";
import { scoorTreffers } from "./scoren";
import { maakVarianten } from "./varianten";

export type Stap = { stap: number; ruw: unknown; verbruik: Verbruik[] };

/**
 * Het volledige rapport: stap 1 tot en met 7 van de pipeline.
 * Geeft naast het rapport de ruwe uitvoer per stap terug, zodat de aanroeper die kan wegschrijven.
 */
export async function maakRapport(
  client: Anthropic,
  invoer: CheckInvoer,
  opts: { bronnen: RegisterSource[]; cache?: ZoekCache; valideer?: TermValidator },
): Promise<{ rapport: Report; stappen: Stap[] }> {
  // Stap 1, 2, 3 en 6 hangen niet van elkaar af en lopen tegelijk.
  const [onderscheidend, klassen, varianten, aanvullend] = await Promise.all([
    beoordeelOnderscheidendVermogen(client, invoer),
    adviseerKlassen(client, invoer, { valideer: opts.valideer }),
    maakVarianten(client, invoer),
    aanvullendeChecks(invoer.naam),
  ]);

  // Stap 4: in alle klassen zoeken. Een ouder merk in een andere klasse kan toch soortgelijk zijn; dat beoordeelt stap 5.
  const uitkomsten = await zoekInBronnen(
    opts.bronnen,
    varianten.resultaat.map((v) => v.term),
    { activeOnly: false },
    opts.cache,
  );
  const hits = uitkomsten.flatMap((u) => (u.ok ? u.hits : []));
  const bronnen = uitkomsten.map((u) => (u.ok ? { bron: u.bron, ok: true } : { bron: u.bron, ok: false, melding: u.melding }));

  const gescoord = await scoorTreffers(client, invoer, klassen.resultaat, hits);
  const eindoordeel = await maakEindoordeel(client, invoer, {
    onderscheidend: onderscheidend.resultaat,
    klassen: klassen.resultaat,
    hits: gescoord.resultaat,
    bronnen,
    aanvullend,
  });

  const rapport = reportSchema.parse({
    absoluteGronden: onderscheidend.resultaat,
    klassen: klassen.resultaat,
    varianten: varianten.resultaat,
    bronnen,
    hits: gescoord.resultaat,
    aanvullend,
    eindoordeel: eindoordeel.resultaat,
    pdfPad: null,
  });

  return {
    rapport,
    stappen: [
      { stap: 1, ruw: onderscheidend.ruw, verbruik: [onderscheidend.verbruik] },
      { stap: 2, ruw: klassen.ruw, verbruik: [klassen.verbruik] },
      { stap: 3, ruw: varianten.ruw, verbruik: [varianten.verbruik] },
      { stap: 4, ruw: uitkomsten, verbruik: [] },
      { stap: 5, ruw: gescoord.ruw, verbruik: gescoord.verbruik },
      { stap: 6, ruw: aanvullend, verbruik: [] },
      { stap: 7, ruw: eindoordeel.ruw, verbruik: [eindoordeel.verbruik] },
    ],
  };
}
