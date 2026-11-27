/**
 * Test support only: generators for the Moodwalk model tests.
 * Imported only by `*.test.ts` files. Every generator builds plain objects.
 */
import fc from "fast-check";
import type { EditCommand } from "../../../core/model/commands.ts";
import { createHistory, executeCommand, redo, undo, type History } from "../../../core/model/history.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import type { BoardSettings } from "./board-settings.ts";
import { loadBoardData } from "./board-data.ts";
import { BUNDLED } from "./bundled.ts";
import { addImageCommand, addZoneCommand, removeImageCommand, removeZoneCheck } from "./commands.ts";
import { routeFootprints } from "./layout.ts";
import { ANALYSIS_SIZE, type PixelData } from "./pixels.ts";

const MAX_SIDE = ANALYSIS_SIZE;

/** Channel values: any value, with the extremes drawn often. */
const channelArb: fc.Arbitrary<number> = fc.oneof(
  fc.integer({ min: 0, max: 255 }),
  fc.constantFrom(0, 1, 254, 255),
);

export type PixelVariant = "visible" | "transparent" | "empty";

export type PixelDataOptions = {
  /** Smallest side. Default 1. Ignored by `transparent` (sides 0..64) and `empty`. */
  readonly minSide?: number;
  /** Default `visible`. */
  readonly variant?: PixelVariant;
};

const toPlain = (width: number, height: number, data: number[]): PixelData => ({ width, height, data });

function visibleArb(minSide: number): fc.Arbitrary<PixelData> {
  const lo = Math.min(MAX_SIDE, Math.max(1, minSide));
  return fc
    .tuple(fc.integer({ min: lo, max: MAX_SIDE }), fc.integer({ min: lo, max: MAX_SIDE }))
    .chain(([w, h]) =>
      fc
        .tuple(
          fc.array(channelArb, { minLength: 4 * w * h, maxLength: 4 * w * h }),
          fc.integer({ min: 0, max: w * h - 1 }),
          fc.integer({ min: 1, max: 255 }),
        )
        .map(([data, index, alpha]) => {
          data[4 * index + 3] = alpha;
          return toPlain(w, h, data);
        }),
    );
}

function transparentArb(): fc.Arbitrary<PixelData> {
  return fc
    .tuple(fc.integer({ min: 0, max: MAX_SIDE }), fc.integer({ min: 0, max: MAX_SIDE }))
    .chain(([w, h]) =>
      fc.array(channelArb, { minLength: 4 * w * h, maxLength: 4 * w * h }).map((data) => {
        for (let i = 3; i < data.length; i += 4) data[i] = 0;
        return toPlain(w, h, data);
      }),
    );
}

function emptyArb(): fc.Arbitrary<PixelData> {
  return fc
    .tuple(fc.integer({ min: 0, max: MAX_SIDE }), fc.boolean())
    .map(([other, widthIsZero]) => (widthIsZero ? toPlain(0, other, []) : toPlain(other, 0, [])));
}

/**
 * Pixel_Data with sides up to min(64, Analysis_Size) and a plain `number[]` of `4·w·h` integers 0..255.
 * Variants: `visible` (at least one alpha > 0), `transparent` (every alpha 0), `empty` (one side 0).
 */
export function pixelDataArb(opts: PixelDataOptions = {}): fc.Arbitrary<PixelData> {
  switch (opts.variant ?? "visible") {
    case "transparent":
      return transparentArb();
    case "empty":
      return emptyArb();
    default:
      return visibleArb(opts.minSide ?? 1);
  }
}

/**
 * Raised copies of `pixels`: for each pixel, non-negative increments of r, g, b,
 * clamped to 255. Alpha is unchanged.
 */
export function raiseArb(pixels: PixelData): fc.Arbitrary<PixelData> {
  const count = pixels.width * pixels.height;
  return fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 3 * count, maxLength: 3 * count }).map((inc) => {
    const data: number[] = [];
    for (let p = 0; p < count; p++) {
      for (let c = 0; c < 3; c++) data.push(Math.min(255, pixels.data[4 * p + c] + inc[3 * p + c]));
      data.push(pixels.data[4 * p + 3]);
    }
    return toPlain(pixels.width, pixels.height, data);
  });
}

// --- Task 4.2: settings schema generators ---

const SETTING_KEYS = ["shiftThreshold", "runTolerance", "minRunLength"] as const;

const validSettingsArb: fc.Arbitrary<Record<string, unknown>> = fc.record({
  shiftThreshold: fc.double({ min: 0, max: 10, noNaN: true }),
  runTolerance: fc.double({ min: 0, max: 10, noNaN: true }),
  minRunLength: fc.integer({ min: 2, max: 50 }),
});

const badFieldValueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0, 1, 2.5, null, "3", "abc", ""),
  fc.string(),
);

