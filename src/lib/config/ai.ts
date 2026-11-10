/**
 * Welke Claude-modellen de pipeline gebruikt. De check en het rapport kunnen los van elkaar wisselen:
 * de testset (npm run testset -- --model <id>) laat zien of een goedkoper model de check aankan.
 */
export const MODELLEN = {
  check: "claude-opus-5-5",
  rapport: "claude-opus-5-5",
} as const;

/**
 * Drempels waarmee de scores per weigeringsgrond een oordeel worden.
 * De hoogste score telt: één zware grond is genoeg voor een weigering door BOIP.
 */
export const DREMPELS = {
  /** Vanaf deze score is de naam zwak. */
  zwak: 70,
  /** Vanaf deze score is er twijfel. */
  twijfel: 40,
} as const;

/**
 * Regels waarmee de gelijkenis van een treffer een risico wordt. Het teken is de hoogste van beeld, klank en
 * (afgezwakt) betekenis; de soort is de soortgelijkheid van de producten en diensten. Allebei van 0 tot 1.
 */
export const RISICO = {
  /** Vanaf hier lijkt een teken duidelijk op de naam. */
  tekenHoog: 0.7,
  /** Vanaf hier is er enige gelijkenis. */
  tekenMiddel: 0.5,
  /** Vanaf hier is het teken vrijwel identiek; dat telt ook als de producten weinig met elkaar te maken hebben. */
  tekenIdentiek: 0.9,
  /** Gelijkenis in betekenis alleen leidt zelden tot verwarring; ze telt daarom voor dit deel mee. */
  gewichtBetekenis: 0.75,
  soortHoog: 0.6,
  soortMiddel: 0.3,
} as const;

/** Hoeveel treffers per check door Claude worden beoordeeld, en met hoeveel tegelijk. */
export const SCOREN = {
  maxDoorClaude: 40,
  perVraag: 20,
  /** Onder deze gelijkenis in schrijfwijze en klank gaat een treffer niet naar Claude en krijgt hij risico laag. */
  drempelVoorselectie: 0.45,
} as const;
