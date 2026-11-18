import { describe, expect, it } from "vitest";
import {
  addConditionUnresolved,
  buildIndex,
  matchSelector,
  selectNodes,
  sortedIds,
  sumOver,
} from "./graph-index.ts";
import type { Condition } from "./rule-schema.ts";
import type { Node, Scenario } from "./scenario-schema.ts";

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

function scenarioOf(nodes: Node[]): Scenario {
  return {
    schemaVersion: 1,
    id: "s1",
    title: { en: "t" },
    nodes,
    edges: [],
    zones: [{ id: "level1", label: { en: "level" }, order: 0, elevation: 0, enclosed: false }],
  };
}

describe("addConditionUnresolved", () => {
  it("reports a missing id in the second branch of an any whose first branch holds (3.5)", () => {
    const g = buildIndex(scenarioOf([item("t1"), item("t2")]));
    const condition: Condition = {
      kind: "any",
      conditions: [
        { kind: "attribute", nodes: { ids: ["t1"] }, attribute: "a", min: 0 },
        { kind: "attribute", nodes: { ids: ["missing"] }, attribute: "a", min: 0 },
      ],
    };
    const into = new Set<string>();
    addConditionUnresolved(g, condition, into);
    expect([...into]).toEqual(["missing"]);
  });
});

describe("sortedIds", () => {
  it("keeps 'a', 'A' and ' a' distinct and sorts by code point (3.6)", () => {
    expect(sortedIds(["a", "A", " a", "a"])).toEqual([" a", "A", "a"]);
  });
});

describe("selectors", () => {
  it("picks nothing for empty lists and gives no failure (3.8)", () => {
    const sc = scenarioOf([item("t1", { zone: "level1" }), item("t2")]);
    for (const selector of [{ ids: [] }, { types: [] }, { zones: [] }]) {
      const result = selectNodes(sc, selector);
      expect(result).toEqual({ ok: true, value: { nodes: [], unresolved: [] } });
    }
  });

  it("never picks a Node without zone through zones", () => {
    const sc = scenarioOf([item("t1", { zone: "level1" }), item("t2")]);
    const g = buildIndex(sc);
    expect(matchSelector(g, { zones: ["level1"] })).toEqual([true, false]);
    const result = selectNodes(sc, { zones: ["level1"] });
    expect(result).toEqual({ ok: true, value: { nodes: ["t1"], unresolved: [] } });
  });
});

describe("sumOver", () => {
  it("reads an own __proto__ attribute", () => {
    const attributes = JSON.parse('{"__proto__": 5}') as Record<string, number>;
    const g = buildIndex(scenarioOf([item("t1", { attributes }), item("t2")]));
    expect(sumOver(g, [true, true], "__proto__")).toEqual({ sum: 5, count: 1 });
  });

  it("does not read an inherited attribute", () => {
    const g = buildIndex(scenarioOf([item("t1")]));
    expect(sumOver(g, [true], "toString")).toEqual({ sum: 0, count: 0 });
  });
});
