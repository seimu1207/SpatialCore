import { describe, expect, it } from "vitest";
import { createHistory, type History } from "../../model/history.ts";
import type { EditCommand } from "../../model/commands.ts";
import { createTimeline } from "../../model/timeline.ts";
import type { Timeline } from "../../model/rule-schema.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { loadViewSettings, type ViewSettings } from "../helpers/settings-schema.ts";
import { loadTheme } from "../helpers/theme-schema.ts";
import { NEUTRAL_THEME } from "../helpers/neutral-theme.ts";
import { initialViewState, type Selection, type ViewAction } from "../helpers/view-state.ts";
import { ViewStore, type EditReport, type TimelineReport } from "./view-store.ts";

const label = { en: "x", ja: "x" };
const pose = { position: { x: 0, y: 5, z: 8 }, target: { x: 0, y: 0, z: 0 } };
const pose2 = { position: { x: 1, y: 5, z: 8 }, target: { x: 0, y: 0, z: 0 } };
const origin = { x: 0, y: 0, z: 0 };
const one = { x: 1, y: 1, z: 1 };

function node(id: string, zone: string | undefined, x: number) {
  return {
    id,
    type: "card",
    position: { x, y: 0, z: 0 },
    rotation: origin,
    scale: one,
    front: { text: label },
    ...(zone === undefined ? {} : { zone }),
    metadata: {},
    attributes: {},
  };
}

const scenario: Scenario = {
  schemaVersion: 1,
  id: "s",
  title: label,
  nodes: [node("n1", "a", 0), node("n2", "b", 3)],
  edges: [],
  zones: [
    { id: "a", label, order: 0, elevation: 0, enclosed: false },
    { id: "b", label, order: 1, elevation: 0, enclosed: false },
  ],
};

function settings(): ViewSettings {
  const r = loadViewSettings({
    zoneFootprints: [
      { kind: "rect", id: "a", x: 0, z: 0, width: 1, depth: 1 },
      { kind: "rect", id: "b", x: 3, z: 0, width: 1, depth: 1 },
    ],
    presets: [
      { id: "p1", label, pose, filter: { edgeRule: "bothEnds" } },
      { id: "p2", label, pose: pose2, filter: { zones: ["a"], edgeRule: "bothEnds" } },
    ],
    paths: [
      { id: "zones", fromZones: { height: 1 } },
      { id: "wp", waypoints: [pose, pose2] },
    ],
    detailDistance: 3,
    snapStep: 0.5,
    wallHeight: 1,
    editMode: "edit",
    stepDuration: 1,
  });
  if (!r.ok) throw new Error("bad fixture");
  return r.settings;
}

function makeHistory(): History {
  const r = createHistory(scenario);
  if (!r.ok) throw new Error("bad fixture");
  return r.history;
}

function timeline(zones: string[]): Timeline {
  const r = createTimeline(
    zones.map((z, i) => ({ id: `t${i}`, targets: [{ kind: "zone" as const, id: z }], effects: [] })),
  );
  if (!r.ok) throw new Error("bad fixture");
  return r.value;
}

function setup() {
  const edits: EditReport[] = [];
  const walks: [string, number][] = [];
  const tls: TimelineReport[] = [];
  const theme = loadTheme(NEUTRAL_THEME);
  if (!theme.ok) throw new Error("bad theme");
  const s = settings();
  const store = new ViewStore({
    history: makeHistory(),
    settings: s,
    theme: theme.theme,
    view: initialViewState(s),
    onEdit: (r) => edits.push(r),
    onWalk: (st, p) => walks.push([st, p]),
    onTimeline: (r) => tls.push(r),
  });
  return { store, edits, walks, tls };
}

const move: EditCommand = { kind: "updateNode", id: "n1", changes: { position: { x: 5, y: 0, z: 0 } } };

