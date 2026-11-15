import { applyCommand, type EditCommand } from "./commands.ts";
import { validateScenario, type Scenario, type ValidationError } from "./scenario-schema.ts";

export type History = { past: Scenario[]; present: Scenario; future: Scenario[]; limit: number };
export const DEFAULT_HISTORY_LIMIT = 100;

export type CreateHistoryResult = { ok: true; history: History } | { ok: false; errors: ValidationError[] };
export type ExecuteResult =
  | { ok: true; history: History }
  | { ok: false; history: History; errors: ValidationError[] };

/** Start a History. `limit` must be a positive safe integer (default 100). Never throws. */
export function createHistory(scenario: Scenario, limit?: number): CreateHistoryResult {
  try {
    const size = limit === undefined ? DEFAULT_HISTORY_LIMIT : limit;
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
      return { ok: false, errors: [{ path: "limit", message: "limit must be a positive integer" }] };
    }
    const valid = validateScenario(scenario);
    if (!valid.ok) return valid;
    return { ok: true, history: { past: [], present: valid.scenario, future: [], limit: size } };
  } catch {
    return { ok: false, errors: [{ path: "", message: "the history could not be created" }] };
  }
}

/** Apply a command as one History step. A rejected command returns the input History itself. */
export function executeCommand(history: History, command: EditCommand): ExecuteResult {
  const result = applyCommand(history.present, command);
  if (!result.ok) return { ok: false, history, errors: result.errors };
  return {
    ok: true,
    history: {
      past: [...history.past, history.present].slice(-history.limit),
      present: result.scenario,
      future: [],
      limit: history.limit,
    },
  };
}

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    limit: history.limit,
  };
}

export function redo(history: History): History {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    limit: history.limit,
  };
}
