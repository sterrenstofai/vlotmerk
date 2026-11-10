import { bronUitkomstSchema, type BronId, type BronUitkomst, type Hit } from "@/lib/schema/pipeline";
import { CACHE_UREN } from "@/lib/schema/records";
import type { RegisterSource } from "./types";

/** Opslag voor zoekresultaten. De server gebruikt de tabel source_cache; tests een lijst in het geheugen. */
export interface ZoekCache {
  lees(bron: BronId, sleutel: string): Promise<{ hits: Hit[]; opgehaald: Date } | null>;
  schrijf(bron: BronId, sleutel: string, hits: Hit[]): Promise<void>;
}

export const geenCache: ZoekCache = {
  async lees() {
    return null;
  },
  async schrijf() {},
};

export function geheugenCache(): ZoekCache {
  const data = new Map<string, { hits: Hit[]; opgehaald: Date }>();
  return {
    async lees(bron, sleutel) {
      return data.get(`${bron}|${sleutel}`) ?? null;
    },
    async schrijf(bron, sleutel, hits) {
      data.set(`${bron}|${sleutel}`, { hits, opgehaald: new Date() });
    },
  };
}

type Opties = { classes?: number[]; activeOnly: boolean };

/** De sleutel bevat ook de zoekopties: dezelfde term met andere klassen is een andere zoekopdracht. */
export function cacheSleutel(term: string, opts: Opties): string {
  const klassen = opts.classes?.length ? [...opts.classes].sort((a, b) => a - b).join(",") : "alle";
  return `${term.trim().toLowerCase()}|${klassen}|${opts.activeOnly ? "actief" : "alles"}`;
}

const vers = (opgehaald: Date) => Date.now() - opgehaald.getTime() < CACHE_UREN * 60 * 60 * 1000;

/**
 * Zoekt alle varianten in één bron.
 * Eerst de gezondheidscheck: een bron die daar niet doorheen komt, of die halverwege een fout geeft,
 * levert "niet bereikbaar" op. Een kapotte bron mag nooit op een schone uitslag lijken.
 */
export async function zoekInBron(bron: RegisterSource, termen: string[], opts: Opties, cache: ZoekCache = geenCache): Promise<BronUitkomst> {
  const gezond = await bron.health().catch((e: unknown) => ({ ok: false, note: e instanceof Error ? e.message : undefined }));
  if (!gezond.ok) return { ok: false, bron: bron.id, melding: gezond.note ?? "Register tijdelijk niet bereikbaar." };

  const perNummer = new Map<string, Hit>();
  let zoekopdrachten = 0;
  try {
    // Hoofdletters maken voor het register niet uit: "Apple" en "apple" zijn één zoekopdracht.
    const uniek = new Map(termen.map((t) => [t.trim().toLowerCase(), t.trim()] as const).filter(([k]) => k));
    for (const term of uniek.values()) {
      const sleutel = cacheSleutel(term, opts);
      const bewaard = await cache.lees(bron.id, sleutel);
      let hits: Hit[];
      if (bewaard && vers(bewaard.opgehaald)) {
        hits = bewaard.hits;
      } else {
        hits = await bron.search(term, opts);
        zoekopdrachten++;
        await cache.schrijf(bron.id, sleutel, hits);
      }
      // Hetzelfde merk kan bij meerdere varianten opduiken; de eerste variant die het vond blijft staan.
      for (const hit of hits) if (!perNummer.has(hit.nummer)) perNummer.set(hit.nummer, hit);
    }
  } catch (error) {
    return { ok: false, bron: bron.id, melding: error instanceof Error ? error.message : "Register tijdelijk niet bereikbaar." };
  }
  return bronUitkomstSchema.parse({ ok: true, bron: bron.id, hits: [...perNummer.values()], zoekopdrachten });
}

/** Alle bronnen naast elkaar. Elke bron krijgt zijn eigen uitkomst, ook als hij uitvalt. */
export function zoekInBronnen(bronnen: RegisterSource[], termen: string[], opts: Opties, cache?: ZoekCache): Promise<BronUitkomst[]> {
  return Promise.all(bronnen.map((b) => zoekInBron(b, termen, opts, cache)));
}

/** Het aantal treffers om te tonen. Null zodra een bron ontbreekt: dan is er geen eerlijk totaal te geven. */
export function aantalTreffers(uitkomsten: BronUitkomst[]): number | null {
  if (!uitkomsten.length || uitkomsten.some((u) => !u.ok)) return null;
  return uitkomsten.reduce((n, u) => n + (u.ok ? u.hits.length : 0), 0);
}
