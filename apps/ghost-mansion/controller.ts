// Game controller of Ghost Mansion (design.md "Controller"). It talks to the Core_View only through
// `ViewPort` (a type taken from the CoreViewHandle) and to the panel only through `UiSink`, so the order of
// Core_View calls can be tested in Node with a recording stub. Only types are imported from `core/view`.
// It covers every Phase: Sample, Prepare, Ghost Night, Fix It, and Look Back.

import { evaluateCheckSets } from "../../core/model/conditions.ts";
import { sortUniqueEffects } from "../../core/model/effects.ts";
import { createHistory, type History } from "../../core/model/history.ts";
import type { RuleDefinition, Timeline } from "../../core/model/rule-schema.ts";
import type { LocalizedText, Scenario } from "../../core/model/scenario-schema.ts";
import type { CoreViewHandle, EditReport, Selection, TimelineReport } from "../../core/view/start-view.tsx";
import { deriveActionLog, type ResponseOp } from "./model/action-log.ts";
import { responseCheckSet, withCheckSet } from "./model/built-rules.ts";
import { cutKeyCommand, dontReadCommand, keyChoiceCommand, stopRobotCommand } from "./model/commands.ts";
import { controlsFor, type ControlId, type ControlState } from "./model/controls.ts";
import { highlightEffects, lookBackEffects } from "./model/effects.ts";
import type { Flags } from "./model/fallback.ts";
import type { AttackCard, GameData, OrderRule } from "./model/game-data.ts";
import { judgeMansion, judgeNight, type MansionJudgement, type NightResult } from "./model/judge.ts";
import { EDGE_TYPES, RESPONSE_OPS } from "./model/names.ts";
import { checkOrder, type OrderResult } from "./model/order.ts";
import { nextPhase, type Phase, type PhaseState } from "./model/phase.ts";
import { deriveSample } from "./model/sample.ts";
import { findHiddenJobId, fixReplayTimeline, nightTimeline, sampleTimeline } from "./model/timelines.ts";
import { errorMessages } from "./text.ts";

export type { ControlId };

export type ViewPort = Pick<
  CoreViewHandle,
  | "setHistory"
  | "setPreset"
  | "setEffects"
  | "setEditMode"
  | "connectOn"
  | "connectOff"
  | "undo"
  | "redo"
  | "execute"
  | "startTimeline"
  | "stopTimeline"
>;

/** The Response_Result: done state of each operation, the Action_Log, and the order check (R-APP1-16.7, 17.2). */
export type ResponseView = {
  operations: { id: ResponseOp; done: boolean }[];
  log: ResponseOp[];
  order: { rule: OrderRule; result: OrderResult }[];
};

/** What the panel draws. Plain data; the panel reads it and changes nothing. */
export type GameViewState = {
  phase: Phase;
  controls: Record<ControlId, ControlState>;
  card: AttackCard;
  /** Precondition results for the Attack_Card block. In Sample, only the shown ones are `true`. */
  preconditions: { id: string; holds: boolean }[];
  sampleShown: number;
  /** Prepare display values (R-APP1-09.6); null outside Prepare. */
  status: { convenience: number; reachScore: number } | null;
  /** Label of the current step of a night replay; null otherwise. */
  stepLabel: LocalizedText | null;
  /** True on the hidden-command step of a night where the attack succeeds (R-APP1-15.3). */
  hiddenFollowed: boolean;
  /** The Score_Point of the last night start state (R-APP1-10.1); null before the first night. */
  score: { convenience: number; damage: number; stars: number } | null;
  /** True in Fix It: the panel shows the incident line (R-APP1-16.1). */
  incident: boolean;
  /** Live Response_Result in Fix It; the stored one in Look Back after Fix It; otherwise null. */
  response: ResponseView | null;
  /** Error or failure message (R-APP1-02.4, 06.5, 16.10); null when none. Drawn by render, so it survives it. */
  notice: LocalizedText | null;
  /** Id of the ViewPreset last passed to `setPreset` (display only: marks the active view button). */
  presetId: string;
};

export type UiSink = { render(state: GameViewState): void };

type Replay = "none" | "sample" | "night" | "fix" | "lookBack";

const CONNECT_TYPES = { cites: EDGE_TYPES.cites, consult: EDGE_TYPES.consult } as const;

