import { Canvas } from "@react-three/fiber";
import { useMemo, useRef, useSyncExternalStore } from "react";
import { CameraRig } from "./camera-rig.tsx";
import { ConnectOverlay, ConnectProjector } from "./connect-overlay.tsx";
import { EdgeLines } from "./edge-line.tsx";
import { FogVolumes } from "./fog-volume.tsx";
import { FrameDriver } from "./frame-driver.tsx";
import { Gizmo } from "./gizmo.tsx";
import type { ImageCache } from "./image-cache.ts";
import { computeVisibleSet } from "../helpers/visibility.ts";
import { NodePanels } from "./node-panel.tsx";
import type { ViewSnapshot, ViewStore } from "./view-store.ts";
import { Walls } from "./wall.tsx";
import { ZoneFloors } from "./zone-floor.tsx";

/** Floors, labels, and Walls of the visible Zones, rebuilt from the current Scenario. */
function ZoneLayer({ snapshot, store }: { snapshot: ViewSnapshot; store: ViewStore }): React.JSX.Element {
  const { history, settings, theme, view } = snapshot;
  const scenario = history.present;
  const preset = settings.presets.find((p) => p.id === view.shownPresetId) ?? settings.presets[0];
  const zones = useMemo(() => {
    const visible = new Set(computeVisibleSet(scenario, preset.filter).zones);
    return scenario.zones.filter((z) => visible.has(z.id));
  }, [scenario, preset]);
  return (
    <>
      <ZoneFloors zones={zones} footprints={settings.zoneFootprints} theme={theme} store={store} />
      <Walls
        zones={zones}
        footprints={settings.zoneFootprints}
        wallHeight={settings.wallHeight}
        theme={theme}
        store={store}
      />
    </>
  );
}

/** The 3D view. The camera starts at the first preset pose (R-VIEW-08.8). */
export function ViewRoot({ store, images }: { store: ViewStore; images: ImageCache }): React.JSX.Element {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const pose = snap.settings.presets[0].pose;
  const lineRef = useRef<SVGLineElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pointerRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        shadows={false}
        onPointerMissed={() => {
          // Empty space and Edges (no handlers) arrive here; floors and Walls call the same method (R-VIEW-12.3).
          store.emptyClick();
        }}
        camera={{ position: [pose.position.x, pose.position.y, pose.position.z], fov: 50, near: 0.05, far: 500 }}
      >
        <color attach="background" args={[snap.theme.background]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 10, 7]} intensity={1.5} />
        <ZoneLayer snapshot={snap} store={store} />
        <NodePanels snapshot={snap} images={images} store={store} />
        <EdgeLines snapshot={snap} poses={snap.preview} />
        <FogVolumes snapshot={snap} poses={snap.preview} />
        <Gizmo store={store} snapshot={snap} />
        <CameraRig store={store} />
        <ConnectProjector store={store} lineRef={lineRef} pointerRef={pointerRef} />
        <FrameDriver store={store} />
      </Canvas>
      <ConnectOverlay lineRef={lineRef} />
    </div>
  );
}
