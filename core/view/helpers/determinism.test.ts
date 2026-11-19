import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { jsonEqual, scenarioArb } from "../../model/arbitraries.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import {
  actionSeqArb,
  expandSeqAction,
  badProgressArb,
  boundedArb,
  cursorArb,
  effectsArb,
  filterArb,
  progressArb,
  settingsArb,
  themeArb,
  timelineArb,
  vec3Arb,
  waypointsArb,
  poseArb,
} from "./arbitraries.ts";
import { buildZoneWaypoints, poseAt, tweenPose, waypointMarks } from "./camera-path.ts";
import { showsDetail } from "./detail.ts";
import { edgeMidpoint, edgeOffsets, loopSizes } from "./edge-layout.ts";
import { drawableEffects, shownEffects } from "./effects-view.ts";
import {
  clampScale,
  connectCommand,
  dragCommand,
  gizmoAxes,
  newEdgeId,
  rotateCommand,
  rotationPreview,
  scaleCommand,
  type GizmoAxis,
} from "./gesture-commands.ts";
import { checkLinkedTimeline } from "./link.ts";
import { loadViewSettings, type CameraPath } from "./settings-schema.ts";
import { snap } from "./snap.ts";
import { loadTheme } from "./theme-schema.ts";
import { cameraFor, initialViewState, reduceViewState } from "./view-state.ts";
import { computeVisibleSet } from "./visibility.ts";
import { missingZoneRefs, newlyMissingZoneRefs } from "./zone-refs.ts";

/** Maps and Sets have no own keys for `jsonEqual`, so turn them into ordered entry lists first. */
function norm(v: unknown): unknown {
  if (typeof v === "number" && !Number.isFinite(v)) return String(v);
  if (v instanceof Map) return { map: [...v.entries()].map(([k, x]): unknown[] => [k, norm(x)]) };
  if (v instanceof Set) return { set: [...v].map(norm) };
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === "object" && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
  }
  return v;
}

/** Call `fn` on `args`, then on a structuredClone of them: same result, arguments untouched. */
function same<A extends unknown[]>(name: string, fn: (...a: A) => unknown, ...args: A): void {
  const before = structuredClone(args);
  const copy = structuredClone(args);
  const first = norm(fn(...args));
  expect(jsonEqual(norm(args), norm(before)), `${name} changed an argument`).toBe(true);
  const second = norm(fn(...copy));
  expect(jsonEqual(first, second), `${name} gave different results`).toBe(true);
}

const axisArb = fc.constantFrom<GizmoAxis>("x", "y", "z");

const caseArb = scenarioArb.chain((s) =>
  settingsArb(s).chain((settings) =>
    fc.record({
      s: fc.constant(s),
      settings: fc.constant(settings),
      theme: themeArb,
      filter: filterArb(s),
      effects: effectsArb(s),
      actions: actionSeqArb(settings),
      cursor: cursorArb(),
      waypoints: waypointsArb,
      progress: fc.oneof(progressArb, badProgressArb),
      poses: fc.tuple(poseArb, poseArb),
      t: fc.oneof(progressArb, fc.double({ noNaN: true })),
      p: vec3Arb(boundedArb),
      q: vec3Arb(boundedArb),
      step: fc.double({ noNaN: true }),
      offset: boundedArb,
      handle: fc.anything(),
      axes: fc.subarray<GizmoAxis>(["x", "y", "z"]),
      axis: axisArb,
      delta: fc.double({ noNaN: true }),
      pick: fc.nat(),
      pick2: fc.nat(),
      height: boundedArb,
      edgeType: fc.constantFrom("link", "other", "__proto__"),
      timelineSeed: fc.anything(),
      matching: fc.nat(),
    }),
  ),
);

