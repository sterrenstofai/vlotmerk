import type { FontKey } from "./fonts";

export type DemoBrand = {
  id: string;
  label: string;
  name: string;
  category: string;
  font: FontKey;
  bg: string;
  fg: string;
  accent: string;
  radius: number;
  /** Deeltjeskleuren. Zonder deze lijst volgen ze fg en accent. */
  stars?: [string, string, string];
  /** Kleuren waarmee de 3D-objecten worden ingekleurd. */
  tints: string[];
};

export const BRANDS: DemoBrand[] = [
  {
    id: "vlotmerk",
    label: "Vlotmerk",
    name: "Jouw naam",
    category: "Software",
    font: "geist",
    bg: "#FAFAFA",
    fg: "#0F0F0F",
    accent: "#2D3BFF",
    radius: 8,
    stars: ["#101014", "#2D3BFF", "#FF4B26"],
    tints: ["#FF4B26", "#2D3BFF", "#FFC400", "#12B886", "#FF8FCB"],
  },
];

function channel(v: number) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string) {
  const h = hex.replace("#", "");
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

export const readableOn = (bg: string) => (luminance(bg) > 0.4 ? "#111111" : "#FFFFFF");

export function mixHex(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.replace("#", "").slice(i, i + 2), 16);
  const c = [0, 2, 4].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
