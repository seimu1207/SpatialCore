// The project has no DOM test environment (no jsdom or happy-dom, and no new dependency is allowed), so
// only the pure part of `render` that decides the alert line is tested here.

import { describe, expect, it } from "vitest";
import { errorMessages } from "./text.ts";
import { noticeLine } from "./ui.ts";

describe("noticeLine", () => {
  it("is null without a notice", () => {
    expect(noticeLine({ notice: null })).toBeNull();
  });

  it("gives the English text of the notice", () => {
    expect(noticeLine({ notice: errorMessages.judgeFailed })).toBe(errorMessages.judgeFailed.en);
  });
});
