import { z } from "zod";
import { compareCodePoints, isPlainObject } from "../../model/json.ts";
import { toValidationErrors, type ValidationError } from "../../model/scenario-schema.ts";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb color");

export const nodeStyleSchema = z.object({ fill: color, border: color });
export const edgeStyleSchema = z.object({ color, width: z.number().positive(), dashed: z.boolean() });
export const effectStyleSchema = z.object({ style: z.literal("fog"), color, opacity: z.number().min(0).max(1) });

function ownValue(obj: Record<string, unknown>, key: string): unknown {
  return Object.getOwnPropertyDescriptor(obj, key)?.value;
}

/**
 * A map keyed by any Identifier. `z.custom` + `superRefine` + `transform` (not `z.record`),
 * so a `__proto__` key stays an own key. No list of allowed keys.
 */
function styleMap<T>(schema: z.ZodType<T>): z.ZodType<Record<string, T>> {
  return z
    .custom<Record<string, unknown>>()
    .superRefine((value, ctx) => {
      if (!isPlainObject(value)) {
        ctx.addIssue({ code: "custom", message: "must be a JSON object" });
        return;
      }
      for (const key of Object.keys(value).sort(compareCodePoints)) {
        if (key.trim().length < 1) {
          ctx.addIssue({ code: "custom", message: `key ${JSON.stringify(key)} must not be blank` });
        }
        const result = schema.safeParse(ownValue(value, key));
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({ code: "custom", message: issue.message, path: [key, ...issue.path] });
          }
        }
      }
    })
    .transform((value) => {
      const entries: [string, T][] = [];
      for (const key of Object.keys(value).sort(compareCodePoints)) {
        const result = schema.safeParse(ownValue(value, key));
        if (result.success) entries.push([key, result.data]);
      }
      return Object.fromEntries(entries);
    });
}

export const themeSchema = z.object({
  background: color,
  floor: color,
  wall: color,
  text: color,
  defaultNode: nodeStyleSchema,
  defaultEdge: edgeStyleSchema,
  nodes: styleMap(nodeStyleSchema),
  edges: styleMap(edgeStyleSchema),
  effects: styleMap(effectStyleSchema),
});

export type NodeStyle = z.infer<typeof nodeStyleSchema>;
export type EdgeStyle = z.infer<typeof edgeStyleSchema>;
export type EffectStyle = z.infer<typeof effectStyleSchema>;
export type Theme = z.infer<typeof themeSchema>;

export type ThemeResult = { ok: true; theme: Theme } | { ok: false; errors: ValidationError[] };

/** Validates any value as a Theme. Never throws, never writes to `value`. */
export function loadTheme(value: unknown): ThemeResult {
  try {
    const result = themeSchema.safeParse(value);
    if (result.success) return { ok: true, theme: result.data };
    return { ok: false, errors: toValidationErrors(result.error.issues) };
  } catch {
    return { ok: false, errors: [{ path: "", message: "the theme could not be validated" }] };
  }
}

export function nodeStyleFor(theme: Theme, nodeType: string): NodeStyle {
  return Object.hasOwn(theme.nodes, nodeType) ? (theme.nodes[nodeType] ?? theme.defaultNode) : theme.defaultNode;
}

export function edgeStyleFor(theme: Theme, edgeType: string): EdgeStyle {
  return Object.hasOwn(theme.edges, edgeType) ? (theme.edges[edgeType] ?? theme.defaultEdge) : theme.defaultEdge;
}

export function effectStyleFor(theme: Theme, effect: string): EffectStyle | null {
  return Object.hasOwn(theme.effects, effect) ? (theme.effects[effect] ?? null) : null;
}
