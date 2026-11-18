import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { Node } from "../../model/scenario-schema.ts";
import {
  clampScale,
  gizmoAxes,
  rotateCommand,
  rotationPreview,
  scaleCommand,
  type GizmoAxis,
} from "../helpers/gesture-commands.ts";
import { orbitAllowed } from "../helpers/view-state.ts";
import type { ViewSnapshot, ViewStore } from "./view-store.ts";

type Vec3 = { x: number; y: number; z: number };

/** The parts of the three.js controls that drei's types hide (they are `private` there). */
type ControlsState = {
  axis: string | null;
  rotationAngle: number;
  rotationAxis: { x: number; y: number; z: number };
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
};

type Start = {
  nodeId: string;
  rotation: Vec3;
  scale: Vec3;
  /** One entry for a rotate or scale handle the gizmo acts on, none for `E`, `XYZE`, and the like. */
  axes: GizmoAxis[];
  mode: "rotate" | "scale";
};

const copy = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

function writePose(obj: Group, node: Node): void {
  obj.position.set(node.position.x, node.position.y, node.position.z);
  obj.rotation.set(node.rotation.x, node.rotation.y, node.rotation.z, "XYZ");
  obj.scale.set(node.scale.x, node.scale.y, node.scale.z);
}

/**
 * Rotate or scale handles on the selected Node (R-VIEW-14). The handles act on a hidden proxy object that
 * has the stored pose of the Node. The drawn panel shows a preview computed by the helpers, and the History
 * changes once, when the handle is released.
 */
export function Gizmo({ store, snapshot }: { store: ViewStore; snapshot: ViewSnapshot }): React.JSX.Element | null {
  const { view, history } = snapshot;
  const node =
    view.editMode === "edit" && view.selection !== null
      ? history.present.nodes.find((n) => n.id === view.selection)
      : undefined;
  if (node === undefined) return null;
  return <GizmoFor key={node.id} node={node} mode={view.gizmoMode} store={store} />;
}

function GizmoFor({
  node,
  mode,
  store,
}: {
  node: Node;
  mode: "rotate" | "scale";
  store: ViewStore;
}): React.JSX.Element {
  const [proxy, setProxy] = useState<Group | null>(null);
  const controlsRef = useRef<ControlsState | null>(null);
  const start = useRef<Start | null>(null);
  const orbit = useThree((s) => s.controls);
  const nodeId = node.id;

  const setOrbit = (enabled: boolean): void => {
    if (orbit !== null) (orbit as unknown as { enabled: boolean }).enabled = enabled;
  };

  // Keep the proxy on the stored pose whenever no handle is held.
  const { position: p, rotation: r, scale: s } = node;
  useLayoutEffect(() => {
    if (proxy !== null && start.current === null) writePose(proxy, node);
  }, [proxy, p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z]);

  // Hover state, so a press on a handle is not also a drag of the panel behind it.
  useEffect(() => {
    const c = controlsRef.current;
    if (c === null) return undefined;
    const onAxis = (): void => {
      store.gizmoHot = c.axis !== null;
    };
    c.addEventListener("axis-changed", onAxis);
    return () => {
      c.removeEventListener("axis-changed", onAxis);
      store.gizmoHot = false;
    };
  }, [store, proxy]);

  const stored = (): Node | undefined => store.getSnapshot().history.present.nodes.find((n) => n.id === nodeId);

  const finish = (command: boolean): void => {
    const st = start.current;
    const c = controlsRef.current;
    start.current = null;
    if (st !== null && c !== null && proxy !== null) {
      const current = stored();
      if (command && current !== undefined && st.axes.length > 0) {
        const cmd =
          st.mode === "rotate"
            ? rotateCommand(current, st.axes[0], rotationDelta(c, st.axes[0]))
            : scaleCommand(current, st.axes, proxy.scale);
        if (cmd !== null) store.execute(cmd);
      }
    }
    // After `execute`, so an accepted change never flashes the old pose; a rejected one shows the stored pose.
    store.setPreview(null);
    store.setGestureActive(false);
    setOrbit(orbitAllowed(store.getSnapshot().view, false));
    const after = stored();
    if (proxy !== null && after !== undefined) writePose(proxy, after);
  };

  return (
    <>
      <group ref={setProxy} />
      {proxy !== null && (
        <TransformControls
          ref={(c: unknown) => {
            controlsRef.current = c as ControlsState | null;
          }}
          object={proxy}
          mode={mode}
          space="local"
          showX
          showY
          showZ={mode === "rotate"}
          onMouseDown={() => {
            const current = stored();
            const c = controlsRef.current;
            if (current === undefined || c === null) return;
            start.current = {
              nodeId,
              rotation: copy(current.rotation),
              scale: copy(current.scale),
              axes: gizmoAxes(mode, c.axis),
              mode,
            };
            setOrbit(false);
            store.setGestureActive(true);
          }}
          onObjectChange={() => {
            const st = start.current;
            const c = controlsRef.current;
            if (st === null || c === null || st.axes.length === 0) return;
            const current = stored();
            if (current === undefined) return;
            const pose =
              st.mode === "rotate"
                ? {
                    position: copy(current.position),
                    rotation: rotationPreview(st.rotation, st.axes[0], rotationDelta(c, st.axes[0])),
                  }
                : {
                    position: copy(current.position),
                    scale: clampScale(scaleFrom(st.scale, st.axes, proxy.scale), st.axes),
                  };
            store.setPreview(new Map([[nodeId, pose]]));
          }}
          onMouseUp={() => {
            finish(true);
          }}
        />
      )}
    </>
  );
}

/** `rotationAngle × sign(rotationAxis[c])` (design.md, Gizmo). */
function rotationDelta(c: ControlsState, axis: GizmoAxis): number {
  return c.rotationAngle * (c.rotationAxis[axis] < 0 ? -1 : 1);
}

/** The stored scale with the components in `axes` taken from the proxy object. */
function scaleFrom(stored: Vec3, axes: readonly GizmoAxis[], obj: Vec3): Vec3 {
  const out = copy(stored);
  for (const a of axes) out[a] = obj[a];
  return out;
}
