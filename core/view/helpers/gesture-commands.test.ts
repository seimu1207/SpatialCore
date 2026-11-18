import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { identifierArb, jsonEqual } from "../../model/arbitraries.ts";
import { applyCommand, type EditCommand } from "../../model/commands.ts";
import { createHistory, executeCommand, undo } from "../../model/history.ts";
import type { Node, Scenario } from "../../model/scenario-schema.ts";
import { scenarioNodeArb, scenarioPairArb, vec3Arb } from "./arbitraries.ts";
import { snap } from "./snap.ts";
import {
  MIN_SCALE,
  type GizmoAxis,
  clampScale,
  connectCommand,
  dragCommand,
  gizmoAxes,
  newEdgeId,
  rotateCommand,
  rotationPreview,
  scaleCommand,
} from "./gesture-commands.ts";

const node: Node = {
  id: "n1",
  type: "card",
  position: { x: 1, y: 2, z: 3 },
  rotation: { x: 0.1, y: 0.2, z: 0.3 },
  scale: { x: 1, y: 2, z: 3 },
  front: { text: { en: "First card" } },
  metadata: {},
  attributes: {},
};
const atMin: Node = { ...node, scale: { x: MIN_SCALE, y: MIN_SCALE, z: 7 } };

function scenario(edgeIds: string[]): Scenario {
  return {
    schemaVersion: 1,
    id: "s",
    title: { en: "T" },
    nodes: [node],
    edges: edgeIds.map((id) => ({ id, from: "n1", to: "n1", type: "link" })),
    zones: [],
  };
}

describe("gesture-commands", () => {
  it("drag with equal x and z is null; otherwise keeps y", () => {
    expect(dragCommand(node, { x: 1, y: 9, z: 3 })).toBeNull();
    expect(dragCommand(node, { x: 2, y: 9, z: 3 })).toEqual({
      kind: "updateNode",
      id: "n1",
      changes: { position: { x: 2, y: 2, z: 3 } },
    });
  });

  it("rotate delta 0 is null; one component changes", () => {
    expect(rotateCommand(node, "y", 0)).toBeNull();
    expect(rotateCommand(node, "y", Number.NaN)).toBeNull();
    const cmd = rotateCommand(node, "y", 0.5);
    expect(cmd).toEqual({
      kind: "updateNode",
      id: "n1",
      changes: { rotation: { x: 0.1, y: 0.2 + 0.5, z: 0.3 } },
    });
    expect(rotationPreview(node.rotation, "x", 1)).toEqual({ x: 1.1, y: 0.2, z: 0.3 });
  });

  it("scale at or below MIN_SCALE on a Node already at MIN_SCALE is null", () => {
    expect(scaleCommand(atMin, ["x", "y"], { x: 0.001, y: -4, z: 99 })).toBeNull();
  });

  it("scale clamps before the no-change check and never writes z", () => {
    const cmd = scaleCommand(node, ["x", "y"], { x: 0.01, y: 5, z: 99 });
    expect(cmd).toEqual({ kind: "updateNode", id: "n1", changes: { scale: { x: MIN_SCALE, y: 5, z: 3 } } });
    expect(scaleCommand(node, [], { x: 9, y: 9, z: 9 })).toBeNull();
  });

  it("clampScale turns NaN into MIN_SCALE and respects axes", () => {
    expect(clampScale({ x: Number.NaN, y: 0, z: 0 }, ["x"])).toEqual({ x: MIN_SCALE, y: 0, z: 0 });
    expect(clampScale({ x: 0, y: 1, z: -1 })).toEqual({ x: MIN_SCALE, y: 1, z: MIN_SCALE });
  });

  it("gizmoAxes maps handles; E, XYZE, null give none", () => {
    expect(gizmoAxes("rotate", "Z")).toEqual(["z"]);
    expect(gizmoAxes("scale", "XY")).toEqual(["x", "y"]);
    expect(gizmoAxes("scale", "Y")).toEqual(["y"]);
    expect(gizmoAxes("rotate", "XY")).toEqual([]);
    for (const h of ["E", "XYZE", "XYZ", null, undefined, 3]) {
      expect(gizmoAxes("rotate", h)).toEqual([]);
      expect(gizmoAxes("scale", h)).toEqual([]);
    }
  });

  it("newEdgeId picks the smallest unused edge-<k> from edges.length + 1", () => {
    expect(newEdgeId(scenario([]))).toBe("edge-1");
    expect(newEdgeId(scenario(["a", "b"]))).toBe("edge-3");
    expect(newEdgeId(scenario(["edge-2", "edge-3"]))).toBe("edge-4");
  });

  it("connectCommand is accepted by applyCommand", () => {
    const s = scenario(["edge-1"]);
    const cmd = connectCommand(s, "n1", "n1", "link");
    expect(cmd).toEqual({ kind: "addEdge", edge: { id: "edge-2", from: "n1", to: "n1", type: "link" } });
    expect(applyCommand(s, cmd).ok).toBe(true);
  });
});

// ---- P-VIEW-7 ----

const AXES: GizmoAxis[] = ["x", "y", "z"];
const small = fc.double({ min: -10, max: 10, noNaN: true });
const deltaArb = fc.oneof(small, fc.constant(0));
const handleArb = fc.constantFrom<string | null>("X", "Y", "XY", "XYZ", "E", null);
const stepArb = fc.double({ min: 1e-3, max: 1e3, noNaN: true });

