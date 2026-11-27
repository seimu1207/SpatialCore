/**
 * BoardController (design.md "Controller"): the state of the Moodwalk board, the calls to the Core_View, and
 * the state the UI draws. Task 9.2 covers the state, `start`, `recompute`, the `act` and `onEdit` wrappers,
 * the zone operations, and the Restart. Task 9.3 adds the Gesture path, undo and redo, remove image, the gizmo
 * modes, settings, marks, and viewpoints. Task 9.4 adds the image adding and the walkthrough.
 *
 * It imports only types from core/view/start-view.tsx, so the controller runs under Vitest in Node.
 */
import type { History } from "../../core/model/history.ts";
import type { Timeline } from "../../core/model/rule-schema.ts";
import type { LocalizedText, ValidationError } from "../../core/model/scenario-schema.ts";
import type { CoreViewHandle, EditReport, Selection, TimelineReport, WalkState } from "../../core/view/start-view.tsx";
import type { ViewSettings } from "../../core/view/helpers/settings-schema.ts";
import type { BoardData } from "./model/board-data.ts";
import { parseSettingField, type BoardSettings, type SettingField } from "./model/board-settings.ts";
import {
  addImageCommand,
  addZoneCommand,
  checkImageFile,
  classifyMove,
  removeImageCommand,
  removeZoneCheck,
} from "./model/commands.ts";
import { controlsFor, statusFor, type ControlId } from "./model/controls.ts";
import { FALLBACK, type Fallback } from "./model/fallback.ts";
import { referencesIn, type ImageStore } from "./model/image-store.ts";
import { buildViewSettings, routeFootprints, walkDuration, type PresetId } from "./model/layout.ts";
import { analyzeMood } from "./model/mood.ts";
import { PRESET_OVERVIEW } from "./model/names.ts";
import type { ReadResult } from "./model/pixels.ts";
import { checkMood, type MoodFlag, type MoodCurve, type MoodReport } from "./model/shift-check.ts";
import { canWalk, linkedTimeline } from "./model/walk.ts";
import * as text from "./text.ts";

/** The part of the Core_View handle the controller uses, plus `restart` (main.ts: stop, then startCoreView). */
export type ViewPort = Pick<
  CoreViewHandle,
  | "setHistory"
  | "setPreset"
  | "setEffects"
  | "setEditMode"
  | "setGizmoMode"
  | "undo"
  | "redo"
  | "execute"
  | "startWalk"
  | "pauseWalk"
  | "resumeWalk"
  | "stopWalk"
  | "stopTimeline"
> & {
  restart(history: History, settings: ViewSettings): void;
};

/** Image reading. `ReadResult` is the one type of `model/pixels.ts`, also returned by `browser/images.ts`. */
export type ImagePort = { read(file: Blob): Promise<ReadResult>; release(url: string): void };
export type FileLike = Blob & { name: string };

export type BoardViewState = {
  zones: { id: string; label: LocalizedText; role: "entrance" | "exit" | null }[];
  targetZone: string;
  selection: string | null;
  curve: MoodCurve | null;
  flags: MoodFlag[];
  marks: string[];
  settings: BoardSettings;
  walk: WalkState;
  marker: string | null;
  busy: boolean;
  presetId: PresetId;
  gizmoMode: "rotate" | "scale";
  status: LocalizedText | null;
  controls: Record<ControlId, boolean>;
  notice: LocalizedText | null;
  fieldNotice: SettingField | null;
};

export type UiSink = { render(state: BoardViewState): void };

type Pending = "undo" | "redo" | "execute" | null;

/** Zone ids with their `order`, in ascending order: the Restart happens when this changes. */
function zonesKey(history: History): string {
  return [...history.present.zones]
    .sort((a, b) => a.order - b.order)
    .map((z) => `${z.id}:${z.order}`)
    .join("|");
}

