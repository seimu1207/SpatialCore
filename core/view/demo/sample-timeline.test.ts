import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cursorEffects, createCursor, seekStep } from "../../model/timeline.ts";
import { validateScenario } from "../../model/scenario-schema.ts";
import { buildZoneWaypoints } from "../helpers/camera-path.ts";
import { checkLinkedTimeline } from "../helpers/link.ts";
import { loadViewSettings } from "../helpers/settings-schema.ts";
import { SAMPLE_SETTINGS } from "./sample-settings.ts";
import { buildDemoTimeline } from "./sample-timeline.ts";

const parsed: unknown = JSON.parse(readFileSync(new URL("./sample-scenario.json", import.meta.url), "utf8"));

describe("demo Timeline", () => {
  const scenario = validateScenario(parsed);
  const settings = loadViewSettings(SAMPLE_SETTINGS);

  it("passes the Link_Conditions and carries a haze request per Zone", () => {
    expect(scenario.ok && settings.ok).toBe(true);
    if (!scenario.ok || !settings.ok) return;
    const timeline = buildDemoTimeline(scenario.scenario);
    expect(timeline.ok).toBe(true);
    if (!timeline.ok) return;

    const built = buildZoneWaypoints(scenario.scenario, settings.settings.zoneFootprints, 1.6);
    const path = settings.settings.paths[0];
    expect(path).toBeDefined();
    if (path === undefined) return;
    expect(checkLinkedTimeline(path, built, timeline.value)).toEqual([]);

    expect(timeline.value.steps.map((s) => s.effects)).toEqual(
      ["area-a", "area-b", "area-c"].map((id) => [
        { effect: "haze", target: { kind: "zone", id }, source: "demo" },
      ]),
    );

    const cursor = createCursor(timeline.value);
    expect(cursor.ok).toBe(true);
    if (!cursor.ok) return;
    const last = seekStep(cursor.value, 2);
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    const effects = cursorEffects(last.value);
    expect(effects.ok && effects.value.upToCurrent).toHaveLength(3);
  });
});
