import Anthropic from "@anthropic-ai/sdk";
import { MODELLEN } from "@/lib/config/ai";
import { pipelineFoutmelding } from "@/lib/pipeline/claude";
import { adviseerKlassen } from "@/lib/pipeline/klassen";
import { beoordeelOnderscheidendVermogen } from "@/lib/pipeline/onderscheidend";
import { SLAAGGRENS, TESTSET, type TestCase } from "../tests/testset";

/**
 * Draait de testset tegen Claude en telt hoeveel oordelen kloppen.
 *
 *   npm run testset                              alle namen, alleen onderscheidend vermogen
 *   npm run testset -- --klassen                 ook het klassenadvies toetsen
 *   npm run testset -- --model claude-haiku-5-5  een ander model proberen
 *   npm run testset -- --alleen Trapvonk         één naam
 *
 * Elke run kost geld: reken op enkele centen per naam.
 */
const args = process.argv.slice(2);
const optie = (naam: string) => {
  const i = args.indexOf(`--${naam}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const model = optie("model") ?? MODELLEN.check;
const metKlassen = args.includes("--klassen");
const alleen = optie("alleen");
const TEGELIJK = 4;

type Uitkomst = { test: TestCase; goed: boolean; regels: string[]; input: number; output: number };

async function draai(client: Anthropic, test: TestCase): Promise<Uitkomst> {
  const invoer = { naam: test.naam, omschrijving: test.omschrijving, gebied: "benelux" as const };
  const regels: string[] = [];
  let goed = true;
  let input = 0;
  let output = 0;
  try {
    const { resultaat, verbruik } = await beoordeelOnderscheidendVermogen(client, invoer, model);
    input += verbruik.input;
    output += verbruik.output;
    const klopt = test.onderscheidend.includes(resultaat.oordeel);
    goed &&= klopt;
    const zwaarste = [...resultaat.gronden].sort((a, b) => b.score - a.score)[0];
    regels.push(
      `${klopt ? "goed" : "FOUT"}  onderscheidend: ${resultaat.oordeel} (verwacht ${test.onderscheidend.join(" of ")}), zwaarste grond ${zwaarste.grond} ${zwaarste.score}`,
    );
    if (!klopt) regels.push(`      ${resultaat.uitleg}`);

    if (metKlassen && test.klassen) {
      const advies = await adviseerKlassen(client, invoer, { model });
      input += advies.verbruik.input;
      output += advies.verbruik.output;
      const kern = advies.resultaat.klassen.filter((k) => k.kern).map((k) => k.klasse);
      const kloptKlasse = test.klassen.some((k) => kern.includes(k));
      goed &&= kloptKlasse;
      regels.push(`${kloptKlasse ? "goed" : "FOUT"}  klassen: ${kern.join(", ")} (verwacht ${test.klassen.join(" of ")})`);
    }
  } catch (error) {
    goed = false;
    regels.push(`FOUT  ${pipelineFoutmelding(error)} (${error instanceof Error ? error.message : String(error)})`);
  }
  return { test, goed, regels, input, output };
}

async function main() {
  const tests = alleen ? TESTSET.filter((t) => t.naam.toLowerCase() === alleen.toLowerCase()) : TESTSET;
  if (!tests.length) {
    console.error(`Geen testnaam "${alleen}" gevonden.`);
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Geen ANTHROPIC_API_KEY gevonden. Zet de sleutel in de omgeving en draai de testset opnieuw.");
    process.exit(2);
  }

  const client = new Anthropic();
  console.log(`Testset: ${tests.length} namen, model ${model}${metKlassen ? ", met klassenadvies" : ""}\n`);

  const uitkomsten: Uitkomst[] = [];
  const wachtrij = [...tests];
  await Promise.all(
    Array.from({ length: Math.min(TEGELIJK, wachtrij.length) }, async () => {
      for (let test = wachtrij.shift(); test; test = wachtrij.shift()) {
        const u = await draai(client, test);
        uitkomsten.push(u);
        console.log(`${u.test.naam} (${u.test.soort})`);
        for (const r of u.regels) console.log(`  ${r}`);
      }
    }),
  );

  const goed = uitkomsten.filter((u) => u.goed).length;
  const score = goed / uitkomsten.length;
  const input = uitkomsten.reduce((n, u) => n + u.input, 0);
  const output = uitkomsten.reduce((n, u) => n + u.output, 0);
  const conflicten = tests.filter((t) => t.conflict).length;

  console.log(`\n${goed} van ${uitkomsten.length} goed (${Math.round(score * 100)}%). De grens is ${SLAAGGRENS * 100}%.`);
  console.log(`Verbruik: ${input} tokens in, ${output} tokens uit.`);
  if (conflicten) console.log(`${conflicten} namen hebben ook een verwacht conflict. Dat is pas te toetsen als de registers gekoppeld zijn.`);
  const fout = uitkomsten.filter((u) => !u.goed).map((u) => u.test.naam);
  if (fout.length) console.log(`Niet goed: ${fout.join(", ")}`);
  process.exit(score >= SLAAGGRENS ? 0 : 1);
}

main();
