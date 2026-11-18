import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createNoAiAdapter } from "./ai-adapter.ts";
import { evaluateCheckSets, evaluateCondition, evaluateNodeRules } from "./conditions.ts";
import { buildEffects } from "./effects.ts";
import { selectNodes } from "./graph-index.ts";
import { findPath, findReachable, propagate } from "./paths.ts";
import { loadRuleDefinition } from "./rule-schema.ts";
import { checkSeries, checkSeriesList, sumAttribute } from "./series.ts";
import {
  createCursor,
  createTimeline,
  cursorEffects,
  nextStep,
  previousStep,
  seekStep,
  timelineFromPropagation,
  timelineFromZones,
} from "./timeline.ts";

type Call = (args: never[]) => unknown;

/** Every public function of the design's "Public functions" table, with its argument count. */
const functions: ReadonlyArray<readonly [name: string, arity: number, call: Call]> = [
  ["loadRuleDefinition", 1, (a) => loadRuleDefinition(...(a as [never]))],
  ["selectNodes", 2, (a) => selectNodes(...(a as [never, never]))],
  ["evaluateCondition", 2, (a) => evaluateCondition(...(a as [never, never]))],
  ["evaluateCheckSets", 2, (a) => evaluateCheckSets(...(a as [never, never]))],
  ["evaluateNodeRules", 2, (a) => evaluateNodeRules(...(a as [never, never]))],
  ["findReachable", 3, (a) => findReachable(...(a as [never, never, never]))],
  ["findPath", 4, (a) => findPath(...(a as [never, never, never, never]))],
  ["propagate", 4, (a) => propagate(...(a as [never, never, never, never]))],
  ["sumAttribute", 3, (a) => sumAttribute(...(a as [never, never, never]))],
  ["checkSeries", 3, (a) => checkSeries(...(a as [never, never, never]))],
  ["checkSeriesList", 3, (a) => checkSeriesList(...(a as [never, never, never]))],
  ["buildEffects", 3, (a) => buildEffects(...(a as [never, never, never]))],
  ["createTimeline", 1, (a) => createTimeline(...(a as [never]))],
  ["timelineFromPropagation", 1, (a) => timelineFromPropagation(...(a as [never]))],
  ["timelineFromZones", 1, (a) => timelineFromZones(...(a as [never]))],
  ["createCursor", 1, (a) => createCursor(...(a as [never]))],
  ["nextStep", 1, (a) => nextStep(...(a as [never]))],
  ["previousStep", 1, (a) => previousStep(...(a as [never]))],
  ["seekStep", 2, (a) => seekStep(...(a as [never, never]))],
  ["cursorEffects", 1, (a) => cursorEffects(...(a as [never]))],
  ["createNoAiAdapter", 1, (a) => createNoAiAdapter(...(a as [never]))],
];

function checkOutcome(outcome: unknown): void {
  expect(typeof outcome).toBe("object");
  expect(outcome).not.toBeNull();
  const o = outcome as Record<string, unknown>;
  if (o.ok === true) {
    expect("value" in o).toBe(true);
  } else {
    expect(o.ok).toBe(false);
    expect(Array.isArray(o.errors)).toBe(true);
    expect((o.errors as unknown[]).length).toBeGreaterThan(0);
    expect("value" in o).toBe(false);
  }
}

describe("rule-input: engine functions never throw", () => {
  // Feature: core-rules, P-RULES-17: engine functions never throw
  // **Validates: Requirements 16.5**
  it("P-RULES-17 engine functions never throw", () => {
    for (const [name, arity, call] of functions) {
      fc.assert(
        fc.property(fc.array(fc.anything(), { minLength: arity, maxLength: arity }), (args) => {
          let outcome: unknown;
          try {
            outcome = call(args as never[]);
          } catch (e) {
            throw new Error(`${name} threw: ${String(e)}`, { cause: e });
          }
          checkOutcome(outcome);
        }),
        { numRuns: 100 },
      );
    }
  });
});

// ---- Task 11.4: example tests for argument handling (16.3, 16.4, 16.8, 16.9) ----

