import type { BronId, Hit } from "@/lib/schema/pipeline";

/**
 * Eén register achter een vaste interface (bouwbrief §4).
 * De pipeline kent alleen deze interface, zodat een bron te vervangen is zonder de pipeline aan te raken.
 */
export interface RegisterSource {
  id: BronId;
  search(query: string, opts: { classes?: number[]; activeOnly: boolean }): Promise<Hit[]>;
  /**
   * Zoekt een bekende testnaam. Nul treffers of een fout betekent: bron niet bereikbaar.
   * De check toont dan "register tijdelijk niet bereikbaar", nooit "geen conflicten".
   */
  health(): Promise<{ ok: boolean; note?: string }>;
}
