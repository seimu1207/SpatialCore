import { Edges } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BoxGeometry, MeshBasicMaterial, type Mesh } from "three";
import type { Node } from "../../model/scenario-schema.ts";
import { nodeClickAction } from "../helpers/connect-ui.ts";
import { showsDetail } from "../helpers/detail.ts";
import { dragCommand } from "../helpers/gesture-commands.ts";
import { dragPreview, exceedsDragThreshold, zonePlaneY, type Point2, type Vec3 } from "./drag.ts";
import { nodeStyleFor, type Theme } from "../helpers/theme-schema.ts";
import { computeVisibleSet } from "../helpers/visibility.ts";
import { fontState, loadFont, type FontState } from "./font.ts";
import type { ImageCache } from "./image-cache.ts";
import { createDetailTexture, createPanelTexture, detailKey, panelKey } from "./panel-texture.ts";
import type { ViewSnapshot, ViewStore } from "./view-store.ts";

/** Base panel size before `scale.x`, `scale.y` (design.md D3) and thickness before `scale.z`. */
export const BASE_WIDTH = 1.6;
export const BASE_HEIGHT = 1.2;
export const BASE_THICKNESS = 0.02;
/** Detail_Layer base height (width is `BASE_WIDTH`), design.md "Labels and Detail_Layers". */
export const DETAIL_BASE_HEIGHT = 0.6;

type PanelProps = {
  node: Node;
  theme: Theme;
  images: ImageCache;
  font: FontState;
  /** Changes when any image finishes loading, so the panel is drawn again. */
  imageVersion: number;
  detailDistance: number;
  store: ViewStore;
  selected: boolean;
  editMode: "view" | "edit";
};

/** Highlight color of the selected Node (outline) or Edge (line and arrow). */
export const SELECTION_COLOR = "#ffd400";

