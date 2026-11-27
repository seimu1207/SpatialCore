import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sortUniqueEffects } from "../../../core/model/effects.ts";
import { loadRuleDefinition } from "../../../core/model/rule-schema.ts";
import { loadScenario } from "../../../core/model/scenario-io.ts";
import type { EffectRequest } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { createTimeline } from "../../../core/model/timeline.ts";
import { buildZoneWaypoints } from "../../../core/view/helpers/camera-path.ts";
import { checkLinkedTimeline } from "../../../core/view/helpers/link.ts";
import scenarioRaw from "../scenarios/school-festival-haunted-house.json?raw";
import rulesJson from "../rules/mood-rules.json" with { type: "json" };
import settingsJson from "../rules/board-settings.json" with { type: "json" };
import { boardArb, marksArb } from "./arbitraries.ts";
import { loadBoardSettings } from "./board-settings.ts";
import { routeFootprints } from "./layout.ts";
import { checkMood } from "./shift-check.ts";
import { canWalk, linkedTimeline } from "./walk.ts";

const loaded = loadScenario(scenarioRaw);
if (!loaded.ok) throw new Error("the Demo_Board did not load");
const demo: Scenario = loaded.scenario;

const effects = [
  { effect: "fog", target: { kind: "zone", id: "z-b" }, source: "r2" },
  { effect: "fog", target: { kind: "zone", id: "z-a" }, source: "r1" },
] as unknown as EffectRequest[];

function withZones(n: number): Scenario {
  return { ...demo, zones: demo.zones.slice(0, n), nodes: [], edges: [] };
}

describe("linkedTimeline", () => {
  it("gives 7 steps for the Demo_Board with the effects on step 0 only", () => {
    const r = linkedTimeline(demo, effects);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps).toHaveLength(7);
    expect(r.value.steps[0].effects).toHaveLength(2);
    expect(r.value.steps[0].effects?.[0]).toStrictEqual(effects[1]);
    for (const step of r.value.steps.slice(1)) expect(step.effects ?? []).toStrictEqual([]);
    expect(createTimeline(r.value.steps).ok).toBe(true);
  });

  it("passes checkLinkedTimeline against the route waypoints", () => {
    const r = linkedTimeline(demo, effects);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const built = buildZoneWaypoints(demo, routeFootprints(demo.zones), 1.5);
    expect(checkLinkedTimeline({ id: "route", fromZones: { height: 1.5 } }, built, r.value)).toStrictEqual([]);
  });

  it("is deterministic and does not write to its arguments", () => {
    const before = JSON.stringify(demo);
    const list = [...effects];
    expect(linkedTimeline(demo, list)).toStrictEqual(linkedTimeline(demo, list));
    expect(JSON.stringify(demo)).toBe(before);
    expect(list).toStrictEqual(effects);
  });
});

describe("canWalk", () => {
  it("is true for the Demo_Board with all footprints", () => {
    expect(canWalk(demo, routeFootprints(demo.zones))).toBe(true);
  });

  it("is false for 1 Zone", () => {
    const one = withZones(1);
    expect(canWalk(one, routeFootprints(one.zones))).toBe(false);
  });

  it("is false when a Zone has no footprint", () => {
    expect(canWalk(demo, routeFootprints(demo.zones).slice(1))).toBe(false);
  });
});

const loadedRules = loadRuleDefinition(rulesJson);
const loadedSettings = loadBoardSettings(settingsJson);
if (!loadedRules.ok || !loadedSettings.ok) throw new Error("bundled rules or settings did not load");
const moodRules = loadedRules.value;
const boardSettings = loadedSettings.settings;

describe("P-APP2-11 walkthrough link holds", () => {
  // Feature: app-moodwalk, Property 11: P-APP2-11 walkthrough link holds
  // **Validates: Requirements 9.13, 12.2, 12.3, 12.12**
  it("P-APP2-11 the Linked_Timeline meets every Link_Condition for any Board with at least 2 Zones", () => {
    fc.assert(
      fc.property(
        boardArb.chain((board) => marksArb(board.zones).map((marks) => ({ board, marks }))),
        ({ board, marks }) => {
          const mood = checkMood(board, boardSettings, marks, moodRules);
          expect(mood.ok).toBe(true);
          if (!mood.ok) return;
          const effects = mood.value.effects;
          expect(board.zones.length).toBeGreaterThanOrEqual(2);

          const r = linkedTimeline(board, effects);
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          const timeline = r.value;
          expect(createTimeline(timeline.steps).ok).toBe(true);

          const ranked = [...board.zones].sort((a, b) => a.order - b.order);
          const built = buildZoneWaypoints(board, routeFootprints(board.zones), 1.5);
          expect(checkLinkedTimeline({ id: "route", fromZones: { height: 1.5 } }, built, timeline)).toStrictEqual([]);

          expect(timeline.steps).toHaveLength(ranked.length);
          const sorted = sortUniqueEffects(effects);
          timeline.steps.forEach((step, i) => {
            expect(step.targets).toStrictEqual([{ kind: "zone", id: ranked[i].id }]);
            expect(step.effects ?? []).toStrictEqual(i === 0 ? sorted : []);
          });

          const copy = structuredClone({ board, effects });
          expect(linkedTimeline(copy.board, copy.effects)).toStrictEqual(r);
        },
      ),
      { numRuns: 100 },
    );
  });
});