import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import {
  deepNot,
  extraFieldsArb,
  jsonEqual,
  ruleDefinitionArb,
  ruleMutationArb,
  scenarioArb,
  selfContaining,
} from "./arbitraries.ts";
import {
  explanationTableSchema,
  loadRuleDefinition,
  type Condition,
} from "./rule-schema.ts";

const leaf: Condition = { kind: "attribute", nodes: {}, attribute: "v", min: 0 };

/** `n` nested `not` Conditions around a valid leaf: Condition_Depth n + 1. */
function notsAround(n: number): Condition {
  let c: Condition = leaf;
  for (let i = 0; i < n; i += 1) c = { kind: "not", condition: c };
  return c;
}

function base(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, id: "rules", propagation: { pass: [], stop: [] }, ...extra };
}

function withItemCondition(condition: unknown): Record<string, unknown> {
  return base({ checkSets: [{ id: "s", items: [{ id: "i", condition }] }] });
}

function withNodeRuleCondition(condition: unknown, nodes: unknown = {}): Record<string, unknown> {
  return base({ nodeRules: [{ id: "r", nodes, condition }] });
}

function errorsOf(value: unknown): { path: string; message: string }[] {
  const result = loadRuleDefinition(value);
  if (result.ok) throw new Error("expected a failure");
  return result.errors;
}

const exampleDefinition = {
  schemaVersion: 1,
  id: "sample-rules",
  propagation: { pass: ["open-link"], stop: ["checked-link"] },
  checkSets: [
    {
      id: "goal-a",
      items: [
        {
          id: "reads-outer",
          condition: {
            kind: "edgeCount",
            edges: { include: ["reads"] },
            from: { types: ["agent"] },
            to: { zones: ["outer"] },
            min: 1,
          },
        },
        {
          id: "has-open-link",
          condition: {
            kind: "edgeCount",
            edges: { include: ["open-link"] },
            from: { types: ["agent"] },
            to: {},
            min: 1,
          },
        },
        {
          id: "no-checked-path",
          condition: {
            kind: "not",
            condition: {
              kind: "reach",
              from: { types: ["agent"] },
              to: { types: ["card"] },
              edges: { include: ["checked-link"] },
            },
          },
        },
      ],
    },
  ],
  nodeRules: [
    {
      id: "unlinked-answer",
      nodes: { types: ["answer"] },
      condition: {
        kind: "not",
        condition: {
          kind: "edgeCount",
          edges: { include: ["cites"] },
          from: { self: true },
          to: { types: ["reference"] },
          min: 1,
        },
      },
    },
  ],
  effectRules: [
    { id: "mark-unlinked", effect: "fog", source: { kind: "nodeRule", id: "unlinked-answer" } },
    { id: "mark-shift", effect: "fog", source: { kind: "shifts", attribute: "level" } },
    { id: "mark-run", effect: "fog", source: { kind: "longRuns", attribute: "level" } },
    { id: "mark-spread", effect: "glow", source: { kind: "propagation" } },
  ],
};

describe("example rule definition", () => {
  it("loads unchanged", () => {
    const result = loadRuleDefinition(exampleDefinition);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toStrictEqual(exampleDefinition);
  });
});

