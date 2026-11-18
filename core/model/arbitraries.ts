// Test-only generators shared by the test files in core/model and the schema sensor tests.
// Not matched by the Vitest `include` pattern and imported by no product module.
import fc from "fast-check";
import type { EditCommand, SingleCommand } from "./commands.ts";
import type { JsonObject } from "./json.ts";
import type {
  Condition,
  EdgeFilter,
  EffectRule,
  EffectTarget,
  JudgementResults,
  NodeRule,
  NodeSelector,
  PropagationResult,
  RuleDefinition,
  SeriesSettings,
  Timeline,
} from "./rule-schema.ts";
import type { Scenario } from "./scenario-schema.ts";

export const identifierArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 1 }).filter((s) => s.trim().length >= 1),
  fc.constantFrom(" a", "a ", "A", "a"),
);

export type LocalizedTextValue = { en: string; ja?: string };
export const localizedTextArb: fc.Arbitrary<LocalizedTextValue> = fc.record(
  { en: identifierArb, ja: fc.string() },
  { requiredKeys: ["en"] },
);

type FaceValue = { text?: LocalizedTextValue; image?: string; detail?: LocalizedTextValue };
export const faceArb: fc.Arbitrary<FaceValue> = fc
  .tuple(
    fc.constantFrom("text", "image", "both"),
    localizedTextArb,
    identifierArb,
    fc.option(localizedTextArb, { nil: undefined }),
  )
  .map(([kind, text, image, detail]) => {
    const face: FaceValue = {};
    if (kind !== "image") face.text = text;
    if (kind !== "text") face.image = image;
    if (detail !== undefined) face.detail = detail;
    return face;
  });

const finiteArb = fc.double({ noNaN: true, noDefaultInfinity: true });
const positiveArb = fc.double({ min: Number.MIN_VALUE, noNaN: true, noDefaultInfinity: true });

const attrNameArb = fc.oneof(identifierArb, fc.constantFrom("__proto__", "constructor", "prototype", "w", "W", " w"));
export const attributesArb: fc.Arbitrary<Record<string, number>> = fc
  .uniqueArray(fc.tuple(attrNameArb, finiteArb), { selector: ([k]) => k, maxLength: 5 })
  .map((pairs) => Object.fromEntries(pairs) as Record<string, number>);

export const metadataArb: fc.Arbitrary<JsonObject> = fc.oneof(
  fc.dictionary(fc.string(), fc.jsonValue()).map((d) => Object.fromEntries(Object.entries(d)) as JsonObject),
  fc.constantFrom<JsonObject>({}, Object.fromEntries([["__proto__", 1]]) as JsonObject),
);

const vector3Arb = fc.record({ x: finiteArb, y: finiteArb, z: finiteArb });
const scale3Arb = fc.record({ x: positiveArb, y: positiveArb, z: positiveArb });

function withoutZone<T extends { zone?: string }>(n: T): T {
  const copy = { ...n };
  delete copy.zone;
  return copy;
}

/** A Node with the given id generator; `zoneIds` are the Zone ids a Node may name. */
export function nodeArbWith(idArb: fc.Arbitrary<string>, zoneIds: readonly string[]): fc.Arbitrary<Scenario["nodes"][number]> {
  return fc
    .record(
      {
        id: idArb,
        type: identifierArb,
        position: vector3Arb,
        rotation: vector3Arb,
        scale: scale3Arb,
        front: faceArb,
        back: faceArb,
        zone: zoneIds.length > 0 ? fc.constantFrom(...zoneIds) : fc.constant("none"),
        metadata: metadataArb,
        attributes: attributesArb,
      },
      { requiredKeys: ["id", "type", "position", "rotation", "scale", "front", "metadata", "attributes"] },
    )
    .map((n) => (zoneIds.length > 0 ? n : withoutZone(n)));
}

