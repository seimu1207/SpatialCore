import { sortUniqueEffects } from "../../../core/model/effects.ts";
import type { EffectRequest } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import type { AttackCard, RobotJobs } from "./game-data.ts";
import type { NightResult } from "./judge.ts";
import { EDGE_TYPES, EFFECT_KINDS, KEY_EDGE_TYPES, ROBOT_ID } from "./names.ts";

type RobotJob = RobotJobs["jobs"][number];

/** Highlight requests of the first `shownCount` Preconditions (R-APP1-13.3). */
export function highlightEffects(card: Pick<AttackCard, "preconditions">, shownCount: number): EffectRequest[] {
  const out: EffectRequest[] = [];
  for (const p of card.preconditions.slice(0, Math.max(0, shownCount))) {
    for (const h of p.highlight) {
      out.push({ effect: EFFECT_KINDS.highlight, target: { kind: h.kind, id: h.id }, source: p.id });
    }
  }
  return sortUniqueEffects(out);
}

/** One bell-stop request per Stopped_Edge (R-APP1-07.4). */
export function bellStopEffects(stopped: readonly string[]): EffectRequest[] {
  return sortUniqueEffects(
    stopped.map((id) => ({ effect: EFFECT_KINDS.bellStop, target: { kind: "edge" as const, id }, source: "bell-stop" })),
  );
}

/** The Key_Edges the damage traveled through, only when the night has damage (R-APP1-18.3). */
export function couldStopEffects(night: NightResult): EffectRequest[] {
  if (night.damageSet.length === 0) return [];
  const out: EffectRequest[] = [];
  for (const r of night.propagation.reached) {
    // Seeds are the robot only, so the Edges used at step 1 are the Key_Edges of the robot.
    if (r.step === 1 && r.via !== undefined) {
      out.push({ effect: EFFECT_KINDS.couldStop, target: { kind: "edge", id: r.via }, source: "could-stop" });
    }
  }
  return sortUniqueEffects(out);
}

/** The Nodes and Edges of one Robot_Job (R-APP1-15.2, 15.4). */
export function jobFocusEffects(s: Scenario, job: RobotJob): EffectRequest[] {
  const keyTypes: readonly string[] = KEY_EDGE_TYPES;
  const readTypes: readonly string[] = [EDGE_TYPES.reads, EDGE_TYPES.noRead];
  const out: EffectRequest[] = [
    { effect: EFFECT_KINDS.jobFocus, target: { kind: "node", id: ROBOT_ID }, source: job.id },
    { effect: EFFECT_KINDS.jobFocus, target: { kind: "node", id: job.room }, source: job.id },
  ];
  if (job.reads !== undefined) {
    out.push({ effect: EFFECT_KINDS.jobFocus, target: { kind: "node", id: job.reads }, source: job.id });
  }
  for (const e of s.edges) {
    if (e.from !== ROBOT_ID) continue;
    const isKey = e.to === job.room && keyTypes.includes(e.type);
    const isRead = job.reads !== undefined && e.to === job.reads && readTypes.includes(e.type);
    if (isKey || isRead) out.push({ effect: EFFECT_KINDS.jobFocus, target: { kind: "edge", id: e.id }, source: job.id });
  }
  return sortUniqueEffects(out);
}

/** `list` without the requests that target the Robot_Node (R-APP1-07.6). */
export function withoutRobot(list: readonly EffectRequest[]): EffectRequest[] {
  return list.filter((e) => !(e.target.kind === "node" && e.target.id === ROBOT_ID));
}

/** The marks of the Look Back phase (R-APP1-18.6). */
export function lookBackEffects(night: NightResult): EffectRequest[] {
  return sortUniqueEffects([...couldStopEffects(night), ...night.bellStops, ...night.fog]);
}
