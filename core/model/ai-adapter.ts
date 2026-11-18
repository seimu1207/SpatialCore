import {
  explanationRequestSchema,
  explanationTableSchema,
  type ExplanationRequest,
  type ExplanationTable,
  type RuleOutcome,
} from "./rule-schema.ts";
import { localizedTextSchema, type LocalizedText } from "./scenario-schema.ts";

/** null means "no explanation". */
export type Explanation = LocalizedText | null;

/** The swap point for explanations. It never takes part in a judgement. */
export interface AIAdapter {
  explain(request: ExplanationRequest): Promise<Explanation>;
}

/**
 * Builds the adapter that uses no AI and no network. It answers from a copy of the table.
 * Error paths are `table` (not an object) or `table.` + the key as written (plain joining).
 */
export function createNoAiAdapter(table: ExplanationTable): RuleOutcome<AIAdapter> {
  try {
    const checked = explanationTableSchema.safeParse(table);
    if (!checked.success) {
      return {
        ok: false,
        errors: checked.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? "table" : `table.${issue.path.map(String).join(".")}`,
          message: issue.message,
        })),
      };
    }
    const entries = new Map<string, LocalizedText>();
    for (const key of Object.keys(table)) {
      const entry: unknown = Object.getOwnPropertyDescriptor(table, key)?.value;
      entries.set(key, localizedTextSchema.parse(entry));
    }
    const adapter: AIAdapter = {
      explain(request) {
        try {
          const parsed = explanationRequestSchema.safeParse(request);
          if (!parsed.success) return Promise.resolve(null);
          const text = entries.get(parsed.data.topic);
          return Promise.resolve(text === undefined ? null : { ...text });
        } catch {
          return Promise.resolve(null);
        }
      },
    };
    return { ok: true, value: adapter };
  } catch {
    return { ok: false, errors: [{ path: "", message: "the rules could not be evaluated" }] };
  }
}
