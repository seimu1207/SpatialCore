import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Scenario } from "../../model/scenario-schema.ts";
import { zoneRefCaseArb } from "./arbitraries.ts";
import { loadViewSettings, type ViewSettings } from "./settings-schema.ts";
import { missingZoneRefs, newlyMissingZoneRefs } from "./zone-refs.ts";

const pose = { position: { x: 0, y: 5, z: 8 }, target: { x: 0, y: 0, z: 0 } };
const label = { en: "x", ja: "x" };

function scenarioWith(zoneIds: string[]): Scenario {
  return {
    schemaVersion: 1,
    id: "s",
    title: label,
    nodes: [],
    edges: [],
    zones: zoneIds.map((id, order) => ({ id, label, order, elevation: 0, enclosed: false })),
  };
}

function settings(): ViewSettings {
  const result = loadViewSettings({
    zoneFootprints: [
      { kind: "rect", id: "a", x: 0, z: 0, width: 1, depth: 1 },
      { kind: "rect", id: "b", x: 2, z: 0, width: 1, depth: 1 },
      { kind: "rect", id: "gone", x: 4, z: 0, width: 1, depth: 1 },
    ],
    presets: [
      { id: "p", label, pose, filter: { zones: ["a", "nope"], edgeRule: "bothEnds" } },
    ],
    paths: [],
    detailDistance: 3,
    snapStep: 0.5,
    wallHeight: 1,
    editMode: "view",
    stepDuration: 1,
  });
  if (!result.ok) throw new Error("bad fixture");
  return result.settings;
}

describe("missingZoneRefs", () => {
  it("reports a footprint id and a filter entry that name no Zone", () => {
    expect(missingZoneRefs(settings(), scenarioWith(["a", "b"]))).toEqual([
      { path: "zoneFootprints.2.id", message: 'no zone with id "gone"' },
      { path: "presets.0.filter.zones.1", message: 'no zone with id "nope"' },
    ]);
  });

  it("reports nothing when every reference exists", () => {
    expect(missingZoneRefs(settings(), scenarioWith(["a", "b", "gone", "nope"]))).toEqual([]);
  });
});

describe("newlyMissingZoneRefs", () => {
  it("lists only paths that were not missing before", () => {
    const s = settings();
    const before = scenarioWith(["a", "b", "gone"]);
    const after = scenarioWith(["b", "gone", "nope"]);
    expect(newlyMissingZoneRefs(s, before, after).map((e) => e.path)).toEqual([
      "zoneFootprints.0.id",
      "presets.0.filter.zones.0",
    ]);
  });
});

describe("P-VIEW-10", () => {
  // Feature: core-view, Property 10: P-VIEW-10 missing Zone references are reported once
  // **Validates: Requirements 2.8**
  it("P-VIEW-10 missing Zone references are reported once, in walk order, and newly-missing is the difference", () => {
    fc.assert(
      fc.property(zoneRefCaseArb, ({ settings: s, a, b }) => {
        const expected = (sc: Scenario): string[] => {
          const ids = new Set(sc.zones.map((z) => z.id));
          const paths: string[] = [];
          s.zoneFootprints.forEach((f, i) => {
            if (!ids.has(f.id)) paths.push(`zoneFootprints.${i}.id`);
          });
          s.presets.forEach((p, i) =>
            (p.filter.zones ?? []).forEach((id, j) => {
              if (!ids.has(id)) paths.push(`presets.${i}.filter.zones.${j}`);
            }),
          );
          return paths;
        };
        const got = (sc: Scenario): string[] => missingZoneRefs(s, sc).map((e) => e.path);

        expect(got(a)).toEqual(expected(a));
        expect(got(b)).toEqual(expected(b));
        expect(new Set(got(b)).size).toBe(got(b).length);

        const before = new Set(got(a));
        expect(newlyMissingZoneRefs(s, a, b).map((e) => e.path)).toEqual(got(b).filter((p) => !before.has(p)));
        expect(newlyMissingZoneRefs(s, b, b)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
