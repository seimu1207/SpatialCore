import { describe, expect, it } from "vitest";
import { analyzeMood } from "./mood.ts";
import { SAMPLE_HEIGHT, SAMPLE_RECIPES, SAMPLE_WIDTH, samplePixels } from "./sample-images.ts";
import scenarioRaw from "../scenarios/school-festival-haunted-house.json?raw";

type DemoNode = { zone: string; front: { image: string }; attributes: { brightness: number; temperature: number } };

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

const nodes = (JSON.parse(scenarioRaw) as { nodes: DemoNode[] }).nodes;

function analyzed(id: string) {
  const recipe = SAMPLE_RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`no recipe ${id}`);
  const m = analyzeMood(samplePixels(recipe));
  if (!m.ok) throw new Error(`analysis failed for ${id}`);
  return m.value;
}

describe("sample recipes", () => {
  it("every recipe is 64 x 48, opaque, with channels in 0..255", () => {
    expect(SAMPLE_RECIPES).toHaveLength(10);
    for (const r of SAMPLE_RECIPES) {
      const p = samplePixels(r);
      expect(p.width).toBe(SAMPLE_WIDTH);
      expect(p.height).toBe(SAMPLE_HEIGHT);
      expect(p.data.length).toBe(4 * SAMPLE_WIDTH * SAMPLE_HEIGHT);
      let bad = 0;
      for (let i = 0; i < p.data.length; i++) {
        const v = p.data[i];
        if (!Number.isInteger(v) || v < 0 || v > 255 || (i % 4 === 3 && v !== 255)) bad++;
      }
      expect(bad).toBe(0);
    }
  });

  it("is deterministic and has unique ids", () => {
    for (const r of SAMPLE_RECIPES) expect(samplePixels(r)).toStrictEqual(samplePixels(r));
    expect(new Set(SAMPLE_RECIPES.map((r) => r.id)).size).toBe(SAMPLE_RECIPES.length);
  });

  it("Zone means are within 0.01 of the design targets", () => {
    for (const [zone, [tb, tt]] of Object.entries(TARGETS)) {
      const inZone = nodes.filter((n) => n.zone === zone);
      expect(inZone.length).toBeGreaterThan(0);
      const vals = inZone.map((n) => analyzed(n.front.image.replace("sample:", "")));
      const mb = vals.reduce((s, v) => s + v.brightness, 0) / vals.length;
      const mt = vals.reduce((s, v) => s + v.temperature, 0) / vals.length;
      expect(Math.abs(mb - tb)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(mt - tt)).toBeLessThanOrEqual(0.01);
    }
  });

  it("Demo_Board file values equal the analyzer output", () => {
    expect(nodes).toHaveLength(10);
    for (const n of nodes) {
      const v = analyzed(n.front.image.replace("sample:", ""));
      expect(Math.abs(n.attributes.brightness - v.brightness)).toBeLessThan(1e-9);
      expect(Math.abs(n.attributes.temperature - v.temperature)).toBeLessThan(1e-9);
    }
  });
});
