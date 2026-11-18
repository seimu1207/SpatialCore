import fontUrl from "../fonts/inter-regular.woff2?url";

export const FONT_FAMILY = "CoreViewSans";

export type FontState = "loading" | "ready" | "failed";

let state: FontState = "loading";
let pending: Promise<FontState> | null = null;

/** The current font state. Text is drawn only when this is `ready`. */
export function fontState(): FontState {
  return state;
}

/**
 * Loads the bundled font once. On failure no text is drawn, there is no system-font
 * fallback, and one console warning is written (design.md O4, R-VIEW-03.9).
 */
export function loadFont(): Promise<FontState> {
  if (pending) return pending;
  pending = (async (): Promise<FontState> => {
    try {
      const face = new FontFace(FONT_FAMILY, `url(${fontUrl})`);
      await face.load();
      document.fonts.add(face);
      state = "ready";
    } catch {
      state = "failed";
      console.warn("Core view: the bundled font could not be loaded; text is not drawn.");
    }
    return state;
  })();
  return pending;
}
