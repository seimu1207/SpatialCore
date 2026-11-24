// DOM panel of Ghost Mansion (design.md "UI"). Draws only with `createElement`, `createElementNS`, and
// `textContent`; never `innerHTML` (R-APP1-22.3). It holds no game logic: it shows what `GameViewState`
// carries and reports button presses to `act`. Always shows the `en` text (R-APP1-22.1).

import type { LocalizedText } from "../../core/model/scenario-schema.ts";
import type { ControlId, GameViewState, UiSink } from "./controller.ts";
import { CONTROL_IDS } from "./model/controls.ts";
import { coachFor } from "./coach.ts";
import {
  canBreak,
  coachText,
  controlLabels,
  fogNote,
  hiddenFollowed,
  incident,
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
// Colours of theme.json (text and plain-key accent).
const CHART_TEXT = "#f3e9ff";
const CHART_AXIS = "#9a8fb0";
const ACCENT = "#ff7a1a";
const MAX_STARS = 3;

// Pixel ghost with a little witch hat: h hat, b band, w body, e eye. One cell = one SVG unit.
const GHOST_ROWS = [
  ".....hh.....",
  "....hhhh....",
  "...hhhhhh...",
  "..bbbbbbbb..",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wweewweeww.",
  ".wweewweeww.",
  ".wwwwwwwwww.",
  ".wwwwwwwwww.",
  ".wwwwwwwwww.",
  ".ww.wwww.ww.",
];
const GHOST_COLORS: Record<string, string> = { h: "#6a3fb5", b: "#ff7a1a", w: "#f3e9ff", e: "#1b1426" };

function ghostIcon(): SVGSVGElement {
  const icon = svg("svg", {
    viewBox: `0 0 12 ${GHOST_ROWS.length}`,
    width: "56",
    height: String(56 * (GHOST_ROWS.length / 12)),
    role: "img",
    "aria-label": coachText.guideName.en,
    "shape-rendering": "crispEdges",
  });
  icon.classList.add("gm-ghost");
  GHOST_ROWS.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = GHOST_COLORS[ch];
      if (fill !== undefined) icon.appendChild(svg("rect", { x: String(x), y: String(y), width: "1", height: "1", fill }));
    });
  });
  return icon;
}

/** The guide: the ghost and a speech bubble with the coach line (always at the top of the panel). */
function guide(say: string): HTMLElement {
  const box = el("div");
  box.className = "gm-guide";
  const bubble = el("p", say);
  bubble.className = "gm-bubble";
  box.append(ghostIcon(), bubble);
  return box;
}

function progress(p: { done: number; total: number; label: LocalizedText }): HTMLElement {
  const box = el("div");
  box.className = "gm-progress";
  const bar = el("div");
  bar.className = "gm-progress-bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", p.label.en);
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(p.total));
  bar.setAttribute("aria-valuenow", String(p.done + 1));
  bar.setAttribute("aria-valuetext", p.label.en);
  for (let i = 0; i < p.total; i++) {
    const dot = el("span");
    dot.className = i < p.done ? "gm-dot gm-dot-done" : i === p.done ? "gm-dot gm-dot-now" : "gm-dot";
    bar.appendChild(dot);
  }
  box.append(bar, el("p", p.label.en));
  box.lastElementChild?.classList.add("gm-progress-label");
  return box;
}

/** A big number with a small label. */
function stat(label: string, value: number, bad = false): HTMLElement {
  const box = el("div");
  box.className = bad ? "gm-stat gm-stat-bad" : "gm-stat";
  const number = el("span", String(value));
  number.className = "gm-stat-num";
  const caption = el("span", label);
  caption.className = "gm-stat-label";
  box.append(number, caption);
  return box;
}

