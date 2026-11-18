import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  attrPool,
  conditionArb,
  edgeFilterArb,
  identifierArb,
  judgementResultsArb,
  marksArb,
  maxStepsArb,
  ruleDefinitionArb,
  ruleScenarioArb,
  selectorArb,
  seriesSettingsArb,
  typePoolArb,
} from "./arbitraries.ts";
import { evaluateCheckSets, evaluateCondition, evaluateNodeRules } from "./conditions.ts";
import { buildEffects } from "./effects.ts";
import { selectNodes } from "./graph-index.ts";
import { findPath, findReachable, propagate } from "./paths.ts";
import { checkSeriesList, sumAttribute } from "./series.ts";
import { timelineFromZones } from "./timeline.ts";
import type { Condition, EdgeFilter, NodeSelector, RuleDefinition } from "./rule-schema.ts";
import type { Edge, Node, Scenario } from "./scenario-schema.ts";

const origin = { x: 0, y: 0, z: 0 };

function item(id: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    type: "item",
    position: origin,
    rotation: origin,
    scale: { x: 1, y: 1, z: 1 },
    front: { text: { en: id } },
    metadata: {},
    attributes: {},
    ...extra,
  };
}

function link(id: string, from: string, to: string, type = "link"): Edge {
  return { id, from, to, type };
}

function scenarioOf(nodes: Node[], edges: Edge[] = []): Scenario {
  return {
    schemaVersion: 1,
    id: "s1",
    title: { en: "t" },
    nodes,
    edges,
    zones: [{ id: "level1", label: { en: "level" }, order: 0, elevation: 0, enclosed: false }],
  };
}

function rulesOf(extra: Partial<RuleDefinition> = {}): RuleDefinition {
  return { schemaVersion: 1, id: "r1", propagation: { pass: [], stop: [] }, ...extra };
}

const big = { a: 1e308 };

describe("reach", () => {
  it("finishes on a 2,000-Node cycle and gives the same answer twice (4.9)", () => {
    const count = 2000;
    const nodes = Array.from({ length: count }, (_, i) => item(`n${i}`));
    const edges = nodes.map((n, i) => link(`e${i}`, n.id, `n${(i + 1) % count}`));
    const condition: Condition = {
      kind: "reach",
      from: { ids: ["n0"] },
      to: { ids: ["n1999"] },
      edges: {},
    };
    const sc = scenarioOf(nodes, edges);
    const first = evaluateCondition(sc, condition);
    const second = evaluateCondition(structuredClone(sc), structuredClone(condition));
    expect(first).toEqual({ ok: true, value: { holds: true, unresolved: [] } });
    expect(second).toEqual(first);
  });
});

describe("Rule_Failure from an overflowing attribute", () => {
  const overflow: Condition = { kind: "attribute", nodes: { ids: ["t1", "t2"] }, attribute: "a", min: 0 };
  const sc = scenarioOf([item("t1", { attributes: big }), item("t2", { attributes: big })]);

  it("fails the whole call at the path of the second branch of an any whose first branch holds (4.10)", () => {
    const rules = rulesOf({
      checkSets: [
        {
          id: "c1",
          items: [
            {
              id: "i1",
              condition: {
                kind: "any",
                conditions: [{ kind: "attribute", nodes: { ids: ["t1"] }, attribute: "a", min: 0 }, overflow],
              },
            },
          ],
        },
      ],
    });
    const result = evaluateCheckSets(sc, rules);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe("rules.checkSets.0.items.0.condition.conditions.1.attribute");
    expect(result).not.toHaveProperty("value");
  });

  it("fails a later check set even when an earlier one succeeds (5.7)", () => {
    const rules = rulesOf({
      checkSets: [
        { id: "c1", items: [] },
        { id: "c2", items: [{ id: "i1", condition: overflow }] },
      ],
    });
    const result = evaluateCheckSets(sc, rules);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].path).toBe("rules.checkSets.1.items.0.condition.attribute");
  });

  it("fails a node rule call when any candidate overflows (6.7)", () => {
    const rules = rulesOf({
      nodeRules: [
        { id: "r1", nodes: { ids: ["t1"] }, condition: { kind: "not", condition: overflow } },
        { id: "r2", nodes: { ids: ["t2"] }, condition: { kind: "all", conditions: [] } },
      ],
    });
    const result = evaluateNodeRules(sc, rules);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      { path: "rules.nodeRules.0.condition.condition.attribute", message: expect.stringContaining('"a"') as string },
    ]);
  });
});

