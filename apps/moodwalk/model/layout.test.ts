import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Scenario, Zone } from "../../../core/model/scenario-schema.ts";
import { buildZoneWaypoints } from "../../../core/view/helpers/camera-path.ts";
import { loadViewSettings } from "../../../core/view/helpers/settings-schema.ts";
import { zonesArb } from "./arbitraries.ts";
import {
  LAYOUT,
  buildViewSettings,
  footprintAt,
  freeSlot,
  routeFootprints,
  slotPosition,
  walkDuration,
} from "./layout.ts";

function zones(n: number): Zone[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `z${i}`,
    label: { en: `Zone ${i}` },
    order: i,
    elevation: 0,
    enclosed: false,
  }));
}

function scenarioWith(n: number, positions: { x: number; y: number; z: number }[]): Scenario {
  return {
    zones: zones(n),
    nodes: positions.map((position, i) => ({ id: `n${i}`, position, zone: "z0" })),
  } as unknown as Scenario;
}

describe("routeFootprints", () => {
  it("gives seven 8 x 4 rects at z = 5 * rank for the Demo_Board", () => {
    const list = routeFootprints(zones(7));
    expect(list).toHaveLength(7);
    list.forEach((f, k) => {
      expect(f).toStrictEqual({ kind: "rect", id: `z${k}`, x: 0, z: 5 * k, width: 8, depth: 4 });
    });
  });

  it("ignores the list order", () => {
    expect(routeFootprints([...zones(4)].reverse())).toStrictEqual(routeFootprints(zones(4)));
  });
});

describe("buildViewSettings", () => {
  it("builds valid settings with the Demo_Board presets", () => {
    const s = buildViewSettings(zones(7), "overview");
    expect(loadViewSettings(s).ok).toBe(true);
    expect(s.presets.map((p) => p.id)).toStrictEqual(["overview", "visitor"]);
    const visitor = s.presets[1];
    expect(visitor.pose.position).toStrictEqual({ x: 0, y: 1.5, z: -7 });
    expect(visitor.pose.target).toStrictEqual({ x: 0, y: 1.5, z: 5 });
    const overview = s.presets[0];
    expect(overview.pose.target).toStrictEqual({ x: 0, y: 0, z: 15 });
    expect(s.paths).toStrictEqual([{ id: "route", fromZones: { height: 1.5 } }]);
    expect(s.snapStep).toBe(0.5);
    expect(s.detailDistance).toBe(2);
    expect(s.wallHeight).toBe(1.2);
    expect(s.stepDuration).toBe(2);
  });

  it("puts the active preset first", () => {
    const s = buildViewSettings(zones(3), "visitor");
    expect(s.presets.map((p) => p.id)).toStrictEqual(["visitor", "overview"]);
  });

  it("stays valid with fewer than 2 Zones", () => {
    for (const n of [0, 1]) {
      const s = buildViewSettings(zones(n), "overview");
      expect(loadViewSettings(s).ok).toBe(true);
    }
    expect(buildViewSettings(zones(1), "visitor").presets[0].pose.target).toStrictEqual({
      x: 0,
      y: 1.5,
      z: 5,
    });
  });

  it("keeps the Entrance slots in the Visitor view at 16:9 and 4:3", () => {
    // Vertical field of view 50 degrees (core/view/scene/view-root.tsx).
    const tanV = Math.tan((25 * Math.PI) / 180);
    for (const aspect of [16 / 9, 4 / 3]) {
      const tanH = tanV * aspect;
      expect(3.8 / 6.5).toBeLessThan(tanH);
      expect(2.3 / 8.5).toBeLessThan(tanH);
    }
    expect(1.8 / 6.5).toBeLessThan(tanV);
    expect(0.8 / 6.5).toBeLessThan(tanV);
  });
});