export const scenarioArb: fc.Arbitrary<Scenario> = fc
  .tuple(
    fc.uniqueArray(identifierArb, { maxLength: 4 }),
    fc.uniqueArray(fc.nat(), { maxLength: 4 }),
    fc.uniqueArray(identifierArb, { maxLength: 8 }),
  )
  .chain(([zoneIds, orders, nodeIds]) => {
    const zoneCount = Math.min(zoneIds.length, orders.length);
    const zones = fc.tuple(...zoneIds.slice(0, zoneCount).map((id, i) =>
      fc.record({ id: fc.constant(id), label: localizedTextArb, order: fc.constant(orders[i] ?? 0), elevation: finiteArb, enclosed: fc.boolean() }),
    ));
    const usableZones = zoneIds.slice(0, zoneCount);
    const edgeArb =
      nodeIds.length > 0
        ? fc.array(
            fc.record(
              { from: fc.constantFrom(...nodeIds), to: fc.constantFrom(...nodeIds), type: identifierArb, label: localizedTextArb },
              { requiredKeys: ["from", "to", "type"] },
            ),
            { maxLength: 8 },
          )
        : fc.constant([]);
    return fc
      .tuple(
        zones.map((z) => z),
        fc.tuple(...nodeIds.map((id) => nodeArbWith(fc.constant(id), usableZones))),
        edgeArb,
        fc.uniqueArray(identifierArb, { minLength: 8, maxLength: 8 }),
        fc.oneof(fc.constant(1), fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER })),
        identifierArb,
        localizedTextArb,
      )
      .map(([zs, ns, es, edgeIds, schemaVersion, id, title]) => ({
        schemaVersion,
        id,
        title,
        nodes: ns,
        edges: es.map((e, i) => ({ id: edgeIds[i] ?? "e", ...e })),
        zones: zs,
      }));
  });

/** Extra fields to add at a fixed-shape level. Names start with "x-" or are "__proto__", so they never clash. */
export const extraFieldsArb: fc.Arbitrary<Record<string, unknown>> = fc
  .array(
    fc.tuple(
      fc.oneof(
        fc.string().map((s) => `x-${s}`),
        fc.constant("__proto__"),
      ),
      fc.jsonValue(),
    ),
    { minLength: 1, maxLength: 3 },
  )
  .map((pairs) => Object.fromEntries(pairs));

/** Deep equality over own enumerable string keys. `-0` equals `0`; an `undefined` value equals an absent key. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item: unknown, i) => jsonEqual(item, b[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const key of keys) {
    if (!jsonEqual(ra[key], rb[key])) return false;
  }
  return true;
}

function pool(ids: readonly string[]): fc.Arbitrary<string> {
  return ids.length > 0 ? fc.oneof(fc.constantFrom(...ids), identifierArb) : identifierArb;
}

/** Subset of the fields of `shape`: each key present or absent. */
function someOf<T extends Record<string, fc.Arbitrary<unknown>>>(shape: T) {
  return fc.record(shape, { requiredKeys: [] });
}

/** Any single (non-batch) Edit_Command. Ids come from `s` or are fresh, so some commands are rejected. */
export function singleCommandArb(s: Scenario): fc.Arbitrary<SingleCommand> {
  const nodeIds = s.nodes.map((n) => n.id);
  const edgeIds = s.edges.map((e) => e.id);
  const zoneIds = s.zones.map((z) => z.id);
  const zoneRef = pool(zoneIds);
  const nullable = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T | null> => fc.oneof(arb, fc.constant(null));
  const edge = fc.record(
    { id: pool(edgeIds), from: pool(nodeIds), to: pool(nodeIds), type: identifierArb, label: localizedTextArb },
    { requiredKeys: ["id", "from", "to", "type"] },
  );
  const zone = fc.record({
    id: pool(zoneIds),
    label: localizedTextArb,
    order: fc.nat({ max: 6 }),
    elevation: finiteArb,
    enclosed: fc.boolean(),
  });
  return fc.oneof(
    fc.record({ kind: fc.constant("addNode" as const), node: nodeArbWith(pool(nodeIds), zoneIds) }),
    fc.record({ kind: fc.constant("removeNode" as const), id: pool(nodeIds) }),
    fc.record({
      kind: fc.constant("updateNode" as const),
      id: pool(nodeIds),
      changes: someOf({
        type: identifierArb,
        position: vector3Arb,
        rotation: vector3Arb,
        scale: scale3Arb,
        front: faceArb,
        back: nullable(faceArb),
        metadata: metadataArb,
        attributes: attributesArb,
        zone: nullable(zoneRef),
      }),
    }),
    fc.record({ kind: fc.constant("addEdge" as const), edge }),
    fc.record({ kind: fc.constant("removeEdge" as const), id: pool(edgeIds) }),
    fc.record({
      kind: fc.constant("updateEdge" as const),
      id: pool(edgeIds),
      changes: someOf({ type: identifierArb, label: nullable(localizedTextArb) }),
    }),
    fc.record({ kind: fc.constant("addZone" as const), zone }),
    fc.record({ kind: fc.constant("removeZone" as const), id: zoneRef }),
    fc.record({
      kind: fc.constant("updateZone" as const),
      id: zoneRef,
      changes: someOf({ label: localizedTextArb, order: fc.nat({ max: 6 }), elevation: finiteArb, enclosed: fc.boolean() }),
    }),
  );
}

