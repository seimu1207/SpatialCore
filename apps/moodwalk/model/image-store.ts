/** Image_Store (design.md "Image_Store"): Image_Reference to blob URL, pruned against the History. No DOM, no throw. */
import type { History } from "../../../core/model/history.ts";
import type { Scenario } from "../../../core/model/scenario-schema.ts";

function addReferences(scenario: Scenario, into: Set<string>): void {
  for (const node of scenario.nodes) {
    const image = node.front.image;
    if (typeof image === "string") into.add(image);
  }
}

/** Every `front.image` of every Node in `past`, `present`, and `future`. */
export function referencesIn(history: History): Set<string> {
  const found = new Set<string>();
  for (const s of history.past) addReferences(s, found);
  addReferences(history.present, found);
  for (const s of history.future) addReferences(s, found);
  return found;
}

export class ImageStore {
  private readonly entries = new Map<string, string>();
  private readonly release: (url: string) => void;

  constructor(release: (url: string) => void) {
    this.release = release;
  }

  put(reference: string, url: string): void {
    const old = this.entries.get(reference);
    if (old !== undefined && old !== url) this.release(old);
    this.entries.set(reference, url);
  }

  /** The Image_Resolver: `null` for any reference not in the store (R-APP2-04.11). */
  url(reference: string): string | null {
    return this.entries.get(reference) ?? null;
  }

  remove(reference: string): void {
    const url = this.entries.get(reference);
    if (url === undefined) return;
    this.entries.delete(reference);
    this.release(url);
  }

  /** Remove and release every entry no Scenario of the History refers to; returns the removed references. */
  prune(history: History): string[] {
    const keep = referencesIn(history);
    const removed = [...this.entries.keys()].filter((r) => !keep.has(r));
    for (const r of removed) this.remove(r);
    return removed;
  }
}
