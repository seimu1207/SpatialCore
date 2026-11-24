import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../core/model/commands.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { attackCheckSet, withCheckSet } from "./built-rules.ts";
import { BUNDLED } from "./bundled.ts";
import { dontReadCommand, isKeyEdge, keyChoiceCommand, stopRobotCommand } from "./commands.ts";
import { bellStopEffects, couldStopEffects, highlightEffects, lookBackEffects, withoutRobot } from "./effects.ts";
import { orderRulesArb, phaseActionsArb, scorePointArb, starTableArb, variantArb } from "./arbitraries.ts";
import { deriveActionLog } from "./action-log.ts";
import { checkOrder } from "./order.ts";
import { nextPhase } from "./phase.ts";
import type { Phase, PhaseState } from "./phase.ts";
import { controlsFor } from "./controls.ts";
import type { ControlsInput } from "./controls.ts";
import { fixReplayTimeline, findHiddenJobId, nightTimeline, sampleTimeline } from "./timelines.ts";
import type { History } from "../../../core/model/history.ts";
import { loadGameData } from "./game-data.ts";
import { convenienceScore, judgeMansion, judgeNight, prepareStatus, starsFor } from "./judge.ts";
import type { Flags, NightResult } from "./judge.ts";
import { EFFECT_KINDS } from "./names.ts";
import { deriveSample } from "./sample.ts";

const loaded = loadGameData(BUNDLED);
if (!loaded.ok) throw new Error("bundled Game_Data must load");
const data = loaded.data;
const preset: Scenario = data.preset;
const rulesResult = withCheckSet(data.rules, attackCheckSet(data.attackCard));
if (!rulesResult.ok) throw new Error("attack rules must load");
const attackRules = rulesResult.value;
const none: Flags = { f1: false, f2: false };

function apply(s: Scenario, c: ReturnType<typeof keyChoiceCommand>): Scenario {
  if (c === null) throw new Error("command is null");
  const r = applyCommand(s, c);
  if (!r.ok) throw new Error("command failed");
  return r.scenario;
}

function night(s: Scenario, flags: Flags = none): NightResult {
  const r = judgeNight(s, data, attackRules, flags);
  if (!r.ok) throw new Error("judgement failed");
  return r.value;
}

const sampleResult = deriveSample(preset);
if (!sampleResult.ok) throw new Error("sample must derive");
const sample = sampleResult.scenario;
const winning = apply(preset, dontReadCommand(preset, "page"));
const keyIds = preset.edges.filter(isKeyEdge).map((e) => e.id);
const allBell = keyIds.reduce((s, id) => {
  const c = keyChoiceCommand(s, id, "bell");
  return c === null ? s : apply(s, c);
}, preset);
const homeworkPlain = apply(allBell, keyChoiceCommand(allBell, "k-homework", "plain"));

describe("results table (13.5, 14.6)", () => {
  it("Sample_Mansion", () => {
    const n = night(sample);
    expect(n.verdict).toBe(true);
    expect([...n.damageSet].sort()).toEqual(["diary", "homework", "messages", "photos"]);
    expect([n.damageScore, n.convenience, n.stars]).toEqual([11, 6, 1]);
  });

  it("Preset_Mansion has verdict true and a non-empty Damage_Set before any change (14.6)", () => {
    const n = night(preset);
    expect(n.verdict).toBe(true);
    expect(n.damageSet.length).toBeGreaterThan(0);
    expect([n.damageScore, n.convenience, n.stars]).toEqual([11, 6, 1]);
    expect(n.bellStops.map((e) => e.target.id)).toEqual(["k-diary"]);
  });

  it("Preset + Dont_Read_Mark on page", () => {
    const n = night(winning);
    expect(n.verdict).toBe(false);
    expect(n.damageSet).toEqual([]);
    expect([n.damageScore, n.convenience, n.stars]).toEqual([0, 4, 3]);
  });

  it("every key a Bell_Key", () => {
    const n = night(allBell);
    expect(n.verdict).toBe(false);
    expect(n.damageSet).toEqual([]);
    expect([n.damageScore, n.convenience, n.stars]).toEqual([0, 3, 2]);
  });

  it("k-homework plain, others bell", () => {
    const n = night(homeworkPlain);
    expect(n.verdict).toBe(true);
    expect(n.damageSet).toEqual(["homework"]);
    expect([n.damageScore, n.convenience, n.stars]).toEqual([1, 4, 2]);
  });
});

