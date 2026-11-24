import { describe, expect, it } from "vitest";
import { applyCommand, type EditCommand } from "../../core/model/commands.ts";
import { createHistory, executeCommand, type History } from "../../core/model/history.ts";
import type { LocalizedText, Scenario } from "../../core/model/scenario-schema.ts";
import { GameController, type GameViewState, type UiSink, type ViewPort } from "./controller.ts";
import { attackCheckSet, withCheckSet } from "./model/built-rules.ts";
import { BUNDLED } from "./model/bundled.ts";
import { cutKeyCommand, dontReadCommand, stopRobotCommand } from "./model/commands.ts";
import { highlightEffects, lookBackEffects } from "./model/effects.ts";
import type { Flags } from "./model/fallback.ts";
import { loadGameData } from "./model/game-data.ts";
import { judgeNight } from "./model/judge.ts";
import { EDGE_TYPES, EFFECT_KINDS } from "./model/names.ts";
import { errorMessages } from "./text.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const data = loaded.data;
const rulesResult = withCheckSet(data.rules, attackCheckSet(data.attackCard));
if (!rulesResult.ok) throw new Error("attack rules must load");
const attackRules = rulesResult.value;
const none: Flags = { f1: false, f2: false };

type Call = { name: string; arg?: unknown };

function setup(flags: Flags = none) {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (arg?: unknown): void => {
      calls.push(arg === undefined ? { name } : { name, arg });
    };
  const view: ViewPort = {
    setHistory: record("setHistory"),
    setPreset: record("setPreset"),
    setEffects: record("setEffects"),
    setEditMode: record("setEditMode"),
    connectOn: record("connectOn"),
    connectOff: record("connectOff"),
    undo: record("undo"),
    redo: record("redo"),
    execute: record("execute"),
    startTimeline: record("startTimeline"),
    stopTimeline: record("stopTimeline"),
  };
  const renders: GameViewState[] = [];
  const ui: UiSink = {
    render: (s) => renders.push(s),
  };
  const controller = new GameController(data, attackRules, flags, view, ui);
  const names = (): string[] => calls.map((c) => c.name);
  const last = (): GameViewState => {
    const r = renders.at(-1);
    if (r === undefined) throw new Error("nothing rendered");
    return r;
  };
  return { controller, calls, names, renders, last };
}

type Ctx = ReturnType<typeof setup>;

function historyOf(present: Scenario): History {
  return { past: [], present, future: [], limit: 100 };
}

function toPrepare(c: Ctx): void {
  c.controller.start();
  for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
  c.controller.act("toPrepare");
}

describe("start (call table row start)", () => {
  it("sets view mode, then the sample fog, and renders the Sample with nothing shown", () => {
    const c = setup();
    c.controller.start();
    expect(c.names()).toEqual(["setEditMode", "setEffects"]);
    expect(c.calls[0]?.arg).toBe("view");
    expect(c.last().phase).toBe("sample");
    expect(c.last().sampleShown).toBe(0);
    expect(c.last().preconditions.every((p) => !p.holds)).toBe(true);
    expect(c.last().score).toBeNull();
  });

  it("does nothing a second time", () => {
    const c = setup();
    c.controller.start();
    const before = c.calls.length;
    c.controller.start();
    expect(c.calls.length).toBe(before);
  });
});

describe("presetId (display only)", () => {
  it("starts at the first preset and follows setPreset calls and the preset control", () => {
    const c = setup();
    c.controller.start();
    expect(c.last().presetId).toBe("ghost-view");
    c.controller.act("next");
    expect(c.last().presetId).toBe("overhead");
    c.controller.act("preset", "ghost-view");
    expect(c.last().presetId).toBe("ghost-view");
  });
});

