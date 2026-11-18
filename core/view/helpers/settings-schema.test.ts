import { isDeepStrictEqual } from "node:util";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { extraFieldsArb, jsonEqual, scenarioArb } from "../../model/arbitraries.ts";
import { settingsArb, settingsMutationArb, themeArb, themeMutationArb } from "./arbitraries.ts";
import { loadViewSettings } from "./settings-schema.ts";
import { loadTheme } from "./theme-schema.ts";

const pose = (x = 0) => ({ position: { x, y: 5, z: 8 }, target: { x, y: 0, z: 0 } });
const filter = { edgeRule: "bothEnds" as const };

function valid() {
  return {
    zoneFootprints: [
      { kind: "rect", id: "area-a", x: 0, z: 0, width: 4, depth: 4 },
      { kind: "rect", id: "area-b", x: 5, z: 0, width: 4, depth: 4 },
      { kind: "ring", id: "area-c", x: 10, z: 0, innerRadius: 1, outerRadius: 3 },
    ],
    presets: [
      { id: "overview", label: { en: "Overview", ja: "全体" }, pose: pose(0), filter },
      { id: "low-front", label: { en: "Low front" }, pose: pose(2), filter: { zones: ["area-a"], edgeRule: "anyEnd" as const } },
    ],
    paths: [{ id: "tour", fromZones: { height: 1.6 } }],
    detailDistance: 4,
    snapStep: 0.5,
    wallHeight: 2,
    editMode: "edit",
    stepDuration: 1.5,
  };
}

function errorsOf(value: unknown): { path: string; message: string }[] {
  const r = loadViewSettings(value);
  if (r.ok) throw new Error("expected failure");
  return r.errors;
}

describe("loadViewSettings", () => {
  it("loads the example View_Settings unchanged", () => {
    const input = valid();
    const r = loadViewSettings(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.settings).toEqual(valid());
  });

  it("removes unknown fields at every level", () => {
    const input = { ...valid(), extra: 1 } as Record<string, unknown>;
    (input["presets"] as Record<string, unknown>[])[0]["extra"] = 2;
    const r = loadViewSettings(input);
    expect(r.ok && r.settings).toEqual(valid());
  });

  it("02.4 reports later duplicate preset ids at their index", () => {
    const v = valid();
    v.presets = [v.presets[0], { ...v.presets[0] }, { ...v.presets[0] }];
    expect(errorsOf(v).map((e) => e.path)).toEqual(["presets.1.id", "presets.2.id"]);
  });

  it("02.4 reports duplicate paths and footprints after presets", () => {
    const v = valid();
    v.presets = [v.presets[0], { ...v.presets[0] }];
    v.paths = [v.paths[0], { ...v.paths[0] }];
    v.zoneFootprints = [v.zoneFootprints[0], { ...v.zoneFootprints[0] }] as typeof v.zoneFootprints;
    expect(errorsOf(v).map((e) => e.path)).toEqual(["presets.1.id", "paths.1.id", "zoneFootprints.1.id"]);
  });

  it("02.5 reports missing and empty presets at `presets`", () => {
    const rest: Record<string, unknown> = { ...valid() };
    delete rest["presets"];
    expect(errorsOf(rest).map((e) => e.path)).toEqual(["presets"]);
    expect(errorsOf({ ...valid(), presets: [] }).map((e) => e.path)).toEqual(["presets"]);
  });

  it("02.6 reports a degenerate pose at target", () => {
    const v = valid();
    v.presets[0].pose = { position: { x: 1, y: 2, z: 3 }, target: { x: 1, y: 2, z: 3 } };
    expect(errorsOf(v)).toEqual([{ path: "presets.0.pose.target", message: "position and target must differ" }]);
  });

  it("02.6 reports a degenerate waypoint pose", () => {
    const v = valid();
    const same = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } };
    (v.paths as unknown[]) = [{ id: "p", waypoints: [pose(), same] }];
    expect(errorsOf(v).map((e) => e.path)).toEqual(["paths.0.waypoints.1.target"]);
  });

  it("02.6 reports ring radii at innerRadius", () => {
    for (const [inner, outer] of [[-1, 3], [3, 3], [4, 3]] as const) {
      const v = valid();
      v.zoneFootprints[2] = { kind: "ring", id: "area-c", x: 0, z: 0, innerRadius: inner, outerRadius: outer };
      expect(errorsOf(v).map((e) => e.path)).toEqual(["zoneFootprints.2.innerRadius"]);
    }
  });

  it("02.6 reports rect width and depth that are not positive", () => {
    const v = valid();
    v.zoneFootprints[0] = { kind: "rect", id: "area-a", x: 0, z: 0, width: 0, depth: -1 };
    expect(errorsOf(v).map((e) => e.path)).toEqual(["zoneFootprints.0.width", "zoneFootprints.0.depth"]);
  });

  it("02.6 reports camera path source faults", () => {
    const wp = [pose(), pose(1)];
    const cases: [unknown, string[]][] = [
      [{ id: "p", waypoints: [pose()] }, ["paths.0.waypoints"]],
      [{ id: "p", waypoints: wp, fromZones: { height: 1 } }, ["paths.0"]],
      [{ id: "p" }, ["paths.0"]],
    ];
    for (const [path, expected] of cases) {
      const v = valid();
      (v.paths as unknown[]) = [path];
      const errors = errorsOf(v);
      expect(errors.map((e) => e.path)).toEqual(expected);
      expect(errors.every((e) => e.message.length > 0)).toBe(true);
    }
    const v = valid();
    (v.paths as unknown[]) = [{ id: "p" }];
    expect(errorsOf(v)[0].message).toBe("a camera path needs exactly one of waypoints and fromZones");
  });

  it("reports the shape error before duplicate ids", () => {
    const v = valid();
    v.presets = [v.presets[0], { ...v.presets[0] }];
    v.snapStep = 0;
    expect(errorsOf(v).map((e) => e.path)).toEqual(["snapStep"]);
  });

  it("02.7 returns a failure for any value, without throwing or changing the input", () => {
    for (const value of [null, undefined, 42, "x", []]) {
      const before = JSON.stringify(value);
      const r = loadViewSettings(value);
      expect(r.ok).toBe(false);
      expect(JSON.stringify(value)).toBe(before);
    }
  });

  it("returns the same errors in the same order on two calls", () => {
    const v = { ...valid(), snapStep: -1, wallHeight: 0 };
    expect(errorsOf(v)).toEqual(errorsOf(structuredClone(v)));
  });
});

