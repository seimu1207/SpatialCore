import type { LocalizedText } from "../../core/model/scenario-schema.ts";
import type { ControlId } from "./model/controls.ts";
import type { Phase } from "./model/phase.ts";

export const title: LocalizedText = { en: "Ghost Mansion", ja: "スマホ屋敷のおばけ退治" };
export const body: LocalizedText = { en: "This app is coming soon.", ja: "準備中です。" };
export const backLink: LocalizedText = { en: "Back to the top page", ja: "トップページへ戻る" };

// UI texts (design.md "UI texts", R-APP1-22). No technical term and no OWASP item (R-APP1-18.5).

export const phaseNames: Record<Phase, LocalizedText> = {
  sample: { en: "Sample", ja: "みほん" },
  prepare: { en: "Prepare", ja: "ととのえる" },
  ghostNight: { en: "Ghost Night", ja: "おばけの夜" },
  fixIt: { en: "Fix It", ja: "たいじする" },
  lookBack: { en: "Look Back", ja: "ふりかえり" },
};

export const phaseInstructions: Record<Phase, LocalizedText> = {
  sample: {
    en: "Play the ghost: press Next to see what the attack needs.",
    ja: "おばけになって「次へ」で攻撃の条件を見よう。",
  },
  prepare: {
    en: "Change the robot's keys and check what the ghost can see.",
    ja: "ロボの鍵を変えて、おばけから見える所を確かめよう。",
  },
  ghostNight: { en: "Watch the robot do its jobs.", ja: "ロボの仕事を見守ろう。" },
  fixIt: {
    en: "Stop the robot, cut a key line, and talk to someone.",
    ja: "ロボを止めて、鍵の線を切って、相談しよう。",
  },
  lookBack: { en: "See your score, then prepare again.", ja: "評価を見て、ととのえ直そう。" },
};

export const incident: LocalizedText = {
  en: "The robot sent a strange message to the class group!",
  ja: "ロボがクラスのグループに変なメッセージを送った！",
};

export const hiddenFollowed: LocalizedText = {
  en: "The robot followed a hidden command placed by the game.",
  ja: "ロボはゲームが隠した命令に従ってしまった。",
};

export const fogNote: LocalizedText = {
  en: "Plausible Ghost: an answer with no source is covered by fog.",
  ja: "まことしやかおばけ：出典のない答えには霧がかかる。",
};

export const controlLabels: Record<ControlId, LocalizedText> = {
  next: { en: "Next", ja: "次へ" },
  toPrepare: { en: "Go to Prepare", ja: "ととのえるへ" },
  startNight: { en: "Start Ghost Night", ja: "おばけの夜を始める" },
  toLookBack: { en: "Go to Look Back", ja: "ふりかえりへ" },
  prepareAgain: { en: "Prepare again", ja: "ととのえ直す" },
  replay: { en: "Replay", ja: "もう一度見る" },
  startOver: { en: "Start over", ja: "最初からやり直す" },
  preset: { en: "Use the preset mansion", ja: "はじめの屋敷にする" },
  keyPlain: { en: "Plain key", ja: "そのままの鍵" },
  keyBell: { en: "Bell key", ja: "ベル付きの鍵" },
  keyNone: { en: "No line", ja: "線なし" },
  dontRead: { en: "Don't let the robot read this", ja: "ロボに読ませない" },
  connectSource: { en: "Connect answer to source", ja: "答えを出典につなぐ" },
  stopRobot: { en: "Stop the robot", ja: "ロボを止める" },
  cutKey: { en: "Cut the key line", ja: "鍵の線を切る" },
  consult: { en: "Consult a person", ja: "相談する" },
  cancel: { en: "Cancel", ja: "やめる" },
  undo: { en: "Undo", ja: "元に戻す" },
  redo: { en: "Redo", ja: "やり直す" },
  back: { en: "Back to the top page", ja: "トップページへ戻る" },
};

export const scoreLabels = {
  convenience: { en: "Convenience", ja: "便利さ" } as LocalizedText,
  damage: { en: "Damage", ja: "被害" } as LocalizedText,
  damageIfTricked: { en: "Damage if the robot is tricked", ja: "ロボがだまされたときの被害" } as LocalizedText,
  stars: { en: "Stars", ja: "星" } as LocalizedText,
};

export const reachNote: LocalizedText = {
  en: "This is what the keys would let a tricked robot reach. Not reading a strange page can stop the trick itself.",
  ja: "これは、だまされたロボが鍵でとどく被害です。あやしいページを読ませなければ、だまされること自体を防げます。",
};

export const canBreak: LocalizedText = {
  en: "You could break this condition.",
  ja: "この条件はくずせた。",
};

export const statusWords = {
  done: { en: "Done", ja: "できた" } as LocalizedText,
  notDone: { en: "Not done", ja: "まだ" } as LocalizedText,
  met: { en: "Met", ja: "満たした" } as LocalizedText,
  notMet: { en: "Not met", ja: "満たしていない" } as LocalizedText,
  notApplicable: { en: "Not applicable", ja: "対象外" } as LocalizedText,
};

export const errorMessages = {
  invalidData: { en: "The game data is invalid.", ja: "ゲームのデータが正しくありません。" } as LocalizedText,
  judgeFailed: { en: "The game could not judge the mansion.", ja: "屋敷を判定できませんでした。" } as LocalizedText,
  changeFailed: { en: "That change could not be made.", ja: "その変更はできませんでした。" } as LocalizedText,
  noWebgl: {
    en: "3D display is not available, so the game cannot start.",
    ja: "3D表示が使えないため、ゲームを始められません。",
  } as LocalizedText,
};
