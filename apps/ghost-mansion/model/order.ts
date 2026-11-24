// Order check (R-APP1-17.2, 17.3). Reads only the order of the log entries.
import type { OrderRule } from "./game-data.ts";

export type OrderResult = "met" | "notMet" | "notApplicable";

/** One result per rule, in rule order. Pure; never throws; does not write to its arguments. */
export function checkOrder(log: readonly string[], rules: readonly OrderRule[]): OrderResult[] {
  return rules.map((rule) => {
    const a = log.indexOf(rule.before);
    const b = log.indexOf(rule.after);
    if (b < 0) return "notApplicable";
    if (a < 0 || b < a) return "notMet";
    return "met";
  });
}
