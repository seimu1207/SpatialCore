import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { Vector3 } from "three";
import { ndcToPixels } from "../helpers/connect-ui.ts";
import type { ViewStore } from "./view-store.ts";

/** Pointer position in pixels inside the view container, written by the wrapper and read each frame. */
export type PointerRef = RefObject<{ x: number; y: number } | null>;

const scratch = new Vector3();

/** The SVG layer over the canvas. Its line is moved by `ConnectProjector` (R-VIEW-15.6). */
export function ConnectOverlay({ lineRef }: { lineRef: RefObject<SVGLineElement | null> }): React.JSX.Element {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden="true"
    >
      <line ref={lineRef} visibility="hidden" stroke="#ffd400" strokeWidth={2} strokeDasharray="6 4" />
    </svg>
  );
}

/** Inside the Canvas: while `connect.first` is set, draws the line from its screen projection to the pointer. */
export function ConnectProjector({
  store,
  lineRef,
  pointerRef,
}: {
  store: ViewStore;
  lineRef: RefObject<SVGLineElement | null>;
  pointerRef: PointerRef;
}): null {
  useFrame((state) => {
    const line = lineRef.current;
    if (line === null) return;
    const snap = store.getSnapshot();
    const first = snap.view.connect?.first ?? null;
    const node = first === null ? undefined : snap.history.present.nodes.find((n) => n.id === first);
    if (node === undefined) {
      // No DOM write while it is already hidden (the usual case).
      if (line.getAttribute("visibility") !== "hidden") line.setAttribute("visibility", "hidden");
      return;
    }
    const pose = snap.preview.get(node.id);
    const p = pose?.position ?? node.position;
    scratch.set(p.x, p.y, p.z).project(state.camera);
    const from = ndcToPixels(scratch, state.size.width, state.size.height);
    const to = pointerRef.current ?? from;
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.setAttribute("visibility", "visible");
  });
  return null;
}
