import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELLEN, RISICO, SCOREN } from "@/lib/config/ai";
import {
  ACTIEVE_STATUSSEN,
  gescoordeHitSchema,
  type GescoordeHit,
  type Hit,
  type KlassenAdvies,
  type Risico,
} from "@/lib/schema/pipeline";
import type { CheckInvoer } from "@/lib/schema/records";
import { PipelineError, vraagClaude, type Verbruik } from "./claude";
import { bewerkingsafstand, klankGelijkenis, schrijfGelijkenis, voorselectieScore } from "./gelijkenis";

type Scores = GescoordeHit["scores"];

export const isActief = (h: Pick<Hit, "status">) => (ACTIEVE_STATUSSEN as readonly string[]).includes(h.status);

/** Hoe sterk het teken als geheel op de naam lijkt: de hoogste van beeld, klank en afgezwakte betekenis. */
export function tekenGelijkenis(s: Pick<Scores, "visueel" | "auditief" | "begripsmatig">): number {
  return Math.max(s.visueel, s.auditief, s.begripsmatig * RISICO.gewichtBetekenis);
}

/**
 * Van gelijkenis naar risico, volgens vaste regels. Verwarringsgevaar vraagt twee dingen tegelijk: het teken
 * lijkt op de naam én de producten liggen dicht bij elkaar. Een bekend merk is ook buiten zijn eigen producten beschermd.
 */
export function risicoUitScores(s: Pick<Scores, "visueel" | "auditief" | "begripsmatig" | "soortgelijkheid" | "bekendMerk">): Risico {
  const teken = tekenGelijkenis(s);
  const soort = s.soortgelijkheid;
  if (teken >= RISICO.tekenHoog && (soort >= RISICO.soortHoog || s.bekendMerk)) return "hoog";
  if (teken >= RISICO.tekenHoog && soort >= RISICO.soortMiddel) return "middel";
  if (teken >= RISICO.tekenMiddel && soort >= RISICO.soortHoog) return "middel";
  if (teken >= RISICO.tekenIdentiek) return "middel";
  return "laag";
}

/** De scores die zonder taalmodel te berekenen zijn. */
export function vasteScores(naam: string, hit: Hit, klassen: number[]): Pick<Scores, "bewerkingsafstand" | "fonetisch" | "klassenOverlap"> {
  return {
    bewerkingsafstand: bewerkingsafstand(naam, hit.merk),
    fonetisch: Number(klankGelijkenis(naam, hit.merk).toFixed(2)),
    klassenOverlap: hit.klassen.filter((k) => klassen.includes(k)),
  };
}

/**
 * Verdeelt de treffers: de meest gelijkende gaan naar Claude, de rest krijgt zonder taalmodel risico laag.
 * Een veelvoorkomend woord geeft honderden treffers; die allemaal laten beoordelen is traag en duur en voegt niets toe.
 */
export function voorselectie(naam: string, hits: Hit[]): { beoordelen: Hit[]; rest: Hit[] } {
  const gerangschikt = hits
    .map((hit) => ({ hit, score: voorselectieScore(naam, hit.merk), schrijf: schrijfGelijkenis(naam, hit.merk) }))
    // Bij gelijke score gaat het merk voor dat ook hetzelfde geschreven is, en daarna het actieve merk.
    .sort((a, b) => b.score - a.score || b.schrijf - a.schrijf || Number(isActief(b.hit)) - Number(isActief(a.hit)));
  const kandidaten = gerangschikt.filter((x) => x.score >= SCOREN.drempelVoorselectie);
  const beoordelen = kandidaten.slice(0, SCOREN.maxDoorClaude).map((x) => x.hit);
  const gekozen = new Set(beoordelen.map((h) => `${h.bron}|${h.nummer}`));
  return { beoordelen, rest: gerangschikt.map((x) => x.hit).filter((h) => !gekozen.has(`${h.bron}|${h.nummer}`)) };
}

/** Een treffer die niet door Claude is beoordeeld: lage gelijkenis, dus risico laag, met alleen vaste scores. */
export function zonderBeoordeling(naam: string, hit: Hit, klassen: number[]): GescoordeHit {
  const schrijf = Number(schrijfGelijkenis(naam, hit.merk).toFixed(2));
  const vast = vasteScores(naam, hit, klassen);
  return gescoordeHitSchema.parse({
    ...hit,
    scores: { ...vast, visueel: schrijf, auditief: vast.fonetisch, begripsmatig: 0, soortgelijkheid: vast.klassenOverlap.length ? 0.5 : 0.1, bekendMerk: false },
    risico: "laag",
    uitleg: "Lijkt in schrijfwijze en klank weinig op jouw naam.",
  });
}

const antwoordSchema = z.object({
  beoordelingen: z.array(
    z.object({
      id: z.number(),
      visueel: z.number(),
      auditief: z.number(),
      begripsmatig: z.number(),
      soortgelijkheid: z.number(),
      bekendMerk: z.boolean(),
      uitleg: z.string(),
    }),
  ),
});

