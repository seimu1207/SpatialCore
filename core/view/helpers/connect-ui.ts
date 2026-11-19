/** What a click on a Node panel does (R-VIEW-12.7, 15.7, 15.8). */
export type ClickAction = "select" | "connect" | "none";

/** In `view` mode a click does nothing; with connect on it goes to the connection, otherwise it selects. */
export function nodeClickAction(editMode: "view" | "edit", connectOn: boolean): ClickAction {
  if (editMode !== "edit") return "none";
  return connectOn ? "connect" : "select";
}

/** What a click on an Edge does: it selects only in `edit` mode with connect off, otherwise it is an empty click (R-VIEW-23.1, 23.8). */
export function edgeClickAction(editMode: "view" | "edit", connectOn: boolean): "select" | "empty" {
  return editMode === "edit" && !connectOn ? "select" : "empty";
}

/** Normalized device coordinates (x, y in -1..1, y up) to pixels inside a `width` × `height` box (y down). */
export function ndcToPixels(ndc: { x: number; y: number }, width: number, height: number): { x: number; y: number } {
  return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height };
}
