import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELLEN, RISICO } from "@/lib/config/ai";
import { berekenKosten, euro } from "@/lib/config/tarieven";
import {
  EINDOORDEEL_LABEL,
  eindoordeelSchema,
  type Aanvullend,
  type Eindoordeel,
  type EindoordeelUitkomst,
  type GescoordeHit,
  type KlassenAdvies,
  type OnderscheidendVermogen,
} from "@/lib/schema/pipeline";
import type { CheckInvoer } from "@/lib/schema/records";
import { vraagClaude, type Verbruik } from "./claude";
import { isActief, tekenGelijkenis } from "./scoren";

type Bron = { bron: string; ok: boolean; melding?: string };

/**
 * De uitkomst volgt uit vaste regels, niet uit een taalmodel. Zo geeft dezelfde invoer altijd hetzelfde oordeel.
 * Met een uitgevallen register is "sterke kandidaat" uitgesloten: wat niet doorzocht is, kan niet schoon zijn.
 */
export function bepaalUitkomst(onderscheidend: OnderscheidendVermogen["oordeel"], hits: GescoordeHit[], bronnen: Bron[]): EindoordeelUitkomst {
  const actief = hits.filter(isActief);
  const hoog = actief.filter((h) => h.risico === "hoog");
  const middel = actief.filter((h) => h.risico === "middel");
  const onvolledig = !bronnen.length || bronnen.some((b) => !b.ok);

  if (onderscheidend === "zwak") return "niet_doen";
  if (hoog.some((h) => tekenGelijkenis(h.scores) >= RISICO.tekenIdentiek)) return "niet_doen";
  if (hoog.length) return "riskant";
  if (onderscheidend === "twijfel" && middel.length) return "riskant";
  if (onderscheidend === "twijfel" || middel.length || onvolledig) return "kan_met_aandachtspunten";
  return "sterke_kandidaat";
}

const antwoordSchema = z.object({
  samenvatting: z.string(),
  aandachtspunten: z.array(z.string()),
  volgendeStap: z.string(),
});

const SYSTEM = `Je schrijft de conclusie van een merkonderzoek voor een ondernemer zonder juridische kennis. Het onderzoek zelf is al gedaan: je krijgt de uitkomst en alle bevindingen. Jij verwoordt ze; je verandert de uitkomst niet en voegt geen nieuwe bevindingen toe.

De ondernemer beslist op basis van jouw tekst of hij honderden euro's uitgeeft aan een depot dat hij bij een weigering niet terugkrijgt. Schrijf daarom concreet en eerlijk, in de je-vorm, in korte zinnen, zonder juridische termen en zonder geruststellende of alarmerende toon.

- samenvatting: twee of drie zinnen. Wat is de uitkomst en wat zijn de één of twee redenen die haar bepalen. Noem een botsend merk bij naam.
- aandachtspunten: nul tot vier punten, elk één of twee zinnen, het zwaarste eerst. Alleen punten waar de ondernemer iets mee kan of moet. Een register dat niet bereikbaar was, is altijd een aandachtspunt: zeg dat dat deel niet is onderzocht.
- volgendeStap: één concrete handeling, in één of twee zinnen. Bij "Niet doen" of "Riskant" is dat een andere naam kiezen of het voorleggen aan een merkengemachtigde, niet deponeren.

Zeg nooit dat de naam "vrij", "veilig" of "beschikbaar" is, en beloof geen inschrijving. Dit is een risico-indicatie. Een domeinnaam mag je alleen "vrij" noemen als dat zo in de bevindingen staat.`;

/** Stap 7 van de pipeline: de uitkomst volgens vaste regels, verwoord door Claude, met de kosten erbij. */
export async function maakEindoordeel(
  client: Anthropic,
  invoer: CheckInvoer,
  gegevens: { onderscheidend: OnderscheidendVermogen; klassen: KlassenAdvies; hits: GescoordeHit[]; bronnen: Bron[]; aanvullend: Aanvullend },
  model: string = MODELLEN.rapport,
): Promise<{ resultaat: Eindoordeel; ruw: unknown; verbruik: Verbruik }> {
  const { onderscheidend, klassen, hits, bronnen, aanvullend } = gegevens;
  const uitkomst = bepaalUitkomst(onderscheidend.oordeel, hits, bronnen);
  const kern = klassen.klassen.filter((k) => k.kern);
  const kosten = berekenKosten(kern.length);
  const opvallend = hits.filter((h) => isActief(h) && h.risico !== "laag");

  const { antwoord, verbruik } = await vraagClaude(client, {
    model,
    system: SYSTEM,
    schema: antwoordSchema,
    vraag: `Naam: ${invoer.naam}
Wat de ondernemer doet: ${invoer.omschrijving}

Uitkomst: ${EINDOORDEEL_LABEL[uitkomst]}

Onderscheidend vermogen: ${onderscheidend.oordeel}. ${onderscheidend.uitleg}

Registers:
${bronnen.map((b) => `- ${b.bron}: ${b.ok ? "doorzocht" : `NIET BEREIKBAAR (${b.melding ?? "geen reden bekend"})`}`).join("\n")}

Merken met verhoogd risico (${opvallend.length} van ${hits.filter(isActief).length} actieve merken):
${opvallend.map((h) => `- ${h.merk}, klassen ${h.klassen.join(", ")}, risico ${h.risico}: ${h.uitleg}`).join("\n") || "- geen"}

Geadviseerde klassen: ${kern.map((k) => k.klasse).join(", ")}
Kosten: ${euro(kosten.boip)} aan BOIP plus ${euro(kosten.onzeDienst)} voor het depotdossier.

Domeinnamen: ${aanvullend.domeinen.map((d) => `${d.domein} ${d.status}`).join(", ") || "niet gecontroleerd"}`,
  });

  const resultaat = eindoordeelSchema.parse({ uitkomst, ...antwoord, kosten });
  return { resultaat, ruw: antwoord, verbruik };
}