/** Any Edit_Command, including batches of 0 to 4 commands that sometimes hold a nested batch. */
export function commandArb(s: Scenario): fc.Arbitrary<EditCommand> {
  const single = singleCommandArb(s);
  const inner = fc.oneof({ weight: 5, arbitrary: single }, { weight: 1, arbitrary: fc.record({ kind: fc.constant("batch" as const), commands: fc.array(single, { maxLength: 2 }) }) });
  return fc.oneof(
    { weight: 4, arbitrary: single },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant("batch" as const), commands: fc.array(inner, { maxLength: 4 }) }) },
  ) as fc.Arbitrary<EditCommand>;
}

export const limitArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 20 });
export const badLimitArb: fc.Arbitrary<unknown> = fc.constantFrom(0, -1, 1.5, NaN, Infinity, "3", null);

// ---------------------------------------------------------------------------
// core-rules generators
// ---------------------------------------------------------------------------

/** Type names that often overlap between Scenarios and Rule_Definitions, and sometimes differ by case or whitespace. */
export const typePoolArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom("t1", "t2", "t3", "T1", " t1") },
  { weight: 1, arbitrary: identifierArb },
);

/** Attribute names. "__proto__" is only ever defined with Object.fromEntries (own data property). */
export const attrPool: readonly string[] = ["v", "w", "__proto__"];

const attrValueArb = fc.integer({ min: -1000, max: 1000 });

const poolAttributesArb: fc.Arbitrary<Record<string, number>> = fc
  .tuple(fc.subarray([...attrPool]), fc.array(attrValueArb, { minLength: 3, maxLength: 3 }))
  .map(([names, values]) => Object.fromEntries(names.map((name, i) => [name, values[i] ?? 0])) as Record<string, number>);

/** `scenarioArb` with Node and Edge types from `typePoolArb` and integer attributes from `attrPool`. */
export const ruleScenarioArb: fc.Arbitrary<Scenario> = scenarioArb.chain((s) =>
  fc
    .tuple(
      fc.array(typePoolArb, { minLength: s.nodes.length, maxLength: s.nodes.length }),
      fc.array(poolAttributesArb, { minLength: s.nodes.length, maxLength: s.nodes.length }),
      fc.array(typePoolArb, { minLength: s.edges.length, maxLength: s.edges.length }),
    )
    .map(([nodeTypes, attrs, edgeTypes]) => ({
      ...s,
      nodes: s.nodes.map((n, i) => ({ ...n, type: nodeTypes[i] ?? "t1", attributes: attrs[i] ?? {} })),
      edges: s.edges.map((e, i) => ({ ...e, type: edgeTypes[i] ?? "t1" })),
    })),
);