describe("judge edge cases", () => {
  it("returns a Rule_Failure for a broken Scenario and does not throw (6.5)", () => {
    const first = preset.edges[0];
    if (first === undefined) throw new Error("preset has edges");
    const broken: Scenario = { ...preset, edges: [...preset.edges, { ...first, id: "bad", from: "ghost-node", to: "nowhere" }] };
    let r: ReturnType<typeof judgeNight> | undefined;
    expect(() => {
      r = judgeNight(broken, data, attackRules, none);
    }).not.toThrow();
    expect(r?.ok).toBe(false);
    if (r !== undefined && !r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it("f2 limits propagation to Max_Steps 1 (7.5)", () => {
    const n = night(preset, { f1: false, f2: true });
    expect(Math.max(...n.propagation.reached.map((r) => r.step))).toBe(1);
    expect(n.propagation.reached.every((r) => r.step <= 1)).toBe(true);
    expect(n.damageSet).not.toContain("diary");
  });

  it("bellStops is empty when the verdict is false (7.4)", () => {
    expect(night(allBell).bellStops).toEqual([]);
    expect(night(winning).bellStops).toEqual([]);
  });

  it("prepareStatus reports reachScore without the verdict (9.6)", () => {
    const n = night(winning);
    expect(n.verdict).toBe(false);
    expect(n.reachScore).toBeGreaterThan(0);
    expect(prepareStatus(n)).toEqual({ convenience: 4, reachScore: n.reachScore });
  });

  it("no damage request targets robot (7.6)", () => {
    const n = night(sample);
    expect(n.damageEffects.length).toBeGreaterThan(0);
    expect(n.damageEffects.every((e) => e.effect === EFFECT_KINDS.damage)).toBe(true);
    expect(n.damageEffects.some((e) => e.target.kind === "node" && e.target.id === "robot")).toBe(false);
    const raw = [
      { effect: EFFECT_KINDS.damage, target: { kind: "node" as const, id: "robot" }, source: "x" },
      { effect: EFFECT_KINDS.damage, target: { kind: "node" as const, id: "photos" }, source: "x" },
    ];
    expect(withoutRobot(raw).map((e) => e.target.id)).toEqual(["photos"]);
  });
});

describe("lookBackEffects (18.6)", () => {
  it("includes bell-stop requests for verdict true when a bell stopped the damage", () => {
    const n = night(preset);
    const out = lookBackEffects(n);
    expect(out.filter((e) => e.effect === EFFECT_KINDS.bellStop).map((e) => e.target.id)).toEqual(["k-diary"]);
    expect(out.some((e) => e.effect === EFFECT_KINDS.couldStop)).toBe(true);
  });

  it("has no bell-stop requests for verdict true with no Bell_Key", () => {
    const n = night(sample);
    expect(n.verdict).toBe(true);
    const out = lookBackEffects(n);
    expect(out.some((e) => e.effect === EFFECT_KINDS.bellStop)).toBe(false);
    expect(out.some((e) => e.effect === EFFECT_KINDS.couldStop)).toBe(true);
  });

  it("keeps bell-stop requests for verdict true with an empty Damage_Set, without could-stop", () => {
    const base = night(preset);
    const empty: NightResult = { ...base, damageSet: [], damageScore: 0 };
    expect(couldStopEffects(empty)).toEqual([]);
    const out = lookBackEffects(empty);
    expect(out).toEqual(expect.arrayContaining(bellStopEffects(["k-diary"])));
    expect(out.some((e) => e.effect === EFFECT_KINDS.couldStop)).toBe(false);
  });

  it("has no bell-stop and no could-stop for verdict false", () => {
    const n = night(winning);
    const out = lookBackEffects(n);
    expect(out.some((e) => e.effect === EFFECT_KINDS.bellStop || e.effect === EFFECT_KINDS.couldStop)).toBe(false);
    expect(out).toEqual(n.fog);
  });
});

describe("P-APP1-5 attack needs every precondition", () => {
  /**
   * Feature: app-ghost-mansion, Property 5: attack needs every precondition
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.3, 7.4**
   */
  // fc.record builds null-prototype objects, which structuredClone turns into plain ones; build plain objects instead.
  const flagsArb = fc.tuple(fc.boolean(), fc.boolean()).map(([f1, f2]): Flags => ({ f1, f2 }));

  it("P-APP1-5 the verdict is the conjunction of the three Preconditions and drives the damage fields", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, (s, flags) => {
        const n = night(s, flags);
        expect(n.preconditions.map((p) => p.id)).toEqual(data.attackCard.preconditions.map((p) => p.id));
        expect(n.preconditions).toHaveLength(3);
        expect(n.verdict).toBe(n.preconditions.every((p) => p.holds));
        if (!n.verdict) {
          expect(n.damageSet).toEqual([]);
          expect(n.damageScore).toBe(0);
          expect(n.bellStops).toEqual([]);
        } else {
          expect(n.damageSet.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("P-APP1-5 Stop_Robot or the Dont_Read_Mark on page gives a false verdict", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, (s, flags) => {
        const stop = stopRobotCommand(s);
        const stopped = stop === null ? s : apply(s, stop);
        expect(night(stopped, flags).verdict).toBe(false);
        const mark = dontReadCommand(s, "page");
        const marked = mark === null ? s : apply(s, mark);
        expect(night(marked, flags).verdict).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

describe("P-APP1-2 safer keys never increase damage", () => {
  /**
   * Feature: app-ghost-mansion, Property 2: P-APP1-2 safer keys never increase damage.
   * **Validates: Requirements 4.1, 4.3, 4.4, 4.5, 7.1, 7.2**
   */
  // fc.record builds null-prototype objects, which structuredClone turns into plain ones; build plain objects instead.
  const flagsArb = fc.tuple(fc.boolean(), fc.boolean()).map(([f1, f2]): Flags => ({ f1, f2 }));

  function expectNoWorse(before: NightResult, after: NightResult): void {
    for (const id of after.reachSet) expect(before.reachSet).toContain(id);
    for (const id of after.damageSet) expect(before.damageSet).toContain(id);
    expect(after.reachScore).toBeLessThanOrEqual(before.reachScore);
    expect(after.damageScore).toBeLessThanOrEqual(before.damageScore);
  }

  it("changing one Key_Edge to a safer choice never adds reach or damage", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, fc.nat(), fc.boolean(), (s, flags, pick, toNone) => {
        const keys = s.edges.filter(isKeyEdge);
        if (keys.length === 0) return;
        const edge = keys[pick % keys.length];
        if (edge === undefined) return;
        const cmd = keyChoiceCommand(s, edge.id, toNone ? "none" : "bell");
        if (cmd === null) return;
        const next = apply(s, cmd);
        // plain -> bell/none and bell -> none are safer; bell -> bell is a null command above
        if (edge.type !== "plain-key" && !toNone) return;
        expectNoWorse(night(s, flags), night(next, flags));
      }),
    );
  });

  it("removing any subset of Key_Edges never adds reach or damage", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }), (s, flags, mask) => {
        const keys = s.edges.filter(isKeyEdge);
        const drop = new Set(keys.filter((_, i) => mask[i % mask.length] === true).map((e) => e.id));
        const next: Scenario = { ...s, edges: s.edges.filter((e) => !drop.has(e.id)) };
        expectNoWorse(night(s, flags), night(next, flags));
      }),
    );
  });
});

describe("P-APP1-3 fewer keys never increase convenience", () => {
  /**
   * Feature: app-ghost-mansion, Property 3: P-APP1-3 fewer keys never increase convenience.
   * **Validates: Requirements 9.3, 9.4, 9.5**
   */
  // fc.record builds null-prototype objects, which structuredClone turns into plain ones; build plain objects instead.
  const flagsArb = fc.tuple(fc.boolean(), fc.boolean()).map(([f1, f2]): Flags => ({ f1, f2 }));

  function reference(s: Scenario, n: NightResult): number {
    let total = 0;
    for (const job of data.jobs.jobs) {
      if (n.jobs.find((j) => j.id === job.id)?.holds !== true) continue;
      const toRoom = s.edges.filter((e) => e.from === "robot" && e.to === job.room);
      if (toRoom.some((e) => e.type === "plain-key")) total += 2;
      else if (toRoom.some((e) => e.type === "bell-key")) total += 1;
    }
    return total;
  }

  it("plain to bell or removal never raises the score", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, fc.nat(), fc.boolean(), (s, flags, pick, toNone) => {
        const keys = s.edges.filter(isKeyEdge);
        if (keys.length === 0) return;
        const edge = keys[pick % keys.length];
        if (edge === undefined) return;
        const cmd = keyChoiceCommand(s, edge.id, toNone ? "none" : "bell");
        if (cmd === null) return;
        if (edge.type !== "plain-key" && !toNone) return;
        expect(night(apply(s, cmd), flags).convenience).toBeLessThanOrEqual(night(s, flags).convenience);
      }),
    );
  });

  it("removing every Key_Edge gives 0", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, (s, flags) => {
        const next: Scenario = { ...s, edges: s.edges.filter((e) => !isKeyEdge(e)) };
        expect(night(next, flags).convenience).toBe(0);
      }),
    );
  });

  it("the score equals the reference sum", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, (s, flags) => {
        const n = night(s, flags);
        expect(n.convenience).toBe(reference(s, n));
      }),
    );
  });
});

