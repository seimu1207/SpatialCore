import { memo, useEffect, useMemo } from "react";
import { CatmullRomCurve3, Euler, ExtrudeGeometry, Path, Shape, TubeGeometry, Vector3, type BufferGeometry } from "three";
import { drawableEffects, shownEffects, type DrawableEffect } from "../helpers/effects-view.ts";
import { edgeOffsets, loopSizes } from "../helpers/edge-layout.ts";
import type { ZoneFootprint } from "../helpers/settings-schema.ts";
import { computeVisibleSet } from "../helpers/visibility.ts";
import { drawnEdgePoints, type NodePoses } from "./edge-line.tsx";
import type { ViewSnapshot } from "./view-store.ts";

const PANEL_WIDTH = 1.6;
const PANEL_HEIGHT = 1.2;
const NODE_FOG_SCALE = 1.25;
const NODE_FOG_DEPTH = 0.6;
const EDGE_FOG_RADIUS = 0.3;

/** Disposes the geometry when it is replaced or the component unmounts. */
function useDisposed<T extends BufferGeometry>(geometry: T): T {
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return geometry;
}

function FogMaterial({ effect }: { effect: DrawableEffect }): React.JSX.Element {
  return (
    <meshBasicMaterial
      color={effect.style.color}
      opacity={effect.style.opacity}
      transparent
      depthWrite={false}
      toneMapped={false}
    />
  );
}

function footprintShape(f: ZoneFootprint): Shape {
  // The shape lies in the XY plane; after rotating -90° about X, shape y = -world z.
  if (f.kind === "ring") {
    const shape = new Shape();
    shape.absarc(f.x, -f.z, f.outerRadius, 0, Math.PI * 2, false);
    if (f.innerRadius > 0) {
      const hole = new Path();
      hole.absarc(f.x, -f.z, f.innerRadius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return shape;
  }
  const shape = new Shape();
  shape.moveTo(f.x - f.width / 2, -f.z - f.depth / 2);
  shape.lineTo(f.x + f.width / 2, -f.z - f.depth / 2);
  shape.lineTo(f.x + f.width / 2, -f.z + f.depth / 2);
  shape.lineTo(f.x - f.width / 2, -f.z + f.depth / 2);
  shape.closePath();
  return shape;
}

function ZoneFog({
  effect,
  footprint,
  elevation,
  height,
}: {
  effect: DrawableEffect;
  footprint: ZoneFootprint;
  elevation: number;
  height: number;
}): React.JSX.Element {
  const geometry = useDisposed(
    useMemo(() => {
      const g = new ExtrudeGeometry(footprintShape(footprint), { depth: height, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      return g;
    }, [footprint, height]),
  );
  return (
    <mesh geometry={geometry} position={[0, elevation, 0]}>
      <FogMaterial effect={effect} />
    </mesh>
  );
}

function EdgeFog({ effect, points }: { effect: DrawableEffect; points: [number, number, number][] }): React.JSX.Element | null {
  const geometry = useDisposed(
    useMemo(() => {
      const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
      return new TubeGeometry(curve, Math.max(8, points.length * 2), EDGE_FOG_RADIUS, 8, false);
    }, [points]),
  );
  return (
    <mesh geometry={geometry}>
      <FogMaterial effect={effect} />
    </mesh>
  );
}

/** Fog volumes for the Effect_Requests that are shown, styled, visible, and drawable (R-VIEW-10, 18.4). */
type FogProps = { snapshot: ViewSnapshot; poses?: NodePoses };

/** Skips a redraw unless an input the fog uses changed. A Timeline tick that does not move the cursor changes none. */
function fogUnchanged(a: FogProps, b: FogProps): boolean {
  const x = a.snapshot;
  const y = b.snapshot;
  return (
    a.poses === b.poses &&
    x.history.present === y.history.present &&
    x.settings === y.settings &&
    x.theme === y.theme &&
    x.appEffects === y.appEffects &&
    x.view.shownPresetId === y.view.shownPresetId &&
    x.view.timeline?.cursor === y.view.timeline?.cursor
  );
}

export const FogVolumes = memo(function FogVolumes({ snapshot, poses }: FogProps): React.JSX.Element {
  const { history, settings, theme, appEffects, view } = snapshot;
  const scenario = history.present;
  const preset = settings.presets.find((p) => p.id === view.shownPresetId) ?? settings.presets[0];
  const visible = useMemo(() => computeVisibleSet(scenario, preset.filter), [scenario, preset]);
  const cursor = view.timeline?.cursor ?? null;
  const shown = useMemo(
    () => shownEffects(appEffects, cursor === null ? null : { cursor }),
    [appEffects, cursor],
  );
  const drawable = useMemo(
    () =>
      drawableEffects(shown, scenario, visible, new Set(settings.zoneFootprints.map((f) => f.id)), theme),
    [shown, scenario, visible, settings.zoneFootprints, theme],
  );
  const offsets = useMemo(() => edgeOffsets(scenario, visible.edges, theme), [scenario, visible, theme]);
  const loops = useMemo(() => loopSizes(scenario, visible.edges), [scenario, visible]);
  const wallHeight = Math.min(1, settings.wallHeight);
  // Edge curves and their fog tubes are rebuilt only when the Scenario, layout inputs, or a preview pose change.
  const edgePoints = useMemo(() => {
    const out = new Map<string, [number, number, number][] | null>();
    for (const effect of drawable) {
      const { kind, id } = effect.target;
      if (kind !== "edge" || out.has(id)) continue;
      const edge = scenario.edges.find((e) => e.id === id);
      out.set(id, edge === undefined ? null : drawnEdgePoints(scenario, edge, offsets.get(id) ?? 0, loops.get(id), theme, poses));
    }
    return out;
  }, [drawable, scenario, offsets, loops, theme, poses]);

  return (
    <>
      {drawable.map((effect, i) => {
        const { kind, id } = effect.target;
        const key = `${kind}:${id}:${i}`;
        if (kind === "node") {
          const node = scenario.nodes.find((n) => n.id === id);
          if (node === undefined) return null;
          const r = node.rotation;
          const p = poses?.get(id)?.position ?? node.position;
          return (
            <mesh
              key={key}
              position={[p.x, p.y, p.z]}
              rotation={new Euler(r.x, r.y, r.z, "XYZ")}
            >
              <boxGeometry
                args={[
                  NODE_FOG_SCALE * PANEL_WIDTH * node.scale.x,
                  NODE_FOG_SCALE * PANEL_HEIGHT * node.scale.y,
                  NODE_FOG_DEPTH,
                ]}
              />
              <FogMaterial effect={effect} />
            </mesh>
          );
        }
        if (kind === "edge") {
          const edge = scenario.edges.find((e) => e.id === id);
          if (edge === undefined) return null;
          const points = edgePoints.get(id) ?? null;
          return points === null || points.length < 2 ? null : <EdgeFog key={key} effect={effect} points={points} />;
        }
        const zone = scenario.zones.find((z) => z.id === id);
        const footprint = settings.zoneFootprints.find((f) => f.id === id);
        if (zone === undefined || footprint === undefined) return null;
        return (
          <ZoneFog key={key} effect={effect} footprint={footprint} elevation={zone.elevation} height={wallHeight} />
        );
      })}
    </>
  );
}, fogUnchanged);
