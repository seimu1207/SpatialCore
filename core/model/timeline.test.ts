import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cursorMovesArb, jsonEqual, scenarioArb, timelineArb, uniquePropagationArb } from "./arbitraries.ts";
import { sortUniqueEffects } from "./effects.ts";
import type { PropagationResult, Timeline, TimelineStep } from "./rule-schema.ts";
import type { Scenario, Zone } from "./scenario-schema.ts";
import {
  createCursor,
  cursorEffects,
  createTimeline,
  nextStep,
  previousStep,
  seekStep,
  timelineFromPropagation,
  timelineFromZones,
} from "./timeline.ts";

const origin = { x: 0, y: 0, z: 0 };

function step(id: string): TimelineStep {
  return { id, targets: [{ kind: "node", id: `n-${id}` }], effects: [] };
}

function zoneOf(id: string, order: number): Zone {
  return { id, label: { en: id }, order, elevation: 0, enclosed: false };
}

function scenarioWith(zones: Zone[]): Scenario {
  return {
    schemaVersion: 1,
    id: "s1",
    title: { en: "t" },
    nodes: [
      {
        id: "n1",
        type: "item",
        position: origin,
        rotation: origin,
        scale: { x: 1, y: 1, z: 1 },
        front: { text: { en: "n1" } },
        metadata: {},
        attributes: {},
      },
    ],
    edges: [],
    zones,
  };
}

function timelineOf(count: number): Timeline {
  const made = createTimeline(Array.from({ length: count }, (_, i) => step(`t${i}`)));
  if (!made.ok) throw new Error("fixture timeline is invalid");
  return made.value;
}

function cursorOf(count: number) {
  const made = createCursor(timelineOf(count));
  if (!made.ok) throw new Error("fixture cursor is invalid");
  return made.value;
}

