/**
 * BoardController example tests for the behaviour of tasks 9.2 and 9.3 (design.md "Controller" and
 * "Testing Strategy"): start, zones, Restart, gestures, undo and redo, settings, marks, viewpoints, gizmo modes.
 * Runs in Node with recording stubs; no DOM, no three.js, no React.
 */
import { describe, expect, it } from "vitest";
import type { EditCommand } from "../../core/model/commands.ts";
import { createHistory, executeCommand, redo as redoHistory, undo as undoHistory, type History } from "../../core/model/history.ts";
import type { EffectRequest } from "../../core/model/rule-schema.ts";
import type { ViewSettings } from "../../core/view/helpers/settings-schema.ts";
import { BoardController, type BoardViewState, type FileLike, type ImagePort, type ViewPort } from "./controller.ts";
import { loadBoardData, type BoardData } from "./model/board-data.ts";
import { BUNDLED } from "./model/bundled.ts";
import { newImageId } from "./model/commands.ts";
import { HINT_EDITING_LOCKED, HINT_NEEDS_TWO_ZONES } from "./model/controls.ts";
import { ImageStore } from "./model/image-store.ts";
import { routeFootprints, walkDuration } from "./model/layout.ts";
import type { ReadResult } from "./model/pixels.ts";
import { checkMood } from "./model/shift-check.ts";
import { linkedTimeline } from "./model/walk.ts";
import * as text from "./text.ts";

type Call = { name: string; arg?: unknown };

type Stub = {
  view: ViewPort;
  calls: Call[];
  history: History;
  controller: BoardController | null;
  failOn: Set<string>;
  failAfterExecute: boolean;
  rejectExecute: boolean;
};

function loadData(): BoardData {
  const loaded = loadBoardData(BUNDLED);
  if (!loaded.ok) throw new Error("bundled data invalid");
  return loaded.data;
}

function makeHistory(data: BoardData): History {
  const created = createHistory(data.scenario);
  if (!created.ok) throw new Error("history invalid");
  return created.history;
}

/** A recording ViewPort whose execute, undo and redo mimic ViewStore: commit, then report synchronously. */
function makeStub(history: History): Stub {
  const stub: Stub = { view: null as unknown as ViewPort, calls: [], history, controller: null, failOn: new Set(), failAfterExecute: false, rejectExecute: false };
  const record = (name: string, arg?: unknown): void => {
    stub.calls.push({ name, arg });
    if (stub.failOn.has(name)) throw new Error(`stub ${name} failed`);
  };
  const report = (): void => {
    stub.controller?.onEdit({ kind: "history", history: stub.history });
  };
  stub.view = {
    setHistory: (h: History) => {
      record("setHistory", h);
      stub.history = h; // sends no report
    },
    setPreset: (id: string) => record("setPreset", id),
    setEffects: (effects: readonly EffectRequest[]) => {
      record("setEffects", effects);
    },
    setEditMode: (mode) => record("setEditMode", mode),
    setGizmoMode: (mode) => record("setGizmoMode", mode),
    undo: () => {
      record("undo");
      stub.history = undoHistory(stub.history);
      report();
    },
    redo: () => {
      record("redo");
      stub.history = redoHistory(stub.history);
      report();
    },
    execute: (command: EditCommand) => {
      record("execute", command);
      if (stub.rejectExecute) return; // the Core_View refused the command: no commit, no report
      const result = executeCommand(stub.history, command);
      if (result.ok) {
        stub.history = result.history;
        report();
      }
      if (stub.failAfterExecute) throw new Error("stub execute failed after commit");
    },
    startWalk: (...args) => record("startWalk", args),
    pauseWalk: () => record("pauseWalk"),
    resumeWalk: () => record("resumeWalk"),
    stopWalk: () => record("stopWalk"),
    stopTimeline: () => record("stopTimeline"),
    restart: (h: History, settings: ViewSettings) => {
      record("restart", { history: h, settings });
      stub.history = h;
    },
  };
  return stub;
}

const images: ImagePort = {
  read: () => Promise.resolve({ ok: false, reason: "decode" }),
  release: () => undefined,
};

type Rig = {
  controller: BoardController;
  stub: Stub;
  data: BoardData;
  store: ImageStore;
  states: BoardViewState[];
  last(): BoardViewState;
  names(): string[];
};

function rig(
  options: {
    history?: History;
    data?: BoardData;
    read?: (file: FileLike) => Promise<ReadResult>;
    releaseUrl?: (url: string) => void;
  } = {},
): Rig {
  const data = options.data ?? loadData();
  const history = options.history ?? makeHistory(data);
  const stub = makeStub(history);
  const store = new ImageStore(options.releaseUrl ?? (() => undefined));
  const states: BoardViewState[] = [];
  const port: ImagePort = {
    read: (file) => {
      const named = file as FileLike;
      stub.calls.push({ name: "read", arg: named.name });
      return options.read === undefined ? images.read(named) : options.read(named);
    },
    release: (url) => {
      stub.calls.push({ name: "release", arg: url });
    },
  };
  const controller = new BoardController(data, history, store, stub.view, port, { render: (s) => states.push(s) });
  stub.controller = controller;
  return {
    controller,
    stub,
    data,
    store,
    states,
    last: () => {
      const s = states.at(-1);
      if (s === undefined) throw new Error("nothing rendered");
      return s;
    },
    names: () => stub.calls.map((c) => c.name),
  };
}

