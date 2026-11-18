export type MeasureText = (text: string) => number;

/**
 * Wraps text by words to `maxWidth`, breaks words longer than a line, and drops lines that do
 * not fit `maxHeight`. Line breaks in the text start a new line. Returns the lines to draw.
 */
export function layoutText(
  text: string,
  maxWidth: number,
  maxHeight: number,
  lineHeight: number,
  measure: MeasureText,
): string[] {
  if (!(maxWidth > 0) || !(lineHeight > 0)) return [];
  const maxLines = Math.floor(maxHeight / lineHeight);
  if (maxLines < 1) return [];
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter((w) => w.length > 0)) {
      const candidate = current === "" ? word : `${current} ${word}`;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current !== "") lines.push(current);
      // Break a word that is longer than the line (by code point).
      let piece = "";
      for (const ch of word) {
        if (piece !== "" && measure(piece + ch) > maxWidth) {
          lines.push(piece);
          piece = ch;
        } else {
          piece += ch;
        }
        if (lines.length >= maxLines) return lines.slice(0, maxLines);
      }
      current = piece;
    }
    lines.push(current);
    if (lines.length >= maxLines) return lines.slice(0, maxLines);
  }
  return lines.slice(0, maxLines);
}
