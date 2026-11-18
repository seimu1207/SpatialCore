import type { ViewSettings } from "../helpers/settings-schema.ts";
import type { Theme } from "../helpers/theme-schema.ts";

/** The example View_Settings for the generic Sample_Scenario. */
export const SAMPLE_SETTINGS: ViewSettings = {
  zoneFootprints: [
    { kind: "rect", id: "area-a", x: 0, z: 0, width: 8, depth: 6 },
    { kind: "rect", id: "area-b", x: 0, z: -8, width: 8, depth: 6 },
    { kind: "ring", id: "area-c", x: 0, z: -18, innerRadius: 1.5, outerRadius: 4 },
  ],
  presets: [
    {
      id: "overview",
      label: { en: "Overview", ja: "全体" },
      pose: { position: { x: 0, y: 18, z: 10 }, target: { x: 0, y: 0, z: -8 } },
      filter: { edgeRule: "bothEnds" },
    },
    {
      id: "low-front",
      label: { en: "Low front view", ja: "低い正面" },
      pose: { position: { x: 0, y: 1.5, z: 9 }, target: { x: 0, y: 1, z: 0 } },
      filter: { zones: ["area-a"], includeUnzoned: true, edgeRule: "anyEnd" },
    },
  ],
  paths: [{ id: "through", fromZones: { height: 1.6 } }],
  detailDistance: 4,
  snapStep: 0.5,
  wallHeight: 2,
  editMode: "edit",
  stepDuration: 1.5,
};

/** The example Theme with generic `card`, `link`, and `haze` entries. */
export const SAMPLE_THEME: Theme = {
  background: "#f4f4f2",
  floor: "#d9d9d4",
  wall: "#8a8a84",
  text: "#1e1e1e",
  defaultNode: { fill: "#ffffff", border: "#5a5a5a" },
  defaultEdge: { color: "#3c3c3c", width: 0.03, dashed: false },
  nodes: { card: { fill: "#fff7e0", border: "#a07a20" } },
  edges: { link: { color: "#2050a0", width: 0.04, dashed: true } },
  effects: { haze: { style: "fog", color: "#c0c0c8", opacity: 0.45 } },
};
