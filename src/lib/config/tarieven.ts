import type { Kosten } from "@/lib/schema/pipeline";

/**
 * Alle bedragen op één plek, in euro's.
 * BOIP wijzigt zijn tarieven periodiek: controleer ze op boip.int en pas dan ook de datum aan.
 */
export const BOIP_TARIEVEN = {
  /** Datum waarop deze bedragen zijn nagekeken op boip.int/nl/ondernemers/merken/tarieven. */
  datum: "2026-11-10",
  gecontroleerdOpBoip: true,
  depotMetEersteKlasse: 244,
  tweedeKlasse: 27,
  derdeKlasseEnVerder: 81,
  spoedToeslagEersteKlasse: 196,
} as const;

/** Onze eigen prijzen, exclusief btw. */
export const PRIJZEN = {
  rapport: 19,
  depot: 79,
  bewakingPerMaand: 4,
} as const;

/** Wat een klasse extra kost bovenop het basistarief. De eerste klasse zit erin. */
export function meerkostenKlasse(positie: number): number {
  if (positie <= 1) return 0;
  return positie === 2 ? BOIP_TARIEVEN.tweedeKlasse : BOIP_TARIEVEN.derdeKlasseEnVerder;
}

export function boipKosten(aantalKlassen: number): number {
  let totaal = BOIP_TARIEVEN.depotMetEersteKlasse;
  for (let i = 2; i <= aantalKlassen; i++) totaal += meerkostenKlasse(i);
  return totaal;
}

/** Kosten van een depot via ons: BOIP-tarief plus onze dienst. */
export function berekenKosten(aantalKlassen: number): Kosten {
  const boip = boipKosten(aantalKlassen);
  return {
    tariefdatum: BOIP_TARIEVEN.datum,
    aantalKlassen,
    boip,
    onzeDienst: PRIJZEN.depot,
    totaal: boip + PRIJZEN.depot,
  };
}

export const euro = (bedrag: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: Number.isInteger(bedrag) ? 0 : 2 }).format(bedrag);
