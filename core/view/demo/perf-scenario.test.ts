import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateScenario } from "../../model/scenario-schema.ts";
import { loadViewSettings } from "../helpers/settings-schema.ts";
import { frameTimes, median } from "./perf-overlay.ts";
import { buildPerfScenario, buildPerfSettings, PERF_IMAGE_REFS } from "./perf-scenario.ts";

describe("perf scenario", () => {
  it("passes validateScenario with 50 image Nodes, 60 Edges, 5 Zones", () => {
    const scenario = buildPerfScenario();
    expect(validateScenario(scenario).ok).toBe(true);
    expect(scenario.nodes.filter((n) => n.type === "image")).toHaveLength(50);
    expect(scenario.edges).toHaveLength(60);
    expect(scenario.zones).toHaveLength(5);
    expect(scenario.zones.filter((z) => z.enclosed)).toHaveLength(1);
  });

  it("uses each of 10 images for 5 Nodes", () => {
    const counts = new Map<string, number>();
    for (const n of buildPerfScenario().nodes) {
      const ref = n.front.image ?? "";
      counts.set(ref, (counts.get(ref) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...PERF_IMAGE_REFS].sort());
    expect([...counts.values()].every((c) => c === 5)).toBe(true);
  });

  it("is deterministic and has valid settings with 4 rect and 1 ring footprints", () => {
    expect(buildPerfScenario()).toEqual(buildPerfScenario());
    const loaded = loadViewSettings(buildPerfSettings());
    expect(loaded.ok).toBe(true);
    const kinds = buildPerfSettings().zoneFootprints.map((f) => f.kind);
    expect(kinds.filter((k) => k === "rect")).toHaveLength(4);
    expect(kinds.filter((k) => k === "ring")).toHaveLength(1);
  });

  it("has 10 self-contained SVG files with a 1024 x 768 viewBox and no text", () => {
    for (const ref of PERF_IMAGE_REFS) {
      const svg = readFileSync(new URL(ref.replace("images/", "./images/"), import.meta.url), "utf8");
      expect(svg).toContain('viewBox="0 0 1024 768"');
      expect(svg).not.toMatch(/<text|href=|<image|<script|https?:\/\/(?!www\.w3\.org)/);
    }
  });
});

describe("perf overlay math", () => {
  it("computes the median and frame times", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
    expect(frameTimes([0, 16, 33])).toEqual([16, 17]);
  });
});
