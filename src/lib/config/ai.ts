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
