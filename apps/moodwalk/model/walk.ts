/** Linked_Timeline of Moodwalk (design.md "Linked_Timeline", M11): one step per Zone, fog on step 0. */
import { sortUniqueEffects } from "../../../core/model/effects.ts";
import type { EffectRequest, RuleOutcome, Timeline } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { createTimeline, timelineFromZones } from "../../../core/model/timeline.ts";
import type { ZoneFootprint } from "../../../core/view/helpers/settings-schema.ts";

/** `timelineFromZones` with the sorted Mood_Effects in the `effects` of step 0. Never throws. */
export function linkedTimeline(
  scenario: Scenario,
  effects: readonly EffectRequest[],
): RuleOutcome<Timeline> {
  try {
    const base = timelineFromZones(scenario);
    if (!base.ok) return base;
    const sorted = sortUniqueEffects(effects);
    const steps = base.value.steps.map((step, i) => ({
      ...step,
      effects: i === 0 ? sorted : [],
    }));
    return createTimeline(steps);
  } catch {
    return { ok: false, errors: [{ path: "timeline", message: "the linked timeline could not be built" }] };
  }
}

/** At least 2 Zones, and a footprint for every Zone (R-APP2-12.9). */
export function canWalk(scenario: Scenario, footprints: readonly ZoneFootprint[]): boolean {
  try {
    if (scenario.zones.length < 2) return false;
    const ids = new Set(footprints.map((f) => f.id));
    return scenario.zones.every((z) => ids.has(z.id));
  } catch {
    return false;
  }
}
