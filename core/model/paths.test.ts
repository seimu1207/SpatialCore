import { describe, expect, it } from "vitest";
import { findPath, findReachable, propagate } from "./paths.ts";
import type { RuleDefinition } from "./rule-schema.ts";
import type { Edge, Node, Scenario } from "./scenario-schema.ts";

const origin = { x: 0, y: 0, z: 0 };

function item(id: string): Node {
  return {
    id,
    type: "item",
    position: origin,
    rotation: origin,
    scale: { x: 1, y: 1, z: 1 },
    front: { text: { en: id } },
    metadata: {},
    attributes: {},
  };
}

function link(id: string, from: string, to: string, type = "link"): Edge {
  return { id, from, to, type };
}

function scenarioOf(nodeIds: string[], edges: Edge[]): Scenario {
  return {
    schemaVersion: 1,
    id: "s1",
    title: { en: "t" },
    nodes: nodeIds.map(item),
    edges,
    zones: [{ id: "level1", label: { en: "level" }, order: 0, elevation: 0, enclosed: false }],
  };
}

function rulesOf(pass: string[], stop: string[]): RuleDefinition {
  return { schemaVersion: 1, id: "r1", propagation: { pass, stop } };
}

const anyLink = { include: ["link"] };

function ok<T>(outcome: { ok: true; value: T } | { ok: false }): T {
  if (!outcome.ok) throw new Error("expected ok");
  return outcome.value;
}

describe("findPath", () => {
  const diamond = (first: "b" | "c"): Scenario => {
    const viaB = [link("e1", "a", "b"), link("e3", "b", "d")];
    const viaC = [link("e2", "a", "c"), link("e4", "c", "d")];
    return scenarioOf(["a", "b", "c", "d"], first === "b" ? [...viaB, ...viaC] : [...viaC, ...viaB]);
  };

  it("returns the shortest path found first in visiting order among ties (7.4)", () => {
    expect(ok(findPath(diamond("b"), "a", "d", anyLink)).path).toEqual(["e1", "e3"]);
    expect(ok(findPath(diamond("c"), "a", "d", anyLink)).path).toEqual(["e2", "e4"]);
  });

  it("prefers fewer edges over earlier edges", () => {
    const sc = scenarioOf(["a", "b", "c"], [link("e1", "a", "b"), link("e2", "b", "c"), link("e3", "a", "c")]);
    expect(ok(findPath(sc, "a", "c", anyLink)).path).toEqual(["e3"]);
  });

  it("ignores edges that do not pass the filter", () => {
    const sc = scenarioOf(["a", "b"], [link("e1", "a", "b", "other")]);
    expect(ok(findPath(sc, "a", "b", anyLink))).toEqual({ path: null, unresolved: [] });
  });

  it("lists a missing node once when from and to are the same missing node (7.5)", () => {
    const sc = scenarioOf(["a"], []);
    expect(ok(findPath(sc, "gone", "gone", anyLink))).toEqual({ path: null, unresolved: ["gone"] });
  });

  it("lists both missing identifiers in code point order (7.5)", () => {
    const sc = scenarioOf(["a"], []);
    expect(ok(findPath(sc, "b2", "B1", anyLink))).toEqual({ path: null, unresolved: ["B1", "b2"] });
    expect(ok(findPath(sc, "a", "gone", anyLink))).toEqual({ path: null, unresolved: ["gone"] });
  });

  it("returns a one-edge path for a self-loop (7.7)", () => {
    const sc = scenarioOf(["a"], [link("e1", "a", "a")]);
    expect(ok(findPath(sc, "a", "a", anyLink)).path).toEqual(["e1"]);
  });

  it("returns the shortest cycle and never an empty path for from === to (7.7)", () => {
    const sc = scenarioOf(
      ["a", "b", "c"],
      [link("e1", "a", "b"), link("e2", "b", "c"), link("e3", "c", "a"), link("e4", "b", "a")],
    );
    expect(ok(findPath(sc, "a", "a", anyLink)).path).toEqual(["e1", "e4"]);
  });

  it("returns null when no cycle passes through the node (7.7)", () => {
    const sc = scenarioOf(["a", "b"], [link("e1", "a", "b")]);
    expect(ok(findPath(sc, "a", "a", anyLink))).toEqual({ path: null, unresolved: [] });
  });
});

describe("findReachable", () => {
  it("lists a start node only when a path leads back to it (7.2)", () => {
    const sc = scenarioOf(["a", "b", "c"], [link("e1", "a", "b"), link("e2", "b", "c")]);
    expect(ok(findReachable(sc, { ids: ["a"] }, anyLink)).nodes).toEqual(["b", "c"]);
    const cycle = scenarioOf(["a", "b"], [link("e1", "a", "b"), link("e2", "b", "a")]);
    expect(ok(findReachable(cycle, { ids: ["a"] }, anyLink)).nodes).toEqual(["a", "b"]);
  });
});

