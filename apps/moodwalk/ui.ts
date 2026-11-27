/**
 * The Moodwalk page UI (design.md "UI"): the Route_Controls drawn with `document.createElement` and
 * `textContent` only (never `innerHTML`). It holds no judgement logic: every press goes to `UiActions`, and
 * every redraw comes from the `BoardViewState` the controller sends to `render`.
 *
 * Task 10.2 fills the Curve_Panel (`renderCurvePanel`, an empty stub here). Task 10.3 wires `UiActions` to the
 * controller. Nothing imports this file before then.
 */
import type { LocalizedText } from "../../core/model/scenario-schema.ts";
import type { BoardViewState, UiSink } from "./controller.ts";
import { curveLayout } from "./model/curve-layout.ts";
import { ATTR_TEMPERATURE, PRESET_OVERVIEW, PRESET_VISITOR } from "./model/names.ts";
import type { MoodFlag } from "./model/shift-check.ts";
import type { ControlId } from "./model/controls.ts";
import type { SettingField } from "./model/board-settings.ts";
import * as text from "./text.ts";

/** What the UI asks of the page. `act` is `BoardController.act`; the others are filled in by task 10.3. */
export type UiActions = {
  act(control: ControlId, arg?: string): void;
  addFiles(files: File[]): void;
  /** Choose the Zone that "Add images to" targets. */
  chooseTarget(zoneId: string): void;
  /** The raw text of a setting field, committed on `change`. */
  setSetting(field: SettingField, value: string): void;
  /** Remove the Intentional_Shift_Mark of a Zone. "Mark as intended" goes through `act("mark", zoneId)`. */
  unmark(zoneId: string): void;
};

const SETTING_FIELDS: { field: SettingField; label: LocalizedText }[] = [
  { field: "shiftThreshold", label: text.settingShiftThreshold },
  { field: "runTolerance", label: text.settingRunTolerance },
  { field: "minRunLength", label: text.settingMinRunLength },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  label?: LocalizedText | string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (label !== undefined) node.textContent = typeof label === "string" ? label : label.en;
  if (className !== undefined) node.className = className;
  return node;
}

