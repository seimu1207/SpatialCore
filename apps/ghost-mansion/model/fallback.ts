import { applyCommand } from "../../../core/model/commands.ts";
import type { EditCommand } from "../../../core/model/commands.ts";
import { loadRuleDefinition } from "../../../core/model/rule-schema.ts";
import type { DataResult, GameData } from "./game-data.ts";

/** Fallback switches (R-APP1-23). f2 forces f1 and limits propagation to one step. */
export type Flags = { f1: boolean; f2: boolean };

/** Both switches off (R-APP1-23.3). */
export const FALLBACK: Flags = { f1: false, f2: false };

const FILE = "rules/game-rules.json";

function fail(path: string, message: string): DataResult {
  return { ok: false, errors: [{ file: FILE, path, message }] };
}

/**
 * Returns the Game_Data for the given switches. With f1 (or f2) the answer and source Nodes
 * and the fog rules are removed. Never throws; no argument is written to.
 */
export function applyFallback(data: GameData, flags: Flags): DataResult {
  try {
    if (!flags.f1 && !flags.f2) return { ok: true, data };

    const ids = data.preset.nodes.filter((n) => n.type === "answer" || n.type === "source").map((n) => n.id);
    let preset = data.preset;
    if (ids.length > 0) {
      const batch: EditCommand = { kind: "batch", commands: ids.map((id) => ({ kind: "removeNode" as const, id })) };
      const applied = applyCommand(data.preset, batch);
      if (!applied.ok) return fail("preset", applied.errors.map((e) => e.message).join("; "));
      preset = applied.scenario;
    }

    const stripped = {
      ...data.rules,
      nodeRules: (data.rules.nodeRules ?? []).filter((r) => r.id !== "unsourced-answer"),
      effectRules: (data.rules.effectRules ?? []).filter((r) => r.id !== "mark-unsourced"),
    };
    const rules = loadRuleDefinition(stripped);
    if (!rules.ok) return fail("rules", rules.errors.map((e) => e.message).join("; "));

    return { ok: true, data: { ...data, preset, rules: rules.value } };
  } catch {
    return fail("", "the fallback could not be applied");
  }
}
