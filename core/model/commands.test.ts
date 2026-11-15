import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { commandArb, jsonEqual, scenarioArb, singleCommandArb } from "./arbitraries.ts";
import { applyCommand, type EditCommand, type SingleCommand } from "./commands.ts";
import { createHistory, executeCommand, type History } from "./history.ts";
import type { Scenario } from "./scenario-schema.ts";

const RUNS = { numRuns: 100 };

const withAnyCommand = scenarioArb.chain((s) => fc.tuple(fc.constant(s), fc.oneof(commandArb(s), fc.jsonValue())));

function history(s: Scenario): History {
  const r = createHistory(s);
  if (!r.ok) throw new Error("history failed");
  return r.history;
}

type Change = Record<string, unknown>;

function applyRef<T extends object>(item: T, changes: Change): T {
  const out = { ...item } as Record<string, unknown>;
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete out[k];
    else if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Reference model for one accepted single command. */
function reference(s: Scenario, c: SingleCommand): Scenario {
  switch (c.kind) {
    case "addNode":
      return { ...s, nodes: [...s.nodes, c.node] };
    case "addEdge":
      return { ...s, edges: [...s.edges, c.edge] };
    case "addZone":
      return { ...s, zones: [...s.zones, c.zone] };
    case "removeNode":
      return { ...s, nodes: s.nodes.filter((n) => n.id !== c.id), edges: s.edges.filter((e) => e.from !== c.id && e.to !== c.id) };
    case "removeEdge":
      return { ...s, edges: s.edges.filter((e) => e.id !== c.id) };
    case "removeZone":
      return { ...s, zones: s.zones.filter((z) => z.id !== c.id) };
    case "updateNode":
      return { ...s, nodes: s.nodes.map((n) => (n.id === c.id ? applyRef(n, c.changes) : n)) };
    case "updateEdge":
      return { ...s, edges: s.edges.map((e) => (e.id === c.id ? applyRef(e, c.changes) : e)) };
    case "updateZone":
      return { ...s, zones: s.zones.map((z) => (z.id === c.id ? applyRef(z, c.changes) : z)) };
  }
}

// Feature: core-graph, Property 10: P-GRAPH-10 same history and command → same result
// **Validates: Requirements 10.6, 10.7, 11.14, 11.15**
test("P-GRAPH-10 same history and command give the same result", () => {
  fc.assert(
    fc.property(withAnyCommand, ([s, c]) => {
      const command = c as EditCommand;
      const h = history(s);
      const sBefore = structuredClone(s);
      const cBefore = structuredClone(command);
      const hBefore = structuredClone(h);
      const a = applyCommand(structuredClone(s), structuredClone(command));
      const b = applyCommand(structuredClone(s), structuredClone(command));
      expect(a).toStrictEqual(b);
      const x = executeCommand(structuredClone(h), structuredClone(command));
      const y = executeCommand(structuredClone(h), structuredClone(command));
      expect(x).toStrictEqual(y);
      applyCommand(s, command);
      executeCommand(h, command);
      expect(jsonEqual(s, sBefore)).toBe(true);
      expect(jsonEqual(command, cBefore)).toBe(true);
      expect(jsonEqual(h, hBefore)).toBe(true);
    }),
    RUNS,
  );
});

// Feature: core-graph, Property 11: P-GRAPH-11 rejected commands change nothing
// **Validates: Requirements 11.8, 11.11, 11.12, 11.13, 11.18, 12.3**
test("P-GRAPH-11 rejected commands change nothing", () => {
  let rejected = 0;
  fc.assert(
    fc.property(withAnyCommand, ([s, c]) => {
      const command = c as EditCommand;
      const r = applyCommand(s, command);
      if (r.ok) return;
      rejected++;
      expect(r.errors.length).toBeGreaterThan(0);
      expect("scenario" in r).toBe(false);
      const h = history(s);
      const before = structuredClone(h);
      const e = executeCommand(h, command);
      expect(e.ok).toBe(false);
      if (e.ok) return;
      expect(e.errors).toEqual(r.errors);
      expect(e.history).toBe(h);
      expect(jsonEqual(e.history, before)).toBe(true);
      expect("scenario" in e).toBe(false);
    }),
    RUNS,
  );
  expect(rejected).toBeGreaterThan(0);
});

// Feature: core-graph, Property 13: P-GRAPH-13 a batch equals its commands in sequence, as one step
// **Validates: Requirements 11.17, 11.18, 12.9**
test("P-GRAPH-13 a batch equals its commands in sequence, as one step", () => {
  const input = scenarioArb.chain((s) => fc.tuple(fc.constant(s), fc.array(singleCommandArb(s), { minLength: 1, maxLength: 3 })));
  let succeeded = 0;
  let failed = 0;
  fc.assert(
    fc.property(input, ([s, commands]) => {
      let current = s;
      let failure: { k: number; errors: { path: string; message: string }[] } | undefined;
      for (const [k, command] of commands.entries()) {
        const step = applyCommand(current, command);
        if (!step.ok) {
          failure = { k, errors: step.errors };
          break;
        }
        current = step.scenario;
      }
      const batch: EditCommand = { kind: "batch", commands };
      const result = applyCommand(s, batch);
      if (failure === undefined) {
        succeeded++;
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(jsonEqual(result.scenario, current)).toBe(true);
        const h = history(s);
        const e = executeCommand(h, batch);
        expect(e.ok).toBe(true);
        if (!e.ok) return;
        expect(e.history.past).toHaveLength(1);
        const prior = e.history.past[0];
        expect(jsonEqual(prior, h.present)).toBe(true);
      } else {
        failed++;
        expect(result.ok).toBe(false);
        if (result.ok) return;
        const prefix = `commands.${failure.k}`;
        const expected = failure.errors.map((e) => ({ path: e.path === "" ? prefix : `${prefix}.${e.path}`, message: e.message }));
        expect(result.errors).toEqual(expected);
      }
    }),
    RUNS,
  );
  expect(succeeded).toBeGreaterThan(0);
  expect(failed).toBeGreaterThan(0);
});

// Feature: core-graph, Property 14: P-GRAPH-14 each accepted command makes exactly its change
// **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.9, 11.10**
test("P-GRAPH-14 each accepted command makes exactly its change", () => {
  const input = scenarioArb.chain((s) => fc.tuple(fc.constant(s), singleCommandArb(s)));
  let accepted = 0;
  fc.assert(
    fc.property(input, ([s, c]) => {
      const r = applyCommand(s, c);
      if (!r.ok) return;
      accepted++;
      expect(jsonEqual(r.scenario, reference(s, c))).toBe(true);
    }),
    RUNS,
  );
  expect(accepted).toBeGreaterThan(0);
});

// ---- examples ----

const v3 = { x: 0, y: 0, z: 0 };
function node(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: "card",
    position: v3,
    rotation: v3,
    scale: { x: 1, y: 1, z: 1 },
    front: { text: { en: id } },
    metadata: {},
    attributes: {},
    ...extra,
  };
}
const zone = (id: string, order: number) => ({ id, label: { en: id }, order, elevation: 0, enclosed: false });
const edge = (id: string, from: string, to: string) => ({ id, from, to, type: "link" });

