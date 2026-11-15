import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { scenarioArb } from "../../core/model/arbitraries.ts";
import { loadScenario, saveScenario } from "../../core/model/scenario-io.ts";
import { checkScenarioText } from "./schema.ts";

const nonBlankString = fc.string().filter((s) => s.trim().length >= 1);

const validScenario = fc.record(
  {
    schemaVersion: fc.integer({ min: 1 }),
    id: nonBlankString,
    title: fc.record({ en: nonBlankString, ja: fc.string() }, { requiredKeys: ["en"] }),
    nodes: fc.constant([]),
    edges: fc.constant([]),
    zones: fc.constant([]),
  },
  { requiredKeys: ["schemaVersion", "id", "title", "nodes", "edges", "zones"] },
);

const extraFields = fc.dictionary(
  fc.string().filter((k) => !["schemaVersion", "id", "title", "nodes", "edges", "zones", "__proto__"].includes(k)),
  fc.jsonValue(),
  { minKeys: 1 },
);

type Scenario = { schemaVersion: number; id: string; title: { en: string; ja?: string } };
type FieldPath = "schemaVersion" | "id" | "title" | "title.en";
const REMOVE = Symbol("remove");

function applyChange(s: Scenario, p: FieldPath, change: unknown): unknown {
  const copy: Record<string, unknown> = { ...s, title: { ...s.title } };
  const title = copy["title"] as Record<string, unknown>;
  if (p === "title.en") {
    if (change === REMOVE) delete title["en"];
    else title["en"] = change;
  } else if (change === REMOVE) {
    delete copy[p];
  } else {
    copy[p] = change;
  }
  return copy;
}

function wrongTypeFor(p: FieldPath): fc.Arbitrary<unknown> {
  const common = fc.oneof(fc.boolean(), fc.constant(null), fc.array(fc.integer()));
  return p === "schemaVersion" ? fc.oneof(common, fc.string()) : fc.oneof(common, fc.integer());
}

const brokenCase = fc
  .constantFrom<FieldPath>("schemaVersion", "id", "title", "title.en")
  .chain((p) =>
    fc.tuple(
      validScenario,
      fc.constant(p),
      fc.oneof(fc.constant<unknown>(REMOVE), wrongTypeFor(p)),
    ),
  );

describe("schema sensor properties", () => {
  // Feature: repo-foundation, Property 4: P-FND-4 valid scenarios pass
  // **Validates: Requirements 8.1, 8.8**
  test("P-FND-4 valid scenarios pass, with or without extra top-level fields", () => {
    fc.assert(
      fc.property(validScenario, extraFields, (s, x) => {
        expect(checkScenarioText(JSON.stringify(s))).toEqual({ ok: true });
        expect(checkScenarioText(JSON.stringify({ ...x, ...s }))).toEqual({ ok: true });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: repo-foundation, Property 5: P-FND-5 broken scenarios fail with the field path
  // **Validates: Requirements 8.7, 8.1**
  test("P-FND-5 broken scenarios fail and report the field path", () => {
    fc.assert(
      fc.property(brokenCase, ([s, p, change]) => {
        const result = checkScenarioText(JSON.stringify(applyChange(s, p, change)));
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error("expected schema failure");
        expect(result.errors.some((i) => i.path === p)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

describe("schema sensor examples", () => {
  const base = { schemaVersion: 1, id: "x", title: { en: "T" }, nodes: [], edges: [], zones: [] };

  function paths(value: unknown): string[] {
    const r = checkScenarioText(JSON.stringify(value));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected schema failure");
    return r.errors.map((i) => i.path);
  }

  test("whitespace-only id fails at id", () => {
    expect(paths({ ...base, id: "   " })).toContain("id");
  });
  test("whitespace-only title.en fails at title.en", () => {
    expect(paths({ ...base, title: { en: " \t" } })).toContain("title.en");
  });
  test("schemaVersion 0 fails at schemaVersion", () => {
    expect(paths({ ...base, schemaVersion: 0 })).toContain("schemaVersion");
  });
  test("schemaVersion 1.5 fails at schemaVersion", () => {
    expect(paths({ ...base, schemaVersion: 1.5 })).toContain("schemaVersion");
  });
  test("non-string ja fails at title.ja", () => {
    expect(paths({ ...base, title: { en: "T", ja: 3 } })).toContain("title.ja");
  });
  test.each(["nodes", "edges", "zones"])("missing %s list fails at %s", (key) => {
    const rest: Record<string, unknown> = { ...base };
    delete rest[key];
    expect(paths(rest)).toContain(key);
  });
  test("invalid JSON text gives one root error", () => {
    const r = checkScenarioText("{ not json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.path).toBe("");
    expect(r.errors[0]?.message).toContain("JSON could not be parsed");
  });
});

// Feature: core-graph, Property 2: P-GRAPH-2 saved text passes the sensor check
// **Validates: Requirements 8.7, 9.3**
test("P-GRAPH-2 sensor check and loader agree on saved and broken texts", () => {
  const texts = scenarioArb.chain((s) => {
    const saved = saveScenario(s);
    const text = saved.ok ? saved.text : "";
    return fc.constantFrom(
      text,
      text.slice(0, Math.floor(text.length / 2)),
      text.replace('"nodes"', '"nodez"'),
      text.replace('"zones": []', '"zones": 5'),
      text.replace(/"id": "/, '"id": " '),
    );
  });
  fc.assert(
    fc.property(texts, (t) => {
      const sensor = checkScenarioText(t);
      const loaded = loadScenario(t);
      expect(sensor.ok).toBe(loaded.ok);
      if (!sensor.ok && !loaded.ok) expect(sensor.errors).toEqual(loaded.errors);
    }),
    { numRuns: 100 },
  );
  fc.assert(
    fc.property(scenarioArb, (s) => {
      const saved = saveScenario(s);
      expect(saved.ok && checkScenarioText(saved.text).ok).toBe(true);
    }),
    { numRuns: 100 },
  );
});