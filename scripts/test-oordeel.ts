import assert from "node:assert/strict";
import { aanvullendeChecks, domeinLabel, domeinStatus } from "@/lib/pipeline/aanvullend";
import { bepaalUitkomst } from "@/lib/pipeline/eindoordeel";
import { bewerkingsafstand, klankGelijkenis, klankvorm, schrijfGelijkenis, voorselectieScore } from "@/lib/pipeline/gelijkenis";
import { risicoUitScores, voorselectie, zonderBeoordeling } from "@/lib/pipeline/scoren";
import { checkSchema } from "@/lib/schema/records";
import type { GescoordeHit, Hit } from "@/lib/schema/pipeline";
import trapvonk from "@/lib/seed/trapvonk.json";

/** Toetst de vaste regels van het scoren en het eindoordeel, zonder netwerk en zonder kosten: npm run test:oordeel */
const hit = (merk: string, extra: Partial<Hit> = {}): Hit => ({
  bron: "euipo",
  merk,
  houder: null,
  nummer: merk,
  klassen: [35],
  status: "ingeschreven",
  registerUrl: null,
  gevondenMet: "test",
  ...extra,
});
const scores = (visueel: number, auditief: number, begripsmatig: number, soortgelijkheid: number, bekendMerk = false) => ({
  visueel,
  auditief,
  begripsmatig,
  soortgelijkheid,
  bekendMerk,
});
const gescoord = (risico: GescoordeHit["risico"], s = scores(0.8, 0.8, 0, 0.8), extra: Partial<Hit> = {}): GescoordeHit => ({
  ...hit(`M-${Math.random()}`, extra),
  scores: { bewerkingsafstand: 1, fonetisch: 0.8, klassenOverlap: [], ...s },
  risico,
  uitleg: "test",
});
const beide = [
  { bron: "euipo", ok: true },
  { bron: "boip", ok: true },
];

