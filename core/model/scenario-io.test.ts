import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { extraFieldsArb, jsonEqual, scenarioArb } from "./arbitraries.ts";
import { compareCodePoints } from "./json.ts";
import { loadScenario, NOT_JSON_MESSAGE, NOT_OBJECT_MESSAGE, saveScenario } from "./scenario-io.ts";
import { validateScenario, type Scenario } from "./scenario-schema.ts";

const RUNS = { numRuns: 100 };

function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

/** Deep copy through JSON text, keeping an own `__proto__` key as an ordinary key. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function saveOk(s: Scenario): string {
  const r = saveScenario(s);
  if (!r.ok) throw new Error(`save failed: ${JSON.stringify(r.errors)}`);
  return r.text;
}

function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).reverse()) {
      setOwn(out, key, reorderKeys((value as Record<string, unknown>)[key]));
    }
    return out;
  }
  return value;
}

const isIndexLike = (k: string): boolean => /^(0|[1-9]\d*)$/.test(k) && Number(k) < 2 ** 32 - 1;

function keysInCodePointOrder(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(keysInCodePointOrder);
  if (typeof value === "object" && value !== null) {
    // Integer-like keys are reordered by JavaScript itself, so only the other keys are compared.
    const keys = Object.keys(value).filter((k) => !isIndexLike(k));
    for (let i = 1; i < keys.length; i++) {
      if (compareCodePoints(keys[i - 1], keys[i]) >= 0) return false;
    }
    return Object.values(value).every(keysInCodePointOrder);
  }
  return true;
}

// Feature: core-graph, Property 1: P-GRAPH-1 save → load leaves the content unchanged
// **Validates: Requirements 1.5, 2.6, 2.9, 3.5, 3.8, 3.9, 4.3, 4.8, 5.6, 5.7, 6.1, 8.5, 8.6**
test("P-GRAPH-1 save then load leaves the content unchanged", () => {
  fc.assert(
    fc.property(scenarioArb, (s) => {
      const before = copy(s);
      const protoKeys = Object.getOwnPropertyNames(Object.prototype);
      const saved = saveScenario(s);
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;
      const loaded = loadScenario(saved.text);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(jsonEqual(loaded.scenario, s)).toBe(true);
      expect(jsonEqual(s, before)).toBe(true);
      expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(protoKeys);
    }),
    RUNS,
  );
});

// Feature: core-graph, Property 2: P-GRAPH-2 saved text stays valid and stable
// **Validates: Requirements 8.1, 8.7, 8.8, 9.3**
test("P-GRAPH-2 saved text stays valid and stable", () => {
  fc.assert(
    fc.property(scenarioArb, (s) => {
      const text = saveOk(s);
      const loaded = loadScenario(text);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      for (const line of text.split("\n")) {
        expect((/^ */.exec(line) as RegExpExecArray)[0].length % 2).toBe(0);
      }
      expect(keysInCodePointOrder(JSON.parse(text))).toBe(true);
      expect(saveOk(loaded.scenario)).toBe(text);
    }),
    RUNS,
  );
});

// Feature: core-graph, Property 3: P-GRAPH-3 every reference points to an existing element
// **Validates: Requirements 6.4, 6.5, 6.9, 6.12**
test("P-GRAPH-3 every reference points to an existing element", () => {
  fc.assert(
    fc.property(scenarioArb, fc.nat(), (s, pick) => {
      const loaded = loadScenario(saveOk(s));
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      const nodeIds = new Set(loaded.scenario.nodes.map((n) => n.id));
      const zoneIds = new Set(loaded.scenario.zones.map((z) => z.id));
      for (const e of loaded.scenario.edges) {
        expect(nodeIds.has(e.from) && nodeIds.has(e.to)).toBe(true);
      }
      for (const n of loaded.scenario.nodes) {
        if (n.zone !== undefined) expect(zoneIds.has(n.zone)).toBe(true);
      }
      const targets: { path: string; apply: (c: Scenario) => void }[] = [];
      s.edges.forEach((_, i) => {
        targets.push({ path: `edges.${i}.from`, apply: (c) => void (c.edges[i].from = "\u0000missing") });
        targets.push({ path: `edges.${i}.to`, apply: (c) => void (c.edges[i].to = "\u0000missing") });
      });
      s.nodes.forEach((n, i) => {
        if (n.zone !== undefined) {
          targets.push({ path: `nodes.${i}.zone`, apply: (c) => void (c.nodes[i].zone = "\u0000missing") });
        }
      });
      fc.pre(targets.length > 0);
      const target = targets[pick % targets.length];
      const changed = copy(s);
      target.apply(changed);
      const result = loadScenario(JSON.stringify(changed));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.some((e) => e.path === target.path)).toBe(true);
    }),
    RUNS,
  );
});

