import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELLEN } from "@/lib/config/ai";
import { meerkostenKlasse } from "@/lib/config/tarieven";
import { klassenAdviesSchema, type KlassenAdvies } from "@/lib/schema/pipeline";
import type { CheckInvoer } from "@/lib/schema/records";
import { PipelineError, vraagClaude, type Verbruik } from "./claude";

const antwoordSchema = z.object({
  klassen: z.array(
    z.object({
      klasse: z.number(),
      termen: z.array(z.string()),
      waarom: z.string(),
      kern: z.boolean(),
    }),
  ),
  toelichting: z.string(),
});

const SYSTEM = `Je adviseert een ondernemer in welke klassen van de Nice-classificatie hij zijn merk moet deponeren bij het Benelux-Bureau voor de Intellectuele Eigendom (BOIP).

De ondernemer beschrijft in eigen woorden wat hij doet. Jij vertaalt dat naar klassen en naar termen voor de lijst van waren en diensten.

Adviseer zo smal mogelijk. Elke extra klasse kost geld en vergroot de kans dat een ouder merk bezwaar maakt. Neem alleen klassen op voor wat de ondernemer nu doet of volgens zijn omschrijving concreet van plan is.
- kern is true voor klassen die hij nodig heeft voor wat hij nu doet. Zet de belangrijkste klasse eerst.
- kern is false voor een klasse die je alleen noemt omdat hij voor de hand ligt bij groei. Noem er hooguit één, en alleen als de omschrijving daar aanleiding toe geeft.

Veelgemaakte fouten die je voorkomt:
- Een winkel die producten van anderen verkoopt, hoort in klasse 35 (detailhandel), niet in de klasse van die producten. De productklasse is alleen nodig als hij ze onder eigen merk maakt of laat maken.
- Software die de klant downloadt is klasse 9; software als online dienst is klasse 42. Kies wat past bij de omschrijving.
- Reclame voor het eigen bedrijf is geen dienst in klasse 35.

Gebruik voor de termen de formulering van de geharmoniseerde databank van waren en diensten (TMclass), in het Nederlands. Geef per klasse één tot vier termen die samen dekken wat de ondernemer doet. Verzin geen termen die te breed zijn, zoals de volledige klassekop.

Leg per klasse in één zin uit waarom hij erbij hoort, in de je-vorm. Schrijf in toelichting één of twee zinnen over wat je bewust hebt weggelaten en waarom.`;

/**
 * Controleert een term tegen de geharmoniseerde databank. Tot de koppeling met de EUIPO-classificatie-API er is,
 * geldt geen enkele term als gevalideerd: een niet-gecontroleerde term mag nooit als gecontroleerd getoond worden.
 */
export type TermValidator = (klasse: number, term: string) => Promise<{ gevalideerd: boolean; bron: "euipo_gs" | "tmclass" | null }>;

export const geenValidatie: TermValidator = async () => ({ gevalideerd: false, bron: null });

/** Stap 2 van de pipeline: klassenadvies. */
export async function adviseerKlassen(
  client: Anthropic,
  invoer: CheckInvoer,
  opts: { model?: string; valideer?: TermValidator } = {},
): Promise<{ resultaat: KlassenAdvies; ruw: unknown; verbruik: Verbruik }> {
  const { antwoord, verbruik } = await vraagClaude(client, {
    model: opts.model ?? MODELLEN.rapport,
    system: SYSTEM,
    schema: antwoordSchema,
    vraag: `Merknaam: ${invoer.naam}\n\nWat de ondernemer doet, in eigen woorden:\n${invoer.omschrijving}`,
  });

  const valideer = opts.valideer ?? geenValidatie;
  const uniek = new Map<number, (typeof antwoord.klassen)[number]>();
  for (const k of antwoord.klassen) if (!uniek.has(k.klasse)) uniek.set(k.klasse, k);
  // Kernklassen eerst: de eerste klasse zit in het basistarief, dus de volgorde bepaalt de meerkosten.
  const gesorteerd = [...uniek.values()].sort((a, b) => Number(b.kern) - Number(a.kern));
  if (!gesorteerd.some((k) => k.kern)) throw new PipelineError("Het klassenadvies is niet volledig. Probeer het opnieuw.");

  const klassen = await Promise.all(
    gesorteerd.map(async (k, i) => ({
      klasse: k.klasse,
      termen: await Promise.all(k.termen.map(async (term) => ({ term, ...(await valideer(k.klasse, term)) }))),
      waarom: k.waarom,
      meerkosten: meerkostenKlasse(i + 1),
      kern: k.kern,
    })),
  );

  const parsed = klassenAdviesSchema.safeParse({ klassen, toelichting: antwoord.toelichting });
  if (!parsed.success) throw new PipelineError("Het klassenadvies is niet bruikbaar. Probeer het opnieuw.");
  return { resultaat: parsed.data, ruw: antwoord, verbruik };
}