describe("Sample (13.3, 13.4, 13.6)", () => {
  it("first next calls setPreset(overhead) first, then setEffects; later steps do not set the preset", () => {
    const c = setup();
    c.controller.start();
    c.calls.length = 0;
    c.controller.act("next");
    expect(c.names()).toEqual(["setPreset", "setEffects"]);
    expect(c.calls[0]?.arg).toBe("overhead");
    expect(c.last().sampleShown).toBe(1);
    expect(c.last().preconditions.filter((p) => p.holds).length).toBe(1);
    c.calls.length = 0;
    c.controller.act("next");
    expect(c.names()).toEqual(["setEffects"]);
    expect(c.last().sampleShown).toBe(2);
  });

  it("the last next starts the sample timeline; next is then disabled and toPrepare enabled", () => {
    const c = setup();
    c.controller.start();
    const count = data.attackCard.preconditions.length;
    for (let i = 0; i < count - 1; i++) c.controller.act("next");
    expect(c.names()).not.toContain("startTimeline");
    expect(c.last().controls.toPrepare.enabled).toBe(false);
    c.controller.act("next");
    expect(c.names().filter((n) => n === "startTimeline").length).toBe(1);
    expect(c.names().at(-1)).toBe("startTimeline");
    expect(c.last().sampleShown).toBe(count);
    expect(c.last().preconditions.every((p) => p.holds)).toBe(true);
    expect(c.last().controls.next.enabled).toBe(false);
    expect(c.last().controls.toPrepare.enabled).toBe(true);
    // Further next does nothing.
    const before = c.calls.length;
    c.controller.act("next");
    expect(c.calls.length).toBe(before);
  });

  it("the effects of step k contain the highlights of step k", () => {
    const c = setup();
    c.controller.start();
    c.controller.act("next");
    const effects = c.calls.find((cl) => cl.name === "setEffects" && cl.arg !== undefined);
    const marks = highlightEffects(data.attackCard, 1);
    const list = c.calls.filter((cl) => cl.name === "setEffects").at(-1)?.arg as unknown[];
    expect(effects).toBeDefined();
    for (const m of marks) expect(list).toContainEqual(m);
  });

  it("toPrepare before every Precondition is shown does nothing", () => {
    const c = setup();
    c.controller.start();
    c.controller.act("next");
    c.calls.length = 0;
    c.controller.act("toPrepare");
    expect(c.calls).toEqual([]);
    expect(c.last().phase).toBe("sample");
  });

  it("a timeline end in Sample changes nothing in the view and keeps the phase", () => {
    const c = setup();
    c.controller.start();
    for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
    c.calls.length = 0;
    c.controller.onTimeline({ kind: "end" });
    expect(c.calls).toEqual([]);
    expect(c.last().phase).toBe("sample");
  });
});

describe("-> prepare (12.8, 12.9, 14.1, 19.1)", () => {
  it("calls stopTimeline first, then the table order, with the Preset_Mansion History", () => {
    const c = setup();
    c.controller.start();
    for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
    c.calls.length = 0;
    c.controller.act("toPrepare");
    expect(c.names()).toEqual(["stopTimeline", "connectOff", "setPreset", "setEditMode", "setHistory", "setEffects"]);
    expect(c.calls[2]?.arg).toBe("overhead");
    expect(c.calls[3]?.arg).toBe("edit");
    expect((c.calls[4]?.arg as History).present).toEqual(data.preset);
    expect(c.last().phase).toBe("prepare");
  });

  it("shows the Prepare display values (9.6)", () => {
    const c = setup();
    toPrepare(c);
    expect(c.last().status).toEqual({ convenience: 6, reachScore: expect.any(Number) as number });
    expect(c.last().controls.startNight.enabled).toBe(true);
    expect(c.last().controls.undo.shown).toBe(true);
  });

  it("onEdit in Prepare recomputes the display and the fog (9.6, 14.4)", () => {
    const c = setup();
    toPrepare(c);
    const cmd = dontReadCommand(data.preset, "page");
    if (cmd === null) throw new Error("command expected");
    const applied = applyCommand(data.preset, cmd);
    if (!applied.ok) throw new Error("command failed");
    // Bell all keys through the model to change convenience.
    const bellCmd = {
      kind: "batch" as const,
      commands: ["k-photos", "k-messages", "k-homework"].map((id) => ({
        kind: "updateEdge" as const,
        id,
        changes: { type: "bell-key" },
      })),
    };
    const changed = applyCommand(applied.scenario, bellCmd);
    if (!changed.ok) throw new Error("command failed");
    c.calls.length = 0;
    c.controller.onEdit({ kind: "history", history: historyOf(changed.scenario) });
    expect(c.names()).toEqual(["setEffects"]);
    const expected = judgeNight(changed.scenario, data, attackRules, none);
    if (!expected.ok) throw new Error("judge failed");
    expect(c.last().status?.convenience).toBe(expected.value.convenience);
    expect(c.last().status?.convenience).toBeLessThan(6);
  });

  it("start over restores the preset display with connectOff, setHistory, setEffects (12.6)", () => {
    const c = setup();
    toPrepare(c);
    c.calls.length = 0;
    c.controller.act("startOver");
    expect(c.names()).toEqual(["connectOff", "setHistory", "setEffects"]);
  });
});

