import { sortUniqueEffects } from "../../../core/model/effects.ts";
import { createTimeline } from "../../../core/model/timeline.ts";
import type { EffectRequest, EffectTarget, RuleOutcome, Timeline, TimelineStep } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { jobFocusEffects } from "./effects.ts";
import type { RobotJobs } from "./game-data.ts";
import type { NightResult } from "./judge.ts";
import { ROBOT_ID } from "./names.ts";

/** One step per Step_Number of the damage spread (R-APP1-15.3). Empty when there is no verdict. */
export function damageSteps(night: NightResult): TimelineStep[] {
  if (!night.verdict) return [];
  const reached = night.propagation.reached;
  let max = 0;
  for (const r of reached) if (r.step > max) max = r.step;

  const steps: TimelineStep[] = [];
  for (let n = 1; n <= max; n += 1) {
    const here = reached.filter((r) => r.step === n);
    const nodes = new Set(here.map((r) => r.node));
    const edges = new Set(here.flatMap((r) => (r.via === undefined ? [] : [r.via])));
    const effects = night.damageEffects.filter(
      (e) => (e.target.kind === "node" && nodes.has(e.target.id)) || (e.target.kind === "edge" && edges.has(e.target.id)),
    );
    steps.push({
      id: `damage-${n}`,
      label: { en: `Damage spreads: step ${n}`, ja: `被害が広がる：${n}段目` },
      targets: [],
      effects: sortUniqueEffects(effects),
    });
  }
  return steps;
}

function withFirstEffects(steps: TimelineStep[], extra: readonly EffectRequest[]): TimelineStep[] {
  return steps.map((s, i) => (i === 0 ? { ...s, effects: sortUniqueEffects([...s.effects, ...extra]) } : s));
}

/** The Sample replay: the damage steps with the highlights and the fog on the first step (R-APP1-13.4). */
export function sampleTimeline(sampleNight: NightResult, highlights: EffectRequest[]): RuleOutcome<Timeline> {
  return createTimeline(withFirstEffects(damageSteps(sampleNight), [...highlights, ...sampleNight.fog]));
}

/** The Robot_Job whose `reads` Node holds a Hidden_Text (a `front.detail`), if any. */
export function findHiddenJobId(s: Scenario, jobs: RobotJobs): string | undefined {
  return jobs.jobs.find((job) => {
    if (job.reads === undefined) return false;
    return s.nodes.find((n) => n.id === job.reads)?.front?.detail !== undefined;
  })?.id;
}

function jobSteps(nightStart: Scenario, night: NightResult, jobs: RobotJobs, hiddenJobId: string): TimelineStep[] {
  return jobs.jobs.map((job, i) => {
    const targets: EffectTarget[] = [
      { kind: "node", id: ROBOT_ID },
      { kind: "node", id: job.room },
    ];
    if (job.reads !== undefined) targets.push({ kind: "node", id: job.reads });
    const effects: EffectRequest[] = [...jobFocusEffects(nightStart, job)];
    if (i === 0) effects.push(...night.fog);
    if (job.id === hiddenJobId && night.verdict) effects.push(...night.bellStops);
    return { id: `job-${job.id}`, label: job.label, targets, effects: sortUniqueEffects(effects) };
  });
}

/** The Ghost Night replay: one step per job, then the damage steps (R-APP1-15.1 to 15.3). */
export function nightTimeline(
  nightStart: Scenario,
  night: NightResult,
  jobs: RobotJobs,
  hiddenJobId: string,
): RuleOutcome<Timeline> {
  return createTimeline([...jobSteps(nightStart, night, jobs, hiddenJobId), ...damageSteps(night)]);
}

/** The first `jobs.length + 1` steps of the night Timeline (R-APP1-16.9). */
export function fixReplayTimeline(
  nightStart: Scenario,
  night: NightResult,
  jobs: RobotJobs,
  hiddenJobId: string,
): RuleOutcome<Timeline> {
  const all = [...jobSteps(nightStart, night, jobs, hiddenJobId), ...damageSteps(night)];
  return createTimeline(all.slice(0, jobs.jobs.length + 1));
}