/** A Node_Selector. Lists may be empty and may name missing ids; `self: true` only when `opts.self` is true. */
export function selectorArb(s: Scenario, opts: { self: boolean }): fc.Arbitrary<NodeSelector> {
  const shape: Record<string, fc.Arbitrary<unknown>> = {
    ids: fc.array(pool(s.nodes.map((n) => n.id)), { maxLength: 4 }),
    types: fc.array(typePoolArb, { maxLength: 3 }),
    zones: fc.array(pool(s.zones.map((z) => z.id)), { maxLength: 3 }),
  };
  if (opts.self) shape["self"] = fc.constant(true);
  return fc.record(shape, { requiredKeys: [] });
}

/** An Edge_Filter: optional `include` and `exclude` from the type pool (the empty `include` is possible). */
export const edgeFilterArb: fc.Arbitrary<EdgeFilter> = fc.record(
  { include: fc.array(typePoolArb, { maxLength: 3 }), exclude: fc.array(typePoolArb, { maxLength: 3 }) },
  { requiredKeys: [] },
);

/** `min`/`max` with at least one bound and min <= max. */
function rangeArb(lo: number, hi: number): fc.Arbitrary<{ min?: number; max?: number }> {
  const n = fc.integer({ min: lo, max: hi });
  return fc.oneof(
    n.map((min) => ({ min })),
    n.map((max) => ({ max })),
    fc.tuple(n, n).map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) })),
  );
}

/** A Condition nested up to `maxDepth` combinators (default 4). `maxDepth` 0 gives a leaf only. */
export function conditionArb(s: Scenario, opts: { self: boolean; maxDepth?: number }): fc.Arbitrary<Condition> {
  const maxDepth = opts.maxDepth ?? 4;
  const selector = selectorArb(s, { self: opts.self });
  const { cond } = fc.letrec<{ leaf: Condition; cond: Condition }>((tie) => {
    const edgeCount = fc
      .tuple(edgeFilterArb, selector, selector, rangeArb(0, 4))
      .map(([edges, from, to, range]) => ({ kind: "edgeCount" as const, edges, from, to, ...range }));
    const reach = fc
      .tuple(selector, selector, edgeFilterArb)
      .map(([from, to, edges]) => ({ kind: "reach" as const, from, to, edges }));
    const attribute = fc
      .tuple(selector, fc.constantFrom(...attrPool), rangeArb(-2000, 2000))
      .map(([nodes, attr, range]) => ({ kind: "attribute" as const, nodes, attribute: attr, ...range }));
    const list = fc.array(tie("cond"), { maxLength: 3 });
    return {
      leaf: fc.oneof(edgeCount, reach, attribute),
      cond: fc.oneof(
        { maxDepth, depthIdentifier: "condition" },
        tie("leaf"),
        list.map((conditions) => ({ kind: "all" as const, conditions })),
        list.map((conditions) => ({ kind: "any" as const, conditions })),
        tie("cond").map((condition) => ({ kind: "not" as const, condition })),
      ),
    };
  });
  return cond;
}

/** A valid Rule_Definition for `s`. Ids in one list are unique; `pass` and `stop` are disjoint. */
export function ruleDefinitionArb(s: Scenario): fc.Arbitrary<RuleDefinition> {
  const plain = conditionArb(s, { self: false });
  const withSelf = conditionArb(s, { self: true });
  const candidate = selectorArb(s, { self: false });
  const policy = fc
    .tuple(fc.uniqueArray(typePoolArb, { maxLength: 4 }), fc.nat(4))
    .map(([types, k]) => ({ pass: types.slice(0, k), stop: types.slice(k) }));
  const checkSets = fc.array(fc.array(plain, { maxLength: 4 }), { maxLength: 3 }).map((sets) =>
    sets.map((items, i) => ({ id: `cs${i}`, items: items.map((condition, j) => ({ id: `ci${j}`, condition })) })),
  );
  const nodeRules = fc
    .array(fc.tuple(candidate, withSelf), { maxLength: 3 })
    .map((rules): NodeRule[] => rules.map(([nodes, condition], i) => ({ id: `nr${i}`, nodes, condition })));
  return fc
    .tuple(
      fc.oneof(fc.constant(1), fc.integer({ min: 1, max: 1000 })),
      identifierArb,
      policy,
      checkSets,
      nodeRules,
    )
    .chain(([schemaVersion, id, propagation, sets, rules]) => {
      const sources: fc.Arbitrary<EffectRule["source"]>[] = [
        fc.constantFrom(...attrPool).map((attribute) => ({ kind: "shifts" as const, attribute })),
        fc.constantFrom(...attrPool).map((attribute) => ({ kind: "longRuns" as const, attribute })),
        fc.constant({ kind: "propagation" as const }),
      ];
      if (rules.length > 0) {
        sources.push(fc.constantFrom(...rules.map((r) => r.id)).map((rid) => ({ kind: "nodeRule" as const, id: rid })));
      }
      return fc
        .array(fc.tuple(identifierArb, fc.oneof(...sources)), { maxLength: 4 })
        .map((list): EffectRule[] => list.map(([effect, source], i) => ({ id: `er${i}`, effect, source })))
        .map((effectRules) => ({ schemaVersion, id, propagation, checkSets: sets, nodeRules: rules, effectRules }));
    });
}

