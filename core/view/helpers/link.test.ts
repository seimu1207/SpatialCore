import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { scenarioArb } from "../../model/arbitraries.ts";
import { timelineFromZones } from "../../model/timeline.ts";
import { timelineArb } from "./arbitraries.ts";
import { buildZoneWaypoints } from "./camera-path.ts";
import type { ZoneFootprint } from "./settings-schema.ts";
import { checkLinkedTimeline } from "./link.ts";
import type { ZoneWaypoints } from "./camera-path.ts";
import type { CameraPath } from "./settings-schema.ts";

const pose = { position: { x: 0, y: 0, z: 0 }, target: { x: 1, y: 0, z: 0 } };
const built: ZoneWaypoints = { ok: true, waypoints: [pose, pose], zones: ["area-a", "area-b"] };
const path: CameraPath = { id: "p", fromZones: { height: 1 } };
const step = (id: string, zone: string) => ({
  id,
  targets: [{ kind: "zone", id: zone }],
  effects: [],
});
const good = { steps: [step("s0", "area-a"), step("s1", "area-b")] };

describe("checkLinkedTimeline", () => {
  it("accepts a matching timeline", () => {
    expect(checkLinkedTimeline(path, built, good)).toEqual([]);
  });

  it("rejects a path without fromZones and stops", () => {
    const waypointPath = { id: "p", waypoints: [pose, pose] } as CameraPath;
    expect(checkLinkedTimeline(waypointPath, built, "junk")).toEqual([
      { path: "timeline", message: "a linked timeline needs a camera path built from zones" },
    ]);
  });

  it("returns schema errors under timeline and stops", () => {
    const errors = checkLinkedTimeline(path, built, { steps: "x" });
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) expect(e.path.startsWith("timeline")).toBe(true);
  });

  it("reports a step count mismatch", () => {
    expect(checkLinkedTimeline(path, built, { steps: [step("s0", "area-a")] })).toEqual([
      { path: "timeline.steps", message: "expected 2 steps, one per waypoint" },
    ]);
  });

  it("reports a wrong zone, a second target, and a non-zone target by index", () => {
    const t = {
      steps: [
        step("s0", "area-x"),
        { id: "s1", targets: [{ kind: "zone", id: "area-b" }, { kind: "zone", id: "area-a" }], effects: [] },
      ],
    };
    expect(checkLinkedTimeline(path, built, t)).toEqual([
      { path: "timeline.steps.0.targets", message: "expected one zone target area-a" },
      { path: "timeline.steps.1.targets", message: "expected one zone target area-b" },
    ]);
    const node = { steps: [step("s0", "area-a"), { id: "s1", targets: [{ kind: "node", id: "area-b" }], effects: [] }] };
    expect(checkLinkedTimeline(path, built, node)).toEqual([
      { path: "timeline.steps.1.targets", message: "expected one zone target area-b" },
    ]);
  });

  it("does not throw or mutate on odd input", () => {
    expect(checkLinkedTimeline(path, built, null).length).toBeGreaterThan(0);
  });
});

// A Scenario with 2 or more Zones, a footprint for every Zone at distinct centers (so the build succeeds).
const builtCaseArb = scenarioArb
  .filter((s) => s.zones.length >= 2)
  .chain((s) => {
    const footprints: ZoneFootprint[] = s.zones.map((z, i) => ({
      kind: "rect",
      id: z.id,
      x: i * 10,
      z: 0,
      width: 2,
      depth: 2,
    }));
    const built = buildZoneWaypoints(s, footprints, 1.5);
    if (!built.ok) throw new Error("builder must succeed");
    return fc.record({
      s: fc.constant(s),
      built: fc.constant(built),
      c: timelineArb(s, built.zones),
    });
  });

describe("P-VIEW-13", () => {
  const fromZonesPath: CameraPath = { id: "p", fromZones: { height: 1.5 } };

  // Feature: core-view, Property 13: P-VIEW-13 Link_Conditions
  // **Validates: Requirements 17.11, 17.12**
  it("P-VIEW-13 Link_Conditions: [] exactly for matching timelines, paths start with timeline", () => {
    fc.assert(
      fc.property(builtCaseArb, ({ built, c }) => {
        const errors = checkLinkedTimeline(fromZonesPath, built, c.timeline);
        if (c.matching) return errors.length === 0;
        return errors.length > 0 && errors.every((e) => e.path.startsWith("timeline"));
      }),
      { numRuns: 200 },
    );
  });

  // Feature: core-view, Property 13: P-VIEW-13 Link_Conditions
  it("P-VIEW-13 Link_Conditions: a waypoints path gives exactly one error at timeline", () => {
    fc.assert(
      fc.property(builtCaseArb, ({ built, c }) => {
        const wp = { id: "p", waypoints: [pose, pose] } as CameraPath;
        const errors = checkLinkedTimeline(wp, built, c.timeline);
        return errors.length === 1 && errors[0].path === "timeline";
      }),
      { numRuns: 100 },
    );
  });

  // Feature: core-view, Property 13: P-VIEW-13 Link_Conditions
  it("P-VIEW-13 Link_Conditions: timelineFromZones on a fully footprinted Scenario passes", () => {
    fc.assert(
      fc.property(builtCaseArb, ({ s, built }) => {
        const t = timelineFromZones(s);
        return t.ok && checkLinkedTimeline(fromZonesPath, built, t.value).length === 0;
      }),
      { numRuns: 100 },
    );
  });
});