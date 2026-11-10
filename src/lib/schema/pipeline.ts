import { z } from "zod";

/**
 * Schema's voor de zeven stappen van de check-pipeline (bouwbrief §3).
 * Elke stap valideert zijn uitvoer hiermee voordat die in de database komt.
 */

export const risicoSchema = z.enum(["laag", "middel", "hoog"]);
export type Risico = z.infer<typeof risicoSchema>;

export const niceKlasseSchema = z.number().int().min(1).max(45);

/** Talen waarin BOIP op betekenis toetst. */
export const taalSchema = z.enum(["nl", "fr", "en", "de"]);

// ---------- Stap 1: onderscheidend vermogen (absolute gronden) ----------

export const absoluteGrondSchema = z.enum([
  "beschrijvend",
  "gangbaar",
  "lovend",
  "geografisch",
  "misleidend",
  "openbare_orde",
]);

export const grondScoreSchema = z.object({
  grond: absoluteGrondSchema,
  /** 0 = geen bezwaar, 100 = vrijwel zeker een weigering. */
  score: z.number().int().min(0).max(100),
  /** In welke taal of talen het bezwaar speelt. */
  talen: z.array(taalSchema),
  toelichting: z.string(),
});

export const onderscheidendOordeelSchema = z.enum(["sterk", "twijfel", "zwak"]);

export const onderscheidendVermogenSchema = z.object({
  gronden: z.array(grondScoreSchema).length(absoluteGrondSchema.options.length),
  oordeel: onderscheidendOordeelSchema,
  /** Twee zinnen in gewone taal. */
  uitleg: z.string().min(1),
});
export type OnderscheidendVermogen = z.infer<typeof onderscheidendVermogenSchema>;

// ---------- Stap 2: klassenadvies ----------

export const klasseTermSchema = z.object({
  term: z.string().min(1),
  /** Alleen termen uit de geharmoniseerde database mogen in een depot. */
  gevalideerd: z.boolean(),
  bron: z.enum(["euipo_gs", "tmclass"]).nullable(),
});

export const klasseAdviesSchema = z.object({
  klasse: niceKlasseSchema,
  termen: z.array(klasseTermSchema).min(1),
  waarom: z.string().min(1),
  /** Wat deze klasse extra kost bij BOIP, in euro's. De eerste klasse zit in het basistarief. */
  meerkosten: z.number().min(0),
  /** Smal advies is de standaard; optionele klassen maken het depot breder en duurder. */
  kern: z.boolean(),
});

export const klassenAdviesSchema = z.object({
  klassen: z.array(klasseAdviesSchema).min(1),
  toelichting: z.string(),
});
export type KlassenAdvies = z.infer<typeof klassenAdviesSchema>;

// ---------- Stap 3: zoekvarianten ----------

export const variantSoortSchema = z.enum([
  "exact",
  "aaneen",
  "meervoud",
  "spelling",
  "fonetisch",
  "vertaling",
  "dominant_woord",
]);

export const variantSchema = z.object({
  term: z.string().min(1),
  soort: variantSoortSchema,
  taal: taalSchema.optional(),
});

export const MAX_VARIANTEN = 25;
/** De gratis check zoekt alleen op de exacte en bijna-exacte varianten. */
export const MAX_GRATIS_ZOEKOPDRACHTEN = 3;

export const variantenSchema = z.array(variantSchema).min(1).max(MAX_VARIANTEN);
export type Variant = z.infer<typeof variantSchema>;

// ---------- Stap 4: treffers uit de registers ----------

export const bronIdSchema = z.enum(["boip", "euipo", "tmview"]);
export type BronId = z.infer<typeof bronIdSchema>;

export const merkStatusSchema = z.enum(["aangevraagd", "gepubliceerd", "ingeschreven", "vervallen"]);
export const ACTIEVE_STATUSSEN = ["aangevraagd", "gepubliceerd", "ingeschreven"] as const;