describe("check sets", () => {
  it("treats item ids as opaque and keeps the order of items (5.5)", () => {
    const odd = ["__proto__", " a", "A", "a", "繝ｩ繝吶Ν"];
    const rules = rulesOf({
      checkSets: [
        {
          id: "c1",
          items: odd.map((id, i) => ({
            id,
            condition: { kind: "attribute", nodes: { ids: ["t1"] }, attribute: "a", min: i < 2 ? 0 : 5 },
          })),
        },
      ],
    });
    const result = evaluateCheckSets(scenarioOf([item("t1", { attributes: { a: 1 } })]), rules);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [set] = result.value;
    expect(set.items.map((i) => i.id)).toEqual(odd);
    expect(set.items.map((i) => i.holds)).toEqual([true, true, false, false, false]);
    expect(set.allHold).toBe(false);
    expect(Object.keys(set.items[0]).sort()).toEqual(["holds", "id"]);
  });

  it("gives [] when checkSets is absent or empty (5.6)", () => {
    const sc = scenarioOf([item("t1")]);
    expect(evaluateCheckSets(sc, rulesOf())).toEqual({ ok: true, value: [] });
    expect(evaluateCheckSets(sc, rulesOf({ checkSets: [] }))).toEqual({ ok: true, value: [] });
  });

  it("gives allHold true for a set with no items (5.2)", () => {
    const result = evaluateCheckSets(scenarioOf([]), rulesOf({ checkSets: [{ id: "c1", items: [] }] }));
    expect(result).toEqual({ ok: true, value: [{ id: "c1", items: [], allHold: true, unresolved: [] }] });
  });
});

describe("node rules", () => {
  it("gives [] when nodeRules is absent or empty (6.4)", () => {
    const sc = scenarioOf([item("t1")]);
    expect(evaluateNodeRules(sc, rulesOf())).toEqual({ ok: true, value: [] });
    expect(evaluateNodeRules(sc, rulesOf({ nodeRules: [] }))).toEqual({ ok: true, value: [] });
  });

  it("reports references even when no candidate is picked (6.6)", () => {
    const rules = rulesOf({
      nodeRules: [
        {
          id: "r1",
          nodes: { ids: ["gone1"], zones: ["gone2"] },
          condition: { kind: "reach", from: { ids: ["gone3"] }, to: { self: true }, edges: {} },
        },
      ],
    });
    const result = evaluateNodeRules(scenarioOf([item("t1")]), rules);
    expect(result).toEqual({
      ok: true,
      value: [{ id: "r1", nodes: [], unresolved: ["gone1", "gone2", "gone3"] }],
    });
  });

  it("evaluates the condition once per candidate with that candidate as self", () => {
    const rules = rulesOf({
      nodeRules: [
        {
          id: "r1",
          nodes: { types: ["item"] },
          condition: { kind: "attribute", nodes: { self: true }, attribute: "a", min: 2 },
        },
      ],
    });
    const sc = scenarioOf([
      item("t1", { attributes: { a: 1 } }),
      item("t2", { attributes: { a: 3 } }),
      item("t3", { attributes: { a: 2 } }),
    ]);
    expect(evaluateNodeRules(sc, rules)).toEqual({
      ok: true,
      value: [{ id: "r1", nodes: ["t2", "t3"], unresolved: [] }],
    });
  });
});

// ---------------------------------------------------------------------------
// P-RULES-6
// ---------------------------------------------------------------------------

function holdsOf(sc: Scenario, c: Condition): boolean {
  const r = evaluateCondition(sc, c);
  if (!r.ok) throw new Error(`evaluateCondition failed: ${JSON.stringify(r.errors)}`);
  return r.value.holds;
}

