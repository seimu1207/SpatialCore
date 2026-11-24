import { createHistory } from "../../core/model/history.ts";
import { startCoreView, type CoreViewHandle } from "../../core/view/start-view.tsx";
import { GameController, type ViewPort } from "./controller.ts";
import { attackCheckSet, withCheckSet } from "./model/built-rules.ts";
import { BUNDLED } from "./model/bundled.ts";
import { applyFallback, FALLBACK } from "./model/fallback.ts";
import { loadGameData } from "./model/game-data.ts";
import { deriveSample } from "./model/sample.ts";
import { backLink, errorMessages, title } from "./text.ts";
import { createPanel } from "./ui.ts";

/** Title, one message, and the back link; nothing else starts (R-APP1-01.3, 01.5, 02.4). */
function showMessage(root: HTMLElement, text: string): void {
  const heading = document.createElement("h1");
  heading.textContent = title.en;
  const message = document.createElement("p");
  message.textContent = text;
  message.setAttribute("role", "alert");
  const wrap = document.createElement("p");
  const link = document.createElement("a");
  link.href = import.meta.env.BASE_URL;
  link.textContent = backLink.en;
  wrap.appendChild(link);
  root.replaceChildren(heading, message, wrap);
}

/** True when a WebGL2 context can be made. Any exception counts as "not available" (G11). */
function probeWebgl(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

function main(): void {
  const root = document.getElementById("app");
  const host = document.getElementById("view");
  const panelRoot = document.getElementById("panel");
  if (root === null || host === null || panelRoot === null) return;

  const loaded = loadGameData(BUNDLED);
  if (!loaded.ok) return showMessage(root, errorMessages.invalidData.en);
  const fallback = applyFallback(loaded.data, FALLBACK);
  if (!fallback.ok) return showMessage(root, errorMessages.invalidData.en);
  const data = fallback.data;

  const attackRules = withCheckSet(data.rules, attackCheckSet(data.attackCard));
  if (!attackRules.ok) return showMessage(root, errorMessages.invalidData.en);

  const sample = deriveSample(data.preset);
  if (!sample.ok) return showMessage(root, errorMessages.invalidData.en);
  const history = createHistory(sample.scenario, 100);
  if (!history.ok) return showMessage(root, errorMessages.invalidData.en);

  const heading = document.createElement("h1");
  heading.textContent = title.en;
  root.replaceChildren(heading);

  const webgl = probeWebgl();

  // The controller is made first because startCoreView may call `onEdit` before it returns.
  let handle: CoreViewHandle | null = null;
  const port: ViewPort = {
    setHistory: (h) => handle?.setHistory(h),
    setPreset: (id) => handle?.setPreset(id),
    setEffects: (e) => handle?.setEffects(e),
    setEditMode: (m) => handle?.setEditMode(m),
    connectOn: (t) => handle?.connectOn(t),
    connectOff: () => handle?.connectOff(),
    undo: () => handle?.undo(),
    redo: () => handle?.redo(),
    execute: (c) => handle?.execute(c),
    startTimeline: (t) => handle?.startTimeline(t),
    stopTimeline: () => handle?.stopTimeline(),
  };

  let controller: GameController | null = null;
  const panel = createPanel(panelRoot, {
    act: (control, arg) => controller?.act(control, arg),
    presets: data.viewSettings.presets.map((p) => ({ id: p.id, label: p.label })),
    backHref: import.meta.env.BASE_URL,
  });
  controller = new GameController(data, attackRules.value, FALLBACK, port, panel);
  const game = controller;

  handle = startCoreView({
    host,
    history: history.history,
    settings: data.viewSettings,
    theme: data.theme,
    resolveImage: () => null,
    onEdit: (report) => game.onEdit(report),
    onWalk: () => undefined,
    onTimeline: (report) => game.onTimeline(report),
    onSelect: (selection) => game.onSelect(selection),
  });

  if (webgl) {
    game.start();
  } else {
    showMessage(panelRoot, errorMessages.noWebgl.en);
  }
}

main();
