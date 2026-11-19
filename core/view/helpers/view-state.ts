import type { TimelineCursor } from "../../model/rule-schema.ts";
import { nextStep } from "../../model/timeline.ts";
import { poseAt, tweenPose, waypointMarks } from "./camera-path.ts";
import type { CameraPose, ViewSettings } from "./settings-schema.ts";

/** Length of a ViewPreset move in seconds (D8, R-VIEW-08.2). */
export const TRANSITION_SECONDS = 0.6;

export type WalkState = "idle" | "playing" | "paused" | "finished";

export type TimelinePlayback = {
  cursor: TimelineCursor;
  mode: "paced" | "linked";
  status: "running" | "paused" | "ended";
  sinceMove: number;
};

/** The selected Node or Edge; a Node and an Edge are never selected together (R-VIEW-23.1). */
export type Selection = { kind: "node" | "edge"; id: string } | null;

export type ViewState = {
  activePresetId: string;
  /** The preset whose Visibility_Filter is applied. */
  shownPresetId: string;
  transition: { from: CameraPose; to: CameraPose; elapsed: number } | null;
  walk: {
    state: WalkState;
    waypoints: CameraPose[];
    marks: number[];
    duration: number;
    time: number;
    progress: number;
    reported: WalkState;
  };
  timeline: TimelinePlayback | null;
  selection: Selection;
  gizmoMode: "rotate" | "scale";
  connect: { edgeType: string; first: string | null } | null;
  editMode: "view" | "edit";
  stepDuration: number;
  /** A pose to set once (start, end of a move, after walkStop). Cleared by `cameraApplied`. */
  cameraOnce: CameraPose | null;
  /** Events of the last action, flushed by the frame driver. */
  outbox: ViewEvent[];
};

export type ViewEvent =
  | { kind: "walk"; state: WalkState; progress: number }
  | { kind: "timelinePosition"; position: number }
  | { kind: "timelineEnd" }
  | { kind: "connect"; from: string; to: string; edgeType: string }
  | { kind: "selection"; selection: Selection };

export type ViewAction =
  | { type: "setPreset"; id: string; pose: CameraPose; from: CameraPose }
  | { type: "tick"; dt: number }
  | { type: "walkStart"; waypoints: CameraPose[]; duration: number; linked: TimelineCursor | null }
  | { type: "walkPause" }
  | { type: "walkResume" }
  | { type: "walkStop"; presetPose: CameraPose }
  | { type: "timelineStart"; cursor: TimelineCursor }
  | { type: "timelinePause" }
  | { type: "timelineResume" }
  | { type: "timelineStop" }
  | { type: "select"; selection: Selection }
  | { type: "setGizmoMode"; mode: "rotate" | "scale" }
  | { type: "connectOn"; edgeType: string }
  | { type: "connectOff" }
  | { type: "connectClick"; id: string | null }
  | { type: "setEditMode"; mode: "view" | "edit" }
  | {
      type: "modelChanged";
      nodeIds: string[];
      visibleNodeIds: string[];
      edgeIds: string[];
      visibleEdgeIds: string[];
    }
  | { type: "cameraApplied" };

function copyPose(p: CameraPose): CameraPose {
  return {
    position: { x: p.position.x, y: p.position.y, z: p.position.z },
    target: { x: p.target.x, y: p.target.y, z: p.target.z },
  };
}

export function initialViewState(settings: ViewSettings): ViewState {
  const first = settings.presets[0];
  return {
    activePresetId: first.id,
    shownPresetId: first.id,
    transition: null,
    walk: {
      state: "idle",
      waypoints: [],
      marks: [],
      duration: 0,
      time: 0,
      progress: 0,
      reported: "idle",
    },
    timeline: null,
    selection: null,
    gizmoMode: "rotate",
    connect: null,
    editMode: settings.editMode,
    stepDuration: settings.stepDuration,
    cameraOnce: copyPose(first.pose),
    outbox: [],
  };
}

function setPreset(
  state: ViewState,
  action: Extract<ViewAction, { type: "setPreset" }>,
): ViewState {
  const { walk } = state;
  if (walk.state === "playing" || walk.state === "paused") {
    return { ...state, activePresetId: action.id, shownPresetId: action.id, outbox: [] };
  }
  return {
    ...state,
    walk: walk.state === "finished" ? { ...walk, state: "idle" } : walk,
    activePresetId: action.id,
    transition: { from: copyPose(action.from), to: copyPose(action.pose), elapsed: 0 },
    cameraOnce: null,
    outbox: [],
  };
}