describe("duplicate ids (1.4)", () => {
  it("reports each later entry in check sets", () => {
    const errors = errorsOf(
      base({ checkSets: [{ id: "a", items: [] }, { id: "b", items: [] }, { id: "a", items: [] }] }),
    );
    expect(errors.map((e) => e.path)).toStrictEqual(["checkSets.2.id"]);
  });

  it("reports duplicates among the items of one check set", () => {
    const item = { id: "i", condition: leaf };
    const errors = errorsOf(base({ checkSets: [{ id: "a", items: [item, item, item] }] }));
    expect(errors.map((e) => e.path)).toStrictEqual(["checkSets.0.items.1.id", "checkSets.0.items.2.id"]);
  });

  it("reports duplicates in node rules and effect rules", () => {
    const rule = { id: "r", nodes: {}, condition: leaf };
    const effect = { id: "e", effect: "fog", source: { kind: "propagation" } };
    const errors = errorsOf(base({ nodeRules: [rule, rule], effectRules: [effect, effect] }));
    expect(errors.map((e) => e.path)).toStrictEqual(["nodeRules.1.id", "effectRules.1.id"]);
  });

  it("accepts the same id across lists", () => {
    const result = loadRuleDefinition(
      base({
        checkSets: [{ id: "x", items: [{ id: "x", condition: leaf }] }],
        nodeRules: [{ id: "x", nodes: {}, condition: leaf }],
        effectRules: [{ id: "x", effect: "x", source: { kind: "nodeRule", id: "x" } }],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("unknown node rule reference (1.5)", () => {
  it("reports the source id of the effect rule", () => {
    const errors = errorsOf(
      base({ effectRules: [{ id: "e", effect: "fog", source: { kind: "nodeRule", id: "missing" } }] }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe("effectRules.0.source.id");
  });
});

describe("self (1.6)", () => {
  const selfEdge = (self: unknown): Condition =>
    ({ kind: "edgeCount", edges: {}, from: { self }, to: {}, min: 1 }) as Condition;

  it("rejects self: false in a node rule condition", () => {
    const errors = errorsOf(withNodeRuleCondition(selfEdge(false)));
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.every((e) => e.path.startsWith("nodeRules.0.condition.from.self"))).toBe(true);
  });

  it("rejects self: true in a check item", () => {
    const errors = errorsOf(withItemCondition(selfEdge(true)));
    expect(errors.map((e) => e.path)).toStrictEqual(["checkSets.0.items.0.condition.from.self"]);
  });

  it("rejects self: true in the candidate selector of a node rule", () => {
    const errors = errorsOf(withNodeRuleCondition(leaf, { self: true }));
    expect(errors.map((e) => e.path)).toStrictEqual(["nodeRules.0.nodes.self"]);
  });

  it("accepts self: true inside a node rule condition", () => {
    expect(loadRuleDefinition(withNodeRuleCondition(selfEdge(true))).ok).toBe(true);
  });
});

describe("condition depth and size (1.7)", () => {
  const itemPath = "checkSets.0.items.0.condition";

  it("accepts depth 32", () => {
    expect(loadRuleDefinition(withItemCondition(notsAround(31))).ok).toBe(true);
  });

  it("rejects depth 33 with one error at the outermost condition", () => {
    const errors = errorsOf(withItemCondition(notsAround(32)));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe(itemPath);
  });

  it("applies the same limits to node rule conditions", () => {
    const errors = errorsOf(withNodeRuleCondition(notsAround(32)));
    expect(errors.map((e) => e.path)).toStrictEqual(["nodeRules.0.condition"]);
  });

  it("counts an empty all as one level", () => {
    expect(loadRuleDefinition(withItemCondition(deepNot(30))).ok).toBe(true);
    expect(errorsOf(withItemCondition(deepNot(31)))).toHaveLength(1);
  });

  it("rejects a 10,000-deep chain with one error and no stack overflow", () => {
    const errors = errorsOf(withItemCondition(deepNot(10_000)));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe(itemPath);
  });

  it("rejects a condition that contains itself", () => {
    const errors = errorsOf(withItemCondition(selfContaining()));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe(itemPath);
  });

  it("rejects a condition that lists itself twice", () => {
    const conditions: Condition[] = [];
    const c: Condition = { kind: "any", conditions };
    conditions.push(c, c);
    expect(errorsOf(withItemCondition(c))).toHaveLength(1);
  });

  it("rejects 20 nested levels that list the same child twice", () => {
    let c: Condition = leaf;
    for (let i = 0; i < 20; i += 1) c = { kind: "all", conditions: [c, c] };
    const errors = errorsOf(withItemCondition(c));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe(itemPath);
  });

  it("accepts exactly 10,000 occurrences and rejects 10,001", () => {
    const withChildren = (n: number): Condition => ({
      kind: "all",
      conditions: Array.from({ length: n }, () => leaf),
    });
    expect(loadRuleDefinition(withItemCondition(withChildren(9_999))).ok).toBe(true);
    const errors = errorsOf(withItemCondition(withChildren(10_000)));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe(itemPath);
  });

  it("does not write to its input", () => {
    const input = withItemCondition(notsAround(40));
    const before = JSON.stringify(input);
    loadRuleDefinition(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("lists depth errors before schema errors", () => {
    const input = base({
      checkSets: [
        { id: "a", items: [{ id: "i", condition: notsAround(40) }] },
        { id: "a", items: [] },
      ],
    });
    const errors = errorsOf(input);
    expect(errors.map((e) => e.path)).toStrictEqual([itemPath, "checkSets.1.id"]);
  });
});

describe("propagation policy (2.1, 2.2)", () => {
  it("accepts duplicates in pass and empty lists", () => {
    expect(loadRuleDefinition(base({ propagation: { pass: ["a", "a"], stop: [] } })).ok).toBe(true);
    expect(loadRuleDefinition(base()).ok).toBe(true);
  });

  it("reports a type in both lists at propagation.stop.<index>", () => {
    const errors = errorsOf(base({ propagation: { pass: ["a"], stop: ["b", "a"] } }));
    expect(errors.map((e) => e.path)).toStrictEqual(["propagation.stop.1"]);
  });
});

describe("condition kind and ranges (4.1, 4.8)", () => {
  it("reports an unknown kind at its own path", () => {
    const errors = errorsOf(withItemCondition({ kind: "bogus" }));
    expect(errors.map((e) => e.path)).toStrictEqual(["checkSets.0.items.0.condition.kind"]);
  });

  const edgeCount = (range: Record<string, number>): Condition =>
    ({ kind: "edgeCount", edges: {}, from: {}, to: {}, ...range });

  it("rejects a condition with no bound", () => {
    expect(errorsOf(withItemCondition(edgeCount({})))).toHaveLength(1);
    expect(errorsOf(withItemCondition({ kind: "attribute", nodes: {}, attribute: "v" }))).toHaveLength(1);
  });

  it("rejects min greater than max", () => {
    expect(errorsOf(withItemCondition(edgeCount({ min: 3, max: 2 })))).toHaveLength(1);
  });

  it("accepts min equal to max", () => {
    expect(loadRuleDefinition(withItemCondition(edgeCount({ min: 2, max: 2 }))).ok).toBe(true);
  });
});

describe("explanation table", () => {
  it("reports an entry with a blank key at the key", () => {
    const parsed = explanationTableSchema.safeParse({ "": { en: "a", ja: "b" } });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.map((i) => i.path)).toStrictEqual([[""]]);
  });
});

// Feature: core-rules, P-RULES-14: rule definitions are checked without throwing
describe("P-RULES-14 rule definitions are checked without throwing", () => {
  const RUNS = { numRuns: 100 };
  const definitionArb = scenarioArb.chain((s) => ruleDefinitionArb(s));

  /** Adds the given extra fields to every plain object of `value` (every object level of a Rule_Definition). */
  function withExtras(value: unknown, extra: Record<string, unknown>): unknown {
    if (Array.isArray(value)) return value.map((v) => withExtras(v, extra));
    if (typeof value !== "object" || value === null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = withExtras(v, extra);
    for (const [k, v] of Object.entries(extra)) {
      Object.defineProperty(out, k, { value: structuredClone(v), enumerable: true, writable: true, configurable: true });
    }
    return out;
  }

  test("P-RULES-14 never throws; result is ok with a value or failed with errors and no value", () => {
    fc.assert(
      fc.property(fc.oneof(fc.jsonValue(), fc.anything()), (v) => {
        const r = loadRuleDefinition(v);
        if (r.ok) {
          expect("value" in r).toBe(true);
        } else {
          expect(r.errors.length).toBeGreaterThan(0);
          expect("value" in r).toBe(false);
        }
      }),
      RUNS,
    );
  });

  test("P-RULES-14 a mutated required field is reported at its path", () => {
    fc.assert(
      fc.property(definitionArb.chain((def) => fc.tuple(fc.constant(def), ruleMutationArb(def))), ([def, m]) => {
        expect(loadRuleDefinition(def).ok).toBe(true);
        const r = loadRuleDefinition(m.value);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.errors.map((e) => e.path)).toContain(m.path);
      }),
      RUNS,
    );
  });

  test("P-RULES-14 extra fields at every object level are ignored", () => {
    fc.assert(
      fc.property(definitionArb, extraFieldsArb, (def, extra) => {
        const r = loadRuleDefinition(withExtras(def, extra));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(jsonEqual(r.value, def)).toBe(true);
      }),
      RUNS,
    );
  });

  test("P-RULES-14 equal content gives toStrictEqual results", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(loadRuleDefinition(v)).toStrictEqual(loadRuleDefinition(structuredClone(v)));
      }),
      RUNS,
    );
    fc.assert(
      fc.property(definitionArb.chain((def) => ruleMutationArb(def)), (m) => {
        expect(loadRuleDefinition(m.value)).toStrictEqual(loadRuleDefinition(structuredClone(m.value)));
      }),
      RUNS,
    );
  });
});