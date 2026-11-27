import { SAMPLE_HEIGHT, SAMPLE_WIDTH, samplePixels } from "../model/sample-images.ts";
import type { SampleRecipe } from "../model/sample-images.ts";

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Draws each fixed pixel recipe (no AI, S-APP2-2) and returns `sample:<id>` -> `blob:` URL.
 * Rejects when a canvas or toBlob step fails; the caller handles the failure.
 */
export async function renderSamples(recipes: readonly SampleRecipe[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  try {
    for (const recipe of recipes) {
      const pixels = samplePixels(recipe);
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_WIDTH;
      canvas.height = SAMPLE_HEIGHT;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("canvas unavailable");
      const imageData = new ImageData(Uint8ClampedArray.from(pixels.data), pixels.width, pixels.height);
      context.putImageData(imageData, 0, 0);
      const blob = await toPngBlob(canvas);
      if (blob === null) throw new Error("toBlob failed");
      urls.set(`sample:${recipe.id}`, URL.createObjectURL(blob));
    }
  } catch (error) {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    throw error;
  }
  return urls;
}
