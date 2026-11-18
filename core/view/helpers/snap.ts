/** Snap helper (R-VIEW-13.3). Plain data only; imports nothing. */

export type SnapPoint = { x: number; y: number; z: number };

const MAX_GRID_INDEX = 2 ** 40;

function snapComponent(c: number, step: number): number {
  const q = c / step;
  if (!Number.isFinite(q) || Math.abs(q) > MAX_GRID_INDEX) return c;
  // `+ 0` turns -0 into 0.
  return Math.floor(q + 0.5) * step + 0;
}

/** Round `x` and `z` to the nearest multiple of `step` (halfway rounds toward +Infinity). `y` is copied. */
export function snap(p: SnapPoint, step: number): SnapPoint {
  return { x: snapComponent(p.x, step), y: p.y, z: snapComponent(p.z, step) };
}
