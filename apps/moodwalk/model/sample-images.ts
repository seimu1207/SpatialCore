import type { PixelData } from "./pixels.ts";

export type Rgb = readonly [number, number, number];

/** A fictional abstract color field: a vertical gradient with an optional soft light spot. */
export type SampleRecipe = {
  /** Reference is `sample:<id>`. */
  id: string;
  top: Rgb;
  bottom: Rgb;
  /** Soft light, in pixel units. */
  spot?: { cx: number; cy: number; radius: number; color: Rgb; strength: number };
};

/** 64 x 48 is 4:3, the panel ratio, and fits ANALYSIS_SIZE. */
export const SAMPLE_WIDTH = 64;
export const SAMPLE_HEIGHT = 48;

/**
 * The developer's fixed color fields (no AI, no image file). Tuned so the Demo_Board
 * Zone means match the design targets within 0.01.
 */
export const SAMPLE_RECIPES: readonly SampleRecipe[] = [
  {
    id: "lanterns",
    top: [60, 50, 70],
    bottom: [126, 126, 116],
    spot: { cx: 32, cy: 20, radius: 16, color: [255, 190, 90], strength: 0.3 },
  },
  { id: "corridor", top: [40, 66, 74], bottom: [30, 58, 56] },
  {
    id: "lamp",
    top: [34, 58, 64],
    bottom: [34, 58, 62],
    spot: { cx: 40, cy: 18, radius: 14, color: [200, 190, 140], strength: 0.4 },
  },
  { id: "desks", top: [34, 62, 68], bottom: [26, 56, 58] },
  {
    id: "doll",
    top: [32, 58, 64],
    bottom: [32, 58, 60],
    spot: { cx: 28, cy: 24, radius: 14, color: [190, 180, 170], strength: 0.4 },
  },
  { id: "piano", top: [34, 60, 64], bottom: [26, 52, 56] },
  {
    id: "tea",
    top: [190, 140, 130],
    bottom: [170, 120, 116],
    spot: { cx: 32, cy: 24, radius: 18, color: [240, 200, 140], strength: 0.3 },
  },
  { id: "flowers", top: [190, 136, 128], bottom: [170, 124, 118] },
  { id: "stairs", top: [0, 30, 54], bottom: [0, 18, 38] },
  {
    id: "daylight",
    top: [180, 156, 150],
    bottom: [162, 140, 140],
    spot: { cx: 32, cy: 10, radius: 20, color: [255, 250, 230], strength: 0.3 },
  },
];

const clampChannel = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));

/**
 * Pixels of a recipe, alpha 255 everywhere. Only + - * /, Math.sqrt and Math.round are used,
 * so the result is identical in Node and in every browser.
 */
export function samplePixels(recipe: SampleRecipe): PixelData {
  const w = SAMPLE_WIDTH;
  const h = SAMPLE_HEIGHT;
  const data: number[] = new Array<number>(4 * w * h);
  const { top, bottom, spot } = recipe;
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    for (let x = 0; x < w; x++) {
      let s = 0;
      if (spot) {
        const dx = x - spot.cx;
        const dy = y - spot.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const u = Math.max(0, 1 - d / spot.radius);
        s = spot.strength * u * u;
      }
      const i = 4 * (y * w + x);
      for (let c = 0; c < 3; c++) {
        const base = top[c] + t * (bottom[c] - top[c]);
        const color = spot ? base * (1 - s) + spot.color[c] * s : base;
        data[i + c] = clampChannel(color);
      }
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