export function maxStepsArb(s: Scenario): fc.Arbitrary<number | undefined> {
  return fc.option(fc.integer({ min: 0, max: s.nodes.length }), { nil: undefined });
}

/** Series_Settings: every field given, thresholds are small integers. */
export const seriesSettingsArb: fc.Arbitrary<SeriesSettings> = fc.record({
  attribute: fc.constantFrom(...attrPool),
  zoneValue: fc.constantFrom("sum" as const, "mean" as const),
  shiftThreshold: fc.integer({ min: 0, max: 20 }),
  direction: fc.constantFrom("up" as const, "down" as const, "both" as const),
  runTolerance: fc.integer({ min: 0, max: 20 }),
  minRunLength: fc.integer({ min: 2, max: 5 }),
});

/**
 * 0 to 6 Zones with distinct `order`. Every Node of one Zone holds the same integer value of each `attrPool`
 * attribute the Zone holds, so every `mean` is an exact integer. Some Zones hold no Node or no value.
 */
export const flatZoneScenarioArb: fc.Arbitrary<Scenario> = fc
  .uniqueArray(fc.nat({ max: 30 }), { maxLength: 6 })
  .chain((orders) => {
    const zones = orders.map((order, i) => ({
      id: `z${i}`,
      label: { en: `Zone ${i}` },
      order,
      elevation: 0,
      enclosed: false,
    }));
    const zoneArb = fc.tuple(
      fc.nat({ max: 3 }),
      fc.array(fc.option(attrValueArb, { nil: undefined }), { minLength: attrPool.length, maxLength: attrPool.length }),
    );
    return fc.tuple(...zones.map(() => zoneArb)).map((perZone): Scenario => {
      const nodes: Scenario["nodes"] = [];
      perZone.forEach(([count, values], zi) => {
        const attributes = Object.fromEntries(
          attrPool.flatMap((name, ai) => (values[ai] === undefined ? [] : [[name, values[ai]]])),
        ) as Record<string, number>;
        for (let k = 0; k < count; k++) {
          nodes.push({
            id: `n${zi}_${k}`,
            type: "t1",
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            front: { text: { en: "n" } },
            zone: `z${zi}`,
            metadata: {},
            attributes: { ...attributes },
          });
        }
      });
      return { schemaVersion: 1, id: "flat", title: { en: "Flat" }, nodes, edges: [], zones };
    });
  });

/** Intentional marks: Zone ids of `s` (with repeats) plus missing ids. */
export function marksArb(s: Scenario): fc.Arbitrary<string[]> {
  return fc.array(pool(s.zones.map((z) => z.id)), { maxLength: 8 });
}

/**
 * Judgement results for `s`: Node_Rule_Results, Series_Results, and a Propagation_Result, each present or absent.
 * Ids come from `s` (or from the generated rule ids `nr0`..`nr3`, and `attrPool` for attributes) or from
 * `identifierArb`, so some name no element. Every `reached.step` is at most `reached.length - 1`.
 */
