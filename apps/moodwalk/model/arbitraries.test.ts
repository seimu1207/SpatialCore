import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateScenario } from "../../../core/model/scenario-schema.ts";
import { loadBoardSettings } from "./board-settings.ts";
import { boardArb, marksArb, pixelDataArb, raiseArb, settingsArb, zonesArb } from "./arbitraries.ts";

describe("board generators", () => {
  it("zonesArb: 2 to 12 Zones with distinct order", () => {
    fc.assert(
      fc.property(zonesArb, (zones) => {
        expect(zones.length).toBeGreaterThanOrEqual(2);
        expect(zones.length).toBeLessThanOrEqual(12);
        expect(new Set(zones.map((z) => z.order)).size).toBe(zones.length);
      }),
      { numRuns: 100 },
    );
  });

  it("boardArb: 100 boards pass validateScenario and some Zone has no Image_Node", () => {
    const boards = fc.sample(boardArb, 100);
    expect(boards.length).toBe(100);
    for (const b of boards) {
      expect(validateScenario(JSON.parse(JSON.stringify(b))).ok).toBe(true);
      expect(validateScenario(b).ok).toBe(true);
      expect(b.nodes.length).toBeLessThanOrEqual(50);
    }
    expect(boards.some((b) => b.zones.some((z) => !b.nodes.some((n) => n.zone === z.id)))).toBe(true);
  });

  it("settingsArb: 100 values pass loadBoardSettings", () => {
    for (const s of fc.sample(settingsArb, 100)) expect(loadBoardSettings(s).ok).toBe(true);
  });

  it("marksArb: known ids come from the Zones, at most 2 unknown ids", () => {
    fc.assert(
      fc.property(
        zonesArb.chain((zones) => fc.tuple(fc.constant(zones), marksArb(zones))),
        ([zones, marks]) => {
          const ids = new Set(zones.map((z) => z.id));
          expect(marks.filter((m) => !ids.has(m)).length).toBeLessThanOrEqual(2);
          expect(new Set(marks).size).toBe(marks.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});

const alphas = (data: ArrayLike<number>): number[] => {
  const out: number[] = [];
  for (let i = 3; i < data.length; i += 4) out.push(data[i]);
  return out;
};

const allIntegers = (data: ArrayLike<number>): boolean =>
  Array.from(data).every((v) => Number.isInteger(v) && v >= 0 && v <= 255);

describe("pixelDataArb", () => {
  it("visible: right length, integer channels, some alpha above 0, sides in range", () => {
    fc.assert(
      fc.property(pixelDataArb({ minSide: 3 }), (p) => {
        expect(p.width).toBeGreaterThanOrEqual(3);
        expect(p.width).toBeLessThanOrEqual(64);
        expect(p.height).toBeGreaterThanOrEqual(3);
        expect(p.height).toBeLessThanOrEqual(64);
        expect(Array.isArray(p.data)).toBe(true);
        expect(p.data.length).toBe(4 * p.width * p.height);
        expect(allIntegers(p.data)).toBe(true);
        expect(alphas(p.data).some((a) => a > 0)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it("transparent: every alpha is 0 and the length matches", () => {
    fc.assert(
      fc.property(pixelDataArb({ variant: "transparent" }), (p) => {
        expect(p.data.length).toBe(4 * p.width * p.height);
        expect(allIntegers(p.data)).toBe(true);
        expect(alphas(p.data).every((a) => a === 0)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it("empty: one side is 0 and there is no data", () => {
    fc.assert(
      fc.property(pixelDataArb({ variant: "empty" }), (p) => {
        expect(p.width === 0 || p.height === 0).toBe(true);
        expect(p.data.length).toBe(0);
      }),
      { numRuns: 30 },
    );
  });
});

describe("raiseArb", () => {
  it("never lowers r, g, b, clamps to 255, and keeps alpha", () => {
    fc.assert(
      fc.property(
        pixelDataArb({ minSide: 1 }).chain((p) => fc.tuple(fc.constant(p), raiseArb(p))),
        ([before, after]) => {
          expect(after.width).toBe(before.width);
          expect(after.height).toBe(before.height);
          expect(after.data.length).toBe(before.data.length);
          for (let i = 0; i < before.data.length; i++) {
            const b = before.data[i];
            const a = after.data[i];
            if (i % 4 === 3) expect(a).toBe(b);
            else {
              expect(a).toBeGreaterThanOrEqual(b);
              expect(a).toBeLessThanOrEqual(255);
            }
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
