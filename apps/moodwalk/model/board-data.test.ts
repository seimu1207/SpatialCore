import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { loadScenario, saveScenario } from "../../../core/model/scenario-io.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { loadTheme } from "../../../core/view/helpers/theme-schema.ts";
import { boardOpsArb } from "./arbitraries.ts";
import { BUNDLED } from "./bundled.ts";
import { crossReferenceErrors, loadBoardData, type BoardData, type RawBoardData } from "./board-data.ts";
import { routeFootprints, slotPosition } from "./layout.ts";
import { analyzeMood } from "./mood.ts";
import { EFFECT_SAME_MOOD, EFFECT_SUDDEN_BRIGHTENING } from "./names.ts";
import { SAMPLE_RECIPES, samplePixels } from "./sample-images.ts";
import { checkMood, type MoodReport } from "./shift-check.ts";

function loaded(): BoardData {
  const r = loadBoardData(BUNDLED);
  if (!r.ok) throw new Error("bundle must load");
  return r.data;
}

function copy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe("loadBoardData", () => {
  it("loads the bundled files and the cross references hold (01.3, 14.5)", () => {
    const r = loadBoardData(BUNDLED);
    expect(r.ok).toBe(true);
    expect(crossReferenceErrors(loaded())).toEqual([]);
  });

  it("names the broken file for each of the four files and does not throw (01.4)", () => {
    const cases: [string, RawBoardData][] = [
      ["scenario", { ...BUNDLED, scenarioText: "{ not json" }],
      ["rules", { ...BUNDLED, rules: { nope: true } }],
      ["settings", { ...BUNDLED, settings: { shiftThreshold: -1 } }],
      ["theme", { ...BUNDLED, theme: 42 }],
    ];
    for (const [file, raw] of cases) {
      const r = loadBoardData(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.length).toBeGreaterThan(0);
        expect(r.errors.some((e) => e.file === file)).toBe(true);
      }
    }
  });
});

describe("crossReferenceErrors", () => {
  it("names a missing recipe", () => {
    const data = copy(loaded());
    const node = data.scenario.nodes[0];
    if (node === undefined) throw new Error("no node");
    node.front.image = "sample:unknown-recipe";
    expect(crossReferenceErrors(data).some((e) => e.path.endsWith("front.image"))).toBe(true);
  });

  it("names a missing attribute", () => {
    const data = copy(loaded());
    const node = data.scenario.nodes[0];
    if (node === undefined) throw new Error("no node");
    delete node.attributes["temperature"];
    expect(crossReferenceErrors(data).some((e) => e.path.endsWith("attributes.temperature"))).toBe(true);
  });

  it("names an Effect_Kind without a fog style", () => {
    const data = copy(loaded());
    delete data.theme.effects["same-mood-fog"];
    expect(crossReferenceErrors(data).some((e) => e.message.includes("same-mood-fog"))).toBe(true);
  });
});

type DemoNode = {
  zone: string;
  position: { x: number; y: number; z: number };
  front: { image: string; text: { en?: string; ja?: string } };
  attributes: { brightness: number; temperature: number };
};
type DemoFile = {
  title: { en: string; ja: string };
  zones: { id: string; order: number; elevation: number; label: { en?: string; ja?: string } }[];
  nodes: DemoNode[];
};

// Design "Demo_Board" target table: zone -> [brightness, temperature].
const TARGETS: Record<string, readonly [number, number]> = {
  entrance: [0.35, 0.0],
  corridor: [0.22, -0.12],
  classroom: [0.21, -0.13],
  "music-room": [0.2, -0.12],
  "rest-corner": [0.55, 0.22],
  basement: [0.08, -0.18],
  exit: [0.6, 0.1],
};

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

function demoReport(marks: string[]): MoodReport {
  const data = loaded();
  const r = checkMood(data.scenario, data.settings, marks, data.rules);
  if (!r.ok) throw new Error("demo board must check");
  return r.value;
}

