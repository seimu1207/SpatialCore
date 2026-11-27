import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pixelDataArb, raiseArb } from "./arbitraries.ts";
import { analyzeMood } from "./mood.ts";
import { analysisSize } from "./pixels.ts";
import type { PixelData } from "./pixels.ts";

const px = (r: number, g: number, b: number, a = 255): PixelData => ({ width: 1, height: 1, data: [r, g, b, a] });

describe("analyzeMood", () => {
  it("gives (1, 0) for white and (0, 0) for black", () => {
    const w = analyzeMood(px(255, 255, 255));
    expect(w.ok && w.value.brightness).toBeCloseTo(1, 12);
    expect(w.ok && w.value.temperature).toBe(0);
    expect(analyzeMood(px(0, 0, 0))).toStrictEqual({ ok: true, value: { brightness: 0, temperature: 0 } });
  });

  it("gives red (0.2126, 1) and blue (0.0722, -1)", () => {
    const r = analyzeMood(px(255, 0, 0));
    expect(r.ok && r.value.brightness).toBeCloseTo(0.2126, 12);
    expect(r.ok && r.value.temperature).toBe(1);
    const b = analyzeMood(px(0, 0, 255));
    expect(b.ok && b.value.brightness).toBeCloseTo(0.0722, 12);
    expect(b.ok && b.value.temperature).toBe(-1);
  });

  it("weighs pixels by alpha", () => {
    const data = { width: 2, height: 1, data: [255, 255, 255, 255, 0, 0, 0, 85] };
    const res = analyzeMood(data);
    expect(res.ok && res.value.brightness).toBeCloseTo(255 / 340, 12);
    const half = analyzeMood(px(255, 0, 0, 128));
    expect(half.ok && half.value.temperature).toBe(1);
  });

  it("fails for bad data, too large, no pixels, and transparent input", () => {
    expect(analyzeMood({ width: 1, height: 1, data: [1, 2, 3] })).toStrictEqual({ ok: false, reason: "bad-data" });
    expect(analyzeMood(px(256, 0, 0))).toStrictEqual({ ok: false, reason: "bad-data" });
    expect(analyzeMood(px(1.5, 0, 0))).toStrictEqual({ ok: false, reason: "bad-data" });
    expect(analyzeMood({ width: -1, height: 1, data: [] })).toStrictEqual({ ok: false, reason: "bad-data" });
    expect(analyzeMood({ width: 65, height: 1, data: new Array(260).fill(0) })).toStrictEqual({
      ok: false,
      reason: "too-large",
    });
    expect(analyzeMood({ width: 0, height: 5, data: [] })).toStrictEqual({ ok: false, reason: "no-pixels" });
    expect(analyzeMood(px(10, 20, 30, 0))).toStrictEqual({ ok: false, reason: "transparent" });
  });

  it("does not change its input", () => {
    const input = { width: 2, height: 1, data: [10, 20, 30, 255, 40, 50, 60, 200] };
    const copy: unknown = JSON.parse(JSON.stringify(input));
    analyzeMood(input);
    expect(input).toStrictEqual(copy);
  });
});

describe("analysisSize", () => {
  it("scales down to fit 64 and never enlarges", () => {
    expect(analysisSize(10000, 10)).toStrictEqual({ width: 64, height: 1 });
    expect(analysisSize(64, 64)).toStrictEqual({ width: 64, height: 64 });
    expect(analysisSize(20, 10)).toStrictEqual({ width: 20, height: 10 });
    expect(analysisSize(128, 64)).toStrictEqual({ width: 64, height: 32 });
  });

  it("returns null for sides that are not positive integers", () => {
    expect(analysisSize(0, 5)).toBeNull();
    expect(analysisSize(5, -1)).toBeNull();
    expect(analysisSize(1.5, 5)).toBeNull();
    expect(analysisSize(Number.NaN, 5)).toBeNull();
  });
});