export class GameController {
  private phaseState: PhaseState = { phase: "sample" };
  private history: History | null = null;
  private nightStart: Scenario | null = null;
  private night: NightResult | null = null;
  private selection: Selection = null;
  private connectType: string | null = null;
  private replay: Replay = "none";
  private sampleShown = 0;
  private sampleNight: NightResult | null = null;
  private sampleScenario: Scenario | null = null;
  private judgement: MansionJudgement | null = null;
  private activeTimeline: Timeline | null = null;
  private hiddenJobId = "";
  private stepLabel: LocalizedText | null = null;
  private hiddenLine = false;
  private broken = false;
  private actionLog: ResponseOp[] = [];
  private response: ResponseView | null = null;
  private responseResult: ResponseView | null = null;
  /** The last error or failure message. Cleared by the next control press or `history` report. */
  private notice: LocalizedText | null = null;
  /** The ViewPreset last passed to `setPreset`; initially the first preset. Display only. */
  private presetId = "";

  private readonly data: GameData;
  private readonly attackRules: RuleDefinition;
  private readonly flags: Flags;
  private readonly view: ViewPort;
  private readonly ui: UiSink;

  constructor(data: GameData, attackRules: RuleDefinition, flags: Flags, view: ViewPort, ui: UiSink) {
    this.data = data;
    this.attackRules = attackRules;
    this.flags = flags;
    this.view = view;
    this.ui = ui;
    this.presetId = data.viewSettings.presets[0]?.id ?? "";
  }

  private showPreset(id: string): void {
    this.presetId = id;
    this.view.setPreset(id);
  }

  /** Sample entry (design.md call table, row "start"). */
  start(): void {
    if (this.phaseState.phase !== "sample" || this.sampleNight !== null) return;
    const sample = deriveSample(this.data.preset);
    if (!sample.ok) return this.fail(errorMessages.invalidData);
    const history = this.makeHistory(sample.scenario);
    if (history === null) return;
    const night = judgeNight(sample.scenario, this.data, this.attackRules, this.flags);
    if (!night.ok) return this.fail(errorMessages.judgeFailed);
    this.sampleScenario = sample.scenario;
    this.sampleNight = night.value;
    this.history = history;
    this.view.setEditMode("view");
    this.view.setEffects(sortUniqueEffects(night.value.fog));
    this.render();
  }

  onEdit(report: EditReport): void {
    if (report.kind === "history") {
      this.notice = null;
      const previous = this.history?.present ?? null;
      this.history = report.history;
      if (this.phaseState.phase === "prepare") this.refreshPrepare();
      else if (this.phaseState.phase === "fixIt") this.refreshFixIt(report.history);
      this.endConnectIfDone(previous, report.history.present);
      this.render();
      return;
    }
    // An `errors` report never changes the stored History (R-APP1-16.10).
    switch (report.context) {
      case "edit":
        this.notice = errorMessages.changeFailed;
        break;
      case "start":
      case "settings":
      case "theme":
        this.broken = true;
        this.notice = errorMessages.invalidData;
        break;
      case "preset":
      case "effects":
      case "walk":
        this.notice = errorMessages.judgeFailed;
        break;
      case "timeline":
        // No playback runs, so no `end` report will come: run the end handler at once.
        this.notice = errorMessages.judgeFailed;
        this.handleEnd();
        break;
    }
    this.render();
  }

  onTimeline(report: TimelineReport): void {
    if (report.kind === "end") {
      this.handleEnd();
      return;
    }
    if (this.replay === "night" && this.activeTimeline !== null) {
      const step = this.activeTimeline.steps[report.position];
      this.stepLabel = step?.label ?? null;
      this.hiddenLine = this.night?.verdict === true && step?.id === `job-${this.hiddenJobId}`;
      this.render();
    }
  }

  onSelect(selection: Selection): void {
    this.selection = selection;
    this.render();
  }