const o0 = { x: 0, y: 0, z: 0 };
const validScenario = {
  schemaVersion: 1,
  id: "s1",
  title: { en: "t" },
  nodes: ["n1", "n2"].map((id) => ({
    id,
    type: "item",
    position: o0,
    rotation: o0,
    scale: { x: 1, y: 1, z: 1 },
    front: { text: { en: id } },
    metadata: {},
    attributes: { level: 1 },
    zone: "z1",
  })),
  edges: [{ id: "e1", from: "n1", to: "n2", type: "link" }],
  zones: [{ id: "z1", label: { en: "zone" }, order: 0, elevation: 0, enclosed: false }],
};
const validRules = { schemaVersion: 1, id: "r1", propagation: { pass: ["link"], stop: [] } };
const validSettings = {
  attribute: "level",
  zoneValue: "mean",
  shiftThreshold: 30,
  direction: "up",
  runTolerance: 5,
  minRunLength: 3,
};
const validStep = { id: "t0", targets: [{ kind: "node", id: "n1" }], effects: [] };
const validTimeline = { steps: [validStep] };
const validCursor = { timeline: validTimeline, position: 0 };
const validPropagation = { reached: [{ node: "n1", step: 0 }], traversed: [], stopped: [], unresolved: [] };
const validCondition = { kind: "reach", from: { ids: ["n1"] }, to: { ids: ["n2"] }, edges: {} };

/** `names` are the argument names in parameter order; `valid` is a good value for each. */
const argCases: ReadonlyArray<{ name: string; call: Call; names: string[]; valid: unknown[]; bad: unknown[] }> = [
  { name: "selectNodes", call: functions[1][2], names: ["scenario", "selector"], valid: [validScenario, {}], bad: [5, 5] },
  {
    name: "evaluateCondition",
    call: functions[2][2],
    names: ["scenario", "condition"],
    valid: [validScenario, validCondition],
    bad: [5, 5],
  },
  {
    name: "evaluateCheckSets",
    call: functions[3][2],
    names: ["scenario", "rules"],
    valid: [validScenario, validRules],
    bad: [5, 5],
  },
  {
    name: "evaluateNodeRules",
    call: functions[4][2],
    names: ["scenario", "rules"],
    valid: [validScenario, validRules],
    bad: [5, 5],
  },
  {
    name: "findReachable",
    call: functions[5][2],
    names: ["scenario", "start", "edges"],
    valid: [validScenario, { ids: ["n1"] }, {}],
    bad: [5, 5, 5],
  },
  {
    name: "findPath",
    call: functions[6][2],
    names: ["scenario", "from", "to", "edges"],
    valid: [validScenario, "n1", "n2", {}],
    bad: [5, 5, 5, 5],
  },
  {
    name: "propagate",
    call: functions[7][2],
    names: ["scenario", "rules", "seeds", "maxSteps"],
    valid: [validScenario, validRules, { ids: ["n1"] }, 2],
    bad: [5, 5, 5, "x"],
  },
  {
    name: "sumAttribute",
    call: functions[8][2],
    names: ["scenario", "nodes", "attribute"],
    valid: [validScenario, {}, "level"],
    bad: [5, 5, 5],
  },
  {
    name: "checkSeries",
    call: functions[9][2],
    names: ["scenario", "settings", "marks"],
    valid: [validScenario, validSettings, []],
    bad: [5, 5, 5],
  },
  {
    name: "checkSeriesList",
    call: functions[10][2],
    names: ["scenario", "settings", "marks"],
    valid: [validScenario, [validSettings], []],
    bad: [5, 5, 5],
  },
  {
    name: "buildEffects",
    call: functions[11][2],
    names: ["scenario", "rules", "results"],
    valid: [validScenario, validRules, {}],
    bad: [5, 5, 5],
  },
  { name: "createTimeline", call: functions[12][2], names: ["steps"], valid: [[validStep]], bad: [5] },
  {
    name: "timelineFromPropagation",
    call: functions[13][2],
    names: ["propagation"],
    valid: [validPropagation],
    bad: [5],
  },
  { name: "timelineFromZones", call: functions[14][2], names: ["scenario"], valid: [validScenario], bad: [5] },
  { name: "createCursor", call: functions[15][2], names: ["timeline"], valid: [validTimeline], bad: [5] },
  { name: "nextStep", call: functions[16][2], names: ["cursor"], valid: [validCursor], bad: [5] },
  { name: "previousStep", call: functions[17][2], names: ["cursor"], valid: [validCursor], bad: [5] },
  {
    name: "seekStep",
    call: functions[18][2],
    names: ["cursor", "position"],
    valid: [validCursor, 0],
    bad: [5, "x"],
  },
  { name: "cursorEffects", call: functions[19][2], names: ["cursor"], valid: [validCursor], bad: [5] },
  { name: "createNoAiAdapter", call: functions[20][2], names: ["table"], valid: [{}], bad: [5] },
];

