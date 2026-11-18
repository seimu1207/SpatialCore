import { z } from "zod";
import { compareCodePoints } from "./json.ts";
import { localizedTextSchema, nonBlank, toValidationErrors, type ValidationError } from "./scenario-schema.ts";

export type RuleFailure = { ok: false; errors: ValidationError[] };
export type RuleOutcome<T> = { ok: true; value: T } | RuleFailure;

const identifier = nonBlank;
const identifiers = z.array(identifier);

export const nonNegativeInteger = z
  .number()
  .refine((n) => Number.isInteger(n) && n >= 0, "must be an integer >= 0");

export const MAX_CONDITION_DEPTH = 32;

export const nodeSelectorSchema = z.object({
  ids: identifiers.optional(),
  types: identifiers.optional(),
  zones: identifiers.optional(),
  self: z.literal(true).optional(),
});

export const edgeFilterSchema = z.object({
  include: identifiers.optional(),
  exclude: identifiers.optional(),
});

/** A range needs at least one bound, and min must not exceed max (min === max passes). */
export function checkRange(value: { min?: number | undefined; max?: number | undefined }, ctx: z.RefinementCtx): void {
  if (value.min === undefined && value.max === undefined) {
    ctx.addIssue({ code: "custom", message: "min or max is required" });
  } else if (value.min !== undefined && value.max !== undefined && value.min > value.max) {
    ctx.addIssue({ code: "custom", message: "min must not be greater than max" });
  }
}

const edgeCountSchema = z
  .object({
    kind: z.literal("edgeCount"),
    edges: edgeFilterSchema,
    from: nodeSelectorSchema,
    to: nodeSelectorSchema,
    min: nonNegativeInteger.optional(),
    max: nonNegativeInteger.optional(),
  })
  .superRefine(checkRange);

const reachSchema = z.object({
  kind: z.literal("reach"),
  from: nodeSelectorSchema,
  to: nodeSelectorSchema,
  edges: edgeFilterSchema,
});

const attributeSchema = z
  .object({
    kind: z.literal("attribute"),
    nodes: nodeSelectorSchema,
    attribute: identifier,
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .superRefine(checkRange);

const allSchema = z.object({
  kind: z.literal("all"),
  get conditions(): z.ZodArray<typeof conditionSchema> {
    return z.array(conditionSchema);
  },
});

const anySchema = z.object({
  kind: z.literal("any"),
  get conditions(): z.ZodArray<typeof conditionSchema> {
    return z.array(conditionSchema);
  },
});

const notSchema = z.object({
  kind: z.literal("not"),
  get condition(): typeof conditionSchema {
    return conditionSchema;
  },
});

export const conditionSchema = z.discriminatedUnion("kind", [
  edgeCountSchema,
  reachSchema,
  attributeSchema,
  allSchema,
  anySchema,
  notSchema,
]);

export const MAX_CONDITION_OCCURRENCES = 10_000;

const MULTIPLICITY_CAP = MAX_CONDITION_OCCURRENCES + 1;
const DEPTH_ERROR_MESSAGE = "condition is nested deeper than 32 levels or has more than 10,000 parts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isCombinator(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && (value["kind"] === "all" || value["kind"] === "any" || value["kind"] === "not");
}

/**
 * Checks the depth (32) and the expanded size (10,000 occurrences) of a Condition without recursion.
 * Over either limit it returns an empty `all` and one error at `path`. Never writes to the input.
 */
export function limitConditionDepth(
  condition: unknown,
  path: string,
): { value: unknown; error: ValidationError | null } {
  const fail = (): { value: unknown; error: ValidationError } => ({
    value: { kind: "all", conditions: [] },
    error: { path, message: DEPTH_ERROR_MESSAGE },
  });

  let frontier = new Map<unknown, number>([[condition, 1]]);
  let occurrences = 1;

  for (let level = 1; level <= MAX_CONDITION_DEPTH; level += 1) {
    const combinators: [Record<string, unknown>, number][] = [];
    for (const [entry, multiplicity] of frontier) {
      if (isCombinator(entry)) combinators.push([entry, multiplicity]);
    }
    if (combinators.length === 0) return { value: condition, error: null };
    if (level === MAX_CONDITION_DEPTH) return fail();

    const next = new Map<unknown, number>();
    for (const [combinator, multiplicity] of combinators) {
      const list = combinator["conditions"];
      const count = combinator["kind"] === "not" ? 1 : Array.isArray(list) ? list.length : 0;
      for (let i = 0; i < count; i += 1) {
        const child: unknown = combinator["kind"] === "not" ? combinator["condition"] : (list as unknown[])[i];
        if (typeof child !== "object" || child === null) continue;
        occurrences += multiplicity;
        if (occurrences > MAX_CONDITION_OCCURRENCES) return fail();
        next.set(child, Math.min((next.get(child) ?? 0) + multiplicity, MULTIPLICITY_CAP));
      }
    }
    frontier = next;
  }
  return fail();
}

export const checkItemSchema = z.object({ id: identifier, condition: conditionSchema });
export const checkSetSchema = z.object({ id: identifier, items: z.array(checkItemSchema) });
export const nodeRuleSchema = z.object({ id: identifier, nodes: nodeSelectorSchema, condition: conditionSchema });

export const effectSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("nodeRule"), id: identifier }),
  z.object({ kind: z.literal("shifts"), attribute: identifier }),
  z.object({ kind: z.literal("longRuns"), attribute: identifier }),
  z.object({ kind: z.literal("propagation") }),
]);
export const effectRuleSchema = z.object({ id: identifier, effect: identifier, source: effectSourceSchema });

