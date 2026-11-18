import type { Scenario, ValidationError } from "../../model/scenario-schema.ts";
import type { ViewSettings } from "./settings-schema.ts";

/** Lists footprint ids and filter zone entries that name no Zone. Never throws and never changes its inputs. */
export function missingZoneRefs(settings: ViewSettings, scenario: Scenario): ValidationError[] {
  const errors: ValidationError[] = [];
  try {
    const ids = new Set(scenario.zones.map((zone) => zone.id));
    const report = (path: string, id: string): void => {
      if (!ids.has(id)) errors.push({ path, message: `no zone with id ${JSON.stringify(id)}` });
    };
    settings.zoneFootprints.forEach((footprint, i) => report(`zoneFootprints.${i}.id`, footprint.id));
    settings.presets.forEach((preset, i) => {
      (preset.filter.zones ?? []).forEach((id, j) => report(`presets.${i}.filter.zones.${j}`, id));
    });
  } catch {
    return [];
  }
  return errors;
}

/** The entries missing in `after` whose path is not already missing in `before`. */
export function newlyMissingZoneRefs(
  settings: ViewSettings,
  before: Scenario,
  after: Scenario,
): ValidationError[] {
  const known = new Set(missingZoneRefs(settings, before).map((e) => e.path));
  return missingZoneRefs(settings, after).filter((e) => !known.has(e.path));
}
