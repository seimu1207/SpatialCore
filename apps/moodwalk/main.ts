import { createHistory } from "../../core/model/history.ts";
import { startCoreView, type CoreViewHandle } from "../../core/view/start-view.tsx";
import { readImageFile } from "./browser/images.ts";
import { renderSamples } from "./browser/samples.ts";
import { BoardController, type ImagePort, type ViewPort } from "./controller.ts";
import { loadBoardData, type DataError } from "./model/board-data.ts";
import { BUNDLED } from "./model/bundled.ts";
import { ImageStore } from "./model/image-store.ts";
import { buildViewSettings } from "./model/layout.ts";
import { SAMPLE_RECIPES } from "./model/sample-images.ts";
import { backLink, msgBoardInvalid, msgNoWebGl, title } from "./text.ts";
import { createUi } from "./ui.ts";

/** The back link always points at the Top_Page through BASE_URL (R-APP2-01.6). */
function backLinkElement(): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = import.meta.env.BASE_URL;
  link.textContent = backLink.en;
  return link;
}

/** Title, the invalid-data message with one line per error, and the back link; nothing else starts (R-APP2-01.4). */
function showInvalid(root: HTMLElement, errors: readonly DataError[]): void {
  const heading = document.createElement("h1");
  heading.textContent = title.en;
  const message = document.createElement("p");
  message.textContent = msgBoardInvalid.en;
  message.setAttribute("role", "alert");
  const list = document.createElement("ul");
  for (const e of errors) {
    const li = document.createElement("li");
    li.textContent = `${e.file} ${e.path}: ${e.message}`;
    list.appendChild(li);
  }
  const wrap = document.createElement("p");
  wrap.appendChild(backLinkElement());
  root.replaceChildren(heading, message, list, wrap);
}

/** True when a WebGL2 context can be made. Any exception counts as "not available" (M21). */
function probeWebgl(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const root = document.getElementById("app");
  const host = document.getElementById("view");
  const header = document.getElementById("header");
  const notice = document.getElementById("notice");
  if (root === null || host === null || header === null || notice === null) return;

  const loaded = loadBoardData(BUNDLED);
  if (!loaded.ok) return showInvalid(root, loaded.errors);
  const data = loaded.data;
  const created = createHistory(data.scenario, 100);
  if (!created.ok) {
    return showInvalid(
      root,
      created.errors.map((e) => ({ file: "scenario", path: e.path, message: e.message })),
    );
  }
  const history = created.history;

  header.appendChild(backLinkElement());

  // M21: without WebGL 2 the Core_View draws its own message; the page adds the back link and its message.
  if (!probeWebgl()) {
    startCoreView({
      host,
      history,
      settings: buildViewSettings(history.present.zones, "overview"),
      theme: data.theme,
      resolveImage: () => null,
      onEdit: () => undefined,
      onWalk: () => undefined,
      onTimeline: () => undefined,
    });
    notice.textContent = msgNoWebGl.en;
    return;
  }

  const store = new ImageStore((url) => URL.revokeObjectURL(url));
  let samplesFailed = false;
  try {
    for (const [reference, url] of await renderSamples(SAMPLE_RECIPES)) store.put(reference, url);
  } catch {
    samplesFailed = true;
  }

  // The controller is made first because startCoreView may call `onEdit` before it returns.
  let handle: CoreViewHandle | null = null;
  const start = (h: typeof history, settings: unknown): CoreViewHandle =>
    startCoreView({
      host,
      history: h,
      settings,
      theme: data.theme,
      resolveImage: (reference) => store.url(reference),
      onEdit: (report) => controller.onEdit(report),
      onWalk: (state, progress) => controller.onWalk(state, progress),
      onTimeline: (report) => controller.onTimeline(report),
      onSelect: (selection) => controller.onSelect(selection),
    });

  const port: ViewPort = {
    setHistory: (h) => handle?.setHistory(h),
    setPreset: (id) => handle?.setPreset(id),
    setEffects: (e) => handle?.setEffects(e),
    setEditMode: (m) => handle?.setEditMode(m),
    setGizmoMode: (m) => handle?.setGizmoMode(m),
    undo: () => handle?.undo(),
    redo: () => handle?.redo(),
    execute: (c) => handle?.execute(c),
    startWalk: (path, duration, linked) => handle?.startWalk(path, duration, linked),
    pauseWalk: () => handle?.pauseWalk(),
    resumeWalk: () => handle?.resumeWalk(),
    stopWalk: () => handle?.stopWalk(),
    stopTimeline: () => handle?.stopTimeline(),
    restart: (h, settings) => {
      handle?.stop();
      handle = start(h, settings);
    },
  };
  const images: ImagePort = {
    read: (file) => readImageFile(file),
    release: (url) => URL.revokeObjectURL(url),
  };

  const ui = createUi(root, {
    act: (control, arg) => controller.act(control, arg),
    addFiles: (files) => void controller.addFiles(files),
    chooseTarget: (zoneId) => controller.chooseTarget(zoneId),
    setSetting: (field, value) => controller.setSetting(field, value),
    unmark: (zoneId) => controller.unmark(zoneId),
  });
  const controller = new BoardController(data, history, store, port, images, ui);

  // Page-wide drop: preventDefault on both events so a dropped file never opens in the tab (R-APP2-04.10).
  document.addEventListener("dragover", (event) => event.preventDefault());
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) void controller.addFiles(files);
    else controller.dropText();
  });

  handle = start(history, buildViewSettings(history.present.zones, "overview"));
  controller.start();
  if (samplesFailed) controller.reportFailure();
}

void main();