export const propagationPolicySchema = z.object({ pass: identifiers, stop: identifiers });

type PathPart = string | number;

const SELF_MESSAGE = "self may only be used inside the condition of a node rule";

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1;
}

/** Reports every later entry whose `id` repeats an earlier one in the same list. */
function checkDuplicateIds(list: unknown, listPath: PathPart[], ctx: z.RefinementCtx): void {
  if (!Array.isArray(list)) return;
  const first = new Map<string, number>();
  list.forEach((entry: unknown, index) => {
    if (!isPlainObject(entry)) return;
    const id = entry["id"];
    if (!validId(id)) return;
    const firstIndex = first.get(id);
    if (firstIndex === undefined) {
      first.set(id, index);
      return;
    }
    ctx.addIssue({
      code: "custom",
      path: [...listPath, index, "id"],
      message: `duplicate id ${JSON.stringify(id)}, first used at ${[...listPath, firstIndex].join(".")}`,
    });
  });
}

function checkSelectorSelf(selector: unknown, path: PathPart[], ctx: z.RefinementCtx): void {
  if (isPlainObject(selector) && selector["self"] === true) {
    ctx.addIssue({ code: "custom", path: [...path, "self"], message: SELF_MESSAGE });
  }
}

/** Pre-order walk. The depth pre-check has already limited every Condition to 32 levels. */
function checkConditionSelf(condition: unknown, path: PathPart[], ctx: z.RefinementCtx): void {
  if (!isPlainObject(condition)) return;
  switch (condition["kind"]) {
    case "edgeCount":
    case "reach":
      checkSelectorSelf(condition["from"], [...path, "from"], ctx);
      checkSelectorSelf(condition["to"], [...path, "to"], ctx);
      break;
    case "attribute":
      checkSelectorSelf(condition["nodes"], [...path, "nodes"], ctx);
      break;
    case "all":
    case "any": {
      const list = condition["conditions"];
      if (Array.isArray(list)) {
        list.forEach((child: unknown, index) => {
          checkConditionSelf(child, [...path, "conditions", index], ctx);
        });
      }
      break;
    }
    case "not":
      checkConditionSelf(condition["condition"], [...path, "condition"], ctx);
      break;
    default:
      break;
  }
}

