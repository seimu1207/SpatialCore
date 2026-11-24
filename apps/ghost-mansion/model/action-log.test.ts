import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EditCommand } from "../../../core/model/commands.ts";
import { createHistory, executeCommand, redo, undo, type History } from "../../../core/model/history.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { evaluateCheckSets } from "../../../core/model/conditions.ts";
import { classifyPair, deriveActionLog } from "./action-log.ts";
import type { ResponseOp } from "./action-log.ts";
import { fixStepsArb } from "./arbitraries.ts";
import type { FixStep } from "./arbitraries.ts";
import { withCheckSet, responseCheckSet } from "./built-rules.ts";
import { BUNDLED } from "./bundled.ts";
import { cutKeyCommand, stopRobotCommand } from "./commands.ts";
import { loadGameData } from "./game-data.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const preset: Scenario = loaded.data.preset;

function start(): History {
  const r = createHistory(preset, 100);
  if (!r.ok) throw new Error("history");
  return r.history;
}

function run(h: History, c: EditCommand | null): History {
  if (c === null) throw new Error("command is null");
  const r = executeCommand(h, c);
  if (!r.ok) throw new Error("command rejected");
  return r.history;
}

function moveCommand(i: number): EditCommand {
  return { kind: "updateNode", id: "photos", changes: { position: { x: i, y: 0, z: 0 } } };
}

const stopAgain: EditCommand = {
  kind: "updateNode",
  id: "robot",
  changes: { attributes: { ...(preset.nodes.find((n) => n.id === "robot")?.attributes ?? {}), stopped: 1 } },
};

describe("action-log", () => {
  it("classifyPair reports the three operations in order", () => {
    let h = start();
    h = run(h, { kind: "addEdge", edge: { id: "c1", from: "robot", to: "parent", type: "consult" } });
    h = run(h, stopRobotCommand(h.present));
    h = run(h, cutKeyCommand(h.present, "k-photos"));
    expect(classifyPair(preset, h.present)).toEqual(["stop-robot", "cut-key", "consult"]);
    expect(classifyPair(preset, preset)).toEqual([]);
  });

  it("105 Fix It steps drop the oldest past entries and the log still starts from nightStart (16.6)", () => {
    let h = start();
    h = run(h, stopRobotCommand(h.present));
    h = run(h, cutKeyCommand(h.present, "k-photos"));
    for (let i = 0; i < 102; i++) h = run(h, moveCommand(i + 1));
    h = run(h, { kind: "addEdge", edge: { id: "c1", from: "robot", to: "parent", type: "consult" } });
    expect(h.past).toHaveLength(100);
    expect(classifyPair(preset, h.past[0])).toEqual(["stop-robot", "cut-key"]);
    expect(deriveActionLog(preset, h)).toEqual(["stop-robot", "cut-key", "consult"]);
  });

  it("a second Stop_Robot, a move, and a Consult_Edge to a non-helper add no entry (16.5, 19.8)", () => {
    let h = start();
    h = run(h, stopRobotCommand(h.present));
    h = run(h, stopAgain);
    h = run(h, moveCommand(3));
    h = run(h, { kind: "addEdge", edge: { id: "c2", from: "robot", to: "photos", type: "consult" } });
    h = run(h, { kind: "addEdge", edge: { id: "c3", from: "answer", to: "textbook", type: "cites" } });
    expect(deriveActionLog(preset, h)).toEqual(["stop-robot"]);
  });

  it("undo removes the entry and redo restores it (16.6)", () => {
    let h = start();
    h = run(h, stopRobotCommand(h.present));
    h = run(h, { kind: "addEdge", edge: { id: "c1", from: "robot", to: "friend", type: "consult" } });
    expect(deriveActionLog(preset, h)).toEqual(["stop-robot", "consult"]);
    h = undo(h);
    expect(deriveActionLog(preset, h)).toEqual(["stop-robot"]);
    h = redo(h);
    expect(deriveActionLog(preset, h)).toEqual(["stop-robot", "consult"]);
  });
});

function stepCommand(present: Scenario, step: FixStep): EditCommand | null {
  switch (step.type) {
    case "stopRobot":
      return stopRobotCommand(present);
    case "cutKey":
      return cutKeyCommand(present, step.edgeId);
    case "consult":
      return { kind: "addEdge", edge: { id: step.edgeId, from: step.from, to: step.to, type: "consult" } };
    case "move":
      return { kind: "updateNode", id: step.node, changes: { position: step.position } };
    case "rotate":
      return { kind: "updateNode", id: step.node, changes: { rotation: step.rotation } };
    case "scale":
      return { kind: "updateNode", id: step.node, changes: { scale: step.scale } };
    default:
      return null;
  }
}

/** Response_Operations a step adds, written from R-APP1-16.5 (not from classifyPair). */
function stepEntries(present: Scenario, step: FixStep): ResponseOp[] {
  if (step.type === "stopRobot") return ["stop-robot"];
  if (step.type === "cutKey") return ["cut-key"];
  if (step.type === "consult") {
    return present.nodes.find((n) => n.id === step.to)?.type === "helper" ? ["consult"] : [];
  }
  return [];
}

describe("action-log properties", () => {
  it("P-APP1-12 action log from history", () => {
    // Feature: app-ghost-mansion, Property 12: P-APP1-12 action log from history
    const rules = withCheckSet(loaded.data.rules, responseCheckSet(preset));
    if (!rules.ok) throw new Error("response rules must load");
    fc.assert(
      fc.property(fixStepsArb, (steps) => {
        let h = start();
        let refPast: ResponseOp[][] = [];
        let refFuture: ResponseOp[][] = [];
        for (const step of steps) {
          if (step.type === "undo") {
            h = undo(h);
            const e = refPast.pop();
            if (e !== undefined) refFuture.push(e);
          } else if (step.type === "redo") {
            h = redo(h);
            const e = refFuture.pop();
            if (e !== undefined) refPast.push(e);
          } else {
            const c = stepCommand(h.present, step);
            if (c === null) continue;
            const entries = stepEntries(h.present, step);
            const r = executeCommand(h, c);
            if (!r.ok) continue;
            h = r.history;
            refPast = [...refPast, entries];
            refFuture = [];
          }
        }
        const log = deriveActionLog(preset, h);
        expect(log).toEqual(refPast.flat());

        const checks = evaluateCheckSets(h.present, rules.value);
        if (!checks.ok) throw new Error("response check must evaluate");
        const response = checks.value.find((c) => c.id === "response");
        const holds = (id: string) => response?.items.find((i) => i.id === id)?.holds;
        expect(holds("stop-robot")).toBe(log.includes("stop-robot"));
        expect(holds("cut-key")).toBe(log.includes("cut-key"));
        expect(holds("consult")).toBe(log.includes("consult"));
      }),
      { numRuns: 100 },
    );
  });
});