/** Advances a running ViewPreset move. */
function tickTransition(state: ViewState, dt: number): ViewState {
  const tr = state.transition;
  if (tr === null) return state;
  const elapsed = tr.elapsed + dt;
  if (elapsed >= TRANSITION_SECONDS) {
    return {
      ...state,
      transition: null,
      shownPresetId: state.activePresetId,
      cameraOnce: copyPose(tr.to),
    };
  }
  return { ...state, transition: { ...tr, elapsed } };
}

/** Advances the playing time of a `playing` walk and finishes it at the Walk_Duration (R-VIEW-17.3, 17.5). */
function tickWalk(state: ViewState, dt: number): ViewState {
  const { walk } = state;
  if (walk.state !== "playing") return state;
  const time = walk.time + dt;
  if (!(walk.duration > 0) || time >= walk.duration) {
    return { ...state, walk: { ...walk, time, progress: 1, state: "finished" } };
  }
  return { ...state, walk: { ...walk, time, progress: Math.min(1, time / walk.duration) } };
}

/** D9: one walk event per tick at most. A state change wins over a progress event. */
function walkEvent(state: ViewState): { state: ViewState; event: ViewEvent | null } {
  const { walk } = state;
  if (walk.state !== walk.reported) {
    return {
      state: { ...state, walk: { ...walk, reported: walk.state } },
      event: { kind: "walk", state: walk.state, progress: walk.progress },
    };
  }
  if (walk.state === "playing") {
    return { state, event: { kind: "walk", state: "playing", progress: walk.progress } };
  }
  return { state, event: null };
}

function lastPosition(cursor: TimelineCursor): number {
  return cursor.timeline.steps.length - 1;
}

/** One `nextStep`; the cursor stays unchanged if the model rejects it. */
function advance(tl: TimelinePlayback): TimelinePlayback {
  const r = nextStep(tl.cursor);
  return r.ok ? { ...tl, cursor: r.value } : tl;
}

/** Timeline part of `tick` (R-VIEW-18.3, 18.5, 18.10). Appends events to `events`. */
function tickTimeline(state: ViewState, dt: number, events: ViewEvent[]): ViewState {
  const tl = state.timeline;
  if (tl === null || tl.status !== "running") return state;
  const last = lastPosition(tl.cursor);
  let cur = tl;
  if (tl.mode === "linked") {
    const { walk } = state;
    if (walk.state === "playing" || walk.state === "finished") {
      while (cur.cursor.position < last && walk.marks[cur.cursor.position + 1] <= walk.progress) {
        const moved = advance(cur);
        if (moved === cur) break;
        cur = moved;
        events.push({ kind: "timelinePosition", position: cur.cursor.position });
      }
    }
    if (walk.state === "finished") {
      cur = { ...cur, status: "ended" };
      events.push({ kind: "timelineEnd" });
    }
    return cur === tl ? state : { ...state, timeline: cur };
  }
  cur = { ...cur, sinceMove: cur.sinceMove + dt };
  while (cur.status === "running" && cur.sinceMove >= state.stepDuration) {
    if (cur.cursor.position < last) {
      const moved = advance(cur);
      if (moved === cur) break;
      cur = { ...moved, sinceMove: cur.sinceMove - state.stepDuration };
      events.push({ kind: "timelinePosition", position: cur.cursor.position });
    } else {
      cur = { ...cur, status: "ended" };
      events.push({ kind: "timelineEnd" });
    }
  }
  return { ...state, timeline: cur };
}

function tick(state: ViewState, rawDt: number): ViewState {
  const dt = Number.isFinite(rawDt) && rawDt > 0 ? rawDt : 0;
  const walked = tickWalk(tickTransition(state, dt), dt);
  const events: ViewEvent[] = [];
  const timed = tickTimeline(walked, dt, events);
  const reported = walkEvent(timed);
  if (reported.event !== null) events.push(reported.event);
  // An idle tick (no move, no walk, no Timeline, nothing to report, nothing queued) returns the same object, so the
  // store makes no new snapshot and no subscriber redraws (design.md D17).
  if (reported.state === state && events.length === 0 && state.outbox.length === 0) return state;
  return { ...reported.state, outbox: events };
}

