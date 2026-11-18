import { describe, expect, it } from "vitest";
import { createImageCache, type ImageCacheDeps } from "./image-cache.ts";

// A minimal stand-in for HTMLImageElement: only the members the cache uses.
interface FakeImage {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

function setup(resolve: (r: string) => string | null, tainted = false) {
  const images: FakeImage[] = [];
  const deps: ImageCacheDeps = {
    createImage: () => {
      const img: FakeImage = { onload: null, onerror: null, src: "" };
      images.push(img);
      return img as unknown as HTMLImageElement;
    },
    isTainted: () => tainted,
  };
  return { cache: createImageCache(resolve, deps), images };
}

describe("image cache (R-VIEW-04.3, 04.5, 04.6, S-VIEW-3)", () => {
  it("calls the resolver once per reference and loads the returned source only", () => {
    const calls: string[] = [];
    const { cache, images } = setup((r) => {
      calls.push(r);
      return `blob:${r}`;
    });
    expect(cache.get("a").state).toBe("loading");
    cache.get("a");
    expect(calls).toEqual(["a"]);
    expect(images).toHaveLength(1);
    expect(images[0]?.src).toBe("blob:a");
  });

  it("becomes ready on load and notifies", () => {
    const { cache, images } = setup((r) => r);
    let notified = 0;
    cache.subscribe(() => notified++);
    cache.get("a");
    images[0]?.onload?.();
    expect(cache.get("a").state).toBe("ready");
    expect(notified).toBe(1);
  });

  it("treats null, a throw, an error event, and a tainted canvas as failed", () => {
    expect(setup(() => null).cache.get("a").state).toBe("failed");
    expect(
      setup(() => {
        throw new Error("x");
      }).cache.get("a").state,
    ).toBe("failed");
    const errored = setup((r) => r);
    errored.cache.get("a");
    errored.images[0]?.onerror?.();
    expect(errored.cache.get("a").state).toBe("failed");
    const taint = setup((r) => r, true);
    taint.cache.get("a");
    taint.images[0]?.onload?.();
    expect(taint.cache.get("a").state).toBe("failed");
  });
});
