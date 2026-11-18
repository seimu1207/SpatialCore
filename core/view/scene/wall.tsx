import type { ThreeEvent } from "@react-three/fiber";
import { DoubleSide } from "three";
import type { Zone } from "../../model/scenario-schema.ts";
import type { ZoneFootprint } from "../helpers/settings-schema.ts";
import type { Theme } from "../helpers/theme-schema.ts";
import type { ViewStore } from "./view-store.ts";

const WALL_THICKNESS = 0.05;

/** Opaque, double-sided, writes depth: the depth buffer hides what lies behind it (design.md D7). */
function WallMaterial({ color }: { color: string }): React.JSX.Element {
  return <meshStandardMaterial color={color} side={DoubleSide} transparent={false} depthTest depthWrite />;
}

/**
 * A Wall is hit-tested so a Node behind it cannot be clicked through it. R3F sorts hits by distance and the Node
 * handlers stop propagation, so a Wall behind a nearer Node never fires. A click acts as an empty click (R-VIEW-12.3).
 */
export function wallHandlers(store: ViewStore) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      store.emptyClick();
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
    },
  };
}
function Wall({
  zone,
  footprint,
  wallHeight,
  theme,
  store,
}: {
  zone: Zone;
  footprint: ZoneFootprint;
  wallHeight: number;
  theme: Theme;
  store: ViewStore;
}): React.JSX.Element {
  const handlers = wallHandlers(store);
  const y = zone.elevation + wallHeight / 2;
  if (footprint.kind === "ring") {
    return (
      <mesh position={[footprint.x, y, footprint.z]} {...handlers}>
        <cylinderGeometry args={[footprint.outerRadius, footprint.outerRadius, wallHeight, 64, 1, true]} />
        <WallMaterial color={theme.wall} />
      </mesh>
    );
  }
  const { x, z, width, depth } = footprint;
  const sides: { key: string; pos: [number, number, number]; size: [number, number, number] }[] = [
    { key: "north", pos: [x, y, z - depth / 2], size: [width + WALL_THICKNESS, wallHeight, WALL_THICKNESS] },
    { key: "south", pos: [x, y, z + depth / 2], size: [width + WALL_THICKNESS, wallHeight, WALL_THICKNESS] },
    { key: "west", pos: [x - width / 2, y, z], size: [WALL_THICKNESS, wallHeight, depth + WALL_THICKNESS] },
    { key: "east", pos: [x + width / 2, y, z], size: [WALL_THICKNESS, wallHeight, depth + WALL_THICKNESS] },
  ];
  return (
    <>
      {sides.map((s) => (
        <mesh key={s.key} position={s.pos} {...handlers}>
          <boxGeometry args={s.size} />
          <WallMaterial color={theme.wall} />
        </mesh>
      ))}
    </>
  );
}

/** One Wall per visible, enclosed Zone that has a footprint (R-VIEW-06.3, 06.5, 06.6). */
export function Walls({
  zones,
  footprints,
  wallHeight,
  theme,
  store,
}: {
  zones: readonly Zone[];
  footprints: readonly ZoneFootprint[];
  wallHeight: number;
  theme: Theme;
  store: ViewStore;
}): React.JSX.Element {
  return (
    <>
      {zones.map((zone) => {
        if (!zone.enclosed) return null;
        const footprint = footprints.find((f) => f.id === zone.id);
        if (footprint === undefined) return null;
        return <Wall key={zone.id} zone={zone} footprint={footprint} wallHeight={wallHeight} theme={theme} store={store} />;
      })}
    </>
  );
}
