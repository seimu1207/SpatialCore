import { describe, expect, it } from "vitest";
import { edgeClickAction, ndcToPixels, nodeClickAction } from "./connect-ui.ts";

describe("nodeClickAction", () => {
  it("ignores clicks in view mode, with connect on or off", () => {
    expect(nodeClickAction("view", false)).toBe("none");
    expect(nodeClickAction("view", true)).toBe("none");
  });
  it("selects in edit mode with connect off", () => {
    expect(nodeClickAction("edit", false)).toBe("select");
  });
  it("connects, and does not select, in edit mode with connect on", () => {
    expect(nodeClickAction("edit", true)).toBe("connect");
  });
});

describe("edgeClickAction", () => {
  it("selects only in edit mode with connect off", () => {
    expect(edgeClickAction("edit", false)).toBe("select");
    expect(edgeClickAction("edit", true)).toBe("empty");
    expect(edgeClickAction("view", false)).toBe("empty");
    expect(edgeClickAction("view", true)).toBe("empty");
  });
});

describe("ndcToPixels", () => {
  it("maps the centre and corners, with y flipped", () => {
    expect(ndcToPixels({ x: 0, y: 0 }, 800, 600)).toEqual({ x: 400, y: 300 });
    expect(ndcToPixels({ x: -1, y: 1 }, 800, 600)).toEqual({ x: 0, y: 0 });
    expect(ndcToPixels({ x: 1, y: -1 }, 800, 600)).toEqual({ x: 800, y: 600 });
  });
});
