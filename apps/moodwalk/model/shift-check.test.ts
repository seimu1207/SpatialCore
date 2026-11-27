import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { boardArb, marksArb, settingsArb } from "./arbitraries.ts";
import { applyCommand } from "../../../core/model/commands.ts";
import { judgementResultsSchema, loadRuleDefinition, type RuleDefinition } from "../../../core/model/rule-schema.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import rulesJson from "../rules/mood-rules.json" with { type: "json" };
import settingsJson from "../rules/board-settings.json" with { type: "json" };
import { loadBoardSettings, type BoardSettings } from "./board-settings.ts";
import { checkMood, sameMoodRuns, seriesSettingsFor } from "./shift-check.ts";

const loadedRules = loadRuleDefinition(rulesJson);
const loadedSettings = loadBoardSettings(settingsJson);
if (!loadedRules.ok || !loadedSettings.ok) throw new Error("bundled rules or settings did not load");
const rules: RuleDefinition = loadedRules.value;
const settings: BoardSettings = loadedSettings.settings;

type Row = { id: string; b?: number; t?: number };

/** One Image_Node per row, in a Zone of the same id; the Zone `order` is the row index. */
function board(rows: Row[]): Scenario {
  return {
    schemaVersion: 1,
    id: "test",
    title: { en: "Test" },
    zones: rows.map((r, i) => ({ id: r.id, label: { en: r.id }, order: i, elevation: 0, enclosed: false })),
    nodes: rows.map((r) => ({
      id: `n-${r.id}`,
      type: "image",
      position: { x: 0, y: 1.3, z: 0 },
      rotation: { x: 0, y: Math.PI, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      front: { image: "sample:x" },
      zone: r.id,
      metadata: {},
      attributes: {
        ...(r.b === undefined ? {} : { brightness: r.b }),
        ...(r.t === undefined ? {} : { temperature: r.t }),
      },
    })),
    edges: [],
  };
}

describe("seriesSettingsFor", () => {
  it("gives brightness then temperature with the Board settings", () => {
    const list = seriesSettingsFor(settings, { brightnessOnly: false });
    const common = {
      zoneValue: "mean",
      direction: "up",
      shiftThreshold: 0.15,
      runTolerance: 0.05,
      minRunLength: 3,
    };
    expect(list).toStrictEqual([
      { attribute: "brightness", ...common },
      { attribute: "temperature", ...common },
    ]);
  });

  it("gives only brightness under brightnessOnly", () => {
    const list = seriesSettingsFor(settings, { brightnessOnly: true });
    expect(list.map((s) => s.attribute)).toStrictEqual(["brightness"]);
  });
});

describe("sameMoodRuns", () => {
  it("Example 1 of R-APP2-09.3: [A,B,C] and [C,D,E] give [C], which is too short", () => {
    expect(sameMoodRuns([["A", "B", "C"]], [["C", "D", "E"]], 2)).toStrictEqual([]);
    expect(sameMoodRuns([["A", "B", "C"]], [["C", "D", "E"]], 1)).toStrictEqual([["C"]]);
  });

  it("Example 2 of R-APP2-09.3: [A,B] and [C,D] are too short for 3", () => {
    const b = [["A", "B", "C", "D"]];
    const t = [
      ["X", "A", "B"],
      ["C", "D", "Y"],
    ];
    expect(sameMoodRuns(b, t, 3)).toStrictEqual([]);
    expect(sameMoodRuns(b, t, 2)).toStrictEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
  });
});

describe("checkMood", () => {
  it("Example 1 flags no Zone through the whole check", () => {
    const rows: Row[] = [
      { id: "A", b: 0.5, t: -0.9 },
      { id: "B", b: 0.5, t: 0.9 },
      { id: "C", b: 0.5, t: 0 },
      { id: "D", b: 0.1, t: 0 },
      { id: "E", b: 0.8, t: 0 },
    ];
    const out = checkMood(board(rows), settings, [], rules);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.brightness.longRuns).toStrictEqual([["A", "B", "C"]]);
    expect(out.value.sameMoodRuns).toStrictEqual([]);
    expect(out.value.flags.filter((f) => f.reason.kind === "same-mood-too-long")).toStrictEqual([]);
  });

  it("Example 2 flags no Zone through the whole check", () => {
    const rows: Row[] = [
      { id: "X", b: 0.2, t: 0 },
      { id: "A", b: 0.5, t: 0 },
      { id: "B", b: 0.5, t: 0 },
      { id: "C", b: 0.5, t: 0.5 },
      { id: "D", b: 0.5, t: 0.5 },
      { id: "Y", b: 0.2, t: 0.5 },
    ];
    const out = checkMood(board(rows), settings, [], rules);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.brightness.longRuns).toStrictEqual([["A", "B", "C", "D"]]);
    expect(out.value.sameMoodRuns).toStrictEqual([]);
    expect(out.value.flags.filter((f) => f.reason.kind === "same-mood-too-long")).toStrictEqual([]);
  });

  it("gives an empty effect list and no flag for a Board with no flag", () => {
    const out = checkMood(
      board([
        { id: "A", b: 0.5, t: 0 },
        { id: "B", b: 0.5, t: 0 },
      ]),
      settings,
      [],
      rules,
    );
    expect(out.ok && out.value.flags).toStrictEqual([]);
    expect(out.ok && out.value.effects).toStrictEqual([]);
  });

  it("flags a sudden brightening and a long same mood, sorted by Zone order then kind", () => {
    const rows: Row[] = [
      { id: "A", b: 0.1, t: 0 },
      { id: "B", b: 0.5, t: 0 },
      { id: "C", b: 0.5, t: 0 },
      { id: "D", b: 0.5, t: 0 },
    ];
    const out = checkMood(board(rows), settings, [], rules);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.flags.map((f) => [f.zone, f.reason.kind])).toStrictEqual([
      ["B", "sudden-brightening"],
      ["B", "same-mood-too-long"],
      ["C", "same-mood-too-long"],
      ["D", "same-mood-too-long"],
    ]);
    expect(out.value.effects).toHaveLength(4);
    const marked = checkMood(board(rows), settings, ["B"], rules);
    expect(marked.ok && marked.value.flags.filter((f) => f.reason.kind === "sudden-brightening")).toStrictEqual([]);
  });

  it("lists a Zone without data in noData", () => {
    const out = checkMood(board([{ id: "A", b: 0.5, t: 0 }, { id: "B" }, { id: "C", b: 0.4, t: 0 }]), settings, [], rules);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.curve.zones.map((z) => z.id)).toStrictEqual(["A", "B", "C"]);
    expect(out.value.curve.attributes.map((a) => [a.attribute, a.noData])).toStrictEqual([
      ["brightness", ["B"]],
      ["temperature", ["B"]],
    ]);
  });

  it("uses only brightness under brightnessOnly, and Same_Mood_Runs equal the Brightness Long_Runs", () => {
    const rows: Row[] = [
      { id: "A", b: 0.5 },
      { id: "B", b: 0.5 },
      { id: "C", b: 0.5 },
      { id: "D", b: 0.9 },
    ];
    const out = checkMood(board(rows), settings, [], rules, { brightnessOnly: true });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.curve.attributes).toHaveLength(1);
    expect(out.value.temperature).toBeNull();
    expect(out.value.sameMoodRuns).toStrictEqual(out.value.brightness.longRuns);
    expect(out.value.sameMoodRuns).toStrictEqual([["A", "B", "C"]]);
  });

  it("returns a Rule_Failure for a broken Scenario and does not throw", () => {
    const broken = { nodes: "no" } as unknown as Scenario;
    let out: ReturnType<typeof checkMood> | undefined;
    expect(() => {
      out = checkMood(broken, settings, [], rules);
    }).not.toThrow();
    expect(out?.ok).toBe(false);
    expect(out && !out.ok && out.errors.length).toBeGreaterThan(0);
  });

  it("builds Judgement_Results that pass judgementResultsSchema", () => {
    const out = checkMood(
      board([
        { id: "A", b: 0.5, t: 0 },
        { id: "B", b: 0.5, t: 0 },
        { id: "C", b: 0.5, t: 0 },
      ]),
      settings,
      [],
      rules,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const results = {
      series: [
        out.value.brightness,
        {
          attribute: "sameMood",
          series: [],
          changes: [],
          shifts: [],
          longRuns: out.value.sameMoodRuns,
          unresolved: [],
        },
      ],
    };
    expect(judgementResultsSchema.safeParse(results).success).toBe(true);
    expect(out.value.sameMoodRuns).toStrictEqual([["A", "B", "C"]]);
  });
});