describe("P-APP1-6 transforms do not change judgements", () => {
  /**
   * Feature: app-ghost-mansion, Property 6: transforms do not change judgements
   * **Validates: Requirements 3.7, 19.5**
   */
  // fc.record builds null-prototype objects, which structuredClone turns into plain ones; build plain objects instead.
  const flagsArb = fc.tuple(fc.boolean(), fc.boolean()).map(([f1, f2]): Flags => ({ f1, f2 }));
  const coord = fc.double({ min: -50, max: 50, noNaN: true });
  const vec = fc.record({ x: coord, y: coord, z: coord });
  const scl = fc.record({
    x: fc.double({ min: 0.1, max: 10, noNaN: true }),
    y: fc.double({ min: 0.1, max: 10, noNaN: true }),
    z: fc.double({ min: 0.1, max: 10, noNaN: true }),
  });
  const changeArb = fc.record(
    { position: vec, rotation: vec, scale: scl },
    { requiredKeys: [] },
  );

  it("P-APP1-6 updateNode of position, rotation, or scale leaves the whole judgement toStrictEqual", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, fc.array(fc.tuple(fc.nat(), changeArb), { maxLength: 12 }), (s, flags, edits) => {
        let next = s;
        for (const [pick, changes] of edits) {
          const node = next.nodes[pick % next.nodes.length];
          if (node === undefined) continue;
          const r = applyCommand(next, { kind: "updateNode", id: node.id, changes });
          if (!r.ok) throw new Error("updateNode failed");
          next = r.scenario;
        }
        expect(night(next, flags)).toStrictEqual(night(s, flags));
      }),
      { numRuns: 200 },
    );
  });
});