describe("Demo_Board example tests (R-APP2-13)", () => {
  const file = JSON.parse(BUNDLED.scenarioText) as DemoFile;

  it("has the title, zones, and images of the plan (13.1, 13.2, 2.3)", () => {
    expect(file.title.en).toBe("School festival haunted house plan");
    expect(file.zones.length).toBeGreaterThanOrEqual(5);
    expect(file.nodes.length).toBeGreaterThanOrEqual(8);
    for (const z of file.zones) {
      expect(file.nodes.some((n) => n.zone === z.id)).toBe(true);
      expect(z.label.en?.length ?? 0).toBeGreaterThan(0);
      expect(z.label.ja?.length ?? 0).toBeGreaterThan(0);
    }
    for (const n of file.nodes) {
      expect(n.front.text.en?.length ?? 0).toBeGreaterThan(0);
      expect(n.front.text.ja?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("places the first nodes of each Zone in slots 0 and 1 (3.3, 4.7)", () => {
    const footprints = routeFootprints(file.zones as never);
    for (const zone of file.zones) {
      const fp = footprints.find((f) => f.id === zone.id);
      if (fp === undefined) throw new Error("footprint");
      const inZone = file.nodes.filter((n) => n.zone === zone.id);
      inZone.slice(0, 2).forEach((n, i) => {
        expect(n.position).toStrictEqual(slotPosition(fp, zone.elevation, i));
      });
    }
  });

  it("brightness rises midway and is lowest just before the Exit (13.3)", () => {
    const curve = demoReport([]).curve;
    const b = curve.attributes.find((a) => a.attribute === "brightness")?.series ?? [];
    const v = (id: string): number => b.find((s) => s.zone === id)?.value ?? Number.NaN;
    expect(v("rest-corner")).toBeGreaterThan(v("music-room"));
    const min = Math.min(...b.map((s) => s.value));
    expect(v("basement")).toBe(min);
    expect(b[b.length - 2]?.zone).toBe("basement");
  });

  it("Zone means are within 0.01 of the target table (13.3)", () => {
    for (const [zone, [tb, tt]] of Object.entries(TARGETS)) {
      const inZone = file.nodes.filter((n) => n.zone === zone);
      expect(inZone.length).toBeGreaterThan(0);
      expect(Math.abs(mean(inZone.map((n) => n.attributes.brightness)) - tb)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(mean(inZone.map((n) => n.attributes.temperature)) - tt)).toBeLessThanOrEqual(0.01);
    }
  });

  it("flags exactly the five Zones and requests the five effects (13.4, 9.5)", () => {
    const report = demoReport([]);
    const got = report.flags.map((f) => `${f.zone}:${f.reason.kind}`).sort();
    expect(got).toEqual(
      [
        "corridor:same-mood-too-long",
        "classroom:same-mood-too-long",
        "music-room:same-mood-too-long",
        "rest-corner:sudden-brightening",
        "exit:sudden-brightening",
      ].sort(),
    );
    const effects = report.effects.map((e) => `${e.effect}:${e.target.kind}:${e.target.id}`).sort();
    expect(effects).toEqual(
      [
        "same-mood-fog:zone:corridor",
        "same-mood-fog:zone:classroom",
        "same-mood-fog:zone:music-room",
        "sudden-brightening-fog:zone:rest-corner",
        "sudden-brightening-fog:zone:exit",
      ].sort(),
    );
    expect(report.effects).toHaveLength(5);
  });

  it("stored attributes equal the analyzer output of the recipes (13.5, 16.4)", () => {
    for (const n of file.nodes) {
      const ref = n.front.image.replace(/^sample:/, "");
      const recipe = SAMPLE_RECIPES.find((r) => r.id === ref);
      if (recipe === undefined) throw new Error(`recipe ${ref}`);
      const m = analyzeMood(samplePixels(recipe));
      if (!m.ok) throw new Error("analysis");
      expect(Math.abs(n.attributes.brightness - m.value.brightness)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(n.attributes.temperature - m.value.temperature)).toBeLessThanOrEqual(1e-9);
    }
  });

  it("the Scenario_File is at most 16,384 bytes (13.8)", () => {
    expect(new TextEncoder().encode(BUNDLED.scenarioText).length).toBeLessThanOrEqual(16384);
  });

  it("the Theme loads and both Effect_Kinds have a fog style (9.5)", () => {
    expect(loadTheme(BUNDLED.theme).ok).toBe(true);
    const theme = loaded().theme;
    expect(theme.effects[EFFECT_SUDDEN_BRIGHTENING]?.style).toBe("fog");
    expect(theme.effects[EFFECT_SAME_MOOD]?.style).toBe("fog");
  });

  it("marking rest-corner removes its flag (10.2, 10.4)", () => {
    const report = demoReport(["rest-corner"]);
    expect(report.flags.some((f) => f.zone === "rest-corner")).toBe(false);
    expect(report.flags.some((f) => f.zone === "exit")).toBe(true);
    expect(report.effects.some((e) => e.target.id === "rest-corner")).toBe(false);
  });
});

function expectRoundTrip(board: Scenario): void {
  const saved = saveScenario(board);
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  const again = loadScenario(saved.text);
  expect(again.ok).toBe(true);
  if (!again.ok) return;
  expect(again.scenario).toStrictEqual(board);
  // the saver takes the Scenario only, so Board_Settings and marks cannot change the text
  expect(saveScenario.length).toBe(1);
  const second = saveScenario(again.scenario);
  expect(second.ok && second.text).toBe(saved.text);

  const zoneIds = board.zones.map((z) => z.id);
  const nodeIds = board.nodes.map((n) => n.id);
  expect(new Set(zoneIds).size).toBe(zoneIds.length);
  expect(new Set(nodeIds).size).toBe(nodeIds.length);
  for (const n of board.nodes) {
    if (n.type === "image") expect(zoneIds).toContain(n.zone);
  }
  expect(board.edges).toHaveLength(0);
  expect(board.zones.length).toBeGreaterThanOrEqual(2);
  expect(new Set(board.zones.map((z) => z.order)).size).toBe(board.zones.length);
}

describe("P-APP2-9 save then load leaves the board unchanged", () => {
  it("round trips the Demo_Board", () => {
    expectRoundTrip(loaded().scenario);
  });

  // Feature: app-moodwalk, Property 9: Save then load leaves the board unchanged
  // **Validates: Requirements 2.1, 2.2, 2.3, 3.1, 13.7**
  it("P-APP2-9 holds for every board the App can produce", () => {
    fc.assert(
      fc.property(boardOpsArb, (board) => {
        expectRoundTrip(board);
      }),
      { numRuns: 200 },
    );
  });
});
