import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/** Een fout met een melding die de gebruiker te zien krijgt. */
export class PipelineError extends Error {}

export type Verbruik = { model: string; input: number; output: number; duurMs: number };

/**
 * Eén vraag aan Claude met een antwoord in een vast schema.
 * Geeft naast het antwoord ook het verbruik terug, zodat elke stap zijn kosten en duur kan wegschrijven.
 */
export async function vraagClaude<S extends z.ZodType>(
  client: Anthropic,
  opts: { model: string; system: string; vraag: string; schema: S },
): Promise<{ antwoord: z.infer<S>; verbruik: Verbruik }> {
  const start = Date.now();
  const stream = client.messages.stream({
    model: opts.model,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.vraag }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new PipelineError("Deze naam kunnen we niet beoordelen. Probeer een andere naam.");
  if (message.stop_reason === "max_tokens") throw new PipelineError("De beoordeling werd te lang. Maak je omschrijving korter en probeer het opnieuw.");
  if (!message.parsed_output) throw new PipelineError("De beoordeling is niet gelukt. Probeer het opnieuw.");

  return {
    antwoord: message.parsed_output as z.infer<S>,
    verbruik: { model: opts.model, input: message.usage.input_tokens, output: message.usage.output_tokens, duurMs: Date.now() - start },
  };
}

/** Zet een fout om in een melding voor de gebruiker. */
export function pipelineFoutmelding(error: unknown): string {
  if (error instanceof PipelineError) return error.message;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "De check staat nog niet aan voor deze site.";
  }
  if (error instanceof Anthropic.RateLimitError) return "Het is nu te druk. Probeer het over een paar minuten opnieuw.";
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) {
    return "De verbinding viel weg tijdens de check. Probeer het opnieuw.";
  }
  return "De check is niet gelukt. Probeer het opnieuw.";
}