export class BoardController {
  private readonly data: BoardData;
  private readonly store: ImageStore;
  private readonly view: ViewPort;
  private readonly images: ImagePort;
  private readonly ui: UiSink;
  private readonly flags: Fallback;

  private history: History;
  private settings: BoardSettings;
  private marks: string[] = [];
  private activePreset: PresetId = PRESET_OVERVIEW;
  private gizmoMode: "rotate" | "scale" = "rotate";
  private walk: WalkState = "idle";
  private marker: string | null = null;
  private selection: string | null = null;
  private targetZone: string;
  private busy = false;
  private pending: Pending = null;
  private report: MoodReport | null = null;
  private notice: LocalizedText | null = null;
  private fieldNotice: SettingField | null = null;
  private restartPending = false;
  private uploadCounter = 0;
  private timeline: Timeline | null = null;

  constructor(
    data: BoardData,
    history: History,
    store: ImageStore,
    view: ViewPort,
    images: ImagePort,
    ui: UiSink,
    flags: Fallback = FALLBACK,
  ) {
    this.data = data;
    this.history = history;
    this.settings = data.settings;
    this.store = store;
    this.view = view;
    this.images = images;
    this.ui = ui;
    this.flags = flags;
    this.targetZone = this.entranceId();
  }

  start(): void {
    this.guard(() => {
      this.recompute();
      this.render();
    });
  }

  onEdit(report: EditReport): void {
    this.guard(() => {
      if (report.kind === "history") {
        this.applyHistory(report.history);
      } else {
        this.onEditErrors(report.context, report.errors);
        this.render();
      }
    });
  }

  /** Edit_Callback `errors` report (design.md "Callbacks"); each message replaces the previous one. */
  private onEditErrors(context: string, errors: readonly ValidationError[]): void {
    switch (context) {
      case "edit":
        this.setNotice(text.msgChangeFailed);
        break;
      case "walk": {
        const detail = errors.map((e) => `${e.path}: ${e.message}`).join("; ");
        this.setNotice({
          en: `${text.msgWalkFailed.en} ${detail}`,
          ja: `${text.msgWalkFailed.ja} ${detail}`,
        });
        // The walk did not start: the Board stays as it was and editing comes back.
        this.walk = "idle";
        this.marker = null;
        this.timeline = null;
        this.view.setEditMode("edit");
        break;
      }
      case "start":
      case "theme":
        this.setNotice(text.msgBoardInvalid);
        break;
      case "settings":
        // A pending restart brings View_Settings that cover every Zone, so the old Core_View error is ignored.
        if (!this.restartPending) this.setNotice(text.msgBoardInvalid);
        break;
      default:
        this.setNotice(text.msgActionFailed);
        break;
    }
  }

  /** Walk_Callback: the end of a walk stops the linked Timeline and returns to edit; the marker stays (M12). */
  onWalk(state: WalkState, progress: number): void {
    void progress;
    this.guard(() => {
      this.walk = state;
      if (state === "finished") {
        this.view.stopTimeline();
        this.view.setEditMode("edit");
      }
      this.render();
    });
  }

  /** Timeline_Callback: the marker follows the step target; the end report keeps the last marker. */
  onTimeline(report: TimelineReport): void {
    this.guard(() => {
      if (report.kind === "position") {
        const target = this.timeline?.steps[report.position]?.targets[0];
        if (target !== undefined) this.marker = target.id;
      }
      this.render();
    });
  }

  onSelect(selection: Selection): void {
    this.selection = selection !== null && selection.kind === "node" ? selection.id : null;
    this.render();
  }