describe("P-VIEW-1 same input → same result", () => {
  // Feature: core-view, Property 1: P-VIEW-1 same input → same result
  it("every helper gives jsonEqual results on cloned input and leaves arguments unchanged", () => {
    fc.assert(
      fc.property(caseArb, (c) => {
        const { s, settings, theme, filter } = c;
        same("loadViewSettings", loadViewSettings, settings);
        same("loadTheme", loadTheme, theme);
        same("computeVisibleSet", computeVisibleSet, s, filter);
        const visible = computeVisibleSet(s, filter);
        same("poseAt", poseAt, c.waypoints, c.progress);
        same("waypointMarks", waypointMarks, c.waypoints);
        same("buildZoneWaypoints", buildZoneWaypoints, s, settings.zoneFootprints, c.height);
        same("tweenPose", tweenPose, c.poses[0], c.poses[1], c.t);
        same("snap", snap, c.p, c.step);
        same("showsDetail", showsDetail, c.p, c.q, c.step);
        same("edgeOffsets", edgeOffsets, s, visible.edges, theme);
        same("edgeMidpoint", edgeMidpoint, c.p, c.q, c.offset);
        same("loopSizes", loopSizes, s, visible.edges);

        if (s.nodes.length > 0) {
          const node = s.nodes[c.pick % s.nodes.length];
          const other = s.nodes[c.pick2 % s.nodes.length];
          same("dragCommand", dragCommand, node, c.p);
          same("rotateCommand", rotateCommand, node, c.axis, c.delta);
          same("scaleCommand", scaleCommand, node, c.axes, c.p);
          same("connectCommand", connectCommand, s, node.id, other.id, c.edgeType);
        }
        same("gizmoAxes", gizmoAxes, "rotate", c.handle);
        same("gizmoAxes scale", gizmoAxes, "scale", c.handle);
        same("rotationPreview", rotationPreview, c.p, c.axis, c.delta);
        same("clampScale", clampScale, c.p, c.axes);
        same("newEdgeId", newEdgeId, s);

        const path: CameraPath = { id: "p", fromZones: { height: 1 } };
        const built = buildZoneWaypoints(s, settings.zoneFootprints, 1);
        same("checkLinkedTimeline junk", checkLinkedTimeline, path, built, c.timelineSeed);
        if (built.ok) {
          const tl = fc.sample(timelineArb(s, built.zones), { seed: c.matching, numRuns: 1 })[0];
          same("checkLinkedTimeline", checkLinkedTimeline, path, built, tl.timeline);
        }

        same("shownEffects app", shownEffects, c.effects, null);
        same("shownEffects timeline", shownEffects, c.effects, { cursor: c.cursor });
        same("drawableEffects", drawableEffects, c.effects, s, visible, new Set(settings.zoneFootprints.map((f) => f.id)), theme);

        same("missingZoneRefs", missingZoneRefs, settings, s);
        const fewer: Scenario = { ...s, zones: s.zones.slice(1) };
        same("newlyMissingZoneRefs", newlyMissingZoneRefs, settings, s, fewer);
        same("newlyMissingZoneRefs same", newlyMissingZoneRefs, settings, fewer, fewer);

        let state = initialViewState(settings);
        for (const seq of c.actions) {
          for (const action of expandSeqAction(seq, state)) {
            same("reduceViewState", reduceViewState, state, action);
            state = reduceViewState(state, action);
          }
          same("cameraFor", cameraFor, state);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: core-view, Property 1: P-VIEW-1 same input → same result
  it("edgeOffsets gives the same offset per Edge id for a permuted edges list", () => {
    fc.assert(
      fc.property(
        scenarioArb.chain((s) =>
          fc.record({
            s: fc.constant(s),
            theme: themeArb,
            edges: fc.shuffledSubarray(s.edges, { minLength: s.edges.length, maxLength: s.edges.length }),
            ids: fc.shuffledSubarray(s.edges.map((e) => e.id)),
          }),
        ),
        ({ s, theme, edges, ids }) => {
          const a = edgeOffsets(s, ids, theme);
          const b = edgeOffsets({ ...s, edges }, ids, theme);
          expect(jsonEqual(norm([...a.entries()].sort()), norm([...b.entries()].sort()))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: core-view, Property 1: P-VIEW-1 same input → same result
  it("arbitrary values in place of a Scenario, filter, or Waypoints give a result or a failure", () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), fc.anything(), (a, b, w) => {
        expect(() => {
          loadViewSettings(a);
          loadTheme(a);
          computeVisibleSet(a as never, b as never);
          poseAt(w as never, 0.5);
          waypointMarks(w as never);
          buildZoneWaypoints(a as never, w as never, 1);
          checkLinkedTimeline({ id: "p", fromZones: { height: 1 } }, buildZoneWaypoints(a as never, w as never, 1), b);
        }).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
