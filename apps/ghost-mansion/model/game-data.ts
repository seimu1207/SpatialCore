import { z } from "zod";
import { loadScenario } from "../../../core/model/scenario-io.ts";
import { evaluateCheckSets, evaluateNodeRules } from "../../../core/model/conditions.ts";
import { conditionSchema, loadRuleDefinition } from "../../../core/model/rule-schema.ts";
import type { RuleDefinition } from "../../../core/model/rule-schema.ts";
import { localizedTextSchema, nonBlank } from "../../../core/model/scenario-schema.ts";
import type { Scenario, ValidationError } from "../../../core/model/scenario-schema.ts";
import { loadViewSettings } from "../../../core/view/helpers/settings-schema.ts";
import type { ViewSettings } from "../../../core/view/helpers/settings-schema.ts";
import { loadTheme } from "../../../core/view/helpers/theme-schema.ts";
import type { Theme } from "../../../core/view/helpers/theme-schema.ts";
import { attackCheckSet, withCheckSet } from "./built-rules.ts";
import { CHECK_SET_IDS, RESPONSE_OPS } from "./names.ts";

// --- App schemas (design.md "Game data loading") ---

const highlightSchema = z.object({ kind: z.enum(["node", "edge"]), id: nonBlank });

export const preconditionSchema = z.object({
  id: nonBlank,
  label: localizedTextSchema,
  check: conditionSchema,
  highlight: z.array(highlightSchema),
});

function uniqueIds(items: readonly { id: string }[], label: string, ctx: z.RefinementCtx, base: (string | number)[]): void {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) {
      ctx.addIssue({ code: "custom", path: [...base, i, "id"], message: `duplicate ${label} id "${item.id}"` });
    }
    seen.add(item.id);
  });
}

export const attackCardSchema = z
  .object({
    id: nonBlank,
    name: localizedTextSchema,
    attackerGoal: localizedTextSchema,
    motives: z.array(localizedTextSchema),
    targets: z.array(nonBlank),
    preconditions: z.array(preconditionSchema).min(3),
    impact: localizedTextSchema,
    counters: z.array(localizedTextSchema).min(1),
  })
  .superRefine((card, ctx) => uniqueIds(card.preconditions, "precondition", ctx, ["preconditions"]));

export const robotJobsSchema = z
  .object({
    weights: z
      .object({ plain: z.number().min(0), bell: z.number().min(0) })
      .refine((w) => w.plain >= w.bell, "plain weight must be at least the bell weight"),
    jobs: z
      .array(z.object({ id: nonBlank, label: localizedTextSchema, room: nonBlank, reads: nonBlank.optional() }))
      .min(1),
  })
  .superRefine((j, ctx) => uniqueIds(j.jobs, "job", ctx, ["jobs"]));

const responseOpSchema = z.enum([RESPONSE_OPS.stopRobot, RESPONSE_OPS.cutKey, RESPONSE_OPS.consult]);

export const orderRulesSchema = z.array(
  z
    .object({ before: responseOpSchema, after: responseOpSchema })
    .refine((r) => r.before !== r.after, "an order rule needs two different operations"),
);

export const starTableSchema = z
  .object({
    defaultStars: z.literal(1),
    rules: z
      .array(
        z.object({
          stars: z.number().int().min(2).max(3),
          minConvenience: z.number().min(0),
          maxDamage: z.number().min(0),
        }),
      )
      .min(1),
  })
  .superRefine((table, ctx) => {
    const rules = table.rules;
    if (rules.length === 0) return;
    for (let i = 1; i < rules.length; i += 1) {
      if (rules[i].stars >= rules[i - 1].stars) {
        ctx.addIssue({ code: "custom", path: ["rules", i, "stars"], message: "stars must be strictly decreasing" });
      }
    }
    if (rules[0].minConvenience < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["rules", 0, "minConvenience"],
        message: "the first rule needs minConvenience of at least 1",
      });
    }
  });

export type Precondition = z.infer<typeof preconditionSchema>;
export type AttackCard = z.infer<typeof attackCardSchema>;
export type RobotJobs = z.infer<typeof robotJobsSchema>;
export type OrderRule = z.infer<typeof orderRulesSchema>[number];
export type StarTable = z.infer<typeof starTableSchema>;

// --- Loading ---

export type RawGameData = {
  scenarioText: string;
  rules: unknown;
  attackCard: unknown;
  jobs: unknown;
  orderRules: unknown;
  starTable: unknown;
  viewSettings: unknown;
  theme: unknown;
};

export type GameData = {
  preset: Scenario;
  rules: RuleDefinition;
  attackCard: AttackCard;
  jobs: RobotJobs;
  orderRules: OrderRule[];
  starTable: StarTable;
  viewSettings: ViewSettings;
  theme: Theme;
};

export type DataError = { file: string; path: string; message: string };
export type DataResult = { ok: true; data: GameData } | { ok: false; errors: DataError[] };

const FILES = {
  scenario: "scenarios/preset-mansion.json",
  rules: "rules/game-rules.json",
  attackCard: "rules/attack-card.json",
  jobs: "rules/robot-jobs.json",
  orderRules: "rules/order-rules.json",
  starTable: "rules/star-table.json",
  viewSettings: "view-settings.json",
  theme: "theme/theme.json",
} as const;

function tagged(file: string, errors: readonly ValidationError[]): DataError[] {
  return errors.map((e) => ({ file, path: e.path, message: e.message }));
}

function parseWith<T>(
  schema: z.ZodType<T>,
  value: unknown,
  file: string,
  errors: DataError[],
): T | undefined {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    errors.push({ file, path: issue.path.map(String).join("."), message: issue.message });
  }
  return undefined;
}

