import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { poseAt } from "./camera-path.ts";
import {
  actionSeqArb,
  type SeqAction,
  expandSeqAction,
  effectsArb,
  filterArb,
  poseArb,
  settingsArb as viewSettingsArb,
  themeArb,
  waypointsArb,
} from "./arbitraries.ts";
import { showsDetail } from "./detail.ts";
import { drawableEffects, shownEffects } from "./effects-view.ts";
import { loadTheme } from "./theme-schema.ts";
import { computeVisibleSet } from "./visibility.ts";
import { createHistory } from "../../model/history.ts";
import { jsonEqual, scenarioArb } from "../../model/arbitraries.ts";
import { saveScenario } from "../../model/scenario-io.ts";
import type { TimelineCursor } from "../../model/rule-schema.ts";
import { createCursor, createTimeline } from "../../model/timeline.ts";
import type { CameraPose, ViewSettings } from "./settings-schema.ts";
import {
  cameraFor,
  initialViewState,
  orbitAllowed,
  reduceViewState,
  type Selection,
  type ViewEvent,
  type ViewState,
  type WalkState,
} from "./view-state.ts";

const pose = (x: number): CameraPose => ({
  position: { x, y: 1, z: 0 },
  target: { x, y: 1, z: -5 },
});

const settings: ViewSettings = {
  zoneFootprints: [],
  presets: [
    { id: "a", label: { en: "A", ja: "A" }, pose: pose(0), filter: { edgeRule: "bothEnds" } },
    { id: "b", label: { en: "B", ja: "B" }, pose: pose(10), filter: { edgeRule: "bothEnds" } },
    { id: "c", label: { en: "C", ja: "C" }, pose: pose(20), filter: { edgeRule: "bothEnds" } },
  ],
  paths: [],
  detailDistance: 5,
  snapStep: 0.5,
  wallHeight: 2,
  editMode: "view",
  stepDuration: 1,
};

const setPreset = (s: ViewState, id: string, to: CameraPose, from: CameraPose): ViewState =>
  reduceViewState(s, { type: "setPreset", id, pose: to, from });
const tick = (s: ViewState, dt: number): ViewState => reduceViewState(s, { type: "tick", dt });

describe("initialViewState", () => {
  it("starts on the first preset, idle, with its pose as the one-time camera", () => {
    const s = initialViewState(settings);
    expect(s.activePresetId).toBe("a");
    expect(s.shownPresetId).toBe("a");
    expect(s.walk.state).toBe("idle");
    expect(s.cameraOnce).toEqual(pose(0));
    expect(cameraFor(s)).toEqual(pose(0));
    expect(s.outbox).toEqual([]);
  });
});

describe("setPreset and tick", () => {
  it("moves over 0.6 s, then shows the new preset and sets cameraOnce to the target", () => {
    let s = setPreset(initialViewState(settings), "b", pose(10), pose(0));
    expect(s.activePresetId).toBe("b");
    expect(s.shownPresetId).toBe("a");
    expect(s.cameraOnce).toBeNull();
    s = tick(s, 0.3);
    expect(s.shownPresetId).toBe("a");
    expect(cameraFor(s)).not.toBeNull();
    s = tick(s, 0.3);
    expect(s.transition).toBeNull();
    expect(s.shownPresetId).toBe("b");
    expect(cameraFor(s)).toEqual(pose(10));
    s = reduceViewState(s, { type: "cameraApplied" });
    expect(cameraFor(s)).toBeNull();
  });

  it("a later setPreset replaces the move without changing shownPresetId", () => {
    let s = setPreset(initialViewState(settings), "b", pose(10), pose(0));
    s = tick(s, 0.5);
    s = setPreset(s, "c", pose(20), pose(5));
    expect(s.shownPresetId).toBe("a");
    expect(s.transition?.elapsed).toBe(0);
    s = tick(s, 0.6);
    expect(s.shownPresetId).toBe("c");
  });

  it("does not move the camera while a walk is playing or paused", () => {
    const base = initialViewState(settings);
    for (const state of ["playing", "paused"] as const) {
      const s0: ViewState = { ...base, walk: { ...base.walk, state } };
      const s = setPreset(s0, "b", pose(10), pose(0));
      expect(s.transition).toBeNull();
      expect(s.activePresetId).toBe("b");
      expect(s.shownPresetId).toBe("b");
      expect(s.walk.state).toBe(state);
    }
  });

  it("a finished walk goes to idle first, then moves", () => {
    const base = initialViewState(settings);
    const s0: ViewState = { ...base, walk: { ...base.walk, state: "finished" } };
    const s = setPreset(s0, "b", pose(10), pose(0));
    expect(s.walk.state).toBe("idle");
    expect(s.transition).not.toBeNull();
  });

  it("cameraFor prefers the transition, then the walk, then cameraOnce", () => {
    const base = initialViewState(settings);
    const wps = [pose(0), pose(4)];
    const walking: ViewState = {
      ...base,
      walk: { ...base.walk, state: "playing", waypoints: wps, progress: 0.5 },
    };
    expect(cameraFor(walking)).toEqual(poseAt(wps, 0.5).ok ? (poseAt(wps, 0.5) as { pose: CameraPose }).pose : null);
    const moving = setPreset(walking, "b", pose(10), pose(0));
    // walk is playing, so no transition: the walk pose still wins over cameraOnce
    expect(cameraFor(moving)).toEqual(cameraFor(walking));
  });

  it("orbitAllowed is false during a move, a walk, or a gesture", () => {
    const s = initialViewState(settings);
    expect(orbitAllowed(s, false)).toBe(true);
    expect(orbitAllowed(s, true)).toBe(false);
    expect(orbitAllowed(setPreset(s, "b", pose(10), pose(0)), false)).toBe(false);
    expect(orbitAllowed({ ...s, walk: { ...s.walk, state: "paused" } }, false)).toBe(false);
  });
});