  act(control: ControlId, arg?: string): void {
    if (this.broken) return;
    this.notice = null;
    // An operation control ends Connect_Mode first (R-APP1-19.9). Phase changes and "cancel" and
    // "start over" call `connectOff` in their own place of the call table.
    const own: readonly ControlId[] = ["toPrepare", "startNight", "cancel", "startOver"];
    const operation: readonly ControlId[] = [
      "keyPlain",
      "keyBell",
      "keyNone",
      "dontRead",
      "connectSource",
      "stopRobot",
      "cutKey",
      "consult",
      "undo",
      "redo",
    ];
    if (this.connectType !== null && operation.includes(control) && !own.includes(control)) {
      this.view.connectOff();
      this.connectType = null;
    }
    switch (control) {
      case "preset":
        if (arg !== undefined) {
          this.showPreset(arg);
          this.render();
        }
        return;
      case "next":
        return this.sampleNext();
      case "toPrepare":
        return this.toPrepare();
      case "startNight":
        return this.startNight();
      case "startOver":
        return this.startOver();
      case "keyPlain":
        return this.keyChoice("plain");
      case "keyBell":
        return this.keyChoice("bell");
      case "keyNone":
        return this.keyChoice("none");
      case "dontRead":
        return this.dontRead();
      case "connectSource":
        if (this.phaseState.phase !== "prepare" || this.flags.f1) return;
        this.view.connectOn(CONNECT_TYPES.cites);
        this.connectType = CONNECT_TYPES.cites;
        this.render();
        return;
      case "cancel":
        if (!this.editable() || this.connectType === null) return;
        this.view.connectOff();
        this.connectType = null;
        this.render();
        return;
      case "undo":
        if (this.editable()) this.view.undo();
        return;
      case "redo":
        if (this.editable()) this.view.redo();
        return;
      case "stopRobot":
        return this.stopRobot();
      case "cutKey":
        return this.cutKey();
      case "consult":
        if (this.phaseState.phase !== "fixIt") return;
        this.view.connectOn(CONNECT_TYPES.consult);
        this.connectType = CONNECT_TYPES.consult;
        this.render();
        return;
      case "toLookBack":
        return this.toLookBack();
      case "replay":
        return this.replayNight();
      case "prepareAgain":
        return this.prepareAgain();
      default:
        // back is a link.
        return;
    }
  }

  // --- Sample ---

  private sampleNext(): void {
    const night = this.sampleNight;
    if (this.phaseState.phase !== "sample" || night === null) return;
    const count = this.data.attackCard.preconditions.length;
    if (this.sampleShown >= count) return;
    this.sampleShown += 1;
    const k = this.sampleShown;
    if (k === 1) this.showPreset("overhead");
    const marks = highlightEffects(this.data.attackCard, k);
    this.view.setEffects(sortUniqueEffects([...night.fog, ...marks]));
    if (k === count) {
      const timeline = sampleTimeline(night, highlightEffects(this.data.attackCard, count));
      if (!timeline.ok) {
        this.notice = errorMessages.judgeFailed;
      } else {
        this.replay = "sample";
        this.activeTimeline = timeline.value;
        this.view.startTimeline(timeline.value);
      }
    }
    this.render();
  }

  // --- Prepare ---

  private toPrepare(): void {
    const count = this.data.attackCard.preconditions.length;
    if (this.phaseState.phase !== "sample" || this.sampleShown < count) return;
    this.enterPrepare(this.data.preset, { type: "toPrepare" });
  }

  /** The call table rows "ↁEprepare": `stopTimeline`, `connectOff`, `setPreset`, `setEditMode`, `setHistory`, `setEffects`. */
  private enterPrepare(scenario: Scenario, action: Parameters<typeof nextPhase>[1]): void {
    const next = nextPhase(this.phaseState, action);
    if (next === this.phaseState) return;
    const judged = judgeMansion(scenario, this.data, this.attackRules, this.flags);
    if (!judged.ok) return this.fail(errorMessages.judgeFailed);
    const history = this.makeHistory(scenario);
    if (history === null) return;
    this.phaseState = next;
    this.history = history;
    this.judgement = judged.value;
    this.replay = "none";
    this.activeTimeline = null;
    this.stepLabel = null;
    this.hiddenLine = false;
    this.connectType = null;
    this.actionLog = [];
    this.response = null;
    this.responseResult = null;
    this.view.stopTimeline();
    this.view.connectOff();
    this.showPreset("overhead");
    this.view.setEditMode("edit");
    this.view.setHistory(history);
    this.view.setEffects(sortUniqueEffects(judged.value.fog));
    this.render();
  }

