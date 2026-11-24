import { describe, expect, it } from "vitest";
import { attackCheckSet, withCheckSet } from "./built-rules.ts";
import { BUNDLED } from "./bundled.ts";
import { applyFallback, FALLBACK } from "./fallback.ts";
import { loadGameData } from "./game-data.ts";
import type { GameData } from "./game-data.ts";
import { judgeNight } from "./judge.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const data = loaded.data;

function fell(f1: boolean, f2: boolean): GameData {
  const r = applyFallback(data, { f1, f2 });
  if (!r.ok) throw new Error("fallback failed");
  return r.data;
}

describe("fallback", () => {
  it("FALLBACK is off and leaves the data unchanged (23.3)", () => {
    expect(FALLBACK).toEqual({ f1: false, f2: false });
    expect(fell(false, false)).toEqual(data);
  });

  it("f1 removes answer and source nodes, their edges, the Node_Rule, and the fog rule (23.1)", () => {
    expect(data.preset.nodes.some((n) => n.type === "answer" || n.type === "source")).toBe(true);
    const out = fell(true, false);
    expect(out.preset.nodes.some((n) => n.type === "answer" || n.type === "source")).toBe(false);
    const ids = new Set(out.preset.nodes.map((n) => n.id));
    expect(out.preset.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    expect((out.rules.nodeRules ?? []).some((r) => r.id === "unsourced-answer")).toBe(false);
    expect((out.rules.effectRules ?? []).some((r) => r.id === "mark-unsourced")).toBe(false);
    expect((out.rules.effectRules ?? []).some((r) => r.id === "show-damage")).toBe(true);
  });

  it("f1 gives no fog; the argument is not written to (23.1)", () => {
    const before = JSON.stringify(data);
    const out = fell(true, false);
    expect(JSON.stringify(data)).toBe(before);
    const rules = withCheckSet(out.rules, attackCheckSet(out.attackCard));
    if (!rules.ok) throw new Error("rules must build");
    const r = judgeNight(out.preset, out, rules.value, { f1: true, f2: false });
    expect(r.ok && r.value.fog).toEqual([]);
  });

  it("f2 forces f1, keeps three jobs, and limits propagation to one step (23.2)", () => {
    const out = fell(false, true);
    expect(out).toEqual(fell(true, false));
    expect(out.jobs.jobs).toHaveLength(3);
    const rules = withCheckSet(out.rules, attackCheckSet(out.attackCard));
    if (!rules.ok) throw new Error("rules must build");
    const r = judgeNight(out.preset, out, rules.value, { f1: false, f2: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.fog).toEqual([]);
      expect(Math.max(0, ...r.value.propagation.reached.map((x) => x.step))).toBeLessThanOrEqual(1);
    }
  });
});
