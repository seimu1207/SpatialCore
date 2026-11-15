import { z } from "zod";
import {
  edgeChangesSchema,
  edgeSchema,
  nodeChangesSchema,
  nodeSchema,
  nonBlank,
  toValidationErrors,
  validateScenario,
  zoneChangesSchema,
  zoneSchema,
  type Scenario,
  type ValidationError,
} from "./scenario-schema.ts";

export const singleCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("addNode"), node: nodeSchema }),
  z.object({ kind: z.literal("removeNode"), id: nonBlank }),
  z.object({ kind: z.literal("updateNode"), id: nonBlank, changes: nodeChangesSchema }),
  z.object({ kind: z.literal("addEdge"), edge: edgeSchema }),
  z.object({ kind: z.literal("removeEdge"), id: nonBlank }),
  z.object({ kind: z.literal("updateEdge"), id: nonBlank, changes: edgeChangesSchema }),
  z.object({ kind: z.literal("addZone"), zone: zoneSchema }),
  z.object({ kind: z.literal("removeZone"), id: nonBlank }),
  z.object({ kind: z.literal("updateZone"), id: nonBlank, changes: zoneChangesSchema }),
]);

export const editCommandSchema = z.discriminatedUnion("kind", [
  ...singleCommandSchema.options,
  z.object({ kind: z.literal("batch"), commands: z.array(singleCommandSchema).min(1) }),
]);

export type SingleCommand = z.infer<typeof singleCommandSchema>;
export type EditCommand = z.infer<typeof editCommandSchema>;
export type ApplyResult = { ok: true; scenario: Scenario } | { ok: false; errors: ValidationError[] };

const UNEXPECTED_MESSAGE = "the command could not be applied";

function fail(path: string, message: string): ApplyResult {
  return { ok: false, errors: [{ path, message }] };
}

/** Copy `base`, set every changed field, and delete a field whose change is `null`. */
function applyChanges<T extends object>(base: T, changes: object): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete out[key];
    else if (value !== undefined) out[key] = value;
  }
  return out as T;
}

function replaceById<T extends { id: string }>(list: readonly T[], id: string, change: (item: T) => T): T[] | null {
  if (!list.some((item) => item.id === id)) return null;
  return list.map((item) => (item.id === id ? change(item) : item));
}

function applySingle(s: Scenario, c: SingleCommand): ApplyResult {
  let next: Scenario;
  switch (c.kind) {
    case "addNode":
      next = { ...s, nodes: [...s.nodes, c.node] };
      break;
    case "addEdge":
      next = { ...s, edges: [...s.edges, c.edge] };
      break;
    case "addZone":
      next = { ...s, zones: [...s.zones, c.zone] };
      break;
    case "removeNode":
      if (!s.nodes.some((n) => n.id === c.id)) return fail("id", `no node with id ${JSON.stringify(c.id)}`);
      next = {
        ...s,
        nodes: s.nodes.filter((n) => n.id !== c.id),
        edges: s.edges.filter((e) => e.from !== c.id && e.to !== c.id),
      };
      break;
    case "removeEdge":
      if (!s.edges.some((e) => e.id === c.id)) return fail("id", `no edge with id ${JSON.stringify(c.id)}`);
      next = { ...s, edges: s.edges.filter((e) => e.id !== c.id) };
      break;
    case "removeZone":
      if (!s.zones.some((z) => z.id === c.id)) return fail("id", `no zone with id ${JSON.stringify(c.id)}`);
      next = { ...s, zones: s.zones.filter((z) => z.id !== c.id) };
      break;
    case "updateNode": {
      const nodes = replaceById(s.nodes, c.id, (n) => applyChanges(n, c.changes));
      if (nodes === null) return fail("id", `no node with id ${JSON.stringify(c.id)}`);
      next = { ...s, nodes };
      break;
    }
    case "updateEdge": {
      const edges = replaceById(s.edges, c.id, (e) => applyChanges(e, c.changes));
      if (edges === null) return fail("id", `no edge with id ${JSON.stringify(c.id)}`);
      next = { ...s, edges };
      break;
    }
    case "updateZone": {
      const zones = replaceById(s.zones, c.id, (z) => applyChanges(z, c.changes));
      if (zones === null) return fail("id", `no zone with id ${JSON.stringify(c.id)}`);
      next = { ...s, zones };
      break;
    }
  }
  return validateScenario(next);
}

/** Apply one Edit_Command to a Scenario. Pure: never throws, never writes to its arguments. */
export function applyCommand(scenario: Scenario, command: EditCommand): ApplyResult {
  try {
    const valid = validateScenario(scenario);
    if (!valid.ok) return valid;
    const parsed = editCommandSchema.safeParse(command);
    if (!parsed.success) return { ok: false, errors: toValidationErrors(parsed.error.issues) };
    const cmd = parsed.data;
    if (cmd.kind !== "batch") return applySingle(valid.scenario, cmd);
    let current = valid.scenario;
    for (const [i, single] of cmd.commands.entries()) {
      const step = applySingle(current, single);
      if (!step.ok) {
        const prefix = `commands.${i}`;
        return {
          ok: false,
          errors: step.errors.map((e) => ({ path: e.path === "" ? prefix : `${prefix}.${e.path}`, message: e.message })),
        };
      }
      current = step.scenario;
    }
    return { ok: true, scenario: current };
  } catch {
    return fail("", UNEXPECTED_MESSAGE);
  }
}
