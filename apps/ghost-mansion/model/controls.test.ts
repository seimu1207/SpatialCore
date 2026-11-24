import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { BUNDLED } from "./bundled.ts";
import { CONTROL_IDS, controlsFor, type ControlsInput } from "./controls.ts";
import { loadGameData } from "./game-data.ts";
import type { Phase } from "./phase.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const preset: Scenario = loaded.data.preset;

function input(phase: Phase, over: Partial<ControlsInput> = {}): ControlsInput {
  return {
    phase,
    selection: null,
    scenario: preset,
    connectOn: false,
    sampleShown: 0,
    preconditionCount: 3,
    replaying: false,
    ...over,
  };
}

describe("controlsFor", () => {
  it("Key_Choice is disabled without a Key_Edge selection and enabled with one (4.6, 14.2)", () => {
    const none = controlsFor(input("prepare"));
    const node = controlsFor(input("prepare", { selection: { kind: "node", id: "robot" } }));
    const key = controlsFor(input("prepare", { selection: { kind: "edge", id: "k-photos" } }));
    for (const id of ["keyPlain", "keyBell", "keyNone"] as const) {
      expect(none[id]).toEqual({ shown: true, enabled: false });
      expect(node[id].enabled).toBe(false);
      expect(key[id]).toEqual({ shown: true, enabled: true });
    }
    const nonKey = controlsFor(input("prepare", { selection: { kind: "edge", id: "read-page" } }));
    expect(nonKey.keyBell.enabled).toBe(false);
  });

  it("Key_Choice and don't-read exist only in prepare (14.2)", () => {
    const c = controlsFor(input("fixIt", { selection: { kind: "edge", id: "k-photos" } }));
    expect(c.keyBell.shown).toBe(false);
    expect(c.dontRead.shown).toBe(false);
  });

  it("don't read needs a text node the robot reads", () => {
    expect(controlsFor(input("prepare", { selection: { kind: "node", id: "page" } })).dontRead.enabled).toBe(true);
    expect(controlsFor(input("prepare", { selection: { kind: "node", id: "robot" } })).dontRead.enabled).toBe(false);
  });

  it("undo and redo are enabled only in prepare and fixIt (19.1, 19.2)", () => {
    const phases: Phase[] = ["sample", "prepare", "ghostNight", "fixIt", "lookBack"];
    for (const p of phases) {
      const c = controlsFor(input(p));
      const on = p === "prepare" || p === "fixIt";
      expect(c.undo.enabled).toBe(on);
      expect(c.redo.enabled).toBe(on);
    }
  });

  it("cancel is shown only while Connect_Mode is on in prepare or fixIt (19.9)", () => {
    const phases: Phase[] = ["sample", "prepare", "ghostNight", "fixIt", "lookBack"];
    for (const p of phases) {
      const edit = p === "prepare" || p === "fixIt";
      expect(controlsFor(input(p, { connectOn: true })).cancel.shown).toBe(edit);
      expect(controlsFor(input(p, { connectOn: false })).cancel.shown).toBe(false);
    }
  });

  it("connect source is hidden under Fallback_F1 (23.1)", () => {
    expect(controlsFor(input("prepare")).connectSource.shown).toBe(true);
    expect(controlsFor(input("prepare", { fallbackF1: true })).connectSource.shown).toBe(false);
  });

  it("the back link and ViewPreset controls are always shown and enabled (1.3, 11.1, 15.6)", () => {
    for (const p of ["sample", "prepare", "ghostNight", "fixIt", "lookBack"] as const) {
      const c = controlsFor(input(p, { replaying: true }));
      expect(c.back).toEqual({ shown: true, enabled: true });
      expect(c.preset).toEqual({ shown: true, enabled: true });
    }
  });

  it("Sample next is enabled until every Precondition is shown (13.3)", () => {
    for (const k of [0, 1, 2]) {
      const c = controlsFor(input("sample", { sampleShown: k }));
      expect(c.next.enabled).toBe(true);
      expect(c.toPrepare.enabled).toBe(false);
    }
    const done = controlsFor(input("sample", { sampleShown: 3 }));
    expect(done.next.enabled).toBe(false);
    expect(done.toPrepare.enabled).toBe(true);
  });

  it("Ghost Night has no enabled control except back and preset", () => {
    const c = controlsFor(input("ghostNight", { replaying: true }));
    const enabled = CONTROL_IDS.filter((id) => c[id].enabled);
    expect(enabled).toEqual(["back", "preset"]);
  });

  it("fixIt controls follow the selection and the stopped state", () => {
    const robotSel = { kind: "node", id: "robot" } as const;
    expect(controlsFor(input("fixIt", { selection: robotSel })).stopRobot.enabled).toBe(true);
    const stopped: Scenario = {
      ...preset,
      nodes: preset.nodes.map((n) => (n.id === "robot" ? { ...n, attributes: { ...n.attributes, stopped: 1 } } : n)),
    };
    expect(controlsFor(input("fixIt", { selection: robotSel, scenario: stopped })).stopRobot.enabled).toBe(false);
    expect(controlsFor(input("fixIt", { selection: { kind: "edge", id: "k-photos" } })).cutKey.enabled).toBe(true);
    expect(controlsFor(input("fixIt")).cutKey.enabled).toBe(false);
    expect(controlsFor(input("fixIt")).consult.enabled).toBe(true);
    expect(controlsFor(input("prepare")).consult.shown).toBe(false);
  });

  it("replay, prepare again, and start over are shown only in their phases", () => {
    expect(controlsFor(input("lookBack")).replay.enabled).toBe(true);
    expect(controlsFor(input("lookBack", { replaying: true })).replay.enabled).toBe(false);
    expect(controlsFor(input("lookBack")).prepareAgain.shown).toBe(true);
    expect(controlsFor(input("prepare")).prepareAgain.shown).toBe(false);
    expect(controlsFor(input("prepare")).startOver.shown).toBe(true);
    expect(controlsFor(input("lookBack")).startOver.shown).toBe(false);
  });
});
