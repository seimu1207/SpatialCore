// Test support for the View_Helpers. Imported only by `*.test.ts` files.
import fc from "fast-check";
import { identifierArb, localizedTextArb, scenarioArb, typePoolArb } from "../../model/arbitraries.ts";
import type { EffectRequest, EffectTarget, TimelineCursor } from "../../model/rule-schema.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { createCursor, createTimeline } from "../../model/timeline.ts";
import type { CameraPose, VisibilityFilter, ViewSettings, ZoneFootprint } from "./settings-schema.ts";
import type { Theme } from "./theme-schema.ts";
import type { ViewAction } from "./view-state.ts";

export const finiteArb: fc.Arbitrary<number> = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.constantFrom(0, -0, 0.5, -0.5, 1e-9, 1e6),
);

export const boundedArb: fc.Arbitrary<number> = fc.double({ min: -1e6, max: 1e6, noNaN: true });

export type Vec3 = { x: number; y: number; z: number };

export function vec3Arb(c: fc.Arbitrary<number>): fc.Arbitrary<Vec3> {
  return fc.record({ x: c, y: c, z: c });
}

export const poseArb: fc.Arbitrary<CameraPose> = fc
  .record({ position: vec3Arb(boundedArb), target: vec3Arb(boundedArb) })
  .filter((p) => !(p.position.x === p.target.x && p.position.y === p.target.y && p.position.z === p.target.z));

const quarterArb = fc.integer({ min: -400, max: 400 }).map((n) => n / 4);

/**
 * Camera_Path Waypoints: 2 to 6 poses on a quarter-unit grid (no tiny segments), with repeated
 * neighbours (zero-length segments) and all-equal positions mixed in.
 */
export const waypointsArb: fc.Arbitrary<CameraPose[]> = (() => {
  const pose = fc.record({ position: vec3Arb(quarterArb), target: vec3Arb(quarterArb) });
  const list = fc.array(pose, { minLength: 2, maxLength: 6 });
  return fc.oneof(
    { arbitrary: list, weight: 5 },
    {
      arbitrary: fc.tuple(list, fc.nat(5)).map(([w, i]) => {
        const k = i % w.length;
        return [...w.slice(0, k + 1), { position: { ...w[k].position }, target: { ...w[k].target } }, ...w.slice(k + 1)];
      }),
      weight: 2,
    },
    {
      arbitrary: fc.tuple(vec3Arb(quarterArb), list).map(([p, w]) => w.map((q) => ({ position: { ...p }, target: q.target }))),
      weight: 1,
    },
  );
})();

/** Valid Path_Progress values, with both ends over-represented. */
export const progressArb: fc.Arbitrary<number> = fc.oneof(
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.constantFrom(0, 1, 0.5, 1e-9, 1 - 1e-9),
);

/** Values that are not a valid Path_Progress. */
export const badProgressArb: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(NaN, Infinity, -Infinity, -1e-9, 1 + 1e-9, -0.01, 1.01),
  fc.double({ min: 1.0000001, max: 1e9, noNaN: true }),
  fc.double({ min: -1e9, max: -1e-7, noNaN: true }),
);

const posNumArb = fc.double({ min: 1e-3, max: 1e3, noNaN: true });

/** For a random subset of the Zones of `s`, a footprint; plus 0 to 2 footprints that name no Zone. */
export function footprintsArb(s: Scenario): fc.Arbitrary<ZoneFootprint[]> {
  return fc
    .tuple(fc.subarray(s.zones.map((z) => z.id)), fc.array(identifierArb, { maxLength: 2 }))
    .map(([zoneIds, extra]) => [...new Set([...zoneIds, ...extra])])
    .chain((ids) => {
      const centers = fc.constantFrom(0, 1, -1);
      const one = (id: string): fc.Arbitrary<ZoneFootprint> =>
        fc.oneof(
          fc
            .record({ x: fc.oneof(centers, boundedArb), z: fc.oneof(centers, boundedArb), width: posNumArb, depth: posNumArb })
            .map((r) => ({ kind: "rect" as const, id, ...r })),
          fc
            .record({
              x: fc.oneof(centers, boundedArb),
              z: fc.oneof(centers, boundedArb),
              outerRadius: posNumArb,
              fraction: fc.double({ min: 0, max: 0.99, noNaN: true }),
            })
            .map((r) => ({
              kind: "ring" as const,
              id,
              x: r.x,
              z: r.z,
              innerRadius: r.outerRadius * r.fraction,
              outerRadius: r.outerRadius,
            })),
        );
      return fc.tuple(...ids.map(one));
    });
}

