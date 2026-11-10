/**
 * Prijzen van anderen, voor de vergelijking op de landingspagina.
 * Alles hier is een bewering over een ander: houd de bron en de peildatum erbij en peil opnieuw voor livegang.
 *
 * Bewust geen claim "goedkoopste van Nederland": op de peildatum bood i24.nl een Benelux-registratie
 * aan voor EUR 319 (1 klasse, excl. btw), en zelf indienen bij BOIP kost alleen het BOIP-tarief.
 */
export const VERGELIJKING = {
  peildatum: "2026-11-10",
  /** Vanafprijzen voor een Benelux-depot in 1 klasse, zoals op de eigen website vermeld. */
  merkenbureaus: {
    laag: 525,
    hoog: 595,
    bronnen: [
      { prijs: 525, url: "https://www.merkenbureau-vanasselt.nl/merkregistratie-kosten/", opmerking: "all-in, incl. taksen, excl. btw" },
      { prijs: 550, url: "https://www.intellectueeleigendom.nl/merkregistratie/benelux/", opmerking: "niet vermeld of het BOIP-tarief erin zit" },
      { prijs: 595, url: "https://merk-echt.nl/tarieven-merkregistratie/", opmerking: "vanafprijs; niet vermeld of het BOIP-tarief erin zit" },
    ],
  },
} as const;
