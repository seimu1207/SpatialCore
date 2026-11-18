import type { Edge, Node, Scenario, Zone } from "../../model/scenario-schema.ts";
import type { ViewSettings, ZoneFootprint } from "../helpers/settings-schema.ts";

/** The 50-image test Scenario of D17. Generated at runtime; the same call always gives the same value. */

export const PERF_IMAGE_COUNT = 10;
export const PERF_COLUMNS = 10;
export const PERF_ROWS = 5;
const COLUMN_SPACING = 6;
const ROW_SPACING = 8;
const NODE_HEIGHT = 1.5;

/** Image_References used by the Nodes. The Image_Resolver maps each to a bundled SVG file. */
export const PERF_IMAGE_REFS: readonly string[] = Array.from(
  { length: PERF_IMAGE_COUNT },
  (_, i) => `images/perf-${String(i + 1).padStart(2, "0")}.svg`,
);

const gridX = (column: number): number => (column - (PERF_COLUMNS - 1) / 2) * COLUMN_SPACING;
const gridZ = (row: number): number => row * ROW_SPACING;

export function buildPerfScenario(): Scenario {
  const zones: Zone[] = Array.from({ length: PERF_ROWS }, (_, row) => ({
    id: `zone-${row + 1}`,
    label: { en: `Zone ${row + 1}` },
    order: row,
    elevation: 0,
    enclosed: row === PERF_ROWS - 1,
  }));
  const nodes: Node[] = [];
  for (let row = 0; row < PERF_ROWS; row++) {
    for (let column = 0; column < PERF_COLUMNS; column++) {
      const index = row * PERF_COLUMNS + column;
      nodes.push({
        id: `image-${index + 1}`,
        type: "image",
        position: { x: gridX(column), y: NODE_HEIGHT, z: gridZ(row) },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        front: { image: PERF_IMAGE_REFS[index % PERF_IMAGE_COUNT] },
        zone: `zone-${row + 1}`,
        metadata: {},
        attributes: {},
      });
    }
  }
  // 49 chain Edges plus 11 Edges that skip one row: 60 in all.
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ id: `edge-${edges.length + 1}`, from: `image-${i + 1}`, to: `image-${i + 2}`, type: "link" });
  }
  for (let i = 0; i < 11; i++) {
    edges.push({ id: `edge-${edges.length + 1}`, from: `image-${i + 1}`, to: `image-${i + 1 + PERF_COLUMNS}`, type: "link" });
  }
  return {
    schemaVersion: 1,
    id: "perf-50-images",
    title: { en: "50-image test" },
    nodes,
    edges,
    zones,
  };
}

/** Footprints: 4 `rect` and 1 `ring`. */
export function buildPerfFootprints(): ZoneFootprint[] {
  const footprints: ZoneFootprint[] = [];
  for (let row = 0; row < PERF_ROWS - 1; row++) {
    footprints.push({
      kind: "rect",
      id: `zone-${row + 1}`,
      x: 0,
      z: gridZ(row),
      width: PERF_COLUMNS * COLUMN_SPACING + 4,
      depth: ROW_SPACING - 2,
    });
  }
  footprints.push({
    kind: "ring",
    id: `zone-${PERF_ROWS}`,
    x: 0,
    z: gridZ(PERF_ROWS - 1),
    innerRadius: 1,
    outerRadius: 34,
  });
  return footprints;
}

/** View_Settings for the test Scenario: one overview preset, no paths. */
export function buildPerfSettings(): ViewSettings {
  return {
    zoneFootprints: buildPerfFootprints(),
    presets: [
      {
        id: "overview",
        label: { en: "Overview" },
        pose: { position: { x: 0, y: 50, z: 60 }, target: { x: 0, y: 0, z: 16 } },
        filter: { edgeRule: "bothEnds" },
      },
    ],
    paths: [],
    detailDistance: 12,
    snapStep: 1,
    wallHeight: 3,
    editMode: "view",
    stepDuration: 1,
  };
}