function listFrom(pool: readonly string[]): fc.Arbitrary<string[]> {
  const item = pool.length > 0 ? fc.oneof(fc.constantFrom(...pool), identifierArb) : identifierArb;
  return fc.array(item, { maxLength: 3 });
}

export function filterArb(s: Scenario): fc.Arbitrary<VisibilityFilter> {
  return fc.record(
    {
      zones: listFrom(s.zones.map((z) => z.id)),
      nodeTypes: listFrom(s.nodes.map((n) => n.type)),
      edgeTypes: listFrom(s.edges.map((e) => e.type)),
      includeUnzoned: fc.boolean(),
      edgeRule: fc.constantFrom("bothEnds" as const, "anyEnd" as const),
    },
    { requiredKeys: ["edgeRule"] },
  );
}

/** Valid View_Settings for `s`: 1 to 3 presets, 0 to 3 paths, footprints, positive numbers. */
export function settingsArb(s: Scenario): fc.Arbitrary<ViewSettings> {
  const preset = fc.record({
    id: identifierArb,
    label: localizedTextArb,
    pose: poseArb,
    filter: filterArb(s),
  });
  const path = fc.oneof(
    fc.record({ id: identifierArb, waypoints: fc.array(poseArb, { minLength: 2, maxLength: 4 }) }),
    fc.record({ id: identifierArb, fromZones: fc.record({ height: boundedArb }) }),
  );
  return fc.record({
    zoneFootprints: footprintsArb(s),
    presets: fc.uniqueArray(preset, { minLength: 1, maxLength: 3, selector: (p) => p.id }),
    paths: fc.uniqueArray(path, { maxLength: 3, selector: (p) => p.id }),
    detailDistance: posNumArb,
    snapStep: posNumArb,
    wallHeight: posNumArb,
    editMode: fc.constantFrom("view" as const, "edit" as const),
    stepDuration: posNumArb,
  });
}

const hexArb = fc.constantFrom(..."0123456789abcdefABCDEF".split(""));
const colorArb = fc.array(hexArb, { minLength: 6, maxLength: 6 }).map((d) => `#${d.join("")}`);
const keyArb = fc.oneof(typePoolArb, fc.constantFrom("__proto__", "constructor", "toString"));

function mapArb<T>(value: fc.Arbitrary<T>): fc.Arbitrary<Record<string, T>> {
  return fc
    .uniqueArray(fc.tuple(keyArb, value), { maxLength: 4, selector: ([k]) => k })
    .map((pairs) => Object.fromEntries(pairs));
}

const nodeStyleArb = fc.record({ fill: colorArb, border: colorArb });
const edgeStyleArb = fc.record({ color: colorArb, width: fc.double({ min: 1e-3, max: 0.5, noNaN: true }), dashed: fc.boolean() });
const effectStyleArb = fc.record({
  style: fc.constant("fog" as const),
  color: colorArb,
  opacity: fc.double({ min: 0, max: 1, noNaN: true }),
});

export const themeArb: fc.Arbitrary<Theme> = fc.record({
  background: colorArb,
  floor: colorArb,
  wall: colorArb,
  text: colorArb,
  defaultNode: nodeStyleArb,
  defaultEdge: edgeStyleArb,
  nodes: mapArb(nodeStyleArb),
  edges: mapArb(edgeStyleArb),
  effects: mapArb(effectStyleArb),
});

export type Mutation = { value: unknown; path: string };

