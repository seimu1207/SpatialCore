import type { LocalizedText } from "../../core/model/scenario-schema.ts";

const t = (en: string, ja: string): LocalizedText => ({ en, ja });

export const title: LocalizedText = t("Moodwalk", "Moodwalk");
export const backLink: LocalizedText = t("Back to the top page", "トップページへ戻る");

// Walk controls
export const startWalkthrough = t("Start walkthrough", "ウォークスルーを始める");
export const pause = t("Pause", "一時停止");
export const resume = t("Resume", "再開");
export const stop = t("Stop", "停止");

// Viewpoints
export const overview = t("Overview", "全体図");
export const visitorView = t("Visitor view", "来場者の視点");

// Images
export const addImages = t("Add images…", "画像を追加…");
export const dropHint = t("or drop image files on the page", "または画像ファイルをページにドロップ");
export const addImagesTo = t("Add images to:", "画像の追加先:");
export const removeImage = t("Remove image", "画像を削除");

// Gizmo
export const rotate = t("Rotate", "回転");
export const scale = t("Scale", "拡大縮小");

// Status hints (same wording as model/controls.ts)
export const hintEditingLocked = t(
  "The board cannot be edited during a walkthrough.",
  "ウォークスルー中はボードを編集できません。",
);
export const hintNeedsTwoZones = t(
  "The walkthrough needs at least 2 zones.",
  "ウォークスルーには2つ以上のゾーンが必要です。",
);
export const hintNeedsFootprints = t(
  "The walkthrough needs a floor area for every zone.",
  "ウォークスルーにはすべてのゾーンの床面が必要です。",
);

// Zones
export const addZone = t("Add zone", "ゾーンを追加");
export const removeZone = t("Remove zone", "ゾーンを削除");
export const entrance = t("Entrance", "入口");
export const exit = t("Exit", "出口");

// History
export const undo = t("Undo", "元に戻す");
export const redo = t("Redo", "やり直す");

// Settings
export const settingShiftThreshold = t(
  "Sudden change (brightness rise above)",
  "急な変化（明るさの上昇がこの値より大きい）",
);
export const settingRunTolerance = t("Same mood (change at most)", "同じ雰囲気（変化がこの値以下）");
export const settingMinRunLength = t("Same mood (zones in a row)", "同じ雰囲気（連続するゾーン数）");
export const settingNumberMessage = t("Enter a number of 0 or more.", "0以上の数を入力してください。");
export const settingWholeNumberMessage = t(
  "Enter a whole number of 2 or more.",
  "2以上の整数を入力してください。",
);

// Charts
export const chartBrightness = t("Brightness", "明るさ");
export const chartTemperature = t("Color temperature (cool – warm)", "色温度（寒色 – 暖色）");
export const chartNoImages = t("no images", "画像なし");

// Flags
export const flagSuddenBrightening = t("Sudden brightening", "急に明るくなる");
export const flagSameMoodTooLong = t("Same mood too long", "同じ雰囲気が長すぎる");
export const markIntended = t("Mark as intended", "意図したものとして印を付ける");
export const removeMark = t("Remove mark", "印を外す");

// Messages
export const msgBoardInvalid = t("The board data is invalid.", "ボードのデータが正しくありません。");
export const msgLinksNotLoaded = t(
  "Images load only from files. Links are not loaded.",
  "画像はファイルからのみ読み込みます。リンクは読み込みません。",
);
export const msgMaxImages = t("A board can hold at most 50 images.", "ボードに置ける画像は50枚までです。");
export const msgZoneHasImages = t(
  "A zone with images cannot be removed.",
  "画像のあるゾーンは削除できません。",
);
export const msgMinZones = t("A board needs at least 2 zones.", "ボードには2つ以上のゾーンが必要です。");
export const msgImageInZone = t("An image must stay inside a zone.", "画像はゾーンの中に置く必要があります。");
export const msgWalkFailed = t("The walkthrough could not start:", "ウォークスルーを始められませんでした:");
export const msgMoodFailed = t("The mood could not be computed:", "雰囲気を計算できませんでした:");
export const msgChangeFailed = t("That change could not be made.", "その変更はできませんでした。");
export const msgActionFailed = t("That action failed.", "操作に失敗しました。");
export const msgNoFlags = t(
  "No sudden change or long same mood found.",
  "急な変化も、長く続く同じ雰囲気も見つかりませんでした。",
);
export const msgNoWebGl = t(
  "3D display is not available, so the board cannot be shown.",
  "3D表示を使えないため、ボードを表示できません。",
);