describe("slots", () => {
  it("are multiples of 0.5 and never cross x = 0", () => {
    for (let i = 0; i < 16; i += 1) {
      const p = slotPosition({ x: 0, z: 10 }, 0, i);
      expect(Math.abs(p.x % 0.5)).toBe(0);
      expect(Math.abs(p.z % 0.5)).toBe(0);
      expect(Math.abs(p.x)).toBeGreaterThanOrEqual(1.5);
    }
    expect(slotPosition({ x: 0, z: 0 }, 0, 0)).toStrictEqual({ x: -1.5, y: 1.3, z: 1.5 });
    expect(slotPosition({ x: 0, z: 0 }, 0, 5).y).toBeCloseTo(2.7);
    expect(LAYOUT.slotX).toHaveLength(4);
  });

  it("freeSlot returns the first unused slot and null for an unknown Zone", () => {
    const fp = routeFootprints(zones(2));
    expect(freeSlot(scenarioWith(2, []), "z0", fp)).toStrictEqual(slotPosition(fp[0], 0, 0));
    const used = [slotPosition(fp[0], 0, 0)];
    expect(freeSlot(scenarioWith(2, used), "z0", fp)).toStrictEqual(slotPosition(fp[0], 0, 1));
    expect(freeSlot(scenarioWith(2, []), "nope", fp)).toBeNull();
  });
});

describe("footprintAt", () => {
  it("finds a footprint, and returns null in the 1-unit gap", () => {
    const fp = routeFootprints(zones(2));
    expect(footprintAt(fp, 0, 0)).toBe("z0");
    expect(footprintAt(fp, 4, 2)).toBe("z0");
    expect(footprintAt(fp, 0, 5)).toBe("z1");
    expect(footprintAt(fp, 0, 2.5)).toBeNull();
    expect(footprintAt(fp, 4.5, 0)).toBeNull();
  });
});

describe("walkDuration", () => {
  it("is 4 per step, at least 4", () => {
    expect(walkDuration(7)).toBe(24);
    expect(walkDuration(2)).toBe(4);
    expect(walkDuration(1)).toBe(4);
  });
});

describe("depth is order property", () => {
  // Feature: app-moodwalk, Property 8: depth is order
  // **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 11.3, 12.4**
  it("P-APP2-8 depth is order", () => {
    fc.assert(
      fc.property(
        zonesArb,
        fc.constantFrom("overview" as const, "visitor" as const),
        fc.nat(),
        (list, active, seed) => {
          const sorted = [...list].sort((a, b) => a.order - b.order);
          const footprints = routeFootprints(list);
          expect(footprints).toHaveLength(list.length);
          expect(footprints.map((f) => f.id)).toStrictEqual(sorted.map((z) => z.id));
          for (const f of footprints) {
            expect(f.kind).toBe("rect");
            if (f.kind !== "rect") return;
            expect(f.width).toBeGreaterThan(0);
            expect(f.depth).toBeGreaterThan(0);
            expect(f.width).toBe(LAYOUT.width);
            expect(f.depth).toBe(LAYOUT.depth);
          }
          for (let i = 1; i < footprints.length; i += 1) {
            const a = footprints[i - 1];
            const b = footprints[i];
            expect(b.z).toBeGreaterThan(a.z);
            if (a.kind === "rect" && b.kind === "rect") {
              expect(b.z - a.z).toBeGreaterThanOrEqual((a.depth + b.depth) / 2);
            }
          }

          const settings = buildViewSettings(list, active);
          expect(loadViewSettings(settings).ok).toBe(true);
          const rotated = [...list.slice(seed % list.length), ...list.slice(0, seed % list.length)];
          expect(buildViewSettings(rotated, active)).toStrictEqual(settings);
          expect(buildViewSettings([...list].reverse(), active)).toStrictEqual(settings);
          expect(settings.presets[0].id).toBe(active);
          expect(settings.paths).toHaveLength(1);
          expect(settings.paths[0].id).toBe("route");
          expect(settings.paths[0].fromZones?.height).toBe(1.5);

          const scenario = { zones: list, nodes: [] } as unknown as Scenario;
          const result = buildZoneWaypoints(scenario, footprints, 1.5);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.zones).toStrictEqual(sorted.map((z) => z.id));
          expect(result.waypoints).toHaveLength(list.length);
          result.waypoints.forEach((w, k) => {
            const f = footprints[k];
            expect(w.position.x).toBe(f.x);
            expect(w.position.z).toBe(f.z);
            expect(w.position.y).toBe(sorted[k].elevation + 1.5);
            expect(w.target).not.toStrictEqual(w.position);
          });

          const visitor = buildViewSettings(list, "visitor").presets[0];
          expect(visitor.pose.position).toStrictEqual({
            x: 0,
            y: sorted[0].elevation + 1.5,
            z: footprints[0].z - 7,
          });
          expect(visitor.pose.target).toStrictEqual(result.waypoints[1].position);
        },
      ),
      { numRuns: 100 },
    );
  });
});