function walkStart(
  state: ViewState,
  action: Extract<ViewAction, { type: "walkStart" }>,
): ViewState {
  const keepTimeline = state.timeline !== null && state.timeline.mode === "paced";
  const base: ViewState = {
    ...state,
    walk: {
      ...state.walk,
      state: "playing",
      waypoints: action.waypoints.map(copyPose),
      marks: waypointMarks(action.waypoints),
      duration: action.duration,
      time: 0,
      progress: 0,
    },
    transition: null,
    shownPresetId: state.activePresetId,
    cameraOnce: null,
    timeline: keepTimeline ? state.timeline : null,
    outbox: [],
  };
  if (action.linked === null) return base;
  return {
    ...base,
    timeline: { cursor: action.linked, mode: "linked", status: "running", sinceMove: 0 },
    outbox: [{ kind: "timelinePosition", position: 0 }],
  };
}

function setLinkedStatus(state: ViewState, from: "running" | "paused", to: "running" | "paused") {
  const tl = state.timeline;
  if (tl === null || tl.mode !== "linked" || tl.status !== from) return state.timeline;
  return { ...tl, status: to };
}

function walkPause(state: ViewState): ViewState {
  if (state.walk.state !== "playing") return { ...state, outbox: [] };
  return {
    ...state,
    walk: { ...state.walk, state: "paused" },
    timeline: setLinkedStatus(state, "running", "paused"),
    outbox: [],
  };
}

function walkResume(state: ViewState): ViewState {
  if (state.walk.state !== "paused") return { ...state, outbox: [] };
  return {
    ...state,
    walk: { ...state.walk, state: "playing" },
    timeline: setLinkedStatus(state, "paused", "running"),
    outbox: [],
  };
}

function walkStop(
  state: ViewState,
  action: Extract<ViewAction, { type: "walkStop" }>,
): ViewState {
  const s = state.walk.state;
  if (s !== "playing" && s !== "paused" && s !== "finished") return { ...state, outbox: [] };
  return {
    ...state,
    walk: { ...state.walk, state: "idle" },
    timeline: state.timeline !== null && state.timeline.mode === "linked" ? null : state.timeline,
    cameraOnce: copyPose(action.presetPose),
    outbox: [],
  };
}

function linkedWalkActive(state: ViewState): boolean {
  const { timeline, walk } = state;
  return (
    timeline !== null &&
    timeline.mode === "linked" &&
    (walk.state === "playing" || walk.state === "paused")
  );
}

function timelineStart(state: ViewState, cursor: TimelineCursor): ViewState {
  return {
    ...state,
    timeline: { cursor, mode: "paced", status: "running", sinceMove: 0 },
    outbox: [{ kind: "timelinePosition", position: 0 }],
  };
}

function timelineSetStatus(
  state: ViewState,
  from: "running" | "paused",
  to: "running" | "paused",
): ViewState {
  const tl = state.timeline;
  if (tl === null || tl.status !== from || linkedWalkActive(state)) return { ...state, outbox: [] };
  return { ...state, timeline: { ...tl, status: to }, outbox: [] };
}

/** True when both Selections are `null` or have the same `kind` and `id`. */
function sameSelection(a: Selection, b: Selection): boolean {
  if (a === null || b === null) return a === b;
  return a.kind === b.kind && a.id === b.id;
}

/**
 * `select(null)` clears in every state; a Node or Edge Selection is ignored in `view` mode or while connect is on.
 * An unchanged Selection returns the same state object (with an empty outbox, as for every non-tick action).
 */
function select(state: ViewState, selection: Selection): ViewState {
  if (selection !== null && (state.editMode !== "edit" || state.connect !== null)) {
    return { ...state, outbox: [] };
  }
  if (sameSelection(state.selection, selection)) return state.outbox.length === 0 ? state : { ...state, outbox: [] };
  return { ...state, selection: selection === null ? null : { kind: selection.kind, id: selection.id }, outbox: [] };
}

/** R-VIEW-15.2: turning connect on again cancels a pending connection and uses the new type. */
function connectOn(state: ViewState, edgeType: string): ViewState {
  return { ...state, connect: { edgeType, first: null }, outbox: [] };
}

