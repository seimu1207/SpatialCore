import { describe, expect, it } from "vitest";
import {
  CONTROL_IDS,
  controlsFor,
  statusFor,
  type ControlId,
  type ControlsInput,
} from "./controls.ts";

const base: ControlsInput = {
  walk: "idle",
  busy: false,
  past: 1,
  future: 1,
  hasSelection: true,
  canWalk: true,
  zoneCount: 4,
};
const EDITING: ControlId[] = [
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
];

describe("controlsFor", () => {
  it("enables every control that is allowed when idle with history and a selection", () => {
    const c = controlsFor(base);
    for (const id of EDITING) expect(c[id], id).toBe(true);
    expect(c.start).toBe(true);
    expect(c.pause).toBe(false);
    expect(c.resume).toBe(false);
    expect(c.stop).toBe(false);
  });

  it("returns every control id", () => {
    expect(Object.keys(controlsFor(base)).sort()).toEqual([...CONTROL_IDS].sort());
  });

  it("needs past for undo, future for redo, a selection for removeImage", () => {
    const c = controlsFor({ ...base, past: 0, future: 0, hasSelection: false });
    expect(c.undo).toBe(false);
    expect(c.redo).toBe(false);
    expect(c.removeImage).toBe(false);
    expect(c.addImages).toBe(true);
    expect(c.rotateMode).toBe(true);
    expect(c.scaleMode).toBe(true);
  });

  it("disables editing controls and start while playing or paused", () => {
    for (const walk of ["playing", "paused"] as const) {
      const c = controlsFor({ ...base, walk });
      for (const id of EDITING) expect(c[id], `${walk} ${id}`).toBe(false);
      expect(c.start).toBe(false);
    }
  });

  it("disables editing controls and start while busy", () => {
    const c = controlsFor({ ...base, busy: true });
    for (const id of EDITING) expect(c[id], id).toBe(false);
    expect(c.start).toBe(false);
  });

  it("enables editing again when the walk is finished", () => {
    const c = controlsFor({ ...base, walk: "finished" });
    for (const id of EDITING) expect(c[id], id).toBe(true);
    expect(c.start).toBe(true);
  });

  it("disables start when the Board cannot be walked", () => {
    expect(controlsFor({ ...base, canWalk: false, zoneCount: 1 }).start).toBe(false);
    expect(controlsFor({ ...base, canWalk: false }).start).toBe(false);
  });

  it("enables pause, resume, stop only in their Walk_States", () => {
    const pick = (walk: ControlsInput["walk"]) => {
      const c = controlsFor({ ...base, walk });
      return [c.pause, c.resume, c.stop];
    };
    expect(pick("idle")).toEqual([false, false, false]);
    expect(pick("playing")).toEqual([true, false, true]);
    expect(pick("paused")).toEqual([false, true, true]);
    expect(pick("finished")).toEqual([false, false, true]);
  });

  it("keeps the viewpoint buttons always enabled", () => {
    for (const walk of ["idle", "playing", "paused", "finished"] as const) {
      for (const busy of [false, true]) {
        const c = controlsFor({ ...base, walk, busy, canWalk: false });
        expect(c.overview).toBe(true);
        expect(c.visitor).toBe(true);
      }
    }
  });
});

describe("statusFor", () => {
  it("gives the editing hint while playing and paused", () => {
    for (const walk of ["playing", "paused"] as const) {
      expect(statusFor({ ...base, walk })?.en).toBe(
        "The board cannot be edited during a walkthrough.",
      );
    }
  });

  it("gives the 2-zone hint for a Board with fewer than 2 zones", () => {
    const s = statusFor({ ...base, canWalk: false, zoneCount: 1 });
    expect(s?.en).toBe("The walkthrough needs at least 2 zones.");
    expect(s?.ja.length).toBeGreaterThan(0);
  });

  it("gives the footprint hint for a zone without a footprint", () => {
    expect(statusFor({ ...base, canWalk: false, zoneCount: 3 })?.en).toBe(
      "The walkthrough needs a floor area for every zone.",
    );
  });

  it("gives no hint otherwise", () => {
    expect(statusFor(base)).toBeNull();
    expect(statusFor({ ...base, walk: "finished" })).toBeNull();
    expect(statusFor({ ...base, busy: true })).toBeNull();
  });
});