function effectsOf(calls: Call[]): EffectRequest[][] {
  return calls.filter((c) => c.name === "setEffects").map((c) => c.arg as EffectRequest[]);
}

function expectedEffects(data: BoardData, marks: string[] = []): EffectRequest[] {
  const result = checkMood(data.scenario, data.settings, marks, data.rules);
  if (!result.ok) throw new Error("demo board must check");
  return result.value.effects;
}

/** Simulate the end of a drag: the Core_View commits a position change, then reports it with no `pending`. */
function drag(r: Rig, nodeId: string, x: number, z: number): void {
  const node = r.stub.history.present.nodes.find((n) => n.id === nodeId);
  if (node === undefined) throw new Error("no such node");
  const result = executeCommand(r.stub.history, {
    kind: "updateNode",
    id: nodeId,
    changes: { position: { x, y: node.position.y, z } },
  });
  if (!result.ok) throw new Error("drag rejected");
  r.stub.history = result.history;
  r.controller.onEdit({ kind: "history", history: result.history });
}

function firstNode(r: Rig): { id: string; zone: string } {
  const node = r.stub.history.present.nodes[0];
  if (node?.zone === undefined) throw new Error("demo node expected");
  return { id: node.id, zone: node.zone };
}

describe("start", () => {
  it("sends the Demo_Board effects once and renders", () => {
    const r = rig();
    r.controller.start();
    expect(effectsOf(r.stub.calls)).toStrictEqual([expectedEffects(r.data)]);
    expect(r.last().curve).not.toBeNull();
    expect(r.last().presetId).toBe("overview");
    expect(r.last().zones[0]?.role).toBe("entrance");
    expect(r.last().zones.at(-1)?.role).toBe("exit");
  });

  it("gives setEffects([]) and the mood message on a Rule_Failure", () => {
    const data = loadData();
    const broken = { ...data.scenario, nodes: "no" } as unknown as History["present"];
    const history: History = { past: [], present: broken, future: [], limit: 100 };
    const r = rig({ data, history });
    r.controller.start();
    expect(effectsOf(r.stub.calls)).toStrictEqual([[]]);
    expect(r.last().notice).toStrictEqual(text.msgMoodFailed);
    expect(r.last().curve).toBeNull();
  });
});

describe("zones and Restart", () => {
  it("add zone: execute, then after the microtask restart with the active preset first, setEffects, setGizmoMode", async () => {
    const r = rig();
    r.controller.start();
    r.controller.act("visitor");
    r.controller.act("scaleMode");
    r.stub.calls.length = 0;
    r.controller.act("addZone");
    expect(r.names()).toStrictEqual(["execute", "setEffects"]);
    expect((r.stub.calls[0]?.arg as EditCommand).kind).toBe("addZone");
    await Promise.resolve();
    expect(r.names()).toStrictEqual(["execute", "setEffects", "restart", "setEffects", "setGizmoMode"]);
    const restart = r.stub.calls[2]?.arg as { history: History; settings: ViewSettings };
    expect(restart.history).toBe(r.stub.history);
    expect(restart.history.present.zones).toHaveLength(r.data.scenario.zones.length + 1);
    expect(restart.settings.presets[0]?.id).toBe("visitor");
    expect(restart.settings.zoneFootprints).toHaveLength(restart.history.present.zones.length);
    expect(r.stub.calls[4]?.arg).toBe("scale");
    expect(r.last().walk).toBe("idle");
    expect(r.last().zones).toHaveLength(r.data.scenario.zones.length + 1);
  });

  it("undo of an add zone restarts too", async () => {
    const r = rig();
    r.controller.start();
    r.controller.act("addZone");
    await Promise.resolve();
    r.stub.calls.length = 0;
    r.controller.act("undo");
    expect(r.names()[0]).toBe("undo");
    await Promise.resolve();
    expect(r.names()).toContain("restart");
    expect(r.last().zones).toHaveLength(r.data.scenario.zones.length);
    expect(r.last().controls.redo).toBe(true);
  });

  it("remove zone drops its mark", async () => {
    const r = rig();
    r.controller.start();
    r.controller.act("addZone");
    await Promise.resolve();
    const added = r.last().zones.at(-1)?.id;
    expect(added).toBeDefined();
    r.controller.act("mark", added);
    expect(r.last().marks).toStrictEqual([added]);
    r.controller.act("removeZone", added);
    await Promise.resolve();
    expect(r.last().marks).toStrictEqual([]);
    expect(r.last().zones).toHaveLength(r.data.scenario.zones.length);
  });

  it("remove zone with images or below 2 zones makes a message and no call", () => {
    const r = rig();
    r.controller.start();
    r.stub.calls.length = 0;
    r.controller.act("removeZone", firstNode(r).zone);
    expect(r.names()).toStrictEqual([]);
    expect(r.last().notice).toStrictEqual(text.msgZoneHasImages);
  });

  it("an unchanged Zone list causes no restart", async () => {
    const r = rig();
    r.controller.start();
    const node = firstNode(r);
    r.controller.onSelect({ kind: "node", id: node.id });
    r.controller.act("removeImage");
    await Promise.resolve();
    expect(r.names()).not.toContain("restart");
  });
});

