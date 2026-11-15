import { describe, expect, it } from "vitest";
import { validateScenario } from "./scenario-schema.ts";

const v3 = { x: 0, y: 0, z: 0 };
const one = { x: 1, y: 1, z: 1 };

function node(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    type: "card",
    position: v3,
    rotation: v3,
    scale: one,
    front: { text: { en: "T" } },
    metadata: {},
    attributes: {},
    ...extra,
  };
}

function scenario(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: "s",
    title: { en: "S" },
    nodes: [],
    edges: [],
    zones: [],
    ...extra,
  };
}

function paths(value: unknown): string[] {
  const r = validateScenario(value);
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("expected failure");
  return r.errors.map((e) => e.path);
}

function messages(value: unknown): string[] {
  const r = validateScenario(value);
  if (r.ok) throw new Error("expected failure");
  return r.errors.map((e) => e.message);
}

describe("scenario schema examples", () => {
  it("1.6 reports two broken Nodes", () => {
    const p = paths(scenario({ nodes: [node("a", { type: " " }), node("b", { type: "" })] }));
    expect(p).toContain("nodes.0.type");
    expect(p).toContain("nodes.1.type");
  });

  it("1.7 metadata must be an object of JSON values", () => {
    expect(paths(scenario({ nodes: [node("a", { metadata: [1] })] }))).toContain("nodes.0.metadata");
    expect(paths(scenario({ nodes: [node("a", { metadata: "x" })] }))).toContain("nodes.0.metadata");
  });

  it("1.9 a missing attributes field fails at attributes", () => {
    const n = node("a");
    delete n["attributes"];
    expect(paths(scenario({ nodes: [n] }))).toContain("nodes.0.attributes");
  });

  it("2.4 a string attribute value is not converted", () => {
    expect(paths(scenario({ nodes: [node("a", { attributes: { w: "1" } })] }))).toContain("nodes.0.attributes.w");
  });

  it("2.5 a blank attribute name is reported with its name quoted", () => {
    const r = validateScenario(scenario({ nodes: [node("a", { attributes: { " ": 1 } })] }));
    if (r.ok) throw new Error("expected failure");
    const e = r.errors.find((x) => x.path === "nodes.0.attributes");
    expect(e?.message).toContain(JSON.stringify(" "));
  });

  it("2.7 attributes that is not an object fails", () => {
    for (const bad of [[], null, "x", 3, true]) {
      expect(paths(scenario({ nodes: [node("a", { attributes: bad })] }))).toContain("nodes.0.attributes");
    }
  });

  it("2.8 every bad value gets its own error", () => {
    const p = paths(scenario({ nodes: [node("a", { attributes: { a: "x", b: null } })] }));
    expect(p).toContain("nodes.0.attributes.a");
    expect(p).toContain("nodes.0.attributes.b");
  });

  it("3.3 a Face needs text or image", () => {
    expect(paths(scenario({ nodes: [node("a", { front: {} })] }))).toContain("nodes.0.front");
    expect(paths(scenario({ nodes: [node("a", { front: { detail: { en: "d" } } })] }))).toContain("nodes.0.front");
  });

  it("3.6 a Face that is not an object fails with a type error only", () => {
    expect(paths(scenario({ nodes: [node("a", { front: null })] }))).toEqual(["nodes.0.front"]);
  });

  it("3.7 nested Face errors name the field", () => {
    const nodes = [
      node("a"),
      node("b"),
      node("c", {
        back: { text: { en: " " } },
        front: { text: { en: "T" }, detail: { en: "" }, image: " " },
      }),
    ];
    const p = paths(scenario({ nodes }));
    expect(p).toContain("nodes.2.back.text.en");
    expect(p).toContain("nodes.2.front.detail.en");
    expect(p).toContain("nodes.2.front.image");
  });

  it("a Face with only an invalid detail reports both errors", () => {
    const p = paths(scenario({ nodes: [node("a", { front: { detail: 5 } })] }));
    expect(p).toContain("nodes.0.front.detail");
    expect(p).toContain("nodes.0.front");
  });

  it("4.7 an Edge needs a type", () => {
    const edges = [{ id: "e", from: "a", to: "a" }];
    expect(paths(scenario({ nodes: [node("a")], edges }))).toContain("edges.0.type");
  });

  it("5.2 order must be a non-negative integer", () => {
    const zone = (order: unknown) => ({ id: "z", label: { en: "Z" }, order, elevation: 0, enclosed: false });
    expect(paths(scenario({ zones: [zone(1.5)] }))).toContain("zones.0.order");
    expect(paths(scenario({ zones: [zone(-1)] }))).toContain("zones.0.order");
  });

  it("5.3 and 5.5 enclosed must be a boolean", () => {
    const zone = (enclosed: unknown) => ({ id: "z", label: { en: "Z" }, order: 0, elevation: 0, enclosed });
    expect(paths(scenario({ zones: [zone("true")] }))).toContain("zones.0.enclosed");
    expect(paths(scenario({ zones: [zone(0)] }))).toContain("zones.0.enclosed");
  });

  it("6.1 schemaVersion", () => {
    expect(validateScenario(scenario({ schemaVersion: 1 })).ok).toBe(true);
    expect(validateScenario(scenario({ schemaVersion: 7 })).ok).toBe(true);
    for (const bad of [0, -1, 1.5, "1"]) {
      expect(paths(scenario({ schemaVersion: bad }))).toContain("schemaVersion");
    }
  });

  it("6.6 and 6.8 titles are Localized_Text", () => {
    expect(paths(scenario({ title: "plain" }))).toContain("title");
    expect(paths(scenario({ zones: [{ id: "z", label: { ja: "x" }, order: 0, elevation: 0, enclosed: false }] }))).toContain(
      "zones.0.label.en",
    );
  });

  it("6.7 a missing list fails at its name", () => {
    for (const key of ["nodes", "edges", "zones"]) {
      const s = scenario();
      delete s[key];
      expect(paths(s)).toContain(key);
    }
  });

  it("6.11 structural errors stop cross-element checks", () => {
    const edges = [{ id: "e", from: "x", to: "y", type: "link" }];
    expect(paths(scenario({ nodes: [node("a", { type: " " })], edges }))).toEqual(["nodes.0.type"]);
  });

  it("cross-element errors come in a fixed order", () => {
    const zones = [
      { id: "z", label: { en: "Z" }, order: 0, elevation: 0, enclosed: false },
      { id: "y", label: { en: "Y" }, order: 0, elevation: 0, enclosed: false },
    ];
    const nodes = [node("a", { zone: "nope" }), node("a")];
    const edges = [{ id: "e", from: "q", to: "a", type: "link" }];
    expect(paths(scenario({ nodes, edges, zones }))).toEqual([
      "nodes.1.id",
      "edges.0.from",
      "nodes.0.zone",
      "zones.1.order",
    ]);
    expect(messages(scenario({ nodes, edges, zones }))[0]).toContain("first used at nodes.0");
  });

  it("the same id in two different lists passes", () => {
    const zones = [{ id: "a", label: { en: "Z" }, order: 0, elevation: 0, enclosed: false }];
    expect(validateScenario(scenario({ nodes: [node("a")], zones })).ok).toBe(true);
  });

  it("self-loops and parallel Edges pass", () => {
    const edges = [
      { id: "e1", from: "a", to: "a", type: "link" },
      { id: "e2", from: "a", to: "a", type: "link" },
    ];
    expect(validateScenario(scenario({ nodes: [node("a")], edges })).ok).toBe(true);
  });
});
