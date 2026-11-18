import { createRoot } from "react-dom/client";
import type { History } from "../model/history.ts";
import type { EffectRequest, Timeline } from "../model/rule-schema.ts";
import { loadViewSettings } from "./helpers/settings-schema.ts";
import { loadTheme } from "./helpers/theme-schema.ts";
import { initialViewState } from "./helpers/view-state.ts";
import { missingZoneRefs } from "./helpers/zone-refs.ts";
import { FONT_FAMILY, loadFont } from "./scene/font.ts";
import { createImageCache } from "./scene/image-cache.ts";
import { ViewRoot } from "./scene/view-root.tsx";
import {
  ViewStore,
  type EditCallback,
  type EditReport,
  type ErrorContext,
  type TimelineCallback,
  type TimelineReport,
  type WalkCallback,
} from "./scene/view-store.ts";
import type { WalkState } from "./helpers/view-state.ts";

export type { EditCallback, EditReport, ErrorContext, TimelineCallback, TimelineReport, WalkCallback, WalkState };

export type ImageResolver = (reference: string) => string | null; // a URL the browser can draw, or "no image"

export type CoreViewOptions = {
  host: HTMLElement; // View_Host
  history: History;
  settings: unknown; // View_Settings, checked by loadViewSettings
  theme: unknown; // Theme, checked by loadTheme
  resolveImage: ImageResolver;
  onEdit: EditCallback;
  onWalk: WalkCallback;
  onTimeline: TimelineCallback;
};

export type CoreViewHandle = {
  setHistory(history: History): void;
  setPreset(id: string): void;
  setEffects(effects: readonly EffectRequest[]): void;
  setTheme(theme: unknown): void;
  setEditMode(mode: "view" | "edit"): void;
  setGizmoMode(mode: "rotate" | "scale"): void;
  connectOn(edgeType: string): void;
  connectOff(): void;
  undo(): void;
  redo(): void;
  startWalk(pathId: string, duration: number, linked?: Timeline): void;
  pauseWalk(): void;
  resumeWalk(): void;
  stopWalk(): void;
  startTimeline(timeline: Timeline): void;
  pauseTimeline(): void;
  resumeTimeline(): void;
  stopTimeline(): void;
  stop(): void;
};

const SETTINGS_INVALID = "The view settings are invalid.";
const WEBGL_UNAVAILABLE = "3D display is not available in this browser.";

/** A handle where every function except `stop` does nothing (R-VIEW-03.6, 03.7). */
function messageHandle(host: HTMLElement, text: string): CoreViewHandle {
  const p = document.createElement("p");
  p.style.fontFamily = `${FONT_FAMILY}, sans-serif`;
  p.textContent = text;
  host.appendChild(p);
  const noop = (): void => undefined;
  return {
    setHistory: noop,
    setPreset: noop,
    setEffects: noop,
    setTheme: noop,
    setEditMode: noop,
    setGizmoMode: noop,
    connectOn: noop,
    connectOff: noop,
    undo: noop,
    redo: noop,
    startWalk: noop,
    pauseWalk: noop,
    resumeWalk: noop,
    stopWalk: noop,
    startTimeline: noop,
    pauseTimeline: noop,
    resumeTimeline: noop,
    stopTimeline: noop,
    stop: () => {
      p.remove();
    },
  };
}

function hasWebGL2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

export function startCoreView(options: CoreViewOptions): CoreViewHandle {
  const settings = loadViewSettings(options.settings);
  const theme = loadTheme(options.theme);
  if (!settings.ok || !theme.ok) {
    const handle = messageHandle(options.host, SETTINGS_INVALID);
    options.onEdit({
      kind: "errors",
      context: "start",
      errors: [...(settings.ok ? [] : settings.errors), ...(theme.ok ? [] : theme.errors)],
    });
    return handle;
  }

  if (!hasWebGL2()) return messageHandle(options.host, WEBGL_UNAVAILABLE);

  const store = new ViewStore({
    history: options.history,
    settings: settings.settings,
    theme: theme.theme,
    view: initialViewState(settings.settings),
    onEdit: options.onEdit,
    onWalk: options.onWalk,
    onTimeline: options.onTimeline,
  });

  const missing = missingZoneRefs(settings.settings, options.history.present);
  if (missing.length > 0) options.onEdit({ kind: "errors", context: "settings", errors: missing });

  const div = document.createElement("div");
  div.style.width = "100%";
  div.style.height = "100%";
  options.host.appendChild(div);
  const root = createRoot(div);
  const images = createImageCache(options.resolveImage);
  root.render(<ViewRoot store={store} images={images} />);
  void loadFont();

  let stopped = false;
  const guard =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A): void => {
      if (!stopped) fn(...args);
    };

  return {
    setHistory: guard((h) => {
      store.setHistory(h);
    }),
    setPreset: guard((id) => {
      store.setPreset(id);
    }),
    setEffects: guard((e) => {
      store.setEffects(e);
    }),
    setTheme: guard((t) => {
      store.setTheme(t);
    }),
    setEditMode: guard((m) => {
      store.setEditMode(m);
    }),
    setGizmoMode: guard((m) => {
      store.setGizmoMode(m);
    }),
    connectOn: guard((t) => {
      store.connectOn(t);
    }),
    connectOff: guard(() => {
      store.connectOff();
    }),
    undo: guard(() => {
      store.undo();
    }),
    redo: guard(() => {
      store.redo();
    }),
    startWalk: guard((id, d, linked) => {
      store.startWalk(id, d, linked);
    }),
    pauseWalk: guard(() => {
      store.pauseWalk();
    }),
    resumeWalk: guard(() => {
      store.resumeWalk();
    }),
    stopWalk: guard(() => {
      store.stopWalk();
    }),
    startTimeline: guard((t) => {
      store.startTimeline(t);
    }),
    pauseTimeline: guard(() => {
      store.pauseTimeline();
    }),
    resumeTimeline: guard(() => {
      store.resumeTimeline();
    }),
    stopTimeline: guard(() => {
      store.stopTimeline();
    }),
    stop: () => {
      if (stopped) return;
      stopped = true;
      store.stop();
      images.dispose();
      root.unmount();
      div.remove();
    },
  };
}