describe("createTimeline (14.1, 14.2)", () => {
  it("keeps the given order", () => {
    const made = createTimeline([step("b"), step("a"), step("c")]);
    expect(made.ok && made.value.steps.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("fails with one error at `steps` for an empty list", () => {
    const made = createTimeline([]);
    expect(made.ok).toBe(false);
    if (!made.ok) {
      expect(made.errors).toHaveLength(1);
      expect(made.errors[0]?.path).toBe("steps");
    }
  });

  it("reports a bad field under `steps.<index>`", () => {
    const bad = { id: "", targets: [], effects: [] } as TimelineStep;
    const made = createTimeline([step("a"), bad]);
    expect(made.ok).toBe(false);
    if (!made.ok) {
      expect(made.errors.length).toBeGreaterThan(0);
      for (const e of made.errors) expect(e.path.startsWith("steps.1")).toBe(true);
    }
  });

  it("reports each repeated id after the first at `steps.<index>.id`", () => {
    const made = createTimeline([step("a"), step("b"), step("a"), step("a")]);
    expect(made.ok).toBe(false);
    if (!made.ok) expect(made.errors.map((e) => e.path)).toEqual(["steps.2.id", "steps.3.id"]);
  });
});

describe("timelineFromZones (14.4, 14.5)", () => {
  it("makes one step per Zone in ascending order", () => {
    const made = timelineFromZones(scenarioWith([zoneOf("c", 2), zoneOf("a", 0), zoneOf("b", 1)]));
    expect(made.ok).toBe(true);
    if (made.ok) {
      expect(made.value.steps).toEqual([
        { id: "step-0", targets: [{ kind: "zone", id: "a" }], effects: [] },
        { id: "step-1", targets: [{ kind: "zone", id: "b" }], effects: [] },
        { id: "step-2", targets: [{ kind: "zone", id: "c" }], effects: [] },
      ]);
    }
  });

  it("fails at `scenario.zones` when there is no Zone", () => {
    const made = timelineFromZones(scenarioWith([]));
    expect(made.ok).toBe(false);
    if (!made.ok) expect(made.errors.map((e) => e.path)).toEqual(["scenario.zones"]);
  });
});

describe("timelineFromPropagation (14.13 and the design example)", () => {
  it("builds step-0 with the seed and step-1 with the node then its edge", () => {
    const propagation: PropagationResult = {
      reached: [
        { node: "s", step: 0 },
        { node: "x", step: 1, via: "e1" },
      ],
      traversed: ["e1"],
      stopped: ["e2"],
      unresolved: [],
    };
    const made = timelineFromPropagation(propagation);
    expect(made.ok).toBe(true);
    if (made.ok) {
      expect(made.value.steps).toEqual([
        { id: "step-0", targets: [{ kind: "node", id: "s" }], effects: [] },
        {
          id: "step-1",
          targets: [
            { kind: "node", id: "x" },
            { kind: "edge", id: "e1" },
          ],
          effects: [],
        },
      ]);
    }
  });

  it("fails at `propagation.reached` when no Node was reached", () => {
    const made = timelineFromPropagation({ reached: [], traversed: [], stopped: [], unresolved: [] });
    expect(made.ok).toBe(false);
    if (!made.ok) expect(made.errors.map((e) => e.path)).toEqual(["propagation.reached"]);
  });

  it("rejects a step beyond the count bound at `propagation.reached.0.step`", () => {
    const made = timelineFromPropagation({
      reached: [{ node: "s", step: 9007199254740991 }],
      traversed: [],
      stopped: [],
      unresolved: [],
    });
    expect(made.ok).toBe(false);
    if (!made.ok) expect(made.errors.map((e) => e.path)).toEqual(["propagation.reached.0.step"]);
  });
});

describe("cursor moves (14.6 to 14.9)", () => {
  it("starts at position 0", () => {
    expect(cursorOf(3).position).toBe(0);
  });

  it("moves forward and back by one and leaves the old cursor unchanged", () => {
    const start = cursorOf(3);
    const forward = nextStep(start);
    expect(forward.ok && forward.value.position).toBe(1);
    expect(start.position).toBe(0);
    if (forward.ok) {
      const back = previousStep(forward.value);
      expect(back.ok && back.value.position).toBe(0);
    }
  });

  it("clamps at the last step and at step 0", () => {
    const single = cursorOf(1);
    const forward = nextStep(single);
    const back = previousStep(single);
    expect(forward.ok && forward.value.position).toBe(0);
    expect(back.ok && back.value.position).toBe(0);

    const last = seekStep(cursorOf(3), 2);
    expect(last.ok).toBe(true);
    if (last.ok) {
      const again = nextStep(last.value);
      expect(again.ok && again.value.position).toBe(2);
    }
  });

  it("seeks to an exact position, including both ends", () => {
    for (const position of [0, 1, 2]) {
      const made = seekStep(cursorOf(3), position);
      expect(made.ok && made.value.position).toBe(position);
    }
  });

  it("fails at `position` for a position outside the range", () => {
    for (const position of [-1, 3, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const made = seekStep(cursorOf(3), position);
      expect(made.ok).toBe(false);
      if (!made.ok) {
        expect(made.errors).toEqual([{ path: "position", message: "position must be an integer from 0 to 2" }]);
      }
    }
  });
});

// Feature: core-rules, P-RULES-13: timeline cursor
describe("P-RULES-13 timeline cursor", () => {
  const RUNS = { numRuns: 100 };
  const movesArb = timelineArb.chain((t) => fc.tuple(fc.constant(t), cursorMovesArb(t.steps.length)));

  it("P-RULES-13: moves return new cursors, keep the position in range, seek exactly, and cursorEffects matches its definition", () => {
    fc.assert(
      fc.property(movesArb, ([timeline, moves]) => {
        const start = createCursor(timeline);
        expect(start.ok).toBe(true);
        if (!start.ok) return;
        let cursor = start.value;
        for (const m of moves) {
          const before = structuredClone(cursor);
          const made =
            m.kind === "next" ? nextStep(cursor) : m.kind === "previous" ? previousStep(cursor) : seekStep(cursor, m.position);
          expect(made.ok).toBe(true);
          if (!made.ok) return;
          expect(made.value).not.toBe(cursor);
          expect(jsonEqual(made.value.timeline, timeline)).toBe(true);
          expect(jsonEqual(cursor, before)).toBe(true);
          expect(made.value.position).toBeGreaterThanOrEqual(0);
          expect(made.value.position).toBeLessThanOrEqual(timeline.steps.length - 1);
          if (m.kind === "seek") expect(made.value.position).toBe(m.position);
          cursor = made.value;

          const fx = cursorEffects(cursor);
          expect(fx.ok).toBe(true);
          if (fx.ok) {
            expect(fx.value.current).toEqual(timeline.steps[cursor.position]?.effects);
            const all = timeline.steps.slice(0, cursor.position + 1).flatMap((s) => s.effects);
            expect(fx.value.upToCurrent).toEqual(sortUniqueEffects(all));
          }
        }
      }),
      RUNS,
    );
  });

  it("P-RULES-13: next then previous returns to the same position when not at the last step", () => {
    fc.assert(
      fc.property(timelineArb, fc.nat(), (timeline, pick) => {
        const last = timeline.steps.length - 1;
        const position = pick % (last + 1);
        const start = createCursor(timeline);
        if (!start.ok) throw new Error("invalid cursor");
        const at = seekStep(start.value, position);
        if (!at.ok) throw new Error("invalid seek");
        const forward = nextStep(at.value);
        expect(forward.ok).toBe(true);
        if (!forward.ok) return;
        const back = previousStep(forward.value);
        expect(back.ok).toBe(true);
        if (back.ok && position < last) expect(back.value.position).toBe(position);
      }),
      RUNS,
    );
  });

  it("P-RULES-13: a propagation Timeline holds every reached Node once, at its step, with ids step-0 to step-max", () => {
    fc.assert(
      fc.property(
        scenarioArb.chain((s) => uniquePropagationArb(s)),
        (propagation) => {
          const made = timelineFromPropagation(propagation);
          expect(made.ok).toBe(true);
          if (!made.ok) return;
          const steps = made.value.steps;
          const max = Math.max(...propagation.reached.map((r) => r.step));
          expect(steps.map((s) => s.id)).toEqual(Array.from({ length: max + 1 }, (_, i) => `step-${i}`));
          for (const r of propagation.reached) {
            const holders = steps.flatMap((s, i) =>
              s.targets.filter((t) => t.kind === "node" && t.id === r.node).map(() => i),
            );
            expect(holders).toEqual([r.step]);
          }
          const nodeTargets = steps.reduce((n, s) => n + s.targets.filter((t) => t.kind === "node").length, 0);
          expect(nodeTargets).toBe(propagation.reached.length);
        },
      ),
      RUNS,
    );
  });
});