  private startOver(): void {
    if (this.phaseState.phase !== "prepare") return;
    const judged = judgeMansion(this.data.preset, this.data, this.attackRules, this.flags);
    if (!judged.ok) return this.fail(errorMessages.judgeFailed);
    const history = this.makeHistory(this.data.preset);
    if (history === null) return;
    this.connectType = null;
    this.history = history;
    this.judgement = judged.value;
    // `setHistory` calls no Edit_Callback, so the values are recomputed here (R-APP1-12.6).
    this.view.connectOff();
    this.view.setHistory(history);
    this.view.setEffects(sortUniqueEffects(judged.value.fog));
    this.render();
  }

  private keyChoice(choice: "plain" | "bell" | "none"): void {
    const history = this.history;
    const sel = this.selection;
    if (this.phaseState.phase !== "prepare" || history === null || sel === null || sel.kind !== "edge") return;
    const command = keyChoiceCommand(history.present, sel.id, choice);
    if (command !== null) this.view.execute(command);
  }

  private dontRead(): void {
    const history = this.history;
    const sel = this.selection;
    if (this.phaseState.phase !== "prepare" || history === null || sel === null || sel.kind !== "node") return;
    const command = dontReadCommand(history.present, sel.id);
    if (command !== null) this.view.execute(command);
  }

  /** Recompute the Prepare display values and the fog from the stored History (R-APP1-09.6, 14.4). */
  private refreshPrepare(): void {
    if (this.history === null) return;
    const judged = judgeMansion(this.history.present, this.data, this.attackRules, this.flags);
    if (!judged.ok) {
      this.notice = errorMessages.judgeFailed;
      return;
    }
    this.judgement = judged.value;
    this.view.setEffects(sortUniqueEffects(judged.value.fog));
  }

  /** Connect_Mode ends when the connection it waited for is made (R-APP1-08.3). */
  private endConnectIfDone(previous: Scenario | null, present: Scenario): void {
    const type = this.connectType;
    if (type === null || previous === null) return;
    const known = new Set(previous.edges.map((e) => e.id));
    if (present.edges.some((e) => e.type === type && !known.has(e.id))) {
      this.view.connectOff();
      this.connectType = null;
    }
  }

  // --- Ghost Night ---

  private startNight(): void {
    const history = this.history;
    if (this.phaseState.phase !== "prepare" || history === null) return;
    const next = nextPhase(this.phaseState, { type: "startNight" });
    if (next === this.phaseState) return;
    const start = history.present;
    // Judge first: a failure keeps the Phase (R-APP1-06.5).
    const night = judgeNight(start, this.data, this.attackRules, this.flags);
    if (!night.ok) return this.fail(errorMessages.judgeFailed);
    const hiddenJobId = findHiddenJobId(start, this.data.jobs) ?? "";
    const timeline = nightTimeline(start, night.value, this.data.jobs, hiddenJobId);
    if (!timeline.ok) return this.fail(errorMessages.judgeFailed);
    this.phaseState = next;
    this.nightStart = start;
    this.night = night.value;
    this.hiddenJobId = hiddenJobId;
    this.activeTimeline = timeline.value;
    this.replay = "night";
    this.stepLabel = null;
    this.hiddenLine = false;
    this.connectType = null;
    this.view.stopTimeline();
    this.view.connectOff();
    this.showPreset("overhead");
    this.view.setEditMode("view");
    this.view.startTimeline(timeline.value);
    this.render();
  }

  /** Timeline `end` report, or a rejected `startTimeline` (so the game cannot get stuck). */
  private handleEnd(): void {
    const replay = this.replay;
    if (replay === "sample") {
      // The ended Timeline stays drawn until the change to Prepare (R-APP1-12.9).
      this.replay = "none";
    } else if (replay === "night" && this.night !== null) {
      this.replay = "none";
      this.activeTimeline = null;
      this.nightEnded(this.night);
      return;
    } else if (replay === "fix") {
      this.replay = "none";
      this.activeTimeline = null;
      this.fixReplayEnd();
    } else if (replay === "lookBack") {
      this.replay = "none";
      this.activeTimeline = null;
      this.lookBackReplayEnd();
    }
    this.render();
  }

