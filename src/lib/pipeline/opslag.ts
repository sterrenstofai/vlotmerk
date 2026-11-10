import { createAdminClient } from "@/lib/supabase/admin";
import type { Verbruik } from "./claude";

/**
 * Schrijft de ruwe uitvoer van een pipeline-stap weg, zodat een oordeel achteraf te reconstrueren is (bouwbrief §3).
 * Een mislukte schrijfactie breekt de check niet af, maar wordt wel gelogd.
 */
export async function slaStapOp(checkId: string, stap: number, ruw: unknown, verbruik?: Verbruik) {
  const { error } = await createAdminClient().from("check_steps").insert({
    check_id: checkId,
    stap,
    ruwe_uitvoer: { uitvoer: ruw, tokens: verbruik ? { input: verbruik.input, output: verbruik.output } : null },
    model: verbruik?.model ?? null,
    duur_ms: verbruik?.duurMs ?? null,
  });
  if (error) console.error(`check ${checkId}: stap ${stap} niet opgeslagen`, error.message);
}
