import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../core/model/commands.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { BUNDLED } from "./bundled.ts";
import { cutKeyCommand, dontReadCommand, isKeyEdge, keyChoiceCommand, stopRobotCommand } from "./commands.ts";
import { loadGameData } from "./game-data.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const preset: Scenario = loaded.data.preset;

function apply(s: Scenario, c: NonNullable<ReturnType<typeof keyChoiceCommand>>): Scenario {
  const r = applyCommand(s, c);
  if (!r.ok) throw new Error("command failed");
  return r.scenario;
}

describe("commands", () => {
  it("isKeyEdge is true for the four keys only", () => {
    expect(preset.edges.filter(isKeyEdge).map((e) => e.id)).toEqual(["k-photos", "k-messages", "k-homework", "k-diary"]);
  });

  it("keyChoiceCommand shapes (4.4, 4.5)", () => {
    expect(keyChoiceCommand(preset, "k-photos", "bell")).toEqual({
      kind: "updateEdge",
      id: "k-photos",
      changes: { type: "bell-key" },
    });
    expect(keyChoiceCommand(preset, "k-diary", "plain")).toEqual({
      kind: "updateEdge",
      id: "k-diary",
      changes: { type: "plain-key" },
    });
    expect(keyChoiceCommand(preset, "k-photos", "none")).toEqual({ kind: "removeEdge", id: "k-photos" });
  });

  it("keyChoiceCommand is null when unchanged or for a non-key Edge (19.7)", () => {
    expect(keyChoiceCommand(preset, "k-photos", "plain")).toBeNull();
    expect(keyChoiceCommand(preset, "k-diary", "bell")).toBeNull();
    expect(keyChoiceCommand(preset, "chain-1", "none")).toBeNull();
    expect(keyChoiceCommand(preset, "read-page", "plain")).toBeNull();
    expect(keyChoiceCommand(preset, "missing", "none")).toBeNull();
  });

  it("dontReadCommand turns reads into no-read (14.3)", () => {
    expect(dontReadCommand(preset, "page")).toEqual({
      kind: "updateEdge",
      id: "read-page",
      changes: { type: "no-read" },
    });
    expect(dontReadCommand(preset, "answer")).toBeNull();
  });

  it("dontReadCommand batches several reads Edges", () => {
    const two: Scenario = {
      ...preset,
      edges: [...preset.edges, { id: "read-page-2", from: "robot", to: "page", type: "reads" }],
    };
    const cmd = dontReadCommand(two, "page");
    expect(cmd?.kind).toBe("batch");
    if (cmd === null) return;
    const after = apply(two, cmd);
    expect(after.edges.filter((e) => e.type === "reads")).toHaveLength(0);
  });

  it("stopRobotCommand sets stopped with the full attributes, then is null (16.2)", () => {
    const cmd = stopRobotCommand(preset);
    expect(cmd).not.toBeNull();
    if (cmd === null) return;
    const after = apply(preset, cmd);
    const robot = after.nodes.find((n) => n.id === "robot");
    const before = preset.nodes.find((n) => n.id === "robot");
    expect(robot?.attributes).toEqual({ ...before?.attributes, stopped: 1 });
    expect(stopRobotCommand(after)).toBeNull();
  });

  it("cutKeyCommand only cuts Key_Edges (16.3, 19.7)", () => {
    expect(cutKeyCommand(preset, "k-messages")).toEqual({ kind: "removeEdge", id: "k-messages" });
    expect(cutKeyCommand(preset, "chain-1")).toBeNull();
    expect(cutKeyCommand(preset, "read-page")).toBeNull();
  });

  it("no command changes a zone or removes a non-key Edge (19.6, 19.7)", () => {
    const cmds = [
      ...preset.edges.flatMap((e) => [
        keyChoiceCommand(preset, e.id, "plain"),
        keyChoiceCommand(preset, e.id, "bell"),
        keyChoiceCommand(preset, e.id, "none"),
        cutKeyCommand(preset, e.id),
      ]),
      dontReadCommand(preset, "page"),
      stopRobotCommand(preset),
    ];
    for (const c of cmds) {
      if (c === null) continue;
      const after = apply(preset, c);
      expect(after.nodes.map((n) => [n.id, n.zone])).toEqual(preset.nodes.map((n) => [n.id, n.zone]));
      const nonKey = preset.edges.filter((e) => !isKeyEdge(e)).map((e) => e.id);
      for (const id of nonKey) expect(after.edges.some((e) => e.id === id)).toBe(true);
    }
  });
});
