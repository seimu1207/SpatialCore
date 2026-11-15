import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { badLimitArb, commandArb, jsonEqual, limitArb, scenarioArb } from "./arbitraries.ts";
import { type EditCommand } from "./commands.ts";
import { createHistory, DEFAULT_HISTORY_LIMIT, executeCommand, redo, undo, type History } from "./history.ts";
import { validateScenario, type Scenario } from "./scenario-schema.ts";

const RUNS = { numRuns: 100 };

function start(s: Scenario, limit?: number): History {
  const r = createHistory(s, limit);
  if (!r.ok) throw new Error("history failed");
  return r.history;
}

const withCommands = (max: number) =>
  scenarioArb.chain((s) => fc.tuple(fc.constant(s), fc.array(commandArb(s), { maxLength: max })));

// Feature: core-graph, Property 8: P-GRAPH-8 edits keep the Scenario valid
// **Validates: Requirements 11.2, 11.12, 12.2**
test("P-GRAPH-8 edits keep the Scenario valid", () => {
  fc.assert(
    fc.property(withCommands(10), ([s, commands]) => {
      let h = start(s);
      for (const c of commands) {
        const r = executeCommand(h, c);
        h = r.history;
        expect(validateScenario(h.present).ok).toBe(true);
      }
    }),
    RUNS,
  );
});

// Feature: core-graph, Property 9: P-GRAPH-9 undo and redo restore states
// **Validates: Requirements 12.2, 12.4, 12.5**
test("P-GRAPH-9 undo and redo restore states", () => {
  let steps = 0;
  fc.assert(
    fc.property(withCommands(10), ([s, commands]) => {
      let h = start(s, 20);
      let accepted = 0;
      for (const c of commands) {
        const before = h;
        const r = executeCommand(h, c);
        if (!r.ok) continue;
        accepted++;
        steps++;
        h = r.history;
        expect(jsonEqual(undo(h).present, before.present)).toBe(true);
        expect(jsonEqual(redo(undo(h)), h)).toBe(true);
      }
      let back = h;
      for (let i = 0; i < accepted; i++) back = undo(back);
      expect(jsonEqual(back.present, s)).toBe(true);
    }),
    RUNS,
  );
  expect(steps).toBeGreaterThan(0);
});

// Feature: core-graph, Property 12: P-GRAPH-12 History never keeps more than `limit` steps
// **Validates: Requirements 12.1, 12.2, 12.10, 12.11**
test("P-GRAPH-12 History never keeps more than limit steps", () => {
  const input = fc
    .tuple(scenarioArb, limitArb)
    .chain(([s, limit]) => fc.tuple(fc.constant(s), fc.constant(limit), fc.array(commandArb(s), { maxLength: limit + 5 })));
  fc.assert(
    fc.property(input, ([s, limit, commands]) => {
      let h = start(s, limit);
      const presents: Scenario[] = [h.present];
      for (const c of commands) {
        const r = executeCommand(h, c);
        h = r.history;
        if (r.ok) presents.push(h.present);
        expect(h.past.length).toBeLessThanOrEqual(limit);
        expect(h.limit).toBe(limit);
        if (r.ok) expect(jsonEqual(h.past, presents.slice(0, -1).slice(-limit))).toBe(true);
      }
      for (let i = 0; i < limit + 2; i++) {
        h = undo(h);
        expect(h.past.length).toBeLessThanOrEqual(limit);
      }
      for (let i = 0; i < limit + 2; i++) {
        h = redo(h);
        expect(h.past.length).toBeLessThanOrEqual(limit);
        expect(h.limit).toBe(limit);
      }
    }),
    RUNS,
  );
  fc.assert(
    fc.property(scenarioArb, badLimitArb, (s, bad) => {
      const r = createHistory(s, bad as number);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors.map((e) => e.path)).toContain("limit");
      expect("history" in r).toBe(false);
    }),
    RUNS,
  );
  fc.assert(
    fc.property(scenarioArb, (s) => {
      expect(start(s).limit).toBe(100);
    }),
    RUNS,
  );
});

// ---- examples ----

const minimal = { schemaVersion: 1, id: "s", title: { en: "S" }, nodes: [], edges: [], zones: [] } as Scenario;
const addZone = (id: string, order: number): EditCommand => ({
  kind: "addZone",
  zone: { id, label: { en: id }, order, elevation: 0, enclosed: false },
});

describe("history examples", () => {
  it("12.1 the default limit is 100", () => {
    expect(DEFAULT_HISTORY_LIMIT).toBe(100);
    expect(start(minimal).limit).toBe(100);
    expect(start(minimal).past).toEqual([]);
  });

  it("12.6 and 12.7 undo and redo at the ends return the input", () => {
    const h = start(minimal);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("12.2 a new command clears the redo list", () => {
    let h = start(minimal);
    h = executeCommand(h, addZone("a", 0)).history;
    h = undo(h);
    expect(h.future).toHaveLength(1);
    h = executeCommand(h, addZone("b", 1)).history;
    expect(h.future).toEqual([]);
    expect(h.past).toHaveLength(1);
  });

  it("12.10 each bad limit fails at limit", () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, "3", null]) {
      const r = createHistory(minimal, bad as unknown as number);
      expect(r).toEqual({ ok: false, errors: [{ path: "limit", message: "limit must be a positive integer" }] });
    }
  });
});
