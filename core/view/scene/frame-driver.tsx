import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { connectCommand } from "../helpers/gesture-commands.ts";
import type { CameraPose } from "../helpers/settings-schema.ts";
import { cameraFor } from "../helpers/view-state.ts";
import type { ViewStore } from "./view-store.ts";

const MAX_DT = 0.25;

const ZERO = { x: 0, y: 0, z: 0 };

type Target = { set(x: number, y: number, z: number): unknown; x: number; y: number; z: number };
type OrbitLike = { target: Target; update(): unknown };

/** Per frame: tick, then cameraFor, then cameraApplied, then flush (design.md D11). */
export function FrameDriver({ store }: { store: ViewStore }): null {
  const reported = useMemo<CameraPose>(
    () => ({ position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } }),
    [],
  );
  const controls = useThree((s) => s.controls) as OrbitLike | null;

  useFrame((state, delta) => {
    if (store.isStopped) return;
    store.dispatch({ type: "tick", dt: Math.min(delta, MAX_DT) });

    const view = store.getSnapshot().view;
    const pose = cameraFor(view);
    const camera = state.camera;
    if (pose !== null) {
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      if (controls !== null) {
        controls.target.set(pose.target.x, pose.target.y, pose.target.z);
        controls.update();
      } else {
        camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      }
      if (view.cameraOnce !== null) store.dispatch({ type: "cameraApplied" });
    }

    // One pose object, rewritten each frame: the store only reads it when a preset move starts (which copies it).
    const t = controls?.target ?? pose?.target ?? ZERO;
    reported.position.x = camera.position.x;
    reported.position.y = camera.position.y;
    reported.position.z = camera.position.z;
    reported.target.x = t.x;
    reported.target.y = t.y;
    reported.target.z = t.z;
    store.reportCamera(reported);

    store.flush();
    for (const c of store.takeConnects()) {
      store.execute(connectCommand(store.getSnapshot().history.present, c.from, c.to, c.edgeType));
    }
  });
  return null;
}
