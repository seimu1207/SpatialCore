import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { phaseActionsArb } from "./arbitraries.ts";
import { initialPhase, nextPhase, type Phase, type PhaseAction, type PhaseState } from "./phase.ts";

const PHASES: readonly Phase[] = ["sample", "prepare", "ghostNight", "fixIt", "lookBack"];

/** The Phase_Machine table (R-APP1-12.1, 12.2, 12.7), written independently of phase.ts. */
function tableNext(from: Phase, a: PhaseAction): Phase | undefined {
  if (from === "sample" && a.type === "toPrepare") return "prepare";
  if (from === "prepare" && a.type === "startNight") return "ghostNight";
  if (from === "ghostNight" && a.type === "nightEnded") return a.damageEmpty ? "lookBack" : "fixIt";
  if (from === "fixIt" && a.type === "toLookBack") return "lookBack";
  if (from === "lookBack" && a.type === "retry") return "prepare";
  return undefined;
}

describe("Phase flow", () => {
  it("walks the happy path with damage", () => {
    let s = initialPhase;
    s = nextPhase(s, { type: "toPrepare" });
    s = nextPhase(s, { type: "startNight" });
    s = nextPhase(s, { type: "nightEnded", damageEmpty: false });
    expect(s.phase).toBe("fixIt");
  });

  /**
   * Property 8: P-APP1-8 phase flow.
   * **Validates: Requirements 12.1, 12.2, 12.7**
   */
  it("P-APP1-8: every state is a Phase, every change is a table row, fixIt only after damage", () => {
    fc.assert(
      fc.property(phaseActionsArb, (actions) => {
        let state: PhaseState = initialPhase;
        for (const action of actions) {
          const next = nextPhase(state, action);
          expect(PHASES).toContain(next.phase);
          const expected = tableNext(state.phase, action);
          if (expected === undefined) {
            expect(next).toBe(state);
          } else {
            expect(next.phase).toBe(expected);
          }
          if (next.phase === "fixIt" && state.phase !== "fixIt") {
            expect(state.phase).toBe("ghostNight");
            expect(action).toEqual({ type: "nightEnded", damageEmpty: false });
          }
          state = next;
        }
      }),
    );
  });
});
