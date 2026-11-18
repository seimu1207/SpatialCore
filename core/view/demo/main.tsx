// The Core_Demo page: a generic Sample_Scenario (or, with `?perf`, the 50-image Scenario) and view controls.
import { createHistory } from "../../model/history.ts";
import type { History } from "../../model/history.ts";
import { loadScenario } from "../../model/scenario-io.ts";
import type { Scenario } from "../../model/scenario-schema.ts";
import type { EffectRequest, Timeline } from "../../model/rule-schema.ts";
import { timelineFromZones } from "../../model/timeline.ts";
import { NEUTRAL_THEME } from "../helpers/neutral-theme.ts";
import { FONT_FAMILY } from "../scene/font.ts";
import { startCoreView } from "../start-view.tsx";
import type { CoreViewHandle, ImageResolver } from "../start-view.tsx";
import { buildPerfScenario, buildPerfSettings } from "./perf-scenario.ts";
import { startPerfOverlay } from "./perf-overlay.ts";
import perf01 from "./images/perf-01.svg?url";
import perf02 from "./images/perf-02.svg?url";
import perf03 from "./images/perf-03.svg?url";
import perf04 from "./images/perf-04.svg?url";
import perf05 from "./images/perf-05.svg?url";
import perf06 from "./images/perf-06.svg?url";
import perf07 from "./images/perf-07.svg?url";
import perf08 from "./images/perf-08.svg?url";
import perf09 from "./images/perf-09.svg?url";
import perf10 from "./images/perf-10.svg?url";
import sampleText from "./sample-scenario.json?raw";
import { SAMPLE_SETTINGS, SAMPLE_THEME } from "./sample-settings.ts";

const WALK_SECONDS = 12;
const FIXED_EFFECTS: readonly EffectRequest[] = [
  { effect: "haze", target: { kind: "node", id: "n2" }, source: "demo" },
  { effect: "haze", target: { kind: "zone", id: "area-b" }, source: "demo" },
];

const imageUrls: Readonly<Record<string, string>> = {
  "images/perf-01.svg": perf01,
  "images/perf-02.svg": perf02,
  "images/perf-03.svg": perf03,
  "images/perf-04.svg": perf04,
  "images/perf-05.svg": perf05,
  "images/perf-06.svg": perf06,
  "images/perf-07.svg": perf07,
  "images/perf-08.svg": perf08,
  "images/perf-09.svg": perf09,
  "images/perf-10.svg": perf10,
};

const resolveImage: ImageResolver = (reference) => imageUrls[reference] ?? null;

function addButton(bar: HTMLElement, label: string, onClick: () => void): void {
  const button = document.createElement("button");
  button.type = "button";
  button.style.fontFamily = `${FONT_FAMILY}, sans-serif`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  bar.append(button);
}

function addGroup(bar: HTMLElement, title: string): void {
  const span = document.createElement("span");
  span.style.fontFamily = `${FONT_FAMILY}, sans-serif`;
  span.style.margin = "0 4px 0 12px";
  span.textContent = title;
  bar.append(span);
}

function addControls(parent: HTMLElement, handle: CoreViewHandle, scenario: Scenario): void {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:10;padding:6px 8px;background:rgba(255,255,255,0.85);display:flex;flex-wrap:wrap;gap:4px;align-items:center";
  parent.append(bar);

  addGroup(bar, "View");
  for (const preset of SAMPLE_SETTINGS.presets) {
    addButton(bar, preset.label.en, () => {
      handle.setPreset(preset.id);
    });
  }

  const outcome = timelineFromZones(scenario);
  const timeline: Timeline | null = outcome.ok ? outcome.value : null;

  addGroup(bar, "Walkthrough");
  const path = SAMPLE_SETTINGS.paths[0];
  if (path !== undefined) {
    addButton(bar, "Start", () => {
      handle.startWalk(path.id, WALK_SECONDS);
    });
  }
  addButton(bar, "Pause", () => {
    handle.pauseWalk();
  });
  addButton(bar, "Resume", () => {
    handle.resumeWalk();
  });
  addButton(bar, "Stop", () => {
    handle.stopWalk();
  });

  addGroup(bar, "Timeline");
  if (timeline !== null) {
    addButton(bar, "Start", () => {
      handle.startTimeline(timeline);
    });
  }
  addButton(bar, "Pause", () => {
    handle.pauseTimeline();
  });
  addButton(bar, "Resume", () => {
    handle.resumeTimeline();
  });
  addButton(bar, "Stop", () => {
    handle.stopTimeline();
  });

  addGroup(bar, "Linked");
  if (path !== undefined && timeline !== null) {
    addButton(bar, "Start linked walkthrough", () => {
      handle.startWalk(path.id, WALK_SECONDS, timeline);
    });
  }

  addGroup(bar, "Edit");
  addButton(bar, "View mode", () => {
    handle.setEditMode("view");
  });
  addButton(bar, "Edit mode", () => {
    handle.setEditMode("edit");
  });
  addButton(bar, "Rotate", () => {
    handle.setGizmoMode("rotate");
  });
  addButton(bar, "Scale", () => {
    handle.setGizmoMode("scale");
  });
  const edgeType = scenario.edges[0]?.type;
  if (edgeType !== undefined) {
    addButton(bar, "Connect on", () => {
      handle.connectOn(edgeType);
    });
  }
  addButton(bar, "Connect off", () => {
    handle.connectOff();
  });
  addButton(bar, "Undo", () => {
    handle.undo();
  });
  addButton(bar, "Redo", () => {
    handle.redo();
  });

  addGroup(bar, "Theme");
  addButton(bar, "Sample theme", () => {
    handle.setTheme(SAMPLE_THEME);
  });
  addButton(bar, "Neutral theme", () => {
    handle.setTheme(NEUTRAL_THEME);
  });

  handle.setEffects(FIXED_EFFECTS);
}

function start(): void {
  const host = document.getElementById("demo-root");
  if (host === null) return;
  host.style.width = "100vw";
  host.style.height = "100vh";
  document.body.style.margin = "0";
  document.body.style.fontFamily = `${FONT_FAMILY}, sans-serif`;

  const perf = new URLSearchParams(window.location.search).has("perf");
  let scenario: Scenario;
  if (perf) {
    scenario = buildPerfScenario();
  } else {
    const loaded = loadScenario(sampleText);
    if (!loaded.ok) return;
    scenario = loaded.scenario;
  }

  const created = createHistory(scenario);
  if (!created.ok) return;
  let history: History = created.history;

  const handle = startCoreView({
    host,
    history,
    settings: perf ? buildPerfSettings() : SAMPLE_SETTINGS,
    theme: perf ? NEUTRAL_THEME : SAMPLE_THEME,
    resolveImage,
    onEdit: (report) => {
      if (report.kind === "history") history = report.history;
    },
    onWalk: () => undefined,
    onTimeline: () => undefined,
  });

  if (perf) {
    startPerfOverlay(document.body);
  } else {
    addControls(document.body, handle, scenario);
  }
}

start();