describe("gestures", () => {
  function otherZoneCenter(r: Rig, from: string): { zone: string; x: number; z: number } {
    const fp = routeFootprints(r.stub.history.present.zones).find((f) => f.id !== from);
    if (fp === undefined || fp.kind !== "rect") throw new Error("rect footprint expected");
    return { zone: fp.id, x: fp.x, z: fp.z };
  }

  it("a move into another Zone sends exactly one nested execute(updateNode zone)", () => {
    const r = rig();
    r.controller.start();
    const node = firstNode(r);
    const target = otherZoneCenter(r, node.zone);
    r.stub.calls.length = 0;
    drag(r, node.id, target.x, target.z);
    const executes = r.stub.calls.filter((c) => c.name === "execute");
    expect(executes).toHaveLength(1);
    expect(executes[0]?.arg).toStrictEqual({ kind: "updateNode", id: node.id, changes: { zone: target.zone } });
    // controller History equals the stub History, the node is now in the target Zone
    const nodeAfter = r.stub.history.present.nodes.find((n) => n.id === node.id);
    expect(nodeAfter?.zone).toBe(target.zone);
    // one recompute per History change: the drag report is superseded by the nested execute, so the final History is recomputed once
    expect(effectsOf(r.stub.calls)).toHaveLength(1);
  });

  it("pending is back to null after the nested execute", () => {
    const r = rig();
    r.controller.start();
    const node = firstNode(r);
    const target = otherZoneCenter(r, node.zone);
    drag(r, node.id, target.x, target.z);
    // a second, independent Gesture is still read as a Gesture (an App action would be ignored by classifyMove)
    r.stub.calls.length = 0;
    const back = otherZoneCenter(r, target.zone);
    drag(r, node.id, back.x, back.z);
    expect(r.stub.calls.filter((c) => c.name === "execute")).toHaveLength(1);
  });

  it("a move into the gap calls setHistory(prev), shows the message, and restores the controller History", () => {
    const r = rig();
    r.controller.start();
    const node = firstNode(r);
    const before = r.stub.history;
    const fps = routeFootprints(before.present.zones);
    const a = fps[0];
    const b = fps[1];
    if (a === undefined || b === undefined || a.kind !== "rect" || b.kind !== "rect") throw new Error("footprints");
    r.stub.calls.length = 0;
    drag(r, node.id, 0, (a.z + b.z) / 2);
    const setHistoryCalls = r.stub.calls.filter((c) => c.name === "setHistory");
    expect(setHistoryCalls).toHaveLength(1);
    expect(setHistoryCalls[0]?.arg).toBe(before);
    expect(r.stub.calls.some((c) => c.name === "execute")).toBe(false);
    expect(r.stub.history).toBe(before);
    expect(r.last().notice).toStrictEqual(text.msgImageInZone);
    // setHistory sent no report, yet the controller is on `before`: undo is disabled (no past)
    expect(r.last().controls.undo).toBe(false);
    expect(effectsOf(r.stub.calls)).toHaveLength(1);
  });

  it("a move inside the same Zone sends no follow-up command", () => {
    const r = rig();
    r.controller.start();
    const node = firstNode(r);
    const fp = routeFootprints(r.stub.history.present.zones).find((f) => f.id === node.zone);
    if (fp === undefined || fp.kind !== "rect") throw new Error("rect footprint expected");
    r.stub.calls.length = 0;
    drag(r, node.id, fp.x + 0.5, fp.z);
    expect(r.names()).not.toContain("execute");
    expect(r.names()).not.toContain("setHistory");
  });

  it("a move into another Zone takes two undo steps back to the start", async () => {
    const r = rig();
    r.controller.start();
    const node = firstNode(r);
    const start = r.stub.history;
    const target = otherZoneCenter(r, node.zone);
    drag(r, node.id, target.x, target.z);
    r.controller.act("undo");
    expect(r.stub.history.present.nodes.find((n) => n.id === node.id)?.zone).toBe(node.zone);
    expect(r.last().controls.undo).toBe(true);
    r.controller.act("undo");
    await Promise.resolve();
    expect(r.stub.history.present).toStrictEqual(start.present);
    expect(r.last().controls.undo).toBe(false);
    expect(r.last().controls.redo).toBe(true);
  });
});

