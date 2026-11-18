import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identifierArb, jsonEqual, scenarioArb, timelineArb } from "../../model/arbitraries.ts";
import type { EffectRequest } from "../../model/rule-schema.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { sortUniqueEffects } from "../../model/effects.ts";
import { cursorEffects } from "../../model/timeline.ts";
import { effectsArb, filterArb, footprintsArb, themeArb } from "./arbitraries.ts";
import { drawableEffects, shownEffects } from "./effects-view.ts";
import { NEUTRAL_THEME } from "./neutral-theme.ts";
import { edgeStyleFor, effectStyleFor, nodeStyleFor, type Theme } from "./theme-schema.ts";
import { computeVisibleSet } from "./visibility.ts";

const scenario = { nodes: [], edges: [], zones: [] } as unknown as Scenario;
const theme: Theme = { ...NEUTRAL_THEME, effects: { haze: { style: "fog", color: "#aabbcc", opacity: 0.5 } } };
const visible = { nodes: ["n1"], edges: ["e1"], zones: ["area-a", "area-b"] };
const req = (effect: string, kind: "node" | "edge" | "zone", id: string): EffectRequest => ({
  effect,
  target: { kind, id },
  source: "r",
});

describe("drawableEffects", () => {
  it("draws nothing when no Effect_Kind is styled", () => {
    const list = [req("haze", "node", "n1")];
    expect(drawableEffects(list, scenario, visible, new Set(), NEUTRAL_THEME)).toEqual([]);
  });

  it("drops a hidden or missing target and keeps the others in order", () => {
    const list = [req("haze", "node", "hidden"), req("haze", "edge", "e1"), req("haze", "node", "n1")];
    const out = drawableEffects(list, scenario, visible, new Set(), theme);
    expect(out.map((d) => d.target.id)).toEqual(["e1", "n1"]);
    expect(out[0]?.style).toEqual(theme.effects["haze"]);
  });

  it("drops a Zone without footprint and keeps the others", () => {
    const list = [req("haze", "zone", "area-a"), req("haze", "zone", "area-b"), req("haze", "node", "n1")];
    const out = drawableEffects(list, scenario, visible, new Set(["area-b"]), theme);
    expect(out.map((d) => d.target.id)).toEqual(["area-b", "n1"]);
  });
});

describe("shownEffects", () => {
  it("returns the App list without a playback", () => {
    const list = [req("haze", "node", "n1")];
    expect(shownEffects(list, null)).toEqual(list);
  });

  it("returns the effects up to the cursor with a playback", () => {
    const e0 = req("haze", "node", "n1");
    const e1 = req("haze", "edge", "e1");
    const timeline = {
      steps: [
        { id: "s0", targets: [], effects: [e0] },
        { id: "s1", targets: [], effects: [e1] },
      ],
    };
    expect(shownEffects([], { cursor: { timeline, position: 0 } })).toEqual([e0]);
    expect(shownEffects([], { cursor: { timeline, position: 1 } })).toEqual([e1, e0].sort((a, b) =>
      a.target.kind < b.target.kind ? -1 : 1));
  });
});

describe("P-VIEW-11 only visible, styled, existing targets get effects", () => {
  // Feature: core-view, Property 11: only visible, styled, existing targets get effects
  it("P-VIEW-11 drawableEffects equals the reference filter, in input order", () => {
    const caseArb = scenarioArb.chain((s) =>
      fc.record({
        s: fc.constant(s),
        filter: filterArb(s),
        theme: themeArb,
        footprints: footprintsArb(s),
        effects: effectsArb(s),
      }),
    );
    fc.assert(
      fc.property(caseArb, ({ s, filter, theme, footprints, effects }) => {
        const visible = computeVisibleSet(s, filter);
        const ids = new Set(footprints.map((f) => f.id));
        const out = drawableEffects(effects, s, visible, ids, theme);
        const expected = effects.flatMap((r) => {
          const style = Object.hasOwn(theme.effects, r.effect) ? theme.effects[r.effect] : undefined;
          if (style === undefined) return [];
          const { kind, id } = r.target;
          const shown =
            kind === "node" ? visible.nodes.includes(id)
            : kind === "edge" ? visible.edges.includes(id)
            : visible.zones.includes(id) && ids.has(id);
          return shown ? [{ target: { kind, id }, style: effectStyleFor(theme, r.effect) }] : [];
        });
        expect(out).toEqual(expected);
        expect(drawableEffects([], s, visible, ids, theme)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("P-VIEW-11 style lookups return the own entry or the default", () => {
    fc.assert(
      fc.property(themeArb, identifierArb, fc.constantFrom("__proto__", "constructor", "toString", "t1", "t2", "t3"), (theme, a, b) => {
        for (const type of [a, b]) {
          expect(nodeStyleFor(theme, type)).toEqual(Object.hasOwn(theme.nodes, type) ? theme.nodes[type] : theme.defaultNode);
          expect(edgeStyleFor(theme, type)).toEqual(Object.hasOwn(theme.edges, type) ? theme.edges[type] : theme.defaultEdge);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("P-VIEW-11 shownEffects equals upToCurrent with a playback and the App list without", () => {
    const cursorArb = timelineArb.chain((timeline) =>
      fc.nat(timeline.steps.length - 1).map((position) => ({ timeline, position })),
    );
    fc.assert(
      fc.property(cursorArb, scenarioArb.chain((s) => effectsArb(s)), (cursor, app) => {
        const result = cursorEffects(cursor);
        expect(result.ok).toBe(true);
        const expected = result.ok ? result.value.upToCurrent : [];
        const shown = shownEffects(app, { cursor });
        expect(jsonEqual(shown, expected)).toBe(true);
        expect(jsonEqual(shown, sortUniqueEffects(shown))).toBe(true);
        expect(shownEffects(app, null)).toEqual(app);
      }),
      { numRuns: 100 },
    );
  });
});
