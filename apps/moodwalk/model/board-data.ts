/** Board data loading (design.md "Board data loading"): validates the four board files and the view settings. */
import { loadScenario } from "../../../core/model/scenario-io.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";
import { loadRuleDefinition, type RuleDefinition } from "../../../core/model/rule-schema.ts";
import { loadViewSettings } from "../../../core/view/helpers/settings-schema.ts";
import { loadTheme, type Theme } from "../../../core/view/helpers/theme-schema.ts";
import { loadBoardSettings, type BoardSettings } from "./board-settings.ts";
import { buildViewSettings } from "./layout.ts";
import {
  ATTR_BRIGHTNESS,
  ATTR_SAME_MOOD,
  ATTR_TEMPERATURE,
  EFFECT_SAME_MOOD,
  EFFECT_SUDDEN_BRIGHTENING,
  NODE_TYPE_IMAGE,
  RULE_MARK_SAME_MOOD,
  RULE_MARK_SUDDEN_BRIGHTENING,
  SAMPLE_PREFIX,
} from "./names.ts";
import { SAMPLE_RECIPES } from "./sample-images.ts";

export type RawBoardData = { scenarioText: string; rules: unknown; settings: unknown; theme: unknown };

export type BoardData = { scenario: Scenario; rules: RuleDefinition; settings: BoardSettings; theme: Theme };

export type DataError = { file: string; path: string; message: string };

export type DataResult = { ok: true; data: BoardData } | { ok: false; errors: DataError[] };

type Problem = { path: string; message: string };

function tag(file: string, errors: readonly Problem[]): DataError[] {
  return errors.map((e) => ({ file, path: e.path, message: e.message }));
}

/** Loads the four board files and checks the view settings built from the Zones. Never throws. */
export function loadBoardData(raw: RawBoardData): DataResult {
  try {
    const errors: DataError[] = [];
    const scenario = loadScenario(raw.scenarioText);
    if (!scenario.ok) errors.push(...tag("scenario", scenario.errors));
    const rules = loadRuleDefinition(raw.rules);
    if (!rules.ok) errors.push(...tag("rules", rules.errors));
    const settings = loadBoardSettings(raw.settings);
    if (!settings.ok) errors.push(...tag("settings", settings.errors));
    const theme = loadTheme(raw.theme);
    if (!theme.ok) errors.push(...tag("theme", theme.errors));
    if (scenario.ok) {
      const view = loadViewSettings(buildViewSettings(scenario.scenario.zones, "overview"));
      if (!view.ok) errors.push(...tag("view settings", view.errors));
    }
    if (!scenario.ok || !rules.ok || !settings.ok || !theme.ok || errors.length > 0) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      data: { scenario: scenario.scenario, rules: rules.value, settings: settings.settings, theme: theme.theme },
    };
  } catch {
    return { ok: false, errors: [{ file: "board data", path: "", message: "The board data could not be read." }] };
  }
}

/** Checks the links between the files (example tests only). Returns an empty list when all hold. */
export function crossReferenceErrors(data: BoardData): Problem[] {
  const errors: Problem[] = [];
  const { scenario, theme } = data;
  const effectRules = data.rules.effectRules ?? [];
  if (scenario.zones.length < 2) errors.push({ path: "zones", message: "The board needs at least 2 Zones." });
  const recipeIds = new Set(SAMPLE_RECIPES.map((r) => r.id));
  scenario.nodes.forEach((node, i) => {
    const at = `nodes.${i}`;
    if (node.type !== NODE_TYPE_IMAGE) errors.push({ path: `${at}.type`, message: `Node ${node.id} is not an image.` });
    if (node.zone === undefined) errors.push({ path: `${at}.zone`, message: `Node ${node.id} has no Zone.` });
    const ref = node.front.image;
    if (ref === undefined || !ref.startsWith(SAMPLE_PREFIX) || !recipeIds.has(ref.slice(SAMPLE_PREFIX.length))) {
      errors.push({ path: `${at}.front.image`, message: `Node ${node.id} has no known sample recipe.` });
    }
    for (const attribute of [ATTR_BRIGHTNESS, ATTR_TEMPERATURE]) {
      if (node.attributes?.[attribute] === undefined) {
        errors.push({ path: `${at}.attributes.${attribute}`, message: `Node ${node.id} has no ${attribute}.` });
      }
    }
  });
  effectRules.forEach((rule, i) => {
    if (theme.effects[rule.effect]?.style !== "fog") {
      errors.push({ path: `effectRules.${i}.effect`, message: `Effect ${rule.effect} has no fog style in the Theme.` });
    }
  });
  const expected = new Map<string, { effect: string; kind: string; attribute: string }>([
    [RULE_MARK_SUDDEN_BRIGHTENING, { effect: EFFECT_SUDDEN_BRIGHTENING, kind: "shifts", attribute: ATTR_BRIGHTNESS }],
    [RULE_MARK_SAME_MOOD, { effect: EFFECT_SAME_MOOD, kind: "longRuns", attribute: ATTR_SAME_MOOD }],
  ]);
  const ok =
    effectRules.length === expected.size &&
    effectRules.every((rule) => {
      const want = expected.get(rule.id);
      const source = rule.source;
      return (
        want !== undefined &&
        rule.effect === want.effect &&
        (source.kind === "shifts" || source.kind === "longRuns") &&
        source.kind === want.kind &&
        source.attribute === want.attribute
      );
    });
  if (!ok) errors.push({ path: "effectRules", message: "The rules must hold exactly the two mood Effect_Rules." });
  return errors;
}
