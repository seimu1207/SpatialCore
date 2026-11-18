import { z } from "zod";
import { addUnresolved, buildIndex, matchSelector, type GraphIndex, sortedIds, sumOver } from "./graph-index.ts";
import { checkScenario, combine, guard, parseArg, rejectSelf } from "./rule-input.ts";
import {
  intentionalMarksSchema,
  nodeSelectorSchema,
  seriesSettingsSchema,
  type NodeSelector,
  type RuleOutcome,
  type SeriesResult,
  type SeriesSettings,
} from "./rule-schema.ts";
import type { Scenario, ValidationError } from "./scenario-schema.ts";

const attributeSchema = seriesSettingsSchema.shape.attribute;

/** Sum and count of an own attribute over the Nodes picked by `nodes`. A non-finite sum is one error at `attribute`. */
export function sumAttribute(
  scenario: Scenario,
  nodes: NodeSelector,
  attribute: string,
): RuleOutcome<{ sum: number; count: number; unresolved: string[] }> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const sel = parseArg(nodeSelectorSchema, nodes, "nodes");
    const attr = parseArg(attributeSchema, attribute, "attribute");
    const errors = combine(sc, sel, attr);
    if (!sc.ok || !sel.ok || !attr.ok) return { ok: false, errors };
    const selfErrors = rejectSelf(sel.value, "nodes");
    if (selfErrors.length > 0) return { ok: false, errors: selfErrors };
    const g = buildIndex(sc.value);
    const { sum, count } = sumOver(g, matchSelector(g, sel.value), attr.value);
    if (!Number.isFinite(sum)) {
      return {
        ok: false,
        errors: [{ path: "attribute", message: `sum of attribute "${attr.value}" is not a finite number` }],
      };
    }
    const unresolved = new Set<string>();
    addUnresolved(g, sel.value, unresolved);
    return { ok: true, value: { sum, count, unresolved: sortedIds(unresolved) } };
  });
}

/**
 * Zone_Series, Step_Changes, Shifts and Long_Runs of one attribute. `path` is the Field_Path of the
 * attribute, used for every non-finite error. Any error means no result.
 */
export function seriesFor(
  g: GraphIndex,
  settings: SeriesSettings,
  marks: ReadonlySet<string>,
  path: string,
): RuleOutcome<SeriesResult> {
  const name = settings.attribute;
  const errors: ValidationError[] = [];
  const series: SeriesResult["series"] = [];
  for (const zone of g.zonesByOrder) {
    const picked = g.nodes.map((n) => n.zone === zone.id);
    const { sum, count } = sumOver(g, picked, name);
    if (count === 0) continue;
    const value = settings.zoneValue === "sum" ? sum : sum / count;
    if (!Number.isFinite(value)) {
      errors.push({ path, message: `value of attribute "${name}" in zone "${zone.id}" is not a finite number` });
      continue;
    }
    series.push({ zone: zone.id, value });
  }
  const changes: SeriesResult["changes"] = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1];
    const cur = series[i];
    if (prev === undefined || cur === undefined) continue;
    const change = cur.value - prev.value;
    if (!Number.isFinite(change)) {
      errors.push({ path, message: `change of attribute "${name}" at zone "${cur.zone}" is not a finite number` });
      continue;
    }
    changes.push({ from: prev.zone, to: cur.zone, change });
  }
  if (errors.length > 0) return { ok: false, errors };

  const t = settings.shiftThreshold;
  const shifts: SeriesResult["shifts"] = [];
  for (const c of changes) {
    const isShift =
      settings.direction === "up" ? c.change > t : settings.direction === "down" ? c.change < -t : Math.abs(c.change) > t;
    if (isShift) shifts.push({ from: c.from, to: c.to, change: c.change, intentional: marks.has(c.to) });
  }

  const longRuns: string[][] = [];
  const n = series.length;
  let start = 0;
  for (let i = 1; i <= n; i += 1) {
    const prior = changes[i - 1];
    if (i < n && prior !== undefined && Math.abs(prior.change) <= settings.runTolerance) continue;
    if (i - start >= settings.minRunLength) longRuns.push(series.slice(start, i).map((s) => s.zone));
    start = i;
  }

  const unresolved = sortedIds([...marks].filter((m) => !g.zoneIds.has(m)));
  return { ok: true, value: { attribute: name, series, changes, shifts, longRuns, unresolved } };
}

/** Validates the arguments and returns one Series_Result. */
export function checkSeries(
  scenario: Scenario,
  settings: SeriesSettings,
  marks: string[],
): RuleOutcome<SeriesResult> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const st = parseArg(seriesSettingsSchema, settings, "settings");
    const mk = parseArg(intentionalMarksSchema, marks, "marks");
    if (!sc.ok || !st.ok || !mk.ok) return { ok: false, errors: combine(sc, st, mk) };
    return seriesFor(buildIndex(sc.value), st.value, new Set(mk.value), "settings.attribute");
  });
}
/**
 * Validates the list, rejects a repeated `attribute`, and returns one Series_Result per entry in list order.
 * Each entry is computed by `seriesFor` with its own settings and the shared marks.
 */
export function checkSeriesList(
  scenario: Scenario,
  settings: SeriesSettings[],
  marks: string[],
): RuleOutcome<SeriesResult[]> {
  return guard(() => {
    const sc = checkScenario(scenario);
    const st = parseArg(z.array(seriesSettingsSchema), settings, "settings");
    const mk = parseArg(intentionalMarksSchema, marks, "marks");
    const errors = combine(sc, st, mk);
    if (st.ok) {
      const firstUse = new Map<string, number>();
      st.value.forEach((s, i) => {
        const first = firstUse.get(s.attribute);
        if (first === undefined) {
          firstUse.set(s.attribute, i);
          return;
        }
        errors.push({
          path: `settings.${i}.attribute`,
          message: `duplicate attribute "${s.attribute}", first used at settings.${first}`,
        });
      });
    }
    if (!sc.ok || !st.ok || !mk.ok || errors.length > 0) return { ok: false, errors };
    const g = buildIndex(sc.value);
    const markSet = new Set(mk.value);
    const results: SeriesResult[] = [];
    const seriesErrors: ValidationError[] = [];
    st.value.forEach((s, i) => {
      const r = seriesFor(g, s, markSet, `settings.${i}.attribute`);
      if (r.ok) results.push(r.value);
      else seriesErrors.push(...r.errors);
    });
    if (seriesErrors.length > 0) return { ok: false, errors: seriesErrors };
    return { ok: true, value: results };
  });
}
