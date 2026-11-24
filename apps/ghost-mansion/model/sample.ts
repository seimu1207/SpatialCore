import { applyCommand } from "../../../core/model/commands.ts";
import type { SingleCommand } from "../../../core/model/commands.ts";
import type { Scenario, ValidationError } from "../../../core/model/scenario-schema.ts";
import { isKeyEdge } from "./commands.ts";
import { EDGE_TYPES } from "./names.ts";

export type SampleResult = { ok: true; scenario: Scenario } | { ok: false; errors: ValidationError[] };

/** The Sample_Mansion: the preset with every Key_Edge a plain key. Returns `preset` itself when nothing changes. */
export function deriveSample(preset: Scenario): SampleResult {
  const commands: SingleCommand[] = preset.edges
    .filter((e) => isKeyEdge(e) && e.type !== EDGE_TYPES.plainKey)
    .map((e) => ({ kind: "updateEdge", id: e.id, changes: { type: EDGE_TYPES.plainKey } }));
  if (commands.length === 0) return { ok: true, scenario: preset };
  return applyCommand(preset, { kind: "batch", commands });
}
