import assert from "node:assert/strict";
import { deterministischeVarianten, gratisVarianten, voegSamen } from "@/lib/pipeline/varianten";
import type { Hit } from "@/lib/schema/pipeline";
import { beneluxNietGekoppeld } from "@/lib/sources/benelux";
import { euipoNaarHit, euipoQuery } from "@/lib/sources/euipo";
import type { RegisterSource } from "@/lib/sources/types";
import { aantalTreffers, cacheSleutel, geheugenCache, zoekInBron, zoekInBronnen } from "@/lib/sources/zoek";

/**
 * Toetst de zoeklaag zonder netwerk en zonder kosten: npm run test:bronnen
 * De belangrijkste regel: een uitgevallen bron mag nooit op "geen conflicten" lijken.
 */
const hit = (nummer: string, merk = "TESTMERK"): Hit => ({
  bron: "euipo",
  merk,
  houder: null,
  nummer,
  klassen: [35],
  status: "ingeschreven",
  registerUrl: null,
  gevondenMet: "test",
});

function nepBron(opts: { gezond?: boolean; hits?: Record<string, Hit[]>; gooit?: string } = {}): RegisterSource & { aanroepen: string[] } {
  const aanroepen: string[] = [];
  return {
    id: "euipo",
    aanroepen,
    async search(term) {
      aanroepen.push(term);
      if (opts.gooit === term) throw new Error("verbinding verbroken");
      return opts.hits?.[term] ?? [];
    },
    async health() {
      return opts.gezond === false ? { ok: false, note: "testnaam gaf niets" } : { ok: true };
    },
  };
}

