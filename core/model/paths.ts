import {
  addUnresolved,
  buildIndex,
  matchSelector,
  passesFilter,
  prepareFilter,
  sortedIds,
} from "./graph-index.ts";
import { checkRules, checkScenario, combine, guard, parseArg, rejectSelf } from "./rule-input.ts";
import {
  edgeFilterSchema,
  nodeSelectorSchema,
  nonNegativeInteger,
  type EdgeFilter,
  type NodeSelector,
  type PropagationResult,
  type RuleDefinition,
  type RuleOutcome,
} from "./rule-schema.ts";
import { nonBlank, type Scenario } from "./scenario-schema.ts";

/**
 * Nodes reachable by a Path of one or more passing Edges from the picked start Nodes.
 * A start Node is listed only when a Path leads back to it. Result is in `nodes` order.
 */
export function findReachable(
  scenario: Scenario,
  start: NodeSelector,
  edges: EdgeFilter,
): RuleOutcome<{ nodes: string[]; unresolved: string[] }> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const sel = parseArg(nodeSelectorSchema, start, "start");
    const filter = parseArg(edgeFilterSchema, edges, "edges");
    if (!sc.ok || !sel.ok || !filter.ok) return { ok: false, errors: combine(sc, sel, filter) };
    const selfErrors = rejectSelf(sel.value, "start");
    if (selfErrors.length > 0) return { ok: false, errors: selfErrors };

    const g = buildIndex(sc.value);
    const prepared = prepareFilter(filter.value);
    const picked = matchSelector(g, sel.value);
    const visited: boolean[] = g.nodes.map(() => false);
    const queue: number[] = [];
    const expand = (nodeIdx: number): void => {
      for (const edgeIdx of g.out[nodeIdx] ?? []) {
        const e = g.edges[edgeIdx];
        if (e === undefined || !passesFilter(prepared, e.type)) continue;
        const to = g.nodeIndex.get(e.to);
        if (to === undefined || visited[to]) continue;
        visited[to] = true;
        queue.push(to);
      }
    };
    picked.forEach((isStart, i) => {
      if (isStart) expand(i);
    });
    for (let head = 0; head < queue.length; head += 1) {
      expand(queue[head]);
    }

    const unresolved = new Set<string>();
    addUnresolved(g, sel.value, unresolved);
    return {
      ok: true,
      value: {
        nodes: g.nodes.filter((_, i) => visited[i]).map((n) => n.id),
        unresolved: sortedIds(unresolved),
      },
    };
  });
}

/**
 * Shortest Path (list of Edge ids) from `from` to `to` over passing Edges, or `null`.
 * Ties follow the visiting order: Nodes by level, out-Edges in `edges` order.
 * When `from === to`, the shortest cycle through that Node; never an empty Path.
 */
export function findPath(
  scenario: Scenario,
  from: string,
  to: string,
  edges: EdgeFilter,
): RuleOutcome<{ path: string[] | null; unresolved: string[] }> {
  return guard<{ path: string[] | null; unresolved: string[] }>(() => {
    const sc = checkScenario(scenario);
    const fromArg = parseArg(nonBlank, from, "from");
    const toArg = parseArg(nonBlank, to, "to");
    const filter = parseArg(edgeFilterSchema, edges, "edges");
    if (!sc.ok || !fromArg.ok || !toArg.ok || !filter.ok) {
      return { ok: false, errors: combine(sc, fromArg, toArg, filter) };
    }

    const g = buildIndex(sc.value);
    const start = g.nodeIndex.get(fromArg.value);
    const end = g.nodeIndex.get(toArg.value);
    if (start === undefined || end === undefined) {
      const missing: string[] = [];
      if (start === undefined) missing.push(fromArg.value);
      if (end === undefined) missing.push(toArg.value);
      return { ok: true, value: { path: null, unresolved: sortedIds(missing) } };
    }

    const prepared = prepareFilter(filter.value);
    const parent = new Map<number, number>();
    const queue: number[] = [start];
    const pathTo = (node: number, last: number): string[] => {
      const reversed: number[] = [last];
      let cur = node;
      while (cur !== start) {
        const e = parent.get(cur) as number;
        reversed.push(e);
        cur = g.nodeIndex.get((g.edges[e] as { from: string }).from) as number;
      }
      return reversed.reverse().map((i) => (g.edges[i] as { id: string }).id);
    };

    for (let head = 0; head < queue.length; head += 1) {
      const u = queue[head];
      for (const edgeIdx of g.out[u] ?? []) {
        const e = g.edges[edgeIdx];
        if (e === undefined || !passesFilter(prepared, e.type)) continue;
        const v = g.nodeIndex.get(e.to);
        if (v === undefined) continue;
        if (v === end) return { ok: true, value: { path: pathTo(u, edgeIdx), unresolved: [] } };
        if (v !== start && !parent.has(v)) {
          parent.set(v, edgeIdx);
          queue.push(v);
        }
      }
    }
    return { ok: true, value: { path: null, unresolved: [] } };
  });
}

