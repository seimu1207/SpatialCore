import { z } from "zod";
import { checkJsonValue, compareCodePoints, isPlainObject, type JsonObject } from "./json.ts";

const MAX_INT = Number.MAX_SAFE_INTEGER;

export type ValidationError = { path: string; message: string };

/** Map Zod issues to `{ path, message }`, keeping Zod's order. List indexes become "0", "1", ... */
export function toValidationErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): ValidationError[] {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

// `refine`, not `.trim()`: the value is checked, never changed.
export const nonBlank = z.string().refine((s) => s.trim().length >= 1, "must not be blank");
const identifier = nonBlank;

export const localizedTextSchema = z.object({ en: nonBlank, ja: z.string().optional() });

const vector3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const positive = z.number().positive();
const scale3 = z.object({ x: positive, y: positive, z: positive });

const imageReference = nonBlank;

export const faceSchema = z
  .object({
    text: localizedTextSchema.optional(),
    image: imageReference.optional(),
    detail: localizedTextSchema.optional(),
  })
  .superRefine(
    (value, ctx) => {
      if (value.text === undefined && value.image === undefined) {
        ctx.addIssue({ code: "custom", message: "face must have text or image" });
      }
    },
    { when: (p) => isPlainObject(p.value) },
  );

export type NumericAttributes = Record<string, number>;

const metadataSchema = z.custom<JsonObject>().superRefine((value, ctx) => {
  if (!isPlainObject(value)) {
    ctx.addIssue({ code: "custom", message: "metadata must be a JSON object" });
    return;
  }
  if (checkJsonValue(value) !== null) {
    ctx.addIssue({ code: "custom", message: "metadata must contain only JSON values" });
  }
});

const attributesSchema = z.custom<NumericAttributes>().superRefine((value, ctx) => {
  if (!isPlainObject(value)) {
    ctx.addIssue({ code: "custom", message: "attributes must be a JSON object" });
    return;
  }
  for (const name of Object.keys(value).sort(compareCodePoints)) {
    if (name.trim().length < 1) {
      ctx.addIssue({ code: "custom", message: `attribute name ${JSON.stringify(name)} must not be blank` });
    }
    const v = value[name];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      ctx.addIssue({ code: "custom", message: "attribute value must be a finite number", path: [name] });
    }
  }
});

export const nodeSchema = z.object({
  id: identifier,
  type: identifier,
  position: vector3,
  rotation: vector3,
  scale: scale3,
  front: faceSchema,
  back: faceSchema.optional(),
  zone: identifier.optional(),
  metadata: metadataSchema,
  attributes: attributesSchema,
});

export const edgeSchema = z.object({
  id: identifier,
  from: identifier,
  to: identifier,
  type: identifier,
  label: localizedTextSchema.optional(),
});

export const zoneSchema = z.object({
  id: identifier,
  label: localizedTextSchema,
  order: z.number().int().min(0).max(MAX_INT),
  elevation: z.number(),
  enclosed: z.boolean(),
});

type Listed = { id: string };

function duplicateIds(list: readonly Listed[], name: string, ctx: z.RefinementCtx): void {
  const first = new Map<string, number>();
  list.forEach((item, index) => {
    const seen = first.get(item.id);
    if (seen === undefined) {
      first.set(item.id, index);
    } else {
      ctx.addIssue({
        code: "custom",
        message: `duplicate id ${JSON.stringify(item.id)}, first used at ${name}.${seen}`,
        path: [name, index, "id"],
      });
    }
  });
}

type CrossInput = {
  nodes: readonly (Listed & { zone?: string | undefined })[];
  edges: readonly (Listed & { from: string; to: string })[];
  zones: readonly (Listed & { order: number })[];
};

function checkCrossElements(s: CrossInput, ctx: z.RefinementCtx): void {
  duplicateIds(s.nodes, "nodes", ctx);
  duplicateIds(s.edges, "edges", ctx);
  duplicateIds(s.zones, "zones", ctx);
  const nodeIds = new Set(s.nodes.map((n) => n.id));
  s.edges.forEach((edge, i) => {
    if (!nodeIds.has(edge.from)) {
      ctx.addIssue({
        code: "custom",
        message: `no node with id ${JSON.stringify(edge.from)}`,
        path: ["edges", i, "from"],
      });
    }
    if (!nodeIds.has(edge.to)) {
      ctx.addIssue({
        code: "custom",
        message: `no node with id ${JSON.stringify(edge.to)}`,
        path: ["edges", i, "to"],
      });
    }
  });
  const zoneIds = new Set(s.zones.map((z) => z.id));
  s.nodes.forEach((node, i) => {
    if (node.zone !== undefined && !zoneIds.has(node.zone)) {
      ctx.addIssue({
        code: "custom",
        message: `no zone with id ${JSON.stringify(node.zone)}`,
        path: ["nodes", i, "zone"],
      });
    }
  });
  const firstOrder = new Map<number, number>();
  s.zones.forEach((zone, i) => {
    const seen = firstOrder.get(zone.order);
    if (seen === undefined) {
      firstOrder.set(zone.order, i);
    } else {
      ctx.addIssue({
        code: "custom",
        message: `duplicate order ${zone.order}, first used at zones.${seen}`,
        path: ["zones", i, "order"],
      });
    }
  });
}

export const scenarioSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
    id: identifier,
    title: localizedTextSchema,
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    zones: z.array(zoneSchema),
  })
  .superRefine(checkCrossElements, { when: (p) => p.issues.length === 0 });

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type Face = z.infer<typeof faceSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

export const nodeChangesSchema = z.object({
  type: identifier.optional(),
  position: vector3.optional(),
  rotation: vector3.optional(),
  scale: scale3.optional(),
  front: faceSchema.optional(),
  back: faceSchema.nullable().optional(),
  metadata: metadataSchema.optional(),
  attributes: attributesSchema.optional(),
  zone: identifier.nullable().optional(),
});
export const edgeChangesSchema = z.object({
  type: identifier.optional(),
  label: localizedTextSchema.nullable().optional(),
});
export const zoneChangesSchema = z.object({
  label: localizedTextSchema.optional(),
  order: zoneSchema.shape.order.optional(),
  elevation: z.number().optional(),
  enclosed: z.boolean().optional(),
});
export type NodeChanges = z.infer<typeof nodeChangesSchema>;
export type EdgeChanges = z.infer<typeof edgeChangesSchema>;
export type ZoneChanges = z.infer<typeof zoneChangesSchema>;

export type ValidateResult = { ok: true; scenario: Scenario } | { ok: false; errors: ValidationError[] };

/** The one validation entry point for the loader, saver, command applier, and history. */
export function validateScenario(value: unknown): ValidateResult {
  const result = scenarioSchema.safeParse(value);
  if (result.success) return { ok: true, scenario: result.data };
  return { ok: false, errors: toValidationErrors(result.error.issues) };
}