  act(control: ControlId, arg?: string): void {
    this.guard(() => {
      if (!this.controls()[control]) return;
      switch (control) {
        case "addZone":
          this.runPending("execute", () => {
            this.view.execute(addZoneCommand(this.history.present));
          });
          break;
        case "removeZone": {
          const check = removeZoneCheck(this.history.present, arg ?? this.targetZone);
          if (check.ok) {
            this.runPending("execute", () => {
              this.view.execute(check.command);
            });
          } else {
            this.setNotice(
              check.reason === "has-images"
                ? text.msgZoneHasImages
                : check.reason === "too-few-zones"
                  ? text.msgMinZones
                  : text.msgActionFailed,
            );
            this.render();
          }
          break;
        }
        case "undo":
          this.runPending("undo", () => {
            this.view.undo();
          });
          break;
        case "redo":
          this.runPending("redo", () => {
            this.view.redo();
          });
          break;
        case "removeImage": {
          const command = this.selection === null ? null : removeImageCommand(this.history.present, this.selection);
          if (command !== null) {
            this.runPending("execute", () => {
              this.view.execute(command);
            });
          }
          break;
        }
        case "rotateMode":
        case "scaleMode":
          this.gizmoMode = control === "rotateMode" ? "rotate" : "scale";
          this.view.setGizmoMode(this.gizmoMode);
          this.render();
          break;
        case "overview":
        case "visitor":
          if (this.walk === "finished") {
            this.view.stopWalk();
            this.walk = "idle";
          }
          this.activePreset = control;
          this.view.setPreset(control);
          this.marker = null;
          this.render();
          break;
        case "mark":
          if (arg !== undefined && this.history.present.zones.some((z) => z.id === arg) && !this.marks.includes(arg)) {
            this.marks = [...this.marks, arg];
            this.recompute();
          }
          this.render();
          break;
        case "start": {
          const present = this.history.present;
          if (!canWalk(present, routeFootprints(present.zones))) break;
          const timeline = linkedTimeline(present, this.report?.effects ?? []);
          if (!timeline.ok) {
            const detail = timeline.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
            this.setNotice({
              en: `${text.msgWalkFailed.en} ${detail}`,
              ja: `${text.msgWalkFailed.ja} ${detail}`,
            });
            this.render();
            break;
          }
          if (this.walk === "finished") this.view.stopWalk();
          this.timeline = timeline.value;
          this.marker = null;
          this.view.setEditMode("view");
          this.view.startWalk("route", walkDuration(present.zones.length), timeline.value);
          this.render();
          break;
        }
        case "pause":
          this.view.pauseWalk();
          break;
        case "resume":
          this.view.resumeWalk();
          break;
        case "stop":
          this.view.stopWalk();
          this.view.setEditMode("edit");
          this.walk = "idle";
          this.marker = null;
          this.timeline = null;
          this.render();
          break;
        default:
          // `addImages` is `addFiles`; the settings and mark fields have their own methods.
          break;
      }
    });
  }

  /** Choose the Zone that "Add images to" targets. */
  chooseTarget(zoneId: string): void {
    this.guard(() => {
      if (this.history.present.zones.some((z) => z.id === zoneId)) this.targetZone = zoneId;
      this.render();
    });
  }

  /** A setting field's raw text; a rejected text keeps the settings and marks the field (R-APP2-08.5). */
  setSetting(field: SettingField, value: string): void {
    this.guard(() => {
      if (!this.controls().settings) return;
      const parsed = parseSettingField(field, value);
      if (parsed.ok) {
        this.settings = { ...this.settings, [field]: parsed.value };
        this.fieldNotice = null;
        this.recompute();
      } else {
        this.fieldNotice = field;
      }
      this.render();
    });
  }

  /** Remove the Intentional_Shift_Mark of a Zone. */
  unmark(zoneId: string): void {
    this.guard(() => {
      if (!this.controls().mark) return;
      if (this.marks.includes(zoneId)) {
        this.marks = this.marks.filter((id) => id !== zoneId);
        this.recompute();
      }
      this.render();
    });
  }

