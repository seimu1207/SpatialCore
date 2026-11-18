import { sortUniqueEffects } from "./effects.ts";
import { buildIndex } from "./graph-index.ts";
import { guard, parseArg, checkScenario } from "./rule-input.ts";
import {
  nonNegativeInteger,
  timelineCursorSchema,
  timelinePropagationSchema,
  timelineSchema,
  type EffectRequest,
  type EffectTarget,
  type PropagationResult,
  type RuleOutcome,
  type Timeline,
  type TimelineCursor,
  type TimelineStep,
} from "./rule-schema.ts";
import { toValidationErrors, type Scenario } from "./scenario-schema.ts";

/** Validates a list of steps. Paths start with `steps`. */
export function createTimeline(steps: TimelineStep[]): RuleOutcome<Timeline> {
  return guard(() => {
    const result = timelineSchema.safeParse({ steps });
    if (result.success) return { ok: true, value: result.data };
    return { ok: false, errors: toValidationErrors(result.error.issues) };
  });
}

function stepId(index: number): string {
  return `step-${index}`;
}

/** One step per Step_Number: the reached Nodes, then (for n > 0) their `via` Edges. */
export function timelineFromPropagation(propagation: PropagationResult): RuleOutcome<Timeline> {
  return guard(() => {
    const checked = parseArg(timelinePropagationSchema, propagation, "propagation");
    if (!checked.ok) return checked;
    const reached = checked.value.reached;
    if (reached.length === 0) {
      return { ok: false, errors: [{ path: "propagation.reached", message: "propagation reached no node" }] };
    }
    let max = 0;
    for (const r of reached) if (r.step > max) max = r.step;

    const steps: TimelineStep[] = [];
    for (let n = 0; n <= max; n++) {
      const here = reached.filter((r) => r.step === n);
      const targets: EffectTarget[] = here.map((r) => ({ kind: "node", id: r.node }));
      if (n > 0) {
        for (const r of here) if (r.via !== undefined) targets.push({ kind: "edge", id: r.via });
      }
      steps.push({ id: stepId(n), targets, effects: [] });
    }
    return createTimeline(steps);
  });
}

/** One step per Zone, in `order`. */
export function timelineFromZones(scenario: Scenario): RuleOutcome<Timeline> {
  return guard(() => {
    const sc = checkScenario(scenario);
    if (!sc.ok) return sc;
    const zones = buildIndex(sc.value).zonesByOrder;
    if (zones.length === 0) {
      return { ok: false, errors: [{ path: "scenario.zones", message: "scenario has no zone" }] };
    }
    const steps: TimelineStep[] = zones.map((z, i) => ({
      id: stepId(i),
      targets: [{ kind: "zone", id: z.id }],
      effects: [],
    }));
    return createTimeline(steps);
  });
}

/** A cursor at step 0. Paths start with `timeline`. */
export function createCursor(timeline: Timeline): RuleOutcome<TimelineCursor> {
  return guard(() => {
    const checked = parseArg(timelineCursorSchema, { timeline, position: 0 }, "cursor");
    if (!checked.ok) {
      return { ok: false, errors: checked.errors.map((e) => ({ ...e, path: e.path.replace(/^cursor\./, "") })) };
    }
    return checked;
  });
}

function move(cursor: TimelineCursor, to: (position: number, last: number) => number): RuleOutcome<TimelineCursor> {
  return guard(() => {
    const checked = parseArg(timelineCursorSchema, cursor, "cursor");
    if (!checked.ok) return checked;
    const { timeline, position } = checked.value;
    return { ok: true, value: { timeline, position: to(position, timeline.steps.length - 1) } };
  });
}

/** One step forward; stays at the last step. */
export function nextStep(cursor: TimelineCursor): RuleOutcome<TimelineCursor> {
  return move(cursor, (p, last) => Math.min(p + 1, last));
}

/** One step back; stays at step 0. */
export function previousStep(cursor: TimelineCursor): RuleOutcome<TimelineCursor> {
  return move(cursor, (p) => Math.max(p - 1, 0));
}

/** Jumps to an exact step. A bad `position` gives one error at `position`. */
export function seekStep(cursor: TimelineCursor, position: number): RuleOutcome<TimelineCursor> {
  return guard(() => {
    const checked = parseArg(timelineCursorSchema, cursor, "cursor");
    if (!checked.ok) {
      const bad = parseArg(nonNegativeInteger, position, "position");
      return { ok: false, errors: [...checked.errors, ...(bad.ok ? [] : bad.errors)] };
    }
    const timeline = checked.value.timeline;
    const last = timeline.steps.length - 1;
    if (!Number.isInteger(position) || position < 0 || position > last) {
      return { ok: false, errors: [{ path: "position", message: `position must be an integer from 0 to ${last}` }] };
    }
    return { ok: true, value: { timeline, position } };
  });
}

/** Effects of the current step, and of steps 0 … position sorted without repeats. */
export function cursorEffects(
  cursor: TimelineCursor,
): RuleOutcome<{ current: EffectRequest[]; upToCurrent: EffectRequest[] }> {
  return guard(() => {
    const checked = parseArg(timelineCursorSchema, cursor, "cursor");
    if (!checked.ok) return checked;
    const { timeline, position } = checked.value;
    const current = timeline.steps[position]?.effects ?? [];
    const all = timeline.steps.slice(0, position + 1).flatMap((s) => s.effects);
    return { ok: true, value: { current: [...current], upToCurrent: sortUniqueEffects(all) } };
  });
}