export const hitSchema = z.object({
  bron: bronIdSchema,
  merk: z.string().min(1),
  houder: z.string().nullable(),
  nummer: z.string().min(1),
  klassen: z.array(niceKlasseSchema),
  status: merkStatusSchema,
  registerUrl: z.url().nullable(),
  /** De variant waarmee deze treffer is gevonden. */
  gevondenMet: z.string(),
});
export type Hit = z.infer<typeof hitSchema>;

/**
 * Uitkomst van één bron. Een bron die uitvalt levert "onbereikbaar",
 * nooit een lege lijst: een kapotte bron mag niet op een schone uitslag lijken.
 */
export const bronUitkomstSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), bron: bronIdSchema, hits: z.array(hitSchema), zoekopdrachten: z.number().int().min(0) }),
  z.object({ ok: z.literal(false), bron: bronIdSchema, melding: z.string() }),
]);
export type BronUitkomst = z.infer<typeof bronUitkomstSchema>;

// ---------- Stap 5: scoren per treffer ----------

const nulTotEen = z.number().min(0).max(1);

export const hitScoresSchema = z.object({
  // Deterministisch
  bewerkingsafstand: z.number().int().min(0),
  fonetisch: nulTotEen,
  klassenOverlap: z.array(niceKlasseSchema),
  // Beoordeeld door Claude
  visueel: nulTotEen,
  auditief: nulTotEen,
  begripsmatig: nulTotEen,
  soortgelijkheid: nulTotEen,
  bekendMerk: z.boolean(),
});

export const gescoordeHitSchema = hitSchema.extend({
  scores: hitScoresSchema,
  risico: risicoSchema,
  /** Eén zin: waarom dit risico. */
  uitleg: z.string().min(1),
});
export type GescoordeHit = z.infer<typeof gescoordeHitSchema>;

// ---------- Stap 6: aanvullende checks ----------

export const beschikbaarheidSchema = z.enum(["vrij", "bezet", "onbekend"]);

export const domeinCheckSchema = z.object({
  domein: z.string().min(1),
  status: beschikbaarheidSchema,
});

export const handelsnaamTrefferSchema = z.object({
  naam: z.string(),
  kvkNummer: z.string(),
  plaats: z.string().nullable(),
});

export const aanvullendSchema = z.object({
  domeinen: z.array(domeinCheckSchema),
  /** Alleen in het betaalde rapport; null als de KvK-check niet is gedaan. */
  handelsnamen: z.array(handelsnaamTrefferSchema).nullable(),
});
export type Aanvullend = z.infer<typeof aanvullendSchema>;

// ---------- Stap 7: eindoordeel en kosten ----------

export const eindoordeelUitkomstSchema = z.enum([
  "sterke_kandidaat",
  "kan_met_aandachtspunten",
  "riskant",
  "niet_doen",
]);
export type EindoordeelUitkomst = z.infer<typeof eindoordeelUitkomstSchema>;

export const EINDOORDEEL_LABEL: Record<EindoordeelUitkomst, string> = {
  sterke_kandidaat: "Sterke kandidaat",
  kan_met_aandachtspunten: "Kan, met aandachtspunten",
  riskant: "Riskant",
  niet_doen: "Niet doen",
};

export const kostenSchema = z.object({
  /** Datum van het tarievenbestand waarmee is gerekend. */
  tariefdatum: z.iso.date(),
  aantalKlassen: z.number().int().min(1),
  boip: z.number().min(0),
  onzeDienst: z.number().min(0),
  totaal: z.number().min(0),
});
export type Kosten = z.infer<typeof kostenSchema>;

export const eindoordeelSchema = z.object({
  uitkomst: eindoordeelUitkomstSchema,
  samenvatting: z.string().min(1),
  aandachtspunten: z.array(z.string()),
  volgendeStap: z.string().min(1),
  kosten: kostenSchema,
});
export type Eindoordeel = z.infer<typeof eindoordeelSchema>;

/** De vaste zin onder elk oordeel (bouwbrief §8). */
export const DISCLAIMER =
  "Dit is een geautomatiseerde risico-indicatie en geen juridisch advies. Een schone uitslag sluit een conflict niet uit.";
