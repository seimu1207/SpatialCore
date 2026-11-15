import { canonicalJson, isPlainObject } from "./json.ts";
import { validateScenario, type Scenario, type ValidationError } from "./scenario-schema.ts";

export const NOT_JSON_MESSAGE = "JSON could not be parsed: the text is not valid JSON";
export const NOT_OBJECT_MESSAGE = "a JSON object is expected at the top level";
const UNEXPECTED_MESSAGE = "the scenario could not be validated";

export type LoadResult = { ok: true; scenario: Scenario } | { ok: false; errors: ValidationError[] };
export type SaveResult = { ok: true; text: string } | { ok: false; errors: ValidationError[] };

/** Parse and validate scenario JSON text. Never throws. */
export function loadScenario(text: string): LoadResult {
  const body = text.startsWith("\uFEFF") ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, errors: [{ path: "", message: NOT_JSON_MESSAGE }] };
  }
  try {
    if (!isPlainObject(parsed)) return { ok: false, errors: [{ path: "", message: NOT_OBJECT_MESSAGE }] };
    return validateScenario(parsed);
  } catch {
    return { ok: false, errors: [{ path: "", message: UNEXPECTED_MESSAGE }] };
  }
}

/** Validate a Scenario and write it as canonical JSON text. Never throws; never writes to its input. */
export function saveScenario(scenario: Scenario): SaveResult {
  try {
    const result = validateScenario(scenario);
    if (!result.ok) return { ok: false, errors: result.errors };
    return { ok: true, text: canonicalJson(result.scenario) };
  } catch {
    return { ok: false, errors: [{ path: "", message: UNEXPECTED_MESSAGE }] };
  }
}
