import { compareCodePoints } from "./json.ts";
import { checkScenario, combine, guard, parseArg, rejectSelf } from "./rule-input.ts";
import {
  nodeSelectorSchema,
  type Condition,
  type EdgeFilter,
  type NodeSelector,
  type RuleOutcome,
} from "./rule-schema.ts";
import type { Edge, Node, Scenario, Zone } from "./scenario-schema.ts";

export type GraphIndex = {
  nodes: readonly Node[];
  edges: readonly Edge[];
  nodeIndex: ReadonlyMap<string, number>;
  zoneIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
  /** Per Node index: indexes of its outgoing Edges, in `edges` order. */
  out: readonly (readonly number[])[];
  /** Zones sorted by ascending `order`. */
  zonesByOrder: readonly Zone[];
};

/** Builds the index of a valid Scenario. Never writes to the Scenario. */
export function buildIndex(scenario: Scenario): GraphIndex {
  const nodeIndex = new Map<string, number>();
  scenario.nodes.forEach((n, i) => {
    nodeIndex.set(n.id, i);
  });
  const out: number[][] = scenario.nodes.map(() => []);
  scenario.edges.forEach((e, i) => {
    const from = nodeIndex.get(e.from);
    if (from !== undefined) out[from]?.push(i);
  });
  return {
    nodes: scenario.nodes,
    edges: scenario.edges,
    nodeIndex,
    zoneIds: new Set(scenario.zones.map((z) => z.id)),
    edgeIds: new Set(scenario.edges.map((e) => e.id)),
    out,
    zonesByOrder: [...scenario.zones].sort((a, b) => a.order - b.order),
  };
}

/** One flag per Node, in `nodes` order. Absent field matches all; an empty list matches none. */
export function matchSelector(g: GraphIndex, s: NodeSelector, self?: number): boolean[] {
  const ids = s.ids === undefined ? undefined : new Set(s.ids);
  const types = s.types === undefined ? undefined : new Set(s.types);
  const zones = s.zones === undefined ? undefined : new Set(s.zones);
  return g.nodes.map((n, i) => {
    if (ids && !ids.has(n.id)) return false;
    if (types && !types.has(n.type)) return false;
    if (zones && (n.zone === undefined || !zones.has(n.zone))) return false;
    if (s.self && i !== self) return false;
    return true;
  });
}

export type PreparedFilter = { include?: ReadonlySet<string>; exclude?: ReadonlySet<string> };

export function prepareFilter(f: EdgeFilter): PreparedFilter {
  const prepared: PreparedFilter = {};
  if (f.include !== undefined) prepared.include = new Set(f.include);
  if (f.exclude !== undefined) prepared.exclude = new Set(f.exclude);
  return prepared;
}

/** An empty `include` lets no Edge pass. */
export function passesFilter(f: PreparedFilter, type: string): boolean {
  return (f.include === undefined || f.include.has(type)) && !(f.exclude?.has(type) ?? false);
}

/** Adds each `ids` entry naming no Node and each `zones` entry naming no Zone. */
export function addUnresolved(g: GraphIndex, s: NodeSelector, into: Set<string>): void {
  for (const id of s.ids ?? []) {
    if (!g.nodeIndex.has(id)) into.add(id);
  }
  for (const id of s.zones ?? []) {
    if (!g.zoneIds.has(id)) into.add(id);
  }
}

/** Static walk of every Node_Selector of a Condition, whether or not evaluation needs it. */
export function addConditionUnresolved(g: GraphIndex, c: Condition, into: Set<string>): void {
  switch (c.kind) {
    case "edgeCount":
    case "reach":
      addUnresolved(g, c.from, into);
      addUnresolved(g, c.to, into);
      return;
    case "attribute":
      addUnresolved(g, c.nodes, into);
      return;
    case "all":
    case "any":
      for (const child of c.conditions) addConditionUnresolved(g, child, into);
      return;
    case "not":
      addConditionUnresolved(g, c.condition, into);
      return;
  }
}

/** Each id once, in code point order. */
export function sortedIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort(compareCodePoints);
}

/** Sums the own attribute over the picked Nodes in list order. The caller checks that the sum is finite. */
export function sumOver(
  g: GraphIndex,
  picked: readonly boolean[],
  attribute: string,
): { sum: number; count: number } {
  let sum = 0;
  let count = 0;
  g.nodes.forEach((node, i) => {
    if (!picked[i]) return;
    const attributes = node.attributes;
    if (attributes !== undefined && Object.hasOwn(attributes, attribute)) {
      sum += attributes[attribute] ?? 0;
      count += 1;
    }
  });
  return { sum, count };
}

export function selectNodes(
  scenario: Scenario,
  selector: NodeSelector,
): RuleOutcome<{ nodes: string[]; unresolved: string[] }> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const sel = parseArg(nodeSelectorSchema, selector, "selector");
    const errors = combine(sc, sel);
    if (!sc.ok || !sel.ok) return { ok: false, errors };
    const selfErrors = rejectSelf(sel.value, "selector");
    if (selfErrors.length > 0) return { ok: false, errors: selfErrors };
    const g = buildIndex(sc.value);
    const picked = matchSelector(g, sel.value);
    const unresolved = new Set<string>();
    addUnresolved(g, sel.value, unresolved);
    return {
      ok: true,
      value: {
        nodes: g.nodes.filter((_, i) => picked[i]).map((n) => n.id),
        unresolved: sortedIds(unresolved),
      },
    };
  });
}