describe("P-APP1-10 plausible ghost fog", () => {
  /**
   * Feature: app-ghost-mansion, Property 10: plausible ghost fog
   * **Validates: Requirements 7.2, 8.1, 8.2, 19.8**
   */
  // fc.record builds null-prototype objects, which structuredClone turns into plain ones; build plain objects instead.
  const flagsArb = fc.tuple(fc.boolean(), fc.boolean()).map(([f1, f2]): Flags => ({ f1, f2 }));
  const edgeEditArb = fc.record({
    from: fc.constantFrom(...preset.nodes.map((n) => n.id)),
    to: fc.constantFrom(...preset.nodes.map((n) => n.id)),
  });

  // Reference: an answer Node is fogged unless a cites Edge goes from it to a source Node.
  function expectedFog(s: Scenario): string[] {
    const typeOf = new Map(s.nodes.map((n) => [n.id, n.type]));
    return s.nodes
      .filter((n) => n.type === "answer")
      .filter((n) => !s.edges.some((e) => e.type === "cites" && e.from === n.id && typeOf.get(e.to) === "source"))
      .map((n) => n.id)
      .sort();
  }

  it("P-APP1-10 the unsourced-fog targets are exactly the answer Nodes with no cites Edge to a source Node", () => {
    fc.assert(
      fc.property(variantArb, (s) => {
        const n = night(s, { f1: false, f2: false });
        expect(n.fog.every((e) => e.effect === EFFECT_KINDS.unsourcedFog)).toBe(true);
        expect(n.fog.map((e) => e.target.id).sort()).toEqual(expectedFog(s));
      }),
      { numRuns: 200 },
    );
  });

  it("P-APP1-10 adding or removing any Cite_Edge leaves damage, convenience, and stars unchanged", () => {
    fc.assert(
      fc.property(variantArb, flagsArb, fc.array(edgeEditArb, { maxLength: 4 }), fc.boolean(), (s, flags, adds, removeAll) => {
        let next: Scenario = removeAll ? { ...s, edges: s.edges.filter((e) => e.type !== "cites") } : s;
        adds.forEach((a, i) => {
          next = apply(next, {
            kind: "addEdge",
            edge: { id: `pbt-cite-${i}`, from: a.from, to: a.to, type: "cites" },
          });
        });
        const before = night(s, flags);
        const after = night(next, flags);
        expect(after.damageSet).toStrictEqual(before.damageSet);
        expect(after.damageScore).toBe(before.damageScore);
        expect(after.convenience).toBe(before.convenience);
        expect(after.stars).toBe(before.stars);
      }),
      { numRuns: 200 },
    );
  });
});

