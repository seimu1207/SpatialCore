import { describe, expect, it } from "vitest";
import { curveLayout } from "./curve-layout.ts";
import type { MoodCurve } from "./shift-check.ts";

const lt = (en: string) => ({ en, ja: en });

function curve(): MoodCurve {
  return {
    zones: [
      { id: "z3", label: lt("Exit room"), order: 3 },
      { id: "z1", label: lt("Hall"), order: 1 },
      { id: "z2", label: lt("Middle"), order: 2 },
    ],
    attributes: [
      {
        attribute: "brightness",
        series: [
          { zone: "z3", value: 0.2 },
          { zone: "z1", value: 0.8 },
        ],
        noData: ["z2"],
      },
      {
        attribute: "temperature",
        series: [
          { zone: "z1", value: 0.9 },
          { zone: "z2", value: -0.7 },
          { zone: "z3", value: 0 },
        ],
        noData: [],
      },
    ],
  };
}

describe("curveLayout", () => {
  const L = curveLayout(curve(), 400, 200);

  it("places zones by rank with x = pad + rank*(width-2pad)/(n-1)", () => {
    expect(L.labels.map((l) => l.zone)).toEqual(["z1", "z2", "z3"]);
    expect(L.labels.map((l) => l.x)).toEqual([24, 200, 376]);
  });

  it("orders points by rank and joins them in a polyline", () => {
    const b = L.charts[0];
    expect(b.points.map((p) => p.zone)).toEqual(["z1", "z3"]);
    expect(b.polyline).toBe(`${b.points[0].x},${b.points[0].y} ${b.points[1].x},${b.points[1].y}`);
    expect(b.points[0].y).toBeLessThan(b.points[1].y);
  });

  it("gives noData Zones an empty place on the axis", () => {
    expect(L.charts[0].noData).toEqual([{ zone: "z2", x: 200, y: 176 }]);
    expect(L.charts[1].noData).toEqual([]);
  });

  it("tags the first Zone Entrance and the last Exit", () => {
    expect(L.labels.map((l) => l.tag)).toEqual(["entrance", null, "exit"]);
    expect(L.labels[0].label.en).toBe("Hall");
  });

  it("draws values outside the range at the edge but keeps the true value in the text", () => {
    const t = L.charts[1];
    expect(t.points[0].y).toBe(24);
    expect(t.points[1].y).toBe(176);
    expect(t.points[0].text).toBe("Hall: warmth +0.90");
    expect(t.points[1].text).toBe("Middle: warmth -0.70");
    expect(t.points[2].text).toBe("Exit room: warmth +0.00");
    expect(t.points[0].value).toBe(0.9);
    expect(L.charts[0].points[0].text).toBe("Hall: brightness 0.80");
  });

  it("does not divide by zero with a single Zone", () => {
    const one: MoodCurve = {
      zones: [{ id: "a", label: lt("A"), order: 1 }],
      attributes: [{ attribute: "brightness", series: [{ zone: "a", value: 0.5 }], noData: [] }],
    };
    const l = curveLayout(one, 300, 100);
    expect(l.labels[0].x).toBe(24);
    expect(l.labels[0].tag).toBe("entrance");
    expect(Number.isFinite(l.charts[0].points[0].x)).toBe(true);
    expect(l.charts[0].points[0].y).toBe(50);
  });
});
