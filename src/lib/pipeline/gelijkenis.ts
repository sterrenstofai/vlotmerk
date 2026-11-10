/** Vaste, uitlegbare maten voor de gelijkenis van twee namen. Geen taalmodel. */

const kaal = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Brengt een naam terug tot hoe hij ongeveer klinkt, zodat "Trapvonck" en "Trapfonk" op elkaar uitkomen. */
export function klankvorm(s: string): string {
  return kaal(s)
    .replace(/ph/g, "f")
    .replace(/qu/g, "kw")
    .replace(/ck/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/x/g, "ks")
    .replace(/ij|y/g, "ei")
    .replace(/th/g, "t")
    .replace(/au/g, "ou")
    .replace(/z/g, "s")
    .replace(/v/g, "f")
    .replace(/(.)\1+/g, "$1");
}

export function bewerkingsafstand(a: string, b: string): number {
  const x = kaal(a);
  const y = kaal(b);
  let vorige = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const rij = [i];
    for (let j = 1; j <= y.length; j++) {
      rij[j] = Math.min(vorige[j] + 1, rij[j - 1] + 1, vorige[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    vorige = rij;
  }
  return vorige[y.length];
}

function gelijkenis(x: string, y: string): number {
  const langste = Math.max(x.length, y.length);
  if (!langste) return 0;
  let vorige = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const rij = [i];
    for (let j = 1; j <= y.length; j++) rij[j] = Math.min(vorige[j] + 1, rij[j - 1] + 1, vorige[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    vorige = rij;
  }
  return 1 - vorige[y.length] / langste;
}

/** Gelijkenis in schrijfwijze, van 0 tot 1. */
export const schrijfGelijkenis = (a: string, b: string) => gelijkenis(kaal(a), kaal(b));

/** Gelijkenis in klank, van 0 tot 1. */
export const klankGelijkenis = (a: string, b: string) => gelijkenis(klankvorm(a), klankvorm(b));

/**
 * Hoe sterk een merk uit het register op de naam lijkt, voor de voorselectie. Een merk dat de hele naam bevat
 * (of andersom) telt zwaar, ook als het langer is: "Trapvonk Fietsen" lijkt op "Trapvonk".
 */
export function voorselectieScore(naam: string, merk: string): number {
  const n = klankvorm(naam);
  const m = klankvorm(merk);
  const basis = Math.max(schrijfGelijkenis(naam, merk), klankGelijkenis(naam, merk));
  if (n.length >= 4 && m.length >= 4 && (m.includes(n) || n.includes(m))) return Math.max(basis, 0.75);
  return basis;
}