describe("P-RULES-6 condition logic", () => {
  const plain = (sc: Scenario, maxDepth = 2): fc.Arbitrary<Condition> => conditionArb(sc, { self: false, maxDepth });

  // Feature: core-rules, P-RULES-6: condition logic
  it("P-RULES-6: not(not(c)) equals c, all([]) holds, any([]) does not", () => {
    fc.assert(
      fc.property(
        ruleScenarioArb.chain((sc) => fc.tuple(fc.constant(sc), plain(sc))),
        ([sc, c]) => {
          expect(holdsOf(sc, { kind: "not", condition: { kind: "not", condition: c } })).toBe(holdsOf(sc, c));
          expect(holdsOf(sc, { kind: "all", conditions: [] })).toBe(true);
          expect(holdsOf(sc, { kind: "any", conditions: [] })).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: core-rules, P-RULES-6: condition logic
  it("P-RULES-6: all and any equal the conjunction and disjunction of the members", () => {
    fc.assert(
      fc.property(
        ruleScenarioArb.chain((sc) => fc.tuple(fc.constant(sc), fc.array(plain(sc), { maxLength: 4 }))),
        ([sc, list]) => {
          const each = list.map((c) => holdsOf(sc, c));
          expect(holdsOf(sc, { kind: "all", conditions: list })).toBe(each.every(Boolean));
          expect(holdsOf(sc, { kind: "any", conditions: list })).toBe(each.some(Boolean));
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: core-rules, P-RULES-6: condition logic
  it("P-RULES-6: removing Edges keeps a max-only edgeCount true, a min-only edgeCount false, and a false reach false", () => {
    const arb = ruleScenarioArb.chain((sc) =>
      fc.tuple(
        fc.constant(sc),
        fc.array(fc.boolean(), { minLength: sc.edges.length, maxLength: sc.edges.length }),
        edgeFilterArb,
        selectorArb(sc, { self: false }),
        selectorArb(sc, { self: false }),
        fc.nat({ max: 4 }),
      ),
    );
    fc.assert(
      fc.property(arb, ([sc, keep, edges, from, to, bound]) => {
        const smaller: Scenario = { ...sc, edges: sc.edges.filter((_, i) => keep[i]) };
        const maxOnly: Condition = { kind: "edgeCount", edges, from, to, max: bound };
        const minOnly: Condition = { kind: "edgeCount", edges, from, to, min: bound };
        const reach: Condition = { kind: "reach", from, to, edges };
        if (holdsOf(sc, maxOnly)) expect(holdsOf(smaller, maxOnly)).toBe(true);
        if (!holdsOf(sc, minOnly)) expect(holdsOf(smaller, minOnly)).toBe(false);
        if (!holdsOf(sc, reach)) expect(holdsOf(smaller, reach)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P-RULES-7
// ---------------------------------------------------------------------------

describe("P-RULES-7 check set verdict", () => {
  // Feature: core-rules, P-RULES-7: check set verdict
  it("P-RULES-7: allHold is the conjunction, each item equals evaluateCondition, reversing items changes no item result", () => {
    const arb = ruleScenarioArb.chain((sc) =>
      fc.tuple(
        fc.constant(sc),
        fc.array(fc.array(conditionArb(sc, { self: false, maxDepth: 2 }), { maxLength: 4 }), { maxLength: 3 }),
      ),
    );
    fc.assert(
      fc.property(arb, ([sc, sets]) => {
        const build = (reverse: boolean): RuleDefinition =>
          rulesOf({
            checkSets: sets.map((conds, s) => {
              const items = conds.map((condition, i) => ({ id: `i${i}`, condition }));
              return { id: `c${s}`, items: reverse ? [...items].reverse() : items };
            }),
          });
        const result = evaluateCheckSets(sc, build(false));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value).toHaveLength(sets.length);
        result.value.forEach((set, s) => {
          expect(set.id).toBe(`c${s}`);
          expect(set.items).toHaveLength(sets[s].length);
          sets[s].forEach((condition, i) => {
            expect(set.items[i].id).toBe(`i${i}`);
            expect(set.items[i].holds).toBe(holdsOf(sc, condition));
          });
          expect(set.allHold).toBe(set.items.every((it) => it.holds));
        });
        const reversed = evaluateCheckSets(sc, build(true));
        expect(reversed.ok).toBe(true);
        if (!reversed.ok) return;
        reversed.value.forEach((set, s) => {
          const byId = (items: { id: string; holds: boolean }[]) =>
            Object.fromEntries(items.map((it) => [it.id, it.holds]));
          expect(byId(set.items)).toEqual(byId(result.value[s].items));
          expect(set.allHold).toBe(result.value[s].allHold);
        });
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P-RULES-15: reference model
// ---------------------------------------------------------------------------

type Selector = NodeSelector;
type Filter = EdgeFilter;

function refMatches(n: Node, s: Selector): boolean {
  if (s.ids !== undefined && !s.ids.includes(n.id)) return false;
  if (s.types !== undefined && !s.types.includes(n.type)) return false;
  if (s.zones !== undefined && (n.zone === undefined || !s.zones.includes(n.zone))) return false;
  return true;
}

function refPass(f: Filter, type: string): boolean {
  if (f.include !== undefined && !f.include.includes(type)) return false;
  if (f.exclude !== undefined && f.exclude.includes(type)) return false;
  return true;
}

function refInRange(v: number, c: { min?: number; max?: number }): boolean {
  return (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max);
}

function refCompare(a: string, b: string): number {
  const x = Array.from(a, (ch) => ch.codePointAt(0) ?? 0);
  const y = Array.from(b, (ch) => ch.codePointAt(0) ?? 0);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
}

function refUnresolvedSelector(sc: Scenario, s: Selector, into: Set<string>): void {
  for (const id of s.ids ?? []) if (!sc.nodes.some((n) => n.id === id)) into.add(id);
  for (const id of s.zones ?? []) if (!sc.zones.some((z) => z.id === id)) into.add(id);
}

function refUnresolved(sc: Scenario, c: Condition, into: Set<string>): void {
  if (c.kind === "edgeCount" || c.kind === "reach") {
    refUnresolvedSelector(sc, c.from, into);
    refUnresolvedSelector(sc, c.to, into);
  } else if (c.kind === "attribute") {
    refUnresolvedSelector(sc, c.nodes, into);
  } else if (c.kind === "not") {
    refUnresolved(sc, c.condition, into);
  } else {
    c.conditions.forEach((child) => refUnresolved(sc, child, into));
  }
}

const refSorted = (ids: Set<string>): string[] => [...ids].sort(refCompare);

function refLeaf(sc: Scenario, c: Condition): boolean {
  const pick = (s: Selector): Node[] => sc.nodes.filter((n) => refMatches(n, s));
  if (c.kind === "edgeCount") {
    const from = pick(c.from).map((n) => n.id);
    const to = pick(c.to).map((n) => n.id);
    const count = sc.edges.filter((e) => refPass(c.edges, e.type) && from.includes(e.from) && to.includes(e.to)).length;
    return refInRange(count, c);
  }
  if (c.kind === "reach") {
    const reached = new Set<string>();
    let frontier = pick(c.from).map((n) => n.id);
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const e of sc.edges) {
        if (!refPass(c.edges, e.type) || !frontier.includes(e.from) || reached.has(e.to)) continue;
        reached.add(e.to);
        next.push(e.to);
      }
      frontier = next;
    }
    return pick(c.to).some((n) => reached.has(n.id));
  }
  if (c.kind === "attribute") {
    let sum = 0;
    for (const n of pick(c.nodes)) {
      if (n.attributes !== undefined && Object.hasOwn(n.attributes, c.attribute)) sum += n.attributes[c.attribute];
    }
    return refInRange(sum, c);
  }
  throw new Error("leaf expected");
}

/** Replaces `self: true` by the Node id, as an intersection with any `ids`. */
function substituteSelf(c: Condition, id: string): Condition {
  const sel = (s: Selector): Selector => {
    if (!s.self) return s;
    const rest: Selector = { ...s };
    delete rest.self;
    return { ...rest, ids: rest.ids === undefined ? [id] : rest.ids.filter((x) => x === id) };
  };
  switch (c.kind) {
    case "edgeCount":
      return { ...c, from: sel(c.from), to: sel(c.to) };
    case "reach":
      return { ...c, from: sel(c.from), to: sel(c.to) };
    case "attribute":
      return { ...c, nodes: sel(c.nodes) };
    case "not":
      return { kind: "not", condition: substituteSelf(c.condition, id) };
    default:
      return { kind: c.kind, conditions: c.conditions.map((x) => substituteSelf(x, id)) };
  }
}

describe("P-RULES-15 reference model", () => {
  // Feature: core-rules, P-RULES-15: leaf conditions, selectors, and node rules agree with a reference model
  it("P-RULES-15: selectNodes and leaf Conditions equal the reference model", () => {
    const arb = ruleScenarioArb.chain((sc) =>
      fc.tuple(fc.constant(sc), selectorArb(sc, { self: false }), conditionArb(sc, { self: false, maxDepth: 0 })),
    );
    fc.assert(
      fc.property(arb, ([sc, sel, leaf]) => {
        const picked = selectNodes(sc, sel);
        expect(picked.ok).toBe(true);
        if (!picked.ok) return;
        expect(picked.value.nodes).toEqual(sc.nodes.filter((n) => refMatches(n, sel)).map((n) => n.id));
        const missing = new Set<string>();
        refUnresolvedSelector(sc, sel, missing);
        expect(picked.value.unresolved).toEqual(refSorted(missing));
        expect(holdsOf(sc, leaf)).toBe(refLeaf(sc, leaf));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: core-rules, P-RULES-15: leaf conditions, selectors, and node rules agree with a reference model
  it("P-RULES-15: Node_Rules and unresolved ids equal the reference model", () => {
    const arb = ruleScenarioArb.chain((sc) => fc.tuple(fc.constant(sc), ruleDefinitionArb(sc)));
    fc.assert(
      fc.property(arb, ([sc, def]) => {
        const rulesOut = evaluateNodeRules(sc, def);
        const setsOut = evaluateCheckSets(sc, def);
        expect(rulesOut.ok).toBe(true);
        expect(setsOut.ok).toBe(true);
        if (!rulesOut.ok || !setsOut.ok) return;
        const rules = def.nodeRules ?? [];
        expect(rulesOut.value).toHaveLength(rules.length);
        rules.forEach((rule, r) => {
          const expected = sc.nodes
            .filter((n) => refMatches(n, rule.nodes))
            .filter((n) => holdsOf(sc, substituteSelf(rule.condition, n.id)))
            .map((n) => n.id);
          const missing = new Set<string>();
          refUnresolvedSelector(sc, rule.nodes, missing);
          refUnresolved(sc, rule.condition, missing);
          expect(rulesOut.value[r]).toEqual({ id: rule.id, nodes: expected, unresolved: refSorted(missing) });
        });
        const sets = def.checkSets ?? [];
        expect(setsOut.value).toHaveLength(sets.length);
        sets.forEach((set, s) => {
          const missing = new Set<string>();
          set.items.forEach((it) => refUnresolved(sc, it.condition, missing));
          expect(setsOut.value[s].unresolved).toEqual(refSorted(missing));
        });
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P-RULES-16: only the fields the engine reads
// ---------------------------------------------------------------------------

function idPool(ids: readonly string[]): fc.Arbitrary<string> {
  return ids.length > 0 ? fc.oneof(fc.constantFrom(...ids), identifierArb) : identifierArb;
}

const policyArb = fc
  .tuple(fc.uniqueArray(typePoolArb, { maxLength: 4 }), fc.nat(4))
  .map(([types, k]) => ({ pass: types.slice(0, k), stop: types.slice(k) }));

/** Replaces every field the engine does not read by another valid value. `k` makes the new values differ. */
function changeUnread(sc: Scenario, k: number): Scenario {
  return {
    ...sc,
    nodes: sc.nodes.map((n, i) => {
      const next: Node = {
        ...n,
        position: { x: k + i, y: k - i, z: k },
        rotation: { x: i, y: k, z: -k },
        scale: { x: k + 1, y: 2 + i, z: 3 },
        front: { text: { en: `front ${k} ${i}` }, detail: { en: "d" } },
        metadata: { changed: k, at: i },
      };
      if (n.back === undefined) next.back = { image: `img-${k}` };
      else delete next.back;
      return next;
    }),
    edges: sc.edges.map((e, i) => {
      const next: Edge = { ...e };
      if (e.label === undefined) next.label = { en: `label ${k} ${i}` };
      else delete next.label;
      return next;
    }),
    zones: sc.zones.map((z, i) => ({
      ...z,
      label: { en: `zone ${k} ${i}`, ja: "x" },
      elevation: z.elevation + k + 1,
      enclosed: !z.enclosed,
    })),
  };
}

describe("P-RULES-16 fields the engine reads", () => {
  const arb = ruleScenarioArb.chain((sc) =>
    fc.tuple(
      fc.constant(sc),
      ruleDefinitionArb(sc),
      policyArb,
      selectorArb(sc, { self: false }),
      edgeFilterArb,
      idPool(sc.nodes.map((n) => n.id)),
      idPool(sc.nodes.map((n) => n.id)),
      maxStepsArb(sc),
      fc.constantFrom(...attrPool),
      fc.array(seriesSettingsArb, { maxLength: 2 }),
      marksArb(sc),
      judgementResultsArb(sc),
      fc.integer({ min: 0, max: 1000 }),
    ),
  );

  // Feature: core-rules, P-RULES-16: results depend only on the fields the engine reads
  it("P-RULES-16: replacing propagation leaves conditions, node rules, reachability, and paths unchanged", () => {
    fc.assert(
      fc.property(arb, ([sc, def, policy, sel, filter, from, to]) => {
        const other: RuleDefinition = { ...def, propagation: policy };
        expect(evaluateCheckSets(sc, other)).toStrictEqual(evaluateCheckSets(sc, def));
        expect(evaluateNodeRules(sc, other)).toStrictEqual(evaluateNodeRules(sc, def));
        expect(findReachable(sc, sel, filter)).toStrictEqual(findReachable(sc, sel, filter));
        expect(findPath(sc, from, to, filter)).toStrictEqual(findPath(sc, from, to, filter));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: core-rules, P-RULES-16: results depend only on the fields the engine reads
  it("P-RULES-16: changing unread Node, Edge, and Zone fields leaves every result unchanged", () => {
    fc.assert(
      fc.property(arb, ([sc, def, , sel, filter, from, to, maxSteps, attr, settings, marks, results, k]) => {
        const changed = changeUnread(sc, k);
        expect(evaluateCheckSets(changed, def)).toStrictEqual(evaluateCheckSets(sc, def));
        expect(evaluateNodeRules(changed, def)).toStrictEqual(evaluateNodeRules(sc, def));
        expect(findReachable(changed, sel, filter)).toStrictEqual(findReachable(sc, sel, filter));
        expect(findPath(changed, from, to, filter)).toStrictEqual(findPath(sc, from, to, filter));
        const before = propagate(sc, def, sel, maxSteps);
        expect(propagate(changed, def, sel, maxSteps)).toStrictEqual(before);
        expect(sumAttribute(changed, sel, attr)).toStrictEqual(sumAttribute(sc, sel, attr));
        expect(checkSeriesList(changed, settings, marks)).toStrictEqual(checkSeriesList(sc, settings, marks));
        expect(buildEffects(changed, def, results)).toStrictEqual(buildEffects(sc, def, results));
        expect(timelineFromZones(changed)).toStrictEqual(timelineFromZones(sc));
      }),
      { numRuns: 100 },
    );
  });
});