describe("ViewStore edits", () => {
  it("execute passes the new History to onEdit and uses it at once (16.2, D12)", () => {
    const { store, edits } = setup();
    store.execute(move);
    const h = store.getSnapshot().history;
    expect(h.present.nodes[0].position.x).toBe(5);
    expect(h.past).toHaveLength(1);
    expect(edits).toEqual([{ kind: "history", history: h }]);
  });

  it("a rejected command keeps the History and reports errors (16.6)", () => {
    const { store, edits } = setup();
    const before = store.getSnapshot().history;
    store.execute({ kind: "removeNode", id: "missing" });
    expect(store.getSnapshot().history).toBe(before);
    expect(edits).toHaveLength(1);
    const r = edits[0];
    expect(r.kind).toBe("errors");
    if (r.kind === "errors") {
      expect(r.context).toBe("edit");
      expect(r.history).toBe(before);
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });

  it("undo and redo call onEdit once per call, also when nothing changes (16.1, 16.7)", () => {
    const { store, edits } = setup();
    const start = store.getSnapshot().history;
    store.undo();
    expect(edits).toEqual([{ kind: "history", history: start }]);
    expect(store.getSnapshot().history).toBe(start);
    store.execute(move);
    edits.length = 0;
    store.undo();
    expect(edits).toHaveLength(1);
    expect(store.getSnapshot().history.present.nodes[0].position.x).toBe(0);
    store.redo();
    expect(edits).toHaveLength(2);
    expect(store.getSnapshot().history.present.nodes[0].position.x).toBe(5);
    store.redo();
    expect(edits).toHaveLength(3);
    expect(edits.every((e) => e.kind === "history")).toBe(true);
  });

  it("a removed Node clears the Selection through modelChanged", () => {
    const { store } = setup();
    store.dispatch({ type: "select", selection: { kind: "node", id: "n1" } });
    expect(store.getSnapshot().view.selection).toEqual({ kind: "node", id: "n1" });
    store.execute({ kind: "removeNode", id: "n1" });
    expect(store.getSnapshot().view.selection).toBeNull();
  });

  it("setHistory keeps the preset and reports newly missing zone refs (2.8, 3.4)", () => {
    const { store, edits } = setup();
    store.setPreset("p2");
    const view = store.getSnapshot().view;
    const next = makeHistory();
    const noZoneA = createHistory({ ...scenario, zones: [scenario.zones[1]], nodes: [scenario.nodes[1]] });
    if (!noZoneA.ok) throw new Error("bad fixture");
    store.setHistory(noZoneA.history);
    expect(store.getSnapshot().history).toBe(noZoneA.history);
    expect(store.getSnapshot().view.activePresetId).toBe(view.activePresetId);
    expect(edits.some((e) => e.kind === "errors" && e.context === "settings")).toBe(true);
    edits.length = 0;
    store.setHistory(next);
    expect(edits).toEqual([]);
  });
});

describe("ViewStore handle checks", () => {
  it("setPreset with an unknown id reports presetId and changes nothing (8.6)", () => {
    const { store, edits } = setup();
    const before = store.getSnapshot().view;
    store.setPreset("nope");
    expect(store.getSnapshot().view).toBe(before);
    expect(edits).toHaveLength(1);
    const r = edits[0];
    if (r.kind !== "errors") throw new Error("expected errors");
    expect(r.context).toBe("preset");
    expect(r.errors.map((e) => e.path)).toEqual(["presetId"]);
  });

  it("setPreset starts a move from the reported camera and applies the filter when it ends (8.2, 8.3)", () => {
    const { store } = setup();
    store.reportCamera(pose2);
    store.setPreset("p2");
    expect(store.getSnapshot().view.transition?.from).toEqual(pose2);
    expect(store.getSnapshot().view.shownPresetId).toBe("p1");
    store.dispatch({ type: "tick", dt: 0.7 });
    expect(store.getSnapshot().view.shownPresetId).toBe("p2");
  });

  it("setTheme keeps the old Theme on failure (19.7)", () => {
    const { store, edits } = setup();
    const before = store.getSnapshot().theme;
    store.setTheme({ nope: 1 });
    expect(store.getSnapshot().theme).toBe(before);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ kind: "errors", context: "theme" });
    store.setTheme({ ...before, background: "#112233" });
    expect(store.getSnapshot().theme.background).toBe("#112233");
    expect(edits).toHaveLength(1);
  });

  it("setEffects keeps the previous list on failure (10.1)", () => {
    const { store, edits } = setup();
    const good = [{ effect: "haze", target: { kind: "node", id: "n1" }, source: "r" }];
    store.setEffects(good);
    expect(store.getSnapshot().appEffects).toEqual(good);
    store.setEffects([{ effect: "", target: { kind: "node", id: "n1" }, source: "r" }]);
    expect(store.getSnapshot().appEffects).toEqual(good);
    const r = edits[0];
    expect(r).toMatchObject({ kind: "errors", context: "effects" });
    if (r.kind === "errors") expect(r.errors[0].path.startsWith("effects.0")).toBe(true);
  });

  it("startWalk reports bad arguments and changes nothing (17.8, 9.5)", () => {
    const { store, edits } = setup();
    const before = store.getSnapshot().view;
    store.startWalk("nope", 0);
    expect(store.getSnapshot().view).toBe(before);
    const r = edits[0];
    expect(r).toMatchObject({ kind: "errors", context: "walk" });
    if (r.kind === "errors") expect(r.errors.map((e) => e.path)).toEqual(["pathId", "duration"]);
  });

  it("startWalk on a zone path that cannot be built reports paths.<index> (9.5)", () => {
    const { store, edits } = setup();
    const one = createHistory({ ...scenario, zones: [scenario.zones[0]], nodes: [scenario.nodes[0]] });
    if (!one.ok) throw new Error("bad fixture");
    store.setHistory(one.history);
    edits.length = 0;
    store.startWalk("zones", 2);
    expect(store.getSnapshot().view.walk.state).toBe("idle");
    const r = edits[0];
    if (r.kind !== "errors") throw new Error("expected errors");
    expect(r.errors[0].path).toBe("paths.0");
  });

  it("startWalk with a bad linked Timeline reports a timeline path and starts nothing (17.12)", () => {
    const { store, edits } = setup();
    store.startWalk("zones", 2, timeline(["a"]));
    expect(store.getSnapshot().view.walk.state).toBe("idle");
    expect(store.getSnapshot().view.timeline).toBeNull();
    const r = edits[0];
    if (r.kind !== "errors") throw new Error("expected errors");
    expect(r.errors.every((e) => e.path.startsWith("timeline"))).toBe(true);
    store.startWalk("wp", 2, timeline(["a", "b"]));
    expect(store.getSnapshot().view.walk.state).toBe("idle");
  });

  it("a linked walk reports walk and timeline events on flush (17.1, 18.1)", () => {
    const { store, walks, tls } = setup();
    store.startWalk("zones", 2, timeline(["a", "b"]));
    expect(store.getSnapshot().view.walk.state).toBe("playing");
    expect(tls).toEqual([]);
    store.dispatch({ type: "tick", dt: 1 });
    store.flush();
    expect(tls[0]).toEqual({ kind: "position", position: 0 });
    expect(walks).toEqual([["playing", 0.5]]);
    store.flush();
    expect(walks).toHaveLength(1);
    store.dispatch({ type: "tick", dt: 1.5 });
    store.flush();
    expect(walks.at(-1)).toEqual(["finished", 1]);
    expect(tls).toContainEqual({ kind: "end" });
  });

  it("startTimeline rejects a bad Timeline and keeps the playback (18.9)", () => {
    const { store, edits } = setup();
    store.startTimeline(timeline(["a"]));
    const running = store.getSnapshot().view.timeline;
    expect(running).not.toBeNull();
    store.startTimeline({ steps: [] });
    expect(store.getSnapshot().view.timeline).toBe(running);
    expect(edits[0]).toMatchObject({ kind: "errors", context: "timeline" });
  });

  it("connectOn rejects a blank type (15.1)", () => {
    const { store, edits } = setup();
    store.connectOn("  ");
    expect(store.getSnapshot().view.connect).toBeNull();
    const r = edits[0];
    if (r.kind !== "errors") throw new Error("expected errors");
    expect(r.context).toBe("edit");
    expect(r.errors.map((e) => e.path)).toEqual(["edgeType"]);
    store.connectOn("link");
    expect(store.getSnapshot().view.connect).toEqual({ edgeType: "link", first: null });
  });
});