function updatesOnly(before: Scenario, after: Scenario, node: Node, changes: Partial<Node>): boolean {
  const expected: Scenario = {
    ...before,
    nodes: before.nodes.map((m) => (m.id === node.id ? { ...m, ...changes } : m)),
  };
  return jsonEqual(after, expected);
}

/** Runs one non-null command through History: accepted, one step, only the one field changed, one undo restores. */
function checkAcceptedAndUndone(s: Scenario, node: Node, cmd: EditCommand, changes: Partial<Node>): void {
  const created = createHistory(s);
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const done = executeCommand(created.history, cmd);
  expect(done.ok).toBe(true);
  if (!done.ok) return;
  expect(done.history.past.length).toBe(created.history.past.length + 1);
  expect(updatesOnly(created.history.present, done.history.present, node, changes)).toBe(true);
  expect(jsonEqual(undo(done.history).present, s)).toBe(true);
}

// Feature: core-view, Property 7: P-VIEW-7 gesture commands are accepted and undone in one step
// **Validates: Requirements 13.5, 13.6, 14.4, 14.5, 14.6, 14.7, 15.3, 15.5, 16.2, 16.5**
describe("P-VIEW-7", () => {
  test("dragCommand", () => {
    fc.assert(
      fc.property(
        scenarioNodeArb,
        stepArb,
        fc.constantFrom("same", "random"),
        vec3Arb(fc.double({ min: -1e4, max: 1e4, noNaN: true })),
        ({ scenario, node }, step, mode, p) => {
          const snapped = snap(mode === "same" ? node.position : p, step);
          const cmd = dragCommand(node, snapped);
          const unchanged = snapped.x === node.position.x && snapped.z === node.position.z;
          expect(cmd === null).toBe(unchanged);
          if (cmd === null || cmd.kind !== "updateNode") return;
          const pos = cmd.changes.position;
          expect(pos).toBeDefined();
          expect(Object.is(pos?.y, node.position.y)).toBe(true);
          checkAcceptedAndUndone(scenario, node, cmd, { position: pos });
        },
      ),
      { numRuns: 100 },
    );
  });

  test("rotateCommand", () => {
    fc.assert(
      fc.property(scenarioNodeArb, fc.constantFrom(...AXES), deltaArb, ({ scenario, node }, c, delta) => {
        const cmd = rotateCommand(node, c, delta);
        const built = node.rotation[c] + delta;
        expect(cmd === null).toBe(!Number.isFinite(built) || built === node.rotation[c]);
        if (cmd === null || cmd.kind !== "updateNode") return;
        const r = cmd.changes.rotation;
        expect(r).toBeDefined();
        if (r === undefined) return;
        expect(r[c]).toBe(built);
        for (const o of AXES.filter((a) => a !== c)) expect(Object.is(r[o], node.rotation[o])).toBe(true);
        checkAcceptedAndUndone(scenario, node, cmd, { rotation: r });
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(handleArb, fc.anything(), (h, other) => {
        const axes = gizmoAxes("rotate", h);
        expect(axes.length).toBe(h === "X" || h === "Y" || h === "Z" ? 1 : 0);
        if (typeof other !== "string" || !["X", "Y", "Z"].includes(other)) {
          expect(gizmoAxes("rotate", other)).toEqual([]);
        }
      }),
      { numRuns: 50 },
    );
  });

  test("scaleCommand", () => {
    fc.assert(
      fc.property(
        scenarioNodeArb,
        handleArb,
        vec3Arb(small),
        fc.boolean(),
        ({ scenario, node }, h, value, atStored) => {
          const axes = gizmoAxes("scale", h);
          const v = atStored ? { ...node.scale } : value;
          const cmd = scaleCommand(node, axes, v);
          const expected = { ...node.scale };
          for (const c of axes) expected[c] = Math.max(MIN_SCALE, v[c]);
          const same = AXES.every((c) => expected[c] === node.scale[c]);
          expect(cmd === null).toBe(axes.length === 0 || same);
          if (cmd === null || cmd.kind !== "updateNode") return;
          const s = cmd.changes.scale;
          expect(s).toBeDefined();
          if (s === undefined) return;
          for (const c of AXES) {
            if (axes.includes(c)) expect(s[c]).toBe(Math.max(MIN_SCALE, v[c]));
            else expect(Object.is(s[c], node.scale[c])).toBe(true);
          }
          expect(Object.is(s.z, node.scale.z)).toBe(true);
          checkAcceptedAndUndone(scenario, node, cmd, { scale: s });
        },
      ),
      { numRuns: 100 },
    );
  });

  test("connectCommand and newEdgeId", () => {
    fc.assert(
      fc.property(scenarioPairArb, identifierArb, ({ scenario, from, to }, type) => {
        const id = newEdgeId(scenario);
        expect(id.trim().length).toBeGreaterThan(0);
        expect(scenario.edges.some((e) => e.id === id)).toBe(false);
        const cmd = connectCommand(scenario, from, to, type);
        const r = applyCommand(scenario, cmd);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const added = r.scenario.edges.find((e) => e.id === id);
        expect(added?.from).toBe(from);
        expect(added?.to).toBe(to);
        expect(added?.type).toBe(type);
      }),
      { numRuns: 100 },
    );
  });
});
