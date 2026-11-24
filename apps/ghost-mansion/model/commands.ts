import type { EditCommand, SingleCommand } from "../../../core/model/commands.ts";
import type { Edge, Scenario } from "../../../core/model/scenario-schema.ts";
import { ATTRIBUTES, EDGE_TYPES, KEY_EDGE_TYPES, ROBOT_ID } from "./names.ts";

export type KeyChoice = "plain" | "bell" | "none";

/** A Key_Edge: an Edge from the robot of type plain-key or bell-key. */
export function isKeyEdge(e: Edge): boolean {
  return e.from === ROBOT_ID && (KEY_EDGE_TYPES as readonly string[]).includes(e.type);
}

/** The command that sets a Key_Edge to a Key_Choice; null when nothing changes or the Edge is not a Key_Edge. */
export function keyChoiceCommand(s: Scenario, edgeId: string, choice: KeyChoice): EditCommand | null {
  const edge = s.edges.find((e) => e.id === edgeId);
  if (edge === undefined || !isKeyEdge(edge)) return null;
  if (choice === "none") return { kind: "removeEdge", id: edgeId };
  const type = choice === "plain" ? EDGE_TYPES.plainKey : EDGE_TYPES.bellKey;
  if (edge.type === type) return null;
  return { kind: "updateEdge", id: edgeId, changes: { type } };
}

/** Marks every `reads` Edge from the robot to the text Node as `no-read`; null when there is none. */
export function dontReadCommand(s: Scenario, textNodeId: string): EditCommand | null {
  const commands: SingleCommand[] = s.edges
    .filter((e) => e.type === EDGE_TYPES.reads && e.from === ROBOT_ID && e.to === textNodeId)
    .map((e) => ({ kind: "updateEdge", id: e.id, changes: { type: EDGE_TYPES.noRead } }));
  const [first, ...rest] = commands;
  if (first === undefined) return null;
  return rest.length === 0 ? first : { kind: "batch", commands };
}

/** Stops the robot; null when it is missing or already stopped. */
export function stopRobotCommand(s: Scenario): EditCommand | null {
  const robot = s.nodes.find((n) => n.id === ROBOT_ID);
  if (robot === undefined || robot.attributes[ATTRIBUTES.stopped] === 1) return null;
  return {
    kind: "updateNode",
    id: ROBOT_ID,
    changes: { attributes: { ...robot.attributes, [ATTRIBUTES.stopped]: 1 } },
  };
}

/** Removes a Key_Edge; null for any other Edge. */
export function cutKeyCommand(s: Scenario, edgeId: string): EditCommand | null {
  const edge = s.edges.find((e) => e.id === edgeId);
  if (edge === undefined || !isKeyEdge(edge)) return null;
  return { kind: "removeEdge", id: edgeId };
}
