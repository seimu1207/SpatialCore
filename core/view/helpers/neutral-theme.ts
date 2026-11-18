import type { Theme } from "./theme-schema.ts";

/** The neutral Theme: Default_Styles and colors only, with empty style maps (R-VIEW-19.9). */
export const NEUTRAL_THEME: Theme = {
  background: "#f4f4f2",
  floor: "#d9d9d4",
  wall: "#8a8a84",
  text: "#1e1e1e",
  defaultNode: { fill: "#ffffff", border: "#5a5a5a" },
  defaultEdge: { color: "#3c3c3c", width: 0.03, dashed: false },
  nodes: {},
  edges: {},
  effects: {},
};