describe("undo, redo, remove image", () => {
  it("undo and redo recompute and prune", () => {
    const r = rig();
    r.controller.start();
    const node = firstNode(r);
    const reference = r.stub.history.present.nodes.find((n) => n.id === node.id)?.front.image;
    expect(typeof reference).toBe("string");
    r.store.put(reference as string, "blob:one");
    // keep another node holding the same reference out of the way: use a fresh reference only the removed node has
    r.controller.onSelect({ kind: "node", id: node.id });
    r.controller.act("removeImage");
    expect(r.stub.history.present.nodes.some((n) => n.id === node.id)).toBe(false);
    expect(r.last().selection).toBe(node.id); // the Core_View reports the cleared selection via onSelect
    const afterRemove = effectsOf(r.stub.calls).length;
    expect(afterRemove).toBeGreaterThanOrEqual(2);
    r.controller.act("undo");
    expect(r.stub.history.present.nodes.some((n) => n.id === node.id)).toBe(true);
    expect(effectsOf(r.stub.calls)).toHaveLength(afterRemove + 1);
    expect(r.store.url(reference as string)).toBe("blob:one"); // still in the History (future/present), not pruned
    r.controller.act("redo");
    expect(r.stub.history.present.nodes.some((n) => n.id === node.id)).toBe(false);
    expect(effectsOf(r.stub.calls)).toHaveLength(afterRemove + 2);
  });

  it("prunes a reference that no History entry holds any more", () => {
    const r = rig();
    r.controller.start();
    r.store.put("upload:ghost", "blob:ghost");
    r.controller.act("addZone"); // a History change runs prune against past, present, future
    expect(r.store.url("upload:ghost")).toBeNull();
  });

  it("remove image without a selection does nothing; with one it executes removeNode", () => {
    const r = rig();
    r.controller.start();
    r.stub.calls.length = 0;
    r.controller.act("removeImage");
    expect(r.names()).toStrictEqual([]);
    const node = firstNode(r);
    r.controller.onSelect({ kind: "node", id: node.id });
    r.controller.act("removeImage");
    expect(r.stub.calls.find((c) => c.name === "execute")?.arg).toStrictEqual({ kind: "removeNode", id: node.id });
  });

  it("disabled undo and redo make no call", () => {
    const r = rig();
    r.controller.start();
    r.stub.calls.length = 0;
    r.controller.act("undo");
    r.controller.act("redo");
    expect(r.names()).toStrictEqual([]);
  });
});

describe("gizmo modes and viewpoints", () => {
  it("Scale and Rotate buttons call setGizmoMode and update the state", () => {
    const r = rig();
    r.controller.start();
    r.controller.act("scaleMode");
    expect(r.stub.calls.at(-1)).toStrictEqual({ name: "setGizmoMode", arg: "scale" });
    expect(r.last().gizmoMode).toBe("scale");
    r.controller.act("rotateMode");
    expect(r.stub.calls.at(-1)).toStrictEqual({ name: "setGizmoMode", arg: "rotate" });
    expect(r.last().gizmoMode).toBe("rotate");
    expect(r.last().controls.undo).toBe(false); // no History change
  });

  it("viewpoint buttons call setPreset", () => {
    const r = rig();
    r.controller.start();
    r.controller.act("visitor");
    expect(r.stub.calls.at(-1)).toStrictEqual({ name: "setPreset", arg: "visitor" });
    expect(r.last().presetId).toBe("visitor");
    r.controller.act("overview");
    expect(r.stub.calls.at(-1)).toStrictEqual({ name: "setPreset", arg: "overview" });
    expect(r.last().presetId).toBe("overview");
  });

  it("a finished walk is stopped before the preset changes", () => {
    const r = rig();
    r.controller.start();
    r.controller.onWalk("finished", 1);
    r.stub.calls.length = 0;
    r.controller.act("visitor");
    expect(r.names()).toStrictEqual(["stopWalk", "setPreset"]);
    expect(r.last().walk).toBe("idle");
  });
});

describe("settings", () => {
  it("an invalid text keeps the settings and sets the field notice", () => {
    const r = rig();
    r.controller.start();
    const before = r.last().settings;
    r.stub.calls.length = 0;
    r.controller.setSetting("shiftThreshold", "abc");
    expect(r.last().settings).toStrictEqual(before);
    expect(r.last().fieldNotice).toBe("shiftThreshold");
    expect(r.names()).toStrictEqual([]);
    r.controller.setSetting("minRunLength", "1");
    expect(r.last().fieldNotice).toBe("minRunLength");
  });

  it("a valid text recomputes with the new settings and clears the field notice", () => {
    const r = rig();
    r.controller.start();
    expect(r.last().flags.some((f) => f.reason.kind === "sudden-brightening")).toBe(true);
    r.controller.setSetting("shiftThreshold", "abc");
    r.stub.calls.length = 0;
    r.controller.setSetting("shiftThreshold", "5");
    expect(r.last().fieldNotice).toBeNull();
    expect(r.last().settings.shiftThreshold).toBe(5);
    expect(effectsOf(r.stub.calls)).toHaveLength(1);
    expect(r.last().flags.some((f) => f.reason.kind === "sudden-brightening")).toBe(false);
    expect(effectsOf(r.stub.calls)[0]).toStrictEqual(
      expectedEffectsWith(r.data, { ...r.data.settings, shiftThreshold: 5 }),
    );
  });

  it("settings are disabled while a walk plays", () => {
    const r = rig();
    r.controller.start();
    r.controller.onWalk("playing", 0.1);
    r.stub.calls.length = 0;
    r.controller.setSetting("shiftThreshold", "5");
    expect(r.names()).toStrictEqual([]);
    expect(r.last().settings).toStrictEqual(r.data.settings);
  });
});

