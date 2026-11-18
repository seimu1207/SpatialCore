import { cursorEffects } from "../../model/timeline.ts";
import type { EffectRequest, EffectTarget, TimelineCursor } from "../../model/rule-schema.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import { effectStyleFor, type EffectStyle, type Theme } from "./theme-schema.ts";
import type { VisibleSet } from "./visibility.ts";

export type DrawableEffect = { target: EffectTarget; style: EffectStyle };

/**
 * The Effect_Requests to draw now (R-VIEW-18.4, 18.7): the App list when no
 * Timeline playback exists, else the effects of steps 0 to the cursor position.
 * Never throws; a failure gives an empty list.
 */
export function shownEffects(
  app: readonly EffectRequest[],
  timeline: { cursor: TimelineCursor } | null,
): EffectRequest[] {
  try {
    if (timeline === null) return [...app];
    const result = cursorEffects(timeline.cursor);
    return result.ok ? result.value.upToCurrent : [];
  } catch {
    return [];
  }
}

/**
 * Keeps a request when the Theme styles its Effect_Kind, its target is in the
 * Visible_Set, and a Zone target has a footprint (R-VIEW-10.3 to 10.5, 10.10).
 * Input order is kept. Never throws and never writes to its arguments.
 */
export function drawableEffects(
  effects: readonly EffectRequest[],
  _scenario: Scenario,
  visible: VisibleSet,
  footprintIds: ReadonlySet<string>,
  theme: Theme,
): DrawableEffect[] {
  try {
    const nodes = new Set(visible.nodes);
    const edges = new Set(visible.edges);
    const zones = new Set(visible.zones);
    const out: DrawableEffect[] = [];
    for (const request of effects) {
      const style = effectStyleFor(theme, request.effect);
      if (style === null) continue;
      const { kind, id } = request.target;
      const shown =
        kind === "node" ? nodes.has(id) : kind === "edge" ? edges.has(id) : zones.has(id) && footprintIds.has(id);
      if (shown) out.push({ target: { kind, id }, style });
    }
    return out;
  } catch {
    return [];
  }
}