describe("Connect_Mode (8.3, 19.9)", () => {
  it("connectSource calls connectOn(cites); cancel calls connectOff", () => {
    const c = setup();
    toPrepare(c);
    c.calls.length = 0;
    c.controller.act("connectSource");
    expect(c.calls).toEqual([{ name: "connectOn", arg: "cites" }]);
    expect(c.last().controls.cancel.enabled).toBe(true);
    c.controller.act("cancel");
    expect(c.names()).toEqual(["connectOn", "connectOff"]);
    expect(c.last().controls.cancel.enabled).toBe(false);
  });

  it("cancel without Connect_Mode does nothing", () => {
    const c = setup();
    toPrepare(c);
    c.calls.length = 0;
    c.controller.act("cancel");
    expect(c.calls).toEqual([]);
  });

  it("an operation control calls connectOff before its own call", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("connectSource");
    c.calls.length = 0;
    c.controller.act("undo");
    expect(c.names()).toEqual(["connectOff", "undo"]);
    c.controller.act("undo");
    expect(c.names()).toEqual(["connectOff", "undo", "undo"]);
  });

  it("an accepted Cite_Edge ends Connect_Mode with connectOff", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("connectSource");
    c.calls.length = 0;
    const added = applyCommand(data.preset, {
      kind: "addEdge",
      edge: { id: "cite-1", from: "answer", to: "textbook", type: "cites" },
    });
    if (!added.ok) throw new Error("addEdge failed");
    c.controller.onEdit({ kind: "history", history: historyOf(added.scenario) });
    expect(c.names()).toContain("connectOff");
    c.calls.length = 0;
    c.controller.act("cancel");
    expect(c.calls).toEqual([]);
  });

  it("an unrelated edit keeps Connect_Mode on", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("connectSource");
    c.calls.length = 0;
    c.controller.onEdit({ kind: "history", history: historyOf(data.preset) });
    expect(c.names()).not.toContain("connectOff");
  });
});

describe("Ghost Night (15.5, 15.6, 10.1, 6.5, 19.1)", () => {
  it("startNight calls stopTimeline, connectOff, setPreset(overhead), setEditMode(view), startTimeline in order", () => {
    const c = setup();
    toPrepare(c);
    c.calls.length = 0;
    c.controller.act("startNight");
    expect(c.names()).toEqual(["stopTimeline", "connectOff", "setPreset", "setEditMode", "startTimeline"]);
    expect(c.calls[2]?.arg).toBe("overhead");
    expect(c.calls[3]?.arg).toBe("view");
    expect(c.last().phase).toBe("ghostNight");
    expect(c.last().controls.startNight.shown).toBe(false);
  });

  it("the Score_Point is that of the night start state (10.1)", () => {
    const c = setup();
    toPrepare(c);
    const expected = judgeNight(data.preset, data, attackRules, none);
    if (!expected.ok) throw new Error("judge failed");
    c.controller.act("startNight");
    expect(c.last().score).toEqual({
      convenience: expected.value.convenience,
      damage: expected.value.damageScore,
      stars: expected.value.stars,
    });
  });

  it("a position report shows the step label; the hidden step sets hiddenFollowed when the attack succeeds", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("startNight");
    const tl = c.calls.filter((cl) => cl.name === "startTimeline").at(-1)?.arg as { steps: { id: string; label: LocalizedText }[] };
    c.controller.onTimeline({ kind: "position", position: 0 });
    expect(c.last().stepLabel).toEqual(tl.steps[0]?.label);
    expect(c.last().hiddenFollowed).toBe(false);
    const hiddenJob = data.jobs.jobs.find((j) => j.reads === "page");
    const hidden = tl.steps.findIndex((s) => s.id === `job-${hiddenJob?.id ?? ""}`);
    expect(hidden).toBeGreaterThanOrEqual(0);
    c.controller.onTimeline({ kind: "position", position: hidden });
    expect(c.last().hiddenFollowed).toBe(true);
  });

  it("a night end moves the phase on (15.5)", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("startNight");
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).not.toBe("ghostNight");
  });

  it("a winning set ends the night in lookBack (no damage)", () => {
    const c = setup();
    toPrepare(c);
    const cmd = dontReadCommand(data.preset, "page");
    if (cmd === null) throw new Error("command expected");
    const applied = applyCommand(data.preset, cmd);
    if (!applied.ok) throw new Error("command failed");
    c.controller.onEdit({ kind: "history", history: historyOf(applied.scenario) });
    c.controller.act("startNight");
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).toBe("lookBack");
  });

  it("a damaging night ends in fixIt", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("startNight");
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).toBe("fixIt");
  });

  it("a timeline error report runs the end handler so the night moves on (15.5)", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("startNight");
    c.controller.onEdit({ kind: "errors", context: "timeline", errors: [] });
    expect(c.last().notice).toBe(errorMessages.judgeFailed);
    expect(c.last().phase).not.toBe("ghostNight");
  });

  it("a failed judgeNight keeps prepare, shows a message, and calls nothing (6.5)", () => {
    const c = setup();
    toPrepare(c);
    const first = data.preset.edges[0];
    if (first === undefined) throw new Error("preset has edges");
    const broken: Scenario = {
      ...data.preset,
      edges: [...data.preset.edges, { ...first, id: "bad", from: "ghost-node", to: "nowhere" }],
    };
    c.controller.onEdit({ kind: "history", history: historyOf(broken) });
    c.calls.length = 0;
    c.controller.act("startNight");
    expect(c.last().notice).toBe(errorMessages.judgeFailed);
    expect(c.calls).toEqual([]);
    expect(c.last().phase).toBe("prepare");
  });
});