  private nightEnded(night: NightResult): void {
    const next = nextPhase(this.phaseState, { type: "nightEnded", damageEmpty: night.damageSet.length === 0 });
    if (next === this.phaseState) return this.render();
    if (next.phase === "fixIt") this.enterFixIt(next, night);
    else this.enterLookBack(next, night, false);
  }

  // --- Fix It ---

  /** Call table row "ↁEfixIt". */
  private enterFixIt(next: PhaseState, night: NightResult): void {
    const nightStart = this.nightStart;
    if (nightStart === null) return;
    const history = this.makeHistory(nightStart);
    if (history === null) return;
    const timeline = fixReplayTimeline(nightStart, night, this.data.jobs, this.hiddenJobId);
    this.phaseState = next;
    this.history = history;
    this.actionLog = [];
    this.response = this.responseFor(history.present, []);
    this.responseResult = null;
    this.stepLabel = null;
    this.hiddenLine = false;
    this.connectType = null;
    this.replay = "none";
    this.view.stopTimeline();
    this.view.connectOff();
    this.showPreset("overhead");
    this.view.setEditMode("edit");
    this.view.setHistory(history);
    if (timeline.ok) {
      this.replay = "fix";
      this.activeTimeline = timeline.value;
      this.view.startTimeline(timeline.value);
    } else {
      this.activeTimeline = null;
      this.notice = errorMessages.judgeFailed;
      this.fixReplayEnd();
    }
    this.render();
  }

  /** Call table row "Fix It replay end": `stopTimeline`, then the damage and fog marks. */
  private fixReplayEnd(): void {
    this.view.stopTimeline();
    if (this.history !== null) this.setFixEffects(this.history.present);
  }

  private setFixEffects(present: Scenario): void {
    const night = this.night;
    if (night === null) return;
    const judged = judgeMansion(present, this.data, this.attackRules, this.flags);
    if (!judged.ok) {
      this.notice = errorMessages.judgeFailed;
      return;
    }
    this.view.setEffects(sortUniqueEffects([...night.damageEffects, ...judged.value.fog]));
  }

  /** Edit_Callback `history` report in Fix It (R-APP1-16.5, 16.6, 16.7). */
  private refreshFixIt(history: History): void {
    if (this.nightStart === null) return;
    this.actionLog = deriveActionLog(this.nightStart, history);
    this.response = this.responseFor(history.present, this.actionLog);
    // While the replay runs these marks are drawn only after its end (R-APP1-16.9).
    this.setFixEffects(history.present);
  }

  private responseFor(present: Scenario, log: ResponseOp[]): ResponseView | null {
    if (this.nightStart === null) return null;
    const rules = withCheckSet(this.data.rules, responseCheckSet(this.nightStart));
    if (!rules.ok) {
      this.notice = errorMessages.judgeFailed;
      return null;
    }
    const checks = evaluateCheckSets(present, rules.value);
    if (!checks.ok) {
      this.notice = errorMessages.judgeFailed;
      return null;
    }
    const items = checks.value.find((c) => c.id === "response")?.items ?? [];
    const ids = [RESPONSE_OPS.stopRobot, RESPONSE_OPS.cutKey, RESPONSE_OPS.consult] as const;
    const results = checkOrder(log, this.data.orderRules);
    return {
      operations: ids.map((id) => ({ id, done: items.find((i) => i.id === id)?.holds === true })),
      log: [...log],
      order: this.data.orderRules.map((rule, i) => ({ rule, result: results[i] ?? "notApplicable" })),
    };
  }

  private stopRobot(): void {
    if (this.phaseState.phase !== "fixIt" || this.history === null) return;
    const command = stopRobotCommand(this.history.present);
    if (command !== null) this.view.execute(command);
  }

  private cutKey(): void {
    const sel = this.selection;
    if (this.phaseState.phase !== "fixIt" || this.history === null || sel === null || sel.kind !== "edge") return;
    const command = cutKeyCommand(this.history.present, sel.id);
    if (command !== null) this.view.execute(command);
  }

  private toLookBack(): void {
    const night = this.night;
    const next = nextPhase(this.phaseState, { type: "toLookBack" });
    if (next === this.phaseState || night === null) return;
    this.enterLookBack(next, night, true);
  }

  // --- Look Back ---

