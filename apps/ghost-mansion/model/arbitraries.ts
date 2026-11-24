// Test support only: generators of mansion variants and game inputs (design.md "Generators").
// Imported only by *.test.ts files.
import fc from "fast-check";
import { applyCommand } from "../../../core/model/commands.ts";
import type { EditCommand } from "../../../core/model/commands.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { BUNDLED } from "./bundled.ts";
import { dontReadCommand, isKeyEdge, keyChoiceCommand, stopRobotCommand } from "./commands.ts";
import type { KeyChoice } from "./commands.ts";
import { loadGameData } from "./game-data.ts";
import type { OrderRule, StarTable } from "./game-data.ts";
import { EDGE_TYPES, RESPONSE_OPS } from "./names.ts";
import type { PhaseAction } from "./phase.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");

/** The bundled Preset_Mansion, the base of every variant. */
export const PRESET: Scenario = loaded.data.preset;
/** The bundled Star_Table. */
export const BUNDLED_STAR_TABLE: StarTable = loaded.data.starTable;

const KEY_EDGE_IDS: readonly string[] = PRESET.edges.filter(isKeyEdge).map((e) => e.id);
const NODE_IDS: readonly string[] = PRESET.nodes.map((n) => n.id);

const RESPONSE_OP_IDS = [RESPONSE_OPS.stopRobot, RESPONSE_OPS.cutKey, RESPONSE_OPS.consult] as const;

const keyChoiceArb: fc.Arbitrary<KeyChoice | null> = fc.constantFrom<KeyChoice | null>("plain", "bell", "none", null);
const nodeIdArb = fc.constantFrom(...NODE_IDS);
const coordArb = fc.double({ min: -20, max: 20, noNaN: true });
const angleArb = fc.double({ min: -Math.PI, max: Math.PI, noNaN: true });
const scaleArb = fc.double({ min: 0.1, max: 3, noNaN: true });

const positionArb = fc.record({ x: coordArb, y: coordArb, z: coordArb });
const rotationArb = fc.record({ x: angleArb, y: angleArb, z: angleArb });
const scale3Arb = fc.record({ x: scaleArb, y: scaleArb, z: scaleArb });

const transformArb = fc.record({
  node: nodeIdArb,
  position: fc.option(positionArb, { nil: undefined }),
  rotation: fc.option(rotationArb, { nil: undefined }),
  scale: fc.option(scale3Arb, { nil: undefined }),
});

const variantPlanArb = fc.record({
  keys: fc.record(Object.fromEntries(KEY_EDGE_IDS.map((id) => [id, keyChoiceArb])) as Record<string, fc.Arbitrary<KeyChoice | null>>),
  dontRead: fc.boolean(),
  stop: fc.boolean(),
  cite: fc.boolean(),
  wrongWayCite: fc.boolean(),
  wrongTypeCite: fc.boolean(),
  consults: fc.array(fc.record({ from: nodeIdArb, to: nodeIdArb }), { minLength: 0, maxLength: 3 }),
  transforms: fc.array(transformArb, { minLength: 0, maxLength: 6 }),
});

type Vec3 = { x: number; y: number; z: number };
type VariantPlan = {
  keys: Record<string, KeyChoice | null>;
  dontRead: boolean;
  stop: boolean;
  cite: boolean;
  wrongWayCite: boolean;
  wrongTypeCite: boolean;
  consults: { from: string; to: string }[];
  transforms: { node: string; position: Vec3 | undefined; rotation: Vec3 | undefined; scale: Vec3 | undefined }[];
};

function applyAll(base: Scenario, commands: readonly (EditCommand | null)[]): Scenario {
  let current = base;
  for (const command of commands) {
    if (command === null) continue;
    const result = applyCommand(current, command);
    if (result.ok) current = result.scenario;
  }
  return current;
}

function buildVariant(plan: VariantPlan): Scenario {
  let s = PRESET;
  const step = (command: EditCommand | null): void => {
    s = applyAll(s, [command]);
  };
  for (const id of KEY_EDGE_IDS) {
    const choice = plan.keys[id];
    if (choice !== null && choice !== undefined) step(keyChoiceCommand(s, id, choice));
  }
  if (plan.dontRead) step(dontReadCommand(s, "page"));
  if (plan.stop) step(stopRobotCommand(s));
  const cite = (id: string, from: string, to: string): void =>
    step({ kind: "addEdge", edge: { id, from, to, type: EDGE_TYPES.cites } });
  if (plan.cite) cite("cite-ok", "answer", "textbook");
  if (plan.wrongWayCite) cite("cite-wrong-way", "textbook", "answer");
  if (plan.wrongTypeCite) cite("cite-wrong-type", "answer", "parent");
  plan.consults.forEach((c, i) =>
    step({ kind: "addEdge", edge: { id: `consult-${i}`, from: c.from, to: c.to, type: EDGE_TYPES.consult } }),
  );
  for (const t of plan.transforms) {
    const changes = {
      ...(t.position === undefined ? {} : { position: t.position }),
      ...(t.rotation === undefined ? {} : { rotation: t.rotation }),
      ...(t.scale === undefined ? {} : { scale: t.scale }),
    };
    if (Object.keys(changes).length > 0) step({ kind: "updateNode", id: t.node, changes });
  }
  return s;
}

