import { describe, expect, it } from "vitest";
import {
  HINT_EDITING_LOCKED,
  HINT_NEEDS_FOOTPRINTS,
  HINT_NEEDS_TWO_ZONES,
} from "./model/controls.ts";
import * as text from "./text.ts";

type Text = { en: string; ja?: string };

function isText(v: unknown): v is Text {
  return typeof v === "object" && v !== null && "en" in v && "ja" in v;
}

const zone: Text = { en: "Rest corner", ja: "休憩コーナー" };

function allTexts(): Text[] {
  const out: Text[] = [];
  for (const v of Object.values(text)) if (isText(v)) out.push(v);
  out.push(
    text.pointBrightness(zone, 0.5),
    text.pointWarmth(zone, 0.22),
    text.reasonSuddenBrightening(0.4, 0.3),
    text.reasonSameMood(zone, zone, 3, 0.05, 3),
    text.msgFileType("a.gif"),
    text.msgFileTooLarge("a.png"),
    text.msgFileUnreadable("a.png"),
    text.msgFileNoPixels("a.png"),
  );
  return out;
}

describe("moodwalk text", () => {
  it("every text has a non-empty en and ja (1.5)", () => {
    const all = allTexts();
    expect(all.length).toBeGreaterThan(50);
    for (const x of all) {
      expect(x.en.trim()).not.toBe("");
      expect((x.ja ?? "").trim()).not.toBe("");
    }
  });

  it("keeps the title and back link exports", () => {
    expect(text.title.en).toBe("Moodwalk");
    expect(text.backLink.en).toBe("Back to the top page");
  });

  it("contains no competitor claim or OWASP item (S-APP2-7, S-APP2-8)", () => {
    for (const x of allTexts()) {
      for (const s of [x.en, x.ja ?? ""]) expect(s).not.toMatch(/OWASP|competitor|競合|\bAI\b|\bLLM\b/i);
    }
  });

  it("formats pointer text with 2 decimals and an always-shown sign", () => {
    expect(text.pointWarmth(zone, 0.22).en).toBe("Rest corner: warmth +0.22");
    expect(text.pointWarmth({ en: "Basement stairs", ja: "階段" }, -0.18).en).toBe(
      "Basement stairs: warmth \u22120.18",
    );
    expect(text.pointWarmth(zone, 0).en).toBe("Rest corner: warmth +0.00");
    expect(text.pointBrightness(zone, 0.5).en).toBe("Rest corner: brightness 0.50");
  });

  it("fills the flag reason placeholders", () => {
    expect(text.reasonSuddenBrightening(0.4, 0.3).en).toBe("Brightness rises by 0.40 here, more than 0.30.");
    expect(text.reasonSameMood(zone, { en: "Exit", ja: "出口" }, 3, 0.05, 3).en).toBe(
      "Rest corner to Exit: 3 zones in a row change by at most 0.05 (limit 3).",
    );
  });

  it("status hints match the controls hints", () => {
    expect(text.hintEditingLocked).toStrictEqual(HINT_EDITING_LOCKED);
    expect(text.hintNeedsTwoZones).toStrictEqual(HINT_NEEDS_TWO_ZONES);
    expect(text.hintNeedsFootprints).toStrictEqual(HINT_NEEDS_FOOTPRINTS);
  });
});
