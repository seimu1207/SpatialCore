import { z } from "zod";

const nonBlank = z.string().refine((s) => s.trim().length >= 1, "must not be blank");

export const localizedTextSchema = z.object({
  en: nonBlank,
  ja: z.string().optional(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

// Unknown top-level keys are ignored (default z.object behavior).
export const scenarioSchema = z.object({
  schemaVersion: z.number().int().min(1),
  id: nonBlank,
  title: localizedTextSchema,
});
export type ScenarioEnvelope = z.infer<typeof scenarioSchema>;