function connectClick(state: ViewState, id: string | null): ViewState {
  const { connect } = state;
  if (state.editMode !== "edit" || connect === null) return { ...state, outbox: [] };
  if (id === null || connect.first === id) {
    return { ...state, connect: { ...connect, first: null }, outbox: [] };
  }
  if (connect.first === null) {
    return { ...state, connect: { ...connect, first: id }, outbox: [] };
  }
  return {
    ...state,
    connect: { ...connect, first: null },
    outbox: [{ kind: "connect", from: connect.first, to: id, edgeType: connect.edgeType }],
  };
}

function setEditMode(state: ViewState, mode: "view" | "edit"): ViewState {
  if (mode === "edit") return { ...state, editMode: mode, outbox: [] };
  return {
    ...state,
    editMode: mode,
    selection: null,
    connect: state.connect === null ? null : { ...state.connect, first: null },
    outbox: [],
  };
}

function modelChanged(
  state: ViewState,
  action: Extract<ViewAction, { type: "modelChanged" }>,
): ViewState {
  const present = new Set(action.nodeIds);
  const visible = new Set(action.visibleNodeIds);
  const alive = (id: string | null): boolean => id !== null && present.has(id) && visible.has(id);
  const sel = state.selection;
  const selAlive =
    sel === null
      ? false
      : sel.kind === "node"
        ? alive(sel.id)
        : action.edgeIds.includes(sel.id) && action.visibleEdgeIds.includes(sel.id);
  const connect =
    state.connect !== null && state.connect.first !== null && !alive(state.connect.first)
      ? { ...state.connect, first: null }
      : state.connect;
  return {
    ...state,
    selection: selAlive ? state.selection : null,
    connect,
    outbox: [],
  };
}

function reduceInner(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "setPreset":
      return setPreset(state, action);
    case "tick":
      return tick(state, action.dt);
    case "walkStart":
      return walkStart(state, action);
    case "walkPause":
      return walkPause(state);
    case "walkResume":
      return walkResume(state);
    case "walkStop":
      return walkStop(state, action);
    case "timelineStart":
      return timelineStart(state, action.cursor);
    case "timelinePause":
      return timelineSetStatus(state, "running", "paused");
    case "timelineResume":
      return timelineSetStatus(state, "paused", "running");
    case "timelineStop":
      return { ...state, timeline: null, outbox: [] };
    case "select":
      return select(state, action.selection);
    case "setGizmoMode":
      return { ...state, gizmoMode: action.mode, outbox: [] };
    case "connectOn":
      return connectOn(state, action.edgeType);
    case "connectOff":
      return { ...state, connect: null, outbox: [] };
    case "connectClick":
      return connectClick(state, action.id);
    case "setEditMode":
      return setEditMode(state, action.mode);
    case "modelChanged":
      return modelChanged(state, action);
    case "cameraApplied":
      return { ...state, cameraOnce: null, outbox: [] };
    default:
      return { ...state, outbox: [] };
  }
}
/** One place appends a `selection` event for every change or clear of the Selection (R-VIEW-22.2 to 22.4). */
export function reduceViewState(state: ViewState, action: ViewAction): ViewState {
  const next = reduceInner(state, action);
  if (sameSelection(state.selection, next.selection)) return next;
  return { ...next, outbox: [...next.outbox, { kind: "selection", selection: next.selection }] };
}

/** The pose the frame driver sets this frame, or `null` when the user controls the camera. */
export function cameraFor(state: ViewState): CameraPose | null {
  const tr = state.transition;
  if (tr !== null) return tweenPose(tr.from, tr.to, tr.elapsed / TRANSITION_SECONDS);
  const { walk } = state;
  if (walk.state === "playing" || walk.state === "paused" || walk.state === "finished") {
    const r = poseAt(walk.waypoints, walk.progress);
    if (r.ok) return r.pose;
  }
  return state.cameraOnce === null ? null : copyPose(state.cameraOnce);
}

/** Orbit controls are on only when nothing else moves the camera and no Gesture is active. */
export function orbitAllowed(state: ViewState, gestureActive: boolean): boolean {
  return state.transition === null && state.walk.state === "idle" && !gestureActive;
}
