import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identifierArb, scenarioArb } from "../../model/arbitraries.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { filterArb } from "./arbitraries.ts";
import type { VisibilityFilter } from "./settings-schema.ts";
import { computeVisibleSet } from "./visibility.ts";

type VisibleSetResult = ReturnType<typeof computeVisibleSet>;

/** Reference model written straight from R-VIEW-07.2 to 07.5. */
function reference(s: Scenario, f: VisibilityFilter): VisibleSetResult {
  const includeUnzoned = f.includeUnzoned ?? f.zones === undefined;
  const nodeOk = (n: Scenario["nodes"][number]): boolean => {
    const zoneOk = n.zone === undefined ? includeUnzoned : f.zones === undefined || f.zones.includes(n.zone);
    return zoneOk && (f.nodeTypes === undefined || f.nodeTypes.includes(n.type));
  };
  const nodes = s.nodes.filter(nodeOk).map((n) => n.id);
  const edges = s.edges
    .filter((e) => {
      if (f.edgeTypes !== undefined && !f.edgeTypes.includes(e.type)) return false;
      const a = nodes.includes(e.from);
      const b = nodes.includes(e.to);
      return f.edgeRule === "bothEnds" ? a && b : a || b;
    })
    .map((e) => e.id);
  const zones = s.zones.filter((z) => f.zones === undefined || f.zones.includes(z.id)).map((z) => z.id);
  return { nodes, edges, zones };
}

const scenarioAndFilterArb = scenarioArb.chain((s) => filterArb(s).map((f) => ({ s, f })));
const LISTS = ["zones", "nodeTypes", "edgeTypes"] as const;

function subsetOf(a: readonly string[], b: readonly string[]): boolean {
  return a.every((x) => b.includes(x));
}

