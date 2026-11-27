import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { anyValueArb } from "./arbitraries.ts";
import { boardSettingsSchema, loadBoardSettings, parseSettingField } from "./board-settings.ts";

const DEFAULTS = { shiftThreshold: 0.15, runTolerance: 0.05, minRunLength: 3 };

describe("parseSettingField", () => {
  it.each(["-1", "abc", "", "  ", "NaN", "Infinity"])("rejects %j", (text) => {
    expect(parseSettingField("shiftThreshold", text)).toStrictEqual({ ok: false });
  });

  it.each(["1", "2.5", "0", "-3"])("rejects %j for minRunLength", (text) => {
    expect(parseSettingField("minRunLength", text)).toStrictEqual({ ok: false });
  });

  it("accepts 0, 0.15, and 3", () => {
    expect(parseSettingField("runTolerance", "0")).toStrictEqual({ ok: true, value: 0 });
    expect(parseSettingField("shiftThreshold", " 0.15 ")).toStrictEqual({ ok: true, value: 0.15 });
    expect(parseSettingField("minRunLength", "3")).toStrictEqual({ ok: true, value: 3 });
  });
});

describe("loadBoardSettings", () => {
  it("accepts the defaults", () => {
    expect(loadBoardSettings(DEFAULTS)).toStrictEqual({ ok: true, settings: DEFAULTS });
  });

  it("rejects an extra key", () => {
    const r = loadBoardSettings({ ...DEFAULTS, extra: 1 });
    expect(r.ok).toBe(false);
  });

  it("rejects a missing key", () => {
    const r = loadBoardSettings({ shiftThreshold: 0.15, runTolerance: 0.05 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects non-object input without throwing", () => {
    expect(loadBoardSettings(null).ok).toBe(false);
    expect(boardSettingsSchema.safeParse({ ...DEFAULTS, minRunLength: 1 }).success).toBe(false);
  });
});

// Feature: app-moodwalk, Property 12: settings schema is total
describe("P-APP2-12 settings schema is total", () => {
  /** **Validates: Requirements 8.6, 8.7** */
  it("returns ok with valid values or a non-empty list of errors, and is deterministic", () => {
    fc.assert(
      fc.property(anyValueArb, (value) => {
        const first = loadBoardSettings(value);
        if (first.ok) {
          const { shiftThreshold, runTolerance, minRunLength } = first.settings;
          expect(Number.isFinite(shiftThreshold) && shiftThreshold >= 0).toBe(true);
          expect(Number.isFinite(runTolerance) && runTolerance >= 0).toBe(true);
          expect(Number.isInteger(minRunLength) && minRunLength >= 2).toBe(true);
        } else {
          expect(first.errors.length).toBeGreaterThan(0);
          for (const e of first.errors) {
            expect(typeof e.path).toBe("string");
            expect(typeof e.message).toBe("string");
            expect(e.message.length).toBeGreaterThan(0);
          }
        }
        expect(loadBoardSettings(value)).toStrictEqual(first);
      }),
      { numRuns: 200 },
    );
  });
});
