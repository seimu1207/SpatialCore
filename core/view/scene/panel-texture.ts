import { CanvasTexture, SRGBColorSpace } from "three";
import type { Face } from "../../model/scenario-schema.ts";
import type { NodeStyle } from "../helpers/theme-schema.ts";
import { FONT_FAMILY, type FontState } from "./font.ts";
import type { ImageEntry } from "./image-cache.ts";
import { layoutText } from "./text-layout.ts";

export const PANEL_WIDTH = 512;
export const PANEL_HEIGHT = 384;
export const BORDER_WIDTH = 8;
/** The text band of an image panel: the bottom 30 % of the height, at 85 % fill alpha (design.md D4). */
export const BAND_FRACTION = 0.3;
export const BAND_ALPHA = 0.85;

const PADDING = 16;
const TEXT_ONLY = { size: 36, lineHeight: 44 };
const BAND_TEXT = { size: 28, lineHeight: 34 };

export type PanelInput = {
  front: Pick<Face, "text" | "image">;
  style: NodeStyle;
  textColor: string;
  /** The cache entry of `front.image`, or null when the Face has no image. */
  image: ImageEntry | null;
  font: FontState;
};

/** Changes exactly when a redraw would give a different picture (never on a position change). */
export function panelKey(input: PanelInput): string {
  return JSON.stringify([
    input.front.text?.en ?? null,
    input.front.image ?? null,
    input.style.fill,
    input.style.border,
    input.textColor,
    input.image?.state ?? null,
    input.font,
  ]);
}

type Ctx = CanvasRenderingContext2D;

function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  metrics: { size: number; lineHeight: number },
  color: string,
): void {
  ctx.font = `${metrics.size}px ${FONT_FAMILY}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  const lines = layoutText(text, width, height, metrics.lineHeight, (t) => ctx.measureText(t).width);
  const pad = (metrics.lineHeight - metrics.size) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * metrics.lineHeight + pad);
  });
}

/** Draws one panel into a 512 × 384 context. Text uses `fillText` only (S-VIEW-2). */
export function drawPanel(ctx: Ctx, input: PanelInput): void {
  const { style, front } = input;
  ctx.clearRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  ctx.fillStyle = style.fill;
  ctx.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);

  const innerX = BORDER_WIDTH;
  const innerY = BORDER_WIDTH;
  const innerW = PANEL_WIDTH - 2 * BORDER_WIDTH;
  const innerH = PANEL_HEIGHT - 2 * BORDER_WIDTH;
  const fontReady = input.font === "ready";
  const text = front.text?.en ?? "";
  const image = input.image?.state === "ready" ? input.image.image : null;

  if (image !== null && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const k = Math.min(innerW / image.naturalWidth, innerH / image.naturalHeight);
    const w = image.naturalWidth * k;
    const h = image.naturalHeight * k;
    ctx.drawImage(image, innerX + (innerW - w) / 2, innerY + (innerH - h) / 2, w, h);
    if (text !== "" && fontReady) {
      const bandH = PANEL_HEIGHT * BAND_FRACTION;
      const bandY = PANEL_HEIGHT - bandH;
      ctx.save();
      ctx.globalAlpha = BAND_ALPHA;
      ctx.fillStyle = style.fill;
      ctx.fillRect(innerX, bandY, innerW, bandH - BORDER_WIDTH);
      ctx.restore();
      drawText(
        ctx,
        text,
        innerX + PADDING,
        bandY + 8,
        innerW - 2 * PADDING,
        bandH - BORDER_WIDTH - 8,
        BAND_TEXT,
        input.textColor,
      );
    }
  } else if (text !== "" && fontReady) {
    drawText(
      ctx,
      text,
      innerX + PADDING,
      innerY + PADDING,
      innerW - 2 * PADDING,
      innerH - 2 * PADDING,
      TEXT_ONLY,
      input.textColor,
    );
  }

  ctx.strokeStyle = style.border;
  ctx.lineWidth = BORDER_WIDTH;
  ctx.strokeRect(BORDER_WIDTH / 2, BORDER_WIDTH / 2, PANEL_WIDTH - BORDER_WIDTH, PANEL_HEIGHT - BORDER_WIDTH);
}

/** Detail_Layer picture size: the 1.6 × 0.6 base plane at 320 px per unit. */
export const DETAIL_WIDTH = 512;
export const DETAIL_HEIGHT = 192;
const DETAIL_TEXT = { size: 30, lineHeight: 38 };

export type DetailInput = {
  text: string;
  fill: string;
  textColor: string;
  font: FontState;
};

/** Changes exactly when a redraw of the Detail_Layer would differ. */
export function detailKey(input: DetailInput): string {
  return JSON.stringify([input.text, input.fill, input.textColor, input.font]);
}

/** Draws the detail text in the Theme text color on the Node fill. Text uses `fillText` only (S-VIEW-2). */
export function drawDetail(ctx: Ctx, input: DetailInput): void {
  ctx.clearRect(0, 0, DETAIL_WIDTH, DETAIL_HEIGHT);
  ctx.fillStyle = input.fill;
  ctx.fillRect(0, 0, DETAIL_WIDTH, DETAIL_HEIGHT);
  if (input.text === "" || input.font !== "ready") return;
  drawText(
    ctx,
    input.text,
    PADDING,
    PADDING / 2,
    DETAIL_WIDTH - 2 * PADDING,
    DETAIL_HEIGHT - PADDING,
    DETAIL_TEXT,
    input.textColor,
  );
}

/** One canvas texture for a Detail_Layer. Dispose it when it is replaced. */
export function createDetailTexture(input: DetailInput): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = DETAIL_WIDTH;
  canvas.height = DETAIL_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) drawDetail(ctx, input);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** One 512 × 384 canvas texture for a Node. Dispose it when it is replaced. */
export function createPanelTexture(input: PanelInput): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = PANEL_WIDTH;
  canvas.height = PANEL_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) drawPanel(ctx, input);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