// Feature: core-view, Property 3: P-VIEW-3 visibility rules
describe("P-VIEW-3 visibility rules", () => {
  // **Validates: Requirements 6.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
  it("matches the reference model, uses only Scenario ids once each, in list order", () => {
    fc.assert(
      fc.property(scenarioAndFilterArb, ({ s, f }) => {
        const v = computeVisibleSet(s, f);
        expect(v).toEqual(reference(s, f));
        for (const [got, all] of [
          [v.nodes, s.nodes.map((n) => n.id)],
          [v.edges, s.edges.map((e) => e.id)],
          [v.zones, s.zones.map((z) => z.id)],
        ] as const) {
          expect(new Set(got).size).toBe(got.length);
          expect(got).toEqual(all.filter((id) => got.includes(id)));
        }
      }),
      { numRuns: 200 },
    );
  });

  it("bothEnds is a subset of anyEnd; nodes and zones do not depend on edgeRule", () => {
    fc.assert(
      fc.property(scenarioAndFilterArb, ({ s, f }) => {
        const both = computeVisibleSet(s, { ...f, edgeRule: "bothEnds" });
        const any = computeVisibleSet(s, { ...f, edgeRule: "anyEnd" });
        expect(subsetOf(both.edges, any.edges)).toBe(true);
        expect(both.nodes).toEqual(any.nodes);
        expect(both.zones).toEqual(any.zones);
      }),
      { numRuns: 200 },
    );
  });

  it("removing a list entry never adds an element", () => {
    fc.assert(
      fc.property(scenarioAndFilterArb, fc.constantFrom(...LISTS), fc.nat(), ({ s, f }, key, pick) => {
        const list = f[key];
        fc.pre(list !== undefined && list.length > 0);
        const i = pick % list.length;
        const smaller = { ...f, [key]: list.filter((_, j) => j !== i) };
        const a = computeVisibleSet(s, smaller);
        const b = computeVisibleSet(s, f);
        expect(subsetOf(a.nodes, b.nodes)).toBe(true);
        expect(subsetOf(a.edges, b.edges)).toBe(true);
        expect(subsetOf(a.zones, b.zones)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("names that no element has change nothing", () => {
    fc.assert(
      fc.property(scenarioAndFilterArb, fc.array(identifierArb, { maxLength: 3 }), ({ s, f }, extra) => {
        const known = new Set([
          ...s.zones.map((z) => z.id),
          ...s.nodes.map((n) => n.type),
          ...s.edges.map((e) => e.type),
        ]);
        const fresh = extra.filter((x) => !known.has(x));
        const widened: VisibilityFilter = { ...f };
        for (const key of LISTS) {
          const list = f[key];
          if (list !== undefined) widened[key] = [...list, ...fresh];
        }
        expect(computeVisibleSet(s, widened)).toEqual(computeVisibleSet(s, f));
      }),
      { numRuns: 200 },
    );
  });

  it("ignores order, elevation, enclosed, label, geometry, Faces, Metadata, and Numeric_Attributes", () => {
    fc.assert(
      fc.property(scenarioAndFilterArb, fc.double({ noNaN: true }), fc.boolean(), ({ s, f }, num, flag) => {
        const changed = {
          ...s,
          zones: s.zones.map((z) => ({
            ...z,
            order: num,
            elevation: num,
            enclosed: flag,
            label: { en: "changed", ja: "changed" },
          })),
          nodes: s.nodes.map((n) => ({
            ...n,
            position: { x: num, y: num, z: num },
            rotation: { x: num, y: num, z: num },
            scale: { x: num, y: num, z: num },
            front: { text: { en: "changed" } },
            back: { text: { en: "changed" } },
            metadata: { changed: flag },
            attributes: { changed: num },
          })),
        } as unknown as Scenario;
        expect(computeVisibleSet(changed, f)).toEqual(computeVisibleSet(s, f));
      }),
      { numRuns: 200 },
    );
  });
});

const t = (en: string) => ({ en, ja: en });
const face = { text: t("x") };

const scenario = {
  nodes: [
    { id: "n1", type: "card", zone: "area-a", front: face },
    { id: "n2", type: "note", zone: "area-b", front: face },
    { id: "n3", type: "card", front: face },
  ],
  edges: [
    { id: "e1", from: "n1", to: "n2", type: "link" },
    { id: "e2", from: "n1", to: "n3", type: "link" },
  ],
  zones: [
    { id: "area-a", label: t("A"), order: 0 },
    { id: "area-b", label: t("B"), order: 1 },
  ],
} as unknown as Scenario;

describe("computeVisibleSet", () => {
  it("an empty zones list shows no Node and no Zone", () => {
    const v = computeVisibleSet(scenario, { zones: [], edgeRule: "anyEnd" });
    expect(v).toEqual({ nodes: [], edges: [], zones: [] });
  });

  it("an unzoned Node follows includeUnzoned", () => {
    const base = { zones: ["area-a"], edgeRule: "bothEnds" as const };
    expect(computeVisibleSet(scenario, base).nodes).toEqual(["n1"]);
    expect(computeVisibleSet(scenario, { ...base, includeUnzoned: true }).nodes).toEqual([
      "n1",
      "n3",
    ]);
    expect(computeVisibleSet(scenario, { edgeRule: "bothEnds" }).nodes).toEqual(["n1", "n2", "n3"]);
  });

  it("an Edge to a hidden Node depends on edgeRule", () => {
    const f = { zones: ["area-a"] };
    expect(computeVisibleSet(scenario, { ...f, edgeRule: "bothEnds" }).edges).toEqual([]);
    expect(computeVisibleSet(scenario, { ...f, edgeRule: "anyEnd" }).edges).toEqual(["e1", "e2"]);
  });

  it("a missing Zone id in zones is not an error", () => {
    const a = computeVisibleSet(scenario, { zones: ["area-a", "nope"], edgeRule: "anyEnd" });
    const b = computeVisibleSet(scenario, { zones: ["area-a"], edgeRule: "anyEnd" });
    expect(a).toEqual(b);
  });

  it("returns an empty set for a non-Scenario value", () => {
    const v = computeVisibleSet(null as unknown as Scenario, { edgeRule: "anyEnd" });
    expect(v).toEqual({ nodes: [], edges: [], zones: [] });
  });
});
