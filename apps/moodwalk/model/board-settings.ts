import { z } from "zod";
import { toValidationErrors, type ValidationError } from "../../../core/model/scenario-schema.ts";

export const boardSettingsSchema = z.strictObject({
  shiftThreshold: z.number().min(0),
  runTolerance: z.number().min(0),
  minRunLength: z.number().int().min(2),
});

export type BoardSettings = z.infer<typeof boardSettingsSchema>;

export function loadBoardSettings(
  value: unknown,
): { ok: true; settings: BoardSettings } | { ok: false; errors: ValidationError[] } {
  try {
    const parsed = boardSettingsSchema.safeParse(value);
    if (parsed.success) return { ok: true, settings: parsed.data };
    return { ok: false, errors: toValidationErrors(parsed.error.issues) };
  } catch {
    return { ok: false, errors: [{ path: "", message: "Board settings could not be read." }] };
  }
}

export type SettingField = keyof BoardSettings;

export function parseSettingField(
  field: SettingField,
  text: string,
): { ok: true; value: number } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  if (field === "minRunLength" && (!Number.isInteger(value) || value < 2)) return { ok: false };
  return { ok: true, value };
}
