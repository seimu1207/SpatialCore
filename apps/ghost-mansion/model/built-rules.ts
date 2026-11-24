import { loadRuleDefinition } from "../../../core/model/rule-schema.ts";
import type { CheckSet, Condition, RuleDefinition, RuleOutcome } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import type { AttackCard } from "./game-data.ts";
import { CHECK_SET_IDS, EDGE_TYPES, KEY_EDGE_TYPES, NODE_TYPES, RESPONSE_OPS, ROBOT_ID, ATTRIBUTES } from "./names.ts";


/** Adds `set` to the Check_Sets of `rules` and validates the result. Never throws. */
export function withCheckSet(rules: RuleDefinition, set: CheckSet): RuleOutcome<RuleDefinition> {
  return loadRuleDefinition({ ...rules, checkSets: [...(rules.checkSets ?? []), set] });
}

/** One item per Precondition, same id and order. `label` and `highlight` stay in the Attack_Card. */
export function attackCheckSet(card: Pick<AttackCard, "preconditions">): CheckSet {
  return {
    id: CHECK_SET_IDS.attack,
    items: card.preconditions.map((p) => ({ id: p.id, condition: p.check })),
  };
}

/** The three Response_Operation checks, with the Key_Edge count of `nightStart` as the cut-key bound. */
export function responseCheckSet(nightStart: Scenario): CheckSet {
  const keyTypes: readonly string[] = KEY_EDGE_TYPES;
  const n = nightStart.edges.filter((e) => e.from === ROBOT_ID && keyTypes.includes(e.type)).length;

  const cutKey: Condition =
    n === 0
      ? { kind: "any", conditions: [] }
      : {
          kind: "edgeCount",
          edges: { include: [...KEY_EDGE_TYPES] },
          from: { ids: [ROBOT_ID] },
          to: {},
          max: n - 1,
        };

  return {
    id: CHECK_SET_IDS.response,
    items: [
      {
        id: RESPONSE_OPS.stopRobot,
        condition: { kind: "attribute", nodes: { ids: [ROBOT_ID] }, attribute: ATTRIBUTES.stopped, min: 1 },
      },
      { id: RESPONSE_OPS.cutKey, condition: cutKey },
      {
        id: RESPONSE_OPS.consult,
        condition: {
          kind: "edgeCount",
          edges: { include: [EDGE_TYPES.consult] },
          from: {},
          to: { types: [NODE_TYPES.helper] },
          min: 1,
        },
      },
    ],
  };
}