  /** Call table row "ↁElookBack". The Response_Result is stored only when coming from Fix It (R-APP1-17.4). */
  private enterLookBack(next: PhaseState, night: NightResult, fromFix: boolean): void {
    const nightStart = this.nightStart;
    if (nightStart === null) return;
    const history = this.makeHistory(nightStart);
    if (history === null) return;
    this.phaseState = next;
    this.responseResult = fromFix ? this.response : null;
    this.history = history;
    this.replay = "none";
    this.activeTimeline = null;
    this.stepLabel = null;
    this.hiddenLine = false;
    this.connectType = null;
    this.view.stopTimeline();
    this.view.connectOff();
    this.showPreset("overhead");
    this.view.setEditMode("view");
    this.view.setHistory(history);
    this.view.setEffects(sortUniqueEffects(lookBackEffects(night)));
    this.render();
  }

  private lookBackReplayEnd(): void {
    this.view.stopTimeline();
    if (this.night !== null) this.view.setEffects(sortUniqueEffects(lookBackEffects(this.night)));
  }

  private replayNight(): void {
    const night = this.night;
    const nightStart = this.nightStart;
    if (this.phaseState.phase !== "lookBack" || this.replay !== "none" || night === null || nightStart === null) return;
    const timeline = nightTimeline(nightStart, night, this.data.jobs, this.hiddenJobId);
    if (!timeline.ok) {
      this.notice = errorMessages.judgeFailed;
      this.render();
      return;
    }
    const history = this.makeHistory(nightStart);
    if (history === null) return;
    this.history = history;
    this.replay = "lookBack";
    this.activeTimeline = timeline.value;
    this.showPreset("overhead");
    this.view.setHistory(history);
    this.view.startTimeline(timeline.value);
    this.render();
  }

  private prepareAgain(): void {
    if (this.phaseState.phase !== "lookBack" || this.nightStart === null) return;
    this.enterPrepare(this.nightStart, { type: "retry" });
  }

  private editable(): boolean {
    return this.phaseState.phase === "prepare" || this.phaseState.phase === "fixIt";
  }
  // --- helpers ---

  private makeHistory(scenario: Scenario): History | null {
    const made = createHistory(scenario, 100);
    if (!made.ok) {
      this.fail(errorMessages.invalidData);
      return null;
    }
    return made.history;
  }

  private fail(text: LocalizedText): void {
    if (text === errorMessages.invalidData) this.broken = true;
    this.notice = text;
    this.render();
  }

  private render(): void {
    const history = this.history;
    const scenario = history?.present ?? this.sampleScenario ?? this.data.preset;
    const phase = this.phaseState.phase;
    const count = this.data.attackCard.preconditions.length;
    const controls = controlsFor({
      phase,
      selection: this.selection,
      scenario,
      connectOn: this.connectType !== null,
      sampleShown: this.sampleShown,
      preconditionCount: count,
      replaying: this.replay !== "none",
      fallbackF1: this.flags.f1,
    });
    let preconditions: { id: string; holds: boolean }[] = [];
    if (phase === "sample") {
      const shown = this.data.attackCard.preconditions.slice(0, this.sampleShown).map((p) => p.id);
      preconditions = (this.sampleNight?.preconditions ?? []).map((p) => ({
        id: p.id,
        holds: shown.includes(p.id) && p.holds,
      }));
    } else if (phase === "lookBack" && this.night !== null) {
      // The Precondition results of the night start state (R-APP1-18.1).
      preconditions = this.night.preconditions;
    } else if (this.judgement !== null) {
      preconditions = this.judgement.preconditions;
    }
    const night = this.night;
    this.ui.render({
      phase,
      controls,
      card: this.data.attackCard,
      preconditions,
      sampleShown: this.sampleShown,
      status:
        phase === "prepare" && this.judgement !== null
          ? { convenience: this.judgement.convenience, reachScore: this.judgement.reachScore }
          : null,
      stepLabel: phase === "ghostNight" ? this.stepLabel : null,
      hiddenFollowed: phase === "ghostNight" && this.hiddenLine,
      score:
        night === null ? null : { convenience: night.convenience, damage: night.damageScore, stars: night.stars },
      incident: phase === "fixIt",
      response: phase === "fixIt" ? this.response : phase === "lookBack" ? this.responseResult : null,
      notice: this.notice,
      presetId: this.presetId,
    });
  }
}
