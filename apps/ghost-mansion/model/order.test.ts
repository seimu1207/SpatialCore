import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { OrderRule } from "./game-data.ts";
import { RESPONSE_OPS } from "./names.ts";
import { checkOrder, type OrderResult } from "./order.ts";

const OPS = [RESPONSE_OPS.stopRobot, RESPONSE_OPS.cutKey, RESPONSE_OPS.consult] as const;
const opArb = fc.constantFrom(...OPS);
const logArb = fc.array(opArb, { maxLength: 12 });
const rulesArb = fc
  .array(fc.tuple(opArb, opArb).filter(([a, b]) => a !== b), { maxLength: 6 })
  .map((pairs): OrderRule[] => pairs.map(([before, after]) => ({ before, after })));

// Reference of R-APP1-17.2, written without indexOf: scan the log once.
function reference(log: readonly string[], rules: readonly OrderRule[]): OrderResult[] {
  return rules.map((rule) => {
    let firstA = Infinity;
    let firstB = Infinity;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i] === rule.before) firstA = i;
      if (log[i] === rule.after) firstB = i;
    }
    if (firstB === Infinity) return "notApplicable";
    return firstA < firstB ? "met" : "notMet";
  });
}

describe("order check", () => {
  it("returns met, notMet, notApplicable for simple examples", () => {
    const rules = [{ before: RESPONSE_OPS.stopRobot, after: RESPONSE_OPS.cutKey }] as OrderRule[];
    expect(checkOrder([RESPONSE_OPS.stopRobot, RESPONSE_OPS.cutKey], rules)).toEqual(["met"]);
    expect(checkOrder([RESPONSE_OPS.cutKey, RESPONSE_OPS.stopRobot], rules)).toEqual(["notMet"]);
    expect(checkOrder([RESPONSE_OPS.cutKey], rules)).toEqual(["notMet"]);
    expect(checkOrder([RESPONSE_OPS.stopRobot], rules)).toEqual(["notApplicable"]);
    expect(checkOrder([], rules)).toEqual(["notApplicable"]);
  });

  // Feature: app-ghost-mansion, Property 7: order check agrees with a reference model
  // **Validates: Requirements 17.2, 17.3**
  it("P-APP1-7 order check agrees with a reference model", () => {
    fc.assert(
      fc.property(
        logArb,
        rulesArb,
        fc.nat(),
        fc.array(fc.nat(), { maxLength: 6 }),
        (log, rules, pick, extraPicks) => {
          const result = checkOrder(log, rules);
          expect(result).toEqual(reference(log, rules));

          // Appending an entry already in the log changes no result.
          if (log.length > 0) {
            const dup = log[pick % log.length];
            expect(checkOrder([...log, dup], rules)).toEqual(result);
          }

          // Same first-occurrence order gives the same result: re-expand the
          // deduplicated log with repeats of its own entries.
          const firsts = [...new Set(log)];
          const expanded: string[] = [];
          firsts.forEach((op, i) => {
            expanded.push(op);
            const later = firsts.slice(0, i + 1);
            for (const p of extraPicks) expanded.push(later[p % later.length]);
          });
          expect(checkOrder(expanded, rules)).toEqual(checkOrder(firsts, rules));
          expect(checkOrder(firsts, rules)).toEqual(result);
        },
      ),
      { numRuns: 200 },
    );
  });
});
