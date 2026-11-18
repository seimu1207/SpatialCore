import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  attrPool,
  edgeFilterArb,
  identifierArb,
  jsonEqual,
  judgementResultsArb,
  marksArb,
  maxStepsArb,
  ruleDefinitionArb,
  ruleScenarioArb,
  scenarioArb,
  selectorArb,
  seriesSettingsArb,
  uniquePropagationArb,
} from "./arbitraries.ts";
import { evaluateCheckSets, evaluateNodeRules } from "./conditions.ts";
import { findPath, findReachable, propagate } from "./paths.ts";
import { sumAttribute, checkSeriesList } from "./series.ts";
import { timelineFromPropagation, timelineFromZones } from "./timeline.ts";
import { buildEffects, compareEffects } from "./effects.ts";
import { effectRequestSchema, type EffectRequest, type JudgementResults, type RuleDefinition, type SeriesResult } from "./rule-schema.ts";
import type { Edge, Node, Scenario, Zone } from "./scenario-schema.ts";

const origin = { x: 0, y: 0, z: 0 };

function item(id: string, zone?: string): Node {
  return {
    id,
    type: "item",
    position: origin,
    rotation: origin,
    scale: { x: 1, y: 1, z: 1 },
    front: { text: { en: id } },
    metadata: {},
    attributes: {},
    ...(zone === undefined ? {} : { zone }),
  };
}

function link(id: string, from: string, to: string): Edge {
  return { id, from, to, type: "open-link" };
}

function zoneOf(id: string, order: number): Zone {
  return { id, label: { en: id }, order, elevation: 0, enclosed: false };
}

const scenario: Scenario = {
  schemaVersion: 1,
  id: "s1",
  title: { en: "t" },
  nodes: [item("n1", "a"), item("n2", "b"), item("n3", "c")],
  edges: [link("e1", "n1", "n2")],
  zones: [zoneOf("a", 0), zoneOf("b", 1), zoneOf("c", 2)],
};

const rules: RuleDefinition = {
  schemaVersion: 1,
  id: "r1",
  propagation: { pass: ["open-link"], stop: [] },
  effectRules: [
    { id: "mark-shift", effect: "fog", source: { kind: "shifts", attribute: "level" } },
    { id: "mark-spread", effect: "glow", source: { kind: "propagation" } },
  ],
};

const levelSeries: SeriesResult = {
  attribute: "level",
  series: [],
  changes: [],
  shifts: [
    { from: "b", to: "c", change: 38, intentional: false },
    { from: "a", to: "b", change: 40, intentional: true },
  ],
  longRuns: [],
  unresolved: [],
};

function values(r: ReturnType<typeof buildEffects>) {
  expect(r.ok).toBe(true);
  return r.ok ? r.value : [];
}

describe("buildEffects", () => {
  it("returns the design example request for a non-intentional Shift only (13.1)", () => {
    const out = values(buildEffects(scenario, { ...rules, effectRules: [{ id: "mark-shift", effect: "fog", source: { kind: "shifts", attribute: "level" } }] }, { series: [levelSeries] }));
    expect(out).toEqual([{ effect: "fog", target: { kind: "zone", id: "c" }, source: "mark-shift" }]);
  });

  it("produces nothing for intentional Shifts", () => {
    const only: SeriesResult = { ...levelSeries, shifts: [{ from: "a", to: "b", change: 40, intentional: true }] };
    expect(values(buildEffects(scenario, rules, { series: [only] }))).toEqual([]);
  });

  it("skips an Effect_Rule whose result was not given, keeping the others (13.6)", () => {
    const results: JudgementResults = {
      propagation: { reached: [{ node: "n1", step: 0 }], traversed: [], stopped: [], unresolved: [] },
    };
    const out = values(buildEffects(scenario, rules, results));
    expect(out).toEqual([{ effect: "glow", target: { kind: "node", id: "n1" }, source: "mark-spread" }]);
  });

  it("skips a Shift rule when no Series_Result has the attribute (13.6)", () => {
    const other: SeriesResult = { ...levelSeries, attribute: "other" };
    expect(values(buildEffects(scenario, rules, { series: [other] }))).toEqual([]);
  });

  it("returns [] when the Rule_Definition has no effectRules (13.7)", () => {
    const { effectRules: _unused, ...bare } = rules;
    void _unused;
    expect(values(buildEffects(scenario, bare, { series: [levelSeries] }))).toEqual([]);
  });

  it("returns [] when every Effect_Rule produces nothing (13.7)", () => {
    expect(values(buildEffects(scenario, rules, {}))).toEqual([]);
  });

  it("drops unknown identifiers without a failure and sorts the rest (13.1)", () => {
    const results: JudgementResults = {
      propagation: {
        reached: [
          { node: "n2", step: 1, via: "e1" },
          { node: "missing-node", step: 1 },
          { node: "n1", step: 0 },
        ],
        traversed: ["e1", "e-missing", "e1"],
        stopped: [],
        unresolved: [],
      },
    };
    const out = values(buildEffects(scenario, rules, results));
    expect(out.map((e) => `${e.target.kind}:${e.target.id}`)).toEqual(["edge:e1", "node:n1", "node:n2"]);
  });
});