function entriesOf(list: unknown): [number, Record<string, unknown>][] {
  if (!Array.isArray(list)) return [];
  const result: [number, Record<string, unknown>][] = [];
  list.forEach((entry: unknown, index) => {
    if (isPlainObject(entry)) result.push([index, entry]);
  });
  return result;
}

/** Cross-field checks of a Rule_Definition. Reads every field defensively; values that fail their own schema are skipped. */
export function checkRuleCrossFields(value: unknown, ctx: z.RefinementCtx): void {
  if (!isPlainObject(value)) return;
  const checkSets = entriesOf(value["checkSets"]);
  const nodeRules = entriesOf(value["nodeRules"]);
  const effectRules = entriesOf(value["effectRules"]);

  // 1. Duplicate ids.
  checkDuplicateIds(value["checkSets"], ["checkSets"], ctx);
  for (const [setIndex, set] of checkSets) {
    checkDuplicateIds(set["items"], ["checkSets", setIndex, "items"], ctx);
  }
  checkDuplicateIds(value["nodeRules"], ["nodeRules"], ctx);
  checkDuplicateIds(value["effectRules"], ["effectRules"], ctx);

  // 2. Pass/stop overlap.
  const propagation = value["propagation"];
  if (isPlainObject(propagation) && Array.isArray(propagation["pass"]) && Array.isArray(propagation["stop"])) {
    const pass = new Set<unknown>(propagation["pass"]);
    propagation["stop"].forEach((type: unknown, index) => {
      if (validId(type) && pass.has(type)) {
        ctx.addIssue({
          code: "custom",
          path: ["propagation", "stop", index],
          message: `edge type ${JSON.stringify(type)} is listed in both pass and stop`,
        });
      }
    });
  }

  // 3. Misplaced self: true.
  for (const [setIndex, set] of checkSets) {
    for (const [itemIndex, item] of entriesOf(set["items"])) {
      checkConditionSelf(item["condition"], ["checkSets", setIndex, "items", itemIndex, "condition"], ctx);
    }
  }
  for (const [ruleIndex, rule] of nodeRules) {
    checkSelectorSelf(rule["nodes"], ["nodeRules", ruleIndex, "nodes"], ctx);
  }

  // 4. Unknown node rule references.
  const nodeRuleIds = new Set<string>();
  for (const [, rule] of nodeRules) {
    if (validId(rule["id"])) nodeRuleIds.add(rule["id"]);
  }
  for (const [ruleIndex, rule] of effectRules) {
    const source = rule["source"];
    if (!isPlainObject(source) || source["kind"] !== "nodeRule") continue;
    const id = source["id"];
    if (validId(id) && !nodeRuleIds.has(id)) {
      ctx.addIssue({
        code: "custom",
        path: ["effectRules", ruleIndex, "source", "id"],
        message: `no node rule with id ${JSON.stringify(id)}`,
      });
    }
  }
}

export const ruleDefinitionSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
    id: identifier,
    propagation: propagationPolicySchema,
    checkSets: z.array(checkSetSchema).optional(),
    nodeRules: z.array(nodeRuleSchema).optional(),
    effectRules: z.array(effectRuleSchema).optional(),
  })
  .superRefine(checkRuleCrossFields, { when: (p) => isPlainObject(p.value) });

/** Copy of `list` with entry `index` replaced. Spreads only; the input is never written. */
function replaceAt(list: unknown[], index: number, entry: unknown): unknown[] {
  return [...list.slice(0, index), entry, ...list.slice(index + 1)];
}

