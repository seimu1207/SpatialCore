// DOM panel of Ghost Mansion (design.md "UI"). Draws only with `createElement`, `createElementNS`, and
// `textContent`; never `innerHTML` (R-APP1-22.3). It holds no game logic: it shows what `GameViewState`
// carries and reports button presses to `act`. Always shows the `en` text (R-APP1-22.1).

import type { LocalizedText } from "../../core/model/scenario-schema.ts";
import type { ControlId, GameViewState, UiSink } from "./controller.ts";
import { CONTROL_IDS } from "./model/controls.ts";
import {
  canBreak,
  controlLabels,
  fogNote,
  hiddenFollowed,
  incident,
  phaseInstructions,
  phaseNames,
  reachNote,
  scoreLabels,
  statusWords,
} from "./text.ts";

const OP_LABELS: Record<string, LocalizedText> = {
  "stop-robot": controlLabels.stopRobot,
  "cut-key": controlLabels.cutKey,
  consult: controlLabels.consult,
};

/** The English text of the alert line `render` draws as `<p role="alert">`, or null when there is none. */
export function noticeLine(state: Pick<GameViewState, "notice">): string | null {
  return state.notice === null ? null : state.notice.en;
}

function opLabel(id: string): string {
  return (OP_LABELS[id] ?? { en: id }).en;
}
export type PanelOptions = {
  /** Presses of a control; `arg` is the preset id for `preset`. */
  act: (control: ControlId, arg?: string) => void;
  /** ViewPresets of the View_Settings, in order. */
  presets: { id: string; label: LocalizedText }[];
  /** Href of the back link (always shown, R-APP1-01.3). */
  backHref: string;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_CONVENIENCE = 6;
const MAX_DAMAGE = 11;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, text?: string) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Two axes (convenience 0 to 6, damage 0 to 11), one circle, and the star count as text (R-APP1-10.5). */
function scoreChart(score: { convenience: number; damage: number; stars: number }): SVGSVGElement {
  const w = 220;
  const h = 160;
  const left = 36;
  const bottom = 28;
  const top = 10;
  const right = 10;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const c = Math.min(Math.max(score.convenience, 0), MAX_CONVENIENCE);
  const d = Math.min(Math.max(score.damage, 0), MAX_DAMAGE);
  const cx = left + (c / MAX_CONVENIENCE) * plotW;
  const cy = top + plotH - (d / MAX_DAMAGE) * plotH;
  const chart = svg("svg", {
    viewBox: `0 0 ${w} ${h}`,
    width: String(w),
    height: String(h),
    role: "img",
  });
  chart.appendChild(svg("line", { x1: String(left), y1: String(top + plotH), x2: String(left + plotW), y2: String(top + plotH), stroke: "currentColor" }));
  chart.appendChild(svg("line", { x1: String(left), y1: String(top), x2: String(left), y2: String(top + plotH), stroke: "currentColor" }));
  chart.appendChild(svg("text", { x: String(left + plotW / 2), y: String(h - 8), "text-anchor": "middle", "font-size": "11", fill: "currentColor" }, `${scoreLabels.convenience.en} (0-${MAX_CONVENIENCE})`));
  chart.appendChild(svg("text", { x: "10", y: String(top + plotH / 2), "text-anchor": "middle", "font-size": "11", fill: "currentColor", transform: `rotate(-90 10 ${top + plotH / 2})` }, `${scoreLabels.damage.en} (0-${MAX_DAMAGE})`));
  chart.appendChild(svg("circle", { cx: String(cx), cy: String(cy), r: "6", fill: "orange", stroke: "currentColor" }));
  chart.appendChild(svg("text", { x: String(w - right), y: String(top + 12), "text-anchor": "end", "font-size": "13", fill: "currentColor" }, `${scoreLabels.stars.en}: ${score.stars}`));
  return chart;
}

