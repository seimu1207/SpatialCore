import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { attrPool, flatZoneScenarioArb, marksArb, ruleScenarioArb, selectorArb, seriesSettingsArb } from "./arbitraries.ts";
import { buildIndex, matchSelector } from "./graph-index.ts";
import { checkSeries, checkSeriesList, sumAttribute } from "./series.ts";
import type { SeriesSettings } from "./rule-schema.ts";
import type { Node, Scenario, Zone } from "./scenario-schema.ts";

const origin = { x: 0, y: 0, z: 0 };

function item(id: string, attributes: Record<string, number>, zone?: string): Node {
  return {
    id,
    type: "item",
    position: origin,
    rotation: origin,
    scale: { x: 1, y: 1, z: 1 },
    front: { text: { en: id } },
    metadata: {},
    attributes,
    ...(zone === undefined ? {} : { zone }),
  };
}

function zoneOf(id: string, order: number): Zone {
  return { id, label: { en: id }, order, elevation: 0, enclosed: false };
}

function scenarioOf(nodes: Node[], zones: Zone[] = []): Scenario {
  return { schemaVersion: 1, id: "s1", title: { en: "t" }, nodes, edges: [], zones };
}

const settings: SeriesSettings = {
  attribute: "level",
  zoneValue: "mean",
  shiftThreshold: 30,
  direction: "up",
  runTolerance: 5,
  minRunLength: 3,
};

const zonesABCD = [zoneOf("a", 0), zoneOf("b", 1), zoneOf("c", 2), zoneOf("d", 3)];
const designExample = scenarioOf(
  [item("n1", { level: 10 }, "a"), item("n2", { level: 12 }, "b"), item("n3", { level: 50 }, "c"), item("n4", { level: 48 }, "d")],
  zonesABCD,
);

describe("sumAttribute", () => {
  it("fails with one error naming the attribute for two Number.MAX_VALUE values (9.4)", () => {
    const sc = scenarioOf([item("n1", { v: Number.MAX_VALUE }), item("n2", { v: Number.MAX_VALUE })]);
    const r = sumAttribute(sc, {}, "v");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.path).toBe("attribute");
    expect(r.errors[0]?.message).toContain('"v"');
  });

  it("returns the unresolved references with the sum of the picked Nodes (9.6)", () => {
    const sc = scenarioOf([item("n1", { v: 2 }), item("n2", { v: 3 }), item("n3", { w: 9 })]);
    const r = sumAttribute(sc, { ids: ["n1", "n3", "zz", "aa"] }, "v");
    expect(r).toStrictEqual({ ok: true, value: { sum: 2, count: 1, unresolved: ["aa", "zz"] } });
  });
});

