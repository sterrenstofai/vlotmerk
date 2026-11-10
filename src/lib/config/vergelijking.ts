/**
 * Prijzen van anderen, voor de vergelijking op de landingspagina.
 * Alles hier is een bewering over een ander: houd de bron en de peildatum erbij en peil opnieuw voor livegang.
 *
 * De kop claimt "de goedkoopste merkregistratie van Nederland". Onderbouwing: onze eigen prijs (check plus
 * depotdossier); het BOIP-tarief betaalt de klant rechtstreeks aan BOIP.
 * Risico: i24.nl bood op de peildatum een Benelux-registratie aan voor EUR 319 (1 klasse, excl. btw).
 * Op die pagina staat niet of het BOIP-tarief van EUR 244 daarin zit. Zit het erin, dan is i24 voor de klant
 * in totaal goedkoper dan wij en houdt de claim geen stand. Navragen bij i24 voor livegang.
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
