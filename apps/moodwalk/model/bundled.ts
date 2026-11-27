import type { RawBoardData } from "./board-data.ts";
import scenarioText from "../scenarios/school-festival-haunted-house.json?raw";
import rules from "../rules/mood-rules.json" with { type: "json" };
import settings from "../rules/board-settings.json" with { type: "json" };
import theme from "../theme/theme.json" with { type: "json" };

/** The board files shipped with the App, as raw values for `loadBoardData`. */
export const BUNDLED: RawBoardData = { scenarioText, rules, settings, theme };
