import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { layoutText } from "./text-layout.ts";

const measure = (s: string): number => [...s].length * 10;

describe("layoutText (R-VIEW-04.2)", () => {
  it("wraps by words", () => {
    expect(layoutText("aaa bbb ccc", 70, 100, 10, measure)).toEqual(["aaa bbb", "ccc"]);
  });

  it("breaks a word longer than the line", () => {
    expect(layoutText("abcdefgh", 30, 100, 10, measure)).toEqual(["abc", "def", "gh"]);
  });

  it("drops lines that do not fit the height", () => {
    expect(layoutText("a b c d", 10, 25, 10, measure)).toEqual(["a", "b"]);
  });

  it("returns nothing for a zero-size area", () => {
    expect(layoutText("abc", 0, 100, 10, measure)).toEqual([]);
    expect(layoutText("abc", 100, 5, 10, measure)).toEqual([]);
  });

  it("never exceeds the width or the line count", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        fc.integer({ min: 10, max: 300 }),
        fc.integer({ min: 0, max: 120 }),
        (text, width, height) => {
          const lines = layoutText(text, width, height, 10, measure);
          expect(lines.length).toBeLessThanOrEqual(Math.floor(height / 10));
          for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(width);
        },
      ),
      { numRuns: 100 },
    );
  });
});