describe("Edit_Mode per Phase (19.1)", () => {
  it("is view in sample, edit in prepare, view in ghostNight", () => {
    const c = setup();
    c.controller.start();
    const modes = (): unknown[] => c.calls.filter((cl) => cl.name === "setEditMode").map((cl) => cl.arg);
    expect(modes()).toEqual(["view"]);
    for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
    expect(modes()).toEqual(["view"]);
    c.controller.act("toPrepare");
    expect(modes()).toEqual(["view", "edit"]);
    c.controller.act("startNight");
    expect(modes()).toEqual(["view", "edit", "view"]);
  });

  it("undo and redo reach the view only in prepare", () => {
    const c = setup();
    c.controller.start();
    c.controller.act("undo");
    expect(c.names()).not.toContain("undo");
    for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
    c.controller.act("toPrepare");
    c.controller.act("undo");
    c.controller.act("redo");
    expect(c.names().slice(-2)).toEqual(["undo", "redo"]);
  });
});

// --- Task 6.5: Fix It, Look Back, errors, controls ---

const FIX_STEPS = data.jobs.jobs.length + 1;
const ALL_CONTEXTS = ["start", "settings", "theme", "preset", "walk", "timeline", "edit", "effects"] as const;
const consultEdge = { id: "consult-1", from: "robot", to: "parent", type: EDGE_TYPES.consult };

function build(base: Scenario, ...commands: EditCommand[]): History {
  const made = createHistory(base, 100);
  if (!made.ok) throw new Error("history failed");
  let h = made.history;
  for (const cmd of commands) {
    const r = executeCommand(h, cmd);
    if (!r.ok) throw new Error("command failed");
    h = r.history;
  }
  return h;
}

function stopCmd(s: Scenario): EditCommand {
  const cmd = stopRobotCommand(s);
  if (cmd === null) throw new Error("stop expected");
  return cmd;
}

function cutCmd(s: Scenario): EditCommand {
  const cmd = cutKeyCommand(s, "k-photos");
  if (cmd === null) throw new Error("cut expected");
  return cmd;
}

function toFixIt(c: Ctx): void {
  toPrepare(c);
  c.controller.act("startNight");
  c.controller.onTimeline({ kind: "end" });
}

function nightOf(scenario: Scenario) {
  const r = judgeNight(scenario, data, attackRules, none);
  if (!r.ok) throw new Error("judge failed");
  return r.value;
}

function replacedPhase(c: Ctx): string {
  return c.last().phase;
}

describe("-> fixIt (16.1, 16.8, 16.9)", () => {
  it("calls the table order with the night start History and a four-step replay", () => {
    const c = setup();
    toPrepare(c);
    c.controller.act("startNight");
    c.calls.length = 0;
    c.controller.onTimeline({ kind: "end" });
    expect(c.names()).toEqual(["stopTimeline", "connectOff", "setPreset", "setEditMode", "setHistory", "startTimeline"]);
    expect(c.calls[2]?.arg).toBe("overhead");
    expect(c.calls[3]?.arg).toBe("edit");
    const history = c.calls[4]?.arg as History;
    expect(history.present).toEqual(data.preset);
    expect(history.past).toEqual([]);
    expect(history.limit).toBe(100);
    const timeline = c.calls[5]?.arg as { steps: unknown[] };
    expect(timeline.steps.length).toBe(FIX_STEPS);
    expect(FIX_STEPS).toBe(4);
  });

  it("renders the incident and the response with nothing done and no Edit_Callback (16.8)", () => {
    const c = setup();
    toFixIt(c);
    expect(c.last().phase).toBe("fixIt");
    expect(c.last().incident).toBe(true);
    const response = c.last().response;
    expect(response?.operations.map((o) => o.done)).toEqual([false, false, false]);
    expect(response?.log).toEqual([]);
    expect(c.last().controls.toLookBack.shown).toBe(true);
  });

  it("the replay end calls stopTimeline, then setEffects with damage and fog (16.9, 12.9)", () => {
    const c = setup();
    toFixIt(c);
    c.calls.length = 0;
    c.controller.onTimeline({ kind: "end" });
    expect(c.names()).toEqual(["stopTimeline", "setEffects"]);
    const night = nightOf(data.preset);
    expect(night.damageEffects.length).toBeGreaterThan(0);
    const list = c.calls[1]?.arg as unknown[];
    for (const e of [...night.damageEffects, ...night.fog]) expect(list).toContainEqual(e);
  });

  it("a rejected fix replay (timeline error) still ends the replay at once", () => {
    const c = setup();
    toFixIt(c);
    c.calls.length = 0;
    c.controller.onEdit({ kind: "errors", context: "timeline", errors: [] });
    expect(c.names()).toEqual(["stopTimeline", "setEffects"]);
    expect(c.last().notice).toBe(errorMessages.judgeFailed);
  });
});

