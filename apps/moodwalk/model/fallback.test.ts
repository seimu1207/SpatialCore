import { describe, expect, it } from "vitest";
import { FALLBACK } from "./fallback.ts";

describe("FALLBACK", () => {
  it("has brightnessOnly off by default", () => {
    expect(FALLBACK.brightnessOnly).toBe(false);
  });
});
