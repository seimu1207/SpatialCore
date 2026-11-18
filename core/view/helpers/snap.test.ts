import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { snap } from "./snap.js";

describe("snap", () => {
  it("rounds to the nearest multiple and copies y", () => {
    expect(snap({ x: 0.7, y: 1.23, z: -0.7 }, 0.5)).toEqual({ x: 0.5, y: 1.23, z: -0.5 });
  });

  it("rounds a halfway value toward positive infinity", () => {
    expect(snap({ x: 0.25, y: 0, z: -0.25 }, 0.5)).toEqual({ x: 0.5, y: 0, z: 0 });
    expect(snap({ x: -0.75, y: 0, z: 0.75 }, 0.5)).toEqual({ x: -0.5, y: 0, z: 1 });
  });

  it("returns 0 and never -0", () => {
    const r = snap({ x: -0.1, y: 0, z: -0.2 }, 0.5);
    expect(Object.is(r.x, 0)).toBe(true);
    expect(Object.is(r.z, 0)).toBe(true);
  });

  it("returns a huge component unchanged", () => {
    const big = 1e300;
    expect(snap({ x: big, y: 0, z: 2 ** 41 }, 1)).toEqual({ x: big, y: 0, z: 2 ** 41 });
    expect(snap({ x: 1e308, y: 0, z: 0 }, 1e-308).x).toBe(1e308);
  });

  it("is idempotent", () => {
    const once = snap({ x: 3.14159, y: 2, z: -2.71828 }, 0.5);
    expect(snap(once, 0.5)).toEqual(once);
  });
});

// Feature: core-view, Property 5: P-VIEW-5 snapping
describe("P-VIEW-5 snapping", () => {
  // **Validates: Requirements 13.3**
  const stepArb = fc.double({ min: 1e-3, max: 1e3, noNaN: true });
  const compArb = fc.oneof(
    fc.double({ min: -1e6, max: 1e6, noNaN: true }),
    fc.double({ min: -1e300, max: 1e300, noNaN: true }),
  );
  const pointArb = fc.record({ x: compArb, y: compArb, z: compArb });
  const inRange = (c: number, s: number): boolean => Math.abs(c / s) <= 2 ** 40;

  it("is idempotent and leaves y unchanged", () => {
    fc.assert(
      fc.property(pointArb, stepArb, (p, s) => {
        const once = snap(p, s);
        expect(Object.is(once.y, p.y)).toBe(true);
        expect(snap(once, s)).toEqual(once);
      }),
    );
  });

  it("moves x and z by at most s / 2 and lands on multiples of s", () => {
    fc.assert(
      fc.property(pointArb, stepArb, (p, s) => {
        const r = snap(p, s);
        for (const c of ["x", "z"] as const) {
          if (inRange(p[c], s)) {
            expect(Math.abs(r[c] - p[c])).toBeLessThanOrEqual(s / 2 + 1e-9 * Math.max(Math.abs(p[c]), s));
            const q = r[c] / s;
            expect(Math.abs(q - Math.round(q))).toBeLessThanOrEqual(1e-3);
          } else {
            expect(r[c]).toBe(p[c]);
          }
        }
      }),
    );
  });

  it("rounds exact halfway values up", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -6, max: 6 }), (k, e) => {
        const s = 2 ** e;
        const r = snap({ x: (k + 0.5) * s, y: 0, z: (k + 0.5) * s }, s);
        expect(r.x).toBe((k + 1) * s);
        expect(r.z).toBe((k + 1) * s);
      }),
    );
  });
});