function button(label: LocalizedText, onClick: () => void, className?: string): HTMLButtonElement {
  const b = el("button", label, className);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** Find the child `#id` of `root`, or make it (the page shell of index.html already holds them). */
function part(root: HTMLElement, id: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(`#${id}`);
  if (found !== null) return found;
  const made = el("div");
  made.id = id;
  root.appendChild(made);
  return made;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const CURVE_WIDTH = 640;
const CHART_HEIGHT = 110;
const CHART_GAP = 22;
const LABEL_ROW = 54;
const COLOR_SUDDEN = "#d9822b";
const COLOR_SAME = "#7a5bd1";

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  content?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (content !== undefined) node.textContent = content;
  return node;
}

function fixed2(value: number): string {
  return value.toFixed(2);
}

function flagColor(kind: MoodFlag["reason"]["kind"]): string {
  return kind === "sudden-brightening" ? COLOR_SUDDEN : COLOR_SAME;
}

/** One line of text per Mood_Flag, with its reason (R-APP2-09.7). */
function flagLine(flag: MoodFlag, labelOf: (id: string) => string): string {
  const r = flag.reason;
  if (r.kind === "sudden-brightening") {
    return `${labelOf(flag.zone)}: ${text.flagSuddenBrightening.en} (brightness +${fixed2(r.change)} from ${labelOf(r.from)}, above ${fixed2(r.threshold)})`;
  }
  return `${labelOf(flag.zone)}: ${text.flagSameMoodTooLong.en} (${r.run.map(labelOf).join(", ")}; at least ${r.minRunLength} zones within ${fixed2(r.runTolerance)})`;
}

/** Draws the SVG Curve_Panel (design.md "UI and Curve_Panel"). `createElementNS` and `textContent` only. */
export function renderCurvePanel(container: HTMLElement, state: BoardViewState): void {
  container.replaceChildren();
  const curve = state.curve;
  if (curve === null) return;

  const layout = curveLayout(curve, CURVE_WIDTH, CHART_HEIGHT);
  const labelOf = (id: string): string => state.zones.find((z) => z.id === id)?.label.en ?? id;
  const chartsHeight = layout.charts.length * (CHART_HEIGHT + CHART_GAP);
  const totalHeight = chartsHeight + LABEL_ROW;

  const root = svg("svg", {
    viewBox: `0 0 ${CURVE_WIDTH} ${totalHeight}`,
    width: "100%",
    role: "img",
    class: "mw-curve",
  });
  root.appendChild(svg("title", {}, "Mood curve along the route"));

  const flagsByZone = new Map<string, MoodFlag[]>();
  for (const f of state.flags) flagsByZone.set(f.zone, [...(flagsByZone.get(f.zone) ?? []), f]);

  layout.charts.forEach((chart, i) => {
    const top = i * (CHART_HEIGHT + CHART_GAP) + CHART_GAP;
    const g = svg("g", { transform: `translate(0 ${top})` });
    const title = chart.attribute === ATTR_TEMPERATURE ? text.chartTemperature : text.chartBrightness;
    g.appendChild(svg("text", { x: layout.pad, y: -6, "font-size": 11, fill: "currentColor" }, title.en));
    g.appendChild(
      svg("rect", {
        x: layout.pad,
        y: layout.pad,
        width: CURVE_WIDTH - 2 * layout.pad,
        height: CHART_HEIGHT - 2 * layout.pad,
        fill: "none",
        stroke: "currentColor",
        "stroke-opacity": 0.3,
      }),
    );
    if (chart.polyline !== "") {
      g.appendChild(svg("polyline", { points: chart.polyline, fill: "none", stroke: "currentColor", "stroke-width": 2 }));
    }
    for (const p of chart.points) {
      const c = svg("circle", { cx: p.x, cy: p.y, r: 5, fill: "currentColor" });
      c.appendChild(svg("title", {}, p.text));
      g.appendChild(c);
    }
    for (const n of chart.noData) {
      const c = svg("circle", { cx: n.x, cy: n.y, r: 5, fill: "none", stroke: "currentColor", "stroke-width": 1.5 });
      c.appendChild(svg("title", {}, `${labelOf(n.zone)}: ${text.chartNoImages.en}`));
      g.appendChild(c);
    }
    root.appendChild(g);
  });

  // Zone labels, Entrance / Exit tags, and a flag icon with color under each flagged Zone.
  const labelY = chartsHeight + 4;
  for (const l of layout.labels) {
    const anchor = l.tag === "entrance" ? "start" : l.tag === "exit" ? "end" : "middle";
    const tag = l.tag === null ? "" : ` (${(l.tag === "entrance" ? text.entrance : text.exit).en})`;
    root.appendChild(svg("text", { x: l.x, y: labelY + 10, "text-anchor": anchor, "font-size": 10, fill: "currentColor" }, `${l.label.en}${tag}`));
    const flags = flagsByZone.get(l.zone) ?? [];
    flags.forEach((f, k) => {
      const fx = l.x + (k - (flags.length - 1) / 2) * 14;
      const icon = svg("g", { fill: flagColor(f.reason.kind) });
      icon.appendChild(svg("rect", { x: fx - 5, y: labelY + 18, width: 1.5, height: 14 }));
      icon.appendChild(svg("polygon", { points: `${fx - 3.5},${labelY + 18} ${fx + 6},${labelY + 22} ${fx - 3.5},${labelY + 27}` }));
      icon.appendChild(svg("title", {}, flagLine(f, labelOf)));
      root.appendChild(icon);
    });
  }

  // Walk marker: a vertical line at the marker Zone across all charts.
  const markerLabel = state.marker === null ? undefined : layout.labels.find((l) => l.zone === state.marker);
  if (markerLabel !== undefined) {
    root.appendChild(
      svg("line", {
        x1: markerLabel.x,
        x2: markerLabel.x,
        y1: 0,
        y2: chartsHeight,
        stroke: "#e0245e",
        "stroke-width": 2,
        "stroke-dasharray": "4 3",
        class: "mw-marker",
      }),
    );
  }
  container.appendChild(root);

  // One line per Mood_Flag with its reason, or the no-flag message (R-APP2-09.6, 09.7).
  const list = document.createElement("ul");
  list.className = "mw-flags";
  if (state.flags.length === 0) {
    const li = document.createElement("li");
    li.textContent = text.msgNoFlags.en;
    list.appendChild(li);
  } else {
    for (const f of state.flags) {
      const li = document.createElement("li");
      li.style.color = flagColor(f.reason.kind);
      li.textContent = flagLine(f, labelOf);
      list.appendChild(li);
    }
  }
  container.appendChild(list);
}

export function createUi(root: HTMLElement, actions: UiActions): UiSink {
  const panel = part(root, "panel");
  const curve = part(root, "curve");
  const notice = part(root, "notice");
  panel.replaceChildren();

  // Walk controls: "Start walkthrough" first and largest (R-APP2-13.7).
  const walkRow = el("div", undefined, "mw-walk");
  const buttons = new Map<ControlId, HTMLButtonElement>();
  const add = (id: ControlId, label: LocalizedText, parent: HTMLElement, className?: string): void => {
    const b = button(label, () => actions.act(id), className);
    buttons.set(id, b);
    parent.appendChild(b);
  };
  add("start", text.startWalkthrough, walkRow, "mw-start");
  add("pause", text.pause, walkRow);
  add("resume", text.resume, walkRow);
  add("stop", text.stop, walkRow);
  const status = el("p", undefined, "mw-status");
  panel.append(walkRow, status);

  // Viewpoints.
  const viewRow = el("div", undefined, "mw-row");
  const viewButtons = new Map<string, HTMLButtonElement>();
  for (const [id, label] of [
    [PRESET_OVERVIEW, text.overview],
    [PRESET_VISITOR, text.visitorView],
  ] as const) {
    const b = button(label, () => actions.act(id === PRESET_OVERVIEW ? "overview" : "visitor"));
    viewButtons.set(id, b);
    viewRow.appendChild(b);
  }
  panel.appendChild(viewRow);

  // Images.
  const imageSection = el("div", undefined, "mw-section");
  const picker = el("input");
  picker.type = "file";
  picker.multiple = true;
  picker.accept = "image/png,image/jpeg,image/webp";
  picker.hidden = true;
  picker.addEventListener("change", () => {
    const files = Array.from(picker.files ?? []);
    picker.value = "";
    if (files.length > 0) actions.addFiles(files);
  });
  const addImages = button(text.addImages, () => picker.click());
  buttons.set("addImages", addImages);
  const removeImage = button(text.removeImage, () => actions.act("removeImage"));
  buttons.set("removeImage", removeImage);
  imageSection.append(addImages, picker, el("span", text.dropHint, "mw-hint"), removeImage);
  const targetLabel = el("p", text.addImagesTo);
  const zoneList = el("ul", undefined, "mw-zones");
  const addZone = button(text.addZone, () => actions.act("addZone"));
  buttons.set("addZone", addZone);
  panel.append(imageSection, targetLabel, zoneList, addZone);

  // Gizmo mode, undo, redo.
  const editRow = el("div", undefined, "mw-row");
  const rotate = button(text.rotate, () => actions.act("rotateMode"));
  const scale = button(text.scale, () => actions.act("scaleMode"));
  buttons.set("rotateMode", rotate);
  buttons.set("scaleMode", scale);
  editRow.append(rotate, scale);
  add("undo", text.undo, editRow);
  add("redo", text.redo, editRow);
  panel.appendChild(editRow);

  // Settings, each with its own field message.
  const settingsBox = el("div", undefined, "mw-section");
  const inputs = new Map<SettingField, HTMLInputElement>();
  const messages = new Map<SettingField, HTMLElement>();
  for (const { field, label } of SETTING_FIELDS) {
    const row = el("label", undefined, "mw-setting");
    const input = el("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.addEventListener("change", () => actions.setSetting(field, input.value));
    const message = el("span", undefined, "mw-field-message");
    message.setAttribute("role", "alert");
    row.append(el("span", label), input, message);
    inputs.set(field, input);
    messages.set(field, message);
    settingsBox.appendChild(row);
  }
  panel.appendChild(settingsBox);

  // Marks.
  const marksBox = el("div", undefined, "mw-section");
  panel.appendChild(marksBox);

  const render = (state: BoardViewState): void => {
    for (const [id, b] of buttons) b.disabled = !state.controls[id];
    status.textContent = state.status?.en ?? "";
    for (const [id, b] of viewButtons) b.setAttribute("aria-pressed", String(id === state.presetId));
    rotate.setAttribute("aria-pressed", String(state.gizmoMode === "rotate"));
    scale.setAttribute("aria-pressed", String(state.gizmoMode === "scale"));

    zoneList.replaceChildren();
    for (const zone of state.zones) {
      const item = el("li");
      const target = button(zone.label, () => actions.chooseTarget(zone.id));
      target.setAttribute("aria-pressed", String(zone.id === state.targetZone));
      item.appendChild(target);
      if (zone.role !== null) {
        item.appendChild(el("span", zone.role === "entrance" ? text.entrance : text.exit, "mw-tag"));
      }
      const remove = button(text.removeZone, () => actions.act("removeZone", zone.id));
      remove.disabled = !state.controls.removeZone;
      item.appendChild(remove);
      zoneList.appendChild(item);
    }

    for (const { field } of SETTING_FIELDS) {
      const input = inputs.get(field);
      const message = messages.get(field);
      if (input === undefined || message === undefined) continue;
      input.disabled = !state.controls.settings;
      const invalid = state.fieldNotice === field;
      // Keep what the person typed while its message is shown; otherwise show the stored value.
      if (!invalid && document.activeElement !== input) input.value = String(state.settings[field]);
      input.setAttribute("aria-invalid", String(invalid));
      message.textContent = invalid
        ? (field === "minRunLength" ? text.settingWholeNumberMessage : text.settingNumberMessage).en
        : "";
    }

    marksBox.replaceChildren();
    const labelOf = (id: string): string => state.zones.find((z) => z.id === id)?.label.en ?? id;
    for (const flag of state.flags) {
      if (flag.reason.kind !== "sudden-brightening") continue;
      if (state.marks.includes(flag.zone)) continue;
      const b = button(text.markIntended, () => actions.act("mark", flag.zone));
      b.disabled = !state.controls.mark;
      b.setAttribute("aria-label", `${text.markIntended.en}: ${labelOf(flag.zone)}`);
      marksBox.appendChild(b);
    }
    for (const id of state.marks) {
      const b = button(text.removeMark, () => actions.unmark(id));
      b.disabled = !state.controls.mark;
      b.setAttribute("aria-label", `${text.removeMark.en}: ${labelOf(id)}`);
      marksBox.appendChild(b);
    }

    notice.textContent = state.notice?.en ?? "";
    renderCurvePanel(curve, state);
  };

  return { render };
}
