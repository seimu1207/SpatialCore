export type ImageResolver = (reference: string) => string | null;
export type ImageState = "loading" | "ready" | "failed";

export interface ImageEntry {
  readonly state: ImageState;
  readonly image: HTMLImageElement | null;
}

export interface ImageCacheDeps {
  /** Creates an image element that is not yet loading. */
  createImage: () => HTMLImageElement;
  /** Returns true when drawing the image taints the canvas (the 1-pixel getImageData probe). */
  isTainted: (image: HTMLImageElement) => boolean;
}

export interface ImageCache {
  /** Starts loading on the first call per reference; later calls return the stored entry. */
  get(reference: string): ImageEntry;
  /** Called when an entry changes from `loading`. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const LOADING: ImageEntry = { state: "loading", image: null };
const FAILED: ImageEntry = { state: "failed", image: null };

function browserDeps(): ImageCacheDeps {
  return {
    createImage: () => new Image(),
    isTainted: (image) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return true;
        ctx.drawImage(image, 0, 0, 1, 1);
        ctx.getImageData(0, 0, 1, 1);
        return false;
      } catch {
        return true;
      }
    },
  };
}

/**
 * Calls the App's resolver once per distinct reference. The Core_View never fetches a
 * reference by itself: only the source the resolver returns is loaded (S-VIEW-3).
 */
export function createImageCache(
  resolve: ImageResolver,
  deps: ImageCacheDeps = browserDeps(),
): ImageCache {
  const entries = new Map<string, ImageEntry>();
  const listeners = new Set<() => void>();
  let disposed = false;

  const settle = (reference: string, entry: ImageEntry): void => {
    if (disposed) return;
    entries.set(reference, entry);
    for (const listener of [...listeners]) listener();
  };

  return {
    get(reference) {
      const known = entries.get(reference);
      if (known) return known;
      const source = ((): string | null => {
        try {
          return resolve(reference);
        } catch {
          return null;
        }
      })();
      if (typeof source !== "string" || source === "") {
        entries.set(reference, FAILED);
        return FAILED;
      }
      entries.set(reference, LOADING);
      const image = deps.createImage();
      image.onload = () => {
        const tainted = ((): boolean => {
          try {
            return deps.isTainted(image);
          } catch {
            return true;
          }
        })();
        settle(reference, tainted ? FAILED : { state: "ready", image });
      };
      image.onerror = () => settle(reference, FAILED);
      image.src = source;
      return LOADING;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}
