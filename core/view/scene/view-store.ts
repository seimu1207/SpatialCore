// Plain TypeScript: no React, three.js, Fiber, or drei import, so it runs under Vitest in Node.
import { z } from "zod";
import type { EditCommand } from "../../model/commands.ts";
import { executeCommand, redo as redoHistory, undo as undoHistory, type History } from "../../model/history.ts";
import { effectRequestSchema, type EffectRequest, type Timeline, type TimelineCursor } from "../../model/rule-schema.ts";
import { nonBlank, type ValidationError } from "../../model/scenario-schema.ts";
import { createCursor } from "../../model/timeline.ts";
import { buildZoneWaypoints, type ZoneWaypoints } from "../helpers/camera-path.ts";
import { checkLinkedTimeline } from "../helpers/link.ts";
import type { CameraPose, ViewSettings } from "../helpers/settings-schema.ts";
import { loadTheme, type Theme } from "../helpers/theme-schema.ts";
import {
  reduceViewState,
  type Selection,
  type ViewAction,
  type ViewEvent,
  type ViewState,
  type WalkState,
} from "../helpers/view-state.ts";
import { computeVisibleSet } from "../helpers/visibility.ts";
import { newlyMissingZoneRefs } from "../helpers/zone-refs.ts";

export type ErrorContext = "start" | "settings" | "theme" | "preset" | "walk" | "timeline" | "edit" | "effects";
export type EditReport =
  | { kind: "history"; history: History }
  | { kind: "errors"; context: ErrorContext; errors: ValidationError[]; history?: History };
export type EditCallback = (report: EditReport) => void;
export type WalkCallback = (state: WalkState, progress: number) => void;
export type TimelineReport = { kind: "position"; position: number } | { kind: "end" };
export type TimelineCallback = (report: TimelineReport) => void;
/** Called after each change of the Selection, with a copy; `null` when it was cleared (R-VIEW-03.10, 22). */
export type SelectCallback = (selection: Selection) => void;

/** The pose of a Node while it is dragged or previewed; it replaces the Scenario pose (R-VIEW-05.7). */
export type NodePose = {
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
};
export type NodePoses = ReadonlyMap<string, NodePose>;

const NO_POSES: NodePoses = new Map();

export type ViewSnapshot = {
  /** Gesture preview poses; empty outside a Gesture. Never part of the History. */
  preview: NodePoses;
  history: History;
  settings: ViewSettings;
  theme: Theme;
  /** Effect_Requests set by the App (R-VIEW-10.1). */
  appEffects: readonly EffectRequest[];
  view: ViewState;
};

export type ViewStoreInit = {
  history: History;
  settings: ViewSettings;
  theme: Theme;
  view: ViewState;
  onEdit: EditCallback;
  onWalk: WalkCallback;
  onTimeline: TimelineCallback;
  onSelect?: SelectCallback;
};

const effectListSchema = z.array(effectRequestSchema);

export class ViewStore {
  private snapshot: ViewSnapshot;
  private readonly listeners = new Set<() => void>();
  private pending: ViewEvent[] = [];
  private stopped = false;
  private camera: CameraPose;
  /** True while a Gesture is in progress; the Gesture code sets it. Orbit controls are off then (R-VIEW-08.9). */
  gestureActive = false;
  /** True while the pointer is over a gizmo handle; a press then belongs to the gizmo, not to the panel behind it. */
  gizmoHot = false;
  private onEdit: EditCallback;
  private onWalk: WalkCallback;
  private onTimeline: TimelineCallback;
  private onSelect: SelectCallback;

  constructor(init: ViewStoreInit) {
    this.snapshot = {
      preview: NO_POSES,
      history: init.history,
      settings: init.settings,
      theme: init.theme,
      appEffects: [],
      view: init.view,
    };
    this.camera = init.view.cameraOnce ?? init.settings.presets[0].pose;
    this.onEdit = init.onEdit;
    this.onWalk = init.onWalk;
    this.onTimeline = init.onTimeline;
    this.onSelect = init.onSelect ?? (() => undefined);
  }

  // --- useSyncExternalStore surface ---

