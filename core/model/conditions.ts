import {
  addConditionUnresolved,
  addUnresolved,
  buildIndex,
  matchSelector,
  passesFilter,
  prepareFilter,
  sortedIds,
  sumOver,
  type GraphIndex,
} from "./graph-index.ts";
import { checkRules, checkScenario, combine, guard, parseArg, rejectSelf } from "./rule-input.ts";
import {
  conditionSchema,
  limitConditionDepth,
  type Condition,
  type NodeRuleResult,
  type NodeSelector,
  type RuleDefinition,
  type RuleOutcome,
} from "./rule-schema.ts";
import type { Scenario, ValidationError } from "./scenario-schema.ts";

export type CheckResult = {
  id: string;
  items: { id: string; holds: boolean }[];
  allHold: boolean;
  unresolved: string[];
};

function inRange(value: number, min: number | undefined, max: number | undefined): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

/** Counts Edges in list order that pass the filter and run from a `from` Node to a `to` Node. */
function countEdges(
  g: GraphIndex,
  filter: ReturnType<typeof prepareFilter>,
  fromFlags: readonly boolean[],
  toFlags: readonly boolean[],
): number {
  let count = 0;
  for (const e of g.edges) {
    if (!passesFilter(filter, e.type)) continue;
    const from = g.nodeIndex.get(e.from);
    const to = g.nodeIndex.get(e.to);
    if (from === undefined || to === undefined) continue;
    if (fromFlags[from] && toFlags[to]) count += 1;
  }
  return count;
}

/** Start Nodes are not pre-marked, so a start Node is reached only through a path back to it. */
function reaches(
  g: GraphIndex,
  filter: ReturnType<typeof prepareFilter>,
  fromFlags: readonly boolean[],
  toFlags: readonly boolean[],
): boolean {
  const visited: boolean[] = g.nodes.map(() => false);
  const queue: number[] = [];
  const expand = (nodeIdx: number): void => {
    for (const edgeIdx of g.out[nodeIdx] ?? []) {
      const e = g.edges[edgeIdx];
      if (e === undefined || !passesFilter(filter, e.type)) continue;
      const to = g.nodeIndex.get(e.to);
      if (to === undefined || visited[to]) continue;
      visited[to] = true;
      queue.push(to);
    }
  };
  fromFlags.forEach((picked, i) => {
    if (picked) expand(i);
  });
  for (let head = 0; head < queue.length; head += 1) {
    expand(queue[head]);
  }
  return visited.some((v, i) => v && toFlags[i] === true);
}

/** Evaluates every child of `all` and `any` (no short-circuit), so a failure in any branch is found. */
function evaluate(
  g: GraphIndex,
  c: Condition,
  path: string,
  self: number | undefined,
  errors: ValidationError[],
): boolean {
  switch (c.kind) {
    case "edgeCount": {
      const count = countEdges(g, prepareFilter(c.edges), matchSelector(g, c.from, self), matchSelector(g, c.to, self));
      return inRange(count, c.min, c.max);
    }
    case "reach":
      return reaches(g, prepareFilter(c.edges), matchSelector(g, c.from, self), matchSelector(g, c.to, self));
    case "attribute": {
      const { sum } = sumOver(g, matchSelector(g, c.nodes, self), c.attribute);
      if (!Number.isFinite(sum)) {
        errors.push({
          path: `${path}.attribute`,
          message: `sum of attribute ${JSON.stringify(c.attribute)} is not a finite number`,
        });
        return false;
      }
      return inRange(sum, c.min, c.max);
    }
    case "all": {
      const results = c.conditions.map((child, k) => evaluate(g, child, `${path}.conditions.${k}`, self, errors));
      return results.every(Boolean);
    }
    case "any": {
      const results = c.conditions.map((child, k) => evaluate(g, child, `${path}.conditions.${k}`, self, errors));
      return results.some(Boolean);
    }
    case "not":
      return !evaluate(g, c.condition, `${path}.condition`, self, errors);
  }
}

