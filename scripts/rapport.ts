import Anthropic from "@anthropic-ai/sdk";
import { euro } from "@/lib/config/tarieven";
import { pipelineFoutmelding } from "@/lib/pipeline/claude";
import { maakRapport } from "@/lib/pipeline/rapport";
import { isActief } from "@/lib/pipeline/scoren";
import { DISCLAIMER, EINDOORDEEL_LABEL } from "@/lib/schema/pipeline";
import { checkInvoerSchema } from "@/lib/schema/records";
import { beneluxNietGekoppeld } from "@/lib/sources/benelux";
import { maakEuipoBron } from "@/lib/sources/euipo";
import { geheugenCache } from "@/lib/sources/zoek";

/**
 * Het volledige rapport voor één naam, vanaf de opdrachtregel:
 *
 *   npm run rapport -- "Trapvonk" "Fietsenwinkel met werkplaats"
 *
 * Heeft ANTHROPIC_API_KEY, EUIPO_CLIENT_ID en EUIPO_CLIENT_SECRET nodig en kost geld per run.
 */
async function main() {
  const [naam, omschrijving] = process.argv.slice(2);
  const invoer = checkInvoerSchema.safeParse({ naam, omschrijving });
  if (!invoer.success) {
    console.error(`Gebruik: npm run rapport -- "Naam" "Wat je doet"\n${invoer.error.issues.map((i) => i.message).join("\n")}`);
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Geen ANTHROPIC_API_KEY gevonden. Zet de sleutel in de omgeving en probeer het opnieuw.");
    process.exit(2);
  }

  const start = Date.now();
  try {
    const { rapport: r, stappen } = await maakRapport(new Anthropic(), invoer.data, {
      bronnen: [maakEuipoBron(), beneluxNietGekoppeld],
      cache: geheugenCache(),
    });
    const actief = r.hits.filter(isActief);

    console.log(`\n${invoer.data.naam}: ${EINDOORDEEL_LABEL[r.eindoordeel.uitkomst]}\n`);
    console.log(r.eindoordeel.samenvatting);
    console.log(`\nOnderscheidend vermogen: ${r.absoluteGronden.oordeel}`);
    console.log(`Klassen: ${r.klassen.klassen.map((k) => `${k.klasse}${k.kern ? "" : " (optie)"}`).join(", ")}`);
    console.log(`Varianten (${r.varianten.length}): ${r.varianten.map((v) => v.term).join(", ")}`);
    console.log("\nRegisters");
    for (const b of r.bronnen) console.log(`  ${b.bron}: ${b.ok ? "doorzocht" : `NIET BEREIKBAAR - ${b.melding}`}`);
    console.log(`\nTreffers: ${r.hits.length} beoordeeld, ${actief.filter((h) => h.risico !== "laag").length} met verhoogd risico`);
    for (const h of actief.filter((x) => x.risico !== "laag").slice(0, 15)) {
      const s = h.scores;
      console.log(`  ${h.risico.padEnd(6)} ${h.merk} (${h.bron} ${h.nummer}, kl ${h.klassen.join(",")})`);
      console.log(`         beeld ${s.visueel} klank ${s.auditief} betekenis ${s.begripsmatig} soort ${s.soortgelijkheid}${s.bekendMerk ? " bekend merk" : ""}`);
      console.log(`         ${h.uitleg}`);
    }
    console.log(`\nDomeinnamen: ${r.aanvullend.domeinen.map((d) => `${d.domein} ${d.status}`).join(", ")}`);
    if (r.eindoordeel.aandachtspunten.length) {
      console.log("\nAandachtspunten");
      for (const a of r.eindoordeel.aandachtspunten) console.log(`  - ${a}`);
    }
    console.log(`\nVolgende stap: ${r.eindoordeel.volgendeStap}`);
    console.log(`Kosten: ${euro(r.eindoordeel.kosten.totaal)} (BOIP ${euro(r.eindoordeel.kosten.boip)} + dossier ${euro(r.eindoordeel.kosten.onzeDienst)})`);

    const verbruik = stappen.flatMap((s) => s.verbruik);
    console.log(`\n${DISCLAIMER}`);
    console.log(
      `Duur: ${((Date.now() - start) / 1000).toFixed(1)} seconden. Verbruik: ${verbruik.reduce((n, v) => n + v.input, 0)} tokens in, ${verbruik.reduce((n, v) => n + v.output, 0)} tokens uit.`,
    );
  } catch (error) {
    console.error(pipelineFoutmelding(error), error instanceof Error ? `(${error.message})` : "");
    process.exit(1);
  }
}

main();
