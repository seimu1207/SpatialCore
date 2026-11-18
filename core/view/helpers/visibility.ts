import type { Scenario } from "../../model/scenario-schema.ts";
import type { VisibilityFilter } from "./settings-schema.ts";

export type VisibleSet = { nodes: string[]; edges: string[]; zones: string[] };

function toSet(list: readonly string[] | undefined): Set<string> | null {
  return list === undefined ? null : new Set(list);
}

/**
 * Computes which Nodes, Edges, and Zones a Visibility_Filter shows (R-VIEW-07).
 * Reads only Node id/type/zone, Edge id/from/to/type, and Zone id.
 * Never throws; a value that is not a Scenario gives an empty set.
 */
export function computeVisibleSet(scenario: Scenario, filter: VisibilityFilter): VisibleSet {
  try {
    const zoneSet = toSet(filter.zones);
    const typeSet = toSet(filter.nodeTypes);
    const edgeTypeSet = toSet(filter.edgeTypes);
    const includeUnzoned = filter.includeUnzoned ?? filter.zones === undefined;

    const visibleNodes = new Set<string>();
    const nodes: string[] = [];
    for (const node of scenario.nodes) {
      const zoneOk =
        node.zone === undefined ? includeUnzoned : zoneSet === null || zoneSet.has(node.zone);
      const typeOk = typeSet === null || typeSet.has(node.type);
      if (zoneOk && typeOk) {
        visibleNodes.add(node.id);
        nodes.push(node.id);
      }
    }

    const edges: string[] = [];
    for (const edge of scenario.edges) {
      if (edgeTypeSet !== null && !edgeTypeSet.has(edge.type)) continue;
      const fromOk = visibleNodes.has(edge.from);
      const toOk = visibleNodes.has(edge.to);
      const ok = filter.edgeRule === "bothEnds" ? fromOk && toOk : fromOk || toOk;
      if (ok) edges.push(edge.id);
    }

    const zones: string[] = [];
    for (const zone of scenario.zones) {
      if (zoneSet === null || zoneSet.has(zone.id)) zones.push(zone.id);
    }

    return { nodes, edges, zones };
  } catch {
    return { nodes: [], edges: [], zones: [] };
  }
}
