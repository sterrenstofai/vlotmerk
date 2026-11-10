import { z } from "zod";
import {
  aanvullendSchema,
  bronIdSchema,
  bronUitkomstSchema,
  domeinCheckSchema,
  eindoordeelSchema,
  gescoordeHitSchema,
  klassenAdviesSchema,
  niceKlasseSchema,
  onderscheidendVermogenSchema,
  variantenSchema,
} from "./pipeline";

/**
 * Schema's voor wat de app opslaat en toont. De database gebruikt dezelfde namen
 * (supabase/migrations/0001_init.sql); deze schema's bewaken de inhoud van de jsonb-kolommen.
 */

export const gebiedSchema = z.enum(["benelux"]);

/** Wat de bezoeker invult. */
export const checkInvoerSchema = z.object({
  naam: z.string().trim().min(1, "Vul een naam in.").max(80, "Een merknaam is hooguit 80 tekens."),
  omschrijving: z
    .string()
    .trim()
    .min(10, "Beschrijf in een paar woorden wat je doet.")
    .max(1000, "Houd de omschrijving onder de 1000 tekens."),
  gebied: gebiedSchema.default("benelux"),
});
export type CheckInvoer = z.infer<typeof checkInvoerSchema>;

export const checkStatusSchema = z.enum([
  "nieuw",
  "gratis_bezig",
  "gratis_klaar",
  "rapport_bezig",
  "rapport_klaar",
  "mislukt",
]);

/** De drie blokken van de gratis check. */
export const gratisResultaatSchema = z.object({
  onderscheidend: onderscheidendVermogenSchema,
  register: z.object({
    bronnen: z.array(bronUitkomstSchema),
    /** Aantal exacte en bijna-exacte treffers; null als geen enkele bron bereikbaar was. */
    aantal: z.number().int().min(0).nullable(),
    belangrijkste: z.array(gescoordeHitSchema).max(3),
  }),
  domeinen: z.array(domeinCheckSchema),
});
export type GratisResultaat = z.infer<typeof gratisResultaatSchema>;

export const reportSchema = z.object({
  absoluteGronden: onderscheidendVermogenSchema,
  klassen: klassenAdviesSchema,
  varianten: variantenSchema,
  /** Per bron of hij bereikbaar was. Een onbereikbare bron staat in het rapport, niet weggelaten. */
  bronnen: z.array(z.object({ bron: bronIdSchema, ok: z.boolean(), melding: z.string().optional() })),
  hits: z.array(gescoordeHitSchema),
  aanvullend: aanvullendSchema,
  eindoordeel: eindoordeelSchema,
  pdfPad: z.string().nullable(),
});
export type Report = z.infer<typeof reportSchema>;

export const checkSchema = checkInvoerSchema.extend({
  id: z.string().min(1),
  status: checkStatusSchema,
  aangemaakt: z.iso.date(),
  gratisResultaat: gratisResultaatSchema.nullable(),
  rapport: reportSchema.nullable(),
});
export type Check = z.infer<typeof checkSchema>;

// ---------- Bestellingen ----------

export const orderTypeSchema = z.enum(["rapport", "depot", "bewaking"]);
export const orderStatusSchema = z.enum(["open", "paid", "failed", "canceled", "expired"]);

export const orderSchema = z.object({
  checkId: z.string(),
  type: orderTypeSchema,
  mollieId: z.string(),
  status: orderStatusSchema,
  bedrag: z.number().min(0),
});

// ---------- Depot ----------

export const houderSchema = z.object({
  naam: z.string().trim().min(1),
  rechtsvorm: z.string().trim().min(1),
  kvkNummer: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Een KvK-nummer heeft 8 cijfers.")
    .nullable(),
  straat: z.string().trim().min(1),
  postcode: z.string().trim().min(1),
  plaats: z.string().trim().min(1),
  land: z.enum(["NL", "BE", "LU"]),
});
export type Houder = z.infer<typeof houderSchema>;

export const filingSchema = z.object({
  checkId: z.string(),
  houder: houderSchema,
  /** Geen depotknop zonder bevestigde klassen. */
  klassen: klassenAdviesSchema.shape.klassen,
  klassenBevestigd: z.boolean(),
  /** A: de klant dient zelf in. B: wij dienen in (v2). */
  route: z.enum(["a", "b"]),
  status: z.enum(["concept", "klaar", "ingediend"]),
});

// ---------- Bewaking ----------

export const watchSchema = z.object({
  naam: z.string().min(1),
  klassen: z.array(niceKlasseSchema).min(1),
  varianten: variantenSchema,
  /** Inschrijfnummers per bron die bij de vorige run al gezien zijn. */
  laatstGezien: z.array(z.object({ bron: bronIdSchema, nummer: z.string() })),
  mollieAbonnement: z.string().nullable(),
  status: z.enum(["wacht_op_betaling", "actief", "gepauzeerd", "gestopt"]),
});

export const watchRunSchema = z.object({
  watchId: z.string(),
  gestart: z.iso.datetime(),
  klaar: z.iso.datetime().nullable(),
  aantalZoekopdrachten: z.number().int().min(0),
  /** Kosten van deze run in euro's, om te zien wanneer Datoliet goedkoper wordt. */
  kosten: z.number().min(0),
  ok: z.boolean(),
});

export const alertSchema = z.object({
  watchId: z.string(),
  hitId: z.string(),
  verzonden: z.iso.datetime().nullable(),
  oppositieDeadline: z.iso.date().nullable(),
});

// ---------- Cache ----------

export const sourceCacheSchema = z.object({
  bron: bronIdSchema,
  zoekterm: z.string(),
  resultaat: z.unknown(),
  opgehaald: z.iso.datetime(),
});

/** Zoekresultaten blijven 24 uur geldig. */
export const CACHE_UREN = 24;
