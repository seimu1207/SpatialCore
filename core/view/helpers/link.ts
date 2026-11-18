import { createCursor } from "../../model/timeline.ts";
import type { Timeline } from "../../model/rule-schema.ts";
import type { ValidationError } from "../../model/scenario-schema.ts";
import type { ZoneWaypoints } from "./camera-path.ts";
import type { CameraPath } from "./settings-schema.ts";

/**
 * Checks the Link_Conditions of a Linked_Timeline (R-VIEW-17.11, 17.12). Returns `[]` when all hold.
 * Steps are matched to Waypoints by index only. Never throws.
 */
export function checkLinkedTimeline(
  path: CameraPath,
  built: ZoneWaypoints,
  timeline: unknown,
): ValidationError[] {
  try {
    if (path.fromZones === undefined) {
      return [{ path: "timeline", message: "a linked timeline needs a camera path built from zones" }];
    }
    const cursor = createCursor(timeline as Timeline);
    if (!cursor.ok) return cursor.errors;
    if (!built.ok) {
      return [{ path: "timeline", message: "the camera path could not be built from zones" }];
    }
    const steps = cursor.value.timeline.steps;
    const errors: ValidationError[] = [];
    if (steps.length !== built.waypoints.length) {
      errors.push({
        path: "timeline.steps",
        message: `expected ${built.waypoints.length} steps, one per waypoint`,
      });
    }
    const n = Math.min(steps.length, built.waypoints.length);
    for (let i = 0; i < n; i++) {
      const expected = built.zones[i];
      const targets = steps[i].targets;
      const ok = targets.length === 1 && targets[0].kind === "zone" && targets[0].id === expected;
      if (!ok) {
        errors.push({
          path: `timeline.steps.${i}.targets`,
          message: `expected one zone target ${expected}`,
        });
      }
    }
    return errors;
  } catch {
    return [{ path: "timeline", message: "invalid linked timeline" }];
  }
}