/** Applies the depth and size limit to every Condition field. Returns the (possibly copied) value and the errors. */
function limitRuleConditions(value: Record<string, unknown>): { copy: Record<string, unknown>; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  let copy: Record<string, unknown> = value;

  const checkSets = value["checkSets"];
  if (Array.isArray(checkSets)) {
    checkSets.forEach((set: unknown, i) => {
      if (!isPlainObject(set) || !Array.isArray(set["items"])) return;
      const items = set["items"] as unknown[];
      items.forEach((item: unknown, j) => {
        if (!isPlainObject(item)) return;
        const result = limitConditionDepth(item["condition"], `checkSets.${i}.items.${j}.condition`);
        if (result.error === null) return;
        errors.push(result.error);
        const currentSets = copy["checkSets"] as unknown[];
        const currentSet = currentSets[i] as Record<string, unknown>;
        const currentItems = currentSet["items"] as unknown[];
        const currentItem = currentItems[j] as Record<string, unknown>;
        const newItem = { ...currentItem, condition: result.value };
        const newSet = { ...currentSet, items: replaceAt(currentItems, j, newItem) };
        copy = { ...copy, checkSets: replaceAt(currentSets, i, newSet) };
      });
    });
  }

  const nodeRules = value["nodeRules"];
  if (Array.isArray(nodeRules)) {
    nodeRules.forEach((rule: unknown, i) => {
      if (!isPlainObject(rule)) return;
      const result = limitConditionDepth(rule["condition"], `nodeRules.${i}.condition`);
      if (result.error === null) return;
      errors.push(result.error);
      const currentRules = copy["nodeRules"] as unknown[];
      const newRule = { ...(currentRules[i] as Record<string, unknown>), condition: result.value };
      copy = { ...copy, nodeRules: replaceAt(currentRules, i, newRule) };
    });
  }

  return { copy, errors };
}

/** Validates any value as a Rule_Definition. Never throws, never writes to `value`. */
export function loadRuleDefinition(value: unknown): RuleOutcome<RuleDefinition> {
  try {
    let input: unknown = value;
    let depthErrors: ValidationError[] = [];
    if (isPlainObject(value)) {
      const limited = limitRuleConditions(value);
      input = limited.copy;
      depthErrors = limited.errors;
    }
    const parsed = ruleDefinitionSchema.safeParse(input);
    const errors = [...depthErrors, ...(parsed.success ? [] : toValidationErrors(parsed.error.issues))];
    if (errors.length > 0) return { ok: false, errors };
    if (!parsed.success) return { ok: false, errors: [{ path: "", message: "the rule definition could not be validated" }] };
    return { ok: true, value: parsed.data };
  } catch {
    return { ok: false, errors: [{ path: "", message: "the rule definition could not be validated" }] };
  }
}

export const seriesSettingsSchema = z.object({
  attribute: identifier,
  zoneValue: z.enum(["sum", "mean"]),
  shiftThreshold: z.number().min(0),
  direction: z.enum(["up", "down", "both"]),
  runTolerance: z.number().min(0),
  minRunLength: z.number().refine((n) => Number.isInteger(n) && n >= 2, "must be an integer >= 2"),
});
export const intentionalMarksSchema = z.array(identifier);

export const nodeRuleResultSchema = z.object({ id: identifier, nodes: identifiers, unresolved: identifiers });

export const propagationResultSchema = z.object({
  reached: z.array(z.object({ node: identifier, step: nonNegativeInteger, via: identifier.optional() })),
  traversed: identifiers,
  stopped: identifiers,
  unresolved: identifiers,
});

export const seriesResultSchema = z.object({
  attribute: identifier,
  series: z.array(z.object({ zone: identifier, value: z.number() })),
  changes: z.array(z.object({ from: identifier, to: identifier, change: z.number() })),
  shifts: z.array(z.object({ from: identifier, to: identifier, change: z.number(), intentional: z.boolean() })),
  longRuns: z.array(identifiers),
  unresolved: identifiers,
});

export const judgementResultsSchema = z.object({
  nodeRules: z.array(nodeRuleResultSchema).optional(),
  series: z.array(seriesResultSchema).optional(),
  propagation: propagationResultSchema.optional(),
});

export const effectTargetSchema = z.object({ kind: z.enum(["node", "edge", "zone"]), id: identifier });
export const effectRequestSchema = z.object({ effect: identifier, target: effectTargetSchema, source: identifier });

