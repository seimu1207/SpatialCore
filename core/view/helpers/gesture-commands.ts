import type { EditCommand } from "../../model/commands.ts";
import type { Node, Scenario } from "../../model/scenario-schema.ts";

export const MIN_SCALE = 0.05;
export type GizmoAxis = "x" | "y" | "z";
type Vec3 = { x: number; y: number; z: number };

const ALL_AXES: readonly GizmoAxis[] = ["x", "y", "z"];

/** Move on the zone plane. `y` stays as stored. `null` when `x` and `z` do not change. */
export function dragCommand(node: Node, snapped: Vec3): EditCommand | null {
  const { x, z } = snapped;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (x === node.position.x && z === node.position.z) return null;
  return { kind: "updateNode", id: node.id, changes: { position: { x, y: node.position.y, z } } };
}

/** The components a gizmo handle may change. Unknown handles give no axes. */
export function gizmoAxes(mode: "rotate" | "scale", handle: unknown): GizmoAxis[] {
  if (mode === "rotate") {
    if (handle === "X") return ["x"];
    if (handle === "Y") return ["y"];
    if (handle === "Z") return ["z"];
    return [];
  }
  if (handle === "X") return ["x"];
  if (handle === "Y") return ["y"];
  if (handle === "XY") return ["x", "y"];
  return [];
}

/** `start` with only `axis` replaced by `start[axis] + delta`. */
export function rotationPreview(start: Vec3, axis: GizmoAxis, delta: number): Vec3 {
  return { x: start.x, y: start.y, z: start.z, [axis]: start[axis] + delta };
}

export function rotateCommand(node: Node, axis: GizmoAxis, delta: number): EditCommand | null {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return null;
  const r = rotationPreview(node.rotation, axis, delta);
  if (!Number.isFinite(r[axis]) || r[axis] === node.rotation[axis]) return null;
  return { kind: "updateNode", id: node.id, changes: { rotation: r } };
}

/** Raise the components in `axes` (default all) to at least `MIN_SCALE`. NaN becomes `MIN_SCALE`. */
export function clampScale(scale: Vec3, axes: readonly GizmoAxis[] = ALL_AXES): Vec3 {
  const out: Vec3 = { x: scale.x, y: scale.y, z: scale.z };
  for (const c of axes) {
    const v = scale[c];
    out[c] = Number.isNaN(v) ? MIN_SCALE : Math.max(MIN_SCALE, v);
  }
  return out;
}

export function scaleCommand(node: Node, axes: readonly GizmoAxis[], value: Vec3): EditCommand | null {
  if (axes.length === 0) return null;
  const built: Vec3 = { x: node.scale.x, y: node.scale.y, z: node.scale.z };
  for (const c of axes) built[c] = value[c];
  const s = clampScale(built, axes);
  if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.z)) return null;
  if (s.x === node.scale.x && s.y === node.scale.y && s.z === node.scale.z) return null;
  return { kind: "updateNode", id: node.id, changes: { scale: s } };
}

/** `edge-<k>` with the smallest `k >= edges.length + 1` that no Edge uses. */
export function newEdgeId(scenario: Scenario): string {
  const used = new Set(scenario.edges.map((e) => e.id));
  let k = scenario.edges.length + 1;
  while (used.has(`edge-${k}`)) k += 1;
  return `edge-${k}`;
}

export function connectCommand(scenario: Scenario, from: string, to: string, edgeType: string): EditCommand {
  return { kind: "addEdge", edge: { id: newEdgeId(scenario), from, to, type: edgeType } };
}