function expectedEffectsWith(data: BoardData, settings: BoardData["settings"]): EffectRequest[] {
  const result = checkMood(data.scenario, settings, [], data.rules);
  if (!result.ok) throw new Error("demo board must check");
  return result.value.effects;
}

describe("marks", () => {
  function flagged(r: Rig): string {
    const flag = r.last().flags.find((f) => f.reason.kind === "sudden-brightening");
    if (flag === undefined) throw new Error("the Demo_Board has a sudden brightening flag");
    return flag.zone;
  }

  it("mark and unmark recompute and change the effects", () => {
    const r = rig();
    r.controller.start();
    const zone = flagged(r);
    const flagsBefore = r.last().flags.length;
    r.stub.calls.length = 0;
    r.controller.act("mark", zone);
    expect(r.last().marks).toStrictEqual([zone]);
    expect(r.last().flags.some((f) => f.zone === zone && f.reason.kind === "sudden-brightening")).toBe(false);
    expect(r.last().flags.length).toBeLessThan(flagsBefore);
    expect(effectsOf(r.stub.calls)).toStrictEqual([expectedEffects(r.data, [zone])]);
    r.controller.unmark(zone);
    expect(r.last().marks).toStrictEqual([]);
    expect(r.last().flags).toHaveLength(flagsBefore);
    expect(effectsOf(r.stub.calls).at(-1)).toStrictEqual(expectedEffects(r.data));
  });

  it("an unknown Zone id or a repeated mark changes nothing", () => {
    const r = rig();
    r.controller.start();
    const zone = flagged(r);
    r.controller.act("mark", "no-such-zone");
    expect(r.last().marks).toStrictEqual([]);
    r.controller.act("mark", zone);
    r.controller.act("mark", zone);
    expect(r.last().marks).toStrictEqual([zone]);
  });

  it("marks are disabled while a walk plays", () => {
    const r = rig();
    r.controller.start();
    const zone = flagged(r);
    r.controller.onWalk("paused", 0.5);
    r.controller.act("mark", zone);
    expect(r.last().marks).toStrictEqual([]);
  });
});

describe("failures and messages", () => {
  it("a throwing stub leaves settings and marks unchanged and shows the failure message", () => {
    const r = rig();
    r.controller.start();
    const zone = r.last().zones[1]?.id ?? "";
    r.stub.failOn.add("setEffects");
    r.controller.act("mark", zone);
    expect(r.last().marks).toStrictEqual([]);
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
    r.controller.setSetting("shiftThreshold", "5");
    expect(r.last().settings).toStrictEqual(r.data.settings);
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
  });

  it("a throw after the History changed puts the old History back with setHistory", () => {
    const r = rig();
    r.controller.start();
    const before = r.stub.history;
    r.stub.failAfterExecute = true;
    r.stub.calls.length = 0;
    r.controller.act("addZone");
    const restored = r.stub.calls.filter((c) => c.name === "setHistory");
    expect(restored).toHaveLength(1);
    expect(restored[0]?.arg).toBe(before);
    expect(r.stub.history).toBe(before);
    expect(r.last().zones).toHaveLength(r.data.scenario.zones.length);
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
  });

  it("each message replaces the previous one", () => {
    const r = rig();
    r.controller.start();
    r.controller.act("removeZone", firstNode(r).zone);
    expect(r.last().notice).toStrictEqual(text.msgZoneHasImages);
    r.controller.onEdit({ kind: "errors", context: "edit", errors: [] });
    expect(r.last().notice).toStrictEqual(text.msgChangeFailed);
    const node = firstNode(r);
    const fps = routeFootprints(r.stub.history.present.zones);
    const a = fps[0];
    const b = fps[1];
    if (a === undefined || b === undefined) throw new Error("footprints");
    drag(r, node.id, 0, (a.z + b.z) / 2);
    expect(r.last().notice).toStrictEqual(text.msgImageInZone);
  });
});

// ---- task 9.6: images, walkthrough, errors ------------------------------------------------------------

function file(name: string, type = "image/png"): FileLike {
  return Object.assign(new Blob(["x"], { type }), { name });
}

const okRead = (name: string): ReadResult => ({
  ok: true,
  pixels: { width: 1, height: 1, data: [200, 200, 200, 255] },
  displayUrl: `blob:${name}`,
});

function addNodeCalls(r: Rig): { id: string; image: unknown }[] {
  return r.stub.calls
    .filter((c) => c.name === "execute" && (c.arg as EditCommand).kind === "addNode")
    .map((c) => {
      const node = (c.arg as Extract<EditCommand, { kind: "addNode" }>).node;
      return { id: node.id, image: node.front.image };
    });
}

function shownNotices(r: Rig): string[] {
  const seen: string[] = [];
  for (const s of r.states) {
    if (s.notice !== null && seen.at(-1) !== s.notice.en) seen.push(s.notice.en);
  }
  return seen;
}