describe("Fix It operations (16.1, 16.4, 16.5, 16.6)", () => {
  it("stop robot executes the model command and the Action_Log gets stop-robot", () => {
    const c = setup();
    toFixIt(c);
    c.controller.onSelect({ kind: "node", id: "robot" });
    c.calls.length = 0;
    c.controller.act("stopRobot");
    expect(c.calls).toEqual([{ name: "execute", arg: stopCmd(data.preset) }]);
    c.controller.onEdit({ kind: "history", history: build(data.preset, stopCmd(data.preset)) });
    expect(c.last().response?.log).toEqual(["stop-robot"]);
    expect(c.last().response?.operations.find((o) => o.id === "stop-robot")?.done).toBe(true);
    expect(c.last().controls.stopRobot.enabled).toBe(false);
  });

  it("cut key executes the cut command for the selected Key_Edge only", () => {
    const c = setup();
    toFixIt(c);
    c.calls.length = 0;
    c.controller.act("cutKey");
    expect(c.calls).toEqual([]);
    c.controller.onSelect({ kind: "edge", id: "k-photos" });
    c.controller.act("cutKey");
    expect(c.calls).toEqual([{ name: "execute", arg: cutCmd(data.preset) }]);
    c.controller.onEdit({ kind: "history", history: build(data.preset, cutCmd(data.preset)) });
    expect(c.last().response?.log).toEqual(["cut-key"]);
  });

  it("consult turns Connect_Mode on with the consult type; an accepted Consult_Edge calls connectOff", () => {
    const c = setup();
    toFixIt(c);
    c.calls.length = 0;
    c.controller.act("consult");
    expect(c.calls).toEqual([{ name: "connectOn", arg: EDGE_TYPES.consult }]);
    c.calls.length = 0;
    c.controller.onEdit({
      kind: "history",
      history: build(data.preset, { kind: "addEdge", edge: consultEdge }),
    });
    expect(c.names()).toContain("connectOff");
    expect(c.last().response?.log).toEqual(["consult"]);
    c.calls.length = 0;
    c.controller.act("cancel");
    expect(c.calls).toEqual([]);
  });

  it("undo removes the entry and redo restores it (16.6); stop before cut satisfies the order", () => {
    const c = setup();
    toFixIt(c);
    const stopped = build(data.preset, stopCmd(data.preset));
    const both = build(data.preset, stopCmd(data.preset), cutCmd(stopped.present));
    c.controller.onEdit({ kind: "history", history: both });
    expect(c.last().response?.log).toEqual(["stop-robot", "cut-key"]);
    expect(c.last().response?.order.every((o) => o.result === "met")).toBe(true);
    c.controller.onEdit({ kind: "history", history: { ...both, past: both.past.slice(0, 1), present: both.past[1] ?? both.present, future: [both.present] } });
    expect(c.last().response?.log).toEqual(["stop-robot"]);
    c.controller.onEdit({ kind: "history", history: both });
    expect(c.last().response?.log).toEqual(["stop-robot", "cut-key"]);
  });

  it("cut before stop gives an order result that is not met", () => {
    const c = setup();
    toFixIt(c);
    const cutFirst = build(data.preset, cutCmd(data.preset));
    const history = build(cutFirst.present, stopCmd(cutFirst.present));
    c.controller.onEdit({
      kind: "history",
      history: { ...history, past: [data.preset, ...history.past] },
    });
    expect(c.last().response?.log).toEqual(["cut-key", "stop-robot"]);
    expect(c.last().response?.order.some((o) => o.result === "notMet")).toBe(true);
  });

  it("stop, cut, and consult are ignored outside Fix It", () => {
    const c = setup();
    toPrepare(c);
    c.controller.onSelect({ kind: "node", id: "robot" });
    c.calls.length = 0;
    c.controller.act("stopRobot");
    c.controller.act("cutKey");
    c.controller.act("consult");
    expect(c.calls).toEqual([]);
  });
});

