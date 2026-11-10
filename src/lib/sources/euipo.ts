import { hitSchema, type Hit } from "@/lib/schema/pipeline";
import type { RegisterSource } from "./types";

/**
 * EU-merken via de officiële Trademark search-API van EUIPO (dev.euipo.europa.eu, versie 1.1.0).
 * Gratis; productietoegang vraagt een goedgekeurde test in de sandbox en een identiteitsbewijs.
 * EU-merken gelden ook in de Benelux. Benelux-merken zelf zitten hier niet in.
 *
 * Omgevingsvariabelen: EUIPO_CLIENT_ID en EUIPO_CLIENT_SECRET. Zonder EUIPO_OMGEVING=productie
 * praat de adapter met de sandbox, die testgegevens bevat en nooit voor echte checks mag dienen.
 */
const OMGEVINGEN = {
  sandbox: {
    api: "https://api-sandbox.euipo.europa.eu/trademark-search",
    token: "https://auth-sandbox.euipo.europa.eu/oidc/accessToken",
  },
  productie: {
    api: "https://api.euipo.europa.eu/trademark-search",
    token: "https://euipo.europa.eu/cas-server-webapp/oidc/accessToken",
  },
} as const;

/** Een merk dat vrijwel zeker in het register staat. Levert dit niets op, dan klopt er iets niet met de bron. */
const TESTNAAM = "EUIPO";
const PAGINA = 100;
const MAX_PAGINAS = 3;

const STATUS: Record<string, Hit["status"]> = {
  RECEIVED: "aangevraagd",
  UNDER_EXAMINATION: "aangevraagd",
  ACCEPTANCE_PENDING: "aangevraagd",
  APPLICATION_PUBLISHED: "gepubliceerd",
  START_OF_OPPOSITION_PERIOD: "gepubliceerd",
  OPPOSITION_PENDING: "gepubliceerd",
  REGISTRATION_PENDING: "gepubliceerd",
  APPEALED: "gepubliceerd",
  APPEALABLE: "gepubliceerd",
  REGISTERED: "ingeschreven",
  ACCEPTED: "ingeschreven",
  CANCELLATION_PENDING: "ingeschreven",
  WITHDRAWN: "vervallen",
  REFUSED: "vervallen",
  CANCELLED: "vervallen",
  SURRENDERED: "vervallen",
  EXPIRED: "vervallen",
  REMOVED_FROM_REGISTER: "vervallen",
};
const VERVALLEN = Object.entries(STATUS)
  .filter(([, s]) => s === "vervallen")
  .map(([k]) => k);

type Item = {
  applicationNumber: string;
  niceClasses: number[];
  status: string;
  wordMarkSpecification?: { verbalElement: string };
  applicants?: { name: string }[];
};
type Resultaat = { trademarks: Item[]; totalPages: number };

/** Tekens met een betekenis in RSQL halen we uit de zoekterm; de API kent geen manier om ze te ontwijken binnen een wildcard. */
const veilig = (term: string) => term.replace(/["'();,=!~<>*\\]/g, " ").replace(/\s+/g, " ").trim();

export function euipoQuery(term: string, opts: { classes?: number[]; activeOnly: boolean }): string {
  const delen = [`wordMarkSpecification.verbalElement=="*${veilig(term)}*"`];
  if (opts.classes?.length) delen.push(`niceClasses=in=(${opts.classes.join(",")})`);
  if (opts.activeOnly) delen.push(`status=out=(${VERVALLEN.join(",")})`);
  return delen.join(" and ");
}

export function euipoNaarHit(item: Item, gevondenMet: string): Hit | null {
  const merk = item.wordMarkSpecification?.verbalElement?.trim();
  if (!merk) return null;
  const parsed = hitSchema.safeParse({
    bron: "euipo",
    merk,
    houder: item.applicants?.map((a) => a.name).join("; ") || null,
    nummer: item.applicationNumber,
    klassen: item.niceClasses,
    // Een onbekende status behandelen we als actief: liever een treffer te veel dan een gemist conflict.
    status: STATUS[item.status] ?? "aangevraagd",
    registerUrl: `https://euipo.europa.eu/eSearch/#details/trademarks/${item.applicationNumber}`,
    gevondenMet,
  });
  return parsed.success ? parsed.data : null;
}

export function maakEuipoBron(env: Record<string, string | undefined> = process.env): RegisterSource {
  const omgeving = OMGEVINGEN[env.EUIPO_OMGEVING === "productie" ? "productie" : "sandbox"];
  let token: { waarde: string; verloopt: number } | null = null;

  async function haalToken(): Promise<string> {
    if (token && token.verloopt > Date.now() + 60_000) return token.waarde;
    const id = env.EUIPO_CLIENT_ID;
    const geheim = env.EUIPO_CLIENT_SECRET;
    if (!id || !geheim) throw new Error("EUIPO_CLIENT_ID of EUIPO_CLIENT_SECRET ontbreekt.");
    const res = await fetch(omgeving.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: geheim, grant_type: "client_credentials", scope: "uid" }),
    });
    if (!res.ok) throw new Error(`EUIPO gaf geen toegang (${res.status}).`);
    const json = (await res.json()) as { access_token: string; expires_in?: number };
    token = { waarde: json.access_token, verloopt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return token.waarde;
  }

  async function pagina(query: string, page: number): Promise<Resultaat> {
    const url = new URL(`${omgeving.api}/trademarks`);
    url.searchParams.set("query", query);
    url.searchParams.set("size", String(PAGINA));
    url.searchParams.set("page", String(page));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await haalToken()}`, "X-IBM-Client-Id": env.EUIPO_CLIENT_ID ?? "", Accept: "application/json" },
    });
    if (res.status === 429) throw new Error("EUIPO: te veel zoekopdrachten, probeer het later opnieuw.");
    if (!res.ok) throw new Error(`EUIPO gaf een fout (${res.status}).`);
    return (await res.json()) as Resultaat;
  }

  async function search(term: string, opts: { classes?: number[]; activeOnly: boolean }): Promise<Hit[]> {
    if (!veilig(term)) return [];
    const query = euipoQuery(term, opts);
    const hits: Hit[] = [];
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const r = await pagina(query, p);
      for (const item of r.trademarks) {
        const hit = euipoNaarHit(item, term);
        if (hit) hits.push(hit);
      }
      if (p + 1 >= r.totalPages) break;
    }
    return hits;
  }

  return {
    id: "euipo",
    search,
    async health() {
      try {
        const hits = await search(TESTNAAM, { activeOnly: false });
        return hits.length ? { ok: true } : { ok: false, note: "De testzoekopdracht gaf geen treffers." };
      } catch (error) {
        return { ok: false, note: error instanceof Error ? error.message : "Onbekende fout." };
      }
    },
  };
}
