// Action_Log (R-APP1-16.5, 16.6, 19.5, 19.8). Derived from a History; pure, never throws, no writes.
import type { History } from "../../../core/model/history.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { isKeyEdge } from "./commands.ts";
import { ATTRIBUTES, EDGE_TYPES, NODE_TYPES, RESPONSE_OPS, ROBOT_ID } from "./names.ts";

export type ResponseOp = "stop-robot" | "cut-key" | "consult";

function isStopped(s: Scenario): boolean {
  const robot = s.nodes.find((n) => n.id === ROBOT_ID);
  const v = robot?.attributes[ATTRIBUTES.stopped];
  return v !== undefined && v >= 1;
}

/** Response_Operations that happen between two Scenarios, in the order stop-robot, cut-key, consult, each once. */
export function classifyPair(before: Scenario, after: Scenario): ResponseOp[] {
  const ops: ResponseOp[] = [];
  if (!isStopped(before) && isStopped(after)) ops.push(RESPONSE_OPS.stopRobot);

  const afterEdgeIds = new Set(after.edges.map((e) => e.id));
  if (before.edges.some((e) => isKeyEdge(e) && !afterEdgeIds.has(e.id))) ops.push(RESPONSE_OPS.cutKey);

  const beforeEdgeIds = new Set(before.edges.map((e) => e.id));
  const helperIds = new Set(after.nodes.filter((n) => n.type === NODE_TYPES.helper).map((n) => n.id));
  if (after.edges.some((e) => e.type === EDGE_TYPES.consult && helperIds.has(e.to) && !beforeEdgeIds.has(e.id))) {
    ops.push(RESPONSE_OPS.consult);
  }
  return ops;
}

/** Structural equality of plain JSON data. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  if (ak.length !== Object.keys(bo).length) return false;
  return ak.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]));
}

/** The Response_Operations done since `nightStart`, in order, from `[...past, present]`. */
export function deriveActionLog(nightStart: Scenario, history: History): ResponseOp[] {
  const seq = [...history.past, history.present];
  const first = seq[0];
  const log: ResponseOp[] = [];
  if (first !== undefined && !deepEqual(first, nightStart)) log.push(...classifyPair(nightStart, first));
  for (let i = 0; i + 1 < seq.length; i++) {
    const a = seq[i];
    const b = seq[i + 1];
    if (a !== undefined && b !== undefined) log.push(...classifyPair(a, b));
  }
  return log;
}
