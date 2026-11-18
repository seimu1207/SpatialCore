import type { Scenario, ValidationError } from "../../model/scenario-schema.ts";
import type { CameraPose, ZoneFootprint } from "./settings-schema.ts";

export type PoseResult = { ok: true; pose: CameraPose } | { ok: false; errors: ValidationError[] };
export type ZoneWaypoints =
  | { ok: true; waypoints: CameraPose[]; zones: string[] }
  | { ok: false; errors: ValidationError[] };

type Point = { x: number; y: number; z: number };

function copyPose(p: CameraPose): CameraPose {
  return {
    position: { x: p.position.x, y: p.position.y, z: p.position.z },
    target: { x: p.target.x, y: p.target.y, z: p.target.z },
  };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), z: a.z + t * (b.z - a.z) };
}

/** Prefix sums of the `position` polyline: `cum[0] = 0`, `cum[i + 1] = cum[i] + len[i]`. */
function cumulative(waypoints: readonly CameraPose[]): { len: number[]; cum: number[] } {
  const len: number[] = [];
  const cum: number[] = [0];
  for (let i = 0; i + 1 < waypoints.length; i++) {
    const l = dist(waypoints[i].position, waypoints[i + 1].position);
    len.push(l);
    cum.push(cum[i] + l);
  }
  return { len, cum };
}

/** Camera_Pose at Path_Progress `progress`, measured by arc length of the `position` polyline (R-VIEW-09.1 to 09.3, 09.6 to 09.8). */
export function poseAt(waypoints: readonly CameraPose[], progress: number): PoseResult {
  try {
    if (
      typeof progress !== "number" ||
      !Number.isFinite(progress) ||
      progress < 0 ||
      progress > 1
    ) {
      return {
        ok: false,
        errors: [{ path: "progress", message: "progress must be a number from 0 to 1" }],
      };
    }
    if (waypoints.length < 2) {
      return {
        ok: false,
        errors: [{ path: "waypoints", message: "a camera path needs at least 2 waypoints" }],
      };
    }
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    if (progress === 0) return { ok: true, pose: copyPose(first) };
    if (progress === 1) return { ok: true, pose: copyPose(last) };
    const { len, cum } = cumulative(waypoints);
    const total = cum[cum.length - 1];
    if (total === 0) return { ok: true, pose: copyPose(first) };
    const s = progress * total;
    let seg = -1;
    for (let i = 0; i < len.length; i++) {
      if (len[i] > 0) {
        seg = i;
        if (cum[i + 1] >= s) break;
      }
    }
    const a = waypoints[seg];
    const b = waypoints[seg + 1];
    const t = Math.min(1, Math.max(0, (s - cum[seg]) / len[seg]));
    return {
      ok: true,
      pose: {
        position: lerpPoint(a.position, b.position, t),
        target: lerpPoint(a.target, b.target, t),
      },
    };
  } catch {
    return { ok: false, errors: [{ path: "waypoints", message: "invalid waypoints" }] };
  }
}

/** Path_Progress of each Waypoint: first is 0, last is 1 (all 0 but the last when the length is 0). */
export function waypointMarks(waypoints: readonly CameraPose[]): number[] {
  try {
    const n = waypoints.length;
    if (n === 0) return [];
    const { cum } = cumulative(waypoints);
    const total = cum[n - 1];
    return cum.map((c, i) => {
      if (i === n - 1) return 1;
      if (i === 0 || total === 0) return 0;
      return c / total;
    });
  } catch {
    return [];
  }
}

/** One Waypoint per Zone that has a footprint, in ascending `order` (R-VIEW-09.4, 09.5). */
export function buildZoneWaypoints(
  scenario: Scenario,
  footprints: readonly ZoneFootprint[],
  height: number,
): ZoneWaypoints {
  try {
    const centers = new Map<string, ZoneFootprint>();
    for (const fp of footprints) if (!centers.has(fp.id)) centers.set(fp.id, fp);
    const zones = scenario.zones
      .filter((z) => centers.has(z.id))
      .sort((a, b) => a.order - b.order);
    const positions: Point[] = zones.map((z) => {
      const fp = centers.get(z.id)!;
      return { x: fp.x, y: z.elevation + height, z: fp.z };
    });
    const fail = (message: string): ZoneWaypoints => ({ ok: false, errors: [{ path: "", message }] });
    if (positions.length < 2) return fail("a camera path from zones needs at least 2 zones with a footprint");
    const targets: Point[] = [];
    for (let k = 0; k < positions.length; k++) {
      if (k + 1 < positions.length) {
        targets.push({ ...positions[k + 1] });
      } else {
        const p = positions[k];
        const prevT = targets[k - 1];
        const prevP = positions[k - 1];
        targets.push({
          x: p.x + (prevT.x - prevP.x),
          y: p.y + (prevT.y - prevP.y),
          z: p.z + (prevT.z - prevP.z),
        });
      }
    }
    const waypoints: CameraPose[] = positions.map((p, k) => ({ position: p, target: targets[k] }));
    for (const w of waypoints) {
      const { position: p, target: t } = w;
      if (p.x === t.x && p.y === t.y && p.z === t.z) {
        return fail("a waypoint has the same position and target (neighbouring zones share a center)");
      }
    }
    return { ok: true, waypoints, zones: zones.map((z) => z.id) };
  } catch {
    return { ok: false, errors: [{ path: "", message: "invalid zones or footprints" }] };
  }
}

/** Interpolate two poses with smoothstep easing `t²(3 ∁E2t)` (D8). `t` is clamped to 0..1; NaN counts as 0. */
export function tweenPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  if (!(t > 0)) return copyPose(from);
  if (t >= 1) return copyPose(to);
  const e = t * t * (3 - 2 * t);
  return {
    position: lerpPoint(from.position, to.position, e),
    target: lerpPoint(from.target, to.target, e),
  };
}

/** True when both poses have equal components. */
export function posesEqual(a: CameraPose, b: CameraPose): boolean {
  return (
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z &&
    a.target.x === b.target.x &&
    a.target.y === b.target.y &&
    a.target.z === b.target.z
  );
}
