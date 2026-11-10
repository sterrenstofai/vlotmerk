/**
 * De objecten zijn wit-grijze 3D-renders (reg, shield, label, bell en lock zijn voor deze site gegenereerd met Higgsfield). Hier kleuren we ze in met een merkkleur:
 * de grijswaarde wordt de schaduw, de lichtste plekken blijven als glans staan.
 */

export type SpriteKey = "reg" | "shield" | "label" | "bell" | "lock" | "stamp" | "loupe" | "paper" | "page";

export type Sprite = { data: Uint8ClampedArray; w: number; h: number };

const cache = new Map<SpriteKey, Promise<Sprite>>();

const SHADE = new Float32Array(256);
const GLOSS = new Float32Array(256);
for (let l = 0; l < 256; l++) {
  SHADE[l] = Math.pow(Math.min(l / 224, 1), 1.7);
  const t = Math.min(1, Math.max(0, (l - 226) / 22));
  GLOSS[l] = t * t * (3 - 2 * t) * 0.8;
}

export function loadSprite(key: SpriteKey): Promise<Sprite> {
  let p = cache.get(key);
  if (!p) {
    p = new Promise<Sprite>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        resolve({ data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height });
      };
      img.onerror = () => reject(new Error(`Sprite ${key} laadt niet`));
      img.src = `/kit/${key}.webp`;
    });
    cache.set(key, p);
  }
  return p;
}

export function paintSprite(canvas: HTMLCanvasElement, sprite: Sprite, hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (canvas.width !== sprite.w) canvas.width = sprite.w;
  if (canvas.height !== sprite.h) canvas.height = sprite.h;
  const out = new ImageData(sprite.w, sprite.h);
  const src = sprite.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    if (!a) continue;
    const s = SHADE[src[i]];
    const k = GLOSS[src[i]];
    const cr = r * s;
    const cg = g * s;
    const cb = b * s;
    dst[i] = cr + (255 - cr) * k;
    dst[i + 1] = cg + (255 - cg) * k;
    dst[i + 2] = cb + (255 - cb) * k;
    dst[i + 3] = a;
  }
  canvas.getContext("2d")!.putImageData(out, 0, 0);
}

export type TagLook = { text: string; font: string; weight: number; bg: string; fg: string; radius: number };

/** Tekent het naamplaatje: de bedrijfsnaam op een glanzend label in de merkkleur. */
export function drawTag(canvas: HTMLCanvasElement, tag: TagLook, fontSize: number, maxWidth: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${tag.weight} ${fontSize}px ${tag.font}`;
  const padX = fontSize * 0.75;
  const w = Math.min(maxWidth, measure.measureText(tag.text).width + padX * 2);
  const h = fontSize * 1.9;
  const r = Math.min(tag.radius, h / 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fillStyle = tag.bg;
  ctx.fill();
  const gloss = ctx.createLinearGradient(0, 0, 0, h);
  gloss.addColorStop(0, "rgba(255,255,255,0.3)");
  gloss.addColorStop(0.5, "rgba(255,255,255,0)");
  gloss.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = gloss;
  ctx.fill();
  ctx.fillStyle = tag.fg;
  ctx.font = `${tag.weight} ${fontSize}px ${tag.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag.text, w / 2, h / 2 + fontSize * 0.05, w - padX);
  return { w, h, r };
}