// Builders. Placeholders are filled with plain strings; numbers use 2 decimals.
export function fixed2(value: number): string {
  const v = Object.is(value, -0) ? 0 : value;
  return v.toFixed(2);
}

export function signed2(value: number): string {
  const s = fixed2(value);
  if (s === "-0.00") return "+0.00";
  return s.startsWith("-") ? `\u2212${s.slice(1)}` : `+${s}`;
}

export function pointBrightness(zone: LocalizedText, value: number): LocalizedText {
  return t(`${zone.en}: brightness ${fixed2(value)}`, `${zone.ja}: 明るさ ${fixed2(value)}`);
}

export function pointWarmth(zone: LocalizedText, value: number): LocalizedText {
  return t(`${zone.en}: warmth ${signed2(value)}`, `${zone.ja}: 暖かさ ${signed2(value)}`);
}

export function reasonSuddenBrightening(change: number, threshold: number): LocalizedText {
  return t(
    `Brightness rises by ${fixed2(change)} here, more than ${fixed2(threshold)}.`,
    `ここで明るさが${fixed2(change)}上がり、${fixed2(threshold)}を超えています。`,
  );
}

export function reasonSameMood(
  first: LocalizedText,
  last: LocalizedText,
  count: number,
  tolerance: number,
  minRunLength: number,
): LocalizedText {
  return t(
    `${first.en} to ${last.en}: ${count} zones in a row change by at most ${fixed2(tolerance)} (limit ${minRunLength}).`,
    `${first.ja}から${last.ja}: ${count}個のゾーンが続けて${fixed2(tolerance)}以下の変化です（上限 ${minRunLength}）。`,
  );
}

export function msgFileType(file: string): LocalizedText {
  return t(
    `${file}: only PNG, JPEG, and WebP images can be added.`,
    `${file}: 追加できる画像はPNG、JPEG、WebPのみです。`,
  );
}
export function msgFileTooLarge(file: string): LocalizedText {
  return t(`${file}: the file is larger than 10 MB.`, `${file}: ファイルが10 MBを超えています。`);
}
export function msgFileUnreadable(file: string): LocalizedText {
  return t(`${file}: the image could not be read.`, `${file}: 画像を読み込めませんでした。`);
}
export function msgFileNoPixels(file: string): LocalizedText {
  return t(`${file}: the image has no visible pixels.`, `${file}: 画像に見える画素がありません。`);
}

// Page sections, helper text, and the curve legend (layout polish)
export const secWalkthrough = t("Walkthrough", "ウォークスルー");
export const secView = t("View", "視点");
export const secImages = t("Images", "画像");
export const secZones = t("Zones", "ゾーン");
export const secEdit = t("Edit tools", "編集ツール");
export const secSettings = t("Settings", "設定");
export const secMarks = t("Marks", "印");
export const secCurve = t("Mood curve", "雰囲気カーブ");
export const noticeLabel = t("Messages", "メッセージ");
export const helpShiftThreshold = t(
  "A zone is flagged when its brightness rises by more than this from the previous zone.",
  "前のゾーンより明るさがこの値を超えて上がると、印が付きます。",
);
export const helpRunTolerance = t(
  "Zones whose brightness differs by at most this count as the same mood.",
  "明るさの差がこの値以下のゾーンは、同じ雰囲気として数えます。",
);
export const helpMinRunLength = t(
  "A run of this many same-mood zones in a row is flagged.",
  "同じ雰囲気がこの数だけ続くと、印が付きます。",
);
export const marksEmpty = t("Nothing to mark right now.", "いま印を付けるものはありません。");
export const legendTitle = t("Flag colors", "印の色");
export const legendSudden = t("Orange: sudden brightening", "オレンジ: 急に明るくなる");
export const legendSame = t("Purple: same mood too long", "紫: 同じ雰囲気が長すぎる");