describe("ViewStore single-cause reports", () => {
  it("startWalk with only a bad pathId reports pathId and keeps the view (17.8)", () => {
    const { store, edits } = setup();
    const before = store.getSnapshot().view;
    store.startWalk("nope", 2);
    expect(store.getSnapshot().view).toBe(before);
    const r = edits[0];
    if (r.kind !== "errors") throw new Error("expected errors");
    expect(r.errors.map((e) => e.path)).toEqual(["pathId"]);
  });

  it("startWalk with a duration of 0 reports duration and keeps the Walk_State (17.8)", () => {
    const { store, edits } = setup();
    const before = store.getSnapshot().view;
    store.startWalk("wp", 0);
    expect(store.getSnapshot().view).toBe(before);
    expect(store.getSnapshot().view.walk.state).toBe("idle");
    const r = edits[0];
    if (r.kind !== "errors") throw new Error("expected errors");
    expect(r.errors.map((e) => e.path)).toEqual(["duration"]);
  });

  it("setHistory reports the newly missing zone ref exactly once (2.8)", () => {
    const { store, edits } = setup();
    const noZoneA = createHistory({ ...scenario, zones: [scenario.zones[1]], nodes: [scenario.nodes[1]] });
    if (!noZoneA.ok) throw new Error("bad fixture");
    store.setHistory(noZoneA.history);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ kind: "errors", context: "settings" });
    store.setHistory(noZoneA.history);
    expect(edits).toHaveLength(1);
  });
});