function base(): Scenario {
  return {
    schemaVersion: 1,
    id: "s",
    title: { en: "S" },
    zones: [zone("z1", 0)],
    nodes: [node("n1", { zone: "z1" }), node("n2", { zone: "z1" }), node("n3")],
    edges: [edge("e1", "n1", "n2"), edge("e2", "n3", "n1"), edge("e3", "n2", "n3")],
  };
}

function errorsOf(s: Scenario, c: unknown) {
  const r = applyCommand(s, c as EditCommand);
  if (r.ok) throw new Error("expected failure");
  return r.errors;
}

describe("commands examples", () => {
  it("11.4 removing a Node removes its Edges", () => {
    const r = applyCommand(base(), { kind: "removeNode", id: "n1" });
    expect(r.ok && r.scenario.edges.map((e) => e.id)).toEqual(["e3"]);
    expect(r.ok && r.scenario.nodes.map((n) => n.id)).toEqual(["n2", "n3"]);
  });

  it("11.8 removing a referenced Zone fails at each referencing Node", () => {
    const errors = errorsOf(base(), { kind: "removeZone", id: "z1" });
    expect(errors.map((e) => e.path)).toEqual(["nodes.0.zone", "nodes.1.zone"]);
    expect(errors[0]?.message).toContain('"z1"');
  });

  it("11.11 a missing id fails at id", () => {
    expect(errorsOf(base(), { kind: "removeNode", id: "nope" })[0]?.path).toBe("id");
    expect(errorsOf(base(), { kind: "updateEdge", id: "nope", changes: {} })[0]?.path).toBe("id");
    expect(errorsOf(base(), { kind: "removeZone", id: "nope" })[0]?.path).toBe("id");
  });

  it("11.13 an unknown kind and a missing field fail", () => {
    expect(errorsOf(base(), { kind: "explode" })[0]?.path).toBe("kind");
    expect(errorsOf(base(), { kind: "addNode" })[0]?.path).toBe("node");
  });

  it("11.19 a bad commands list fails at commands", () => {
    for (const bad of [{ kind: "batch", commands: [] }, { kind: "batch" }, { kind: "batch", commands: "x" }]) {
      expect(errorsOf(base(), bad)[0]?.path).toBe("commands");
    }
  });

  it("11.20 a nested batch fails at commands.1.kind", () => {
    const cmd = { kind: "batch", commands: [{ kind: "removeEdge", id: "e1" }, { kind: "batch", commands: [] }] };
    expect(errorsOf(base(), cmd).map((e) => e.path)).toContain("commands.1.kind");
  });

  const clearThenRemove = [
    { kind: "updateNode", id: "n1", changes: { zone: null } },
    { kind: "updateNode", id: "n2", changes: { zone: null } },
    { kind: "removeZone", id: "z1" },
  ];

  it("11.17 clearing zones and then removing the Zone succeeds as one batch", () => {
    const r = applyCommand(base(), { kind: "batch", commands: clearThenRemove } as EditCommand);
    expect(r.ok && r.scenario.zones).toEqual([]);
    expect(r.ok && r.scenario.nodes.every((n) => n.zone === undefined)).toBe(true);
  });

  it("11.18 the reverse order fails at the removeZone command", () => {
    const reversed = [clearThenRemove[2], clearThenRemove[0], clearThenRemove[1]];
    expect(errorsOf(base(), { kind: "batch", commands: reversed }).map((e) => e.path)).toEqual([
      "commands.0.nodes.0.zone",
      "commands.0.nodes.1.zone",
    ]);
  });

  it("11.18 a failing command stops the batch and later commands are not applied", () => {
    const cmd = {
      kind: "batch",
      commands: [{ kind: "removeEdge", id: "e1" }, { kind: "removeNode", id: "nope" }, { kind: "removeEdge", id: "e2" }],
    };
    const errors = errorsOf(base(), cmd);
    expect(errors.map((e) => e.path)).toEqual(["commands.1.id"]);
  });

  it("11.14 and 10.7 the arguments are unchanged", () => {
    const s = base();
    const before = structuredClone(s);
    applyCommand(s, { kind: "removeNode", id: "n1" });
    applyCommand(s, { kind: "updateNode", id: "n1", changes: { zone: null, position: { x: 3, y: 0, z: 0 } } });
    applyCommand(s, { kind: "removeZone", id: "z1" });
    expect(s).toEqual(before);
  });

  it("null clears optional fields", () => {
    const s = { ...base(), edges: [{ ...edge("e1", "n1", "n2"), label: { en: "L" } }] } as Scenario;
    const r = applyCommand(s, { kind: "updateEdge", id: "e1", changes: { label: null } });
    expect(r.ok && "label" in (r.scenario.edges[0] as object)).toBe(false);
  });
});
