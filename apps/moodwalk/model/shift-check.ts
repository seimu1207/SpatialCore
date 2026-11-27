import { buildEffects } from "../../../core/model/effects.ts";
import { checkSeriesList } from "../../../core/model/series.ts";
import type {
  EffectRequest,
  JudgementResults,
  RuleDefinition,
  RuleOutcome,
  SeriesResult,
  SeriesSettings,
} from "../../../core/model/rule-schema.ts";
import type { LocalizedText, Scenario } from "../../../core/model/scenario-schema.ts";
import type { BoardSettings } from "./board-settings.ts";
import { FALLBACK, type Fallback } from "./fallback.ts";
import {
  ATTR_BRIGHTNESS,
  ATTR_SAME_MOOD,
  ATTR_TEMPERATURE,
  FLAG_SAME_MOOD_TOO_LONG,
  FLAG_SUDDEN_BRIGHTENING,
} from "./names.ts";

export type CurveSeries = { attribute: string; series: { zone: string; value: number }[]; noData: string[] };
export type MoodCurve = {
  zones: { id: string; label: LocalizedText; order: number }[];
  attributes: CurveSeries[];
};
export type FlagReason =
  | { kind: "sudden-brightening"; from: string; change: number; threshold: number }
  | { kind: "same-mood-too-long"; run: string[]; minRunLength: number; runTolerance: number };
export type MoodFlag = { zone: string; reason: FlagReason };
export type MoodReport = {
  curve: MoodCurve;
  flags: MoodFlag[];
  effects: EffectRequest[];
  sameMoodRuns: string[][];
  brightness: SeriesResult;
  temperature: SeriesResult | null;
};

/** Series_Settings in the order brightness, temperature (only brightness under `brightnessOnly`). */
export function seriesSettingsFor(settings: BoardSettings, flags: Fallback): SeriesSettings[] {
  const of = (attribute: string): SeriesSettings => ({
    attribute,
    zoneValue: "mean",
    shiftThreshold: settings.shiftThreshold,
    direction: "up",
    runTolerance: settings.runTolerance,
    minRunLength: settings.minRunLength,
  });
  return flags.brightnessOnly ? [of(ATTR_BRIGHTNESS)] : [of(ATTR_BRIGHTNESS), of(ATTR_TEMPERATURE)];
}

/** Run_Intersections of every Brightness Long_Run with every Temperature Long_Run, at least `minRunLength` long. */
export function sameMoodRuns(bRuns: string[][], tRuns: string[][], minRunLength: number): string[][] {
  const out: string[][] = [];
  for (const bRun of bRuns) {
    for (const tRun of tRuns) {
      const tSet = new Set(tRun);
      const common = bRun.filter((z) => tSet.has(z));
      if (common.length >= minRunLength) out.push(common);
    }
  }
  return out;
}

function curveSeries(result: SeriesResult, order: readonly string[]): CurveSeries {
  const present = new Set(result.series.map((s) => s.zone));
  return {
    attribute: result.attribute,
    series: result.series.map((s) => ({ zone: s.zone, value: s.value })),
    noData: order.filter((id) => !present.has(id)),
  };
}

export function checkMood(
  scenario: Scenario,
  settings: BoardSettings,
  marks: readonly string[],
  rules: RuleDefinition,
  flags: Fallback = FALLBACK,
): RuleOutcome<MoodReport> {
  const list = checkSeriesList(scenario, seriesSettingsFor(settings, flags), [...marks]);
  if (!list.ok) return list;
  const b = list.value[0];
  const t = list.value[1] ?? null;
  if (b === undefined) return { ok: false, errors: [{ path: "", message: "no Series_Result" }] };

  const zonesByOrder = [...scenario.zones].sort((x, y) => x.order - y.order);
  const orderIds = zonesByOrder.map((z) => z.id);
  const curve: MoodCurve = {
    zones: zonesByOrder.map((z) => ({ id: z.id, label: z.label, order: z.order })),
    attributes: [curveSeries(b, orderIds), ...(t === null ? [] : [curveSeries(t, orderIds)])],
  };

  const runs =
    t === null ? b.longRuns.map((r) => [...r]) : sameMoodRuns(b.longRuns, t.longRuns, settings.minRunLength);

  const results: JudgementResults = {
    series: [
      b,
      { attribute: ATTR_SAME_MOOD, series: [], changes: [], shifts: [], longRuns: runs, unresolved: [] },
    ],
  };
  const effects = buildEffects(scenario, rules, results);
  if (!effects.ok) return effects;

  const orderOf = new Map(zonesByOrder.map((z) => [z.id, z.order]));
  const entries: { zone: string; rank: number; reason: FlagReason }[] = [];
  for (const shift of b.shifts) {
    if (shift.intentional) continue;
    entries.push({
      zone: shift.to,
      rank: 0,
      reason: {
        kind: FLAG_SUDDEN_BRIGHTENING,
        from: shift.from,
        change: shift.change,
        threshold: settings.shiftThreshold,
      },
    });
  }
  const seen = new Set<string>();
  for (const run of runs) {
    for (const zone of run) {
      if (seen.has(zone)) continue;
      seen.add(zone);
      const holder = runs.find((r) => r.includes(zone)) ?? run;
      entries.push({
        zone,
        rank: 1,
        reason: {
          kind: FLAG_SAME_MOOD_TOO_LONG,
          run: [...holder],
          minRunLength: settings.minRunLength,
          runTolerance: settings.runTolerance,
        },
      });
    }
  }
  entries.sort((x, y) => (orderOf.get(x.zone) ?? 0) - (orderOf.get(y.zone) ?? 0) || x.rank - y.rank);

  return {
    ok: true,
    value: {
      curve,
      flags: entries.map((e) => ({ zone: e.zone, reason: e.reason })),
      effects: effects.value,
      sameMoodRuns: runs,
      brightness: b,
      temperature: t,
    },
  };
}
