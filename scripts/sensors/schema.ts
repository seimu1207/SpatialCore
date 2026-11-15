import { loadScenario } from "../../core/model/scenario-io.ts";
import type { ValidationError } from "../../core/model/scenario-schema.ts";

export type SchemaResult = { ok: true } | { ok: false; errors: ValidationError[] };

/** Pure check of one Scenario_File's text. No file reads, no process exit. */
export function checkScenarioText(text: string): SchemaResult {
  const result = loadScenario(text);
  return result.ok ? { ok: true } : { ok: false, errors: result.errors };
}