describe("checkSeries", () => {
  it("gives an empty series and no failure when no Node has a zone (10.2)", () => {
    const sc = scenarioOf([item("n1", { level: 1 }), item("n2", { level: 2 })], [zoneOf("a", 0)]);
    const r = checkSeries(sc, settings, []);
    expect(r).toStrictEqual({
      ok: true,
      value: { attribute: "level", series: [], changes: [], shifts: [], longRuns: [], unresolved: [] },
    });
  });

  it("gives an empty series when the Scenario has no Zone (10.2)", () => {
    const r = checkSeries(scenarioOf([item("n1", { level: 1 })]), settings, []);
    expect(r.ok && r.value.series).toStrictEqual([]);
  });

  it("returns one error for an overflowing Zone_Value (10.5)", () => {
    const sc = scenarioOf(
      [item("n1", { level: Number.MAX_VALUE }, "a"), item("n2", { level: Number.MAX_VALUE }, "a"), item("n3", { level: 1 }, "b")],
      [zoneOf("a", 0), zoneOf("b", 1)],
    );
    const r = checkSeries(sc, { ...settings, zoneValue: "sum" }, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.path).toBe("settings.attribute");
    expect(r.errors[0]?.message).toContain('"level"');
    expect(r.errors[0]?.message).toContain('"a"');
  });

  it("returns one error for an overflowing Step_Change, naming the later Zone (10.5)", () => {
    const sc = scenarioOf(
      [item("n1", { level: Number.MAX_VALUE }, "a"), item("n2", { level: -Number.MAX_VALUE }, "b")],
      [zoneOf("a", 0), zoneOf("b", 1)],
    );
    const r = checkSeries(sc, settings, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.path).toBe("settings.attribute");
    expect(r.errors[0]?.message).toContain('"level"');
    expect(r.errors[0]?.message).toContain('"b"');
  });

  it("reports each bad settings field at settings.<field> (10.6)", () => {
    const bad = {
      attribute: "",
      zoneValue: "median",
      shiftThreshold: -1,
      direction: "sideways",
      runTolerance: -2,
      minRunLength: 1,
    } as unknown as SeriesSettings;
    const r = checkSeries(designExample, bad, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path).sort()).toStrictEqual(
      [
        "settings.attribute",
        "settings.zoneValue",
        "settings.shiftThreshold",
        "settings.direction",
        "settings.runTolerance",
        "settings.minRunLength",
      ].sort(),
    );
  });

  it("reports a non-integer minRunLength and a missing field (10.6)", () => {
    const r = checkSeries(designExample, { ...settings, minRunLength: 2.5, direction: undefined } as unknown as SeriesSettings, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path).sort()).toStrictEqual(["settings.direction", "settings.minRunLength"]);
  });

  it("reports each bad settings field at settings.<index>.<field> in a list (10.6)", () => {
    const bad = { ...settings, attribute: "other", shiftThreshold: -1, minRunLength: 1 };
    const r = checkSeriesList(designExample, [settings, bad], []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path).sort()).toStrictEqual(["settings.1.minRunLength", "settings.1.shiftThreshold"]);
  });

  it("never reports a change equal to the threshold as a Shift (11.3)", () => {
    const sc = scenarioOf([item("n1", { level: 0 }, "a"), item("n2", { level: 30 }, "b"), item("n3", { level: 0 }, "c")], [
      zoneOf("a", 0),
      zoneOf("b", 1),
      zoneOf("c", 2),
    ]);
    for (const direction of ["up", "down", "both"] as const) {
      const r = checkSeries(sc, { ...settings, direction }, []);
      expect(r.ok && r.value.shifts).toStrictEqual([]);
    }
  });

  it("lists a mark naming no Zone as unresolved and ignores other marks (11.7)", () => {
    const r = checkSeries(designExample, settings, ["zz", "a", "c", "c", "aa", "zz"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.unresolved).toStrictEqual(["aa", "zz"]);
    expect(r.value.shifts).toStrictEqual([{ from: "b", to: "c", change: 38, intentional: true }]);
  });

  it("matches the series example of the design", () => {
    const r = checkSeries(designExample, settings, []);
    expect(r).toStrictEqual({
      ok: true,
      value: {
        attribute: "level",
        series: [
          { zone: "a", value: 10 },
          { zone: "b", value: 12 },
          { zone: "c", value: 50 },
          { zone: "d", value: 48 },
        ],
        changes: [
          { from: "a", to: "b", change: 2 },
          { from: "b", to: "c", change: 38 },
          { from: "c", to: "d", change: -2 },
        ],
        shifts: [{ from: "b", to: "c", change: 38, intentional: false }],
        longRuns: [],
        unresolved: [],
      },
    });
  });
});

describe("checkSeriesList", () => {
  it("reports each repeated attribute after the first at settings.<index>.attribute (11.9)", () => {
    const r = checkSeriesList(designExample, [settings, { ...settings, attribute: "other" }, settings, settings], []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path)).toStrictEqual(["settings.2.attribute", "settings.3.attribute"]);
  });
});

