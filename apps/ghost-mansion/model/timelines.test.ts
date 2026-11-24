import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { attackCheckSet, withCheckSet } from "./built-rules.ts";
import { BUNDLED } from "./bundled.ts";
import { variantArb } from "./arbitraries.ts";
import { highlightEffects, jobFocusEffects } from "./effects.ts";
import { loadGameData } from "./game-data.ts";
import type { GameData } from "./game-data.ts";
import { judgeNight } from "./judge.ts";
import type { NightResult } from "./judge.ts";
import { deriveSample } from "./sample.ts";
import { damageSteps, findHiddenJobId, fixReplayTimeline, nightTimeline, sampleTimeline } from "./timelines.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const data: GameData = loaded.data;
const preset: Scenario = data.preset;
const rules = withCheckSet(data.rules, attackCheckSet(data.attackCard));
if (!rules.ok) throw new Error("attack rules must build");
const attackRules = rules.value;
const flags = { f1: false, f2: false };

function night(s: Scenario): NightResult {
  const r = judgeNight(s, data, attackRules, flags);
  if (!r.ok) throw new Error("judgeNight failed");
  return r.value;
}

const sampleScenario = (() => {
  const r = deriveSample(preset);
  if (!r.ok) throw new Error("sample must derive");
  return r.scenario;
})();
const sampleNight = night(sampleScenario);
const presetNight = night(preset);
const hiddenJobId = findHiddenJobId(preset, data.jobs) ?? "";
const stepDuration = data.viewSettings.stepDuration;

function ok<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

describe("timelines", () => {
  it("the hidden job exists and is the last job", () => {
    expect(hiddenJobId).not.toBe("");
    expect(data.jobs.jobs[data.jobs.jobs.length - 1]?.id).toBe(hiddenJobId);
  });

  it("stays within the G9 timing bounds (20.1)", () => {
    const sample = ok(sampleTimeline(sampleNight, highlightEffects(data.attackCard, 3)));
    const ghost = ok(nightTimeline(sampleScenario, sampleNight, data.jobs, hiddenJobId));
    const fix = ok(fixReplayTimeline(sampleScenario, sampleNight, data.jobs, hiddenJobId));
    const sampleSec = sample.steps.length * stepDuration;
    const ghostSec = ghost.steps.length * stepDuration;
    const fixSec = fix.steps.length * stepDuration;
    expect(sampleSec).toBeLessThanOrEqual(15);
    expect(ghostSec).toBeLessThanOrEqual(15);
    expect(fixSec).toBeLessThanOrEqual(15);
    expect(sampleSec + ghostSec + fixSec).toBeLessThanOrEqual(35);
    const presetGhost = ok(nightTimeline(preset, presetNight, data.jobs, hiddenJobId));
    expect(presetGhost.steps.length * stepDuration).toBeLessThanOrEqual(15);
  });

  it("the Sample Timeline shows the highlights and fog on its first step (13.4)", () => {
    const highlights = highlightEffects(data.attackCard, 3);
    const sample = ok(sampleTimeline(sampleNight, highlights));
    expect(sample.steps.length).toBeGreaterThan(0);
    const first = sample.steps[0]?.effects ?? [];
    expect(highlights.length).toBeGreaterThan(0);
    for (const h of highlights) expect(first).toContainEqual(h);
    for (const f of sampleNight.fog) expect(first).toContainEqual(f);
  });

  it("the Fix It replay has four steps (16.9)", () => {
    const fix = ok(fixReplayTimeline(sampleScenario, sampleNight, data.jobs, hiddenJobId));
    expect(fix.steps).toHaveLength(data.jobs.jobs.length + 1);
    expect(fix.steps).toHaveLength(4);
  });

  it("job steps carry job-focus and the first step carries the fog (15.2)", () => {
    const t = ok(nightTimeline(preset, presetNight, data.jobs, hiddenJobId));
    data.jobs.jobs.forEach((job, i) => {
      const step = t.steps[i];
      expect(step?.id).toBe(`job-${job.id}`);
      expect(step?.effects.some((e) => e.effect === "job-focus" && e.source === job.id)).toBe(true);
    });
    for (const f of presetNight.fog) expect(t.steps[0]?.effects).toContainEqual(f);
  });

  it("damage steps are empty without a verdict", () => {
    expect(damageSteps({ ...presetNight, verdict: false })).toEqual([]);
  });

  it("a Timeline step holds no time value", () => {
    const t = ok(nightTimeline(sampleScenario, sampleNight, data.jobs, hiddenJobId));
    for (const step of t.steps) {
      expect(Object.keys(step).sort()).toEqual(["effects", "id", "label", "targets"]);
    }
  });
});

