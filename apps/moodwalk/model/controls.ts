/** Which Route_Controls are enabled, and the standing status hint under "Start walkthrough" (design.md "Controls"). */

export type ControlId =
  | "addImages"
  | "addZone"
  | "removeZone"
  | "removeImage"
  | "rotateMode"
  | "scaleMode"
  | "undo"
  | "redo"
  | "settings"
  | "mark"
  | "overview"
  | "visitor"
  | "start"
  | "pause"
  | "resume"
  | "stop";

export type ControlWalkState = "idle" | "playing" | "paused" | "finished";

export type ControlsInput = {
  walk: ControlWalkState;
  busy: boolean;
  /** Number of undo steps (`past` length). */
  past: number;
  /** Number of redo steps (`future` length). */
  future: number;
  /** A Node is selected. */
  hasSelection: boolean;
  /** `canWalk(scenario, footprints)` of the current Board. */
  canWalk: boolean;
  /** Number of Route_Zones. */
  zoneCount: number;
};

export type StatusText = { en: string; ja: string };

export const CONTROL_IDS: readonly ControlId[] = [
  "addImages",
  "addZone",
  "removeZone",
  "removeImage",
  "rotateMode",
  "scaleMode",
  "undo",
  "redo",
  "settings",
  "mark",
  "overview",
  "visitor",
  "start",
  "pause",
  "resume",
  "stop",
];

export const HINT_EDITING_LOCKED: StatusText = {
  en: "The board cannot be edited during a walkthrough.",
  ja: "ウォークスルー中はボードを編集できません。",
};
export const HINT_NEEDS_TWO_ZONES: StatusText = {
  en: "The walkthrough needs at least 2 zones.",
  ja: "ウォークスルーには2つ以上のゾーンが必要です。",
};
export const HINT_NEEDS_FOOTPRINTS: StatusText = {
  en: "The walkthrough needs a floor area for every zone.",
  ja: "ウォークスルーにはすべてのゾーンの床面が必要です。",
};

function walking(state: ControlsInput): boolean {
  return state.walk === "playing" || state.walk === "paused";
}

export function controlsFor(state: ControlsInput): Record<ControlId, boolean> {
  const editable = !walking(state) && !state.busy;
  return {
    addImages: editable,
    addZone: editable,
    removeZone: editable,
    removeImage: editable && state.hasSelection,
    rotateMode: editable,
    scaleMode: editable,
    undo: editable && state.past > 0,
    redo: editable && state.future > 0,
    settings: editable,
    mark: editable,
    overview: true,
    visitor: true,
    start: editable && state.canWalk,
    pause: state.walk === "playing",
    resume: state.walk === "paused",
    stop: state.walk === "playing" || state.walk === "paused" || state.walk === "finished",
  };
}

export function statusFor(state: ControlsInput): StatusText | null {
  if (walking(state)) return HINT_EDITING_LOCKED;
  if (!state.canWalk) {
    return state.zoneCount < 2 ? HINT_NEEDS_TWO_ZONES : HINT_NEEDS_FOOTPRINTS;
  }
  return null;
}
