// Plain TypeScript: no React, three.js, Fiber, or drei import, so it runs under Vitest in Node.
import type { Node, Scenario } from "../../model/scenario-schema.ts";
import { snap } from "../helpers/snap.ts";

/** A press and move of more than this many CSS pixels is a drag (R-VIEW-13.1). */
export const DRAG_THRESHOLD_PX = 5;

export type Vec3 = { x: number; y: number; z: number };
export type Point2 = { x: number; y: number };

/** True when the pointer is more than `threshold` px from the press point. */
export function exceedsDragThreshold(start: Point2, now: Point2, threshold: number = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(now.x - start.x, now.y - start.y) > threshold;
}

/** Height of the Zone_Plane of a Node: the elevation of its Zone, or 0 with no Zone (R-VIEW-13.2). */
export function zonePlaneY(scenario: Scenario, node: Node): number {
  if (node.zone === undefined) return 0;
  return scenario.zones.find((z) => z.id === node.zone)?.elevation ?? 0;
}

/** Where a ray meets the plane `y = planeY`, or `null` when it is parallel to it, points away, or is not finite. */
export function rayPlaneHit(origin: Vec3, direction: Vec3, planeY: number): Vec3 | null {
  if (!(Math.abs(direction.y) > 1e-9)) return null;
  const t = (planeY - origin.y) / direction.y;
  if (!Number.isFinite(t) || t < 0) return null;
  const hit = { x: origin.x + t * direction.x, y: planeY, z: origin.z + t * direction.z };
  return Number.isFinite(hit.x) && Number.isFinite(hit.z) ? hit : null;
}

/**
 * The preview position of a dragged Node: the ray hit on the Zone_Plane, snapped, with the Node's own `y`.
 * When the ray misses the plane the previous preview is kept (R-VIEW-13.4).
 */
export function dragPreview(
  origin: Vec3,
  direction: Vec3,
  planeY: number,
  nodeY: number,
  step: number,
  last: Vec3,
): Vec3 {
  const hit = rayPlaneHit(origin, direction, planeY);
  if (hit === null) return last;
  return snap({ x: hit.x, y: nodeY, z: hit.z }, step);
}