describe("propagate", () => {
  const nodes = ["n1", "n2", "n3", "n4", "n5"];
  const edges = [
    link("l1", "n1", "n3"),
    link("l2", "n1", "n2"),
    link("l3", "n2", "n4"),
    link("l4", "n3", "n4"),
    link("s1", "n3", "n5", "block"),
  ];
  const sc = scenarioOf(nodes, edges);
  const rules = rulesOf(["link"], ["block"]);
  const seeds = { ids: ["n1"] };

  it("orders reached nodes by step, then first-reach order (8.3)", () => {
    const r = ok(propagate(sc, rules, seeds));
    expect(r.reached).toEqual([
      { node: "n1", step: 0 },
      { node: "n3", step: 1, via: "l1" },
      { node: "n2", step: 1, via: "l2" },
      { node: "n4", step: 2, via: "l4" },
    ]);
    expect(r.traversed).toEqual(["l1", "l2", "l4"]);
    expect(r.stopped).toEqual(["s1"]);
    expect(r.unresolved).toEqual([]);
  });

  it("orders several seeds by the nodes list (8.3)", () => {
    const r = ok(propagate(sc, rules, { ids: ["n2", "n1"] }));
    expect(r.reached.slice(0, 2)).toEqual([
      { node: "n1", step: 0 },
      { node: "n2", step: 0 },
    ]);
  });

  it("reaches only the seeds with maxSteps 0 and stops nothing (8.6)", () => {
    const r = ok(propagate(sc, rules, seeds, 0));
    expect(r.reached).toEqual([{ node: "n1", step: 0 }]);
    expect(r.traversed).toEqual([]);
    expect(r.stopped).toEqual([]);
  });

  it("neither traverses nor stops a passing edge out of a step-k node (8.6)", () => {
    const r = ok(propagate(sc, rules, seeds, 1));
    expect(r.reached.map((x) => x.node)).toEqual(["n1", "n3", "n2"]);
    expect(r.traversed).toEqual(["l1", "l2"]);
    expect(r.stopped).toEqual(["s1"]);
    expect(r.stopped).not.toContain("l3");
    expect(r.traversed).not.toContain("l4");
  });

  it("does not stop an edge out of a node beyond maxSteps (8.6)", () => {
    const r = ok(propagate(scenarioOf(["n1", "n2", "n3"], [link("l1", "n1", "n2"), link("s1", "n2", "n3", "block")]), rules, seeds, 0));
    expect(r.stopped).toEqual([]);
  });

  it("rejects an invalid maxSteps at path maxSteps (8.7)", () => {
    for (const bad of [-1, 1.5, "2", Number.NaN]) {
      const out = propagate(sc, rules, seeds, bad as number);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors.map((e) => e.path)).toContain("maxSteps");
    }
  });

  it("returns an empty result when no seed is picked (8.8)", () => {
    const r = ok(propagate(sc, rules, { types: ["nothing"] }));
    expect(r).toEqual({ reached: [], traversed: [], stopped: [], unresolved: [] });
  });

  it("reports unresolved seed identifiers (8.10)", () => {
    const r = ok(propagate(sc, rules, { ids: ["n1", "gone"] }));
    expect(r.unresolved).toEqual(["gone"]);
    expect(r.reached[0]).toEqual({ node: "n1", step: 0 });
    const none = ok(propagate(sc, rules, { ids: ["gone"] }));
    expect(none.reached).toEqual([]);
    expect(none.unresolved).toEqual(["gone"]);
  });

  it("does not carry or stop undeclared edge types", () => {
    const only = scenarioOf(["n1", "n2"], [link("x1", "n1", "n2", "undeclared")]);
    const r = ok(propagate(only, rules, seeds));
    expect(r.reached).toEqual([{ node: "n1", step: 0 }]);
    expect(r.stopped).toEqual([]);
  });

  it("stops an edge even when its target is reached by another path", () => {
    const g = scenarioOf(["n1", "n2"], [link("l1", "n1", "n2"), link("s1", "n1", "n2", "block")]);
    const r = ok(propagate(g, rules, seeds));
    expect(r.stopped).toEqual(["s1"]);
    expect(r.reached.map((x) => x.node)).toEqual(["n1", "n2"]);
  });
});

