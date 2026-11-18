import type { z } from "zod";
import {
  loadRuleDefinition,
  type NodeSelector,
  type RuleDefinition,
  type RuleOutcome,
} from "./rule-schema.ts";
import {
  toValidationErrors,
  validateScenario,
  type Scenario,
  type ValidationError,
} from "./scenario-schema.ts";

/** Runs one engine function body. An unexpected exception becomes one error at "" (its text is never shown). */
export function guard<T>(run: () => RuleOutcome<T>): RuleOutcome<T> {
  try {
    return run();
  } catch {
    return { ok: false, errors: [{ path: "", message: "the rules could not be evaluated" }] };
  }
}

/** Path "" becomes the prefix; any other path q becomes "prefix.q". */
export function prefixErrors(prefix: string, errors: readonly ValidationError[]): ValidationError[] {
  return errors.map((e) => ({ path: e.path === "" ? prefix : `${prefix}.${e.path}`, message: e.message }));
}

/** Parses one argument with a Zod schema. Failures are prefixed with the argument name. */
export function parseArg<T>(schema: z.ZodType<T>, value: unknown, prefix: string): RuleOutcome<T> {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, errors: prefixErrors(prefix, toValidationErrors(result.error.issues)) };
}

export function checkScenario(value: unknown): RuleOutcome<Scenario> {
  const result = validateScenario(value);
  if (result.ok) return { ok: true, value: result.scenario };
  return { ok: false, errors: prefixErrors("scenario", result.errors) };
}

export function checkRules(value: unknown): RuleOutcome<RuleDefinition> {
  const result = loadRuleDefinition(value);
  if (result.ok) return result;
  return { ok: false, errors: prefixErrors("rules", result.errors) };
}

/** One error at `<prefix>.self` when a selector given directly as an argument has `self: true`. */
export function rejectSelf(selector: NodeSelector, prefix: string): ValidationError[] {
  if (selector.self !== true) return [];
  return [{ path: `${prefix}.self`, message: "self is only allowed inside a node rule" }];
}

/** Errors of the failed parts, in the order given. */
export function combine(...parts: RuleOutcome<unknown>[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const part of parts) {
    if (!part.ok) errors.push(...part.errors);
  }
  return errors;
}