const tests: [string, () => Promise<void> | void][] = [
  [
    "een bron die de gezondheidscheck niet haalt, is niet bereikbaar",
    async () => {
      const bron = nepBron({ gezond: false });
      const u = await zoekInBron(bron, ["Trapvonk"], { activeOnly: true });
      assert.equal(u.ok, false);
      assert.equal(bron.aanroepen.length, 0, "er wordt niet gezocht in een ongezonde bron");
    },
  ],
  [
    "een fout halverwege maakt de hele bron niet bereikbaar, ook als eerdere varianten treffers gaven",
    async () => {
      const bron = nepBron({ hits: { Trapvonk: [hit("1")] }, gooit: "Trapfonk" });
      const u = await zoekInBron(bron, ["Trapvonk", "Trapfonk"], { activeOnly: true });
      assert.equal(u.ok, false);
    },
  ],
  [
    "het Benelux-register is nog niet gekoppeld en meldt zich als niet bereikbaar",
    async () => {
      const u = await zoekInBron(beneluxNietGekoppeld, ["Trapvonk"], { activeOnly: true });
      assert.equal(u.ok, false);
    },
  ],
  [
    "met één uitgevallen bron is er geen totaal aantal treffers",
    async () => {
      const uitkomsten = await zoekInBronnen([nepBron(), beneluxNietGekoppeld], ["Trapvonk"], { activeOnly: true });
      assert.equal(aantalTreffers(uitkomsten), null);
      assert.equal(aantalTreffers([uitkomsten[0]]), 0);
    },
  ],
  [
    "een gezonde bron zonder treffers geeft nul treffers, niet 'niet bereikbaar'",
    async () => {
      const u = await zoekInBron(nepBron(), ["Trapvonk"], { activeOnly: true });
      assert.deepEqual(u, { ok: true, bron: "euipo", hits: [], zoekopdrachten: 1 });
    },
  ],
  [
    "hetzelfde merk bij twee varianten telt één keer",
    async () => {
      const bron = nepBron({ hits: { Trapvonk: [hit("1"), hit("2")], Trapfonk: [hit("2"), hit("3")] } });
      const u = await zoekInBron(bron, ["Trapvonk", "Trapfonk"], { activeOnly: true });
      assert.ok(u.ok);
      assert.deepEqual(u.hits.map((h) => h.nummer), ["1", "2", "3"]);
    },
  ],
  [
    "een tweede zoekopdracht binnen 24 uur komt uit de cache",
    async () => {
      const cache = geheugenCache();
      const bron = nepBron({ hits: { Trapvonk: [hit("1")] } });
      await zoekInBron(bron, ["Trapvonk"], { activeOnly: true }, cache);
      const tweede = await zoekInBron(bron, ["trapvonk "], { activeOnly: true }, cache);
      assert.ok(tweede.ok);
      assert.equal(tweede.zoekopdrachten, 0);
      assert.equal(tweede.hits.length, 1);
      assert.equal(bron.aanroepen.length, 1);
      const andereKlassen = await zoekInBron(bron, ["Trapvonk"], { activeOnly: true, classes: [35] }, cache);
      assert.ok(andereKlassen.ok);
      assert.equal(andereKlassen.zoekopdrachten, 1, "andere zoekopties zijn een andere zoekopdracht");
    },
  ],
  [
    "de cachesleutel negeert hoofdletters en de volgorde van klassen",
    () => {
      assert.equal(cacheSleutel(" Trapvonk", { activeOnly: true, classes: [37, 35] }), cacheSleutel("trapvonk", { activeOnly: true, classes: [35, 37] }));
    },
  ],
  [
    "de EUIPO-zoekvraag ontdoet de term van tekens met een betekenis in de zoektaal",
    () => {
      const q = euipoQuery('Trap"vonk);status==REGISTERED', { activeOnly: true, classes: [35, 37] });
      assert.ok(q.startsWith('wordMarkSpecification.verbalElement=="*Trap vonk status REGISTERED*"'), q);
      assert.ok(q.includes("niceClasses=in=(35,37)"));
      assert.ok(q.includes("status=out=("));
      assert.ok(!euipoQuery("Trapvonk", { activeOnly: false }).includes("status"));
    },
  ],
  [
    "een EUIPO-merk wordt een treffer; een onbekende status geldt als actief",
    () => {
      const h = euipoNaarHit({ applicationNumber: "018692868", niceClasses: [12], status: "IETS_NIEUWS", wordMarkSpecification: { verbalElement: "TRAPVONK" } }, "Trapvonk");
      assert.equal(h?.status, "aangevraagd");
      assert.equal(h?.bron, "euipo");
      assert.equal(euipoNaarHit({ applicationNumber: "018692868", niceClasses: [12], status: "EXPIRED", wordMarkSpecification: { verbalElement: "X" } }, "x")?.status, "vervallen");
      assert.equal(euipoNaarHit({ applicationNumber: "018692868", niceClasses: [12], status: "REGISTERED" }, "x"), null, "een merk zonder woordelement is geen treffer");
    },
  ],
  [
    "vaste varianten: exact eerst, aaneen, klank en kernwoord",
    () => {
      const v = deterministischeVarianten("Trap-vonk Fietsen");
      assert.deepEqual(v[0], { term: "Trap-vonk Fietsen", soort: "exact" });
      assert.ok(v.some((x) => x.soort === "aaneen" && x.term === "TrapvonkFietsen"));
      assert.ok(v.some((x) => x.soort === "fonetisch" && x.term === "Trapfonkfietsen"));
      assert.ok(v.some((x) => x.soort === "dominant_woord"));
      assert.ok(deterministischeVarianten("Trapvonk").every((x) => x.soort !== "dominant_woord"));
    },
  ],
  [
    "samenvoegen: geen dubbelen, hooguit 25; de eerste check gebruikt hooguit drie zoekopdrachten",
    () => {
      const veel = Array.from({ length: 40 }, (_, i) => ({ term: `Naam${i}`, soort: "spelling" as const }));
      const alle = voegSamen([{ term: "Trapvonk", soort: "exact" }], [{ term: "trapvonk ", soort: "spelling" }], veel);
      assert.equal(alle.length, 25);
      assert.equal(alle[0].soort, "exact");
      assert.equal(alle.filter((x) => x.term.toLowerCase() === "trapvonk").length, 1);
      const gratis = gratisVarianten(deterministischeVarianten("Trap vonk"));
      assert.equal(gratis.length, 3);
      assert.equal(gratis[0].soort, "exact");
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
      console.log(`FOUT  ${naam}\n      ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }
  }
  console.log(`\n${tests.length - fout} van ${tests.length} goed.`);
  process.exit(fout ? 1 : 0);
}

main();
