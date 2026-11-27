import { analysisSize } from "../model/pixels.ts";
import type { PixelData, ReadResult } from "../model/pixels.ts";

/** Largest display copy, in pixels. The copy is never enlarged. */
const DISPLAY_WIDTH = 512;
const DISPLAY_HEIGHT = 384;

const DECODE_FAILED: ReadResult = { ok: false, reason: "decode" };

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Decodes a file the person chose or dropped, reads Analysis_Size pixels, and makes a display copy.
 * Pixels come only from the File through createImageBitmap and a canvas: no network call, no metadata
 * read, no reference to the File kept (S-APP2-3, S-APP2-4).
 */
export async function readImageFile(file: Blob): Promise<ReadResult> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const size = analysisSize(bitmap.width, bitmap.height);
    if (size === null) return DECODE_FAILED;

    const analysisCanvas = makeCanvas(size.width, size.height);
    const analysisContext = analysisCanvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: true });
    if (analysisContext === null) return DECODE_FAILED;
    analysisContext.imageSmoothingEnabled = true;
    analysisContext.imageSmoothingQuality = "high";
    analysisContext.drawImage(bitmap, 0, 0, size.width, size.height);
    const imageData = analysisContext.getImageData(0, 0, size.width, size.height, { colorSpace: "srgb" });
    const pixels: PixelData = { width: imageData.width, height: imageData.height, data: Array.from(imageData.data) };

    const k = Math.min(1, DISPLAY_WIDTH / bitmap.width, DISPLAY_HEIGHT / bitmap.height);
    const displayWidth = Math.max(1, Math.round(bitmap.width * k));
    const displayHeight = Math.max(1, Math.round(bitmap.height * k));
    const displayCanvas = makeCanvas(displayWidth, displayHeight);
    const displayContext = displayCanvas.getContext("2d");
    if (displayContext === null) return DECODE_FAILED;
    displayContext.imageSmoothingEnabled = true;
    displayContext.imageSmoothingQuality = "high";
    displayContext.drawImage(bitmap, 0, 0, displayWidth, displayHeight);
    const blob = await canvasToPngBlob(displayCanvas);
    if (blob === null) return DECODE_FAILED;

    return { ok: true, pixels, displayUrl: URL.createObjectURL(blob) };
  } catch {
    return DECODE_FAILED;
  } finally {
    if (bitmap !== null) bitmap.close();
  }
}
