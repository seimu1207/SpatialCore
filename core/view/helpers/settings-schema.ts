import { z } from "zod";
import { isPlainObject } from "../../model/json.ts";
import {
  localizedTextSchema,
  nonBlank,
  toValidationErrors,
  type ValidationError,
} from "../../model/scenario-schema.ts";

const identifier = nonBlank;
const finite = z.number();
const positive = z.number().positive();
const point = z.object({ x: finite, y: finite, z: finite });

export const cameraPoseSchema = z.object({ position: point, target: point }).superRefine(
  (pose, ctx) => {
    const { position: a, target: b } = pose;
    if (a.x === b.x && a.y === b.y && a.z === b.z) {
      ctx.addIssue({ code: "custom", message: "position and target must differ", path: ["target"] });
    }
  },
  { when: (p) => p.issues.length === 0 },
);

export const zoneFootprintSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rect"),
    id: identifier,
    x: finite,
    z: finite,
    width: positive,
    depth: positive,
  }),
  z
    .object({
      kind: z.literal("ring"),
      id: identifier,
      x: finite,
      z: finite,
      innerRadius: finite,
      outerRadius: positive,
    })
    .superRefine(
      (ring, ctx) => {
        if (ring.innerRadius < 0 || ring.innerRadius >= ring.outerRadius) {
          ctx.addIssue({
            code: "custom",
            message: "innerRadius must be at least 0 and less than outerRadius",
            path: ["innerRadius"],
          });
        }
      },
      { when: (p) => p.issues.length === 0 },
    ),
]);

export const visibilityFilterSchema = z.object({
  zones: z.array(identifier).optional(),
  nodeTypes: z.array(identifier).optional(),
  edgeTypes: z.array(identifier).optional(),
  includeUnzoned: z.boolean().optional(),
  edgeRule: z.enum(["bothEnds", "anyEnd"]),
});

export const viewPresetSchema = z.object({
  id: identifier,
  label: localizedTextSchema,
  pose: cameraPoseSchema,
  filter: visibilityFilterSchema,
});

export const cameraPathSchema = z
  .object({
    id: identifier,
    waypoints: z.array(cameraPoseSchema).min(2).optional(),
    fromZones: z.object({ height: finite }).optional(),
  })
  .superRefine(
    (_path, ctx) => {
      // Read the raw input: a path whose waypoints failed their own checks still counts as "has waypoints".
      const raw: unknown = ctx.value;
      if (!isPlainObject(raw)) return;
      const hasWaypoints = raw["waypoints"] !== undefined;
      const hasZones = raw["fromZones"] !== undefined;
      if (hasWaypoints === hasZones) {
        ctx.addIssue({
          code: "custom",
          message: "a camera path needs exactly one of waypoints and fromZones",
        });
      }
    },
    { when: (p) => isPlainObject(p.value) },
  );

type Listed = { id: string };

function reportDuplicates(list: readonly Listed[], name: string, ctx: z.RefinementCtx): void {
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

export const viewSettingsSchema = z
  .object({
    zoneFootprints: z.array(zoneFootprintSchema),
    presets: z.array(viewPresetSchema).min(1),
    paths: z.array(cameraPathSchema),
    detailDistance: positive,
    snapStep: positive,
    wallHeight: positive,
    editMode: z.enum(["view", "edit"]),
    stepDuration: positive,
  })
  .superRefine(
    (settings, ctx) => {
      reportDuplicates(settings.presets, "presets", ctx);
      reportDuplicates(settings.paths, "paths", ctx);
      reportDuplicates(settings.zoneFootprints, "zoneFootprints", ctx);
    },
    { when: (p) => p.issues.length === 0 },
  );

export type CameraPose = z.infer<typeof cameraPoseSchema>;
export type ZoneFootprint = z.infer<typeof zoneFootprintSchema>;
export type VisibilityFilter = z.infer<typeof visibilityFilterSchema>;
export type ViewPreset = z.infer<typeof viewPresetSchema>;
export type CameraPath = z.infer<typeof cameraPathSchema>;
export type ViewSettings = z.infer<typeof viewSettingsSchema>;

export type LoadViewSettingsResult =
  | { ok: true; settings: ViewSettings }
  | { ok: false; errors: ValidationError[] };

/** Checks a View_Settings value. Never throws and never changes its input. */
export function loadViewSettings(value: unknown): LoadViewSettingsResult {
  try {
    const result = viewSettingsSchema.safeParse(value);
    if (result.success) return { ok: true, settings: result.data };
    return { ok: false, errors: toValidationErrors(result.error.issues) };
  } catch {
    return { ok: false, errors: [{ path: "", message: "the view settings could not be validated" }] };
  }
}