export function judgementResultsArb(s: Scenario): fc.Arbitrary<JudgementResults> {
  const nodeId = pool(s.nodes.map((n) => n.id));
  const edgeId = pool(s.edges.map((e) => e.id));
  const zoneId = pool(s.zones.map((z) => z.id));
  const ids = (item: fc.Arbitrary<string>) => fc.array(item, { maxLength: 4 });
  const nodeRuleResult = fc.record({
    id: fc.oneof(fc.constantFrom("nr0", "nr1", "nr2", "nr3"), identifierArb),
    nodes: ids(nodeId),
    unresolved: ids(identifierArb),
  });
  const seriesResult = fc.record({
    attribute: fc.oneof(fc.constantFrom(...attrPool), identifierArb),
    series: fc.array(fc.record({ zone: zoneId, value: finiteArb }), { maxLength: 4 }),
    changes: fc.array(fc.record({ from: zoneId, to: zoneId, change: finiteArb }), { maxLength: 4 }),
    shifts: fc.array(fc.record({ from: zoneId, to: zoneId, change: finiteArb, intentional: fc.boolean() }), { maxLength: 4 }),
    longRuns: fc.array(ids(zoneId), { maxLength: 3 }),
    unresolved: ids(identifierArb),
  });
  const propagationResult = fc
    .array(fc.tuple(nodeId, fc.nat(), fc.option(edgeId, { nil: undefined })), { maxLength: 6 })
    .chain((entries) => {
      const reached = entries.map(([node, step, via]) => ({
        node,
        step: step % entries.length,
        ...(via === undefined ? {} : { via }),
      }));
      return fc.record({
        reached: fc.constant(reached),
        traversed: ids(edgeId),
        stopped: ids(edgeId),
        unresolved: ids(identifierArb),
      });
    });
  return fc.record(
    {
      nodeRules: fc.array(nodeRuleResult, { maxLength: 3 }),
      series: fc.array(seriesResult, { maxLength: 3 }),
      propagation: propagationResult,
    },
    { requiredKeys: [] },
  );
}

/**
 * A Propagation_Result of 1 to 6 reached Nodes, each Node exactly once, every `step` at most `reached.length - 1`.
 * Node ids come from `s` (when it has enough) or from `identifierArb`. Valid for `timelineFromPropagation`.
 */
export function uniquePropagationArb(s: Scenario): fc.Arbitrary<PropagationResult> {
  const nodeId = pool(s.nodes.map((n) => n.id));
  const edgeId = pool(s.edges.map((e) => e.id));
  return fc
    .uniqueArray(nodeId, { minLength: 1, maxLength: 6 })
    .chain((nodes) =>
      fc.record({
        reached: fc.tuple(
          ...nodes.map((node) =>
            fc.record(
              { node: fc.constant(node), step: fc.nat({ max: nodes.length - 1 }), via: edgeId },
              { requiredKeys: ["node", "step"] },
            ),
          ),
        ),
        traversed: fc.array(edgeId, { maxLength: 4 }),
        stopped: fc.array(edgeId, { maxLength: 4 }),
        unresolved: fc.array(identifierArb, { maxLength: 4 }),
      }),
    );
}

const effectTargetArb: fc.Arbitrary<EffectTarget> = fc.record({
  kind: fc.constantFrom("node" as const, "edge" as const, "zone" as const),
  id: identifierArb,
});

/** 1 to 6 Timeline_Steps with unique ids, random targets, and Effect_Requests that repeat across steps. */
export const timelineArb: fc.Arbitrary<Timeline> = fc
  .array(
    fc.record({ effect: identifierArb, target: effectTargetArb, source: identifierArb }),
    { minLength: 1, maxLength: 4 },
  )
  .chain((effectPool) =>
    fc.uniqueArray(identifierArb, { minLength: 1, maxLength: 6 }).chain((ids) =>
      fc.tuple(
        ...ids.map((id) =>
          fc.record(
            {
              id: fc.constant(id),
              label: localizedTextArb,
              targets: fc.array(effectTargetArb, { maxLength: 3 }),
              effects: fc.array(fc.constantFrom(...effectPool), { maxLength: 4 }),
            },
            { requiredKeys: ["id", "targets", "effects"] },
          ),
        ),
      ),
    ),
  )
  .map((steps) => ({ steps }));

