// Phase_Machine of Ghost Mansion (R-APP1-12.1, 12.2, 12.7). Pure, no imports.

export type Phase = "sample" | "prepare" | "ghostNight" | "fixIt" | "lookBack";

export type PhaseState = { phase: Phase };

export type PhaseAction =
  | { type: "toPrepare" }
  | { type: "startNight" }
  | { type: "nightEnded"; damageEmpty: boolean }
  | { type: "toLookBack" }
  | { type: "retry" };

export const initialPhase: PhaseState = { phase: "sample" };

/** Returns the next state. A pair that is not a table row returns `state` itself. */
export function nextPhase(state: PhaseState, action: PhaseAction): PhaseState {
  switch (state.phase) {
    case "sample":
      return action.type === "toPrepare" ? { phase: "prepare" } : state;
    case "prepare":
      return action.type === "startNight" ? { phase: "ghostNight" } : state;
    case "ghostNight":
      return action.type === "nightEnded"
        ? { phase: action.damageEmpty ? "lookBack" : "fixIt" }
        : state;
    case "fixIt":
      return action.type === "toLookBack" ? { phase: "lookBack" } : state;
    case "lookBack":
      return action.type === "retry" ? { phase: "prepare" } : state;
    default:
      return state;
  }
}
