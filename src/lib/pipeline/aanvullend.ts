import { aanvullendSchema, type Aanvullend } from "@/lib/schema/pipeline";

type Status = Aanvullend["domeinen"][number]["status"];

/** Maakt van een merknaam het deel van een domeinnaam voor de punt. Leeg als er niets bruikbaars overblijft. */
export function domeinLabel(naam: string): string {
  return naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "en")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 63);
}

/**
 * De RDAP-servers van de registers zelf, uit de lijst van IANA (data.iana.org/rdap/dns.json).
 * .eu staat daar niet in: EURid biedt geen RDAP aan, dus .eu kunnen we niet betrouwbaar controleren.
 */
const RDAP: Record<string, string> = {
  nl: "https://rdap.sidn.nl/domain/",
  com: "https://rdap.verisign.com/com/v1/domain/",
};

/**
 * Vraagt het register of een domeinnaam geregistreerd is. 404 betekent vrij, 200 betekent bezet.
 * Elk ander antwoord, geen antwoord of een extensie zonder server is "onbekend": we zeggen nooit "vrij"
 * zonder dat het register dat zegt.
 */
export async function domeinStatus(domein: string, haal: typeof fetch = fetch): Promise<Status> {
  const server = RDAP[domein.split(".").pop() ?? ""];
  if (!server) return "onbekend";
  try {
    const res = await haal(`${server}${domein}`, { headers: { Accept: "application/rdap+json" }, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return "vrij";
    return res.ok ? "bezet" : "onbekend";
  } catch {
    return "onbekend";
  }
}

/** Stap 6 van de pipeline: domeinnamen. De controle op handelsnamen (KvK) is nog niet gekoppeld en blijft null. */
export async function aanvullendeChecks(naam: string, extensies = ["nl", "com"], haal: typeof fetch = fetch): Promise<Aanvullend> {
  const label = domeinLabel(naam);
  const domeinen = label
    ? await Promise.all(extensies.map(async (ext) => ({ domein: `${label}.${ext}`, status: await domeinStatus(`${label}.${ext}`, haal) })))
    : [];
  return aanvullendSchema.parse({ domeinen, handelsnamen: null });
}
