import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import type { Zone } from "../../model/scenario-schema.ts";
import type { ZoneFootprint } from "../helpers/settings-schema.ts";
import type { Theme } from "../helpers/theme-schema.ts";
import type { ViewStore } from "./view-store.ts";
import { wallHandlers } from "./wall.tsx";
import { FONT_FAMILY, fontState, loadFont, type FontState } from "./font.ts";

const LABEL_LIFT = 0.01;
const LABEL_CANVAS_WIDTH = 512;
const LABEL_CANVAS_HEIGHT = 128;
const LABEL_MAX_WIDTH = 4;

/** Where the label plane sits and how wide it may be, inside the footprint (R-VIEW-06.2). */
export function labelPlacement(fp: ZoneFootprint): { x: number; z: number; width: number } {
  if (fp.kind === "rect") return { x: fp.x, z: fp.z, width: Math.min(LABEL_MAX_WIDTH, fp.width) };
  const band = fp.outerRadius - fp.innerRadius;
  return { x: fp.x, z: fp.z + (fp.innerRadius + fp.outerRadius) / 2, width: Math.min(LABEL_MAX_WIDTH, band) };
}

/** A canvas texture with the label drawn by `fillText` only (S-VIEW-2). Needs the loaded font. */
function createLabelTexture(text: string, color: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_CANVAS_WIDTH;
  canvas.height = LABEL_CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    let size = 64;
    ctx.font = `${size}px ${FONT_FAMILY}`;
    const measured = ctx.measureText(text).width;
    const room = LABEL_CANVAS_WIDTH - 16;
    if (measured > room && measured > 0) size = Math.max(8, Math.floor((size * room) / measured));
    ctx.font = `${size}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, LABEL_CANVAS_WIDTH / 2, LABEL_CANVAS_HEIGHT / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ZoneLabel({
  text,
  color,
  elevation,
  footprint,
}: {
  text: string;
  color: string;
  elevation: number;
  footprint: ZoneFootprint;
}): React.JSX.Element {
  const texture = useMemo(() => createLabelTexture(text, color), [text, color]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  const place = labelPlacement(footprint);
  const height = place.width * (LABEL_CANVAS_HEIGHT / LABEL_CANVAS_WIDTH);
  return (
    <mesh position={[place.x, elevation + LABEL_LIFT, place.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[place.width, height]} />
      <meshBasicMaterial map={texture} transparent depthTest depthWrite={false} toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}

function ZoneFloor({
  zone,
  footprint,
  theme,
  font,
  store,
}: {
  zone: Zone;
  footprint: ZoneFootprint;
  theme: Theme;
  font: FontState;
  store: ViewStore;
}): React.JSX.Element {
  const text = zone.label.en;
  return (
    <>
      <mesh position={[footprint.x, zone.elevation, footprint.z]} rotation={[-Math.PI / 2, 0, 0]} {...wallHandlers(store)}>
        {footprint.kind === "rect" ? (
          <planeGeometry args={[footprint.width, footprint.depth]} />
        ) : (
          <ringGeometry args={[footprint.innerRadius, footprint.outerRadius, 64]} />
        )}
        <meshStandardMaterial color={theme.floor} side={DoubleSide} depthTest depthWrite />
      </mesh>
      {font === "ready" && text !== "" ? (
        <ZoneLabel text={text} color={theme.text} elevation={zone.elevation} footprint={footprint} />
      ) : null}
    </>
  );
}

function useFontState(): FontState {
  const [state, setState] = useState<FontState>(fontState());
  useEffect(() => {
    let live = true;
    void loadFont().then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** One floor and label per visible Zone that has a footprint. Others draw nothing, with no error (R-VIEW-06.6). */
export function ZoneFloors({
  zones,
  footprints,
  theme,
  store,
}: {
  zones: readonly Zone[];
  footprints: readonly ZoneFootprint[];
  theme: Theme;
  store: ViewStore;
}): React.JSX.Element {
  const font = useFontState();
  return (
    <>
      {zones.map((zone) => {
        const footprint = footprints.find((f) => f.id === zone.id);
        if (footprint === undefined) return null;
        return <ZoneFloor key={zone.id} zone={zone} footprint={footprint} theme={theme} font={font} store={store} />;
      })}
    </>
  );
}
