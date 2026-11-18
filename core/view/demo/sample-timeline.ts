// The demo Timeline: one step per Zone (in `order`), each carrying a `haze` request for that Zone.
import type { EffectRequest, RuleOutcome, Timeline } from "../../model/rule-schema.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { createTimeline, timelineFromZones } from "../../model/timeline.ts";

export function buildDemoTimeline(scenario: Scenario): RuleOutcome<Timeline> {
  const base = timelineFromZones(scenario);
  if (!base.ok) return base;
  return createTimeline(
    base.value.steps.map((step) => ({
      ...step,
      effects: step.targets
        .filter((t) => t.kind === "zone")
        .map((t): EffectRequest => ({ effect: "haze", target: t, source: "demo" })),
    })),
  );
}