  subscribe = (listener: () => void): (() => void) => {
    if (this.stopped) return () => undefined;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ViewSnapshot => this.snapshot;

  get isStopped(): boolean {
    return this.stopped;
  }

  /** The frame driver reports the camera it drew, so a preset move starts from where the camera is. */
  reportCamera(pose: CameraPose): void {
    this.camera = pose;
  }

  /** Every callback is dropped; later calls do nothing (R-VIEW-03.5, 03.6). */
  stop(): void {
    this.stopped = true;
    this.listeners.clear();
    this.pending = [];
    this.onEdit = () => undefined;
    this.onWalk = () => undefined;
    this.onTimeline = () => undefined;
    this.onSelect = () => undefined;
  }

  // --- reducer access ---

  dispatch(action: ViewAction): void {
    if (this.stopped) return;
    const prev = this.snapshot.view;
    // A stop drops the Timeline events still waiting for a flush: no position callback after stop (R-VIEW-18.7).
    // `walkStop` also stops a linked Timeline playback (R-VIEW-17.14).
    if (action.type === "timelineStop" || (action.type === "walkStop" && prev.timeline?.mode === "linked")) {
      this.pending = this.pending.filter((e) => e.kind !== "timelinePosition" && e.kind !== "timelineEnd");
    }
    const next = reduceViewState(prev, action);
    // The reducer returns the same object when nothing changed (an idle tick): no new snapshot, no notification.
    if (next === prev) return;
    this.pending.push(...next.outbox);
    this.commit({ ...this.snapshot, view: next });
    if (action.type !== "modelChanged" && prev.shownPresetId !== next.shownPresetId) {
      this.dispatch(this.modelChangedAction());
    }
  }

  /** Calls the Walk, Timeline, and Edit callbacks for the events collected since the last flush (D9). */
  flush(): void {
    if (this.stopped || this.pending.length === 0) return;
    const events = this.pending;
    // `connect` events stay queued for `takeConnects`; the interaction code turns them into an Edit_Command.
    this.pending = events.filter((e) => e.kind === "connect");
    for (const e of events) {
      if (this.stopped) return;
      if (e.kind === "walk") this.onWalk(e.state, e.progress);
      else if (e.kind === "timelinePosition") this.onTimeline({ kind: "position", position: e.position });
      else if (e.kind === "timelineEnd") this.onTimeline({ kind: "end" });
      else if (e.kind === "selection") this.onSelect(e.selection === null ? null : { ...e.selection });
    }
  }

  /** Takes the `connect` events out of the queue for the interaction code (R-VIEW-15). */
  takeConnects(): Extract<ViewEvent, { kind: "connect" }>[] {
    if (this.pending.length === 0) return [];
    const out: Extract<ViewEvent, { kind: "connect" }>[] = [];
    this.pending = this.pending.filter((e) => {
      if (e.kind !== "connect") return true;
      out.push(e);
      return false;
    });
    return out;
  }

  /**
   * A click on nothing, a floor, or a Wall: clears the Selection (R-VIEW-12.3) and, in `edit` mode with connect on,
   * cancels a pending first Node (R-VIEW-15.7). One place for the canvas, floors, and Walls.
   */
  emptyClick(): void {
    this.dispatch({ type: "select", selection: null });
    const { editMode, connect } = this.snapshot.view;
    if (editMode === "edit" && connect !== null) this.dispatch({ type: "connectClick", id: null });
  }

  // --- Gestures ---

  /** Sets or clears the Gesture flag and redraws, so orbit controls follow at once (R-VIEW-08.9). */
  setGestureActive(active: boolean): void {
    if (this.stopped || this.gestureActive === active) return;
    this.gestureActive = active;
    this.commit({ ...this.snapshot });
  }

  /** Shows poses in place of the stored ones until cleared with `null` (R-VIEW-13.4, 13.7). */
  setPreview(poses: NodePoses | null): void {
    if (this.stopped) return;
    if (poses === null && this.snapshot.preview === NO_POSES) return;
    this.commit({ ...this.snapshot, preview: poses ?? NO_POSES });
  }

  /** Ends a Gesture that is in progress: clears the preview and the flag, and a pending first Node (R-VIEW-23.12). */
  cancelGesture(): void {
    if (this.stopped) return;
    this.setPreview(null);
    this.setGestureActive(false);
    if (this.snapshot.view.connect?.first != null) this.dispatch({ type: "connectClick", id: null });
  }

  // --- History ---

  /** The one place a Gesture changes the History (R-VIEW-16.2, 16.6). */
  execute(command: EditCommand): void {
    if (this.stopped) return;
    const r = executeCommand(this.snapshot.history, command);
    if (r.ok) {
      this.commit({ ...this.snapshot, history: r.history });
      this.onEdit({ kind: "history", history: r.history });
    } else {
      this.onEdit({ kind: "errors", context: "edit", errors: r.errors, history: r.history });
    }
    this.dispatch(this.modelChangedAction());
  }

  undo(): void {
    this.step(undoHistory);
  }

  redo(): void {
    this.step(redoHistory);
  }

  private step(fn: (h: History) => History): void {
    if (this.stopped) return;
    const before = this.snapshot.history;
    const h = fn(before);
    const changed = h !== before;
    if (changed) this.commit({ ...this.snapshot, history: h });
    this.onEdit({ kind: "history", history: h });
    if (changed) this.dispatch(this.modelChangedAction());
  }

  /** A History from the App. Keeps the Active_Preset and the camera (R-VIEW-03.4). */
  setHistory(h: History): void {
    if (this.stopped) return;
    const before = this.snapshot.history;
    this.commit({ ...this.snapshot, history: h });
    this.dispatch(this.modelChangedAction());
    const errors = newlyMissingZoneRefs(this.snapshot.settings, before.present, h.present);
    if (errors.length > 0) this.onEdit({ kind: "errors", context: "settings", errors });
  }

  // --- handle functions ---

  setPreset(id: string): void {
    if (this.stopped) return;
    const preset = this.snapshot.settings.presets.find((p) => p.id === id);
    if (preset === undefined) {
      this.report("preset", [{ path: "presetId", message: `no view preset with id ${JSON.stringify(id)}` }]);
      return;
    }
    this.dispatch({ type: "setPreset", id: preset.id, pose: preset.pose, from: this.camera });
  }

  setTheme(value: unknown): void {
    if (this.stopped) return;
    const r = loadTheme(value);
    if (!r.ok) {
      this.report("theme", r.errors);
      return;
    }
    this.commit({ ...this.snapshot, theme: r.theme });
  }

  setEffects(value: unknown): void {
    if (this.stopped) return;
    const r = effectListSchema.safeParse(value);
    if (!r.success) {
      this.report(
        "effects",
        r.error.issues.map((i) => ({ path: ["effects", ...i.path].map(String).join("."), message: i.message })),
      );
      return;
    }
    this.commit({ ...this.snapshot, appEffects: r.data });
  }

  startWalk(pathId: string, duration: number, linked?: Timeline): void {
    if (this.stopped) return;
    const { settings, history } = this.snapshot;
    const index = settings.paths.findIndex((p) => p.id === pathId);
    const errors: ValidationError[] = [];
    if (index < 0) errors.push({ path: "pathId", message: `no camera path with id ${JSON.stringify(pathId)}` });
    if (typeof duration !== "number" || !Number.isFinite(duration) || !(duration > 0)) {
      errors.push({ path: "duration", message: "must be a finite number greater than 0" });
    }
    if (errors.length > 0) return this.report("walk", errors);
    const path = settings.paths[index];

    let built: ZoneWaypoints;
    if (path.waypoints !== undefined) {
      built = { ok: true, waypoints: path.waypoints, zones: [] };
    } else {
      built = buildZoneWaypoints(history.present, settings.zoneFootprints, path.fromZones?.height ?? 0);
      if (!built.ok) {
        return this.report(
          "walk",
          built.errors.map((e) => ({
            path: e.path === "" ? `paths.${index}` : `paths.${index}.${e.path}`,
            message: e.message,
          })),
        );
      }
    }

    let cursor: TimelineCursor | null = null;
    if (linked !== undefined) {
      const linkErrors = checkLinkedTimeline(path, built, linked);
      if (linkErrors.length > 0) return this.report("walk", linkErrors);
      const c = createCursor(linked);
      if (!c.ok) return this.report("walk", c.errors);
      cursor = c.value;
    }
    this.dispatch({ type: "walkStart", waypoints: built.waypoints, duration, linked: cursor });
  }

  pauseWalk(): void {
    this.dispatch({ type: "walkPause" });
  }

  resumeWalk(): void {
    this.dispatch({ type: "walkResume" });
  }

  stopWalk(): void {
    if (this.stopped) return;
    const { settings, view } = this.snapshot;
    const preset = settings.presets.find((p) => p.id === view.activePresetId) ?? settings.presets[0];
    this.dispatch({ type: "walkStop", presetPose: preset.pose });
  }

  startTimeline(timeline: Timeline): void {
    if (this.stopped) return;
    const c = createCursor(timeline);
    if (!c.ok) return this.report("timeline", c.errors);
    this.dispatch({ type: "timelineStart", cursor: c.value });
  }

  pauseTimeline(): void {
    this.dispatch({ type: "timelinePause" });
  }

  resumeTimeline(): void {
    this.dispatch({ type: "timelineResume" });
  }

  stopTimeline(): void {
    this.dispatch({ type: "timelineStop" });
  }

  connectOn(edgeType: string): void {
    if (this.stopped) return;
    if (!nonBlank.safeParse(edgeType).success) {
      return this.report("edit", [{ path: "edgeType", message: "must not be blank" }]);
    }
    this.dispatch({ type: "connectOn", edgeType });
  }

  connectOff(): void {
    this.dispatch({ type: "connectOff" });
  }

  setEditMode(mode: "view" | "edit"): void {
    this.dispatch({ type: "setEditMode", mode });
  }

  setGizmoMode(mode: "rotate" | "scale"): void {
    this.dispatch({ type: "setGizmoMode", mode });
  }

  // --- internals ---

  private report(context: ErrorContext, errors: ValidationError[]): void {
    this.onEdit({ kind: "errors", context, errors });
  }

  /** Both id lists of R-VIEW-12.5, 12.6, using the filter of the shown preset. */
  private modelChangedAction(): ViewAction {
    const { history, settings, view } = this.snapshot;
    const preset = settings.presets.find((p) => p.id === view.shownPresetId) ?? settings.presets[0];
    const visible = computeVisibleSet(history.present, preset.filter);
    return {
      type: "modelChanged",
      nodeIds: history.present.nodes.map((n) => n.id),
      visibleNodeIds: visible.nodes,
      edgeIds: history.present.edges.map((e) => e.id),
      visibleEdgeIds: visible.edges,
    };
  }

  private commit(next: ViewSnapshot): void {
    this.snapshot = next;
    for (const l of [...this.listeners]) l();
  }
}
