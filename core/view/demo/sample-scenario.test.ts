import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadScenario, saveScenario } from "../../model/scenario-io.ts";
import { validateScenario } from "../../model/scenario-schema.ts";
import { buildZoneWaypoints } from "../helpers/camera-path.ts";
import { loadViewSettings } from "../helpers/settings-schema.ts";
import { loadTheme } from "../helpers/theme-schema.ts";
import { missingZoneRefs } from "../helpers/zone-refs.ts";
import { SAMPLE_SETTINGS, SAMPLE_THEME } from "./sample-settings.ts";

const text = readFileSync(new URL("./sample-scenario.json", import.meta.url), "utf8");
const parsed: unknown = JSON.parse(text);

describe("Sample_Scenario", () => {
  it("passes validateScenario with the described shape", () => {
    const result = validateScenario(parsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.scenario;
    expect(s.zones.map((z) => [z.id, z.order, z.elevation, z.enclosed])).toEqual([
      ["area-a", 0, 0, false],
      ["area-b", 1, 0.5, true],
      ["area-c", 2, 1, false],
    ]);
    expect(s.nodes).toHaveLength(8);
    expect(new Set(s.nodes.map((n) => n.type))).toEqual(new Set(["card", "note"]));
    expect(s.nodes.filter((n) => n.front.detail !== undefined)).toHaveLength(2);
    expect(s.nodes.filter((n) => n.zone === undefined)).toHaveLength(1);
    expect(s.edges).toHaveLength(7);
    expect(s.edges.some((e) => e.from === e.to)).toBe(true);
    const keys = s.edges.map((e) => `${e.from}>${e.to}`);
    expect(new Set(keys).size).toBeLessThan(keys.length);
  });

  it("is in the saved format", () => {
    const loaded = loadScenario(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const saved = saveScenario(loaded.scenario);
    expect(saved.ok && saved.text).toBe(text);
  });

  it("has settings and a Theme that pass their loaders", () => {
    const settings = loadViewSettings(SAMPLE_SETTINGS);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.settings.presets.length).toBeGreaterThanOrEqual(2);
      const [a, b] = settings.settings.presets;
      expect(a?.pose).not.toEqual(b?.pose);
    }
    expect(loadTheme(SAMPLE_THEME).ok).toBe(true);
  });

  it("has no missing zone references and builds zone waypoints", () => {
    const scenario = validateScenario(parsed);
    const settings = loadViewSettings(SAMPLE_SETTINGS);
    expect(scenario.ok && settings.ok).toBe(true);
    if (!scenario.ok || !settings.ok) return;
    expect(missingZoneRefs(settings.settings, scenario.scenario)).toEqual([]);
    const path = buildZoneWaypoints(scenario.scenario, settings.settings.zoneFootprints, 1.6);
    expect(path.ok).toBe(true);
  });
});