describe("checkMood properties", () => {
  // Feature: app-moodwalk, Property 4: curve, flags, and effects are deterministic
  // **Validates: Requirements 7.8, 9.8, 14.4**
  it("P-APP2-4 curve, flags, and effects are deterministic", () => {
    fc.assert(
      fc.property(
        boardArb.chain((scenario) =>
          // settingsArb may build null-prototype records; the property is about plain objects.
          fc.tuple(fc.constant(scenario), settingsArb.map((s) => ({ ...s })), marksArb(scenario.zones)),
        ),
        ([scenario, boardSettings, marks]) => {
          const before = {
            scenario: structuredClone(scenario),
            settings: structuredClone(boardSettings),
            marks: structuredClone(marks),
            rules: structuredClone(rules),
          };
          const first = checkMood(scenario, boardSettings, marks, rules);
          const second = checkMood(
            JSON.parse(JSON.stringify(scenario)) as typeof scenario,
            JSON.parse(JSON.stringify(boardSettings)) as typeof boardSettings,
            JSON.parse(JSON.stringify(marks)) as typeof marks,
            JSON.parse(JSON.stringify(rules)) as typeof rules,
          );
          expect(second).toStrictEqual(first);
          expect(scenario).toStrictEqual(before.scenario);
          expect(boardSettings).toStrictEqual(before.settings);
          expect(marks).toStrictEqual(before.marks);
          expect(rules).toStrictEqual(before.rules);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: app-moodwalk, Property 5: transforms and node order do not change the curve
  // **Validates: Requirements 5.5, 7.6, 7.7, 7.8**
  it("P-APP2-5 transforms and node order do not change the curve", () => {
    const coord = fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true });
    const positive = fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true });
    // scale must be positive in the Scenario schema; position and rotation take any finite value.
    const change = fc.oneof(
      fc.record({ position: fc.record({ x: coord, y: coord, z: coord }) }),
      fc.record({ rotation: fc.record({ x: coord, y: coord, z: coord }) }),
      fc.record({ scale: fc.record({ x: positive, y: positive, z: positive }) }),
    );
    fc.assert(
      fc.property(
        boardArb.chain((scenario) =>
          fc.tuple(
            fc.constant(scenario),
            settingsArb.map((s) => ({ ...s })),
            marksArb(scenario.zones),
            fc.nat({ max: Math.max(0, scenario.nodes.length - 1) }),
            change,
            fc.shuffledSubarray(scenario.nodes, { minLength: scenario.nodes.length, maxLength: scenario.nodes.length }),
          ),
        ),
        ([scenario, boardSettings, marks, index, changes, shuffled]) => {
          const base = checkMood(scenario, boardSettings, marks, rules);
          expect(base.ok).toBe(true);
          if (!base.ok) return;

          // Transform of one Image_Node: report is unchanged.
          const target = scenario.nodes[index];
          if (target !== undefined) {
            const changed = applyCommand(scenario, { kind: "updateNode", id: target.id, changes });
            expect(changed.ok).toBe(true);
            if (!changed.ok) return;
            const after = checkMood(changed.scenario, boardSettings, marks, rules);
            expect(after.ok).toBe(true);
            if (!after.ok) return;
            expect(after.value.curve).toStrictEqual(base.value.curve);
            expect(after.value.flags).toStrictEqual(base.value.flags);
            expect(after.value.effects).toStrictEqual(base.value.effects);
          }

          // Node order: Zone_Values agree within the tolerance, same Zone ids.
          const permuted = checkMood({ ...scenario, nodes: shuffled }, boardSettings, marks, rules);
          expect(permuted.ok).toBe(true);
          if (!permuted.ok) return;
          expect(permuted.value.curve.attributes).toHaveLength(base.value.curve.attributes.length);
          base.value.curve.attributes.forEach((attr, i) => {
            const other = permuted.value.curve.attributes[i];
            expect(other?.attribute).toBe(attr.attribute);
            expect(other?.noData).toStrictEqual(attr.noData);
            expect(other?.series.map((p) => p.zone)).toStrictEqual(attr.series.map((p) => p.zone));
            attr.series.forEach((p, k) => {
              const q = other?.series[k]?.value ?? Number.NaN;
              expect(Math.abs(q - p.value)).toBeLessThanOrEqual(1e-9 * (1 + Math.abs(p.value)));
            });
          });

          // Ranges.
          for (const attr of base.value.curve.attributes) {
            const [lo, hi] = attr.attribute === "brightness" ? [0, 1] : [-1, 1];
            for (const p of attr.series) {
              expect(p.value).toBeGreaterThanOrEqual(lo - 1e-9);
              expect(p.value).toBeLessThanOrEqual(hi + 1e-9);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("checkMood threshold properties", () => {
  const zonesOf = (flags: { zone: string; reason: { kind: string } }[], kind: string): Set<string> =>
    new Set(flags.filter((f) => f.reason.kind === kind).map((f) => f.zone));
  const isSubset = (a: Set<string>, b: Set<string>): boolean => [...a].every((z) => b.has(z));

  // Feature: app-moodwalk, Property 6: thresholds are monotone
  // **Validates: Requirements 9.9, 9.10, 9.11**
  it("P-APP2-6 thresholds are monotone", () => {
    const delta = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(
        boardArb.chain((scenario) =>
          fc.tuple(
            fc.constant(scenario),
            settingsArb.map((s) => ({ ...s })),
            marksArb(scenario.zones),
            delta,
            delta,
            fc.nat({ max: 4 }),
          ),
        ),
        ([scenario, s, marks, dShift, dTol, dLen]) => {
          const base = checkMood(scenario, s, marks, rules);
          expect(base.ok).toBe(true);
          if (!base.ok) return;

          const larger = checkMood(scenario, { ...s, shiftThreshold: s.shiftThreshold + dShift }, marks, rules);
          expect(larger.ok).toBe(true);
          if (larger.ok) {
            expect(
              isSubset(zonesOf(larger.value.flags, "sudden-brightening"), zonesOf(base.value.flags, "sudden-brightening")),
            ).toBe(true);
          }

          const longer = checkMood(scenario, { ...s, minRunLength: s.minRunLength + dLen }, marks, rules);
          expect(longer.ok).toBe(true);
          if (longer.ok) {
            expect(
              isSubset(zonesOf(longer.value.flags, "same-mood-too-long"), zonesOf(base.value.flags, "same-mood-too-long")),
            ).toBe(true);
          }

          const tighter = checkMood(scenario, { ...s, runTolerance: Math.max(0, s.runTolerance - dTol) }, marks, rules);
          expect(tighter.ok).toBe(true);
          if (tighter.ok) {
            expect(
              isSubset(zonesOf(tighter.value.flags, "same-mood-too-long"), zonesOf(base.value.flags, "same-mood-too-long")),
            ).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("checkMood marks and flag-effect pairing", () => {
  type Ref = {
    series: Map<string, { zone: string; value: number }[]>;
    noData: Map<string, string[]>;
    sudden: string[];
    sameMood: string[];
    sameMoodRuns: string[][];
    valued: string[];
  };

  /** Reference computed from the Scenario alone (no core series code). */
  function reference(scenario: Scenario, s: BoardSettings, marks: readonly string[]): Ref {
    const ordered = [...scenario.zones].sort((a, b) => a.order - b.order);
    const series = new Map<string, { zone: string; value: number }[]>();
    const noData = new Map<string, string[]>();
    const runs = new Map<string, string[][]>();
    const changesOf = new Map<string, { from: string; to: string; change: number }[]>();
    for (const attribute of ["brightness", "temperature"]) {
      const points: { zone: string; value: number }[] = [];
      const missing: string[] = [];
      for (const z of ordered) {
        let sum = 0;
        let count = 0;
        for (const n of scenario.nodes) {
          const v = n.attributes[attribute];
          if (n.zone === z.id && v !== undefined) {
            sum += v;
            count += 1;
          }
        }
        if (count === 0) missing.push(z.id);
        else points.push({ zone: z.id, value: sum / count });
      }
      series.set(attribute, points);
      noData.set(attribute, missing);
      const changes = points.slice(1).map((p, i) => ({
        from: points[i].zone,
        to: p.zone,
        change: p.value - points[i].value,
      }));
      changesOf.set(attribute, changes);
      const attrRuns: string[][] = [];
      let start = 0;
      for (let i = 1; i <= points.length; i += 1) {
        if (i < points.length && Math.abs(changes[i - 1].change) <= s.runTolerance) continue;
        if (i - start >= s.minRunLength) attrRuns.push(points.slice(start, i).map((p) => p.zone));
        start = i;
      }
      runs.set(attribute, attrRuns);
    }
    const sameMoodRuns: string[][] = [];
    for (const b of runs.get("brightness") ?? []) {
      for (const t of runs.get("temperature") ?? []) {
        const common = b.filter((z) => t.includes(z));
        if (common.length >= s.minRunLength) sameMoodRuns.push(common);
      }
    }
    const sudden = (changesOf.get("brightness") ?? [])
      .filter((c) => c.change > s.shiftThreshold && !marks.includes(c.to))
      .map((c) => c.to);
    return {
      series,
      noData,
      sudden,
      sameMood: sameMoodRuns.flat(),
      sameMoodRuns,
      valued: (series.get("brightness") ?? []).map((p) => p.zone),
    };
  }

  const kindOfEffect: Record<string, string> = {
    "sudden-brightening-fog": "sudden-brightening",
    "same-mood-fog": "same-mood-too-long",
  };
  const sorted = (a: Iterable<string>): string[] => [...a].sort();

  // Feature: app-moodwalk, Property 7: marks only remove warnings, and every effect has a flag
  // **Validates: Requirements 7.1, 7.2, 9.1, 9.2, 9.3, 9.4, 10.4, 10.6**
  it("P-APP2-7 marks only remove warnings, and every effect has a flag", () => {
    fc.assert(
      fc.property(
        boardArb.chain((scenario) =>
          fc.tuple(
            fc.constant(scenario),
            settingsArb.map((s) => ({ ...s })),
            marksArb(scenario.zones),
            fc.constantFrom(...scenario.zones.map((z) => z.id)),
          ),
        ),
        ([scenario, s, marks, extra]) => {
          const out = checkMood(scenario, s, marks, rules);
          expect(out.ok).toBe(true);
          if (!out.ok) return;
          const ref = reference(scenario, s, marks);
          const { flags, effects, curve } = out.value;

          // Flags against the reference.
          const sudden = flags.filter((f) => f.reason.kind === "sudden-brightening").map((f) => f.zone);
          const same = flags.filter((f) => f.reason.kind === "same-mood-too-long").map((f) => f.zone);
          expect(sorted(sudden)).toStrictEqual(sorted(ref.sudden));
          expect(sorted(same)).toStrictEqual(sorted(ref.sameMood));
          expect(new Set(sudden).size).toBe(sudden.length);
          expect(new Set(same).size).toBe(same.length);
          expect(out.value.sameMoodRuns).toStrictEqual(ref.sameMoodRuns);
          for (const run of ref.sameMoodRuns) {
            const at = ref.valued.indexOf(run[0]);
            expect(at).toBeGreaterThanOrEqual(0);
            expect(ref.valued.slice(at, at + run.length)).toStrictEqual(run);
          }

          // Mood_Curve.
          for (const attr of curve.attributes) {
            expect(attr.series).toStrictEqual(ref.series.get(attr.attribute));
            expect(attr.noData).toStrictEqual(ref.noData.get(attr.attribute));
          }

          // Every effect has exactly one matching flag, every flag exactly one effect.
          for (const e of effects) {
            expect(e.target.kind).toBe("zone");
            const kind = kindOfEffect[e.effect];
            expect(kind).toBeDefined();
            expect(flags.filter((f) => f.zone === e.target.id && f.reason.kind === kind)).toHaveLength(1);
          }
          for (const f of flags) {
            const matching = effects.filter(
              (e) => e.target.id === f.zone && kindOfEffect[e.effect] === f.reason.kind,
            );
            expect(matching).toHaveLength(1);
          }
          expect(effects).toHaveLength(flags.length);

          // Adding a mark only removes warnings.
          const more = checkMood(scenario, s, [...marks, extra], rules);
          expect(more.ok).toBe(true);
          if (!more.ok) return;
          const keyOf = (v: unknown): string => JSON.stringify(v);
          const baseFlags = new Set(flags.map(keyOf));
          const baseEffects = new Set(effects.map(keyOf));
          expect(more.value.flags.every((f) => baseFlags.has(keyOf(f)))).toBe(true);
          expect(more.value.effects.every((e) => baseEffects.has(keyOf(e)))).toBe(true);
          const sameOf = (fl: typeof flags): unknown[] => fl.filter((f) => f.reason.kind === "same-mood-too-long");
          expect(sameOf(more.value.flags)).toStrictEqual(sameOf(flags));
          expect(more.value.curve).toStrictEqual(curve);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Example 1 of R-APP2-09.3 gives no flag for Run_Intersection [C]", () => {
    const rows: Row[] = [
      { id: "A", b: 0.5, t: -0.9 },
      { id: "B", b: 0.5, t: 0.9 },
      { id: "C", b: 0.5, t: 0 },
      { id: "D", b: 0.1, t: 0 },
      { id: "E", b: 0.8, t: 0 },
    ];
    const out = checkMood(board(rows), settings, [], rules);
    expect(out.ok && out.value.flags.filter((f) => f.reason.kind === "same-mood-too-long")).toStrictEqual([]);
  });

  it("Example 2 of R-APP2-09.3 (X, A, B, C, D, Y) gives no same-mood flag", () => {
    const rows: Row[] = [
      { id: "X", b: 0.2, t: 0 },
      { id: "A", b: 0.5, t: 0 },
      { id: "B", b: 0.5, t: 0 },
      { id: "C", b: 0.5, t: 0.5 },
      { id: "D", b: 0.5, t: 0.5 },
      { id: "Y", b: 0.2, t: 0.5 },
    ];
    const out = checkMood(board(rows), settings, [], rules);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.flags.filter((f) => f.reason.kind === "same-mood-too-long")).toStrictEqual([]);
    expect(out.value.effects.filter((e) => e.effect === "same-mood-fog")).toStrictEqual([]);
  });

  it("a Zone in Long_Runs of both attributes only through short Run_Intersections gets no flag", () => {
    const rows: Row[] = [
      { id: "X", b: 0.2, t: 0 },
      { id: "A", b: 0.5, t: 0 },
      { id: "B", b: 0.5, t: 0 },
      { id: "C", b: 0.5, t: 0.5 },
      { id: "D", b: 0.5, t: 0.5 },
      { id: "Y", b: 0.2, t: 0.5 },
    ];
    const out = checkMood(board(rows), settings, [], rules);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.brightness.longRuns.flat()).toContain("C");
    expect(out.value.temperature?.longRuns.flat()).toContain("C");
    expect(out.value.flags.filter((f) => f.zone === "C")).toStrictEqual([]);
    expect(out.value.effects.filter((e) => e.target.id === "C")).toStrictEqual([]);
  });
});
