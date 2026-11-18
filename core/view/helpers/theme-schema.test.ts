import { describe, expect, it } from "vitest";
import { NEUTRAL_THEME } from "./neutral-theme.ts";
import { effectStyleFor, edgeStyleFor, loadTheme, nodeStyleFor } from "./theme-schema.ts";

const withColor = (c: string): unknown => ({ ...NEUTRAL_THEME, background: c });

describe("loadTheme", () => {
  it("19.3 accepts #rrggbb in either case and rejects other colors", () => {
    expect(loadTheme(withColor("#ABCdef")).ok).toBe(true);
    for (const bad of ["#abc", "red", "#1234567"]) {
      const r = loadTheme(withColor(bad));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.path).toBe("background");
    }
  });

  it("19.5 reports non-object, missing wall, bad style, bad opacity without throwing", () => {
    expect(loadTheme(42).ok).toBe(false);
    expect(loadTheme(null).ok).toBe(false);
    const noWall: Record<string, unknown> = { ...NEUTRAL_THEME };
    delete noWall.wall;
    const r1 = loadTheme(noWall);
    expect(!r1.ok && r1.errors.some((e) => e.path === "wall")).toBe(true);
    const r2 = loadTheme({ ...NEUTRAL_THEME, effects: { haze: { style: "glow", color: "#000000", opacity: 0.5 } } });
    expect(!r2.ok && r2.errors.some((e) => e.path === "effects.haze.style")).toBe(true);
    const r3 = loadTheme({ ...NEUTRAL_THEME, effects: { haze: { style: "fog", color: "#000000", opacity: -0.1 } } });
    expect(!r3.ok && r3.errors.some((e) => e.path === "effects.haze.opacity")).toBe(true);
  });

  it("19.4 removes unknown fields and keeps __proto__ as an own key", () => {
    const input = JSON.parse(
      '{"background":"#ffffff","floor":"#ffffff","wall":"#ffffff","text":"#ffffff","extra":1,' +
        '"defaultNode":{"fill":"#ffffff","border":"#000000","x":1},' +
        '"defaultEdge":{"color":"#000000","width":1,"dashed":true},' +
        '"nodes":{"__proto__":{"fill":"#111111","border":"#222222","y":2},"constructor":{"fill":"#333333","border":"#444444"}},' +
        '"edges":{},"effects":{}}',
    ) as unknown;
    const r = loadTheme(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.theme).not.toHaveProperty("extra");
    expect(Object.hasOwn(r.theme.nodes, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(r.theme.nodes, "__proto__")?.value).toEqual({
      fill: "#111111",
      border: "#222222",
    });
    expect(nodeStyleFor(r.theme, "constructor").fill).toBe("#333333");
  });

  it("19.8 returns defaults for types missing from the maps", () => {
    expect(nodeStyleFor(NEUTRAL_THEME, "constructor")).toBe(NEUTRAL_THEME.defaultNode);
    expect(edgeStyleFor(NEUTRAL_THEME, "toString")).toBe(NEUTRAL_THEME.defaultEdge);
    expect(effectStyleFor(NEUTRAL_THEME, "constructor")).toBeNull();
  });

  it("19.9 NEUTRAL_THEME passes loadTheme and has three empty maps", () => {
    const r = loadTheme(NEUTRAL_THEME);
    expect(r.ok).toBe(true);
    expect(Object.keys(NEUTRAL_THEME.nodes)).toHaveLength(0);
    expect(Object.keys(NEUTRAL_THEME.edges)).toHaveLength(0);
    expect(Object.keys(NEUTRAL_THEME.effects)).toHaveLength(0);
  });
});
