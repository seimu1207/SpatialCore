import { compareCodePoints } from "../../model/json.ts";
import type { Edge, Scenario } from "../../model/scenario-schema.ts";
import { edgeStyleFor, type Theme } from "./theme-schema.ts";

export const MIN_EDGE_GAP = 0.15;

export type LayoutVec3 = { x: number; y: number; z: number };

function visibleEdges(scenario: Scenario, visibleEdgeIds: readonly string[]): Edge[] {
  const wanted = new Set(visibleEdgeIds);
  return scenario.edges.filter((e) => wanted.has(e.id));
}

/** Perpendicular offset per visible non-loop Edge id (R-VIEW-05.4, 05.5). Pure; never throws. */
export function edgeOffsets(scenario: Scenario, visibleEdgeIds: readonly string[], theme: Theme): Map<string, number> {
  const groups = new Map<string, Edge[]>();
  for (const edge of visibleEdges(scenario, visibleEdgeIds)) {
    if (edge.from === edge.to) continue;
    const [a, b] = compareCodePoints(edge.from, edge.to) <= 0 ? [edge.from, edge.to] : [edge.to, edge.from];
    const key = JSON.stringify([a, b]);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [edge]);
    else group.push(edge);
  }
  const result = new Map<string, number>();
  for (const group of groups.values()) {
    group.sort((p, q) => compareCodePoints(p.id, q.id));
    let maxWidth = 0;
    for (const e of group) maxWidth = Math.max(maxWidth, edgeStyleFor(theme, e.type).width);
    const spacing = Math.max(MIN_EDGE_GAP, 2 * maxWidth);
    const n = group.length;
    group.forEach((e, k) => {
      result.set(e.id, n === 1 ? 0 : (k - (n - 1) / 2) * spacing);
    });
  }
  return result;
}

/**
 * Midpoint of the Edge curve. `from` is the end with the smaller Node id, `to` the larger,
 * so an Edge and its reverse share one frame (R-VIEW-05.5).
 */
export function edgeMidpoint(from: LayoutVec3, to: LayoutVec3, offset: number): LayoutVec3 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  let px = 1;
  let pz = 0;
  if (len > 0) {
    // normalize(d × (0, 1, 0)) = normalize((-dz, 0, dx))
    const horizontal = Math.hypot(dx, dz) / len;
    if (horizontal >= 1e-9) {
      const h = Math.hypot(dx, dz);
      px = -dz / h;
      pz = dx / h;
    }
  }
  return {
    x: (from.x + to.x) / 2 + offset * px,
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2 + offset * pz,
  };
}

/** Loop radius per visible self-loop Edge id (R-VIEW-05.6). Pure; never throws. */
export function loopSizes(scenario: Scenario, visibleEdgeIds: readonly string[]): Map<string, number> {
  const byNode = new Map<string, Edge[]>();
  for (const edge of visibleEdges(scenario, visibleEdgeIds)) {
    if (edge.from !== edge.to) continue;
    const group = byNode.get(edge.from);
    if (group === undefined) byNode.set(edge.from, [edge]);
    else group.push(edge);
  }
  const result = new Map<string, number>();
  for (const group of byNode.values()) {
    group.sort((p, q) => compareCodePoints(p.id, q.id));
    group.forEach((e, k) => result.set(e.id, 0.35 * (1 + 0.5 * k)));
  }
  return result;
}