describe("analyzer properties", () => {
  // Feature: app-moodwalk, Property 1: analyzer is total, in range, and deterministic
  // **Validates: Requirements 6.2, 6.3, 6.4, 6.7, 16.1, 16.2**
  it("P-APP2-1 analyzer is total, in range, and deterministic", () => {
    fc.assert(
      fc.property(pixelDataArb({ variant: "visible" }), (pixels) => {
        const before: unknown = JSON.parse(JSON.stringify(pixels));
        const first = analyzeMood(pixels);
        const second = analyzeMood(JSON.parse(JSON.stringify(pixels)) as PixelData);
        expect(pixels).toStrictEqual(before);
        expect(second).toStrictEqual(first);
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        const { brightness, temperature } = first.value;
        expect(Number.isFinite(brightness)).toBe(true);
        expect(Number.isFinite(temperature)).toBe(true);
        expect(brightness).toBeGreaterThanOrEqual(0);
        expect(brightness).toBeLessThanOrEqual(1);
        expect(temperature).toBeGreaterThanOrEqual(-1);
        expect(temperature).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(pixelDataArb({ variant: "transparent" }), (pixels) => {
        const res = analyzeMood(pixels);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.reason === "transparent" || res.reason === "no-pixels").toBe(true);
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(pixelDataArb({ variant: "empty" }), (pixels) => {
        const res = analyzeMood(pixels);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.reason === "transparent" || res.reason === "no-pixels").toBe(true);
      }),
      { numRuns: 100 },
    );
    // Design clause: analysisSize
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10000 }), fc.integer({ min: 1, max: 10000 }), (w, h) => {
        const s = analysisSize(w, h);
        expect(s).not.toBeNull();
        if (s === null) return;
        expect(s.width).toBeGreaterThanOrEqual(1);
        expect(s.height).toBeGreaterThanOrEqual(1);
        expect(s.width).toBeLessThanOrEqual(Math.min(64, w));
        expect(s.height).toBeLessThanOrEqual(Math.min(64, h));
        if (w <= 64 && h <= 64) expect(s).toStrictEqual({ width: w, height: h });
        const k = Math.min(1, 64 / w, 64 / h);
        expect(Math.abs(s.width - w * k)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.height - h * k)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });
});

describe("analyzer monotonicity property", () => {
  // Feature: app-moodwalk, Property 2: brightness is monotone
  // **Validates: Requirements 6.5**
  it("P-APP2-2 brightness is monotone", () => {
    fc.assert(
      fc.property(
        pixelDataArb({ variant: "visible" }).chain((pixels) => fc.tuple(fc.constant(pixels), raiseArb(pixels))),
        ([pixels, raised]) => {
          const a = analyzeMood(pixels);
          const b = analyzeMood(raised);
          expect(a.ok).toBe(true);
          expect(b.ok).toBe(true);
          if (!a.ok || !b.ok) return;
          expect(b.value.brightness).toBeGreaterThanOrEqual(a.value.brightness);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("analyzer color temperature property", () => {
  // Feature: app-moodwalk, Property 3: red is not cooler than blue
  // **Validates: Requirements 6.6**
  it("P-APP2-3 red is not cooler than blue", () => {
    fc.assert(
      fc.property(pixelDataArb({ variant: "visible" }), (pixels) => {
        const warm: number[] = [];
        const swapped: number[] = [];
        for (let i = 0; i < pixels.data.length; i += 4) {
          const [r, g, b, a] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2], pixels.data[i + 3]];
          const hi = Math.max(r, b);
          const lo = Math.min(r, b);
          warm.push(hi, g, lo, a);
          swapped.push(lo, g, hi, a);
        }
        const a = analyzeMood({ width: pixels.width, height: pixels.height, data: warm });
        const b = analyzeMood({ width: pixels.width, height: pixels.height, data: swapped });
        expect(a.ok).toBe(true);
        expect(b.ok).toBe(true);
        if (!a.ok || !b.ok) return;
        expect(a.value.temperature).toBeGreaterThanOrEqual(b.value.temperature);
      }),
      { numRuns: 100 },
    );
  });
});