/**
 * Any value for the settings loader: `fc.anything()`, valid settings, and near-valid settings
 * (a field replaced by a bad value or removed, or an extra key added). Plain objects only.
 */
export const anyValueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.anything(),
  validSettingsArb,
  fc
    .tuple(validSettingsArb, fc.constantFrom(...SETTING_KEYS), badFieldValueArb)
    .map(([s, key, bad]) => ({ ...s, [key]: bad })),
  fc.tuple(validSettingsArb, fc.constantFrom(...SETTING_KEYS)).map(([s, key]) => {
    const copy = { ...s };
    delete copy[key];
    return copy;
  }),
  fc
    .tuple(validSettingsArb, fc.string({ minLength: 1 }), fc.anything())
    .filter(([, extra]) => !(SETTING_KEYS as readonly string[]).includes(extra) && extra !== "__proto__")
    .map(([s, extra, v]) => ({ ...s, [extra]: v })),
);

// --- Task 5.2: board generators ---

/** `+ 0` turns -0 into 0, so a JSON round trip keeps the value `toStrictEqual`. */
const plain = (v: number): number => v + 0;

const finiteArb = (min: number, max: number): fc.Arbitrary<number> =>
  fc.double({ min, max, noNaN: true }).map(plain);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Zone shape of a Scenario (plain object). */
export type GenZone = {
  id: string;
  label: { en: string };
  order: number;
  elevation: number;
  enclosed: boolean;
};

/** 2 to 12 Zones, ids `z0…`, distinct `order`, elevation 0, not enclosed; the list is shuffled. */
export const zonesArb: fc.Arbitrary<GenZone[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: 10_000 }), { minLength: 2, maxLength: 12 })
  .chain((orders) => {
    const zones: GenZone[] = orders.map((order, i) => ({
      id: `z${i}`,
      label: { en: `Zone ${i}` },
      order,
      elevation: 0,
      enclosed: false,
    }));
    return fc.shuffledSubarray(zones, { minLength: zones.length, maxLength: zones.length });
  });

const BASE_BRIGHTNESS = [0.2, 0.22, 0.5, 0.8] as const;
const BASE_TEMPERATURE = [-0.1, -0.08, 0.2] as const;

type NodeDraw = {
  zoneIndex: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  noise: [number, number];
  free: [number, number];
};

const nodeDrawArb = (zoneCount: number): fc.Arbitrary<NodeDraw> =>
  fc.record({
    zoneIndex: fc.integer({ min: 0, max: zoneCount - 1 }),
    position: fc.tuple(finiteArb(-50, 50), finiteArb(-50, 50), finiteArb(-50, 50)),
    rotation: fc.tuple(finiteArb(-Math.PI, Math.PI), finiteArb(-Math.PI, Math.PI), finiteArb(-Math.PI, Math.PI)),
    scale: fc.tuple(finiteArb(0.1, 3), finiteArb(0.1, 3), finiteArb(0.1, 3)),
    noise: fc.tuple(finiteArb(-0.02, 0.02), finiteArb(-0.02, 0.02)),
    free: fc.tuple(finiteArb(0, 1), finiteArb(-1, 1)),
  });

/**
 * A Scenario (plain object) of 2 to 12 Zones and 0 to 50 Image_Nodes placed in a random subset of
 * the Zones, so some Zones hold no Image_Node. Most boards draw each Zone a base value pair plus
 * noise (shifts and long runs are common); a share uses free values in the full ranges.
 */
export const boardArb: fc.Arbitrary<Scenario> = zonesArb.chain((zones) =>
  fc
    .tuple(
      fc.shuffledSubarray(
        zones.map((_, i) => i),
        { minLength: 1, maxLength: zones.length },
      ),
      fc.array(fc.tuple(fc.constantFrom(...BASE_BRIGHTNESS), fc.constantFrom(...BASE_TEMPERATURE)), {
        minLength: zones.length,
        maxLength: zones.length,
      }),
      fc.boolean(),
      fc.boolean(),
    )
    .chain(([subset, bases, useFree, hasNodes]) =>
      fc
        .array(nodeDrawArb(subset.length), { minLength: 0, maxLength: hasNodes ? 50 : 0 })
        .map((draws): Scenario => {
          const nodes = draws.map((d, i) => {
            const zoneIndex = subset[d.zoneIndex];
            const base = bases[zoneIndex];
            const brightness = useFree ? d.free[0] : plain(clamp(base[0] + d.noise[0], 0, 1));
            const temperature = useFree ? d.free[1] : plain(clamp(base[1] + d.noise[1], -1, 1));
            return {
              id: `image-${i + 1}`,
              type: "image",
              position: { x: d.position[0], y: d.position[1], z: d.position[2] },
              rotation: { x: d.rotation[0], y: d.rotation[1], z: d.rotation[2] },
              scale: { x: d.scale[0], y: d.scale[1], z: d.scale[2] },
              front: { image: "sample:lanterns", text: { en: `Image ${i + 1}` } },
              zone: zones[zoneIndex].id,
              metadata: {},
              attributes: { brightness, temperature },
            };
          });
          return {
            schemaVersion: 1,
            id: "generated-board",
            title: { en: "Generated board" },
            nodes,
            edges: [],
            zones: zones.map((z) => ({ ...z, label: { ...z.label } })),
          };
        }),
    ),
);