function stars(count: number): HTMLElement {
  const box = el("p", "★".repeat(Math.min(count, MAX_STARS)) + "☆".repeat(Math.max(MAX_STARS - count, 0)));
  box.className = "gm-stars";
  box.setAttribute("role", "img");
  box.setAttribute("aria-label", `${scoreLabels.stars.en}: ${count}`);
  return box;
}

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
  chart.classList.add("gm-chart");
  chart.appendChild(svg("line", { x1: String(left), y1: String(top + plotH), x2: String(left + plotW), y2: String(top + plotH), stroke: CHART_AXIS }));
  chart.appendChild(svg("line", { x1: String(left), y1: String(top), x2: String(left), y2: String(top + plotH), stroke: CHART_AXIS }));
  chart.appendChild(svg("text", { x: String(left + plotW / 2), y: String(h - 8), "text-anchor": "middle", "font-size": "11", fill: CHART_TEXT }, `${scoreLabels.convenience.en} (0-${MAX_CONVENIENCE})`));
  chart.appendChild(svg("text", { x: "10", y: String(top + plotH / 2), "text-anchor": "middle", "font-size": "11", fill: CHART_TEXT, transform: `rotate(-90 10 ${top + plotH / 2})` }, `${scoreLabels.damage.en} (0-${MAX_DAMAGE})`));
  chart.appendChild(svg("circle", { cx: String(cx), cy: String(cy), r: "6", fill: ACCENT, stroke: CHART_TEXT }));
  chart.appendChild(svg("text", { x: String(w - right), y: String(top + 12), "text-anchor": "end", "font-size": "13", fill: CHART_TEXT }, `${scoreLabels.stars.en}: ${score.stars}`));
  return chart;
}

export function createPanel(root: HTMLElement, options: PanelOptions): UiSink {
  const buttons = new Map<ControlId, HTMLButtonElement[]>();

  function button(control: ControlId, label: string, arg?: string): HTMLButtonElement {
    const b = el("button", label);
    b.type = "button";
    b.dataset["key"] = `${control}:${arg ?? ""}`;
    b.addEventListener("click", () => options.act(control, arg));
    const list = buttons.get(control) ?? [];
    list.push(b);
    buttons.set(control, list);
    return b;
  }

  function render(rawState: GameViewState): void {
    const state = rawState;
    const focused = document.activeElement;
    const focusKey = focused instanceof HTMLElement && root.contains(focused) ? (focused.dataset["key"] ?? null) : null;
    buttons.clear();
    root.replaceChildren();

    const coach = coachFor(state);
    root.append(guide(coach.say.en), progress(coach.progress));
    root.appendChild(el("h2", phaseNames[state.phase].en));

    // Error or failure message; drawn here so the next render cannot erase it.
    const notice = noticeLine(state);
    if (notice !== null) {
      const alert = el("p", notice);
      alert.className = "gm-notice";
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
      const row = el("div");
      row.className = "gm-stats";
      row.append(
        stat(scoreLabels.convenience.en, state.status.convenience),
        stat(scoreLabels.damageIfTricked.en, state.status.reachScore, true),
      );
      status.append(row, el("p", reachNote.en));
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
        const row = el("div");
        row.className = "gm-stats";
        row.append(
          stat(scoreLabels.convenience.en, state.score.convenience),
          stat(scoreLabels.damage.en, state.score.damage, true),
        );
        root.appendChild(row);
        root.appendChild(stars(state.score.stars));
        root.appendChild(scoreChart(state.score));
      }
    }

    root.appendChild(el("p", fogNote.en));

    // ViewPreset controls (R-APP1-11.1).
    const views = el("div");
    views.className = "gm-views";
    views.setAttribute("role", "group");
    for (const preset of options.presets) {
      const b = button("preset", preset.label.en, preset.id);
      b.classList.add("gm-view-btn");
      const active = preset.id === state.presetId;
      b.setAttribute("aria-pressed", active ? "true" : "false");
      if (active) b.classList.add("gm-active");
      views.appendChild(b);
    }
    root.appendChild(views);

    // Every other button of `controlsFor`, in the order of CONTROL_IDS.
    const actions = el("div");
    actions.className = "gm-actions";
    for (const id of CONTROL_IDS) {
      if (id === "preset" || id === "back") continue;
      const b = button(id, controlLabels[id].en);
      if (id === coach.doNext) {
        b.classList.add("gm-primary", "gm-next");
      } else {
        b.classList.add("gm-secondary");
      }
      actions.appendChild(b);
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

    // Keep keyboard focus on the same control after the rebuild (skipped if it is hidden or disabled).
    if (focusKey !== null) {
      for (const list of buttons.values()) {
        const same = list.find((b) => b.dataset["key"] === focusKey && !b.hidden && !b.disabled);
        if (same !== undefined) same.focus();
      }
    }
  }

  function card(state: GameViewState): HTMLElement {
    const box = el("section");
    box.className = "gm-card";
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
