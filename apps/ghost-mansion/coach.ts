// The guide ghost's advice (pure: no DOM, no three.js). Derived only from the GameViewState, so the same
// state always gives the same advice. `doNext` is a control that is shown and enabled, or null.

import type { LocalizedText } from "../../core/model/scenario-schema.ts";
import type { ControlId, GameViewState } from "./controller.ts";
import type { Phase } from "./model/phase.ts";
import { coachText as t, phaseNames } from "./text.ts";

export type Coach = {
  say: LocalizedText;
  doNext: ControlId | null;
  progress: { done: number; total: number; label: LocalizedText };
};

const PHASES: Phase[] = ["sample", "prepare", "ghostNight", "fixIt", "lookBack"];

function usable(state: GameViewState, id: ControlId): boolean {
  const c = state.controls[id];
  return c.shown && c.enabled;
}

function join(a: LocalizedText, b: LocalizedText): LocalizedText {
  return { en: `${a.en} ${b.en}`, ja: `${a.ja}${b.ja}` };
}

function opDone(state: GameViewState, id: string): boolean {
  return state.response?.operations.find((o) => o.id === id)?.done === true;
}

function advice(state: GameViewState): { say: LocalizedText; doNext: ControlId | null } {
  const pick = (id: ControlId): ControlId | null => (usable(state, id) ? id : null);
  switch (state.phase) {
    case "sample": {
      const total = state.card.preconditions.length;
      const k = state.sampleShown;
      if (k <= 0) return { say: t.sampleStart, doNext: pick("next") };
      if (k < total) {
        const label = state.card.preconditions[k - 1]?.label;
        const found = label === undefined ? t.sampleFound : join(t.sampleFound, label);
        return { say: join(found, t.sampleMore), doNext: pick("next") };
      }
      return { say: t.sampleDone, doNext: pick("toPrepare") };
    }
    case "prepare": {
      if (usable(state, "cancel")) return { say: t.prepareConnect, doNext: null };
      const broken = state.preconditions.length > 0 && state.preconditions.some((p) => !p.holds);
      if (broken) return { say: t.prepareReady, doNext: pick("startNight") };
      if (usable(state, "dontRead")) return { say: t.prepareDontRead, doNext: pick("dontRead") };
      if (usable(state, "keyBell")) return { say: t.prepareKey, doNext: pick("keyBell") };
      return { say: t.prepareStart, doNext: null };
    }
    case "ghostNight": {
      const label = state.stepLabel;
      return { say: label === null ? t.nightWatch : join(join(t.nightNow, label), t.nightWatch), doNext: null };
    }
    case "fixIt": {
      const stopped = opDone(state, "stop-robot");
      const cut = opDone(state, "cut-key");
      const consulted = opDone(state, "consult");
      if (stopped && cut && consulted) return { say: t.fixDone, doNext: pick("toLookBack") };
      if (usable(state, "cancel")) return { say: t.fixConsult, doNext: null };
      if (!stopped) {
        if (usable(state, "stopRobot")) return { say: t.fixStopReady, doNext: pick("stopRobot") };
        return { say: !cut && !consulted ? t.fixStart : t.fixStop, doNext: null };
      }
      if (!cut) {
        if (usable(state, "cutKey")) return { say: t.fixCut, doNext: pick("cutKey") };
        return { say: t.fixCutPick, doNext: null };
      }
      return { say: t.fixConsult, doNext: pick("consult") };
    }
    case "lookBack": {
      if (!usable(state, "replay")) return { say: t.lookBackReplaying, doNext: null };
      if (state.score?.stars === 3) return { say: t.lookBackThree, doNext: null };
      return { say: t.lookBackMore, doNext: pick("prepareAgain") };
    }
  }
}

export function coachFor(state: GameViewState): Coach {
  const index = PHASES.indexOf(state.phase);
  const { say, doNext } = advice(state);
  return {
    say,
    doNext,
    progress: {
      done: index,
      total: PHASES.length,
      label: {
        en: `${t.progressStep.en} ${index + 1} ${t.progressOf.en} ${PHASES.length}: ${phaseNames[state.phase].en}`,
        ja: `${t.progressStep.ja} ${index + 1} ${t.progressOf.ja} ${PHASES.length}：${phaseNames[state.phase].ja}`,
      },
    },
  };
}