/** The Detail_Layer plane under the panel, shown only while the camera is within the Detail_Distance. */
function DetailLayer({
  node,
  text,
  fill,
  textColor,
  font,
  detailDistance,
}: {
  node: Node;
  text: string;
  fill: string;
  textColor: string;
  font: FontState;
  detailDistance: number;
}): React.JSX.Element {
  const ref = useRef<Mesh>(null);
  const key = detailKey({ text, fill, textColor, font });
  // `key` covers every input that changes the picture.
  const texture = useMemo(() => createDetailTexture({ text, fill, textColor, font }), [key]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  const { x, y, z } = node.position;
  // One point object per pose, so the per-frame check below allocates nothing.
  const at = useMemo(() => ({ x, y, z }), [x, y, z]);
  useFrame((state) => {
    const mesh = ref.current;
    if (mesh === null) return;
    const near = showsDetail(state.camera.position, at, detailDistance);
    if (mesh.visible !== near) mesh.visible = near;
  });
  const width = BASE_WIDTH * node.scale.x;
  const height = DETAIL_BASE_HEIGHT * node.scale.y;
  return (
    <group position={[x, y, z]} rotation={[node.rotation.x, node.rotation.y, node.rotation.z, "XYZ"]}>
      <mesh ref={ref} visible={false} position={[0, -(BASE_HEIGHT * node.scale.y + height) / 2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

type PressState = { start: Point2; dragging: boolean; last: Vec3 | null; captured: boolean };

type Capturable = { setPointerCapture(id: number): void };

/** Pointer handlers for one Node: click selects, press-and-move on the selected Node drags it (R-VIEW-12, 13). */
function useNodeGesture(node: Node, store: ViewStore, selected: boolean, editMode: "view" | "edit") {
  const press = useRef<PressState | null>(null);
  const controls = useThree((s) => s.controls);
  const id = node.id;

  const end = (commit: boolean): void => {
    const p = press.current;
    if (p === null) return;
    press.current = null;
    // A cancelled Gesture (`store.cancelGesture`) clears the flag; its drag then commits nothing (R-VIEW-23.12).
    if (commit && store.gestureActive && p.dragging && p.last !== null) {
      const current = store.getSnapshot().history.present.nodes.find((n) => n.id === id);
      const command = current === undefined ? null : dragCommand(current, p.last);
      if (command !== null) store.execute(command);
    }
    // After `execute`, so an accepted move never flashes the old pose; a rejected one redraws the stored pose.
    store.setPreview(null);
    store.setGestureActive(false);
  };

  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      // R3F `delta` is the rounded pointer travel in canvas CSS px between the last pointerdown and the click.
      if (e.delta > 5) return;
      // Only visible Nodes have a panel, so a hidden Node can never reach here (R-VIEW-15.8).
      const action = nodeClickAction(editMode, store.getSnapshot().view.connect !== null);
      if (action === "connect") store.dispatch({ type: "connectClick", id });
      else if (action === "select") store.dispatch({ type: "select", selection: { kind: "node", id } });
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (editMode !== "edit" || !selected || e.nativeEvent.button !== 0 || store.gizmoHot) return;
      // No drag while connect is on: a click belongs to the connection.
      if (store.getSnapshot().view.connect !== null) return;
      press.current = {
        start: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        dragging: false,
        last: null,
        captured: true,
      };
      // Orbit controls go off in this handler, before the 5 px threshold (R-VIEW-08.9).
      if (controls !== null) (controls as unknown as { enabled: boolean }).enabled = false;
      store.setGestureActive(true);
      (e.target as unknown as Capturable).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const p = press.current;
      if (p === null) return;
      if (!store.gestureActive) {
        press.current = null;
        return;
      }
      const now = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
      if (!p.dragging) {
        if (!exceedsDragThreshold(p.start, now)) return;
        p.dragging = true;
      }
      const { history, settings } = store.getSnapshot();
      const current = history.present.nodes.find((n) => n.id === id);
      if (current === undefined) return;
      const { origin, direction } = e.ray;
      const next = dragPreview(
        origin,
        direction,
        zonePlaneY(history.present, current),
        current.position.y,
        settings.snapStep,
        p.last ?? current.position,
      );
      p.last = next;
      store.setPreview(new Map([[id, { position: next }]]));
    },
    onPointerUp: () => {
      end(true);
    },
    onPointerCancel: () => {
      end(false);
    },
    onLostPointerCapture: () => {
      end(false);
    },
  };
}

/** One box shared by every panel; the mesh scale sets the size. */
const PANEL_BOX = new BoxGeometry(1, 1, 1);

/** Side/back face materials, one per fill color, shared by every panel with that fill. */
const sideMaterials = new Map<string, MeshBasicMaterial>();
function sideMaterial(fill: string): MeshBasicMaterial {
  let m = sideMaterials.get(fill);
  if (m === undefined) {
    m = new MeshBasicMaterial({ color: fill });
    sideMaterials.set(fill, m);
  }
  return m;
}

const NodePanel = memo(function NodePanel({
  node,
  theme,
  images,
  font,
  detailDistance,
  store,
  selected,
  editMode,
}: PanelProps): React.JSX.Element {
  const handlers = useNodeGesture(node, store, selected, editMode);
  const style = nodeStyleFor(theme, node.type);
  const image = node.front.image === undefined ? null : images.get(node.front.image);
  const input = { front: node.front, style, textColor: theme.text, image, font };
  const key = panelKey(input);
  // `key` covers every input that changes the picture.
  const texture = useMemo(() => createPanelTexture(input), [key]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  const front = useMemo(() => new MeshBasicMaterial({ map: texture, toneMapped: false }), [texture]);
  useEffect(
    () => () => {
      front.dispose();
    },
    [front],
  );
  // Box face order: +x, -x, +y, -y, +z, -z. Only the +z face carries the Front_Face picture.
  const side = sideMaterial(style.fill);
  const materials = useMemo(() => [side, side, side, side, front, side], [side, front]);

  const detailText = node.front.detail?.en ?? "";

  return (
    <>
      {detailText !== "" && (
        <DetailLayer
          node={node}
          text={detailText}
          fill={style.fill}
          textColor={theme.text}
          font={font}
          detailDistance={detailDistance}
        />
      )}
      <mesh
        position={[node.position.x, node.position.y, node.position.z]}
        rotation={[node.rotation.x, node.rotation.y, node.rotation.z, "XYZ"]}
        scale={[BASE_WIDTH * node.scale.x, BASE_HEIGHT * node.scale.y, BASE_THICKNESS * node.scale.z]}
        userData={{ nodeId: node.id }}
        geometry={PANEL_BOX}
        material={materials}
        {...handlers}
      >
        {selected && editMode === "edit" ? <Edges color={SELECTION_COLOR} /> : null}
      </mesh>
    </>
  );
});

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

function useImageVersion(images: ImageCache): number {
  const [version, setVersion] = useState(0);
  useEffect(
    () =>
      images.subscribe(() => {
        setVersion((v) => v + 1);
      }),
    [images],
  );
  return version;
}

/** One panel per Node of the Visible_Set, computed from the current Scenario and shown preset. */
type NodePanelsProps = { snapshot: ViewSnapshot; images: ImageCache; store: ViewStore };

/** Skips a redraw unless an input the panels use changed (a walk tick or an orbit move changes none). */
function nodePanelsUnchanged(a: NodePanelsProps, b: NodePanelsProps): boolean {
  const x = a.snapshot;
  const y = b.snapshot;
  return (
    a.store === b.store &&
    a.images === b.images &&
    x.history.present === y.history.present &&
    x.settings === y.settings &&
    x.theme === y.theme &&
    x.preview === y.preview &&
    x.view.shownPresetId === y.view.shownPresetId &&
    x.view.selection === y.view.selection &&
    x.view.editMode === y.view.editMode
  );
}

export const NodePanels = memo(function NodePanels({ snapshot, images, store }: NodePanelsProps): React.JSX.Element {
  const font = useFontState();
  const imageVersion = useImageVersion(images);
  const { history, settings, theme, view } = snapshot;
  const scenario = history.present;
  const preset = settings.presets.find((p) => p.id === view.shownPresetId) ?? settings.presets[0];
  const nodes = useMemo(() => {
    const visible = new Set(computeVisibleSet(scenario, preset.filter).nodes);
    return scenario.nodes.filter((n) => visible.has(n.id));
  }, [scenario, preset]);
  const { preview } = snapshot;

  return (
    <>
      {nodes.map((stored) => {
        // A preview pose replaces the stored one for drawing only (R-VIEW-13.4).
        const pose = preview.get(stored.id);
        const node = pose === undefined ? stored : { ...stored, ...pose };
        return (
          <NodePanel key={stored.id} node={node} theme={theme} images={images} font={font}
            imageVersion={imageVersion}
            detailDistance={settings.detailDistance}
            store={store}
            selected={view.selection?.kind === "node" && view.selection.id === stored.id}
            editMode={view.editMode}
          />
        );
      })}
    </>
  );
}, nodePanelsUnchanged);
