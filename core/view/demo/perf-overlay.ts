/** Frame-time overlay, used only with `?perf`. Records frame times for 10 s, then shows the median. */

export const PERF_DURATION_MS = 10_000;

/** Median of a list of numbers; `NaN` for an empty list. Does not change its input. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? Number.NaN;
  const lower = sorted[mid - 1] ?? upper;
  return sorted.length % 2 === 1 ? upper : (lower + upper) / 2;
}

/** Differences between consecutive timestamps (ms). */
export function frameTimes(timestamps: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    out.push((timestamps[i] ?? 0) - (timestamps[i - 1] ?? 0));
  }
  return out;
}

/** Adds the overlay to `parent` and starts recording. Returns a function that stops it and removes the overlay. */
export function startPerfOverlay(parent: HTMLElement): () => void {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;top:8px;right:8px;padding:6px 10px;background:rgba(0,0,0,0.75);color:#fff;font:12px monospace;z-index:10";
  box.textContent = "Recording frame times...";
  parent.append(box);
  const stamps: number[] = [];
  let start = -1;
  let handle = 0;
  const tick = (now: number): void => {
    if (start < 0) start = now;
    stamps.push(now);
    if (now - start >= PERF_DURATION_MS) {
      box.textContent = `Median frame time: ${median(frameTimes(stamps)).toFixed(1)} ms (${String(stamps.length - 1)} frames)`;
      return;
    }
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(handle);
    box.remove();
  };
}
