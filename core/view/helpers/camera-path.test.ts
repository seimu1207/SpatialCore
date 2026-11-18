import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { scenarioArb } from "../../model/arbitraries.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { badProgressArb, boundedArb, footprintsArb, progressArb, waypointsArb, type Vec3 } from "./arbitraries.ts";
import { buildZoneWaypoints, poseAt, posesEqual, tweenPose, waypointMarks } from "./camera-path.ts";
import type { CameraPose, ZoneFootprint } from "./settings-schema.ts";

const t = (en: string) => ({ en, ja: en });
const pose = (x: number, tx = x + 1): CameraPose => ({
  position: { x, y: 0, z: 0 },
  target: { x: tx, y: 0, z: 0 },
});

function zonesScenario(zones: { id: string; order: number; elevation: number }[]): Scenario {
  return {
    nodes: [],
    edges: [],
    zones: zones.map((z) => ({ ...z, label: t(z.id), enclosed: false })),
  } as unknown as Scenario;
}
const rect = (id: string, x: number, z: number): ZoneFootprint => ({
  kind: "rect",
  id,
  x,
  z,
  width: 2,
  depth: 2,
});

describe("poseAt", () => {
  it("returns the exact ends and interpolates by arc length", () => {
    const w = [pose(0), pose(1), pose(4)];
    expect(poseAt(w, 0)).toEqual({ ok: true, pose: w[0] });
    expect(poseAt(w, 1)).toEqual({ ok: true, pose: w[2] });
    const r = poseAt(w, 0.5);
    expect(r.ok && r.pose.position.x).toBeCloseTo(2, 12);
    expect(r.ok && r.pose.target.x).toBeCloseTo(3, 12);
  });

  it("fails at progress for invalid values", () => {
    for (const p of [-0.01, 1.01, NaN, Infinity]) {
      expect(poseAt([pose(0), pose(1)], p)).toEqual({
        ok: false,
        errors: [{ path: "progress", message: "progress must be a number from 0 to 1" }],
      });
    }
  });

  it("09.7: two equal neighbours give a zero-length segment without NaN", () => {
    const w = [pose(0), pose(2), pose(2), pose(4)];
    for (const p of [0.1, 0.25, 0.5, 0.5000001, 0.75, 0.99]) {
      const r = poseAt(w, p);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(Number.isFinite(r.pose.position.x)).toBe(true);
        expect(Number.isFinite(r.pose.target.x)).toBe(true);
      }
    }
    const mid = poseAt(w, 0.5);
    expect(mid.ok && mid.pose.position.x).toBeCloseTo(2, 12);
  });

  it("09.8: all positions equal returns the first Waypoint below 1 and the last at 1", () => {
    const w = [pose(3, 4), pose(3, 5), pose(3, 6)];
    expect(poseAt(w, 0.7)).toEqual({ ok: true, pose: w[0] });
    expect(poseAt(w, 1)).toEqual({ ok: true, pose: w[2] });
    expect(waypointMarks(w)).toEqual([0, 0, 1]);
  });

  it("does not change its inputs and returns copies", () => {
    const w = [pose(0), pose(1)];
    const before = structuredClone(w);
    const r = poseAt(w, 0);
    expect(w).toEqual(before);
    expect(r.ok && r.pose).not.toBe(w[0]);
  });
});

describe("waypointMarks", () => {
  it("gives the progress of each Waypoint", () => {
    expect(waypointMarks([pose(0), pose(1), pose(4)])).toEqual([0, 0.25, 1]);
  });
});

describe("buildZoneWaypoints", () => {
  it("builds one Waypoint per footprinted Zone in ascending order", () => {
    const s = zonesScenario([
      { id: "b", order: 1, elevation: 0.5 },
      { id: "a", order: 0, elevation: 0 },
      { id: "c", order: 2, elevation: 1 },
      { id: "nofp", order: 3, elevation: 0 },
    ]);
    const r = buildZoneWaypoints(s, [rect("a", 0, 0), rect("b", 4, 0), rect("c", 8, 0)], 1.6);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.zones).toEqual(["a", "b", "c"]);
    expect(r.waypoints[0]).toEqual({
      position: { x: 0, y: 1.6, z: 0 },
      target: { x: 4, y: 2.1, z: 0 },
    });
    expect(r.waypoints[2].target).toEqual({ x: 12, y: 2.6 + 0.5, z: 0 });
  });

  it("09.5: two Zones with the same center fail", () => {
    const s = zonesScenario([
      { id: "a", order: 0, elevation: 0 },
      { id: "b", order: 1, elevation: 0 },
    ]);
    const r = buildZoneWaypoints(s, [rect("a", 1, 1), rect("b", 1, 1)], 1);
    expect(r.ok).toBe(false);
  });

  it("fails with fewer than 2 Waypoints", () => {
    const s = zonesScenario([{ id: "a", order: 0, elevation: 0 }]);
    expect(buildZoneWaypoints(s, [rect("a", 0, 0)], 1).ok).toBe(false);
  });
});

const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const lerp3 = (a: Vec3, b: Vec3, f: number): Vec3 => ({
  x: a.x + f * (b.x - a.x),
  y: a.y + f * (b.y - a.y),
  z: a.z + f * (b.z - a.z),
});