describe("termination on cycles (7.6, 8.9)", () => {
  const size = 2000;
  const ids = Array.from({ length: size }, (_, i) => `n${i}`);
  const ring = scenarioOf(
    ids,
    ids.map((id, i) => link(`e${i}`, id, ids[(i + 1) % size] ?? id)),
  );

  it("finishes on a 2,000-node cycle", () => {
    const reach = ok(findReachable(ring, { ids: ["n0"] }, anyLink));
    expect(reach.nodes).toHaveLength(size);
    const path = ok(findPath(ring, "n0", "n0", anyLink)).path;
    expect(path).toHaveLength(size);
    const spread = ok(propagate(ring, rulesOf(["link"], []), { ids: ["n0"] }));
    expect(spread.reached).toHaveLength(size);
    expect(spread.reached[size - 1]?.step).toBe(size - 1);
  });

  it("finishes with self-loops", () => {
    const g = scenarioOf(["a"], [link("e1", "a", "a")]);
    expect(ok(propagate(g, rulesOf(["link"], []), { ids: ["a"] })).reached).toEqual([{ node: "a", step: 0 }]);
  });
});

import fc from "fast-check";
import { edgeFilterArb, ruleDefinitionArb, ruleScenarioArb, selectorArb } from "./arbitraries.ts";

