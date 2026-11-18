import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { edgeMidpoint, edgeOffsets, loopSizes, MIN_EDGE_GAP } from "./edge-layout.ts";
import { NEUTRAL_THEME } from "./neutral-theme.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { themeArb, type Vec3 } from "./arbitraries.ts";
import { edgeStyleFor } from "./theme-schema.ts";

const edge = (id: string, from: string, to: string, type = "link") => ({ id, from, to, type });
const scenarioOf = (edges: ReturnType<typeof edge>[]): Scenario => ({ edges }) as unknown as Scenario;
const S = Math.max(MIN_EDGE_GAP, 2 * NEUTRAL_THEME.defaultEdge.width);

describe("edgeOffsets", () => {
  it("gives a single Edge offset 0", () => {
    const m = edgeOffsets(scenarioOf([edge("e1", "a", "b")]), ["e1"], NEUTRAL_THEME);
    expect(m.get("e1")).toBe(0);
  });

  it("puts a pair and its reverse in one frame", () => {
    const m = edgeOffsets(scenarioOf([edge("e1", "a", "b"), edge("e2", "b", "a")]), ["e1", "e2"], NEUTRAL_THEME);
    expect(m.get("e1")).toBeCloseTo(-S / 2);
    expect(m.get("e2")).toBeCloseTo(S / 2);
  });

  it("gives three Edges offsets -S, 0, S", () => {
    const edges = [edge("e3", "a", "b"), edge("e1", "a", "b"), edge("e2", "b", "a")];
    const m = edgeOffsets(scenarioOf(edges), ["e1", "e2", "e3"], NEUTRAL_THEME);
    expect(m.get("e1")).toBeCloseTo(-S);
    expect(m.get("e2")).toBe(0);
    expect(m.get("e3")).toBeCloseTo(S);
  });

  it("ignores loops and Edges that are not visible", () => {
    const m = edgeOffsets(scenarioOf([edge("e1", "a", "a"), edge("e2", "a", "b")]), ["e1"], NEUTRAL_THEME);
    expect(m.size).toBe(0);
  });
});

describe("edgeMidpoint", () => {
  it("offsets along the horizontal perpendicular", () => {
    const p = edgeMidpoint({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 0.5);
    expect(p.x).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(0.5);
  });

  it("falls back to (1, 0, 0) for a vertical direction and for A = B", () => {
    expect(edgeMidpoint({ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, 1)).toEqual({ x: 1, y: 1, z: 0 });
    expect(edgeMidpoint({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, 1)).toEqual({ x: 2, y: 1, z: 1 });
  });
});

describe("loopSizes", () => {
  it("gives radii 0.35 × (1 + 0.5 k) in id order per Node", () => {
    const edges = [edge("e2", "a", "a"), edge("e1", "a", "a"), edge("e3", "b", "b"), edge("e4", "a", "b")];
    const m = loopSizes(scenarioOf(edges), ["e1", "e2", "e3", "e4"]);
    expect(m.get("e1")).toBeCloseTo(0.35);
    expect(m.get("e2")).toBeCloseTo(0.525);
    expect(m.get("e3")).toBeCloseTo(0.35);
    expect(m.has("e4")).toBe(false);
  });
});

// Generators local to the layout properties: a few Node ids, many Edges between them.
const layoutArb = fc
  .tuple(
    themeArb,
    fc.array(fc.record({ from: fc.constantFrom("a", "b", "c"), to: fc.constantFrom("a", "b", "c"), type: fc.constantFrom("link", "key", "__proto__", "other") }), {
      maxLength: 10,
    }),
    fc.array(fc.tuple(fc.integer({ min: -400, max: 400 }), fc.integer({ min: -400, max: 400 }), fc.integer({ min: -400, max: 400 })), {
      minLength: 3,
      maxLength: 3,
    }),
    fc.infiniteStream(fc.boolean()),
  )
  .map(([theme, raw, pos, flags]) => {
    const edges = raw.map((e, i) => ({ id: `e${i + 1}`, ...e }));
    const it = flags[Symbol.iterator]();
    const visibleIds = edges.filter(() => it.next().value === true).map((e) => e.id);
    const positions = new Map<string, Vec3>(["a", "b", "c"].map((id, i) => [id, { x: pos[i][0] / 4, y: pos[i][1] / 4, z: pos[i][2] / 4 }]));
    return { theme, edges, visibleIds, positions };
  });

// Feature: core-view, Property 9: P-VIEW-9 parallel edges stay apart
describe("P-VIEW-9 parallel edges stay apart", () => {
  it("**Validates: Requirements 5.4, 5.5, 5.6** midpoints of parallel Edges are distinct and a line width apart", () => {
    fc.assert(
      fc.property(layoutArb, ({ theme, edges, visibleIds, positions }) => {
        const scenario = scenarioOf(edges);
        const offsets = edgeOffsets(scenario, visibleIds, theme);
        const groups = new Map<string, typeof edges>();
        for (const e of edges) {
          if (!visibleIds.includes(e.id) || e.from === e.to) continue;
          const key = [e.from, e.to].sort().join("|");
          groups.set(key, [...(groups.get(key) ?? []), e]);
        }
        for (const [key, group] of groups) {
          const [a, b] = key.split("|");
          const pa = positions.get(a)!;
          const pb = positions.get(b)!;
          const mids = group.map((e) => ({ e, p: edgeMidpoint(pa, pb, offsets.get(e.id)!) }));
          for (let i = 0; i < mids.length; i++) {
            for (let j = i + 1; j < mids.length; j++) {
              const d = Math.hypot(mids[i].p.x - mids[j].p.x, mids[i].p.y - mids[j].p.y, mids[i].p.z - mids[j].p.z);
              const w = Math.max(edgeStyleFor(theme, mids[i].e.type).width, edgeStyleFor(theme, mids[j].e.type).width);
              expect(d).toBeGreaterThan(0);
              expect(d).toBeGreaterThanOrEqual(w);
            }
          }
        }
      }),
    );
  });

  it("gives pairwise different loop radii per Node", () => {
    fc.assert(
      fc.property(layoutArb, ({ edges, visibleIds }) => {
        const radii = loopSizes(scenarioOf(edges), visibleIds);
        for (const node of ["a", "b", "c"]) {
          const mine = edges.filter((e) => e.from === node && e.to === node && visibleIds.includes(e.id));
          const values = mine.map((e) => radii.get(e.id));
          expect(values.every((v) => v !== undefined)).toBe(true);
          expect(new Set(values).size).toBe(values.length);
        }
      }),
    );
  });
});

describe("P-VIEW-1 (edge order) permuting the Edge list keeps every offset", () => {
  it("**Validates: Requirements 5.5**", () => {
    fc.assert(
      fc.property(
        layoutArb.chain((l) => fc.tuple(fc.constant(l), fc.shuffledSubarray(l.edges, { minLength: l.edges.length, maxLength: l.edges.length }))),
        ([{ theme, edges, visibleIds }, shuffled]) => {
          const before = edgeOffsets(scenarioOf(edges), visibleIds, theme);
          const after = edgeOffsets(scenarioOf(shuffled), visibleIds, theme);
          expect(after.size).toBe(before.size);
          for (const [id, offset] of before) expect(Object.is(after.get(id), offset)).toBe(true);
        },
      ),
    );
  });
});
