import { describe, expect, it } from "vitest";
import * as text from "./text.ts";
import { CONTROL_IDS } from "./model/controls.ts";

function collect(value: unknown, out: { en: string; ja: string }[]): void {
  if (typeof value !== "object" || value === null) return;
  const v = value as Record<string, unknown>;
  if (typeof v.en === "string" && typeof v.ja === "string") {
    out.push({ en: v.en, ja: v.ja });
    return;
  }
  for (const child of Object.values(v)) collect(child, out);
}

describe("ghost-mansion UI texts", () => {
  const all: { en: string; ja: string }[] = [];
  collect(text, all);

  it("every exported LocalizedText has a non-empty en and ja", () => {
    expect(all.length).toBeGreaterThan(30);
    for (const t of all) {
      expect(t.en.trim().length).toBeGreaterThan(0);
      expect(t.ja.trim().length).toBeGreaterThan(0);
    }
  });

  it("has a label for every control id", () => {
    for (const id of CONTROL_IDS) expect(text.controlLabels[id].en.length).toBeGreaterThan(0);
  });

  it("contains no technical term", () => {
    for (const t of all) {
      expect(t.en).not.toMatch(/prompt injection|excessive agency|hallucination|owasp/i);
    }
  });
});