function without(obj: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

function withKey(obj: object, key: string, value: unknown): Record<string, unknown> {
  return Object.fromEntries([...Object.entries(obj).filter(([k]) => k !== key), [key, value]]);
}

const settingsFields = [
  "zoneFootprints",
  "presets",
  "paths",
  "detailDistance",
  "snapStep",
  "wallHeight",
  "editMode",
  "stepDuration",
] as const;
const scalarSettingsFields = ["detailDistance", "snapStep", "wallHeight", "editMode", "stepDuration"] as const;

/** One mutation of a valid View_Settings, with the Field_Path that must be reported. */
export const settingsMutationArb: fc.Arbitrary<Mutation> = scenarioArb
  .chain((s) => settingsArb(s))
  .chain((v) => {
    const p0 = v.presets[0];
    const fp = v.zoneFootprints.length;
    const pn = v.paths.length;
    const somePose = p0?.pose ?? { position: { x: 0, y: 0, z: 0 }, target: { x: 1, y: 0, z: 0 } };
    const options: fc.Arbitrary<Mutation>[] = [
      fc.constantFrom(...settingsFields).map((f) => ({ value: without(v, f), path: f })),
      fc
        .tuple(fc.constantFrom(...scalarSettingsFields), fc.constantFrom<unknown>("x", null, true, [], {}))
        .map(([f, bad]) => ({ value: withKey(v, f, bad), path: f })),
      fc.constant({ value: withKey(v, "presets", []), path: "presets" }),
      fc.constant({
        value: withKey(v, "presets", [...v.presets, { ...v.presets[0] }]),
        path: `presets.${v.presets.length}.id`,
      }),
      fc.constant({
        value: withKey(v, "presets", [
          { ...p0, pose: { position: somePose.position, target: { ...somePose.position } } },
          ...v.presets.slice(1),
        ]),
        path: "presets.0.pose.target",
      }),
      fc.constantFrom(-1, 3, 5).map((inner) => ({
        value: withKey(v, "zoneFootprints", [
          ...v.zoneFootprints,
          { kind: "ring", id: "mut-ring", x: 0, z: 0, innerRadius: inner, outerRadius: 3 },
        ]),
        path: `zoneFootprints.${fp}.innerRadius`,
      })),
      fc.constantFrom("both", "neither").map((kind) => ({
        value: withKey(v, "paths", [
          ...v.paths,
          kind === "both"
            ? { id: "mut-path", waypoints: [somePose, somePose], fromZones: { height: 1 } }
            : { id: "mut-path" },
        ]),
        path: `paths.${pn}`,
      })),
    ];
    return fc.oneof(...options);
  });

const themeFields = [
  "background",
  "floor",
  "wall",
  "text",
  "defaultNode",
  "defaultEdge",
  "nodes",
  "edges",
  "effects",
] as const;

/** One mutation of a valid Theme, with the Field_Path that must be reported. */
export const themeMutationArb: fc.Arbitrary<Mutation> = themeArb.chain((t) => {
  const badColor = fc.constantFrom("red", "#12345", "#1234567", "#gggggg");
  const fog = (over: Record<string, unknown>): unknown => ({ style: "fog", color: "#000000", opacity: 0.5, ...over });
  const options: fc.Arbitrary<Mutation>[] = [
    fc.constantFrom(...themeFields).map((f) => ({ value: without(t, f), path: f })),
    badColor.map((c) => ({ value: withKey(t, "background", c), path: "background" })),
    badColor.map((c) => ({ value: withKey(t, "defaultNode", { ...t.defaultNode, border: c }), path: "defaultNode.border" })),
    badColor.map((c) => ({
      value: withKey(t, "nodes", withKey(t.nodes, "mut-node", { fill: c, border: "#000000" })),
      path: "nodes.mut-node.fill",
    })),
    fc.constantFrom(1.5, -0.1).map((o) => ({
      value: withKey(t, "effects", withKey(t.effects, "mut-haze", fog({ opacity: o }))),
      path: "effects.mut-haze.opacity",
    })),
    fc.constantFrom("glow", "Fog", "").map((st) => ({
      value: withKey(t, "effects", withKey(t.effects, "mut-haze", fog({ style: st }))),
      path: "effects.mut-haze.style",
    })),
    fc.constant({ value: withKey(t, "defaultEdge", { ...t.defaultEdge, width: 0 }), path: "defaultEdge.width" }),
  ];
  return fc.oneof(...options);
});

/** A valid Scenario with at least one Node, and one of its Nodes. */
export const scenarioNodeArb: fc.Arbitrary<{ scenario: Scenario; node: Scenario["nodes"][number] }> = scenarioArb
  .filter((s) => s.nodes.length > 0)
  .chain((scenario) => fc.constantFrom(...scenario.nodes).map((node) => ({ scenario, node })));

/** A valid Scenario with at least one Node, and two of its Nodes (possibly the same one twice). */
export const scenarioPairArb: fc.Arbitrary<{ scenario: Scenario; from: string; to: string }> = scenarioArb
  .filter((s) => s.nodes.length > 0)
  .chain((scenario) =>
    fc
      .tuple(fc.constantFrom(...scenario.nodes), fc.constantFrom(...scenario.nodes))
      .map(([a, b]) => ({ scenario, from: a.id, to: b.id })),
  );

/** Valid View_Settings for a Scenario `a`, plus a Scenario `b` that keeps a random subset of the Zones of `a`. */
export const zoneRefCaseArb: fc.Arbitrary<{ settings: ViewSettings; a: Scenario; b: Scenario }> = scenarioArb.chain((a) =>
  fc
    .tuple(settingsArb(a), fc.subarray(a.zones))
    .map(([settings, zones]) => ({ settings, a, b: { ...a, zones } })),
);

/**
 * 0 to 8 Effect_Requests for `s`. Effect names come from the same pool as `themeArb` keys (so some
 * are styled and some are not); targets name elements of `s` or missing ids.
 */
export function effectsArb(s: Scenario): fc.Arbitrary<EffectRequest[]> {
  const target = (kind: "node" | "edge" | "zone", ids: readonly string[]): fc.Arbitrary<EffectTarget> =>
    fc.record({
      kind: fc.constant(kind),
      id: ids.length > 0 ? fc.oneof(fc.constantFrom(...ids), identifierArb) : identifierArb,
    });
  const anyTarget = fc.oneof(
    target("node", s.nodes.map((n) => n.id)),
    target("edge", s.edges.map((e) => e.id)),
    target("zone", s.zones.map((z) => z.id)),
  );
  return fc.array(
    fc.record({
      effect: fc.oneof(keyArb, fc.constantFrom("__proto__", "constructor", "toString")),
      target: anyTarget,
      source: identifierArb,
    }),
    { maxLength: 8 },
  );
}

export type TimelineCase = { timeline: unknown; matching: boolean };

type StepLike = { id: string; targets: { kind: string; id: string }[]; effects: never[] };

/**
 * A Timeline for the Zone ids `zones` (the `zones` of a built Camera_Path, 2 or more, in route order),
 * either matching (one step per Zone with one Zone target each) or one broken variant: wrong step
 * count, wrong Zone, extra target, non-zone target, no target, or not a Timeline at all.
 */
export function timelineArb(s: Scenario, zones: readonly string[]): fc.Arbitrary<TimelineCase> {
  const steps = (): StepLike[] => zones.map((z, i) => ({ id: `step-${i}`, targets: [{ kind: "zone", id: z }], effects: [] }));
  const at = fc.nat(Math.max(0, zones.length - 1));
  const patch = (i: number, targets: { kind: string; id: string }[]): TimelineCase => {
    const list = steps();
    list[i] = { ...list[i], targets };
    return { timeline: { steps: list }, matching: false };
  };
  const spare = s.zones.length > 0 ? s.zones[0].id : "spare";
  return fc.oneof(
    { arbitrary: fc.constant<TimelineCase>({ timeline: { steps: steps() }, matching: true }), weight: 3 },
    fc.constant<TimelineCase>({ timeline: { steps: steps().slice(0, -1) }, matching: false }),
    fc.constant<TimelineCase>({
      timeline: { steps: [...steps(), { id: "step-extra", targets: [{ kind: "zone", id: spare }], effects: [] }] },
      matching: false,
    }),
    at.map((i) => patch(i, [{ kind: "zone", id: `mut-${zones[i]}` }])),
    at.map((i) => patch(i, [{ kind: "zone", id: zones[i] }, { kind: "zone", id: zones[i] }])),
    at.map((i) => patch(i, [{ kind: "node", id: zones[i] }])),
    at.map((i) => patch(i, [])),
    fc
      .constantFrom<unknown>(null, "junk", 7, {}, { steps: "x" }, { steps: [] })
      .map((timeline) => ({ timeline, matching: false })),
  );
}

/** A valid Timeline cursor at position 0 with `n` (at least 1) steps. */
export function cursorArb(n: fc.Arbitrary<number> = fc.integer({ min: 1, max: 4 })): fc.Arbitrary<TimelineCursor> {
  return n.map((count) => {
    const steps = Array.from({ length: count }, (_, i) => ({
      id: `step-${i}`,
      targets: [{ kind: "zone" as const, id: `z${i}` }],
      effects: [],
    }));
    const t = createTimeline(steps);
    if (!t.ok) throw new Error("cursorArb: bad timeline");
    const c = createCursor(t.value);
    if (!c.ok) throw new Error("cursorArb: bad cursor");
    return c.value;
  });
}

/**
 * 0 to 40 View_Actions for `settings`: ticks, preset switches with known ids, walk and Timeline
 * controls in any state, selection, connect, edit mode, `cameraApplied`, and `modelChanged`.
 */
export function actionSeqArb(settings: ViewSettings): fc.Arbitrary<ViewAction[]> {
  const ids = ["n1", "n2", "n3", "n4"];
  const idArb = fc.constantFrom(...ids);
  const idListArb = fc.subarray(ids);
  const edgeTypeArb = fc.constantFrom("link", "other");
  const action: fc.Arbitrary<ViewAction> = fc.oneof(
    { arbitrary: fc.double({ min: 0, max: 0.3, noNaN: true }).map((dt): ViewAction => ({ type: "tick", dt })), weight: 8 },
    fc
      .tuple(fc.constantFrom(...settings.presets), poseArb)
      .map(([p, from]): ViewAction => ({ type: "setPreset", id: p.id, pose: p.pose, from })),
    fc
      .tuple(waypointsArb, fc.double({ min: 0.05, max: 3, noNaN: true }), fc.boolean())
      .chain(([waypoints, duration, linked]) =>
        (linked ? cursorArb(fc.constant(waypoints.length)) : fc.constant(null)).map(
          (cursor): ViewAction => ({ type: "walkStart", waypoints, duration, linked: cursor }),
        ),
      ),
    fc.constantFrom<ViewAction>({ type: "walkPause" }, { type: "walkResume" }),
    poseArb.map((presetPose): ViewAction => ({ type: "walkStop", presetPose })),
    cursorArb().map((cursor): ViewAction => ({ type: "timelineStart", cursor })),
    fc.constantFrom<ViewAction>({ type: "timelinePause" }, { type: "timelineResume" }, { type: "timelineStop" }),
    fc.oneof(idArb, fc.constant(null)).map((id): ViewAction => ({ type: "select", id })),
    fc.constantFrom<ViewAction>({ type: "setGizmoMode", mode: "rotate" }, { type: "setGizmoMode", mode: "scale" }),
    edgeTypeArb.map((edgeType): ViewAction => ({ type: "connectOn", edgeType })),
    fc.constant<ViewAction>({ type: "connectOff" }),
    { arbitrary: fc.oneof(idArb, fc.constant(null)).map((id): ViewAction => ({ type: "connectClick", id })), weight: 3 },
    fc.constantFrom<ViewAction>({ type: "setEditMode", mode: "view" }, { type: "setEditMode", mode: "edit" }),
    fc.constant<ViewAction>({ type: "cameraApplied" }),
    fc
      .tuple(idListArb, idListArb)
      .map(([nodeIds, visibleNodeIds]): ViewAction => ({ type: "modelChanged", nodeIds, visibleNodeIds })),
  );
  return fc.array(action, { maxLength: 40 });
}