// Feature: core-view, Property 4: P-VIEW-4 camera path interpolation
describe("P-VIEW-4 camera path interpolation", () => {
  /**
   * **Validates: Requirements 9.1, 9.2, 9.4, 9.5, 9.6, 9.7, 9.8**
   */
  it("poseAt: exact ends, arc length, monotone, on a segment, finite", () => {
    fc.assert(
      fc.property(waypointsArb, progressArb, progressArb, (w, a, b) => {
        const [p, q] = a <= b ? [a, b] : [b, a];
        const first = poseAt(w, 0);
        const last = poseAt(w, 1);
        expect(first.ok && posesEqual(first.pose, w[0])).toBe(true);
        expect(last.ok && posesEqual(last.pose, w[w.length - 1])).toBe(true);

        const cum = [0];
        for (let i = 0; i + 1 < w.length; i++) cum.push(cum[i] + dist3(w[i].position, w[i + 1].position));
        const total = cum[cum.length - 1];
        const tol = 1e-9 * (1 + total);

        const lengthAt = (progress: number): number => {
          const r = poseAt(w, progress);
          if (!r.ok) throw new Error("unexpected failure");
          const { position, target } = r.pose;
          for (const v of [position.x, position.y, position.z, target.x, target.y, target.z]) {
            expect(Number.isFinite(v)).toBe(true);
          }
          if (total === 0) {
            expect(posesEqual(r.pose, progress < 1 ? w[0] : w[w.length - 1])).toBe(true);
            return 0;
          }
          const s = progress * total;
          // Some segment holds the position and gives the target the same fraction.
          let found = false;
          for (let i = 0; i + 1 < w.length && !found; i++) {
            const len = cum[i + 1] - cum[i];
            if (len === 0) continue;
            const f = (s - cum[i]) / len;
            if (f < -1e-9 || f > 1 + 1e-9) continue;
            const pos = lerp3(w[i].position, w[i + 1].position, f);
            const tgt = lerp3(w[i].target, w[i + 1].target, f);
            if (dist3(pos, position) <= tol && dist3(tgt, target) <= tol * 4) found = true;
          }
          expect(found).toBe(true);
          // Length from the start to the pose, along the segment that holds it.
          for (let i = 0; i + 1 < w.length; i++) {
            const len = cum[i + 1] - cum[i];
            if (len === 0 || s < cum[i] - tol || s > cum[i + 1] + tol) continue;
            if (Math.abs(cum[i] + dist3(w[i].position, position) - s) <= tol) return s;
          }
          return NaN;
        };
        const lp = lengthAt(p);
        const lq = lengthAt(q);
        expect(Math.abs(lp - p * total)).toBeLessThanOrEqual(tol);
        expect(Math.abs(lq - q * total)).toBeLessThanOrEqual(tol);
        expect(lq).toBeGreaterThanOrEqual(lp - tol);
      }),
    );
  });

  it("poseAt: every bad progress fails at `progress`", () => {
    fc.assert(
      fc.property(waypointsArb, badProgressArb, (w, bad) => {
        const r = poseAt(w, bad);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors.map((e) => e.path)).toContain("progress");
      }),
    );
  });

  it("buildZoneWaypoints: one Waypoint per footprinted Zone in order, or the exact failures", () => {
    fc.assert(
      fc.property(
        scenarioArb.chain((s) => fc.tuple(fc.constant(s), footprintsArb(s), boundedArb)),
        ([s, fps, height]) => {
          const byId = new Map(fps.map((f) => [f.id, f]));
          const zones = s.zones.filter((z) => byId.has(z.id)).sort((a, b) => a.order - b.order);
          const pos = zones.map((z) => ({ x: byId.get(z.id)!.x, y: z.elevation + height, z: byId.get(z.id)!.z }));
          const tgt: Vec3[] = pos.map((p, k) => (k + 1 < pos.length ? p : p));
          for (let k = 0; k + 1 < pos.length; k++) tgt[k] = pos[k + 1];
          if (pos.length >= 2) {
            const k = pos.length - 1;
            tgt[k] = {
              x: pos[k].x + (tgt[k - 1].x - pos[k - 1].x),
              y: pos[k].y + (tgt[k - 1].y - pos[k - 1].y),
              z: pos[k].z + (tgt[k - 1].z - pos[k - 1].z),
            };
          }
          const degenerate = pos.some((p, k) => p.x === tgt[k].x && p.y === tgt[k].y && p.z === tgt[k].z);
          const r = buildZoneWaypoints(s, fps, height);
          if (pos.length < 2 || degenerate) {
            expect(r.ok).toBe(false);
            return;
          }
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          expect(r.zones).toEqual(zones.map((z) => z.id));
          expect(r.waypoints).toEqual(pos.map((p, k) => ({ position: p, target: tgt[k] })));
        },
      ),
    );
  });
});

describe("tweenPose and posesEqual", () => {
  it("hits both ends exactly and eases in between", () => {
    const a = pose(0);
    const b = pose(10);
    expect(tweenPose(a, b, 0)).toEqual(a);
    expect(tweenPose(a, b, 1)).toEqual(b);
    expect(tweenPose(a, b, 0.5).position.x).toBe(5);
    expect(tweenPose(a, b, 0.25).position.x).toBeCloseTo(1.5625, 12);
  });

  it("compares poses component by component", () => {
    expect(posesEqual(pose(1), pose(1))).toBe(true);
    expect(posesEqual(pose(1), pose(1, 5))).toBe(false);
  });
});