describe("ViewStore subscription and stop", () => {
  it("notifies subscribers with a new snapshot on change only", () => {
    const { store } = setup();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    store.setGizmoMode("scale");
    expect(calls).toBeGreaterThan(0);
    expect(store.getSnapshot()).not.toBe(a);
    const n = calls;
    off();
    store.setGizmoMode("rotate");
    expect(calls).toBe(n);
  });

  it("an idle tick keeps the same snapshot object and does not notify (D17)", () => {
    const { store } = setup();
    let calls = 0;
    store.subscribe(() => calls++);
    const a = store.getSnapshot();
    store.dispatch({ type: "tick", dt: 0.016 });
    store.dispatch({ type: "tick", dt: 0.016 });
    expect(store.getSnapshot()).toBe(a);
    expect(calls).toBe(0);
  });

  it("after stop no callback is called and nothing changes (3.5, 3.6)", () => {
    const { store, edits, walks, tls } = setup();
    store.startTimeline(timeline(["a"]));
    store.stop();
    store.stop();
    const snap = store.getSnapshot();
    store.execute(move);
    store.undo();
    store.setPreset("nope");
    store.setHistory(makeHistory());
    store.startWalk("wp", 1);
    store.dispatch({ type: "tick", dt: 5 });
    store.flush();
    expect(store.getSnapshot()).toBe(snap);
    expect(edits).toEqual([]);
    expect(walks).toEqual([]);
    expect(tls).toEqual([]);
  });
});

describe("ViewStore stop drops pending Timeline events", () => {
  it("stopTimeline before flush gives no position or end callback (18.7)", () => {
    const { store, tls } = setup();
    store.startTimeline(timeline(["a", "b"]));
    store.stopTimeline();
    store.flush();
    expect(tls).toEqual([]);
    expect(store.getSnapshot().view.timeline).toBeNull();
  });

  it("stopWalk of a linked Walkthrough before flush gives no Timeline callback (17.14, 18.7)", () => {
    const { store, tls } = setup();
    store.startWalk("zones", 2, timeline(["a", "b"]));
    store.stopWalk();
    store.flush();
    expect(tls).toEqual([]);
  });

  it("a flushed position stays reported; only later pending ones are dropped", () => {
    const { store, tls } = setup();
    store.startTimeline(timeline(["a", "b"]));
    store.flush();
    expect(tls).toEqual([{ kind: "position", position: 0 }]);
    store.stopTimeline();
    store.flush();
    expect(tls).toHaveLength(1);
  });
});

function setupSelect(withEdge = false, withOnSelect = true) {
  const picks: Selection[] = [];
  const edits: EditReport[] = [];
  const theme = loadTheme(NEUTRAL_THEME);
  if (!theme.ok) throw new Error("bad theme");
  const s = settings();
  const h = createHistory(
    withEdge ? { ...scenario, edges: [{ id: "e1", from: "n1", to: "n2", type: "link" }] } : scenario,
  );
  if (!h.ok) throw new Error("bad fixture");
  const store = new ViewStore({
    history: h.history,
    settings: s,
    theme: theme.theme,
    view: initialViewState(s),
    onEdit: (r) => edits.push(r),
    onWalk: () => undefined,
    onTimeline: () => undefined,
    ...(withOnSelect ? { onSelect: (sel: Selection) => picks.push(sel) } : {}),
  });
  return { store, picks, edits };
}

const nodeSel = (id: string): ViewAction => ({ type: "select", selection: { kind: "node", id } });

