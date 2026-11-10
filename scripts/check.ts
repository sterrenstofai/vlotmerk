import Anthropic from "@anthropic-ai/sdk";
import { euro } from "@/lib/config/tarieven";
import { pipelineFoutmelding } from "@/lib/pipeline/claude";
import { adviseerKlassen } from "@/lib/pipeline/klassen";
import { beoordeelOnderscheidendVermogen } from "@/lib/pipeline/onderscheidend";
import { DISCLAIMER } from "@/lib/schema/pipeline";
import { checkInvoerSchema } from "@/lib/schema/records";

/**
 * Stap 1 en 2 van de pipeline voor één naam, vanaf de opdrachtregel:
 *
 *   npm run check -- "Trapvonk" "Fietsenwinkel met werkplaats"
 */
async function main() {
  const [naam, omschrijving] = process.argv.slice(2);
  const invoer = checkInvoerSchema.safeParse({ naam, omschrijving });
  if (!invoer.success) {
    console.error(`Gebruik: npm run check -- "Naam" "Wat je doet"\n${invoer.error.issues.map((i) => i.message).join("\n")}`);
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Geen ANTHROPIC_API_KEY gevonden. Zet de sleutel in de omgeving en probeer het opnieuw.");
    process.exit(2);
  }

  const client = new Anthropic();
  try {
    const [onderscheidend, klassen] = await Promise.all([
      beoordeelOnderscheidendVermogen(client, invoer.data),
      adviseerKlassen(client, invoer.data),
    ]);

    console.log(`\n${invoer.data.naam}\n`);
    console.log(`Onderscheidend vermogen: ${onderscheidend.resultaat.oordeel}`);
    console.log(onderscheidend.resultaat.uitleg);
    for (const g of onderscheidend.resultaat.gronden) {
      console.log(`  ${g.grond.padEnd(14)} ${String(g.score).padStart(3)}  ${g.toelichting}`);
    }

    console.log("\nKlassen");
    for (const k of klassen.resultaat.klassen) {
      const prijs = k.meerkosten ? `+ ${euro(k.meerkosten)}` : "in basistarief";
      console.log(`  ${k.klasse}${k.kern ? "" : " (optie)"}  ${prijs}  ${k.waarom}`);
      for (const t of k.termen) console.log(`      ${t.term}${t.gevalideerd ? "" : "  (nog niet gecontroleerd)"}`);
    }
    console.log(klassen.resultaat.toelichting);

    const duur = Math.max(onderscheidend.verbruik.duurMs, klassen.verbruik.duurMs);
    console.log(`\n${DISCLAIMER}`);
    console.log(`Duur: ${(duur / 1000).toFixed(1)} seconden.`);
  } catch (error) {
    console.error(pipelineFoutmelding(error));
    process.exit(1);
  }
}

main();