describe("addFiles", () => {
  it("keeps going after a failed file: two addNode calls in order and one message", async () => {
    const r = rig({ read: (f) => Promise.resolve(f.name === "b.png" ? { ok: false, reason: "decode" } : okRead(f.name)) });
    r.controller.start();
    const before = r.stub.history.present.nodes.length;
    await r.controller.addFiles([file("a.png"), file("b.png"), file("c.png")]);
    expect(addNodeCalls(r).map((n) => n.image)).toStrictEqual(["upload:0", "upload:1"]);
    expect(r.stub.history.present.nodes).toHaveLength(before + 2);
    expect(shownNotices(r)).toStrictEqual([text.msgFileUnreadable("b.png").en]);
    expect(r.store.url("upload:0")).toBe("blob:a.png");
    expect(r.store.url("upload:1")).toBe("blob:c.png");
    expect(r.last().busy).toBe(false);
  });

  it("sets view mode before the first read and edit mode after the last file", async () => {
    const r = rig({ read: (f) => Promise.resolve(okRead(f.name)) });
    r.controller.start();
    r.stub.calls.length = 0;
    await r.controller.addFiles([file("a.png"), file("b.png")]);
    const frame = r.stub.calls.filter((c) => c.name === "setEditMode" || c.name === "read");
    expect(frame).toStrictEqual([
      { name: "setEditMode", arg: "view" },
      { name: "read", arg: "a.png" },
      { name: "read", arg: "b.png" },
      { name: "setEditMode", arg: "edit" },
    ]);
    expect(r.states.some((s) => s.busy)).toBe(true);
    expect(r.last().busy).toBe(false);
    expect(r.last().controls.addImages).toBe(true);
  });

  it("returns to edit mode when a read throws, with the failure message", async () => {
    const r = rig({
      read: (f) => (f.name === "b.png" ? Promise.reject(new Error("read failed")) : Promise.resolve(okRead(f.name))),
    });
    r.controller.start();
    r.stub.calls.length = 0;
    await r.controller.addFiles([file("a.png"), file("b.png"), file("c.png")]);
    expect(r.stub.calls.filter((c) => c.name === "read").map((c) => c.arg)).toStrictEqual(["a.png", "b.png"]);
    const modes = r.stub.calls.filter((c) => c.name === "setEditMode");
    expect(modes.at(-1)).toStrictEqual({ name: "setEditMode", arg: "edit" });
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
    expect(r.last().busy).toBe(false);
  });

  it("builds each addImage command from the present at execution time", async () => {
    let injected: string | null = null;
    let holder: Rig | null = null;
    const r = rig({
      read: (f) => {
        if (f.name === "a.png" && holder !== null) {
          // while the read is awaited, another change reaches the History
          const h = holder;
          const node = h.stub.history.present.nodes[0];
          if (node === undefined) throw new Error("demo node expected");
          injected = newImageId(h.stub.history.present);
          const result = executeCommand(h.stub.history, { kind: "addNode", node: { ...node, id: injected } });
          if (!result.ok) throw new Error("injection rejected");
          h.stub.history = result.history;
          h.controller.onEdit({ kind: "history", history: result.history });
        }
        return Promise.resolve(okRead(f.name));
      },
    });
    holder = r;
    r.controller.start();
    await r.controller.addFiles([file("a.png")]);
    const added = addNodeCalls(r);
    expect(injected).not.toBeNull();
    expect(added).toHaveLength(1);
    expect(added[0]?.id).not.toBe(injected);
    expect(r.stub.history.present.nodes.some((n) => n.id === injected)).toBe(true);
    expect(r.stub.history.present.nodes.some((n) => n.id === added[0]?.id)).toBe(true);
  });

  it("removes the store entry when the Core_View does not commit the command", async () => {
    const r = rig({ read: (f) => Promise.resolve(okRead(f.name)) });
    r.controller.start();
    r.stub.rejectExecute = true;
    const before = r.stub.history;
    await r.controller.addFiles([file("a.png")]);
    expect(r.stub.history).toBe(before);
    expect(r.store.url("upload:0")).toBeNull();
  });

  it("shows the limit message for the 51st image and reads nothing", async () => {
    const data = loadData();
    const base = data.scenario;
    const template = base.nodes[0];
    if (template === undefined) throw new Error("demo node expected");
    const nodes = Array.from({ length: 50 }, (_, i) => ({ ...template, id: `pad-${i}` }));
    const full = { ...base, nodes };
    const created = createHistory(full);
    if (!created.ok) throw new Error("padded history invalid");
    const r = rig({ data, history: created.history, read: (f) => Promise.resolve(okRead(f.name)) });
    r.controller.start();
    r.stub.calls.length = 0;
    await r.controller.addFiles([file("a.png")]);
    expect(r.last().notice).toStrictEqual(text.msgMaxImages);
    expect(r.stub.calls.some((c) => c.name === "read" || c.name === "execute")).toBe(false);
  });

  it("releases the display URL and shows the message after an Analysis_Failure", async () => {
    const r = rig({
      read: () =>
        Promise.resolve({ ok: true, pixels: { width: 2, height: 2, data: [1, 2, 3] }, displayUrl: "blob:bad" }),
    });
    r.controller.start();
    r.stub.calls.length = 0;
    await r.controller.addFiles([file("bad.png")]);
    expect(r.stub.calls.filter((c) => c.name === "release")).toStrictEqual([{ name: "release", arg: "blob:bad" }]);
    expect(r.stub.calls.some((c) => c.name === "execute")).toBe(false);
    expect(r.last().notice).toStrictEqual(text.msgFileNoPixels("bad.png"));
  });

  it("a dropped link gives the message and no call", () => {
    const r = rig();
    r.controller.start();
    r.stub.calls.length = 0;
    r.controller.dropText();
    expect(r.names()).toStrictEqual([]);
    expect(r.last().notice).toStrictEqual(text.msgLinksNotLoaded);
  });

  it("puts the old History back when the Core_View throws after the commit, and ends in edit mode", async () => {
    const r = rig({ read: (f) => Promise.resolve(okRead(f.name)) });
    r.controller.start();
    const before = r.stub.history;
    r.stub.failAfterExecute = true;
    r.stub.calls.length = 0;
    await r.controller.addFiles([file("a.png"), file("b.png")]);
    const restored = r.stub.calls.filter((c) => c.name === "setHistory");
    expect(restored).toHaveLength(1);
    expect(restored[0]?.arg).toBe(before);
    expect(r.stub.history).toBe(before);
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
    expect(r.stub.calls.filter((c) => c.name === "setEditMode").at(-1)?.arg).toBe("edit");
    expect(r.last().busy).toBe(false);
  });

  it("removes the Image_Store entry and releases its display URL when execute throws", async () => {
    const released: string[] = [];
    const r = rig({ read: (f) => Promise.resolve(okRead(f.name)), releaseUrl: (u) => released.push(u) });
    r.controller.start();
    const before = r.stub.history;
    r.stub.failAfterExecute = true;
    await r.controller.addFiles([file("a.png")]);
    expect(r.store.url("upload:0")).toBeNull();
    expect(released).toStrictEqual(["blob:a.png"]);
    expect(r.stub.history).toBe(before);
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
  });
});