/** Validates every Game_Data file and returns the typed bundle. Never throws. */
export function loadGameData(raw: RawGameData): DataResult {
  try {
    const errors: DataError[] = [];

    const sc = loadScenario(raw.scenarioText);
    if (!sc.ok) errors.push(...tagged(FILES.scenario, sc.errors));

    const rules = loadRuleDefinition(raw.rules);
    if (!rules.ok) errors.push(...tagged(FILES.rules, rules.errors));

    const settings = loadViewSettings(raw.viewSettings);
    if (!settings.ok) errors.push(...tagged(FILES.viewSettings, settings.errors));

    const theme = loadTheme(raw.theme);
    if (!theme.ok) errors.push(...tagged(FILES.theme, theme.errors));

    const attackCard = parseWith(attackCardSchema, raw.attackCard, FILES.attackCard, errors);
    const jobs = parseWith(robotJobsSchema, raw.jobs, FILES.jobs, errors);
    const orderRules = parseWith(orderRulesSchema, raw.orderRules, FILES.orderRules, errors);
    const starTable = parseWith(starTableSchema, raw.starTable, FILES.starTable, errors);

    if (
      errors.length > 0 ||
      !sc.ok ||
      !rules.ok ||
      !settings.ok ||
      !theme.ok ||
      attackCard === undefined ||
      jobs === undefined ||
      orderRules === undefined ||
      starTable === undefined
    ) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      data: {
        preset: sc.scenario,
        rules: rules.value,
        attackCard,
        jobs,
        orderRules,
        starTable,
        viewSettings: settings.settings,
        theme: theme.theme,
      },
    };
  } catch {
    return { ok: false, errors: [{ file: "", path: "", message: "the game data could not be validated" }] };
  }
}

// --- Cross references ---

/** Reference errors between the Game_Data files and the Preset_Mansion. Each error names the Identifier. */
export function crossReferenceErrors(data: GameData): ValidationError[] {
  const errors: ValidationError[] = [];
  try {
    const nodeIds = new Set(data.preset.nodes.map((n) => n.id));
    const edgeIds = new Set(data.preset.edges.map((e) => e.id));

    const needNode = (id: string, path: string): void => {
      if (!nodeIds.has(id)) errors.push({ path, message: `unknown Node id "${id}"` });
    };

    data.jobs.jobs.forEach((job, i) => {
      needNode(job.room, `jobs.jobs.${i}.room`);
      if (job.reads !== undefined) needNode(job.reads, `jobs.jobs.${i}.reads`);
    });

    data.attackCard.preconditions.forEach((p, i) => {
      p.highlight.forEach((h, j) => {
        const path = `attackCard.preconditions.${i}.highlight.${j}`;
        if (h.kind === "node") needNode(h.id, path);
        else if (!edgeIds.has(h.id)) errors.push({ path, message: `unknown Edge id "${h.id}"` });
      });
    });
    data.attackCard.targets.forEach((id, i) => needNode(id, `attackCard.targets.${i}`));

    const jobsSet = (data.rules.checkSets ?? []).find((s) => s.id === CHECK_SET_IDS.jobs);
    if (jobsSet === undefined) {
      errors.push({ path: "rules.checkSets", message: `missing Check_Set "${CHECK_SET_IDS.jobs}"` });
    } else {
      const setIds = jobsSet.items.map((it) => it.id);
      const jobIds = data.jobs.jobs.map((j) => j.id);
      if (setIds.length !== jobIds.length || setIds.some((id, i) => id !== jobIds[i])) {
        errors.push({
          path: `rules.checkSets.${CHECK_SET_IDS.jobs}`,
          message: `Check_Set item ids [${setIds.join(", ")}] differ from Robot_Job ids [${jobIds.join(", ")}]`,
        });
      }
    }

    const ops: readonly string[] = [RESPONSE_OPS.stopRobot, RESPONSE_OPS.cutKey, RESPONSE_OPS.consult];
    data.orderRules.forEach((r, i) => {
      if (!ops.includes(r.before)) errors.push({ path: `orderRules.${i}.before`, message: `unknown Response_Operation "${r.before}"` });
      if (!ops.includes(r.after)) errors.push({ path: `orderRules.${i}.after`, message: `unknown Response_Operation "${r.after}"` });
    });

    const attackRules = withCheckSet(data.rules, attackCheckSet(data.attackCard));
    if (!attackRules.ok) {
      for (const e of attackRules.errors) errors.push({ path: `attackRules.${e.path}`, message: e.message });
    } else {
      const checks = evaluateCheckSets(data.preset, attackRules.value);
      if (!checks.ok) {
        for (const e of checks.errors) errors.push({ path: `checkSets.${e.path}`, message: e.message });
      } else {
        for (const set of checks.value) {
          for (const id of set.unresolved) {
            errors.push({ path: `checkSets.${set.id}`, message: `unresolved Identifier "${id}"` });
          }
        }
      }
      const nodeRules = evaluateNodeRules(data.preset, attackRules.value);
      if (!nodeRules.ok) {
        for (const e of nodeRules.errors) errors.push({ path: `nodeRules.${e.path}`, message: e.message });
      } else {
        for (const rule of nodeRules.value) {
          for (const id of rule.unresolved) {
            errors.push({ path: `nodeRules.${rule.id}`, message: `unresolved Identifier "${id}"` });
          }
        }
      }
    }
  } catch {
    errors.push({ path: "", message: "the references could not be checked" });
  }
  return errors;
}