describe("night timeline properties", () => {
  // Feature: app-ghost-mansion, Property 11: night timeline shape
  it("P-APP1-11 night timeline shape", () => {
    // **Validates: Requirements 7.4, 7.6, 15.2, 15.3, 16.9**
    const jobList = data.jobs.jobs;
    const jobCount = jobList.length;
    fc.assert(
      fc.property(variantArb, (s) => {
        const n = night(s);
        const t = ok(nightTimeline(s, n, data.jobs, hiddenJobId));
        const steps = t.steps;

        // Job steps first, in order.
        jobList.forEach((job, i) => {
          const step = steps[i];
          expect(step?.id).toBe(`job-${job.id}`);
          const targets = step?.targets ?? [];
          expect(targets).toContainEqual({ kind: "node", id: "robot" });
          expect(targets).toContainEqual({ kind: "node", id: job.room });
          if (job.reads !== undefined) expect(targets).toContainEqual({ kind: "node", id: job.reads });
          const focus = (step?.effects ?? []).filter((e) => e.effect === "job-focus");
          expect(focus).toEqual(jobFocusEffects(s, job));
          expect(focus.length).toBeGreaterThan(0);
        });

        // Damage steps only with a verdict, one per Step_Number.
        const damage = steps.slice(jobCount);
        let maxStep = 0;
        for (const r of n.propagation.reached) if (r.step > maxStep) maxStep = r.step;
        expect(damage.length).toBe(n.verdict ? maxStep : 0);
        expect(damageSteps(n).length).toBe(damage.length);

        // Every damageSet Node appears in exactly one damage request, in its Step_Number step.
        const damageNodeRequests = damage.flatMap((step, idx) =>
          step.effects
            .filter((e) => e.effect === "damage" && e.target.kind === "node")
            .map((e) => ({ id: e.target.id, step: idx + 1 })),
        );
        for (const id of n.damageSet) {
          const hits = damageNodeRequests.filter((r) => r.id === id);
          expect(hits).toHaveLength(1);
          const reached = n.propagation.reached.find((r) => r.node === id);
          expect(hits[0]?.step).toBe(reached?.step);
        }
        if (!n.verdict) expect(damageNodeRequests).toEqual([]);

        // No damage request targets the robot, in the timeline or in damageEffects.
        const robotHit = (e: { effect: string; target: { kind: string; id: string } }): boolean =>
          e.effect === "damage" && e.target.kind === "node" && e.target.id === "robot";
        expect(steps.some((step) => step.effects.some(robotHit))).toBe(false);
        expect(n.damageEffects.some(robotHit)).toBe(false);

        // bell-stop only on the hidden job step and only with a verdict.
        steps.forEach((step) => {
          const bell = step.effects.filter((e) => e.effect === "bell-stop");
          if (step.id === `job-${hiddenJobId}` && n.verdict) {
            for (const b of n.bellStops) expect(bell).toContainEqual(b);
            expect(bell).toHaveLength(n.bellStops.length);
          } else {
            expect(bell).toEqual([]);
          }
        });

        // The fix replay equals the first four steps.
        const fix = ok(fixReplayTimeline(s, n, data.jobs, hiddenJobId));
        expect(fix.steps).toEqual(steps.slice(0, jobCount + 1));
      }),
      { numRuns: 100 },
    );
  });
});