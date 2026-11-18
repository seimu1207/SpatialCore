import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { showsDetail } from "./detail.js";

describe("showsDetail", () => {
  const camera = { x: 0, y: 0, z: 0 };

  it("shows detail when the distance equals the limit", () => {
    expect(showsDetail(camera, { x: 3, y: 4, z: 0 }, 5)).toBe(true);
  });

  it("shows detail inside the limit", () => {
    expect(showsDetail(camera, { x: 1, y: 1, z: 1 }, 5)).toBe(true);
  });

  it("hides detail beyond the limit", () => {
    expect(showsDetail(camera, { x: 3, y: 4, z: 0.001 }, 5)).toBe(false);
  });
});

// Feature: core-view, Property 6: P-VIEW-6 detail layer decision
// **Validates: Requirements 11.1, 11.2, 11.3**
describe("P-VIEW-6 detail layer decision", () => {
  const boundedArb = fc.double({ min: -1e3, max: 1e3, noNaN: true });
  const pointArb = fc.record({ x: boundedArb, y: boundedArb, z: boundedArb });
  const distanceArb = fc.double({ min: 1e-3, max: 1e4, noNaN: true });

  it("is true exactly when the hypot distance is at most the limit", () => {
    fc.assert(
      fc.property(pointArb, pointArb, distanceArb, (camera, node, d) => {
        const dist = Math.hypot(camera.x - node.x, camera.y - node.y, camera.z - node.z);
        expect(showsDetail(camera, node, d)).toBe(dist <= d);
      }),
    );
  });

  it("never turns true into false when the camera moves toward the node", () => {
    fc.assert(
      fc.property(pointArb, pointArb, distanceArb, fc.double({ min: 0, max: 1, noNaN: true }), (camera, node, d, l) => {
        fc.pre(showsDetail(camera, node, d));
        const moved = {
          x: node.x + l * (camera.x - node.x),
          y: node.y + l * (camera.y - node.y),
          z: node.z + l * (camera.z - node.z),
        };
        expect(showsDetail(moved, node, d)).toBe(true);
      }),
    );
  });
});