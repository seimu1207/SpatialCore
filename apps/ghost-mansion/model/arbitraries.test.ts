import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateScenario } from "../../../core/model/scenario-schema.ts";
import {
  actionLogArb,
  fixStepsArb,
  orderRulesArb,
  phaseActionsArb,
  scorePointArb,
  starTableArb,
  variantArb,
} from "./arbitraries.ts";
import { orderRulesSchema, starTableSchema } from "./game-data.ts";

describe("generator sanity", () => {
  it("100 variants all pass validateScenario", () => {
    fc.assert(
      fc.property(variantArb, (s) => validateScenario(s).ok),
      { numRuns: 100 },
    );
  });

  it("100 starTableArb values pass starTableSchema", () => {
    fc.assert(
      fc.property(starTableArb, (t) => starTableSchema.safeParse(t).success),
      { numRuns: 100 },
    );
  });

  it("the other generators stay inside their ranges", () => {
    fc.assert(
      fc.property(scorePointArb, actionLogArb, orderRulesArb, phaseActionsArb, fixStepsArb, (p, log, rules, acts, steps) => {
        expect(p.c).toBeGreaterThanOrEqual(0);
        expect(p.c).toBeLessThanOrEqual(6);
        expect(p.d).toBeGreaterThanOrEqual(0);
        expect(p.d).toBeLessThanOrEqual(11);
        expect(log.length).toBeLessThanOrEqual(10);
        expect(rules.length).toBeLessThanOrEqual(4);
        expect(orderRulesSchema.safeParse(rules).success).toBe(true);
        expect(acts.length).toBeLessThanOrEqual(30);
        expect(steps.length).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 },
    );
  });
});