/** Each `reached.<i>.step` must be at most `reached.length - 1`. Reads defensively. */
function stepsWithinCount(value: { reached: { step: number }[] }, ctx: z.RefinementCtx): void {
  const limit = value.reached.length - 1;
  value.reached.forEach((entry, index) => {
    if (entry.step > limit) {
      ctx.addIssue({
        code: "custom",
        path: ["reached", index, "step"],
        message: "step is larger than the number of reached nodes allows",
      });
    }
  });
}

/** Used only to validate the argument of `timelineFromPropagation`. */
export const timelinePropagationSchema = propagationResultSchema.superRefine(stepsWithinCount, {
  when: (p) => p.issues.length === 0,
});

export const timelineStepSchema = z.object({
  id: identifier,
  label: localizedTextSchema.optional(),
  targets: z.array(effectTargetSchema),
  effects: z.array(effectRequestSchema),
});

function duplicateStepIds(value: unknown, ctx: z.RefinementCtx): void {
  if (!isPlainObject(value)) return;
  checkDuplicateIds(value["steps"], ["steps"], ctx);
}

export const timelineSchema = z
  .object({ steps: z.array(timelineStepSchema).min(1) })
  .superRefine(duplicateStepIds, { when: (p) => isPlainObject(p.value) });

function positionInRange(value: { timeline: { steps: unknown[] }; position: number }, ctx: z.RefinementCtx): void {
  if (value.position >= value.timeline.steps.length) {
    ctx.addIssue({
      code: "custom",
      path: ["position"],
      message: `position must be an integer from 0 to ${value.timeline.steps.length - 1}`,
    });
  }
}

export const timelineCursorSchema = z
  .object({ timeline: timelineSchema, position: nonNegativeInteger })
  .superRefine(positionInRange, { when: (p) => p.issues.length === 0 });

export const explanationRequestSchema = z.object({ topic: identifier });

const ENTRY_MESSAGE = "entry must have a non-blank key and a localized text";

export const explanationTableSchema = z
  .custom<Record<string, z.infer<typeof localizedTextSchema>>>()
  .superRefine((table, ctx) => {
    if (!isPlainObject(table)) {
      ctx.addIssue({ code: "custom", message: "table must be a JSON object" });
      return;
    }
    for (const key of Object.keys(table).sort(compareCodePoints)) {
      const entry: unknown = Object.getOwnPropertyDescriptor(table, key)?.value;
      if (!validId(key) || !localizedTextSchema.safeParse(entry).success) {
        ctx.addIssue({ code: "custom", path: [key], message: ENTRY_MESSAGE });
      }
    }
  });
export type SeriesSettings = z.infer<typeof seriesSettingsSchema>;
export type IntentionalMarks = z.infer<typeof intentionalMarksSchema>;
export type NodeRuleResult = z.infer<typeof nodeRuleResultSchema>;
export type PropagationResult = z.infer<typeof propagationResultSchema>;
export type SeriesResult = z.infer<typeof seriesResultSchema>;
export type JudgementResults = z.infer<typeof judgementResultsSchema>;
export type EffectTarget = z.infer<typeof effectTargetSchema>;
export type EffectRequest = z.infer<typeof effectRequestSchema>;

export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;
export type NodeSelector = z.infer<typeof nodeSelectorSchema>;
export type EdgeFilter = z.infer<typeof edgeFilterSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type CheckItem = z.infer<typeof checkItemSchema>;
export type CheckSet = z.infer<typeof checkSetSchema>;
export type NodeRule = z.infer<typeof nodeRuleSchema>;
export type EffectRule = z.infer<typeof effectRuleSchema>;
export type PropagationPolicy = z.infer<typeof propagationPolicySchema>;
export type TimelineStep = z.infer<typeof timelineStepSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
export type TimelineCursor = z.infer<typeof timelineCursorSchema>;
export type ExplanationRequest = z.infer<typeof explanationRequestSchema>;
export type ExplanationTable = z.infer<typeof explanationTableSchema>;
