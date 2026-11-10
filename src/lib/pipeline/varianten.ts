import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELLEN } from "@/lib/config/ai";
import { MAX_GRATIS_ZOEKOPDRACHTEN, MAX_VARIANTEN, taalSchema, variantenSchema, type Variant } from "@/lib/schema/pipeline";
import type { CheckInvoer } from "@/lib/schema/records";
import { vraagClaude, type Verbruik } from "./claude";

/** Letterparen die in het Nederlands hetzelfde of bijna hetzelfde klinken. */
const KLANKPAREN: [string, string][] = [
  ["ph", "f"],
  ["ck", "k"],
  ["c", "k"],
  ["y", "i"],
  ["ei", "ij"],
  ["z", "s"],
  ["x", "ks"],
  ["v", "f"],
  ["ou", "au"],
  ["th", "t"],
];
const STOPWOORDEN = new Set(["de", "het", "een", "en", "van", "voor", "the", "and", "of", "le", "la", "les", "der", "die", "das", "und"]);

const sleutel = (term: string) => term.toLowerCase().replace(/\s+/g, " ").trim();
const hoofdletter = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** De varianten die zonder taalmodel te maken zijn. Altijd dezelfde uitkomst voor dezelfde naam. */
export function deterministischeVarianten(naam: string): Variant[] {
  const schoon = naam.replace(/\s+/g, " ").trim();
  const uit: Variant[] = [{ term: schoon, soort: "exact" }];

  const aaneen = schoon.replace(/[\s\-_.&+]+/g, "");
  if (aaneen !== schoon) uit.push({ term: aaneen, soort: "aaneen" });
  const metSpaties = schoon.replace(/[\-_.]+/g, " ");
  if (metSpaties !== schoon) uit.push({ term: metSpaties, soort: "aaneen" });

  const laag = aaneen.toLowerCase();
  for (const [a, b] of KLANKPAREN) {
    for (const [van, naar] of [
      [a, b],
      [b, a],
    ]) {
      if (laag.includes(van)) uit.push({ term: hoofdletter(laag.replace(van, naar)), soort: "fonetisch" });
    }
  }

  if (!/s$/i.test(schoon)) uit.push({ term: `${schoon}s`, soort: "meervoud" });
  if (!/en$/i.test(schoon)) uit.push({ term: `${schoon}en`, soort: "meervoud" });

  const woorden = schoon.split(/[\s\-&+]+/).filter((w) => w.length >= 4 && !STOPWOORDEN.has(w.toLowerCase()));
  if (schoon.split(/[\s\-&+]+/).length > 1 && woorden.length) {
    const langste = [...woorden].sort((x, y) => y.length - x.length)[0];
    uit.push({ term: langste, soort: "dominant_woord" });
  }
  return uit;
}

/** Voegt lijsten samen: geen dubbelen, de exacte naam eerst, hooguit het maximum. */
export function voegSamen(...lijsten: Variant[][]): Variant[] {
  const gezien = new Set<string>();
  const uit: Variant[] = [];
  for (const v of lijsten.flat()) {
    const k = sleutel(v.term);
    if (!k || gezien.has(k)) continue;
    gezien.add(k);
    uit.push({ ...v, term: v.term.trim() });
  }
  return uit.slice(0, MAX_VARIANTEN);
}

/** De eerste check zoekt alleen op de exacte en bijna-exacte varianten. */
export function gratisVarianten(varianten: Variant[]): Variant[] {
  const volgorde = ["exact", "aaneen", "fonetisch", "spelling"];
  return [...varianten]
    .filter((v) => volgorde.includes(v.soort))
    .sort((a, b) => volgorde.indexOf(a.soort) - volgorde.indexOf(b.soort))
    .slice(0, MAX_GRATIS_ZOEKOPDRACHTEN);
}

const antwoordSchema = z.object({
  varianten: z.array(
    z.object({
      term: z.string(),
      soort: z.enum(["spelling", "fonetisch", "vertaling", "dominant_woord"]),
      taal: taalSchema.nullable(),
    }),
  ),
});

const SYSTEM = `Je bedenkt zoektermen voor een merkonderzoek in het Benelux- en het EU-merkenregister.

Een ouder merk kan bezwaar maken tegen een nieuwe naam als de twee op elkaar lijken in beeld, klank of betekenis. Het register vindt alleen wat je letterlijk intikt. Jij bedenkt daarom de schrijfwijzen waaronder een botsend merk in het register kan staan.

Je krijgt de naam en de varianten die al gemaakt zijn. Vul aan met:
- spelling: schrijfwijzen die een mens voor dezelfde naam kan aanzien, zoals een dubbele of weggelaten letter of een verwisselde klinker.
- fonetisch: schrijfwijzen die anders ogen maar hetzelfde klinken, in het Nederlands, Frans, Engels of Duits.
- vertaling: de naam of het kernwoord in het Nederlands, Frans, Engels en Duits, alleen als de naam een betekenis heeft. Een verzonnen woord vertaal je niet. Geef de taal erbij.
- dominant_woord: bij een samengestelde naam het deel dat het publiek onthoudt. Een beschrijvend deel zoals "fietsen" of "shop" is nooit het dominante woord.

Geef hooguit vijftien varianten, de waarschijnlijkste eerst. Herhaal geen variant die al in de lijst staat. Liever acht goede dan vijftien waarvan de helft niemand zou intikken.`;

/** Stap 3 van de pipeline: zoekvarianten. Eerst de vaste varianten, daarna de aanvulling van Claude. */
export async function maakVarianten(
  client: Anthropic,
  invoer: CheckInvoer,
  model: string = MODELLEN.rapport,
): Promise<{ resultaat: Variant[]; ruw: unknown; verbruik: Verbruik }> {
  const vast = deterministischeVarianten(invoer.naam);
  const { antwoord, verbruik } = await vraagClaude(client, {
    model,
    system: SYSTEM,
    schema: antwoordSchema,
    vraag: `Naam: ${invoer.naam}\n\nWat de ondernemer doet:\n${invoer.omschrijving}\n\nAl gemaakte varianten:\n${vast.map((v) => `- ${v.term}`).join("\n")}`,
  });
  const aanvulling: Variant[] = antwoord.varianten.map((v) => ({ term: v.term, soort: v.soort, ...(v.taal ? { taal: v.taal } : {}) }));
  // De exacte naam en de vaste varianten gaan voor; de meervouden mogen als eerste wijken voor de aanvulling.
  const kern = vast.filter((v) => v.soort !== "meervoud");
  const meervoud = vast.filter((v) => v.soort === "meervoud");
  return { resultaat: variantenSchema.parse(voegSamen(kern, aanvulling, meervoud)), ruw: antwoord, verbruik };
}
