import { describe, expect, it } from "vitest";
import { dragPreview, exceedsDragThreshold, rayPlaneHit, zonePlaneY } from "./drag.ts";
import type { Node, Scenario } from "../../model/scenario-schema.ts";

describe("exceedsDragThreshold", () => {
  it("is false at exactly 5 px and true beyond", () => {
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 3, y: 4.1 })).toBe(true);
  });
});

describe("rayPlaneHit", () => {
  it("hits a plane below the origin", () => {
    expect(rayPlaneHit({ x: 0, y: 4, z: 0 }, { x: 1, y: -1, z: 0 }, 1)).toEqual({ x: 3, y: 1, z: 0 });
  });
  it("misses when parallel or pointing away", () => {
    expect(rayPlaneHit({ x: 0, y: 4, z: 0 }, { x: 1, y: 0, z: 0 }, 1)).toBeNull();
    expect(rayPlaneHit({ x: 0, y: 4, z: 0 }, { x: 0, y: 1, z: 0 }, 1)).toBeNull();
  });
});

describe("dragPreview", () => {
  const last = { x: 9, y: 9, z: 9 };
  it("snaps the hit and keeps the node y", () => {
    const p = dragPreview({ x: 0, y: 4, z: 0 }, { x: 0.26, y: -1, z: 0.74 }, 0, 2, 0.5, last);
    expect(p).toEqual({ x: 1, y: 2, z: 3 });
  });
  it("keeps the last preview on a miss", () => {
    expect(dragPreview({ x: 0, y: 4, z: 0 }, { x: 1, y: 0, z: 0 }, 0, 2, 0.5, last)).toBe(last);
  });
});

describe("zonePlaneY", () => {
  const scenario = { zones: [{ id: "a", elevation: 2.5 }] } as unknown as Scenario;
  it("uses the zone elevation, or 0 without a known zone", () => {
    expect(zonePlaneY(scenario, { zone: "a" } as unknown as Node)).toBe(2.5);
    expect(zonePlaneY(scenario, {} as unknown as Node)).toBe(0);
    expect(zonePlaneY(scenario, { zone: "zz" } as unknown as Node)).toBe(0);
  });
});