describe("removing edges", () => {
  const removalArb = ruleScenarioArb.chain((s) =>
    fc.tuple(
      fc.constant(s),
      fc.array(fc.boolean(), { minLength: s.edges.length, maxLength: s.edges.length }),
      selectorArb(s, { self: false }),
      edgeFilterArb,
      ruleDefinitionArb(s),
      fc.option(fc.integer({ min: 0, max: s.nodes.length }), { nil: undefined }),
    ),
  );

  // Feature: core-rules, P-RULES-2: removing edges never increases the reachable set
  it("P-RULES-2 removing edges never increases the reachable set", () => {
    fc.assert(
      fc.property(removalArb, ([s, keep, selector, filter, rules, maxSteps]) => {
        const smaller: Scenario = { ...s, edges: s.edges.filter((_, i) => keep[i]) };
        const before = new Set(ok(findReachable(s, selector, filter)).nodes);
        for (const n of ok(findReachable(smaller, selector, filter)).nodes) expect(before.has(n)).toBe(true);
        const reachedBefore = new Set(ok(propagate(s, rules, selector, maxSteps)).reached.map((r) => r.node));
        for (const r of ok(propagate(smaller, rules, selector, maxSteps)).reached) expect(reachedBefore.has(r.node)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe("stopping edge types", () => {
  const stopArb = ruleScenarioArb.chain((s) =>
    fc.tuple(
      fc.constant(s),
      ruleDefinitionArb(s),
      selectorArb(s, { self: false }),
      fc.array(fc.boolean(), { minLength: s.edges.length, maxLength: s.edges.length }),
      fc.array(fc.nat(), { minLength: s.edges.length, maxLength: s.edges.length }),
    ),
  );

  // Feature: core-rules, P-RULES-3: propagation never passes a stopping Edge_Type
  it("P-RULES-3 propagation never passes a stopping Edge_Type", () => {
    fc.assert(
      fc.property(stopArb, ([s, def, selector, change, pick]) => {
        const { pass, stop } = def.propagation;
        const result = ok(propagate(s, def, selector, undefined));
        const seeds = result.reached.filter((r) => r.step === 0).map((r) => r.node);
        const edgeById = new Map(s.edges.map((e) => [e.id, e]));
        for (const r of result.reached) {
          if (r.step === 0) continue;
          const via = r.via === undefined ? undefined : edgeById.get(r.via);
          expect(via !== undefined && pass.includes(via.type)).toBe(true);
        }
        for (const id of result.stopped) expect(stop).toContain(edgeById.get(id)?.type);
        const reachable = ok(findReachable(s, { ids: seeds }, { include: pass })).nodes;
        expect(new Set(result.reached.map((r) => r.node))).toEqual(new Set([...seeds, ...reachable]));
        if (pass.length === 0) expect(result.reached.map((r) => r.node)).toEqual(seeds);

        const before = new Set(result.reached.map((r) => r.node));
        const retyped: Scenario = {
          ...s,
          edges: s.edges.map((e, i) => {
            if (!change[i]) return e;
            const choices = [...stop, "p3-fresh-type"];
            return { ...e, type: choices[(pick[i] ?? 0) % choices.length] ?? "p3-fresh-type" };
          }),
        };
        for (const r of ok(propagate(retyped, def, selector, undefined)).reached) expect(before.has(r.node)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe("step numbers", () => {
  const stepsArb = ruleScenarioArb.chain((s) =>
    fc.tuple(
      fc.constant(s),
      ruleDefinitionArb(s),
      selectorArb(s, { self: false }),
      fc.integer({ min: 0, max: s.nodes.length + 1 }),
    ),
  );

  // Feature: core-rules, P-RULES-4: step numbers are shortest distances
  it("P-RULES-4 step numbers are shortest distances", () => {
    fc.assert(
      fc.property(stepsArb, ([s, def, selector, k]) => {
        const { pass, stop } = def.propagation;
        const full = ok(propagate(s, def, selector, undefined));
        const edgeById = new Map(s.edges.map((e) => [e.id, e]));

        // each reached node appears once
        const names = full.reached.map((r) => r.node);
        expect(new Set(names).size).toBe(names.length);

        // reference distances by repeated relaxation from the seeds (step 0 entries)
        const dist = new Map<string, number>();
        for (const r of full.reached) if (r.step === 0) dist.set(r.node, 0);
        for (let changed = true; changed; ) {
          changed = false;
          for (const e of s.edges) {
            const d = dist.get(e.from);
            if (d === undefined || !pass.includes(e.type)) continue;
            const cur = dist.get(e.to);
            if (cur === undefined || d + 1 < cur) {
              dist.set(e.to, d + 1);
              changed = true;
            }
          }
        }
        expect(new Map(full.reached.map((r) => [r.node, r.step]))).toEqual(dist);

        // traversed edge starts one step earlier
        const stepOf = new Map(full.reached.map((r) => [r.node, r.step]));
        for (const r of full.reached) {
          if (r.step === 0) {
            expect(r.via).toBeUndefined();
            continue;
          }
          const via = r.via === undefined ? undefined : edgeById.get(r.via);
          expect(via?.to).toBe(r.node);
          expect(stepOf.get(via?.from ?? "")).toBe(r.step - 1);
        }

        // Max_Steps k equals the unlimited run cut at step k
        const cut = ok(propagate(s, def, selector, k));
        expect(cut.reached).toEqual(full.reached.filter((r) => r.step <= k));
        const expectedStopped = full.stopped.filter((id) => {
          const e = edgeById.get(id);
          return e !== undefined && stop.includes(e.type) && (stepOf.get(e.from) ?? Infinity) <= k;
        });
        expect(cut.stopped).toEqual(expectedStopped);
        for (const id of cut.stopped) expect(stepOf.get(edgeById.get(id)?.from ?? "") ?? Infinity).toBeLessThanOrEqual(k);
      }),
      { numRuns: 200 },
    );
  });
});

describe("path search", () => {
  const pathArb = ruleScenarioArb
    .filter((s) => s.nodes.length > 0)
    .chain((s) => {
      const ids = s.nodes.map((n) => n.id);
      const pick = fc.integer({ min: 0, max: ids.length - 1 }).map((i) => ids[i] ?? "");
      return fc.tuple(fc.constant(s), pick, pick, edgeFilterArb, fc.boolean());
    });

  // Feature: core-rules, P-RULES-5: path search agrees with reachability
  it("P-RULES-5 path search agrees with reachability", () => {
    fc.assert(
      fc.property(pathArb, ([s, a, b, filter, forceInclude]) => {
        const f = forceInclude && filter.include !== undefined ? { include: filter.include } : filter;
        const passes = (type: string): boolean =>
          (f.include === undefined || f.include.includes(type)) && !(f.exclude?.includes(type) ?? false);
        const edges = s.edges.filter((e) => passes(e.type));
        const edgeById = new Map(s.edges.map((e) => [e.id, e]));

        // reference distances from a using at least one Edge, by relaxation
        const dist = new Map<string, number>();
        for (const e of edges) if (e.from === a && (dist.get(e.to) ?? Infinity) > 1) dist.set(e.to, 1);
        for (let changed = true; changed; ) {
          changed = false;
          for (const e of edges) {
            const d = dist.get(e.from);
            if (d !== undefined && d + 1 < (dist.get(e.to) ?? Infinity)) {
              dist.set(e.to, d + 1);
              changed = true;
            }
          }
        }

        const reach = ok(findReachable(s, { ids: [a] }, f)).nodes;
        expect(reach).toEqual(s.nodes.map((n) => n.id).filter((id) => dist.has(id)));

        const path = ok(findPath(s, a, b, f)).path;
        expect(path !== null).toBe(reach.includes(b));
        if (path === null) return;
        expect(path.length).toBeGreaterThan(0);
        expect(path.length).toBe(dist.get(b));
        let at = a;
        for (const id of path) {
          const e = edgeById.get(id);
          expect(e).toBeDefined();
          expect(passes(e?.type ?? "")).toBe(true);
          expect(e?.from).toBe(at);
          at = e?.to ?? "";
        }
        expect(at).toBe(b);

        if (f.exclude === undefined && f.include !== undefined && a !== b) {
          const def: RuleDefinition = rulesOf(f.include, []);
          const reached = ok(propagate(s, def, { ids: [a] })).reached;
          const viaOf = new Map(reached.map((r) => [r.node, r.via]));
          const chain: string[] = [];
          for (let cur = b; cur !== a; ) {
            const v = viaOf.get(cur);
            if (v === undefined) throw new Error("missing via");
            chain.push(v);
            cur = edgeById.get(v)?.from ?? a;
          }
          expect(path).toEqual(chain.reverse());
        }
      }),
      { numRuns: 200 },
    );
  });
});
