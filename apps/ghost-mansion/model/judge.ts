import { evaluateCheckSets, evaluateNodeRules } from "../../../core/model/conditions.ts";
import { buildEffects } from "../../../core/model/effects.ts";
import { propagate } from "../../../core/model/paths.ts";
import type { EffectRequest, PropagationResult, RuleDefinition, RuleOutcome } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { sumAttribute } from "../../../core/model/series.ts";
import { bellStopEffects, withoutRobot } from "./effects.ts";
import type { Flags } from "./fallback.ts";
import type { GameData, RobotJobs, StarTable } from "./game-data.ts";
import { ATTRIBUTES, CHECK_SET_IDS, EDGE_TYPES, EFFECT_KINDS, ROBOT_ID } from "./names.ts";

export type { Flags };

export type MansionJudgement = {
  preconditions: { id: string; holds: boolean }[];
  verdict: boolean;
  jobs: { id: string; holds: boolean }[];
  propagation: PropagationResult;
  reachSet: string[];
  reachScore: number;
  convenience: number;
  fog: EffectRequest[];
};

export type NightResult = MansionJudgement & {
  damageSet: string[];
  damageScore: number;
  stars: number;
  damageEffects: EffectRequest[];
  bellStops: EffectRequest[];
};

/** Convenience_Score (R-APP1-09.3 to 09.5). */
export function convenienceScore(
  s: Scenario,
  jobs: RobotJobs,
  jobResults: readonly { id: string; holds: boolean }[],
): number {
  let total = 0;
  for (const job of jobs.jobs) {
    if (jobResults.find((r) => r.id === job.id)?.holds !== true) continue;
    const toRoom = s.edges.filter((e) => e.from === ROBOT_ID && e.to === job.room);
    if (toRoom.some((e) => e.type === EDGE_TYPES.plainKey)) total += jobs.weights.plain;
    else if (toRoom.some((e) => e.type === EDGE_TYPES.bellKey)) total += jobs.weights.bell;
  }
  return total;
}

/** First matching Star_Table rule, else the default (R-APP1-10.2 to 10.4). Total. */
export function starsFor(table: StarTable, c: number, d: number): number {
  for (const rule of table.rules) {
    if (c >= rule.minConvenience && d <= rule.maxDamage) return rule.stars;
  }
  return table.defaultStars;
}

export function judgeMansion(
  s: Scenario,
  data: GameData,
  attackRules: RuleDefinition,
  flags: Flags,
): RuleOutcome<MansionJudgement> {
  const checks = evaluateCheckSets(s, attackRules);
  if (!checks.ok) return checks;
  const attack = checks.value.find((c) => c.id === CHECK_SET_IDS.attack);
  const jobsCheck = checks.value.find((c) => c.id === CHECK_SET_IDS.jobs);
  const preconditions = attack?.items ?? [];
  const verdict = attack?.allHold ?? false;
  const jobs = jobsCheck?.items ?? [];

  const propagation = propagate(s, attackRules, { ids: [ROBOT_ID] }, flags.f2 ? 1 : undefined);
  if (!propagation.ok) return propagation;

  const reachSet = propagation.value.reached.map((r) => r.node).filter((id) => id !== ROBOT_ID);
  const sum = sumAttribute(s, { ids: reachSet }, ATTRIBUTES.importance);
  if (!sum.ok) return sum;
  const reachScore = reachSet.length === 0 ? 0 : sum.value.sum;

  const convenience = convenienceScore(s, data.jobs, jobs);

  let fog: EffectRequest[] = [];
  if (!flags.f1) {
    const nodeRules = evaluateNodeRules(s, data.rules);
    if (!nodeRules.ok) return nodeRules;
    const effects = buildEffects(s, data.rules, { nodeRules: nodeRules.value });
    if (!effects.ok) return effects;
    fog = effects.value.filter((e) => e.effect === EFFECT_KINDS.unsourcedFog);
  }

  return {
    ok: true,
    value: {
      preconditions: preconditions.map((p) => ({ id: p.id, holds: p.holds })),
      verdict,
      jobs: jobs.map((j) => ({ id: j.id, holds: j.holds })),
      propagation: propagation.value,
      reachSet,
      reachScore,
      convenience,
      fog,
    },
  };
}

export function judgeNight(
  s: Scenario,
  data: GameData,
  attackRules: RuleDefinition,
  flags: Flags,
): RuleOutcome<NightResult> {
  const m = judgeMansion(s, data, attackRules, flags);
  if (!m.ok) return m;
  const j = m.value;

  const damageSet = j.verdict ? j.reachSet : [];
  const damageScore = j.verdict ? j.reachScore : 0;

  let damageEffects: EffectRequest[] = [];
  if (j.verdict) {
    const built = buildEffects(s, data.rules, { propagation: j.propagation });
    if (!built.ok) return built;
    damageEffects = withoutRobot(built.value.filter((e) => e.effect === EFFECT_KINDS.damage));
  }
  const bellStops = j.verdict ? bellStopEffects(j.propagation.stopped) : [];
  const stars = starsFor(data.starTable, j.convenience, damageScore);

  return { ok: true, value: { ...j, damageSet, damageScore, stars, damageEffects, bellStops } };
}

/** The Prepare display values (R-APP1-09.6): no verdict is used. */
export function prepareStatus(j: Pick<MansionJudgement, "convenience" | "reachScore">): {
  convenience: number;
  reachScore: number;
} {
  return { convenience: j.convenience, reachScore: j.reachScore };
}