describe("-> lookBack (18.6, 7.4, 17.4)", () => {
  it("from Fix It: stopTimeline, connectOff, setPreset, setEditMode(view), setHistory(nightStart), setEffects(lookBackEffects)", () => {
    const c = setup();
    toFixIt(c);
    c.controller.onEdit({ kind: "history", history: build(data.preset, stopCmd(data.preset)) });
    c.calls.length = 0;
    c.controller.act("toLookBack");
    expect(c.names()).toEqual(["stopTimeline", "connectOff", "setPreset", "setEditMode", "setHistory", "setEffects"]);
    expect(c.calls[2]?.arg).toBe("overhead");
    expect(c.calls[3]?.arg).toBe("view");
    expect((c.calls[4]?.arg as History).present).toEqual(data.preset);
    const night = nightOf(data.preset);
    const list = c.calls[5]?.arg as unknown[];
    expect(list).toEqual(expect.arrayContaining(lookBackEffects(night)));
    expect(list.length).toBe(lookBackEffects(night).length);
    expect(replacedPhase(c)).toBe("lookBack");
  });

  it("Look_Back_Effects hold bell-stop marks for a true verdict (7.4)", () => {
    const night = nightOf(data.preset);
    expect(night.verdict).toBe(true);
    expect(night.bellStops.length).toBeGreaterThan(0);
    const kinds = lookBackEffects(night).map((e) => e.effect);
    expect(kinds).toContain(EFFECT_KINDS.bellStop);
    expect(kinds).toContain(EFFECT_KINDS.couldStop);
  });

  it("Look_Back_Effects hold no bell-stop mark for a false verdict (7.4)", () => {
    const cmd = dontReadCommand(data.preset, "page");
    if (cmd === null) throw new Error("command expected");
    const applied = applyCommand(data.preset, cmd);
    if (!applied.ok) throw new Error("command failed");
    const night = nightOf(applied.scenario);
    expect(night.verdict).toBe(false);
    expect(lookBackEffects(night).map((e) => e.effect)).not.toContain(EFFECT_KINDS.bellStop);
  });

  it("stores the Response_Result from Fix It and shows it in Look Back (17.4)", () => {
    const c = setup();
    toFixIt(c);
    c.controller.onEdit({ kind: "history", history: build(data.preset, stopCmd(data.preset)) });
    c.controller.act("toLookBack");
    expect(c.last().response?.log).toEqual(["stop-robot"]);
    expect(c.last().response?.operations.find((o) => o.id === "stop-robot")?.done).toBe(true);
    expect(c.last().score).not.toBeNull();
    expect(c.last().preconditions.length).toBe(data.attackCard.preconditions.length);
  });

  it("a night with no damage reaches Look Back with no Response_Result", () => {
    const c = setup();
    toPrepare(c);
    const cmd = dontReadCommand(data.preset, "page");
    if (cmd === null) throw new Error("command expected");
    c.controller.onEdit({ kind: "history", history: build(data.preset, cmd) });
    c.controller.act("startNight");
    c.calls.length = 0;
    c.controller.onTimeline({ kind: "end" });
    expect(c.names()).toEqual(["stopTimeline", "connectOff", "setPreset", "setEditMode", "setHistory", "setEffects"]);
    expect(c.last().phase).toBe("lookBack");
    expect(c.last().response).toBeNull();
  });

  it("toLookBack does nothing outside Fix It", () => {
    const c = setup();
    toPrepare(c);
    c.calls.length = 0;
    c.controller.act("toLookBack");
    expect(c.calls).toEqual([]);
  });

  it("replay sets overhead, the night start History, and a night Timeline; its end restores the marks", () => {
    const c = setup();
    toFixIt(c);
    c.controller.act("toLookBack");
    c.calls.length = 0;
    c.controller.act("replay");
    expect(c.names()).toEqual(["setPreset", "setHistory", "startTimeline"]);
    expect(c.calls[0]?.arg).toBe("overhead");
    expect(c.last().controls.replay.enabled).toBe(false);
    c.calls.length = 0;
    c.controller.onTimeline({ kind: "end" });
    expect(c.names()).toEqual(["stopTimeline", "setEffects"]);
    expect(c.last().controls.replay.enabled).toBe(true);
  });
});