  /** Adding images (design.md "Adding images"): one file after the other, in the browser order. */
  async addFiles(files: readonly FileLike[]): Promise<void> {
    if (!this.controls().addImages) return;
    const savedHistory = this.history;
    const savedSettings = this.settings;
    const savedMarks = this.marks;
    this.busy = true;
    try {
      this.view.setEditMode("view");
      this.render();
      for (const file of files) {
        await this.addOneFile(file);
      }
    } catch {
      this.restoreAfterFailure(savedHistory, savedSettings, savedMarks);
    } finally {
      this.busy = false;
      try {
        this.view.setEditMode("edit");
        this.render();
      } catch {
        // The Core_View or the UI failed; the state is already consistent.
      }
    }
  }

  private async addOneFile(file: FileLike): Promise<void> {
    const check = checkImageFile(
      { name: file.name, type: file.type, size: file.size },
      this.history.present.nodes.length,
    );
    if (!check.ok) {
      this.setNotice(
        check.reason === "format"
          ? text.msgFileType(file.name)
          : check.reason === "size"
            ? text.msgFileTooLarge(file.name)
            : text.msgMaxImages,
      );
      this.render();
      return;
    }
    const read = await this.images.read(file);
    if (!read.ok) {
      this.setNotice(text.msgFileUnreadable(file.name));
      this.render();
      return;
    }
    const mood = analyzeMood(read.pixels);
    if (!mood.ok) {
      this.images.release(read.displayUrl);
      this.setNotice(text.msgFileNoPixels(file.name));
      this.render();
      return;
    }
    const reference = `upload:${this.uploadCounter++}`;
    // The command is built from the present of this moment, after the await (M17).
    const present = this.history.present;
    const command = addImageCommand(
      present,
      { reference, zone: this.targetZone, mood: mood.value },
      routeFootprints(present.zones),
      this.flags,
    );
    if (command === null) {
      this.images.release(read.displayUrl);
      this.setNotice(text.msgActionFailed);
      this.render();
      return;
    }
    this.store.put(reference, read.displayUrl);
    try {
      this.runPending("execute", () => {
        this.view.execute(command);
      });
    } catch (error) {
      // A failing execute leaves no unreferenced entry behind (design.md "Adding images").
      this.store.remove(reference);
      throw error;
    }
    if (!referencesIn(this.history).has(reference)) this.store.remove(reference);
    this.render();
  }

  /** The start-up could not do a part of its work (for example the sample images); the Board still runs. */
  reportFailure(): void {
    this.guard(() => {
      this.setNotice(text.msgActionFailed);
      this.render();
    });
  }

  /** A dropped link or text shows a message and adds no image (R-APP2-04.10). */
  dropText(): void {
    this.guard(() => {
      this.setNotice(text.msgLinksNotLoaded);
      this.render();
    });
  }

  // ---- state -----------------------------------------------------------------------------------------

  private sortedZones(): History["present"]["zones"] {
    return [...this.history.present.zones].sort((a, b) => a.order - b.order);
  }

  private entranceId(): string {
    return this.sortedZones()[0]?.id ?? "";
  }

  private controls(): Record<ControlId, boolean> {
    return controlsFor(this.controlsInput());
  }

  private controlsInput(): Parameters<typeof controlsFor>[0] {
    const present = this.history.present;
    return {
      walk: this.walk,
      busy: this.busy,
      past: this.history.past.length,
      future: this.history.future.length,
      hasSelection: this.selection !== null,
      canWalk: canWalk(present, routeFootprints(present.zones)),
      zoneCount: present.zones.length,
    };
  }

  private setNotice(message: LocalizedText): void {
    this.notice = message;
  }

  /** Mood_Report from the current Board; the Mood_Effects go to the Core_View (R-APP2-09.5, 09.12). */
  private recompute(): void {
    const result = checkMood(this.history.present, this.settings, this.marks, this.data.rules, this.flags);
    if (result.ok) {
      this.report = result.value;
      this.view.setEffects(result.value.effects);
    } else {
      this.report = null;
      this.view.setEffects([]);
      this.setNotice(text.msgMoodFailed);
    }
  }