function argName(path: string): string {
  return path.split(".")[0] ?? "";
}

function failure(outcome: unknown): { path: string; message: string }[] {
  const o = outcome as { ok: boolean; errors?: { path: string; message: string }[] };
  expect(o.ok).toBe(false);
  expect(o).not.toHaveProperty("value");
  return o.errors ?? [];
}

describe("argument handling of every public function (16.3, 16.4, 16.8, 16.9)", () => {
  for (const c of argCases) {
    it(`${c.name}: prefixes, checks before any result, same call twice`, () => {
      const good = c.call(structuredClone(c.valid) as never[]);
      expect(good).toMatchObject({ ok: true });
      // The adapter holds a function, so its answers are compared in a separate test below.
      if (c.name !== "createNoAiAdapter") expect(c.call(structuredClone(c.valid) as never[])).toStrictEqual(good);

      // 16.8: one bad value in one argument gives errors only under that argument's name.
      c.names.forEach((name, i) => {
        const args = structuredClone(c.valid);
        args[i] = c.bad[i];
        const errors = failure(c.call(args as never[]));
        expect(errors.length).toBeGreaterThan(0);
        for (const e of errors) expect(argName(e.path)).toBe(name);
      });

      // 16.9 and 16.4: every argument is checked; errors follow the parameter order.
      const all = failure(c.call(structuredClone(c.bad) as never[]));
      const seen = all.map((e) => argName(e.path)).filter((n, i, list) => list.indexOf(n) === i);
      expect(seen).toStrictEqual(c.names);
      expect(c.call(structuredClone(c.bad) as never[])).toStrictEqual(c.call(structuredClone(c.bad) as never[]));
    });
  }

  it("loadRuleDefinition: errors are relative to the value, and the same call twice agrees", () => {
    const good = loadRuleDefinition(validRules);
    expect(good).toMatchObject({ ok: true });
    expect(loadRuleDefinition(validRules)).toStrictEqual(good);
    const bad = loadRuleDefinition({ ...validRules, id: "" });
    const errors = failure(bad);
    expect(errors.map((e) => e.path)).toContain("id");
    expect(loadRuleDefinition({ ...validRules, id: "" })).toStrictEqual(bad);
  });

  it("16.3: a bad Scenario gives every scenario. error and no result", () => {
    const sc = { ...structuredClone(validScenario), id: "", title: 5 };
    const errors = failure(selectNodes(sc as never, {}));
    expect(errors.length).toBeGreaterThanOrEqual(2);
    for (const e of errors) expect(e.path.startsWith("scenario.")).toBe(true);
  });

  it("16.4: scenario. errors come before rules. errors", () => {
    const sc = { ...structuredClone(validScenario), id: "" };
    const rules = { ...validRules, id: "" };
    const errors = failure(evaluateCheckSets(sc, rules));
    const paths = errors.map((e) => e.path);
    expect(paths).toContain("scenario.id");
    expect(paths).toContain("rules.id");
    expect(paths.indexOf("scenario.id")).toBeLessThan(paths.indexOf("rules.id"));
    const firstRules = paths.findIndex((p) => p.startsWith("rules."));
    expect(paths.slice(0, firstRules).every((p) => p.startsWith("scenario."))).toBe(true);
    expect(paths.slice(firstRules).every((p) => p.startsWith("rules."))).toBe(true);
  });
});

describe("createNoAiAdapter: same call twice", () => {
  it("gives adapters that answer alike", async () => {
    const table = { greet: { en: "hello", ja: "こんにちは" } };
    const a = createNoAiAdapter(structuredClone(table));
    const b = createNoAiAdapter(structuredClone(table));
    if (!a.ok || !b.ok) throw new Error("fixture table is invalid");
    expect(await b.value.explain({ topic: "greet" })).toStrictEqual(await a.value.explain({ topic: "greet" }));
  });
});