import { describe, expect, it } from "vitest";
import { removeSelectedEdgeCommand, selectionLabel } from "./selection-line.ts";

describe("demo selection line", () => {
  it("builds the label text", () => {
    expect(selectionLabel(null)).toBe("Selection: none");
    expect(selectionLabel({ kind: "node", id: "n3" })).toBe("Selection: node n3");
    expect(selectionLabel({ kind: "edge", id: "e4" })).toBe("Selection: edge e4");
  });

  it("builds a removeEdge command only for an Edge Selection", () => {
    expect(removeSelectedEdgeCommand({ kind: "edge", id: "e4" })).toEqual({ kind: "removeEdge", id: "e4" });
    expect(removeSelectedEdgeCommand({ kind: "node", id: "n3" })).toBeNull();
    expect(removeSelectedEdgeCommand(null)).toBeNull();
  });
});
