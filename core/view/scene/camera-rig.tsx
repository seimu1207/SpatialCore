import { OrbitControls } from "@react-three/drei";
import { useSyncExternalStore } from "react";
import { orbitAllowed } from "../helpers/view-state.ts";
import type { ViewStore } from "./view-store.ts";

/** Orbit controls, on only when nothing else moves the camera (R-VIEW-08.9). */
export function CameraRig({ store }: { store: ViewStore }): React.JSX.Element {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return <OrbitControls makeDefault minDistance={0.1} enabled={orbitAllowed(snap.view, store.gestureActive)} />;
}