// Feature: core-graph, Property 4: P-GRAPH-4 same input → same result
// **Validates: Requirements 7.4, 7.8, 8.4, 10.6**
test("P-GRAPH-4 same input gives the same result", () => {
  const text = fc.oneof(
    scenarioArb.map(saveOk),
    scenarioArb.map((s) => saveOk(s).slice(0, 40)),
    scenarioArb.map((s) => saveOk(s).replace(/"nodes"/, '"nodez"')),
    fc.string(),
  );
  fc.assert(
    fc.property(text, (t) => {
      expect(loadScenario(t)).toStrictEqual(loadScenario(t));
    }),
    RUNS,
  );
  fc.assert(
    fc.property(scenarioArb, (s) => {
      expect(saveOk(reorderKeys(s) as Scenario)).toBe(saveOk(s));
    }),
    RUNS,
  );
});

type Root = Record<string, unknown>;
type Mutation = { path: string; apply: (c: Root) => void };

/** The container at `path` inside `root` (objects and arrays are both indexed as records). */
function at(root: unknown, ...path: (string | number)[]): Root {
  let cur = root;
  for (const p of path) cur = (cur as Root)[p];
  return cur as Root;
}

function mutationsOf(s: Scenario): Mutation[] {
  const out: Mutation[] = [];
  const wrongs: unknown[] = ["x", true, null, [1]];
  const lists: [string, readonly unknown[], string[]][] = [
    ["nodes", s.nodes, ["id", "type", "position", "rotation", "scale", "front", "metadata", "attributes"]],
    ["edges", s.edges, ["id", "from", "to", "type"]],
    ["zones", s.zones, ["id", "label", "order", "elevation", "enclosed"]],
  ];
  for (const [list, items, required] of lists) {
    items.forEach((_, i) => {
      for (const f of required) out.push({ path: `${list}.${i}.${f}`, apply: (c) => void delete at(c, list, i)[f] });
    });
    for (let j = 1; j < items.length; j++) {
      out.push({ path: `${list}.${j}.id`, apply: (c) => void (at(c, list, j).id = at(c, list, 0).id) });
    }
  }
  for (let j = 1; j < s.zones.length; j++) {
    out.push({ path: `zones.${j}.order`, apply: (c) => void (at(c, "zones", j).order = at(c, "zones", 0).order) });
  }
  s.nodes.forEach((n, i) => {
    for (const f of ["position", "rotation", "scale"]) {
      for (const k of ["x", "y", "z"]) {
        wrongs.forEach((w) => out.push({ path: `nodes.${i}.${f}.${k}`, apply: (c) => void (at(c, "nodes", i, f)[k] = w) }));
      }
    }
    for (const k of ["x", "y", "z"]) {
      for (const bad of [0, -1]) {
        out.push({ path: `nodes.${i}.scale.${k}`, apply: (c) => void (at(c, "nodes", i, "scale")[k] = bad) });
      }
    }
    for (const name of Object.keys(n.attributes)) {
      for (const bad of ["1", ...wrongs]) {
        out.push({
          path: `nodes.${i}.attributes.${name}`,
          apply: (c) => setOwn(at(c, "nodes", i, "attributes"), name, bad),
        });
      }
    }
    const faces = n.back === undefined ? ["front"] : ["front", "back"];
    for (const f of faces) {
      out.push({
        path: `nodes.${i}.${f}`,
        apply: (c) => {
          delete at(c, "nodes", i, f).text;
          delete at(c, "nodes", i, f).image;
        },
      });
    }
  });
  s.zones.forEach((_, i) => {
    for (const f of ["order", "elevation"]) {
      wrongs.forEach((w) => out.push({ path: `zones.${i}.${f}`, apply: (c) => void (at(c, "zones", i)[f] = w) }));
    }
  });
  return out;
}
// Feature: core-graph, Property 5: P-GRAPH-5 broken scenarios fail with a Field_Path
// **Validates: Requirements 1.2, 1.3, 1.6, 2.4, 3.4, 4.6, 5.5, 6.3, 6.10, 10.4**
test("P-GRAPH-5 broken scenarios fail with a Field_Path", () => {
  fc.assert(
    fc.property(scenarioArb, fc.nat(), (s, pick) => {
      const mutations = mutationsOf(s);
      fc.pre(mutations.length > 0);
      const m = mutations[pick % mutations.length];
      const changed = copy(s) as unknown as Root;
      m.apply(changed);
      const result = loadScenario(JSON.stringify(changed));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.map((e) => e.path)).toContain(m.path);
    }),
    RUNS,
  );
});

function withExtras(s: Scenario, extra: Record<string, unknown>): Record<string, unknown> {
  const x = <T extends object>(o: T): T => ({ ...o, ...extra });
  const text = (t: { en: string; ja?: string } | undefined) => (t === undefined ? undefined : x(t));
  const face = (f: Scenario["nodes"][number]["front"] | undefined) =>
    f === undefined ? undefined : x({ ...f, text: text(f.text), detail: text(f.detail) });
  return x({
    ...s,
    title: x(s.title),
    nodes: s.nodes.map((n) =>
      x({ ...n, position: x(n.position), rotation: x(n.rotation), scale: x(n.scale), front: face(n.front), back: face(n.back) }),
    ),
    edges: s.edges.map((e) => x({ ...e, label: text(e.label) })),
    zones: s.zones.map((z) => x({ ...z, label: x(z.label) })),
  });
}