type Loader = (value: unknown) => { ok: boolean; errors?: { path: string; message: string }[] } & Record<string, unknown>;
const loadSettings = loadViewSettings as Loader;
const loadThemeValue = loadTheme as Loader;

/** Paths (key lists) of every plain object in `value`, skipping the subtrees named in `skip`. */
function objectPaths(value: unknown, skip: ReadonlySet<string>, at: string[] = []): string[][] {
  if (typeof value !== "object" || value === null) return [];
  const own = Array.isArray(value) ? [] : [at];
  return [
    ...own,
    ...Object.entries(value).flatMap(([k, v]) => (at.length === 0 && skip.has(k) ? [] : objectPaths(v, skip, [...at, k]))),
  ];
}

function addExtras(value: unknown, at: readonly string[], extras: Record<string, unknown>): unknown {
  if (at.length === 0) {
    return Object.fromEntries([...Object.entries(value as object), ...Object.entries(extras)]);
  }
  const [head, ...rest] = at as [string, ...string[]];
  if (Array.isArray(value)) {
    return value.map((item: unknown, i) => (String(i) === head ? addExtras(item, rest, extras) : item));
  }
  return Object.fromEntries(
    Object.entries(value as object).map(([k, v]) => [k, k === head ? addExtras(v, rest, extras) : v]),
  );
}

describe("P-VIEW-8 settings and themes are checked without throwing", () => {
  // Feature: core-view, Property 8: settings and themes are checked without throwing
  // **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 19.2, 19.3, 19.4, 19.5**
  it("P-VIEW-8 both loaders return a result without throwing and keep their input", () => {
    for (const load of [loadSettings, loadThemeValue]) {
      fc.assert(
        fc.property(fc.oneof(fc.anything(), fc.jsonValue()), (value) => {
          const before = structuredClone(value);
          const result = load(value);
          expect(typeof result.ok).toBe("boolean");
          expect(isDeepStrictEqual(value, before)).toBe(true);
        }),
        { numRuns: 200 },
      );
    }
  });

  it("P-VIEW-8 each mutation fails with its Field_Path, in the same order twice", () => {
    const check = (load: Loader, mutation: { value: unknown; path: string }): void => {
      const first = load(mutation.value);
      const second = load(mutation.value);
      expect(first.ok).toBe(false);
      expect(first.errors?.map((e) => e.path)).toContain(mutation.path);
      expect(second.errors).toEqual(first.errors);
    };
    fc.assert(fc.property(settingsMutationArb, (m) => check(loadSettings, m)), { numRuns: 200 });
    fc.assert(fc.property(themeMutationArb, (m) => check(loadThemeValue, m)), { numRuns: 200 });
  });

  it("P-VIEW-8 extra fields at fixed-shape levels change nothing", () => {
    const run = (load: Loader, valid: unknown, skip: ReadonlySet<string>, pick: number, extras: Record<string, unknown>) => {
      const base = load(valid);
      expect(base.ok).toBe(true);
      const paths = objectPaths(valid, skip);
      const at = paths[pick % paths.length] ?? [];
      const result = load(addExtras(valid, at, extras));
      expect(result.ok).toBe(true);
      expect(jsonEqual(result, base)).toBe(true);
    };
    fc.assert(
      fc.property(scenarioArb.chain((s) => settingsArb(s)), fc.nat(), extraFieldsArb, (v, pick, extras) =>
        run(loadSettings, v, new Set(), pick, extras),
      ),
      { numRuns: 200 },
    );
    fc.assert(
      fc.property(themeArb, fc.nat(), extraFieldsArb, (t, pick, extras) =>
        run(loadThemeValue, t, new Set(["nodes", "edges", "effects"]), pick, extras),
      ),
      { numRuns: 200 },
    );
  });

  it("P-VIEW-8 every Theme map key stays an own key", () => {
    fc.assert(
      fc.property(themeArb, (t) => {
        const r = loadTheme(t);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        for (const map of ["nodes", "edges", "effects"] as const) {
          expect(Object.keys(r.theme[map]).sort()).toEqual(Object.keys(t[map]).sort());
          for (const key of Object.keys(t[map])) expect(Object.hasOwn(r.theme[map], key)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