const tests: [string, () => Promise<void> | void][] = [
  [
    "klank: schrijfwijzen die hetzelfde klinken komen op elkaar uit",
    () => {
      assert.equal(klankvorm("Trapvonck"), klankvorm("Trapfonk"));
      assert.equal(klankvorm("Coolblue"), klankvorm("Koolblue"));
      assert.equal(klankGelijkenis("Trapvonk", "Trapfonck"), 1);
      assert.ok(klankGelijkenis("Trapvonk", "Zulvero") < 0.3);
      assert.equal(bewerkingsafstand("Trapvonk", "TRAPVONCK"), 1);
      assert.equal(schrijfGelijkenis("Trap-Vonk", "trapvonk"), 1);
    },
  ],
  [
    "voorselectie: een merk dat de hele naam bevat telt zwaar, een toevallige lettergreep niet",
    () => {
      assert.ok(voorselectieScore("Trapvonk", "Trapvonk Fietsen") >= 0.75);
      assert.ok(voorselectieScore("Nike", "PHILHARMONIKER") >= 0.75, "bevat de naam, dus wel naar de beoordeling");
      assert.ok(voorselectieScore("Trapvonk", "Zonnebloem") < 0.45);
      const { beoordelen, rest } = voorselectie("Trapvonk", [hit("Zonnebloem"), hit("TRAPVONCK"), hit("Trapvonk")]);
      assert.deepEqual(beoordelen.map((h) => h.merk), ["Trapvonk", "TRAPVONCK"]);
      assert.deepEqual(rest.map((h) => h.merk), ["Zonnebloem"]);
    },
  ],
  [
    "voorselectie: hooguit veertig treffers naar Claude, de meest gelijkende eerst",
    () => {
      const veel = Array.from({ length: 60 }, (_, i) => hit(`Trapvonk${i}`, { nummer: String(i) }));
      const { beoordelen, rest } = voorselectie("Trapvonk", [...veel, hit("Trapvonk", { nummer: "exact" })]);
      assert.equal(beoordelen.length, 40);
      assert.equal(beoordelen[0].nummer, "exact");
      assert.equal(rest.length, 21);
    },
  ],
  [
    "een treffer zonder beoordeling krijgt risico laag en geldige scores",
    () => {
      const z = zonderBeoordeling("Trapvonk", hit("Zonnebloem", { klassen: [35, 12] }), [35, 37]);
      assert.equal(z.risico, "laag");
      assert.deepEqual(z.scores.klassenOverlap, [35]);
    },
  ],
  [
    "risico: gelijkend teken en soortgelijke producten is hoog",
    () => {
      assert.equal(risicoUitScores(scores(0.9, 1, 0, 0.9)), "hoog");
      assert.equal(risicoUitScores(scores(0.3, 0.75, 0, 0.6)), "hoog", "alleen in klank gelijk is genoeg");
    },
  ],
  [
    "risico: identieke naam voor heel andere producten is middel, niet laag",
    () => {
      assert.equal(risicoUitScores(scores(0.9, 1, 0.8, 0.05)), "middel");
      assert.equal(risicoUitScores(scores(1, 1, 1, 0)), "middel");
    },
  ],
  [
    "risico: een bekend merk is ook buiten zijn eigen producten hoog",
    () => {
      assert.equal(risicoUitScores(scores(0.95, 0.95, 0, 0.1, true)), "hoog");
      assert.equal(risicoUitScores(scores(0.4, 0.4, 0, 0.1, true)), "laag", "bekendheid alleen is niet genoeg");
    },
  ],
  [
    "risico: weinig gelijkenis is laag, ook in dezelfde klasse",
    () => {
      assert.equal(risicoUitScores(scores(0.4, 0.45, 0.1, 1)), "laag");
      assert.equal(risicoUitScores(scores(0.55, 0.5, 0, 0.7)), "middel");
      assert.equal(risicoUitScores(scores(0.75, 0.7, 0, 0.35)), "middel");
      assert.equal(risicoUitScores(scores(0.75, 0.7, 0, 0.2)), "laag");
    },
  ],
  [
    "risico: alleen dezelfde betekenis is nooit hoog",
    () => {
      assert.equal(risicoUitScores(scores(0.1, 0.1, 0.9, 0.9)), "middel");
      assert.equal(risicoUitScores(scores(0.1, 0.1, 0.6, 0.6)), "laag");
      assert.equal(risicoUitScores(scores(0.1, 0.1, 1, 0.1)), "laag");
    },
  ],
  [
    "de voorbeeldcheck heeft het risico dat de regels eraan geven",
    () => {
      const check = checkSchema.parse(trapvonk);
      for (const h of check.rapport!.hits.filter((x) => x.status !== "vervallen")) {
        assert.equal(h.risico, risicoUitScores(h.scores), h.merk);
      }
      assert.equal(bepaalUitkomst(check.rapport!.absoluteGronden.oordeel, check.rapport!.hits, check.rapport!.bronnen), check.rapport!.eindoordeel.uitkomst);
    },
  ],
  [
    "eindoordeel: een zwakke naam is niet doen, wat de registers ook zeggen",
    () => {
      assert.equal(bepaalUitkomst("zwak", [], beide), "niet_doen");
    },
  ],
  [
    "eindoordeel: een vrijwel identiek merk met hoog risico is niet doen; een gelijkend merk met hoog risico is riskant",
    () => {
      assert.equal(bepaalUitkomst("sterk", [gescoord("hoog", scores(1, 1, 0, 0.9))], beide), "niet_doen");
      assert.equal(bepaalUitkomst("sterk", [gescoord("hoog", scores(0.75, 0.8, 0, 0.9))], beide), "riskant");
    },
  ],
  [
    "eindoordeel: twijfel plus een middelhoog risico is riskant; elk apart is een aandachtspunt",
    () => {
      assert.equal(bepaalUitkomst("twijfel", [gescoord("middel")], beide), "riskant");
      assert.equal(bepaalUitkomst("twijfel", [], beide), "kan_met_aandachtspunten");
      assert.equal(bepaalUitkomst("sterk", [gescoord("middel")], beide), "kan_met_aandachtspunten");
    },
  ],
  [
    "eindoordeel: sterk en schoon is een sterke kandidaat, maar nooit met een uitgevallen register",
    () => {
      assert.equal(bepaalUitkomst("sterk", [gescoord("laag")], beide), "sterke_kandidaat");
      assert.equal(bepaalUitkomst("sterk", [], [{ bron: "euipo", ok: true }, { bron: "boip", ok: false }]), "kan_met_aandachtspunten");
      assert.equal(bepaalUitkomst("sterk", [], []), "kan_met_aandachtspunten", "zonder registers is er niets onderzocht");
    },
  ],
  [
    "eindoordeel: een vervallen merk telt niet mee",
    () => {
      assert.equal(bepaalUitkomst("sterk", [gescoord("hoog", scores(1, 1, 1, 1), { status: "vervallen" })], beide), "sterke_kandidaat");
    },
  ],
  [
    "domeinnaam: alleen 'vrij' als het register dat zegt",
    async () => {
      assert.equal(domeinLabel("Trap & Vonk Fietsen!"), "trapenvonkfietsen");
      const nep = (status: number) => (async () => new Response(null, { status })) as unknown as typeof fetch;
      assert.equal(await domeinStatus("x.nl", nep(404)), "vrij");
      assert.equal(await domeinStatus("x.nl", nep(200)), "bezet");
      assert.equal(await domeinStatus("x.nl", nep(503)), "onbekend");
      assert.equal(await domeinStatus("x.nl", (async () => { throw new Error("geen netwerk"); }) as unknown as typeof fetch), "onbekend");
      const a = await aanvullendeChecks("Trapvonk", ["nl", "com"], nep(404));
      assert.deepEqual(a, { domeinen: [{ domein: "trapvonk.nl", status: "vrij" }, { domein: "trapvonk.com", status: "vrij" }], handelsnamen: null });
    },
  ],
];

async function main() {
  let fout = 0;
  for (const [naam, test] of tests) {
    try {
      await test();
      console.log(`goed  ${naam}`);
    } catch (error) {
      fout++;
      console.log(`FOUT  ${naam}\n      ${error instanceof Error ? error.message.split("\n").slice(0, 3).join(" ") : error}`);
    }
  }
  console.log(`\n${tests.length - fout} van ${tests.length} goed.`);
  process.exit(fout ? 1 : 0);
}

main();