// Feature: core-graph, Property 6: P-GRAPH-6 unknown fields are ignored
// **Validates: Requirements 6.2, 7.1, 8.10**
test("P-GRAPH-6 unknown fields are ignored", () => {
  fc.assert(
    fc.property(scenarioArb, extraFieldsArb, (s, extra) => {
      const s2 = withExtras(s, extra);
      const loaded = loadScenario(JSON.stringify(s2));
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(jsonEqual(loaded.scenario, s)).toBe(true);
      expect(saveOk(s2 as unknown as Scenario)).toBe(saveOk(s));
    }),
    RUNS,
  );
});

// Feature: core-graph, Property 7: P-GRAPH-7 the loader never throws
// **Validates: Requirements 7.2, 7.5, 7.6**
test("P-GRAPH-7 the loader never throws", () => {
  const mutated = fc
    .tuple(scenarioArb, fc.nat(), fc.nat(), fc.string({ maxLength: 2 }))
    .map(([s, a, b, ins]) => {
      const t = saveOk(s);
      const at = a % (t.length + 1);
      return b % 2 === 0 ? t.slice(0, at) : t.slice(0, at) + ins + t.slice(at + 1);
    });
  const text = fc.oneof(fc.string(), fc.string({ unit: "binary" }), fc.json(), mutated);
  fc.assert(
    fc.property(text, (t) => {
      const r = loadScenario(t);
      if (r.ok) {
        expect("errors" in r).toBe(false);
        return;
      }
      expect(r.errors.length).toBeGreaterThan(0);
      expect("scenario" in r).toBe(false);
      let parseable = true;
      try {
        JSON.parse(t.startsWith("\uFEFF") ? t.slice(1) : t);
      } catch {
        parseable = false;
      }
      if (!parseable) expect(r.errors).toEqual([{ path: "", message: NOT_JSON_MESSAGE }]);
    }),
    RUNS,
  );
});

describe("scenario io examples", () => {
  const minimal = { schemaVersion: 1, id: "s", title: { en: "S" }, nodes: [], edges: [], zones: [] };
  const oneNode = {
    ...minimal,
    nodes: [
      {
        id: "a",
        type: "card",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        front: { text: { en: "T" } },
        metadata: {},
        attributes: {},
      },
    ],
  };

  it("7.2 gives the fixed message and echoes no input", () => {
    for (const t of ["", "   ", "{", "{ secret-word"]) {
      const r = loadScenario(t);
      expect(r).toEqual({ ok: false, errors: [{ path: "", message: NOT_JSON_MESSAGE }] });
    }
    expect(NOT_JSON_MESSAGE).not.toContain("secret-word");
  });

  it("7.3 rejects every non-object top level", () => {
    for (const t of ["[]", '"x"', "1", "true", "null"]) {
      expect(loadScenario(t)).toEqual({ ok: false, errors: [{ path: "", message: NOT_OBJECT_MESSAGE }] });
    }
  });

  it("7.9 ignores one leading BOM", () => {
    expect(loadScenario(`\uFEFF${JSON.stringify(minimal)}`).ok).toBe(true);
  });

  it("7.10 the last of a repeated key wins", () => {
    const r = loadScenario('{"schemaVersion":1,"id":"a","id":"b","title":{"en":"S"},"nodes":[],"edges":[],"zones":[]}');
    expect(r.ok && r.scenario.id).toBe("b");
  });

  it("8.2 and 8.3 non-finite numbers fail the same way as validation", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const s = structuredClone(oneNode);
      s.nodes[0].position.x = bad;
      const saved = saveScenario(s);
      const checked = validateScenario(s);
      expect(saved.ok).toBe(false);
      expect(checked.ok).toBe(false);
      if (saved.ok || checked.ok) return;
      expect(saved.errors).toEqual(checked.errors);
      expect(saved.errors.map((e) => e.path)).toContain("nodes.0.position.x");
    }
  });

  it("8.9 an undefined optional field writes no key", () => {
    const s = { ...oneNode, nodes: [{ ...oneNode.nodes[0], back: undefined }] };
    const saved = saveScenario(s);
    expect(saved.ok && saved.text.includes('"back"')).toBe(false);
  });

  it("schemaVersion 7 is saved as 7", () => {
    const saved = saveScenario({ ...minimal, schemaVersion: 7 });
    expect(saved.ok && saved.text).toContain('"schemaVersion": 7');
  });

  it("10.7 failure paths leave the argument unchanged", () => {
    const s = structuredClone(oneNode);
    s.nodes[0].position.x = NaN;
    const before = structuredClone(s);
    saveScenario(s);
    expect(s).toEqual(before);
  });
});