/** Board_Settings (plain object) with thresholds from small fixed values or the full 0..1 range. */
export const settingsArb: fc.Arbitrary<BoardSettings> = fc.record({
  shiftThreshold: fc.oneof(finiteArb(0, 1), fc.constantFrom(0, 0.02, 0.05, 0.15, 0.3)),
  runTolerance: fc.oneof(finiteArb(0, 1), fc.constantFrom(0, 0.02, 0.05, 0.15, 0.3)),
  minRunLength: fc.integer({ min: 2, max: 6 }),
});

/** A subarray of the Zone ids plus 0 to 2 unknown ids. */
export const marksArb = (zones: readonly { readonly id: string }[]): fc.Arbitrary<string[]> =>
  fc
    .tuple(
      fc.shuffledSubarray(zones.map((z) => z.id)),
      fc.subarray(["unknown-1", "unknown-2"], { minLength: 0, maxLength: 2 }),
    )
    .map(([known, unknown]) => [...known, ...unknown]);

// --- Task 6.2: board operation generator ---

type OpKind = "addImage" | "addZone" | "removeZone" | "removeImage" | "move" | "undo" | "redo";

type OpDraw = {
  kind: OpKind;
  pick: number;
  zonePick: number;
  mood: [number, number];
  x: number;
  z: number;
};

const opDrawArb: fc.Arbitrary<OpDraw> = fc.record({
  kind: fc.constantFrom<OpKind>("addImage", "addZone", "removeZone", "removeImage", "move", "undo", "redo"),
  pick: fc.nat({ max: 1000 }),
  zonePick: fc.nat({ max: 1000 }),
  mood: fc.tuple(finiteArb(0, 1), finiteArb(-1, 1)),
  x: finiteArb(-6, 6),
  z: finiteArb(-2, 40),
});

/** Plain deep copy of a Scenario (JSON round trip; every number in a board is finite). */
const copyScenario = (s: Scenario): Scenario => JSON.parse(JSON.stringify(s)) as Scenario;

function demoBoard(): Scenario {
  const loaded = loadBoardData(BUNDLED);
  if (!loaded.ok) throw new Error("the bundled Demo_Board does not load");
  return copyScenario(loaded.data.scenario);
}

function runOps(start: Scenario, draws: readonly OpDraw[]): Scenario {
  const created = createHistory(start, 100);
  if (!created.ok) throw new Error("the start board is not valid");
  let history: History = created.history;
  let uploads = 0;
  const run = (command: EditCommand | null): void => {
    if (command === null) return;
    const r = executeCommand(history, command);
    if (r.ok) history = r.history;
  };
  for (const d of draws) {
    const s = history.present;
    const footprints = routeFootprints(s.zones);
    const images = s.nodes.filter((n) => n.type === "image");
    switch (d.kind) {
      case "addImage": {
        if (images.length >= 50) break;
        const zone = s.zones[d.zonePick % s.zones.length];
        uploads += 1;
        run(
          addImageCommand(
            s,
            { reference: `upload:${uploads}`, zone: zone.id, mood: { brightness: d.mood[0], temperature: d.mood[1] } },
            footprints,
          ),
        );
        break;
      }
      case "addZone":
        run(addZoneCommand(s));
        break;
      case "removeZone": {
        const check = removeZoneCheck(s, s.zones[d.zonePick % s.zones.length].id);
        if (check.ok) run(check.command);
        break;
      }
      case "removeImage":
        if (images.length > 0) run(removeImageCommand(s, images[d.pick % images.length].id));
        break;
      case "move": {
        if (images.length === 0) break;
        const node = images[d.pick % images.length];
        run({ kind: "updateNode", id: node.id, changes: { position: { x: d.x, y: node.position.y, z: d.z } } });
        break;
      }
      case "undo":
        history = undo(history);
        break;
      case "redo":
        history = redo(history);
        break;
    }
  }
  return copyScenario(history.present);
}

/**
 * Boards the App can produce: 0 to 30 steps of addImage, addZone, removeZone (through
 * `removeZoneCheck`), removeImage, move, undo, and redo, from the Demo_Board or a `boardArb` start.
 * Outputs are plain objects (JSON round trip).
 */
export const boardOpsArb: fc.Arbitrary<Scenario> = fc
  .tuple(fc.oneof(fc.constant(null), boardArb), fc.array(opDrawArb, { minLength: 0, maxLength: 30 }))
  .map(([start, draws]) => runOps(start ?? demoBoard(), draws));