/**
 * Automatic propagation from the picked seeds over Edges whose type is in `rules.propagation.pass`.
 * Level by level, Edges in `edges` order; each Node gets its shortest step once.
 * `stopped` lists Edges of a `stop` type whose `from` is reached. Nodes at `maxSteps` are not expanded.
 */
export function propagate(
  scenario: Scenario,
  rules: RuleDefinition,
  seeds: NodeSelector,
  maxSteps?: number,
): RuleOutcome<PropagationResult> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const def = checkRules(rules);
    const sel = parseArg(nodeSelectorSchema, seeds, "seeds");
    const limit = maxSteps === undefined ? undefined : parseArg(nonNegativeInteger, maxSteps, "maxSteps");
    if (!sc.ok || !def.ok || !sel.ok || (limit !== undefined && !limit.ok)) {
      return { ok: false, errors: combine(sc, def, sel, ...(limit === undefined ? [] : [limit])) };
    }
    const selfErrors = rejectSelf(sel.value, "seeds");
    if (selfErrors.length > 0) return { ok: false, errors: selfErrors };

    const g = buildIndex(sc.value);
    const pass = new Set(def.value.propagation.pass);
    const stop = new Set(def.value.propagation.stop);
    const max = limit === undefined ? undefined : limit.value;
    const step = new Map<number, number>();
    const via = new Map<number, number>();
    let level: number[] = [];
    matchSelector(g, sel.value).forEach((isSeed, i) => {
      if (isSeed) {
        step.set(i, 0);
        level.push(i);
      }
    });
    const reached: number[] = [...level];
    const traversed: number[] = [];
    for (let k = 0; level.length > 0 && (max === undefined || k < max); k += 1) {
      const next: number[] = [];
      for (const u of level) {
        for (const edgeIdx of g.out[u] ?? []) {
          const e = g.edges[edgeIdx];
          if (e === undefined || !pass.has(e.type)) continue;
          const v = g.nodeIndex.get(e.to);
          if (v === undefined || step.has(v)) continue;
          step.set(v, k + 1);
          via.set(v, edgeIdx);
          next.push(v);
          traversed.push(edgeIdx);
        }
      }
      reached.push(...next);
      level = next;
    }

    const stopped: string[] = [];
    g.edges.forEach((e) => {
      const from = g.nodeIndex.get(e.from);
      if (stop.has(e.type) && from !== undefined && step.has(from)) stopped.push(e.id);
    });
    const unresolved = new Set<string>();
    addUnresolved(g, sel.value, unresolved);
    return {
      ok: true,
      value: {
        reached: reached.map((n) => {
          const edgeIdx = via.get(n);
          const node = (g.nodes[n] as { id: string }).id;
          const s = step.get(n) as number;
          return edgeIdx === undefined
            ? { node, step: s }
            : { node, step: s, via: (g.edges[edgeIdx] as { id: string }).id };
        }),
        traversed: traversed.map((i) => (g.edges[i] as { id: string }).id),
        stopped,
        unresolved: sortedIds(unresolved),
      },
    };
  });
}