describe("sums (property)", () => {
  // Feature: core-rules, P-RULES-8: sums
  it("P-RULES-8: sumAttribute equals a reference loop and ignores the order of nodes", () => {
    // **Validates: Requirements 9.1, 9.2, 9.3, 9.5**
    fc.assert(
      fc.property(
        ruleScenarioArb.chain((s) =>
          fc.tuple(
            fc.constant(s),
            selectorArb(s, { self: false }),
            fc.constantFrom(...attrPool),
            fc.shuffledSubarray(s.nodes, { minLength: s.nodes.length, maxLength: s.nodes.length }),
          ),
        ),
        ([s, selector, name, shuffled]) => {
          const g = buildIndex(s);
          const picked = matchSelector(g, selector);
          let sum = 0;
          let count = 0;
          s.nodes.forEach((n, i) => {
            if (picked[i] === true && Object.hasOwn(n.attributes, name)) {
              sum += n.attributes[name] ?? 0;
              count += 1;
            }
          });
          const r = sumAttribute(s, selector, name);
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          expect(r.value.sum).toBe(sum);
          expect(r.value.count).toBe(count);
          if (count === 0) {
            expect(r.value.sum).toBe(0);
          }
          const permuted = sumAttribute({ ...s, nodes: shuffled }, selector, name);
          expect(permuted.ok).toBe(true);
          if (!permuted.ok) return;
          expect(permuted.value.sum).toBe(r.value.sum);
          expect(permuted.value.count).toBe(r.value.count);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("shifts (property)", () => {
  const ok = <T>(r: { ok: boolean; value?: T }): T => {
    expect(r.ok).toBe(true);
    return r.value as T;
  };

  // Feature: core-rules, P-RULES-9: shift detection
  it("P-RULES-9: series matches a reference, mean shifts ignore an offset, thresholds are monotonic, marks only set intentional, both is up plus down, list equals single results", () => {
    // **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.8**
    fc.assert(
      fc.property(
        flatZoneScenarioArb.chain((s) =>
          fc.tuple(
            fc.constant(s),
            seriesSettingsArb,
            marksArb(s),
            marksArb(s),
            fc.integer({ min: -500, max: 500 }),
            fc.integer({ min: 0, max: 20 }),
            fc.uniqueArray(seriesSettingsArb, { selector: (x) => x.attribute, maxLength: attrPool.length }),
          ),
        ),
        ([s, st, marksA, marksB, offset, extra, list]) => {
          const base = ok(checkSeries(s, st, []));

          // Reference series and changes.
          const refSeries: { zone: string; value: number }[] = [];
          for (const z of [...s.zones].sort((a, b) => a.order - b.order)) {
            const vals = s.nodes
              .filter((n) => n.zone === z.id && Object.hasOwn(n.attributes, st.attribute))
              .map((n) => n.attributes[st.attribute] ?? 0);
            if (vals.length === 0) continue;
            const total = vals.reduce((a, b) => a + b, 0);
            refSeries.push({ zone: z.id, value: st.zoneValue === "sum" ? total : total / vals.length });
          }
          expect(base.series).toStrictEqual(refSeries);
          expect(base.changes).toHaveLength(Math.max(refSeries.length - 1, 0));
          base.changes.forEach((c, i) => {
            expect(c.change).toBe((refSeries[i + 1]?.value ?? 0) - (refSeries[i]?.value ?? 0));
          });

          // Offset invariance for mean.
          const mean = { ...st, zoneValue: "mean" as const };
          const shifted: Scenario = {
            ...s,
            nodes: s.nodes.map((n) =>
              Object.hasOwn(n.attributes, st.attribute)
                ? { ...n, attributes: Object.fromEntries(Object.entries(n.attributes).map(([k, v]) => [k, k === st.attribute ? v + offset : v])) }
                : n,
            ),
          };
          expect(ok(checkSeries(shifted, mean, [])).shifts).toStrictEqual(ok(checkSeries(s, mean, [])).shifts);

          // Threshold monotonicity.
          const raised = ok(checkSeries(s, { ...st, shiftThreshold: st.shiftThreshold + extra }, []));
          for (const sh of raised.shifts) expect(base.shifts).toContainEqual(sh);

          // Marks change only intentional (and unresolved).
          const marked = ok(checkSeries(s, st, marksA));
          expect(marked.series).toStrictEqual(base.series);
          expect(marked.changes).toStrictEqual(base.changes);
          expect(marked.longRuns).toStrictEqual(base.longRuns);
          const bare = (x: { from: string; to: string; change: number }) => ({ from: x.from, to: x.to, change: x.change });
          expect(marked.shifts.map(bare)).toStrictEqual(base.shifts.map(bare));
          const markSet = new Set(marksA);
          marked.shifts.forEach((sh) => expect(sh.intentional).toBe(markSet.has(sh.to)));
          const more = ok(checkSeries(s, st, [...marksA, ...marksB]));
          more.shifts.forEach((sh, i) => {
            if (marked.shifts[i]?.intentional === true) expect(sh.intentional).toBe(true);
          });

          // both = union of up and down, in series order.
          const up = ok(checkSeries(s, { ...st, direction: "up" }, marksA)).shifts;
          const down = ok(checkSeries(s, { ...st, direction: "down" }, marksA)).shifts;
          const both = ok(checkSeries(s, { ...st, direction: "both" }, marksA));
          const keys = new Set([...up, ...down].map((x) => `${x.from}>${x.to}`));
          expect(both.shifts).toStrictEqual(both.changes.flatMap((c) => {
            const hit = [...up, ...down].find((x) => x.from === c.from && x.to === c.to);
            return keys.has(`${c.from}>${c.to}`) && hit !== undefined ? [hit] : [];
          }));

          // List equals single results.
          const many = ok(checkSeriesList(s, list, marksA));
          expect(many).toStrictEqual(list.map((item) => ok(checkSeries(s, item, marksA))));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("long runs (property)", () => {
  // Feature: core-rules, P-RULES-10: long runs
  it("P-RULES-10: runs are ordered, disjoint, long enough, within tolerance, maximal, and monotonic in minRunLength and runTolerance", () => {
    // **Validates: Requirements 11.6**
    fc.assert(
      fc.property(
        flatZoneScenarioArb.chain((s) =>
          fc.tuple(fc.constant(s), seriesSettingsArb, fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 20 })),
        ),
        ([s, st, moreLen, lessTol]) => {
          const get = (x: SeriesSettings) => {
            const r = checkSeries(s, x, []);
            expect(r.ok).toBe(true);
            if (!r.ok) throw new Error("series failed");
            return r.value;
          };
          const base = get(st);
          const zones = base.series.map((p) => p.zone);
          const used = new Set<string>();
          let prevEnd = -1;
          for (const run of base.longRuns) {
            expect(run.length).toBeGreaterThanOrEqual(st.minRunLength);
            const first = zones.indexOf(run[0] ?? "");
            expect(first).toBeGreaterThan(prevEnd);
            run.forEach((z, k) => {
              expect(zones[first + k]).toBe(z);
              expect(used.has(z)).toBe(false);
              used.add(z);
            });
            const last = first + run.length - 1;
            prevEnd = last;
            for (let i = first; i < last; i += 1) {
              expect(Math.abs(base.changes[i]?.change ?? Infinity)).toBeLessThanOrEqual(st.runTolerance);
            }
            if (first > 0) expect(Math.abs(base.changes[first - 1]?.change ?? 0)).toBeGreaterThan(st.runTolerance);
            if (last < zones.length - 1) {
              expect(Math.abs(base.changes[last]?.change ?? 0)).toBeGreaterThan(st.runTolerance);
            }
          }
          const union = (r: { longRuns: string[][] }) => new Set(r.longRuns.flat());
          const baseUnion = union(base);
          const longer = union(get({ ...st, minRunLength: st.minRunLength + moreLen }));
          for (const z of longer) expect(baseUnion.has(z)).toBe(true);
          const tighter = union(get({ ...st, runTolerance: Math.max(0, st.runTolerance - lessTol) }));
          for (const z of tighter) expect(baseUnion.has(z)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