export function createPanel(root: HTMLElement, options: PanelOptions): UiSink {
  const buttons = new Map<ControlId, HTMLButtonElement[]>();

  function button(control: ControlId, label: string, arg?: string): HTMLButtonElement {
    const b = el("button", label);
    b.type = "button";
    b.addEventListener("click", () => options.act(control, arg));
    const list = buttons.get(control) ?? [];
    list.push(b);
    buttons.set(control, list);
    return b;
  }

  function render(rawState: GameViewState): void {
    const state = rawState;
    buttons.clear();
    root.replaceChildren();

    const heading = el("h2", phaseNames[state.phase].en);
    const instruction = el("p", phaseInstructions[state.phase].en);
    root.append(heading, instruction);

    // Error or failure message; drawn here so the next render cannot erase it.
    const notice = noticeLine(state);
    if (notice !== null) {
      const alert = el("p", notice);
      alert.setAttribute("role", "alert");
      root.appendChild(alert);
    }

    // Incident and hidden-command lines (R-APP1-15.4).
    if (state.phase === "ghostNight" || state.phase === "fixIt") {
      if (state.stepLabel !== null) root.appendChild(el("p", state.stepLabel.en));
      if (state.hiddenFollowed) root.appendChild(el("p", hiddenFollowed.en));
    }
    if (state.phase === "fixIt") root.appendChild(el("p", incident.en));

    // Prepare status (R-APP1-09.6).
    if (state.status !== null) {
      const status = el("div");
      status.appendChild(el("p", `${scoreLabels.convenience.en}: ${state.status.convenience}`));
      status.appendChild(el("p", `${scoreLabels.damageIfTricked.en}: ${state.status.reachScore}`));
      status.appendChild(el("p", reachNote.en));
      root.appendChild(status);
    }

    // Attack_Card (R-APP1-05.6, 13.x, 18.1, 18.3).
    if (state.phase === "sample" || state.phase === "lookBack") {
      root.appendChild(card(state));
    }

    // Response_Operations (R-APP1-16.8).
    if (state.phase === "fixIt" && state.response !== null) {
      const list = el("ul");
      for (const op of state.response.operations) {
        list.appendChild(el("li", `${opLabel(op.id)}: ${(op.done ? statusWords.done : statusWords.notDone).en}`));
      }
      root.appendChild(list);
    }

    // Response_Result and score (R-APP1-17, 18.1).
    if (state.phase === "lookBack") {
      if (state.response !== null) {
        const list = el("ul");
        for (const item of state.response.operations) {
          list.appendChild(el("li", `${opLabel(item.id)}: ${(item.done ? statusWords.done : statusWords.notDone).en}`));
        }
        for (const { rule, result } of state.response.order) {
          list.appendChild(el("li", `${opLabel(rule.before)} then ${opLabel(rule.after)}: ${statusWords[result].en}`));
        }
        root.appendChild(list);
      }
      if (state.score !== null) {
        root.appendChild(el("p", `${scoreLabels.convenience.en}: ${state.score.convenience}`));
        root.appendChild(el("p", `${scoreLabels.damage.en}: ${state.score.damage}`));
        root.appendChild(scoreChart(state.score));
      }
    }

    root.appendChild(el("p", fogNote.en));

    // ViewPreset controls (R-APP1-11.1).
    const views = el("div");
    for (const preset of options.presets) {
      views.appendChild(button("preset", preset.label.en, preset.id));
    }
    root.appendChild(views);

    // Every other button of `controlsFor`, in the order of CONTROL_IDS.
    const actions = el("div");
    for (const id of CONTROL_IDS) {
      if (id === "preset" || id === "back") continue;
      actions.appendChild(button(id, controlLabels[id].en));
    }
    root.appendChild(actions);

    // The back link is always shown (R-APP1-01.3).
    const back = el("a", controlLabels.back.en);
    back.href = options.backHref;
    const backWrap = el("p");
    backWrap.appendChild(back);
    root.appendChild(backWrap);

    // Shown and enabled marks from `controlsFor` (R-APP1-19.1, 19.2).
    for (const id of CONTROL_IDS) {
      const control = state.controls[id];
      for (const b of buttons.get(id) ?? []) {
        b.hidden = !control.shown;
        b.disabled = !control.enabled;
      }
    }
  }

  function card(state: GameViewState): HTMLElement {
    const box = el("section");
    const attack = state.card;
    box.appendChild(el("h3", attack.name.en));
    box.appendChild(el("p", attack.attackerGoal.en));
    const list = el("ul");
    attack.preconditions.forEach((pre, i) => {
      const holds = state.preconditions.find((p) => p.id === pre.id)?.holds === true;
      // In Sample, a Precondition is described only after its "Next" step.
      const revealed = state.phase !== "sample" || i < state.sampleShown;
      const mark = revealed ? (holds ? statusWords.met : statusWords.notMet).en : "?";
      const item = el("li", `${pre.label.en}: ${mark}`);
      if (state.phase === "lookBack" && !holds) item.appendChild(el("em", ` ${canBreak.en}`));
      list.appendChild(item);
    });
    box.appendChild(list);
    if (state.phase === "lookBack") {
      const counters = el("ul");
      for (const counter of attack.counters) counters.appendChild(el("li", counter.en));
      box.appendChild(counters);
    }
    return box;
  }

  return { render };
}
