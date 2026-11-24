import scenarioText from "../scenarios/preset-mansion.json?raw";
import rules from "../rules/game-rules.json" with { type: "json" };
import attackCard from "../rules/attack-card.json" with { type: "json" };
import jobs from "../rules/robot-jobs.json" with { type: "json" };
import orderRules from "../rules/order-rules.json" with { type: "json" };
import starTable from "../rules/star-table.json" with { type: "json" };
import viewSettings from "../view-settings.json" with { type: "json" };
import theme from "../theme/theme.json" with { type: "json" };
import type { RawGameData } from "./game-data.ts";

/** The Game_Data files shipped with the App, as raw values for `loadGameData`. */
export const BUNDLED: RawGameData = {
  scenarioText,
  rules,
  attackCard,
  jobs,
  orderRules,
  starTable,
  viewSettings,
  theme,
};
