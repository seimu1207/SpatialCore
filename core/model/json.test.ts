import { describe, expect, it } from "vitest";
import { canonicalJson, checkJsonValue, compareCodePoints } from "./json.ts";

describe("compareCodePoints", () => {
  it("orders an astral character after a BMP character above U+D800", () => {
    const astral = "\u{1F600}"; // surrogates D83D DE00
    const bmp = "\uFF21";
    expect(astral < bmp).toBe(true); // UTF-16 code unit order
    expect(compareCodePoints(astral, bmp)).toBe(1);
    expect(compareCodePoints(bmp, astral)).toBe(-1);
  });
  it("handles equal strings and prefixes", () => {
    expect(compareCodePoints("a", "a")).toBe(0);
    expect(compareCodePoints("a", "ab")).toBe(-1);
    expect(compareCodePoints("ab", "a")).toBe(1);
  });
});

describe("canonicalJson", () => {
  it("writes sorted keys, 2-space indent, and one trailing newline", () => {
    expect(canonicalJson({ b: [1, { d: 1, c: [] }], a: {} })).toBe(
      '{\n  "a": {},\n  "b": [\n    1,\n    {\n      "c": [],\n      "d": 1\n    }\n  ]\n}\n',
    );
  });
  it("skips undefined values", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{\n  "a": 1\n}\n');
  });
  it("writes -0 as 0", () => {
    expect(canonicalJson({ a: -0 })).toBe('{\n  "a": 0\n}\n');
  });
  it("writes a __proto__ key as an ordinary key", () => {
    const value = JSON.parse('{"__proto__": 1, "a": 2}') as unknown;
    expect(canonicalJson(value)).toBe('{\n  "__proto__": 1,\n  "a": 2\n}\n');
  });
});

describe("checkJsonValue", () => {
  it("accepts JSON values", () => {
    expect(checkJsonValue({ a: [1, "x", null, true, { b: 0 }] })).toBeNull();
  });
  it("reports a cycle", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(checkJsonValue(a)).not.toBeNull();
  });
  it("reports NaN, a function, and a class instance", () => {
    expect(checkJsonValue({ a: NaN })).not.toBeNull();
    expect(checkJsonValue({ a: () => 1 })).not.toBeNull();
    expect(checkJsonValue({ a: new Date(0) })).not.toBeNull();
  });
});
