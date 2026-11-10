import type { RegisterSource } from "./types";

/**
 * Het Benelux-register is nog niet gekoppeld. BOIP heeft geen openbare zoek-API; de opties zijn een
 * abonnement op Datoliet bij BOIP of een scraper-dienst op TMview. Tot die keuze gemaakt is, meldt deze
 * bron zich als niet bereikbaar. Zo toont de check "register niet bereikbaar" en nooit "geen conflicten".
 */
export const beneluxNietGekoppeld: RegisterSource = {
  id: "boip",
  async search() {
    throw new Error("Het Benelux-register is nog niet gekoppeld.");
  },
  async health() {
    return { ok: false, note: "Het Benelux-register is nog niet gekoppeld." };
  },
};