describe("P-APP1-4 star table is total and monotone", () => {
  /**
   * Feature: app-ghost-mansion, Property 4: P-APP1-4 star table is total and monotone.
   * **Validates: Requirements 10.2, 10.3, 10.4**
   */
  const stepArb = fc.double({ min: 0, max: 20, noNaN: true });

  it("P-APP1-4 returns one integer from 1 to 3", () => {
    fc.assert(
      fc.property(starTableArb, scorePointArb, (table, { c, d }) => {
        const stars = starsFor(table, c, d);
        expect(Number.isInteger(stars)).toBe(true);
        expect(stars).toBeGreaterThanOrEqual(1);
        expect(stars).toBeLessThanOrEqual(3);
      }),
      { numRuns: 200 },
    );
  });

  it("P-APP1-4 raising c or lowering d never lowers the stars", () => {
    fc.assert(
      fc.property(starTableArb, scorePointArb, stepArb, stepArb, (table, { c, d }, dc, dd) => {
        const base = starsFor(table, c, d);
        expect(starsFor(table, c + dc, d)).toBeGreaterThanOrEqual(base);
        expect(starsFor(table, c, Math.max(0, d - dd))).toBeGreaterThanOrEqual(base);
        expect(starsFor(table, c + dc, Math.max(0, d - dd))).toBeGreaterThanOrEqual(base);
      }),
      { numRuns: 200 },
    );
  });

  it("P-APP1-4 no point with c = 0 gets rules[0].stars", () => {
    fc.assert(
      fc.property(starTableArb, scorePointArb, (table, { d }) => {
        const top = table.rules[0];
        if (top === undefined) throw new Error("star table has a rule");
        expect(starsFor(table, 0, d)).not.toBe(top.stars);
      }),
      { numRuns: 200 },
    );
  });
});
describe("P-APP1-1 same input gives same result", () => {
  /**
   * Feature: app-ghost-mansion, Property 1: P-APP1-1 same input 竊・same result.
   * **Validates: Requirements 6.6, 10.6, 21.3, 21.4**
   */
  /** Calls `fn` on the arguments, then on structuredClone copies; both results are equal and the arguments are unchanged. */
  function same<A extends unknown[], R>(fn: (...a: A) => R, ...args: A): R {
    const before = structuredClone(args);
    const first = fn(...args);
    expect(args).toStrictEqual(before);
    const second = fn(...structuredClone(args));
    expect(second).toStrictEqual(first);
    return first;
  }

  // fc.record builds null-prototype objects, which structuredClone turns into plain ones; build plain objects instead.
  const flagsArb = fc.tuple(fc.boolean(), fc.boolean()).map(([f1, f2]): Flags => ({ f1, f2 }));
  const phaseArb = fc.constantFrom<Phase>("sample", "prepare", "ghostNight", "fixIt", "lookBack");
  const logIdsArb = fc.array(fc.constantFrom("stop-robot", "cut-key", "consult", "other"), { maxLength: 10 });

  it("P-APP1-1 every pure function gives equal results on cloned arguments and leaves arguments unchanged", () => {
    fc.assert(
      fc.property(
        variantArb,
        flagsArb,
        logIdsArb,
        orderRulesArb,
        phaseArb,
        phaseActionsArb,
        fc.record({
          pick: fc.nat(),
          none: fc.boolean(),
          connectOn: fc.boolean(),
          sampleShown: fc.nat({ max: 6 }),
          preconditionCount: fc.nat({ max: 6 }),
          replaying: fc.boolean(),
          fallbackF1: fc.option(fc.boolean(), { nil: undefined }),
        }),
        starTableArb,
        scorePointArb,
        (variant, flags, log, orderRules, phase, actions, ui, table, point) => {
          const j = same(judgeMansion, variant, data, attackRules, flags);
          const n = same(judgeNight, variant, data, attackRules, flags);
          if (!n.ok) throw new Error("variant must judge");
          const nr = n.value;
          if (j.ok) same(convenienceScore, variant, data.jobs, nr.jobs);
          same(starsFor, table, point.c, point.d);
          const hidden = findHiddenJobId(variant, data.jobs) ?? "";
          same(nightTimeline, variant, nr, data.jobs, hidden);
          same(fixReplayTimeline, variant, nr, data.jobs, hidden);
          same(sampleTimeline, nr, highlightEffects(data.attackCard, ui.sampleShown));
          same(lookBackEffects, nr);
          const history: History = { past: [preset], present: variant, future: [], limit: 100 };
          same(deriveActionLog, preset, history);
          same(checkOrder, log, orderRules);
          let state: PhaseState = { phase };
          for (const a of actions) state = same(nextPhase, state, a);
          const list: { kind: "node" | "edge"; id: string }[] = [
            ...variant.nodes.map((x) => ({ kind: "node" as const, id: x.id })),
            ...variant.edges.map((x) => ({ kind: "edge" as const, id: x.id })),
          ];
          const selection = ui.none || list.length === 0 ? null : list[ui.pick % list.length] ?? null;
          const input: ControlsInput = {
            phase,
            selection,
            scenario: variant,
            connectOn: ui.connectOn,
            sampleShown: ui.sampleShown,
            preconditionCount: ui.preconditionCount,
            replaying: ui.replaying,
            ...(ui.fallbackF1 === undefined ? {} : { fallbackF1: ui.fallbackF1 }),
          };
          same(controlsFor, input);
        },
      ),
      { numRuns: 100 },
    );
  });
});
