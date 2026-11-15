import { scenarioSchema } from "../../core/model/scenario-schema.ts";

export type SchemaIssue = { path: string; message: string };

export type SchemaResult =
  | { ok: true }
  | { ok: false; kind: "parse"; message: string }
  | { ok: false; kind: "schema"; issues: SchemaIssue[] };

/** Pure check of one Scenario_File's text. No file reads, no process exit. */
export function checkScenarioText(text: string): SchemaResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, kind: "parse", message: error instanceof Error ? error.message : String(error) };
  }
  const result = scenarioSchema.safeParse(data);
  if (result.success) return { ok: true };
  return {
    ok: false,
    kind: "schema",
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}