const SYSTEM = `Je beoordeelt voor een merkonderzoek hoe groot de kans is dat een ouder merk met succes bezwaar maakt tegen een nieuwe merknaam in de Benelux.

De toets is verwarringsgevaar, zoals het Benelux-Bureau voor de Intellectuele Eigendom en het EUIPO die toepassen in oppositiezaken. Twee dingen bepalen de uitkomst: hoe sterk de tekens op elkaar lijken, en hoe dicht de producten en diensten bij elkaar liggen. Jij geeft de bouwstenen; het risico wordt daarna met vaste regels uit jouw scores berekend. Geef daarom je eerlijke inschatting per onderdeel en stuur niet op een uitkomst.

Je krijgt de nieuwe naam, wat de ondernemer doet, de klassen waarin hij wil deponeren, en een genummerde lijst oudere merken met hun klassen. Geef voor elk merk, met een getal van 0 tot 1:
- visueel: hoe sterk de tekens er op het oog op elkaar lijken. Lengte, begin en de volgorde van de letters tellen het zwaarst; het publiek let vooral op het begin van een woord.
- auditief: hoe sterk ze op elkaar lijken als je ze uitspreekt, in het Nederlands, Frans, Engels en Duits.
- begripsmatig: of ze hetzelfde betekenen of hetzelfde beeld oproepen, ook via een vertaling. Twee verzonnen woorden zonder betekenis scoren hier 0.
- soortgelijkheid: hoe dicht de producten en diensten bij elkaar liggen. Kijk naar aard, bestemming, gebruik, afnemers en verkoopkanalen, niet alleen naar het klassenummer: dezelfde klasse kan heel verschillende producten bevatten, en verschillende klassen kunnen bij elkaar horen (fietsen in klasse 12 en reparatie van fietsen in klasse 37). Je kent van het oudere merk alleen de klassen, de naam en de houder; leid daaruit zo goed mogelijk af waarvoor het is ingeschreven en blijf bij twijfel rond het midden.
- bekendMerk: true alleen als dit oudere merk bij het grote publiek in de Benelux algemeen bekend is. Bij twijfel false.

Beoordeel het teken als geheel. Een beschrijvend onderdeel, zoals "fietsen" bij een fietsenwinkel, telt nauwelijks mee; het onderscheidende deel bepaalt de indruk.

Schrijf per merk een uitleg van één zin, in de je-vorm en in gewone taal: waarin lijkt het op de naam en waarom is dat wel of geen probleem. Zeg nooit dat de naam "vrij" of "veilig" is. Geef precies één beoordeling per nummer uit de lijst.`;

const begrens = (n: number) => Number(Math.min(1, Math.max(0, n)).toFixed(2));

async function beoordeelGroep(
  client: Anthropic,
  invoer: CheckInvoer,
  klassen: KlassenAdvies,
  hits: Hit[],
  model: string,
): Promise<{ gescoord: GescoordeHit[]; ruw: unknown; verbruik: Verbruik }> {
  const kern = klassen.klassen.filter((k) => k.kern);
  const nummers = kern.map((k) => k.klasse);
  const lijst = hits
    .map((h, i) => `${i + 1}. ${h.merk} | klassen ${h.klassen.join(", ") || "onbekend"} | houder: ${h.houder ?? "onbekend"}`)
    .join("\n");
  const { antwoord, verbruik } = await vraagClaude(client, {
    model,
    system: SYSTEM,
    schema: antwoordSchema,
    vraag: `Nieuwe naam: ${invoer.naam}

Wat de ondernemer doet:
${invoer.omschrijving}

Klassen waarin hij wil deponeren:
${kern.map((k) => `- ${k.klasse}: ${k.termen.map((t) => t.term).join("; ")}`).join("\n")}

Oudere merken:
${lijst}`,
  });

  const gescoord = hits.map((hit, i) => {
    const b = antwoord.beoordelingen.find((x) => x.id === i + 1);
    // Ontbreekt een beoordeling, dan is het antwoord onbruikbaar: een overgeslagen merk mag niet stil als "laag" doorgaan.
    if (!b) throw new PipelineError("De beoordeling van de treffers is niet volledig. Probeer het opnieuw.");
    const scores: Scores = {
      ...vasteScores(invoer.naam, hit, nummers),
      visueel: begrens(b.visueel),
      auditief: begrens(b.auditief),
      begripsmatig: begrens(b.begripsmatig),
      soortgelijkheid: begrens(b.soortgelijkheid),
      bekendMerk: b.bekendMerk,
    };
    return gescoordeHitSchema.parse({ ...hit, scores, risico: risicoUitScores(scores), uitleg: b.uitleg });
  });
  return { gescoord, ruw: antwoord, verbruik };
}

const VOLGORDE: Record<Risico, number> = { hoog: 0, middel: 1, laag: 2 };

/** Stap 5 van de pipeline: elke treffer krijgt scores, een risico en één zin uitleg. */
export async function scoorTreffers(
  client: Anthropic,
  invoer: CheckInvoer,
  klassen: KlassenAdvies,
  hits: Hit[],
  model: string = MODELLEN.rapport,
): Promise<{ resultaat: GescoordeHit[]; ruw: unknown[]; verbruik: Verbruik[] }> {
  const nummers = klassen.klassen.filter((k) => k.kern).map((k) => k.klasse);
  const { beoordelen, rest } = voorselectie(invoer.naam, hits);

  const groepen: Hit[][] = [];
  for (let i = 0; i < beoordelen.length; i += SCOREN.perVraag) groepen.push(beoordelen.slice(i, i + SCOREN.perVraag));
  const uitkomsten = await Promise.all(groepen.map((g) => beoordeelGroep(client, invoer, klassen, g, model)));

  const resultaat = [...uitkomsten.flatMap((u) => u.gescoord), ...rest.map((h) => zonderBeoordeling(invoer.naam, h, nummers))].sort(
    (a, b) => Number(isActief(b)) - Number(isActief(a)) || VOLGORDE[a.risico] - VOLGORDE[b.risico],
  );
  return { resultaat, ruw: uitkomsten.map((u) => u.ruw), verbruik: uitkomsten.map((u) => u.verbruik) };
}
