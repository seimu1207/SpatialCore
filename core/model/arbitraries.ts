// Test-only generators shared by the test files in core/model and the schema sensor tests.
// Not matched by the Vitest `include` pattern and imported by no product module.
import fc from "fast-check";
import type { EditCommand, SingleCommand } from "./commands.ts";
import type { JsonObject } from "./json.ts";
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