  /** Take over the History the Core_View committed, then follow the table of design.md "Controller". */
  private applyHistory(next: History): void {
    const previous = this.history;
    this.history = next;
    if (this.pending === null) {
      // A Gesture (R-APP2-05.3, 05.4): a move into another Zone gets a follow-up command, a move outside is undone.
      const move = classifyMove(previous.present, next.present, routeFootprints(next.present.zones));
      if (move.kind === "zone") {
        this.runPending("execute", () => {
          this.view.execute(move.command);
        });
        this.render();
        return;
      }
      if (move.kind === "outside") {
        this.view.setHistory(previous);
        this.history = previous;
        this.store.prune(previous);
        this.recompute();
        this.setNotice(text.msgImageInZone);
        this.render();
        return;
      }
    }
    this.store.prune(next);
    const zoneIds = new Set(next.present.zones.map((z) => z.id));
    this.marks = this.marks.filter((id) => zoneIds.has(id));
    if (!zoneIds.has(this.targetZone)) this.targetZone = this.entranceId();
    this.recompute();
    if (zonesKey(previous) !== zonesKey(next)) this.scheduleRestart();
    this.render();
  }

  /** The Core_View is never stopped while one of its own functions runs, so the Restart waits (R-APP2-03.9). */
  private scheduleRestart(): void {
    if (this.restartPending) return;
    this.restartPending = true;
    queueMicrotask(() => {
      this.restartPending = false;
      try {
        this.view.restart(this.history, buildViewSettings(this.history.present.zones, this.activePreset));
        this.view.setEffects(this.report?.effects ?? []);
        this.view.setGizmoMode(this.gizmoMode);
        this.walk = "idle";
        this.marker = null;
      } catch {
        this.setNotice(text.msgActionFailed);
      }
      this.render();
    });
  }

  private runPending(kind: "undo" | "redo" | "execute", call: () => void): void {
    const saved = this.pending;
    this.pending = kind;
    try {
      call();
    } finally {
      this.pending = saved;
    }
  }

  /** Every body runs inside `try`; on an exception the History, settings, and marks are put back (R-APP2-15.1). */
  private guard(body: () => void): void {
    const savedHistory = this.history;
    const savedSettings = this.settings;
    const savedMarks = this.marks;
    try {
      body();
    } catch {
      this.restoreAfterFailure(savedHistory, savedSettings, savedMarks);
    }
  }

  private restoreAfterFailure(savedHistory: History, savedSettings: BoardSettings, savedMarks: string[]): void {
    const historyChanged = this.history !== savedHistory;
    this.history = savedHistory;
    this.settings = savedSettings;
    this.marks = savedMarks;
    try {
      if (historyChanged) this.view.setHistory(savedHistory);
      this.recompute();
    } catch {
      // The Core_View failed again; the state is already restored.
    }
    this.setNotice(text.msgActionFailed);
    try {
      this.render();
    } catch {
      // The UI failed; nothing more can be done here.
    }
  }

  private render(): void {
    const zones = this.sortedZones();
    const last = zones.length - 1;
    this.ui.render({
      zones: zones.map((z, i) => ({
        id: z.id,
        label: z.label,
        role: i === 0 ? "entrance" : i === last ? "exit" : null,
      })),
      targetZone: this.targetZone,
      selection: this.selection,
      curve: this.report?.curve ?? null,
      flags: this.report?.flags ?? [],
      marks: [...this.marks],
      settings: this.settings,
      walk: this.walk,
      marker: this.marker,
      busy: this.busy,
      presetId: this.activePreset,
      gizmoMode: this.gizmoMode,
      status: statusFor(this.controlsInput()),
      controls: this.controls(),
      notice: this.notice,
      fieldNotice: this.fieldNotice,
    });
  }
}