/** Mansion variants derived from the Preset_Mansion with `applyCommand`. Every output passes `validateScenario`. */
export const variantArb: fc.Arbitrary<Scenario> = (variantPlanArb as fc.Arbitrary<VariantPlan>).map(buildVariant);

/** A Score_Point `{ c, d }`: integers and doubles in 0..6 and 0..11. */
export const scorePointArb: fc.Arbitrary<{ c: number; d: number }> = fc.oneof(
  fc.record({ c: fc.integer({ min: 0, max: 6 }), d: fc.integer({ min: 0, max: 11 }) }),
  fc.record({
    c: fc.double({ min: 0, max: 6, noNaN: true }),
    d: fc.double({ min: 0, max: 11, noNaN: true }),
  }),
);

const generatedStarTableArb: fc.Arbitrary<StarTable> = fc
  .record({
    top: fc.record({ minConvenience: fc.integer({ min: 1, max: 6 }), maxDamage: fc.integer({ min: 0, max: 11 }) }),
    second: fc.option(
      fc.record({ convenienceDrop: fc.integer({ min: 0, max: 5 }), damageRise: fc.integer({ min: 0, max: 11 }) }),
      { nil: undefined },
    ),
  })
  .map(({ top, second }) => {
    const rules: StarTable["rules"] = [{ stars: 3, ...top }];
    if (second !== undefined) {
      rules.push({
        stars: 2,
        minConvenience: Math.max(0, top.minConvenience - second.convenienceDrop),
        maxDamage: top.maxDamage + second.damageRise,
      });
    }
    return { defaultStars: 1 as const, rules };
  });

/** Valid Star_Tables (1 to 2 rules, strictly decreasing stars, first `minConvenience` at least 1), and the bundled one. */
export const starTableArb: fc.Arbitrary<StarTable> = fc.oneof(generatedStarTableArb, fc.constant(BUNDLED_STAR_TABLE));

/** 0 to 10 Response_Operation ids, with repeats. */
export const actionLogArb: fc.Arbitrary<string[]> = fc.array(fc.constantFrom<string>(...RESPONSE_OP_IDS), {
  minLength: 0,
  maxLength: 10,
});

/** 0 to 4 Order_Rules, each with two different ids. */
export const orderRulesArb: fc.Arbitrary<OrderRule[]> = fc.array(
  fc
    .tuple(fc.constantFrom(...RESPONSE_OP_IDS), fc.constantFrom(...RESPONSE_OP_IDS))
    .filter(([a, b]) => a !== b)
    .map(([before, after]): OrderRule => ({ before, after })),
  { minLength: 0, maxLength: 4 },
);

/** 0 to 30 Phase actions of every type, `damageEmpty` random. */
const phaseActionChoices: fc.Arbitrary<PhaseAction>[] = [
  fc.constant<PhaseAction>({ type: "toPrepare" }),
  fc.constant<PhaseAction>({ type: "startNight" }),
  fc.boolean().map((damageEmpty): PhaseAction => ({ type: "nightEnded", damageEmpty })),
  fc.constant<PhaseAction>({ type: "toLookBack" }),
  fc.constant<PhaseAction>({ type: "retry" }),
];
export const phaseActionsArb: fc.Arbitrary<PhaseAction[]> = fc.array(fc.oneof(...phaseActionChoices), {
  minLength: 0,
  maxLength: 30,
});

/** One Fix_It step. `consult` names a fresh Edge id and the Node it goes to. */
export type FixStep =
  | { type: "stopRobot" }
  | { type: "cutKey"; edgeId: string }
  | { type: "consult"; edgeId: string; from: string; to: string }
  | { type: "move"; node: string; position: { x: number; y: number; z: number } }
  | { type: "rotate"; node: string; rotation: { x: number; y: number; z: number } }
  | { type: "scale"; node: string; scale: { x: number; y: number; z: number } }
  | { type: "undo" }
  | { type: "redo" };

/** 0 to 100 Fix_It steps; `consult` edge ids are fresh (`fix-consult-<index>`). */
const fixStepChoices: fc.Arbitrary<FixStep>[] = [
  fc.constant<FixStep>({ type: "stopRobot" }),
  fc.constantFrom(...KEY_EDGE_IDS).map((edgeId): FixStep => ({ type: "cutKey", edgeId })),
  fc
    .record({ from: nodeIdArb, to: nodeIdArb })
    .map(({ from, to }): FixStep => ({ type: "consult", edgeId: "", from, to })),
  fc.record({ node: nodeIdArb, position: positionArb }).map((r): FixStep => ({ type: "move", ...r })),
  fc.record({ node: nodeIdArb, rotation: rotationArb }).map((r): FixStep => ({ type: "rotate", ...r })),
  fc.record({ node: nodeIdArb, scale: scale3Arb }).map((r): FixStep => ({ type: "scale", ...r })),
  fc.constant<FixStep>({ type: "undo" }),
  fc.constant<FixStep>({ type: "redo" }),
];
export const fixStepsArb: fc.Arbitrary<FixStep[]> = fc
  .array(fc.oneof(...fixStepChoices), { minLength: 0, maxLength: 100 })
  .map((steps) =>
    steps.map((step, i): FixStep => (step.type === "consult" ? { ...step, edgeId: `fix-consult-${i}` } : step)),
  );