describe("retry and start over (12.5, 12.6)", () => {
  it("retry restores the night start state; start over then restores the Preset_Mansion", () => {
    const c = setup();
    toPrepare(c);
    const cmd = dontReadCommand(data.preset, "page");
    if (cmd === null) throw new Error("command expected");
    const edited = build(data.preset, cmd);
    c.controller.onEdit({ kind: "history", history: edited });
    c.controller.act("startNight");
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).toBe("lookBack");
    c.calls.length = 0;
    c.controller.act("prepareAgain");
    expect(c.names()).toEqual(["stopTimeline", "connectOff", "setPreset", "setEditMode", "setHistory", "setEffects"]);
    expect(c.calls[3]?.arg).toBe("edit");
    const restored = c.calls[4]?.arg as History;
    expect(restored.present).toEqual(edited.present);
    expect(restored.past).toEqual([]);
    expect(c.last().phase).toBe("prepare");
    c.calls.length = 0;
    c.controller.act("startOver");
    expect(c.names()).toEqual(["connectOff", "setHistory", "setEffects"]);
    expect((c.calls[1]?.arg as History).present).toEqual(data.preset);
  });

  it("prepareAgain does nothing outside Look Back", () => {
    const c = setup();
    toPrepare(c);
    c.calls.length = 0;
    c.controller.act("prepareAgain");
    expect(c.calls).toEqual([]);
  });
});

describe("errors reports (16.10)", () => {
  it.each(ALL_CONTEXTS)("context %s follows the Callbacks handling and leaves the Action_Log unchanged", (context) => {
    const c = setup();
    toFixIt(c);
    c.controller.onEdit({ kind: "history", history: build(data.preset, stopCmd(data.preset)) });
    const before = c.last().response;
    c.calls.length = 0;
    c.controller.onEdit({ kind: "errors", context, errors: [] });
    expect(c.last().response).toEqual(before);
    expect(c.last().response?.log).toEqual(["stop-robot"]);
    switch (context) {
      case "edit":
        expect(c.last().notice).toBe(errorMessages.changeFailed);
        expect(c.last().phase).toBe("fixIt");
        break;
      case "start":
      case "settings":
      case "theme":
        expect(c.last().notice).toBe(errorMessages.invalidData);
        c.controller.act("toLookBack");
        expect(c.last().phase).toBe("fixIt");
        break;
      case "preset":
      case "effects":
      case "walk":
        expect(c.last().notice).toBe(errorMessages.judgeFailed);
        expect(c.calls).toEqual([]);
        expect(c.last().phase).toBe("fixIt");
        break;
      case "timeline":
        expect(c.last().notice).toBe(errorMessages.judgeFailed);
        expect(c.names()).toEqual(["stopTimeline", "setEffects"]);
        break;
    }
  });

  it("an errors report keeps the stored History: the next cut command is built from it", () => {
    const c = setup();
    toFixIt(c);
    const stopped = build(data.preset, stopCmd(data.preset));
    c.controller.onEdit({ kind: "history", history: stopped });
    c.controller.onEdit({ kind: "errors", context: "edit", errors: [] });
    c.controller.onSelect({ kind: "edge", id: "k-photos" });
    c.calls.length = 0;
    c.controller.act("cutKey");
    expect(c.calls).toEqual([{ name: "execute", arg: cutCmd(stopped.present) }]);
  });

  it("a timeline error in Ghost Night moves the night on; in Look Back it ends the replay", () => {
    const c = setup();
    toFixIt(c);
    c.controller.act("toLookBack");
    c.controller.act("replay");
    c.calls.length = 0;
    c.controller.onEdit({ kind: "errors", context: "timeline", errors: [] });
    expect(c.names()).toEqual(["stopTimeline", "setEffects"]);
    expect(c.last().phase).toBe("lookBack");
  });
});

describe("invalid night start Scenario (16.1)", () => {
  it("is rejected before any Phase change: a message, no view call, and Prepare stays", () => {
    const c = setup();
    toPrepare(c);
    const zone = data.preset.zones[0];
    if (zone === undefined) throw new Error("preset has zones");
    const broken: Scenario = { ...data.preset, zones: [...data.preset.zones, zone] };
    c.controller.onEdit({ kind: "history", history: historyOf(broken) });
    c.calls.length = 0;
    c.controller.act("startNight");
    expect(c.last().notice).not.toBeNull();
    expect(c.calls).toEqual([]);
    expect(c.last().phase).toBe("prepare");
  });
});

