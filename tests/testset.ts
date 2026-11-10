import type { OnderscheidendVermogen, Risico } from "@/lib/schema/pipeline";

type Oordeel = OnderscheidendVermogen["oordeel"];

/**
 * De acceptatietestset uit de bouwbrief (§10). Draai hem na elke wijziging aan prompts of scoring:
 * npm run testset
 *
 * Bestaande merken staan hier alleen als naam die een conflict moet opleveren. Dit zijn testgegevens,
 * geen voorbeelden voor de site.
 */
export type TestCase = {
  naam: string;
  omschrijving: string;
  soort: "beschrijvend" | "grensgeval" | "verzonnen" | "misleidend" | "conflict";
  /** Elk oordeel in deze lijst is goed. Grensgevallen staan er met twee. */
  onderscheidend: Oordeel[];
  /** Minstens één van deze klassen moet als kernklasse in het advies staan. */
  klassen?: number[];
  /** Verwacht risico uit de registers. Pas te toetsen als stap 4 en 5 er zijn (sessie 3 en 4). */
  conflict?: { risico: Risico[]; waarom: string };
};

export const TESTSET: TestCase[] = [
  // Beschrijvend, gangbaar, lovend of geografisch: zwak
  { naam: "Snelle Fietsen", omschrijving: "Fietsenwinkel met stadsfietsen en e-bikes.", soort: "beschrijvend", onderscheidend: ["zwak"], klassen: [35] },
  { naam: "De Bakker", omschrijving: "Ambachtelijke bakkerij met brood en gebak.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Super Schoon", omschrijving: "Schoonmaakbedrijf voor kantoren en trappenhuizen.", soort: "beschrijvend", onderscheidend: ["zwak"], klassen: [37] },
  { naam: "Beste Koffie", omschrijving: "Koffiebranderij die bonen verkoopt aan particulieren en horeca.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Amsterdamse Kaas", omschrijving: "Kaaswinkel in Amsterdam met eigen gerijpte kazen.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Online Boekhouder", omschrijving: "Boekhoudsoftware in de browser voor zzp'ers.", soort: "beschrijvend", onderscheidend: ["zwak"], klassen: [42, 9] },
  { naam: "Fresh Bread", omschrijving: "Bakkerij die dagelijks vers brood bezorgt.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Schnell Reparatur", omschrijving: "Reparatie van telefoons en tablets, klaar terwijl je wacht.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Vélo Rapide", omschrijving: "Fietskoeriers die pakketten bezorgen in de stad.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Eco Verf", omschrijving: "Milieuvriendelijke muurverf en lak voor consumenten.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Premium Vloeren", omschrijving: "Verkoop en leggen van houten vloeren en pvc.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Hypotheekadvies Utrecht", omschrijving: "Onafhankelijk hypotheekadvies voor starters en doorstromers.", soort: "beschrijvend", onderscheidend: ["zwak"] },
  { naam: "Fietsreparatie", omschrijving: "Werkplaats voor onderhoud en reparatie van fietsen.", soort: "beschrijvend", onderscheidend: ["zwak"], klassen: [37] },
  { naam: "Kwaliteitsslager", omschrijving: "Slagerij met vlees van boeren uit de streek.", soort: "beschrijvend", onderscheidend: ["zwak"] },

  // Toespelingen en grensgevallen
  { naam: "Fietsvriend", omschrijving: "Fietsenwinkel met werkplaats.", soort: "grensgeval", onderscheidend: ["twijfel", "sterk"] },
  { naam: "Bakkie", omschrijving: "Koffiebar met afhaalkoffie en gebak.", soort: "grensgeval", onderscheidend: ["twijfel", "zwak"], klassen: [43] },
  { naam: "Puur Groen", omschrijving: "Hoveniersbedrijf voor aanleg en onderhoud van tuinen.", soort: "grensgeval", onderscheidend: ["twijfel", "zwak"] },
  { naam: "Wolkenwerk", omschrijving: "Hosting en beheer van servers in de cloud voor het mkb.", soort: "grensgeval", onderscheidend: ["twijfel", "sterk"] },

  // Verzonnen woorden en bestaande woorden zonder verband: sterk
  { naam: "Trapvonk", omschrijving: "Fietsenwinkel met werkplaats. We verkopen stadsfietsen en e-bikes en repareren alle merken.", soort: "verzonnen", onderscheidend: ["sterk"], klassen: [35, 37] },
  { naam: "Zulvero", omschrijving: "Boekhoudsoftware in de browser voor zzp'ers.", soort: "verzonnen", onderscheidend: ["sterk"], klassen: [42, 9] },
  { naam: "Kwiblo", omschrijving: "Houten speelgoed voor peuters, eigen ontwerp.", soort: "verzonnen", onderscheidend: ["sterk"], klassen: [28] },
  { naam: "Morvanti", omschrijving: "Kledingmerk met jassen en truien voor volwassenen.", soort: "verzonnen", onderscheidend: ["sterk"], klassen: [25] },
  { naam: "Kameel", omschrijving: "Boekhoudsoftware in de browser voor zzp'ers.", soort: "verzonnen", onderscheidend: ["sterk"] },
  { naam: "Lantaarn", omschrijving: "Accountantskantoor voor het mkb.", soort: "verzonnen", onderscheidend: ["sterk"] },
  { naam: "Brumzo", omschrijving: "Verhuur van personenauto's en bestelbussen.", soort: "verzonnen", onderscheidend: ["sterk"], klassen: [39] },
  { naam: "Vintro", omschrijving: "Ontwerp en plaatsing van keukens op maat.", soort: "verzonnen", onderscheidend: ["sterk"] },
  { naam: "Nimbelo", omschrijving: "Yogastudio met lessen en workshops.", soort: "verzonnen", onderscheidend: ["sterk"], klassen: [41] },

  // Misleidend
  { naam: "Bio Puur", omschrijving: "Chemische schoonmaakmiddelen voor de industrie, niet biologisch.", soort: "misleidend", onderscheidend: ["zwak"] },
  { naam: "Swiss Timepieces", omschrijving: "Horloges die in China worden gemaakt en online worden verkocht.", soort: "misleidend", onderscheidend: ["zwak"] },

  // Conflicten: het onderscheidend vermogen is in orde, het risico zit in het register
  {
    naam: "Coolblue",
    omschrijving: "Webwinkel in elektronica en witgoed.",
    soort: "conflict",
    onderscheidend: ["sterk", "twijfel"],
    conflict: { risico: ["hoog"], waarom: "Identiek aan een bekend ingeschreven merk in dezelfde klasse." },
  },
  {
    naam: "Koolbloe",
    omschrijving: "Webwinkel in elektronica en witgoed.",
    soort: "conflict",
    onderscheidend: ["sterk", "twijfel"],
    conflict: { risico: ["hoog", "middel"], waarom: "Klinkt hetzelfde als een bekend merk in dezelfde klasse." },
  },
  {
    naam: "Hema",
    omschrijving: "Warenhuis met huishoudelijke artikelen, kleding en eten.",
    soort: "conflict",
    onderscheidend: ["sterk"],
    conflict: { risico: ["hoog"], waarom: "Identiek aan een bekend ingeschreven merk in dezelfde klassen." },
  },
  {
    naam: "Gazelle",
    omschrijving: "Accountantskantoor voor het mkb.",
    soort: "conflict",
    onderscheidend: ["sterk"],
    conflict: { risico: ["laag", "middel"], waarom: "Identiek aan een ingeschreven merk, maar voor heel andere producten." },
  },
];

/** De bouwbrief vraagt minimaal 90% goed. */
export const SLAAGGRENS = 0.9;
