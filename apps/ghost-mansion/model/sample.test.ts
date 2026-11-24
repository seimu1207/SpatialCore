import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { variantArb } from "./arbitraries.ts";
import { BUNDLED } from "./bundled.ts";
import { isKeyEdge } from "./commands.ts";
import { loadGameData } from "./game-data.ts";
import { deriveSample } from "./sample.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const preset: Scenario = loaded.data.preset;

describe("deriveSample", () => {
  it("changes only k-diary on the bundled data (13.2)", () => {
    const r = deriveSample(preset);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const changed = r.scenario.edges.filter((e, i) => e.type !== preset.edges[i]?.type).map((e) => e.id);
    expect(changed).toEqual(["k-diary"]);
    expect(r.scenario.edges.filter(isKeyEdge).every((e) => e.type === "plain-key")).toBe(true);
    expect(r.scenario.nodes).toEqual(preset.nodes);
    expect(r.scenario.zones).toEqual(preset.zones);
  });

  it("returns the same Scenario when every key is already plain", () => {
    const first = deriveSample(preset);
    if (!first.ok) throw new Error("unexpected");
    const second = deriveSample(first.scenario);
    expect(second.ok && second.scenario === first.scenario).toBe(true);
  });
});

// Feature: app-ghost-mansion, Property 9: sample mansion derivation
describe("P-APP1-9 sample mansion derivation", () => {
  it("P-APP1-9: all Key_Edges plain, only their type differs, idempotent", () => {
    // **Validates: Requirements 13.2**
    fc.assert(
      fc.property(variantArb, (variant) => {
        const r = deriveSample(variant);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const out = r.scenario;
        expect(out.edges.length).toBe(variant.edges.length);
        out.edges.forEach((e, i) => {
          const before = variant.edges[i];
          if (isKeyEdge(before)) {
            expect(e.type).toBe("plain-key");
            expect({ ...e, type: before.type }).toEqual(before);
          } else {
            expect(e).toEqual(before);
          }
        });
        expect(out.nodes).toEqual(variant.nodes);
        expect(out.zones).toEqual(variant.zones);
        expect({ ...out, edges: variant.edges }).toEqual(variant);
        const again = deriveSample(out);
        expect(again.ok && again.scenario).toEqual(out);
      }),
      { numRuns: 100 },
    );
  });
});