/** Keeps equal errors (same path and message) once, at their first position. */
function dedupeErrors(errors: readonly ValidationError[]): ValidationError[] {
  const seen = new Set<string>();
  const out: ValidationError[] = [];
  for (const e of errors) {
    const key = JSON.stringify([e.path, e.message]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Errors for every `self: true` selector inside a Condition given directly as an argument. */
function selfErrors(c: Condition, path: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const check = (selector: NodeSelector, selectorPath: string): void => {
    errors.push(...rejectSelf(selector, selectorPath));
  };
  switch (c.kind) {
    case "edgeCount":
    case "reach":
      check(c.from, `${path}.from`);
      check(c.to, `${path}.to`);
      return errors;
    case "attribute":
      check(c.nodes, `${path}.nodes`);
      return errors;
    case "all":
    case "any":
      c.conditions.forEach((child, k) => errors.push(...selfErrors(child, `${path}.conditions.${k}`)));
      return errors;
    case "not":
      return selfErrors(c.condition, `${path}.condition`);
  }
}

export function evaluateCheckSets(scenario: Scenario, rules: RuleDefinition): RuleOutcome<CheckResult[]> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const rd = checkRules(rules);
    const argErrors = combine(sc, rd);
    if (!sc.ok || !rd.ok) return { ok: false, errors: argErrors };
    const g = buildIndex(sc.value);
    const errors: ValidationError[] = [];
    const results: CheckResult[] = [];
    (rd.value.checkSets ?? []).forEach((set, s) => {
      const unresolved = new Set<string>();
      const items = set.items.map((item, i) => {
        const path = `rules.checkSets.${s}.items.${i}.condition`;
        const holds = evaluate(g, item.condition, path, undefined, errors);
        addConditionUnresolved(g, item.condition, unresolved);
        return { id: item.id, holds };
      });
      results.push({
        id: set.id,
        items,
        allHold: items.every((item) => item.holds),
        unresolved: sortedIds(unresolved),
      });
    });
    if (errors.length > 0) return { ok: false, errors: dedupeErrors(errors) };
    return { ok: true, value: results };
  });
}

export function evaluateNodeRules(scenario: Scenario, rules: RuleDefinition): RuleOutcome<NodeRuleResult[]> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const rd = checkRules(rules);
    const argErrors = combine(sc, rd);
    if (!sc.ok || !rd.ok) return { ok: false, errors: argErrors };
    const g = buildIndex(sc.value);
    const errors: ValidationError[] = [];
    const results: NodeRuleResult[] = [];
    (rd.value.nodeRules ?? []).forEach((rule, r) => {
      const path = `rules.nodeRules.${r}.condition`;
      const candidates = matchSelector(g, rule.nodes);
      const nodes: string[] = [];
      candidates.forEach((picked, i) => {
        if (!picked) return;
        if (evaluate(g, rule.condition, path, i, errors)) nodes.push(g.nodes[i].id);
      });
      const unresolved = new Set<string>();
      addUnresolved(g, rule.nodes, unresolved);
      addConditionUnresolved(g, rule.condition, unresolved);
      results.push({ id: rule.id, nodes, unresolved: sortedIds(unresolved) });
    });
    if (errors.length > 0) return { ok: false, errors: dedupeErrors(errors) };
    return { ok: true, value: results };
  });
}

export function evaluateCondition(
  scenario: Scenario,
  condition: Condition,
): RuleOutcome<{ holds: boolean; unresolved: string[] }> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const limited = limitConditionDepth(condition, "condition");
    const cond: RuleOutcome<Condition> = limited.error
      ? { ok: false, errors: [limited.error] }
      : parseArg(conditionSchema, limited.value, "condition");
    const errors = combine(sc, cond);
    if (!sc.ok || !cond.ok) return { ok: false, errors };
    const selfFound = selfErrors(cond.value, "condition");
    if (selfFound.length > 0) return { ok: false, errors: selfFound };
    const g = buildIndex(sc.value);
    const evalErrors: ValidationError[] = [];
    const holds = evaluate(g, cond.value, "condition", undefined, evalErrors);
    if (evalErrors.length > 0) return { ok: false, errors: dedupeErrors(evalErrors) };
    const unresolved = new Set<string>();
    addConditionUnresolved(g, cond.value, unresolved);
    return { ok: true, value: { holds, unresolved: sortedIds(unresolved) } };
  });
}
