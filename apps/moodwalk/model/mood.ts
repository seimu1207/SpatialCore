import { ANALYSIS_SIZE } from "./pixels.ts";
import type { PixelData } from "./pixels.ts";

/** Range of the warmth index (not Kelvin): -1 fully blue, +1 fully red. */
export const TEMPERATURE_RANGE = { min: -1, max: 1 } as const;

export type MoodValues = { brightness: number; temperature: number };
export type AnalysisFailure = { ok: false; reason: "no-pixels" | "transparent" | "bad-data" | "too-large" };
export type MoodResult = { ok: true; value: MoodValues } | AnalysisFailure;

const isChannel = (v: unknown): boolean => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 255;
const isSide = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/**
 * Brightness: alpha-weighted mean of BT.709 luma on 8-bit sRGB values, 0..1.
 * Temperature: alpha-weighted mean of (r - b) / 255, -1..1.
 * Sums are exact integers (at most 64 x 64 pixels); only the last division rounds.
 * Pure, never throws, writes nothing.
 */
export function analyzeMood(pixels: PixelData): MoodResult {
  try {
    const { width, height, data } = pixels;
    if (!isSide(width) || !isSide(height)) return { ok: false, reason: "bad-data" };
    if (!data || typeof data.length !== "number" || data.length !== 4 * width * height) {
      return { ok: false, reason: "bad-data" };
    }
    for (let i = 0; i < data.length; i++) {
      if (!isChannel(data[i])) return { ok: false, reason: "bad-data" };
    }
    if (width > ANALYSIS_SIZE || height > ANALYSIS_SIZE) return { ok: false, reason: "too-large" };
    if (width * height === 0) return { ok: false, reason: "no-pixels" };

    let A = 0;
    let Y = 0;
    let W = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      A += a;
      Y += a * (2126 * r + 7152 * g + 722 * b);
      W += a * (r - b);
    }
    if (A === 0) return { ok: false, reason: "transparent" };
    return { ok: true, value: { brightness: Y / (A * 2550000), temperature: W / (A * 255) } };
  } catch {
    return { ok: false, reason: "bad-data" };
  }
}
