// Pure helpers for the Core_Demo Selection line and the "Remove selected edge" button.
import type { EditCommand } from "../../model/commands.ts";
import type { Selection } from "../start-view.tsx";

/** The text of the Selection line: `Selection: none`, `Selection: node <id>`, or `Selection: edge <id>`. */
export function selectionLabel(selection: Selection): string {
  return selection === null ? "Selection: none" : `Selection: ${selection.kind} ${selection.id}`;
}

/** The command for the "Remove selected edge" button; `null` unless the Selection is an Edge. */
export function removeSelectedEdgeCommand(selection: Selection): EditCommand | null {
  return selection !== null && selection.kind === "edge" ? { kind: "removeEdge", id: selection.id } : null;
}
