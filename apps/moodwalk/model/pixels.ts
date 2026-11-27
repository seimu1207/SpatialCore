/** Largest width and height, in pixels, of the data the Mood_Analyzer reads (M3). */
export const ANALYSIS_SIZE = 64;

/** RGBA pixels, row-major, one value 0..255 per channel. */
export type PixelData = { readonly width: number; readonly height: number; readonly data: ArrayLike<number> };

/** Result of reading one image file in the browser: Analysis_Size pixels and a display copy URL. */
export type ReadResult = { ok: true; pixels: PixelData; displayUrl: string } | { ok: false; reason: "decode" };

const isPositiveInteger = (n: number): boolean => Number.isInteger(n) && n > 0;

/**
 * Size after scaling down to fit ANALYSIS_SIZE (never enlarged).
 * Returns null for a width or height that is not a positive integer.
 */
export function analysisSize(width: number, height: number): { width: number; height: number } | null {
  if (!isPositiveInteger(width) || !isPositiveInteger(height)) return null;
  const k = Math.min(1, ANALYSIS_SIZE / width, ANALYSIS_SIZE / height);
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
  };
}
