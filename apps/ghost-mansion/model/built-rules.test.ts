import { describe, expect, it } from "vitest";
import type { RuleDefinition } from "../../../core/model/rule-schema.ts";
import { loadRuleDefinition } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { attackCheckSet, responseCheckSet, withCheckSet } from "./built-rules.ts";

const rules: RuleDefinition = {
  schemaVersion: 1,
  id: "game-rules",
  propagation: { pass: ["plain-key"], stop: ["bell-key"] },
};

/** Only `edges` is read by `responseCheckSet`. */
function scenarioWithKeys(n: number): Scenario {
  const edges = Array.from({ length: n }, (_, i) => ({
    id: `k${i}`,
    from: "robot",
    to: `r${i}`,
    type: i % 2 === 0 ? "plain-key" : "bell-key",
  }));
  edges.push({ id: "other", from: "robot", to: "x", type: "reads" });
  return { edges } as unknown as Scenario;
}

describe("responseCheckSet", () => {
  it("uses an empty any for N = 0 (never holds)", () => {
    const set = responseCheckSet(scenarioWithKeys(0));
    expect(set.id).toBe("response");
    expect(set.items.map((i) => i.id)).toEqual(["stop-robot", "cut-key", "consult"]);
    expect(set.items[1]?.condition).toEqual({ kind: "any", conditions: [] });
  });

  it("uses max N - 1 over Key_Edges for N = 4", () => {
    const set = responseCheckSet(scenarioWithKeys(4));
    expect(set.items[1]?.condition).toMatchObject({ kind: "edgeCount", max: 3 });
  });

  it("loads with loadRuleDefinition for N = 0 and N = 4", () => {
    for (const n of [0, 4]) {
      const outcome = withCheckSet(rules, responseCheckSet(scenarioWithKeys(n)));
      expect(outcome.ok).toBe(true);
    }
  });
});

describe("attackCheckSet", () => {
  it("keeps Precondition ids and order and drops label and highlight", () => {
    const card = {
      preconditions: [
        { id: "p1", label: { en: "a", ja: "あ" }, highlight: [], check: { kind: "all" as const, conditions: [] } },
        { id: "p2", label: { en: "b", ja: "い" }, highlight: [], check: { kind: "any" as const, conditions: [] } },
        { id: "p3", label: { en: "c", ja: "う" }, highlight: [], check: { kind: "all" as const, conditions: [] } },
      ],
    };
    const set = attackCheckSet(card);
    expect(set).toEqual({
      id: "attack",
      items: [
        { id: "p1", condition: { kind: "all", conditions: [] } },
        { id: "p2", condition: { kind: "any", conditions: [] } },
        { id: "p3", condition: { kind: "all", conditions: [] } },
      ],
    });
    expect(withCheckSet(rules, set).ok).toBe(true);
  });
});

describe("withCheckSet", () => {
  it("returns a Rule_Failure for an invalid set and does not write to its input", () => {
    const before = JSON.stringify(rules);
    const outcome = withCheckSet(rules, { id: " ", items: [] });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(rules)).toBe(before);
  });

  it("appends to existing check sets and matches loadRuleDefinition", () => {
    const set = responseCheckSet(scenarioWithKeys(2));
    const outcome = withCheckSet(rules, set);
    expect(outcome).toEqual(loadRuleDefinition({ ...rules, checkSets: [set] }));
  });
});