describe("walkthrough", () => {
  function zoneIds(r: Rig): string[] {
    return r.last().zones.map((z) => z.id);
  }

  function startWalk(r: Rig): void {
    r.controller.start();
    r.stub.calls.length = 0;
    r.controller.act("start");
  }

  it("Start sets view mode and starts the route walk with the linked Timeline", () => {
    const r = rig();
    r.controller.start();
    r.stub.calls.length = 0;
    r.controller.act("start");
    expect(r.names()).toStrictEqual(["setEditMode", "startWalk"]);
    expect(r.stub.calls[0]?.arg).toBe("view");
    const args = r.stub.calls[1]?.arg as unknown[];
    expect(args[0]).toBe("route");
    expect(args[1]).toBe(24);
    expect(walkDuration(r.data.scenario.zones.length)).toBe(24);
    const expected = linkedTimeline(r.data.scenario, expectedEffects(r.data));
    if (!expected.ok) throw new Error("timeline expected");
    expect(args[2]).toStrictEqual(expected.value);
  });

  it("Start is a no-op with 1 Zone and the hint stays", () => {
    const data = loadData();
    const zone = data.scenario.zones[0];
    if (zone === undefined) throw new Error("zone expected");
    const one = { ...data.scenario, zones: [zone], nodes: data.scenario.nodes.filter((n) => n.zone === zone.id) };
    const history: History = { past: [], present: one, future: [], limit: 100 };
    const r = rig({ data, history });
    r.controller.start();
    r.stub.calls.length = 0;
    r.controller.act("start");
    expect(r.names()).toStrictEqual([]);
    expect(r.last().controls.start).toBe(false);
    expect(r.last().status).toStrictEqual(HINT_NEEDS_TWO_ZONES);
  });

  it("the Timeline positions move the marker", () => {
    const r = rig();
    startWalk(r);
    const ids = zoneIds(r);
    expect(r.last().marker).toBeNull();
    for (const [i, id] of ids.entries()) {
      r.controller.onTimeline({ kind: "position", position: i });
      expect(r.last().marker).toBe(id);
    }
  });

  it("finished stops the Timeline, returns to edit mode, and keeps the marker on the Exit", () => {
    const r = rig();
    startWalk(r);
    const ids = zoneIds(r);
    r.controller.onWalk("playing", 0.1);
    r.controller.onTimeline({ kind: "position", position: ids.length - 1 });
    r.stub.calls.length = 0;
    r.controller.onWalk("finished", 1);
    expect(r.names()).toStrictEqual(["stopTimeline", "setEditMode"]);
    expect(r.stub.calls[1]?.arg).toBe("edit");
    expect(r.last().walk).toBe("finished");
    expect(r.last().marker).toBe(ids.at(-1));
    expect(r.last().controls.addZone).toBe(true);
  });

  it("an add zone after a finished walk and its restart leave walk idle and marker null", async () => {
    const r = rig();
    startWalk(r);
    const ids = zoneIds(r);
    r.controller.onWalk("playing", 0.1);
    r.controller.onTimeline({ kind: "position", position: ids.length - 1 });
    r.controller.onWalk("finished", 1);
    expect(r.last().marker).toBe(ids.at(-1));
    r.controller.act("addZone");
    await Promise.resolve();
    expect(r.names()).toContain("restart");
    expect(r.last().walk).toBe("idle");
    expect(r.last().marker).toBeNull();
  });

  it("a viewpoint button after finished calls stopWalk before setPreset and clears the marker", () => {
    const r = rig();
    startWalk(r);
    r.controller.onTimeline({ kind: "position", position: 2 });
    r.controller.onWalk("finished", 1);
    r.stub.calls.length = 0;
    r.controller.act("overview");
    expect(r.names()).toStrictEqual(["stopWalk", "setPreset"]);
    expect(r.last().walk).toBe("idle");
    expect(r.last().marker).toBeNull();
  });

  it("Pause, Resume and Stop call the handle; Stop returns to edit and clears the marker", () => {
    const r = rig();
    startWalk(r);
    r.controller.onWalk("playing", 0.1);
    r.controller.onTimeline({ kind: "position", position: 1 });
    r.stub.calls.length = 0;
    r.controller.act("pause");
    expect(r.names()).toStrictEqual(["pauseWalk"]);
    r.controller.onWalk("paused", 0.2);
    r.controller.act("resume");
    expect(r.names()).toStrictEqual(["pauseWalk", "resumeWalk"]);
    r.controller.onWalk("playing", 0.2);
    r.controller.act("stop");
    expect(r.names().slice(2)).toStrictEqual(["stopWalk", "setEditMode"]);
    expect(r.stub.calls.at(-1)?.arg).toBe("edit");
    expect(r.last().walk).toBe("idle");
    expect(r.last().marker).toBeNull();
  });

  it("editing controls are disabled during the walk", async () => {
    const r = rig({ read: (f) => Promise.resolve(okRead(f.name)) });
    startWalk(r);
    r.controller.onWalk("playing", 0.1);
    const c = r.last().controls;
    for (const id of ["addImages", "addZone", "removeZone", "removeImage", "undo", "redo", "settings", "mark", "start"] as const) {
      expect(c[id]).toBe(false);
    }
    expect(r.last().status).toStrictEqual(HINT_EDITING_LOCKED);
    r.stub.calls.length = 0;
    r.controller.act("addZone");
    await r.controller.addFiles([file("a.png")]);
    expect(r.names()).toStrictEqual([]);
  });

  it("a walk error shows each Field_Path, leaves the Board unchanged, and returns to edit", () => {
    const r = rig();
    startWalk(r);
    const before = r.stub.history;
    r.stub.calls.length = 0;
    r.controller.onEdit({
      kind: "errors",
      context: "walk",
      errors: [
        { path: "timeline.steps[0]", message: "bad step" },
        { path: "paths.route", message: "bad path" },
      ],
    });
    const en = r.last().notice?.en ?? "";
    expect(en).toContain(text.msgWalkFailed.en);
    expect(en).toContain("timeline.steps[0]");
    expect(en).toContain("paths.route");
    expect(r.stub.calls).toStrictEqual([{ name: "setEditMode", arg: "edit" }]);
    expect(r.stub.history).toBe(before);
    expect(r.last().walk).toBe("idle");
    expect(r.last().marker).toBeNull();
  });

  it("the Mood_Effects do not change while the walk is playing", () => {
    const r = rig();
    startWalk(r);
    r.controller.onWalk("playing", 0.1);
    r.stub.calls.length = 0;
    r.controller.onTimeline({ kind: "position", position: 1 });
    r.controller.onWalk("playing", 0.5);
    r.controller.act("mark", r.last().zones[1]?.id);
    r.controller.setSetting("shiftThreshold", "5");
    r.controller.act("addZone");
    expect(effectsOf(r.stub.calls)).toStrictEqual([]);
    expect(r.last().marks).toStrictEqual([]);
  });
});

