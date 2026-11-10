import { Anton, Fraunces, Geist, Syne } from "next/font/google";

const geist = Geist({ subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600"], display: "swap", preload: false });
const syne = Syne({ subsets: ["latin"], weight: ["800"], display: "swap", preload: false });
const anton = Anton({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });

export type FontKey = "geist" | "fraunces" | "syne" | "anton";

export const FONTS: Record<FontKey, { label: string; family: string; weight: number; tracking: string; leading: number; scale: number }> = {
  geist: { label: "Geist", family: geist.style.fontFamily, weight: 500, tracking: "-0.045em", leading: 1, scale: 1 },
  fraunces: { label: "Fraunces", family: fraunces.style.fontFamily, weight: 600, tracking: "-0.035em", leading: 1, scale: 0.98 },
  syne: { label: "Syne", family: syne.style.fontFamily, weight: 800, tracking: "-0.04em", leading: 1, scale: 0.72 },
  anton: { label: "Anton", family: anton.style.fontFamily, weight: 400, tracking: "-0.005em", leading: 1.04, scale: 1.08 },
};