export type CursorMove = { kind: "next" } | { kind: "previous" } | { kind: "seek"; position: number };

/** Up to 20 cursor moves for a Timeline of `n` steps (`n >= 1`); every `seek` position is in range. */
export function cursorMovesArb(n: number): fc.Arbitrary<CursorMove[]> {
  return fc.array(
    fc.oneof(
      fc.constant<CursorMove>({ kind: "next" }),
      fc.constant<CursorMove>({ kind: "previous" }),
      fc.nat(Math.max(n - 1, 0)).map((position): CursorMove => ({ kind: "seek", position })),
    ),
    { maxLength: 20 },
  );
}

type PathPart = string | number;

function conditionPaths(c: unknown, base: PathPart[], out: PathPart[][]): void {
  if (typeof c !== "object" || c === null) return;
  const cond = c as Record<string, unknown>;
  const required: string[] =
    cond["kind"] === "edgeCount" ? ["edges", "from", "to"]
    : cond["kind"] === "reach" ? ["from", "to", "edges"]
    : cond["kind"] === "attribute" ? ["nodes", "attribute"]
    : cond["kind"] === "not" ? ["condition"]
    : ["conditions"];
  for (const key of required) out.push([...base, key]);
  if (Array.isArray(cond["conditions"])) {
    cond["conditions"].forEach((child, i) => conditionPaths(child, [...base, "conditions", i], out));
  }
  if (cond["kind"] === "not") conditionPaths(cond["condition"], [...base, "condition"], out);
}

/** Paths of the required fields of `def` (the discriminator `kind` fields are left out). */
function requiredPaths(def: RuleDefinition): PathPart[][] {
  const out: PathPart[][] = [["schemaVersion"], ["id"], ["propagation"], ["propagation", "pass"], ["propagation", "stop"]];
  (def.checkSets ?? []).forEach((set, i) => {
    out.push(["checkSets", i, "id"], ["checkSets", i, "items"]);
    set.items.forEach((item, j) => {
      const base: PathPart[] = ["checkSets", i, "items", j];
      out.push([...base, "id"], [...base, "condition"]);
      conditionPaths(item.condition, [...base, "condition"], out);
    });
  });
  (def.nodeRules ?? []).forEach((rule, i) => {
    const base: PathPart[] = ["nodeRules", i];
    out.push([...base, "id"], [...base, "nodes"], [...base, "condition"]);
    conditionPaths(rule.condition, [...base, "condition"], out);
  });
  (def.effectRules ?? []).forEach((_rule, i) => {
    out.push(["effectRules", i, "id"], ["effectRules", i, "effect"], ["effectRules", i, "source"]);
  });
  return out;
}

/** Removes one required field of `def`, or replaces it with `null`. Reports the Field_Path of that field. */
export function ruleMutationArb(def: RuleDefinition): fc.Arbitrary<{ value: unknown; path: string }> {
  return fc.tuple(fc.constantFrom(...requiredPaths(def)), fc.boolean()).map(([parts, remove]) => {
    const value = structuredClone(def) as Record<PathPart, unknown>;
    let holder: Record<PathPart, unknown> = value;
    for (const part of parts.slice(0, -1)) holder = holder[part] as Record<PathPart, unknown>;
    const last = parts[parts.length - 1] ?? "";
    if (remove) delete holder[last];
    else holder[last] = null;
    return { value, path: parts.join(".") };
  });
}

/** A chain of `n` nested `not` Conditions, built in a loop (no recursion). */
export function deepNot(n: number): Condition {
  let c: Condition = { kind: "all", conditions: [] };
  for (let i = 0; i < n; i++) c = { kind: "not", condition: c };
  return c;
}

/** An `all` Condition whose `conditions` list holds the Condition itself. */
export function selfContaining(): Condition {
  const conditions: Condition[] = [];
  const c: Condition = { kind: "all", conditions };
  conditions.push(c);
  return c;
}
