import { describe, expect, it } from "vitest";
import type { EditCommand } from "../../core/model/commands.ts";
import { createHistory, executeCommand, type History } from "../../core/model/history.ts";
import type { Scenario } from "../../core/model/scenario-schema.ts";
import { coachFor } from "./coach.ts";
import { GameController, type GameViewState, type ViewPort } from "./controller.ts";
import { attackCheckSet, withCheckSet } from "./model/built-rules.ts";
import { BUNDLED } from "./model/bundled.ts";
import { cutKeyCommand, dontReadCommand, stopRobotCommand } from "./model/commands.ts";
import { loadGameData } from "./model/game-data.ts";
import { EDGE_TYPES } from "./model/names.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const data = loaded.data;
const rules = withCheckSet(data.rules, attackCheckSet(data.attackCard));
if (!rules.ok) throw new Error("attack rules must load");
const attackRules = rules.value;

function setup() {
  const noop = (): void => {};
  const view: ViewPort = {
    setHistory: noop,
    setPreset: noop,
    setEffects: noop,
    setEditMode: noop,
    connectOn: noop,
    connectOff: noop,
    undo: noop,
    redo: noop,
    execute: noop,
    startTimeline: noop,
    stopTimeline: noop,
  };
  const states: GameViewState[] = [];
  const controller = new GameController(data, attackRules, { f1: false, f2: false }, view, {
    render: (s) => states.push(s),
  });
  const last = (): GameViewState => {
    const s = states.at(-1);
    if (s === undefined) throw new Error("nothing rendered");
    return s;
  };
  return { controller, states, last };
}

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

function need(cmd: EditCommand | null): EditCommand {
  if (cmd === null) throw new Error("command expected");
  return cmd;
}

const consultEdge = { id: "consult-1", from: "robot", to: "parent", type: EDGE_TYPES.consult };

describe("coachFor", () => {
  it("follows the winning click path with a sensible doNext at every step", () => {
    const c = setup();
    c.controller.start();
    expect(coachFor(c.last()).doNext).toBe("next");
    const count = data.attackCard.preconditions.length;
    for (let i = 1; i <= count; i++) {
      c.controller.act("next");
      expect(coachFor(c.last()).doNext).toBe(i < count ? "next" : "toPrepare");
    }
    c.controller.act("toPrepare");
    expect(coachFor(c.last()).doNext).toBeNull(); // click the strange page first
    c.controller.onSelect({ kind: "node", id: "page" });
    expect(coachFor(c.last()).doNext).toBe("dontRead");
    c.controller.onEdit({ kind: "history", history: build(data.preset, need(dontReadCommand(data.preset, "page"))) });
    expect(coachFor(c.last()).doNext).toBe("startNight");
    c.controller.act("startNight");
    expect(c.last().phase).toBe("ghostNight");
    expect(coachFor(c.last()).doNext).toBeNull();
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).toBe("lookBack");
    expect(coachFor(c.last()).doNext).toBeNull(); // 3 stars: nothing more is needed
  });

  it("guides Fix It from stopping the robot to Look Back", () => {
    const c = setup();
    c.controller.start();
    for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
    c.controller.act("toPrepare");
    c.controller.act("startNight");
    c.controller.onTimeline({ kind: "end" });
    expect(c.last().phase).toBe("fixIt");
    expect(coachFor(c.last()).doNext).toBeNull();
    c.controller.onSelect({ kind: "node", id: "robot" });
    expect(coachFor(c.last()).doNext).toBe("stopRobot");
    const stop = need(stopRobotCommand(data.preset));
    c.controller.onEdit({ kind: "history", history: build(data.preset, stop) });
    c.controller.onSelect({ kind: "edge", id: "k-photos" });
    expect(coachFor(c.last()).doNext).toBe("cutKey");
    const afterStop = build(data.preset, stop).present;
    const cut = need(cutKeyCommand(afterStop, "k-photos"));
    c.controller.onEdit({ kind: "history", history: build(data.preset, stop, cut) });
    expect(coachFor(c.last()).doNext).toBe("consult");
    c.controller.onEdit({
      kind: "history",
      history: build(data.preset, stop, cut, { kind: "addEdge", edge: consultEdge }),
    });
    expect(coachFor(c.last()).doNext).toBe("toLookBack");
    c.controller.act("toLookBack");
    expect(c.last().phase).toBe("lookBack");
    const back = coachFor(c.last());
    expect(back.say.en.length).toBeGreaterThan(0);
  });

  it("gives non-empty en and ja, an enabled-or-null doNext, and a deterministic result in every state seen", () => {
    const c = setup();
    c.controller.start();
    for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
    c.controller.act("toPrepare");
    c.controller.act("consult");
    c.controller.onSelect({ kind: "node", id: "page" });
    c.controller.act("startNight");
    c.controller.onTimeline({ kind: "end" });
    c.controller.act("consult");
    c.controller.act("toLookBack");
    c.controller.act("replay");
    c.controller.act("prepareAgain");
    expect(c.states.length).toBeGreaterThan(8);
    const phases = new Set(c.states.map((s) => s.phase));
    expect(phases.size).toBe(5);
    for (const state of c.states) {
      const coach = coachFor(state);
      expect(coach.say.en.trim().length).toBeGreaterThan(0);
      expect((coach.say.ja ?? "").trim().length).toBeGreaterThan(0);
      expect(coach.progress.label.en.length).toBeGreaterThan(0);
      expect((coach.progress.label.ja ?? "").length).toBeGreaterThan(0);
      expect(coach.progress.total).toBe(5);
      expect(coach.progress.done).toBeGreaterThanOrEqual(0);
      expect(coach.progress.done).toBeLessThan(5);
      if (coach.doNext !== null) {
        expect(state.controls[coach.doNext].shown).toBe(true);
        expect(state.controls[coach.doNext].enabled).toBe(true);
      }
      expect(coachFor(structuredClone(state))).toEqual(coach);
    }
  });

  it("says nothing technical and no URL", () => {
    const c = setup();
    c.controller.start();
    for (let i = 0; i < data.attackCard.preconditions.length; i++) c.controller.act("next");
    for (const state of c.states) {
      const { say } = coachFor(state);
      expect(`${say.en} ${say.ja}`).not.toMatch(/prompt|injection|hallucination|owasp|https?:/i);
    }
  });
});