// Feature: core-rules, P-RULES-12: effect requests are well formed
describe("P-RULES-12 effect requests are well formed", () => {
  const input = scenarioArb.chain((s) => fc.tuple(fc.constant(s), ruleDefinitionArb(s), judgementResultsArb(s)));

  function cleaned(s: Scenario, r: JudgementResults): JudgementResults {
    const nodes = new Set(s.nodes.map((n) => n.id));
    const edges = new Set(s.edges.map((e) => e.id));
    const zones = new Set(s.zones.map((z) => z.id));
    const out: JudgementResults = {};
    if (r.nodeRules !== undefined) {
      out.nodeRules = r.nodeRules.map((n) => ({ ...n, nodes: n.nodes.filter((id) => nodes.has(id)) }));
    }
    if (r.series !== undefined) {
      out.series = r.series.map((x) => ({
        ...x,
        shifts: x.shifts.filter((c) => zones.has(c.to)),
        longRuns: x.longRuns.map((run) => run.filter((id) => zones.has(id))),
      }));
    }
    if (r.propagation !== undefined) {
      const reached = r.propagation.reached
        .filter((e) => nodes.has(e.node))
        .map(({ via, ...rest }) => (via !== undefined && edges.has(via) ? { ...rest, via } : rest));
      out.propagation = {
        ...r.propagation,
        reached: reached.map((e) => ({ ...e, step: Math.min(e.step, Math.max(reached.length - 1, 0)) })),
        traversed: r.propagation.traversed.filter((id) => edges.has(id)),
        stopped: r.propagation.stopped.filter((id) => edges.has(id)),
      };
    }
    return out;
  }

  function reference(s: Scenario, def: RuleDefinition, r: JudgementResults): EffectRequest[] {
    const has = {
      node: new Set(s.nodes.map((n) => n.id)),
      edge: new Set(s.edges.map((e) => e.id)),
      zone: new Set(s.zones.map((z) => z.id)),
    };
    const all: EffectRequest[] = [];
    for (const rule of def.effectRules ?? []) {
      const src = rule.source;
      const add = (kind: "node" | "edge" | "zone", id: string) => {
        if (has[kind].has(id)) all.push({ effect: rule.effect, target: { kind, id }, source: rule.id });
      };
      if (src.kind === "nodeRule") {
        for (const n of r.nodeRules ?? []) if (n.id === src.id) n.nodes.forEach((id) => add("node", id));
      } else if (src.kind === "shifts") {
        for (const x of r.series ?? []) if (x.attribute === src.attribute) x.shifts.forEach((h) => !h.intentional && add("zone", h.to));
      } else if (src.kind === "longRuns") {
        for (const x of r.series ?? []) if (x.attribute === src.attribute) x.longRuns.forEach((run) => run.forEach((id) => add("zone", id)));
      } else if (r.propagation !== undefined) {
        r.propagation.reached.forEach((e) => add("node", e.node));
        r.propagation.traversed.forEach((id) => add("edge", id));
      }
    }
    const key = (e: EffectRequest) => JSON.stringify([e.effect, e.target.kind, e.target.id, e.source]);
    const seen = new Set<string>();
    return all.filter((e) => !seen.has(key(e)) && seen.add(key(e)));
  }

  it("P-RULES-12 holds for every scenario, rule definition, and judgement result", () => {
    fc.assert(
      fc.property(input, ([s, def, results]) => {
        const out = buildEffects(s, def, results);
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        const list = out.value;
        for (let i = 1; i < list.length; i++) {
          expect(compareEffects(list[i - 1], list[i])).toBeLessThan(0);
        }
        const sets = { node: new Set(s.nodes.map((n) => n.id)), edge: new Set(s.edges.map((e) => e.id)), zone: new Set(s.zones.map((z) => z.id)) };
        for (const e of list) {
          expect(Object.keys(e).sort()).toEqual(["effect", "source", "target"]);
          expect(effectRequestSchema.safeParse(e).success).toBe(true);
          expect(sets[e.target.kind].has(e.target.id)).toBe(true);
        }
        const cleanedOut = buildEffects(s, def, cleaned(s, results));
        expect(cleanedOut).toEqual(out);
        const expected = reference(s, def, results);
        expect([...list].sort(compareEffects)).toEqual([...expected].sort(compareEffects));
        expect(list.length).toBe(expected.length);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: core-rules, P-RULES-1: same input → same result
describe("P-RULES-1 same input → same result", () => {
  /** Runs `fn` on the arguments, then on a structuredClone made before the first call. Results must be strictly equal and arguments unchanged. */
  function twice<A extends unknown[], R>(fn: (...args: A) => R, args: A): void {
    const copy = structuredClone(args);
    const first = fn(...args);
    const second = fn(...copy);
    expect(second).toStrictEqual(first);
    expect(jsonEqual(args, copy)).toBe(true);
  }

  const input = ruleScenarioArb.chain((s) =>
    fc.tuple(
      fc.constant(s),
      ruleDefinitionArb(s),
      selectorArb(s, { self: false }),
      edgeFilterArb,
      maxStepsArb(s),
      fc.array(seriesSettingsArb, { maxLength: 3 }),
      marksArb(s),
      judgementResultsArb(s),
      uniquePropagationArb(s),
      fc.tuple(identifierArb, identifierArb),
      fc.constantFrom(...attrPool),
    ),
  );

  it("P-RULES-1 holds for every engine function", () => {
    fc.assert(
      fc.property(input, ([s, def, sel, filter, maxSteps, settings, marks, judged, unique, [from, to], attr]) => {
        twice(evaluateCheckSets, [s, def]);
        twice(evaluateNodeRules, [s, def]);
        twice(findReachable, [s, sel, filter]);
        twice(findPath, [s, from, to, filter]);
        twice(propagate, [s, def, sel, maxSteps]);
        twice(sumAttribute, [s, sel, attr]);
        twice(checkSeriesList, [s, settings, marks]);
        twice(buildEffects, [s, def, judged]);
        twice(timelineFromPropagation, [unique]);
        twice(timelineFromZones, [s]);
        const reached = propagate(s, def, sel, maxSteps);
        if (reached.ok) twice(timelineFromPropagation, [reached.value]);
      }),
      { numRuns: 200 },
    );
  });
});
