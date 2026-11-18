import { buildIndex, type GraphIndex } from "./graph-index.ts";
import { compareCodePoints } from "./json.ts";
import { checkRules, checkScenario, combine, guard, parseArg } from "./rule-input.ts";
import {
  judgementResultsSchema,
  type EffectRequest,
  type EffectTarget,
  type JudgementResults,
  type RuleDefinition,
  type RuleOutcome,
} from "./rule-schema.ts";
import type { Scenario } from "./scenario-schema.ts";

export type { JudgementResults };

/** Orders by Effect_Kind, target kind, target id, then source, each by code point. */
export function compareEffects(a: EffectRequest, b: EffectRequest): number {
  return (
    compareCodePoints(a.effect, b.effect) ||
    compareCodePoints(a.target.kind, b.target.kind) ||
    compareCodePoints(a.target.id, b.target.id) ||
    compareCodePoints(a.source, b.source)
  );
}

/** Sorted copy without repeated entries. Never writes to `list`. */
export function sortUniqueEffects(list: readonly EffectRequest[]): EffectRequest[] {
  const sorted = [...list].sort(compareEffects);
  return sorted.filter((e, i) => i === 0 || compareEffects(sorted[i - 1] ?? e, e) !== 0);
}

function targetExists(g: GraphIndex, t: EffectTarget): boolean {
  switch (t.kind) {
    case "node":
      return g.nodeIndex.has(t.id);
    case "edge":
      return g.edgeIds.has(t.id);
    case "zone":
      return g.zoneIds.has(t.id);
  }
}

function targetsFor(
  source: NonNullable<RuleDefinition["effectRules"]>[number]["source"],
  results: JudgementResults,
): EffectTarget[] {
  const targets: EffectTarget[] = [];
  switch (source.kind) {
    case "nodeRule":
      for (const r of results.nodeRules ?? []) {
        if (r.id !== source.id) continue;
        for (const id of r.nodes) targets.push({ kind: "node", id });
      }
      break;
    case "shifts":
      for (const s of results.series ?? []) {
        if (s.attribute !== source.attribute) continue;
        for (const shift of s.shifts) {
          if (!shift.intentional) targets.push({ kind: "zone", id: shift.to });
        }
      }
      break;
    case "longRuns":
      for (const s of results.series ?? []) {
        if (s.attribute !== source.attribute) continue;
        for (const run of s.longRuns) {
          for (const id of run) targets.push({ kind: "zone", id });
        }
      }
      break;
    case "propagation":
      if (results.propagation !== undefined) {
        for (const r of results.propagation.reached) targets.push({ kind: "node", id: r.node });
        for (const id of results.propagation.traversed) targets.push({ kind: "edge", id });
      }
      break;
  }
  return targets;
}

/** Turns judgement results into sorted, unique Effect_Requests. The Effect_Kind comes only from the Rule_Definition. */
export function buildEffects(
  scenario: Scenario,
  rules: RuleDefinition,
  results: JudgementResults,
): RuleOutcome<EffectRequest[]> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const rl = checkRules(rules);
    const rs = parseArg(judgementResultsSchema, results, "results");
    if (!sc.ok || !rl.ok || !rs.ok) return { ok: false, errors: combine(sc, rl, rs) };

    const g = buildIndex(sc.value);
    const requests: EffectRequest[] = [];
    for (const rule of rl.value.effectRules ?? []) {
      for (const target of targetsFor(rule.source, rs.value)) {
        if (!targetExists(g, target)) continue;
        requests.push({ effect: rule.effect, target: { kind: target.kind, id: target.id }, source: rule.id });
      }
    }
    return { ok: true, value: sortUniqueEffects(requests) };
  });
}
