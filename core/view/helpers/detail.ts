/** Detail decision (R-VIEW-11.3). Plain data only; imports nothing. */

export type DetailPoint = { x: number; y: number; z: number };

/** `true` exactly when the 3D distance between camera and node is at most `detailDistance`. */
export function showsDetail(camera: DetailPoint, node: DetailPoint, detailDistance: number): boolean {
  return Math.hypot(camera.x - node.x, camera.y - node.y, camera.z - node.z) <= detailDistance;
}
