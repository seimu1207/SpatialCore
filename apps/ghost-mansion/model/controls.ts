// Which panel controls are shown and enabled (design.md "Controls"). Pure; reads its argument only.

import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { isKeyEdge } from "./commands.ts";
import { ATTRIBUTES, EDGE_TYPES, NODE_TYPES, ROBOT_ID } from "./names.ts";
import type { Phase } from "./phase.ts";

export const CONTROL_IDS = [
  "back",
  "preset",
  "next",
  "toPrepare",
  "startNight",
  "toLookBack",
  "keyPlain",
  "keyBell",
  "keyNone",
  "dontRead",
  "connectSource",
  "stopRobot",
  "cutKey",
  "consult",
  "cancel",
  "undo",
  "redo",
  "replay",
  "prepareAgain",
  "startOver",
] as const;

export type ControlId = (typeof CONTROL_IDS)[number];

export type ControlState = { shown: boolean; enabled: boolean };

/** Structurally the Core_View Selection (no import from `core/view`). */
export type ControlsSelection = { kind: "node" | "edge"; id: string } | null;

export type ControlsInput = {
  phase: Phase;
  selection: ControlsSelection;
  scenario: Scenario;
  connectOn: boolean;
  sampleShown: number;
  preconditionCount: number;
  replaying: boolean;
  /** Fallback_F1 in effect: "connect source" is hidden (R-APP1-23.1). Absent means off. */
  fallbackF1?: boolean;
};

/** A control is enabled only when shown. */
function ctl(shown: boolean, enabled = true): ControlState {
  return { shown, enabled: shown && enabled };
}

export function controlsFor(s: ControlsInput): Record<ControlId, ControlState> {
  const { phase, selection, scenario } = s;
  const editable = phase === "prepare" || phase === "fixIt";
  const selectedEdge =
    selection?.kind === "edge" ? scenario.edges.find((e) => e.id === selection.id) : undefined;
  const keySelected = selectedEdge !== undefined && isKeyEdge(selectedEdge);
  const selectedNode = selection?.kind === "node" ? scenario.nodes.find((n) => n.id === selection.id) : undefined;
  const readable =
    selectedNode !== undefined &&
    selectedNode.type === NODE_TYPES.text &&
    scenario.edges.some((e) => e.type === EDGE_TYPES.reads && e.from === ROBOT_ID && e.to === selectedNode.id);
  const robot = scenario.nodes.find((n) => n.id === ROBOT_ID);
  const robotSelectedRunning =
    selectedNode !== undefined &&
    selectedNode.id === ROBOT_ID &&
    robot !== undefined &&
    !((robot.attributes[ATTRIBUTES.stopped] ?? 0) >= 1);
  const prepare = phase === "prepare";
  const fixIt = phase === "fixIt";
  const allShown = s.sampleShown >= s.preconditionCount;

  return {
    back: ctl(true),
    preset: ctl(true),
    next: ctl(phase === "sample", !allShown),
    toPrepare: ctl(phase === "sample", allShown),
    startNight: ctl(prepare),
    toLookBack: ctl(fixIt),
    keyPlain: ctl(prepare, keySelected),
    keyBell: ctl(prepare, keySelected),
    keyNone: ctl(prepare, keySelected),
    dontRead: ctl(prepare, readable),
    connectSource: ctl(prepare && s.fallbackF1 !== true),
    stopRobot: ctl(fixIt, robotSelectedRunning),
    cutKey: ctl(fixIt, keySelected),
    consult: ctl(fixIt),
    cancel: ctl(editable && s.connectOn),
    undo: ctl(editable),
    redo: ctl(editable),
    replay: ctl(phase === "lookBack", !s.replaying),
    prepareAgain: ctl(phase === "lookBack"),
    startOver: ctl(prepare),
  };
}
