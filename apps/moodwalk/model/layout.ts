/** Route_Layout of Moodwalk (design.md "Route_Layout"): depth along z is the order of the visit. */
import type { Scenario, Zone } from "../../../core/model/scenario-schema.ts";
import type { ViewSettings, ZoneFootprint } from "../../../core/view/helpers/settings-schema.ts";
import { EYE_HEIGHT, PATH_ROUTE, PRESET_OVERVIEW, PRESET_VISITOR } from "./names.ts";

export const LAYOUT = {
  width: 8,
  depth: 4,
  pitch: 5,
  panelY: 1.3,
  layerStep: 1.4,
  slotX: [-1.5, 1.5, -3, 3],
  slotDz: [1.5, 1.5, -0.5, -0.5],
  snapStep: 0.5,
} as const;

export type PresetId = "overview" | "visitor";
export type Vec3 = { x: number; y: number; z: number };

/** Half of the 50 degree vertical field of view of view-root.tsx, in degrees. */
const HALF_FOV_DEGREES = 25;

function byOrder(zones: readonly Zone[]): Zone[] {
  return [...zones].sort((a, b) => a.order - b.order);
}

/** One rect footprint per Zone in ascending `order`; the list order of `zones` does not matter. */
export function routeFootprints(zones: readonly Zone[]): ZoneFootprint[] {
  return byOrder(zones).map((zone, rank) => ({
    kind: "rect" as const,
    id: zone.id,
    x: 0,
    z: LAYOUT.pitch * rank,
    width: LAYOUT.width,
    depth: LAYOUT.depth,
  }));
}

export function buildViewSettings(zones: readonly Zone[], active: PresetId): ViewSettings {
  const sorted = byOrder(zones);
  const n = sorted.length;
  const zLast = LAYOUT.pitch * Math.max(n - 1, 0);
  const zMid = zLast / 2;
  const span = zLast + LAYOUT.depth;
  const distance = Math.max(
    12,
    (1.2 * (span / 2)) / Math.tan((HALF_FOV_DEGREES * Math.PI) / 180),
  );
  const e0 = sorted[0]?.elevation ?? 0;
  const e1 = sorted[1]?.elevation ?? 0;
  const z1 = LAYOUT.pitch;

  const overview = {
    id: PRESET_OVERVIEW,
    label: { en: "Overview", ja: "全体" },
    pose: {
      position: { x: 0, y: 0.8 * distance, z: zMid - 0.6 * distance },
      target: { x: 0, y: 0, z: zMid },
    },
    filter: { edgeRule: "bothEnds" as const },
  };
  const visitor = {
    id: PRESET_VISITOR,
    label: { en: "Visitor view", ja: "来場者の目線" },
    pose: {
      position: { x: 0, y: e0 + EYE_HEIGHT, z: -7 },
      target: { x: 0, y: e1 + EYE_HEIGHT, z: z1 },
    },
    filter: { edgeRule: "bothEnds" as const },
  };

  return {
    zoneFootprints: routeFootprints(zones),
    presets: active === PRESET_OVERVIEW ? [overview, visitor] : [visitor, overview],
    paths: [{ id: PATH_ROUTE, fromZones: { height: EYE_HEIGHT } }],
    detailDistance: 2,
    snapStep: LAYOUT.snapStep,
    wallHeight: 1.2,
    editMode: "edit",
    stepDuration: 2,
  };
}

/** Id of the footprint that holds the point, or null (the gap between footprints is outside). */
export function footprintAt(
  footprints: readonly ZoneFootprint[],
  x: number,
  z: number,
): string | null {
  for (const f of footprints) {
    if (f.kind === "rect") {
      if (Math.abs(x - f.x) <= f.width / 2 && Math.abs(z - f.z) <= f.depth / 2) return f.id;
    } else {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d >= f.innerRadius && d <= f.outerRadius) return f.id;
    }
  }
  return null;
}

/** Slot `index` of a Zone: four columns beside the walking line, a new layer every four slots. */
export function slotPosition(
  center: { x: number; z: number },
  elevation: number,
  index: number,
): Vec3 {
  const column = index % 4;
  const layer = Math.floor(index / 4);
  return {
    x: center.x + LAYOUT.slotX[column],
    y: elevation + LAYOUT.panelY + LAYOUT.layerStep * layer,
    z: center.z + LAYOUT.slotDz[column],
  };
}

/** First slot of the Zone that no Image_Node of that Zone uses; null for an unknown Zone. */
export function freeSlot(
  scenario: Scenario,
  zoneId: string,
  footprints: readonly ZoneFootprint[],
): Vec3 | null {
  const zone = scenario.zones.find((z) => z.id === zoneId);
  const footprint = footprints.find((f) => f.id === zoneId);
  if (zone === undefined || footprint === undefined) return null;
  const used = scenario.nodes.filter((n) => n.zone === zoneId).map((n) => n.position);
  for (let index = 0; ; index += 1) {
    const slot = slotPosition(footprint, zone.elevation, index);
    if (!used.some((p) => p.x === slot.x && p.y === slot.y && p.z === slot.z)) return slot;
  }
}

/** Walkthrough length in seconds: 4 per step between Zones, at least 4. */
export function walkDuration(zoneCount: number): number {
  return Math.max(4, 4 * (zoneCount - 1));
}