describe("errors by context", () => {
  it("edit, start, theme, and an unknown context each show their message", () => {
    const r = rig();
    r.controller.start();
    r.controller.onEdit({ kind: "errors", context: "edit", errors: [] });
    expect(r.last().notice).toStrictEqual(text.msgChangeFailed);
    r.controller.onEdit({ kind: "errors", context: "start", errors: [] });
    expect(r.last().notice).toStrictEqual(text.msgBoardInvalid);
    r.controller.onEdit({ kind: "errors", context: "preset", errors: [] });
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
    r.controller.onEdit({ kind: "errors", context: "theme", errors: [] });
    expect(r.last().notice).toStrictEqual(text.msgBoardInvalid);
  });

  it("a settings error shows the board message, but not while a restart is pending", async () => {
    const r = rig();
    r.controller.start();
    r.controller.onEdit({ kind: "errors", context: "settings", errors: [] });
    expect(r.last().notice).toStrictEqual(text.msgBoardInvalid);
    const quiet = rig();
    quiet.controller.start();
    quiet.controller.act("addZone"); // schedules the restart
    quiet.controller.onEdit({ kind: "errors", context: "settings", errors: [] });
    expect(quiet.last().notice).toBeNull();
    await Promise.resolve();
  });

  it("a failing restart shows the failure message", async () => {
    const r = rig();
    r.controller.start();
    r.stub.failOn.add("restart");
    r.controller.act("addZone");
    await Promise.resolve();
    expect(r.last().notice).toStrictEqual(text.msgActionFailed);
  });
});