describe("undo and redo per Phase (19.1, 19.2)", () => {
  it("are shown and enabled in prepare and fixIt only; the view receives them only there", () => {
    const c = setup();
    c.controller.start();
    expect(c.last().controls.undo.shown).toBe(false);
    expect(c.last().controls.redo.shown).toBe(false);
    toPrepare(c);
    expect(c.last().controls.undo.enabled).toBe(true);
    c.controller.act("startNight");
    expect(c.last().controls.undo.shown).toBe(false);
    c.calls.length = 0;
    c.controller.act("undo");
    c.controller.act("redo");
    expect(c.calls).toEqual([]);
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).toBe("fixIt");
    expect(c.last().controls.undo.enabled).toBe(true);
    expect(c.last().controls.redo.enabled).toBe(true);
    c.calls.length = 0;
    c.controller.act("undo");
    c.controller.act("redo");
    expect(c.names()).toEqual(["undo", "redo"]);
    c.controller.act("toLookBack");
    expect(c.last().controls.undo.shown).toBe(false);
    c.calls.length = 0;
    c.controller.act("undo");
    c.controller.act("redo");
    expect(c.calls).toEqual([]);
  });

  it("an operation control in Fix It calls connectOff first while Connect_Mode is on; cancel ends it", () => {
    const c = setup();
    toFixIt(c);
    c.controller.act("consult");
    expect(c.last().controls.cancel.enabled).toBe(true);
    c.calls.length = 0;
    c.controller.act("undo");
    expect(c.names()).toEqual(["connectOff", "undo"]);
    c.controller.act("consult");
    c.calls.length = 0;
    c.controller.act("cancel");
    expect(c.names()).toEqual(["connectOff"]);
  });
});

describe("click path (20.2)", () => {
  it("the winning set reaches lookBack with 3 stars in at most 12 activations", () => {
    const c = setup();
    let activations = 0;
    const act = (id: Parameters<GameController["act"]>[0]): void => {
      activations += 1;
      c.controller.act(id);
    };
    c.controller.start();
    for (let i = 0; i < data.attackCard.preconditions.length; i++) act("next");
    act("toPrepare");
    c.controller.onSelect({ kind: "node", id: "page" });
    expect(c.last().controls.dontRead.enabled).toBe(true);
    c.calls.length = 0;
    act("dontRead");
    const execute = c.calls.find((cl) => cl.name === "execute");
    const cmd = dontReadCommand(data.preset, "page");
    expect(execute?.arg).toEqual(cmd);
    if (cmd === null) throw new Error("command expected");
    c.controller.onEdit({ kind: "history", history: build(data.preset, cmd) });
    act("startNight");
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).toBe("lookBack");
    expect(c.last().score?.stars).toBe(3);
    expect(activations).toBeLessThanOrEqual(12);
  });
});

describe("notice survives the render that follows (02.4, 06.5, 16.10)", () => {
  it("every errors context leaves the notice in the state of the last render", () => {
    const expected = {
      edit: errorMessages.changeFailed,
      start: errorMessages.invalidData,
      settings: errorMessages.invalidData,
      theme: errorMessages.invalidData,
      preset: errorMessages.judgeFailed,
      effects: errorMessages.judgeFailed,
      walk: errorMessages.judgeFailed,
      timeline: errorMessages.judgeFailed,
    } as const;
    for (const context of ALL_CONTEXTS) {
      const c = setup();
      toPrepare(c);
      c.controller.onEdit({ kind: "errors", context, errors: [] });
      expect(c.last().notice).toBe(expected[context]);
    }
  });

  it("a refreshPrepare failure shows the notice in the render of onEdit, and a good history clears it", () => {
    const c = setup();
    toPrepare(c);
    const first = data.preset.edges[0];
    if (first === undefined) throw new Error("preset has edges");
    const broken: Scenario = {
      ...data.preset,
      edges: [...data.preset.edges, { ...first, id: "bad", from: "ghost-node", to: "nowhere" }],
    };
    c.controller.onEdit({ kind: "history", history: historyOf(broken) });
    expect(c.last().notice).toBe(errorMessages.judgeFailed);
    c.controller.onEdit({ kind: "history", history: historyOf(data.preset) });
    expect(c.last().notice).toBeNull();
  });

  it("a control press clears the notice; a fresh controller has none", () => {
    const c = setup();
    toPrepare(c);
    expect(c.last().notice).toBeNull();
    c.controller.onEdit({ kind: "errors", context: "edit", errors: [] });
    expect(c.last().notice).toBe(errorMessages.changeFailed);
    c.controller.act("startOver");
    expect(c.last().notice).toBeNull();
  });
});
