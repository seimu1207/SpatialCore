/** Edit_Command builders of Moodwalk (design.md "Edit_Commands"). Pure: no throw, no write to arguments. */
import type { EditCommand } from "../../../core/model/commands.ts";
import type { Node, Scenario, Zone } from "../../../core/model/scenario-schema.ts";
import type { ZoneFootprint } from "../../../core/view/helpers/settings-schema.ts";
import type { Fallback } from "./fallback.ts";
import { FALLBACK } from "./fallback.ts";
import { footprintAt, freeSlot } from "./layout.ts";
import type { MoodValues } from "./mood.ts";
import { ATTR_BRIGHTNESS, ATTR_TEMPERATURE, NODE_TYPE_IMAGE } from "./names.ts";

export const MAX_IMAGE_BYTES = 10_485_760;
export const MAX_IMAGES = 50;
const ACCEPTED_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

export type FileFacts = { name: string; type: string; size: number };
export type FileCheck = { ok: true } | { ok: false; reason: "format" | "size" | "limit" };

/** R-APP2-04.3 to 04.5: format, then size, then image count. */
export function checkImageFile(file: FileFacts, imageCount: number): FileCheck {
  if (!ACCEPTED_TYPES.includes(file.type)) return { ok: false, reason: "format" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "size" };
  if (imageCount >= MAX_IMAGES) return { ok: false, reason: "limit" };
  return { ok: true };
}

/** Smallest integer k >= 1 such that `<prefix><k>` is not in `used`. */
function smallestUnused(prefix: string, used: ReadonlySet<string>): number {
  let k = 1;
  while (used.has(`${prefix}${k}`)) k += 1;
  return k;
}

function usedIds(s: Scenario): Set<string> {
  return new Set<string>([...s.nodes.map((n) => n.id), ...s.zones.map((z) => z.id)]);
}

export function newImageId(s: Scenario): string {
  return `image-${smallestUnused("image-", usedIds(s))}`;
}

export function newZone(s: Scenario): Zone {
  const k = smallestUnused("zone-", usedIds(s));
  const order = s.zones.reduce((max, z) => Math.max(max, z.order), -1) + 1;
  return {
    id: `zone-${k}`,
    label: { en: `New zone ${k}`, ja: `新しいゾーン ${k}` },
    order,
    elevation: 0,
    enclosed: false,
  };
}

export function addImageCommand(
  s: Scenario,
  input: { reference: string; zone: string; mood: MoodValues },
  footprints: readonly ZoneFootprint[],
  flags: Fallback = FALLBACK,
): EditCommand | null {
  const position = freeSlot(s, input.zone, footprints);
  if (position === null) return null;
  const attributes: Record<string, number> = { [ATTR_BRIGHTNESS]: input.mood.brightness };
  if (!flags.brightnessOnly) attributes[ATTR_TEMPERATURE] = input.mood.temperature;
  const node: Node = {
    id: newImageId(s),
    type: NODE_TYPE_IMAGE,
    position,
    rotation: { x: 0, y: Math.PI, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    front: { image: input.reference },
    zone: input.zone,
    metadata: {},
    attributes,
  };
  return { kind: "addNode", node };
}

export function addZoneCommand(s: Scenario): EditCommand {
  return { kind: "addZone", zone: newZone(s) };
}

export type RemoveZone =
  | { ok: true; command: EditCommand }
  | { ok: false; reason: "has-images" | "too-few-zones" | "unknown" };

export function removeZoneCheck(s: Scenario, zoneId: string): RemoveZone {
  if (!s.zones.some((z) => z.id === zoneId)) return { ok: false, reason: "unknown" };
  if (s.nodes.some((n) => n.zone === zoneId)) return { ok: false, reason: "has-images" };
  if (s.zones.length <= 2) return { ok: false, reason: "too-few-zones" };
  return { ok: true, command: { kind: "removeZone", id: zoneId } };
}

export function removeImageCommand(s: Scenario, nodeId: string): EditCommand | null {
  const node = s.nodes.find((n) => n.id === nodeId);
  if (node === undefined || node.type !== NODE_TYPE_IMAGE) return null;
  return { kind: "removeNode", id: nodeId };
}

export type MoveOutcome =
  | { kind: "none" }
  | { kind: "zone"; command: EditCommand }
  | { kind: "outside" };

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.hasOwn(rb, k) && deepEqual(ra[k], rb[k]));
}

/** R-APP2-05.3, 05.4: classify the end of a drag. Anything but a position change of one Node is `none`. */
export function classifyMove(
  before: Scenario,
  after: Scenario,
  footprints: readonly ZoneFootprint[],
): MoveOutcome {
  if (before.nodes.length !== after.nodes.length) return { kind: "none" };
  if (!deepEqual({ ...before, nodes: [] }, { ...after, nodes: [] })) return { kind: "none" };
  let moved: Node | null = null;
  for (const [i, b] of before.nodes.entries()) {
    const a = after.nodes[i];
    if (a === undefined) return { kind: "none" };
    if (deepEqual(a, b)) continue;
    if (moved !== null) return { kind: "none" };
    if (!deepEqual({ ...a, position: null }, { ...b, position: null })) return { kind: "none" };
    moved = a;
  }
  if (moved === null) return { kind: "none" };
  const zone = footprintAt(footprints, moved.position.x, moved.position.z);
  if (zone === null) return { kind: "outside" };
  if (zone === moved.zone) return { kind: "none" };
  return { kind: "zone", command: { kind: "updateNode", id: moved.id, changes: { zone } } };
}