describe("preset move timing", () => {
  it("shownPresetId changes only once the summed dt reaches 0.6 s", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 0.3, noNaN: true }), { maxLength: 12 }),
        poseArb,
        poseArb,
        (dts, to, from) => {
          let s = setPreset(initialViewState(settings), "b", to, from);
          let sum = 0;
          for (const dt of dts) {
            s = tick(s, dt);
            sum += dt;
            if (sum >= 0.6 - 1e-9 && sum < 0.6 + 1e-9) continue;
            if (sum < 0.6) {
              expect(s.shownPresetId).toBe("a");
              expect(s.transition).not.toBeNull();
            } else {
              expect(s.shownPresetId).toBe("b");
              expect(s.transition).toBeNull();
              expect(s.cameraOnce).toEqual(to);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

const wps = [pose(0), pose(4), pose(8)];
function cursorOf(n: number): TimelineCursor {
  const steps = Array.from({ length: n }, (_, i) => ({
    id: `step-${i}`,
    targets: [{ kind: "zone" as const, id: `z${i}` }],
    effects: [],
  }));
  const t = createTimeline(steps);
  if (!t.ok) throw new Error("bad timeline");
  const c = createCursor(t.value);
  if (!c.ok) throw new Error("bad cursor");
  return c.value;
}
const cursor = cursorOf(3);
const start = (s: ViewState, duration = 2, linked: TimelineCursor | null = null): ViewState =>
  reduceViewState(s, { type: "walkStart", waypoints: wps, duration, linked });
const act = (s: ViewState, type: "walkPause" | "walkResume"): ViewState =>
  reduceViewState(s, { type: type });
const stop = (s: ViewState): ViewState =>
  reduceViewState(s, { type: "walkStop", presetPose: pose(0) });

describe("walk actions", () => {
  it("walkStart resets time, clears the transition, shows the active preset", () => {
    let s = setPreset(initialViewState(settings), "b", pose(10), pose(0));
    s = start(s);
    expect(s.walk).toMatchObject({ state: "playing", time: 0, progress: 0, marks: [0, 0.5, 1] });
    expect(s.transition).toBeNull();
    expect(s.shownPresetId).toBe("b");
    expect(cameraFor(s)).toEqual(pose(0));
    expect(s.outbox).toEqual([]);
  });

  it("walkStart with a linked Timeline emits position 0 and replaces any playback", () => {
    const s = start(initialViewState(settings), 2, cursor);
    expect(s.timeline).toMatchObject({ mode: "linked", status: "running", sinceMove: 0 });
    expect(s.outbox).toEqual([{ kind: "timelinePosition", position: 0 }]);
    const again = start(s);
    expect(again.timeline).toBeNull();
  });

  it("tick advances progress, reports state change once, then progress, then finishes", () => {
    let s = start(initialViewState(settings));
    s = tick(s, 0.5);
    expect(s.walk.progress).toBe(0.25);
    expect(s.outbox).toEqual([{ kind: "walk", state: "playing", progress: 0.25 }]);
    s = tick(s, 0.5);
    expect(s.outbox).toEqual([{ kind: "walk", state: "playing", progress: 0.5 }]);
    s = tick(s, 5);
    expect(s.walk.state).toBe("finished");
    expect(s.walk.progress).toBe(1);
    expect(s.outbox).toEqual([{ kind: "walk", state: "finished", progress: 1 }]);
    s = tick(s, 1);
    expect(s.outbox).toEqual([]);
  });

  it("pause keeps progress and time, resume continues", () => {
    let s = tick(start(initialViewState(settings)), 1);
    s = act(s, "walkPause");
    expect(s.walk.state).toBe("paused");
    s = tick(s, 5);
    expect(s.walk.progress).toBe(0.5);
    expect(s.outbox).toEqual([{ kind: "walk", state: "paused", progress: 0.5 }]);
    s = act(s, "walkResume");
    s = tick(s, 0.5);
    expect(s.walk.progress).toBe(0.75);
  });

  it("pause, resume, stop outside their states change nothing and emit nothing", () => {
    const idle = initialViewState(settings);
    expect(act(idle, "walkPause")).toEqual(idle);
    expect(act(idle, "walkResume")).toEqual(idle);
    expect(stop(idle)).toEqual(idle);
    const playing = start(idle);
    expect(act(playing, "walkResume")).toEqual(playing);
  });

  it("stop returns to idle and sets cameraOnce to the preset pose, kept across ticks", () => {
    let s = tick(start(initialViewState(settings), 2, cursor), 1);
    s = stop(s);
    expect(s.walk.state).toBe("idle");
    expect(s.timeline).toBeNull();
    expect(cameraFor(s)).toEqual(pose(0));
    s = tick(s, 0.1);
    expect(s.outbox).toEqual([{ kind: "walk", state: "idle", progress: s.walk.progress }]);
    expect(cameraFor(s)).toEqual(pose(0));
    s = reduceViewState(s, { type: "cameraApplied" });
    expect(cameraFor(s)).toBeNull();
  });

  it("pause and resume also pause and resume a linked Timeline", () => {
    let s = start(initialViewState(settings), 2, cursor);
    s = act(s, "walkPause");
    expect(s.timeline?.status).toBe("paused");
    s = act(s, "walkResume");
    expect(s.timeline?.status).toBe("running");
  });

  it("reported progress is within 0..1, never decreases, one event per tick", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        fc.array(fc.double({ min: 0, max: 2, noNaN: true }), { maxLength: 20 }),
        (duration, dts) => {
          let s = start(initialViewState(settings), duration);
          let last = 0;
          for (const dt of dts) {
            s = tick(s, dt);
            expect(s.outbox.length).toBeLessThanOrEqual(1);
            for (const e of s.outbox) {
              if (e.kind !== "walk") continue;
              expect(e.progress).toBeGreaterThanOrEqual(last);
              expect(e.progress).toBeLessThanOrEqual(1);
              last = e.progress;
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
const positions = (s: ViewState): ViewEvent[] => s.outbox.filter((e) => e.kind !== "walk");
const tlStart = (s: ViewState, n: number): ViewState =>
  reduceViewState(s, { type: "timelineStart", cursor: cursorOf(n) });

describe("Timeline playback", () => {
  it("17.5: a preset switch after finished gives idle and a transition", () => {
    let s = tick(start(initialViewState(settings), 1), 2);
    expect(s.walk.state).toBe("finished");
    s = setPreset(s, "b", pose(10), pose(8));
    expect(s.walk.state).toBe("idle");
    expect(s.transition).not.toBeNull();
  });

  it("17.13: a new start while a linked playback is ended stops it first", () => {
    let s = tick(start(initialViewState(settings), 1, cursor), 2);
    expect(s.timeline?.status).toBe("ended");
    s = start(s, 1);
    expect(s.timeline).toBeNull();
    expect(s.walk.state).toBe("playing");
  });

  it("18.5: a one-step Timeline ends one Step_Duration after start, once", () => {
    let s = tlStart(initialViewState(settings), 1);
    expect(s.outbox).toEqual([{ kind: "timelinePosition", position: 0 }]);
    s = tick(s, 0.9);
    expect(positions(s)).toEqual([]);
    expect(s.timeline?.status).toBe("running");
    s = tick(s, 0.1);
    expect(positions(s)).toEqual([{ kind: "timelineEnd" }]);
    expect(s.timeline?.status).toBe("ended");
    s = tick(s, 5);
    expect(positions(s)).toEqual([]);
  });

  it("paced mode moves one step per Step_Duration", () => {
    let s = tlStart(initialViewState(settings), 3);
    s = tick(s, 2.5);
    expect(positions(s)).toEqual([
      { kind: "timelinePosition", position: 1 },
      { kind: "timelinePosition", position: 2 },
    ]);
    expect(s.timeline?.sinceMove).toBe(0.5);
    s = tick(s, 0.5);
    expect(positions(s)).toEqual([{ kind: "timelineEnd" }]);
  });

  it("18.6: resume after a pause at 0.4 x Step_Duration moves after the remaining 0.6", () => {
    let s = tlStart(initialViewState(settings), 2);
    s = tick(s, 0.4);
    s = reduceViewState(s, { type: "timelinePause" });
    expect(s.timeline?.status).toBe("paused");
    s = tick(s, 10);
    expect(positions(s)).toEqual([]);
    s = reduceViewState(s, { type: "timelineResume" });
    s = tick(s, 0.5);
    expect(positions(s)).toEqual([]);
    s = tick(s, 0.1);
    expect(positions(s)).toEqual([{ kind: "timelinePosition", position: 1 }]);
  });

  it("timelineStart replaces a running playback; timelineStop clears it", () => {
    let s = tlStart(initialViewState(settings), 3);
    s = tick(s, 1);
    s = tlStart(s, 2);
    expect(s.timeline).toMatchObject({ mode: "paced", status: "running", sinceMove: 0 });
    expect(s.timeline?.cursor.position).toBe(0);
    s = reduceViewState(s, { type: "timelineStop" });
    expect(s.timeline).toBeNull();
  });

  it("linked mode follows marks, ignores Step_Duration, pause and resume, and ends with the walk", () => {
    let s = start(initialViewState(settings), 2, cursor);
    s = tick(s, 0.5);
    expect(s.walk.progress).toBe(0.25);
    expect(s.timeline?.cursor.position).toBe(0);
    s = tick(s, 0.5);
    expect(positions(s)).toEqual([{ kind: "timelinePosition", position: 1 }]);
    const ignored = reduceViewState(s, { type: "timelinePause" });
    expect(ignored.timeline?.status).toBe("running");
    expect(ignored.outbox).toEqual([]);
    s = act(s, "walkPause");
    expect(reduceViewState(s, { type: "timelineResume" }).timeline?.status).toBe("paused");
    s = tick(s, 5);
    expect(s.timeline?.cursor.position).toBe(1);
    s = act(s, "walkResume");
    s = tick(s, 5);
    expect(positions(s)).toEqual([
      { kind: "timelinePosition", position: 2 },
      { kind: "timelineEnd" },
    ]);
    expect(s.timeline?.status).toBe("ended");
  });
});

const editState = (): ViewState => reduceViewState(initialViewState(settings), { type: "setEditMode", mode: "edit" });
const node = (id: string): Selection => ({ kind: "node", id });
const edge = (id: string): Selection => ({ kind: "edge", id });
const dispatch = (s: ViewState, a: Parameters<typeof reduceViewState>[1]): ViewState => reduceViewState(s, a);

describe("selection, Connect_Mode, Edit_Mode, and model changes", () => {
  it("12.7: select(id) is ignored in view mode and while connect is on", () => {
    const view = initialViewState(settings);
    expect(dispatch(view, { type: "select", selection: node("n1") }).selection).toBeNull();
    let s = dispatch(editState(), { type: "select", selection: node("n1") });
    expect(s.selection).toEqual(node("n1"));
    s = dispatch(s, { type: "connectOn", edgeType: "link" });
    expect(dispatch(s, { type: "select", selection: node("n2") }).selection).toEqual(node("n1"));
    expect(dispatch(s, { type: "select", selection: edge("e1") }).selection).toEqual(node("n1"));
  });

  it("12.3: select(null) clears the Selection while connect is on or off", () => {
    let s = dispatch(editState(), { type: "select", selection: node("n1") });
    expect(dispatch(s, { type: "select", selection: null }).selection).toBeNull();
    s = dispatch(s, { type: "connectOn", edgeType: "link" });
    expect(dispatch(s, { type: "select", selection: null }).selection).toBeNull();
  });

  it("setGizmoMode sets the mode", () => {
    expect(dispatch(editState(), { type: "setGizmoMode", mode: "scale" }).gizmoMode).toBe("scale");
  });

  it("15.4: two clicks emit one connect event, clear first, and keep connect on", () => {
    let s = dispatch(editState(), { type: "connectOn", edgeType: "link" });
    s = dispatch(s, { type: "connectClick", id: "a" });
    expect(s.connect).toEqual({ edgeType: "link", first: "a" });
    expect(s.outbox).toEqual([]);
    s = dispatch(s, { type: "connectClick", id: "b" });
    expect(s.outbox).toEqual([{ kind: "connect", from: "a", to: "b", edgeType: "link" }]);
    expect(s.connect).toEqual({ edgeType: "link", first: null });
  });

  it("15.7: a second click on the same Node or on empty space cancels without an event", () => {
    let s = dispatch(editState(), { type: "connectOn", edgeType: "link" });
    s = dispatch(dispatch(s, { type: "connectClick", id: "a" }), { type: "connectClick", id: "a" });
    expect(s.connect?.first).toBeNull();
    expect(s.outbox).toEqual([]);
    s = dispatch(dispatch(s, { type: "connectClick", id: "a" }), { type: "connectClick", id: null });
    expect(s.connect?.first).toBeNull();
    expect(s.outbox).toEqual([]);
  });

  it("15.7: connectOff clears a pending first Node; a null click with no first Node is a no-op", () => {
    let s = dispatch(dispatch(editState(), { type: "connectOn", edgeType: "link" }), { type: "connectClick", id: "a" });
    s = dispatch(s, { type: "connectOff" });
    expect(s.connect).toBeNull();
    s = dispatch(dispatch(editState(), { type: "connectOn", edgeType: "link" }), { type: "connectClick", id: null });
    expect(s.connect).toEqual({ edgeType: "link", first: null });
    expect(s.outbox).toEqual([]);
  });

  it("15.2: connectOn while on cancels the pending connection and uses the new type; connectOff ends it", () => {
    let s = dispatch(editState(), { type: "connectOn", edgeType: "link" });
    s = dispatch(s, { type: "connectClick", id: "a" });
    s = dispatch(s, { type: "connectOn", edgeType: "other" });
    expect(s.connect).toEqual({ edgeType: "other", first: null });
    expect(dispatch(s, { type: "connectOff" }).connect).toBeNull();
  });

  it("15.8: connect clicks are ignored in view mode", () => {
    let s = dispatch(initialViewState(settings), { type: "connectOn", edgeType: "link" });
    s = dispatch(s, { type: "connectClick", id: "a" });
    expect(s.connect?.first).toBeNull();
    expect(s.outbox).toEqual([]);
  });

  it("setEditMode(view) clears selection and connect.first but keeps connect on", () => {
    let s = dispatch(editState(), { type: "select", selection: node("n1") });
    s = dispatch(s, { type: "connectOn", edgeType: "link" });
    s = dispatch(s, { type: "connectClick", id: "a" });
    s = dispatch(s, { type: "setEditMode", mode: "view" });
    expect(s.selection).toBeNull();
    expect(s.connect).toEqual({ edgeType: "link", first: null });
  });

  it("12.5, 12.6, 15.7: modelChanged clears a Node that is gone or not visible", () => {
    let s = dispatch(editState(), { type: "select", selection: node("n1") });
    const mc = (nodeIds: string[], visibleNodeIds: string[], edgeIds: string[] = [], visibleEdgeIds: string[] = []) =>
      ({ type: "modelChanged", nodeIds, visibleNodeIds, edgeIds, visibleEdgeIds }) as const;
    expect(dispatch(s, mc(["n1"], ["n1"])).selection).toEqual(node("n1"));
    expect(dispatch(s, mc(["n2"], ["n1"])).selection).toBeNull();
    expect(dispatch(s, mc(["n1"], [])).selection).toBeNull();
    const e = dispatch(editState(), { type: "select", selection: edge("e1") });
    expect(dispatch(e, mc([], [], ["e1"], ["e1"])).selection).toEqual(edge("e1"));
    expect(dispatch(e, mc(["e1"], ["e1"], [], [])).selection).toBeNull();
    expect(dispatch(e, mc([], [], ["e1"], [])).selection).toBeNull();
    s = dispatch(dispatch(editState(), { type: "connectOn", edgeType: "link" }), { type: "connectClick", id: "a" });
    s = dispatch(s, { type: "modelChanged", nodeIds: ["a"], visibleNodeIds: [], edgeIds: [], visibleEdgeIds: [] });
    expect(s.connect).toEqual({ edgeType: "link", first: null });
  });
});

describe("view mode and generated action sequences", () => {
  it("12.7: view mode keeps selection and connect.first empty after every action", () => {
    fc.assert(
      fc.property(actionSeqArb(settings), (actions) => {
        let s = initialViewState(settings);
        for (const seq of actions) {
          for (const a of expandSeqAction(seq, s)) s = reduceViewState(s, a);
          if (s.editMode === "view") {
            expect(s.selection).toBeNull();
            expect(s.connect?.first ?? null).toBeNull();
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("8.11: after walkStop the preset pose is returned until cameraApplied", () => {
    let s = tick(start(initialViewState(settings)), 0.5);
    s = stop(s);
    expect(cameraFor(s)).toEqual(pose(0));
    s = tick(s, 0.2);
    expect(cameraFor(s)).toEqual(pose(0));
    expect(cameraFor(reduceViewState(s, { type: "cameraApplied" }))).toBeNull();
  });
});

// Feature: core-view, Property 12: P-VIEW-12 the View_State_Reducer follows the playback and selection rules
describe("P-VIEW-12 the View_State_Reducer follows the playback and selection rules", () => {
  /**
   * **Validates: Requirements 3.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.9, 12.3, 12.5, 12.6, 12.7, 12.8, 12.9, 15.2, 15.4, 15.7, 15.8, 17.2, 17.3, 17.5, 17.6, 17.7, 17.9, 17.10, 17.13, 17.14, 17.15, 18.2, 18.3, 18.5, 18.6, 18.8, 18.10**
   */
  type RefTimeline = { mode: "paced" | "linked"; t: number; last: number };

  const settingsArb = fc
    .record({
      stepDuration: fc.constantFrom(0.25, 0.5, 1, 2),
      editMode: fc.constantFrom<"view" | "edit">("view", "edit"),
    })
    .map((o): ViewSettings => ({ ...settings, ...o }));

  const nonWalkEvents = (s: ViewState): ViewEvent[] => s.outbox.filter((e) => e.kind !== "walk");
  const near = (q: number): boolean => Math.abs(q - Math.round(q)) < 1e-9;

  function check(cfg: ViewSettings, actions: SeqAction[]): void {
    let s = initialViewState(cfg);
    expect(cameraFor(s)).toEqual(cfg.presets[0].pose);

    // Reference model.
    let refWalk: WalkState = "idle";
    let refTime = 0;
    let refDuration = 0;
    let refActive = s.activePresetId;
    let refShown = s.shownPresetId;
    let pending: { sum: number; to: CameraPose } | null = null;
    let refTl: RefTimeline | null = null;
    let afterStop: CameraPose | null = null;

    for (const seq of actions) for (const a of expandSeqAction(seq, s)) {
      const prev = s;
      s = reduceViewState(prev, a);
      const cleared = { ...prev, outbox: [] };

      // Outbox kinds that only tick, start, or connect may produce.
      if (a.type !== "tick") {
        expect(s.outbox.filter((e) => e.kind === "walk" || e.kind === "timelineEnd")).toEqual([]);
      }
      if (a.type !== "walkStart" && a.type !== "timelineStart") {
        if (a.type !== "tick") {
          expect(nonWalkEvents(s).filter((e) => e.kind !== "connect" && e.kind !== "selection")).toEqual([]);
        }
      }

      // Walk: progress rules.
      expect(s.walk.progress).toBeGreaterThanOrEqual(0);
      expect(s.walk.progress).toBeLessThanOrEqual(1);
      if (a.type === "walkStart") expect(s.walk.progress).toBe(0);
      else if (a.type !== "tick" || prev.walk.state !== "playing") {
        expect(s.walk.progress).toBe(prev.walk.progress);
      } else {
        expect(s.walk.progress).toBeGreaterThanOrEqual(prev.walk.progress);
      }

      // Walk: reference state and summed dt.
      const prevRefWalk = refWalk;
      if (a.type === "walkStart") {
        refWalk = "playing";
        refTime = 0;
        refDuration = a.duration;
      } else if (a.type === "walkPause" && refWalk === "playing") refWalk = "paused";
      else if (a.type === "walkResume" && refWalk === "paused") refWalk = "playing";
      else if (a.type === "walkStop" && refWalk !== "idle") refWalk = "idle";
      else if (a.type === "setPreset" && refWalk === "finished") refWalk = "idle";
      else if (a.type === "tick" && refWalk === "playing") {
        refTime = refTime + a.dt;
        if (refTime >= refDuration) refWalk = "finished";
      }
      expect(s.walk.state).toBe(refWalk);

      const unlisted =
        (a.type === "walkPause" && prevRefWalk !== "playing") ||
        (a.type === "walkResume" && prevRefWalk !== "paused") ||
        (a.type === "walkStop" && prevRefWalk === "idle");
      if (unlisted) expect(s).toEqual(cleared);

      if (a.type === "tick") {
        const walkEvents = s.outbox.filter((e) => e.kind === "walk");
        const expected = s.walk.state !== prev.walk.reported || s.walk.state === "playing";
        expect(walkEvents.length).toBe(expected ? 1 : 0);
        if (expected) {
          expect(walkEvents[0]).toEqual({ kind: "walk", state: s.walk.state, progress: s.walk.progress });
        }
      }

      // Preset.
      if (a.type === "setPreset") {
        refActive = a.id;
        if (prevRefWalk === "playing" || prevRefWalk === "paused") {
          refShown = a.id;
          expect(s.transition).toBeNull();
        } else {
          pending = { sum: 0, to: a.pose };
        }
        afterStop = null;
      } else if (a.type === "walkStart") {
        pending = null;
        refShown = refActive;
      } else if (a.type === "tick" && pending !== null) {
        pending.sum = pending.sum + a.dt;
        if (pending.sum >= 0.6) {
          refShown = refActive;
          expect(cameraFor(s)).toEqual(pending.to);
          pending = null;
        }
      }
      expect(s.activePresetId).toBe(refActive);
      expect(s.shownPresetId).toBe(refShown);

      // Timeline reference.
      const prevTl = prev.timeline;
      const prevStatus = prevTl?.status ?? null;
      if (a.type === "timelineStart") {
        refTl = { mode: "paced", t: 0, last: a.cursor.timeline.steps.length - 1 };
      } else if (a.type === "timelineStop") refTl = null;
      else if (a.type === "walkStart") {
        if (a.linked !== null) refTl = { mode: "linked", t: 0, last: a.linked.timeline.steps.length - 1 };
        else if (refTl?.mode !== "paced") refTl = null;
      } else if (a.type === "walkStop" && !unlisted && refTl?.mode === "linked") refTl = null;
      expect(s.timeline === null).toBe(refTl === null);
      if (s.timeline !== null && refTl !== null) expect(s.timeline.mode).toBe(refTl.mode);

      const linkedWalkActive =
        prevTl !== null && prevTl.mode === "linked" && (prevRefWalk === "playing" || prevRefWalk === "paused");
      if ((a.type === "timelinePause" || a.type === "timelineResume") && linkedWalkActive) {
        expect(s).toEqual(cleared);
      }

      if (a.type === "tick" && prevTl !== null && s.timeline !== null && refTl !== null) {
        const tl = s.timeline;
        const events = nonWalkEvents(s);
        if (prevStatus !== "running") {
          expect(tl.cursor.position).toBe(prevTl.cursor.position);
          expect(events).toEqual([]);
        } else {
          const from = prevTl.cursor.position;
          const moves = events.filter((e) => e.kind === "timelinePosition");
          expect(moves.map((e) => (e.kind === "timelinePosition" ? e.position : -1))).toEqual(
            Array.from({ length: tl.cursor.position - from }, (_, i) => from + 1 + i),
          );
          const ends = events.filter((e) => e.kind === "timelineEnd");
          expect(ends.length).toBe(tl.status === "ended" ? 1 : 0);
          if (refTl.mode === "paced") {
            refTl.t = refTl.t + a.dt;
            const q = refTl.t / cfg.stepDuration;
            if (!near(q)) {
              expect(tl.cursor.position).toBe(Math.min(refTl.last, Math.floor(q)));
              expect(tl.status === "ended").toBe(q >= refTl.last + 1);
            }
          } else if (s.walk.state === "playing" || s.walk.state === "finished") {
            let largest = 0;
            s.walk.marks.forEach((m, i) => {
              if (m <= s.walk.progress) largest = i;
            });
            expect(tl.cursor.position).toBe(Math.min(refTl.last, largest));
            expect(tl.status === "ended").toBe(s.walk.state === "finished");
          } else {
            expect(tl.cursor.position).toBe(from);
          }
        }
      }

      // Camera.
      if (a.type === "walkStop" && !unlisted && (prevRefWalk === "playing" || prevRefWalk === "paused")) {
        afterStop = a.presetPose;
      } else if (a.type === "cameraApplied" || a.type === "walkStart") afterStop = null;
      if (afterStop !== null) expect(cameraFor(s)).toEqual(afterStop);
      if (a.type === "cameraApplied" && s.transition === null && s.walk.state === "idle") {
        expect(cameraFor(s)).toBeNull();
      }
      if (a.type === "walkStart") expect(cameraFor(s)).toEqual(a.waypoints[0]);

      // Selection and connect.
      if (s.editMode === "view") {
        expect(s.selection).toBeNull();
        expect(s.connect?.first ?? null).toBeNull();
      }
      if (a.type === "select" && a.selection === null) expect(s.selection).toBeNull();
      if (a.type === "modelChanged") {
        if (s.selection?.kind === "node") {
          expect(a.nodeIds).toContain(s.selection.id);
          expect(a.visibleNodeIds).toContain(s.selection.id);
        }
        if (s.selection?.kind === "edge") {
          expect(a.edgeIds).toContain(s.selection.id);
          expect(a.visibleEdgeIds).toContain(s.selection.id);
        }
        const first = s.connect?.first ?? null;
        if (first !== null) {
          expect(a.nodeIds).toContain(first);
          expect(a.visibleNodeIds).toContain(first);
        }
      }
      const connects = s.outbox.filter((e) => e.kind === "connect");
      const firstBefore = prev.connect?.first ?? null;
      const shouldConnect =
        a.type === "connectClick" &&
        prev.editMode === "edit" &&
        prev.connect !== null &&
        firstBefore !== null &&
        a.id !== null &&
        a.id !== firstBefore;
      expect(connects.length).toBe(shouldConnect ? 1 : 0);
      if (shouldConnect && a.type === "connectClick" && prev.connect !== null) {
        expect(connects[0]).toEqual({ kind: "connect", from: firstBefore, to: a.id, edgeType: prev.connect.edgeType });
        expect(s.connect).toEqual({ edgeType: prev.connect.edgeType, first: null });
      }
    }
  }

  it("holds after every action of a generated sequence", () => {
    fc.assert(
      fc.property(
        settingsArb.chain((cfg) => fc.tuple(fc.constant(cfg), actionSeqArb(cfg))),
        ([cfg, actions]) => check(cfg, actions),
      ),
      { numRuns: 300 },
    );
  });
});

// Feature: core-view, Property 14: Edge selection and Selection notification
describe("P-VIEW-14 Edge selection and Selection notification", () => {
  /**
   * **Validates: Requirements 3.10, 12.5, 12.8, 12.9, 22.1, 22.2, 22.3, 22.4, 23.1, 23.6, 23.7, 23.8**
   */
  const cfgArb = fc
    .record({
      stepDuration: fc.constantFrom(0.25, 1),
      editMode: fc.constantFrom<"view" | "edit">("view", "edit"),
    })
    .map((o): ViewSettings => ({ ...settings, ...o }));

  // Equality written here on purpose; it does not use the implementation's own check.
  const sameSel = (a: Selection, b: Selection): boolean =>
    a === null || b === null ? a === b : a.kind === b.kind && a.id === b.id;

  function check(cfg: ViewSettings, actions: SeqAction[]): void {
    let s = initialViewState(cfg);
    expect(s.selection).toBeNull();
    expect(s.outbox).toEqual([]);

    for (const seq of actions) {
      const clickConnectOn = seq.type === "edgeClick" && s.connect !== null;
      const clickSelects = seq.type === "edgeClick" && s.editMode === "edit" && s.connect === null;
      for (const a of expandSeqAction(seq, s)) {
        const prev = s;
        s = reduceViewState(prev, a);

        const sel = s.selection;
        if (sel !== null) {
          expect(Object.keys(sel).sort()).toEqual(["id", "kind"]);
          expect(sel.kind === "node" || sel.kind === "edge").toBe(true);
          expect(typeof sel.id).toBe("string");
        }

        // An Edge becomes selected only by a select of that Edge in edit mode with connect off.
        if (sel !== null && sel.kind === "edge" && !sameSel(prev.selection, sel)) {
          expect(a.type).toBe("select");
          if (a.type === "select") expect(sameSel(a.selection, sel)).toBe(true);
          expect(prev.editMode).toBe("edit");
          expect(prev.connect).toBeNull();
        }
        // A raw select of an Edge in view mode or with connect on leaves the Selection unchanged.
        if (
          seq.type === "select" &&
          a.type === "select" &&
          a.selection !== null &&
          a.selection.kind === "edge" &&
          (prev.editMode === "view" || prev.connect !== null)
        ) {
          expect(sameSel(s.selection, prev.selection)).toBe(true);
        }
        // A raw select of an Edge in edit mode with connect off selects it.
        if (
          seq.type === "select" &&
          a.type === "select" &&
          a.selection !== null &&
          a.selection.kind === "edge" &&
          prev.editMode === "edit" &&
          prev.connect === null
        ) {
          expect(sameSel(s.selection, a.selection)).toBe(true);
        }

        if (a.type === "modelChanged") {
          const was = prev.selection;
          if (was !== null && was.kind === "edge") {
            const keep = a.edgeIds.includes(was.id) && a.visibleEdgeIds.includes(was.id);
            expect(sameSel(s.selection, keep ? was : null)).toBe(true);
          }
          if (was !== null && was.kind === "node") {
            const keep = a.nodeIds.includes(was.id) && a.visibleNodeIds.includes(was.id);
            expect(sameSel(s.selection, keep ? was : null)).toBe(true);
          }
        }
        if (a.type === "setEditMode" && a.mode === "view") expect(s.selection).toBeNull();

        const selEvents = s.outbox.filter((e) => e.kind === "selection");
        if (sameSel(prev.selection, s.selection)) {
          expect(selEvents).toEqual([]);
        } else {
          expect(selEvents).toHaveLength(1);
          const ev = selEvents[0];
          if (ev.kind === "selection") expect(jsonEqual(ev.selection, s.selection)).toBe(true);
        }
      }
      if (seq.type === "edgeClick") {
        if (clickConnectOn) {
          expect(s.selection).toBeNull();
          expect(s.connect?.first ?? null).toBeNull();
        } else if (!clickSelects) {
          expect(s.selection).toBeNull();
        } else {
          expect(sameSel(s.selection, { kind: "edge", id: seq.id })).toBe(true);
        }
      }
    }
  }

  it("holds after every action of a generated sequence", () => {
    fc.assert(
      fc.property(
        cfgArb.chain((cfg) => fc.tuple(fc.constant(cfg), actionSeqArb(cfg))),
        ([cfg, actions]) => check(cfg, actions),
      ),
      { numRuns: 300 },
    );
  });
});

// Feature: core-view, Property 2: P-VIEW-2 the view never changes the model
describe("P-VIEW-2 the view never changes the model", () => {
  /**
   * **Validates: Requirements 1.8, 1.9, 8.10, 8.11, 20.5, 20.8, 22.6, 23.9**
   */
  const hasHistoryFields = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null) return false;
    if (Array.isArray(value)) return value.some(hasHistoryFields);
    const keys = Object.keys(value);
    if (keys.includes("past") || keys.includes("present") || keys.includes("future")) return true;
    return Object.values(value).some(hasHistoryFields);
  };

  it("reducer and helpers leave the History and its saved text unchanged", () => {
    const caseArb = scenarioArb.chain((scenario) =>
      viewSettingsArb(scenario).chain((cfg) =>
        fc.tuple(
          fc.constant(scenario),
          fc.constant(cfg),
          actionSeqArb(cfg),
          filterArb(scenario),
          effectsArb(scenario),
          themeArb,
          waypointsArb,
          fc.double({ min: -10, max: 10, noNaN: true }),
        ),
      ),
    );
    fc.assert(
      fc.property(caseArb, ([scenario, cfg, actions, filter, effects, theme, waypoints, progress]) => {
        const created = createHistory(scenario);
        if (!created.ok) throw new Error("generated Scenario was rejected");
        const h = created.history;
        const copy = structuredClone(h);
        const savedBefore = saveScenario(h.present);
        const footprintIds = new Set(cfg.zoneFootprints.map((f) => f.id));
        let s = initialViewState(cfg);
        expect(hasHistoryFields(s)).toBe(false);
        for (const seq of actions) {
          for (const x of expandSeqAction(seq, s)) {
            s = reduceViewState(s, x);
            expect(hasHistoryFields(s)).toBe(false);
          }
          const visible = computeVisibleSet(h.present, filter);
          poseAt(waypoints, progress);
          showsDetail({ x: progress, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, cfg.detailDistance);
          loadTheme(theme);
          drawableEffects(effects, h.present, visible, footprintIds, theme);
          shownEffects(effects, null);
        }
        expect(jsonEqual(h, copy)).toBe(true);
        const savedAfter = saveScenario(h.present);
        expect(savedBefore.ok && savedAfter.ok).toBe(true);
        if (savedBefore.ok && savedAfter.ok) expect(savedAfter.text).toBe(savedBefore.text);
      }),
      { numRuns: 100 },
    );
  });
});

describe("idle tick returns the same state (design.md D17)", () => {
  it("an idle tick returns the very same object", () => {
    const s = initialViewState(settings);
    expect(tick(s, 0.016)).toBe(s);
    expect(tick(s, 0)).toBe(s);
    expect(tick(s, Number.NaN)).toBe(s);
  });

  it("a tick after the move has ended is idle again", () => {
    let s = setPreset(initialViewState(settings), "b", pose(10), pose(0));
    s = tick(s, 1);
    expect(s.transition).toBeNull();
    expect(tick(s, 0.016)).toBe(s);
  });

  it("a tick still clears a queued outbox", () => {
    const base = initialViewState(settings);
    const s: ViewState = { ...base, outbox: [{ kind: "timelineEnd" }] };
    const next = tick(s, 0.016);
    expect(next).not.toBe(s);
    expect(next.outbox).toEqual([]);
  });

  it("a tick that moves something returns a new state", () => {
    const moving = setPreset(initialViewState(settings), "b", pose(10), pose(0));
    expect(tick(moving, 0.1)).not.toBe(moving);
    const base = initialViewState(settings);
    const playing: ViewState = { ...base, walk: { ...base.walk, state: "playing", duration: 10 } };
    expect(tick(playing, 0.1)).not.toBe(playing);
    const paused: ViewState = { ...base, walk: { ...base.walk, state: "paused" } };
    // A paused walk that was never reported still reports once, then is idle for ticks.
    const reportedOnce = tick(paused, 0.1);
    expect(reportedOnce.outbox).toHaveLength(1);
    expect(tick(reportedOnce, 0.1)).not.toBe(reportedOnce);
    expect(tick(tick(reportedOnce, 0.1), 0.1).outbox).toEqual([]);
  });
});