describe("ViewStore onSelect (R-VIEW-22)", () => {
  it("is not called at start or on flush with nothing changed (22.1)", () => {
    const { store, picks } = setupSelect();
    store.flush();
    expect(picks).toEqual([]);
  });

  it("is called once per change after flush, with a copy (22.2)", () => {
    const { store, picks } = setupSelect();
    store.dispatch(nodeSel("n1"));
    expect(picks).toEqual([]);
    store.flush();
    expect(picks).toEqual([{ kind: "node", id: "n1" }]);
    expect(picks[0]).not.toBe(store.getSnapshot().view.selection);
    store.dispatch(nodeSel("n2"));
    store.emptyClick();
    store.flush();
    expect(picks).toEqual([{ kind: "node", id: "n1" }, { kind: "node", id: "n2" }, null]);
  });

  it("is not called again for a repeated select of the same Node (22.3)", () => {
    const { store, picks } = setupSelect();
    store.dispatch(nodeSel("n1"));
    store.flush();
    store.dispatch(nodeSel("n1"));
    store.flush();
    expect(picks).toHaveLength(1);
  });

  it("is not called after stop even with an event pending (22.5)", () => {
    const { store, picks } = setupSelect();
    store.dispatch(nodeSel("n1"));
    store.stop();
    store.flush();
    expect(picks).toEqual([]);
  });

  it("a store with no onSelect works (3.10)", () => {
    const { store } = setupSelect(false, false);
    store.dispatch(nodeSel("n1"));
    store.flush();
    expect(store.getSnapshot().view.selection).toEqual({ kind: "node", id: "n1" });
  });

  it("a ViewPreset that hides the selected Edge clears it with one onSelect(null) (23.6, 22.4)", () => {
    const { store, picks } = setupSelect(true);
    store.dispatch({ type: "select", selection: { kind: "edge", id: "e1" } });
    store.flush();
    expect(picks).toEqual([{ kind: "edge", id: "e1" }]);
    store.setPreset("p2");
    store.dispatch({ type: "tick", dt: 0.6 });
    store.flush();
    expect(store.getSnapshot().view.selection).toBeNull();
    expect(picks).toEqual([{ kind: "edge", id: "e1" }, null]);
  });
});

describe("ViewStore cancelGesture and execute (R-VIEW-23.10 to 23.12)", () => {
  it("cancelGesture clears preview, gestureActive, and a pending first Node (23.12)", () => {
    const { store } = setupSelect();
    store.connectOn("link");
    store.dispatch({ type: "connectClick", id: "n1" });
    store.setGestureActive(true);
    store.setPreview(new Map([["n1", { position: { x: 9, y: 0, z: 0 } }]]));
    store.cancelGesture();
    expect(store.gestureActive).toBe(false);
    expect(store.getSnapshot().preview.size).toBe(0);
    expect(store.getSnapshot().view.connect).toEqual({ edgeType: "link", first: null });
  });

  it("cancelGesture with no Gesture changes nothing", () => {
    const { store } = setupSelect();
    const snap = store.getSnapshot();
    store.cancelGesture();
    expect(store.getSnapshot()).toBe(snap);
  });

  it("execute after cancelGesture applies the command once (23.10, 23.12)", () => {
    const { store, edits } = setupSelect();
    store.setGestureActive(true);
    store.setPreview(new Map([["n1", { position: { x: 9, y: 0, z: 0 } }]]));
    store.cancelGesture();
    store.execute(move);
    expect(store.getSnapshot().history.past).toHaveLength(1);
    expect(store.getSnapshot().history.present.nodes[0].position.x).toBe(5);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("history");
  });

  it("a rejected command keeps the History and the Selection (23.11)", () => {
    const { store, edits } = setupSelect(true);
    store.dispatch({ type: "select", selection: { kind: "edge", id: "e1" } });
    const before = store.getSnapshot().history;
    store.execute({ kind: "removeNode", id: "missing" });
    expect(store.getSnapshot().history).toBe(before);
    expect(store.getSnapshot().view.selection).toEqual({ kind: "edge", id: "e1" });
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ kind: "errors", context: "edit" });
  });

  it("a removed selected Edge clears the Selection (23.6)", () => {
    const { store } = setupSelect(true);
    store.dispatch({ type: "select", selection: { kind: "edge", id: "e1" } });
    store.execute({ kind: "removeEdge", id: "e1" });
    expect(store.getSnapshot().view.selection).toBeNull();
  });

  it("works in view mode and leaves a playing walk and the Timeline unchanged (12.7, 13.8, 17.4, 20.5)", () => {
    const { store } = setupSelect();
    store.setEditMode("view");
    store.startWalk("wp", 2);
    const view = store.getSnapshot().view;
    expect(view.walk.state).toBe("playing");
    store.execute(move);
    const after = store.getSnapshot().view;
    expect(store.getSnapshot().history.present.nodes[0].position.x).toBe(5);
    expect(after.walk).toEqual(view.walk);
    expect(after.timeline).toEqual(view.timeline);
    expect(after.editMode).toBe("view");
  });

  it("after stop execute changes nothing and calls no callback (3.6)", () => {
    const { store, edits, picks } = setupSelect();
    store.stop();
    const snap = store.getSnapshot();
    store.cancelGesture();
    store.execute(move);
    expect(store.getSnapshot()).toBe(snap);
    expect(edits).toEqual([]);
    expect(picks).toEqual([]);
  });
});
