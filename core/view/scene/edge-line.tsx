import { Billboard, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useState } from "react";
import { CanvasTexture, DoubleSide, Euler, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { compareCodePoints } from "../../model/json.ts";
import type { Edge, Node, Scenario } from "../../model/scenario-schema.ts";
import { edgeClickAction } from "../helpers/connect-ui.ts";
import { edgeMidpoint, edgeOffsets, loopSizes } from "../helpers/edge-layout.ts";
import type { ViewSettings } from "../helpers/settings-schema.ts";
import { edgeStyleFor, type Theme } from "../helpers/theme-schema.ts";
import { computeVisibleSet } from "../helpers/visibility.ts";
import { FONT_FAMILY, fontState, loadFont, type FontState } from "./font.ts";
import { SELECTION_COLOR } from "./node-panel.tsx";
import type { NodePoses, ViewSnapshot, ViewStore } from "./view-store.ts";

const CURVE_SEGMENTS = 24;
const HALF_WIDTH = 0.8;
const HALF_HEIGHT = 0.6;
const LABEL_CANVAS_WIDTH = 512;
const LABEL_CANVAS_HEIGHT = 128;
const LABEL_WIDTH = 1.2;
const LABEL_LIFT = 0.12;

type Tuple3 = [number, number, number];

export type { NodePose, NodePoses } from "./view-store.ts";

type Frame = { center: Vector3; quat: Quaternion; hx: number; hy: number };

function frameOf(node: Node, poses: NodePoses | undefined): Frame {
  const pose = poses?.get(node.id);
  const p = pose?.position ?? node.position;
  const r = pose?.rotation ?? node.rotation;
  const s = pose?.scale ?? node.scale;
  return {
    center: new Vector3(p.x, p.y, p.z),
    quat: new Quaternion().setFromEuler(new Euler(r.x, r.y, r.z, "XYZ")),
    hx: HALF_WIDTH * s.x,
    hy: HALF_HEIGHT * s.y,
  };
}

/** True when `point` lies inside the panel rectangle in the panel's local frame. */
function insidePanel(frame: Frame, point: Vector3): boolean {
  const local = point.clone().sub(frame.center).applyQuaternion(frame.quat.clone().invert());
  return Math.abs(local.x) <= frame.hx && Math.abs(local.y) <= frame.hy;
}

function bezier(a: Vector3, c: Vector3, b: Vector3, t: number): Vector3 {
  const u = 1 - t;
  return a
    .clone()
    .multiplyScalar(u * u)
    .addScaledVector(c, 2 * u * t)
    .addScaledVector(b, t * t);
}

function bezierTangent(a: Vector3, c: Vector3, b: Vector3, t: number): Vector3 {
  const d = c
    .clone()
    .sub(a)
    .multiplyScalar(2 * (1 - t))
    .addScaledVector(b.clone().sub(c), 2 * t);
  return d.lengthSq() > 0 ? d.normalize() : b.clone().sub(a).normalize();
}

/** Parameter where the curve leaves a panel, by bisection. `fromStart` searches t from 0 up, else from 1 down. */
function exitParameter(curve: (t: number) => Vector3, frame: Frame, fromStart: boolean): number {
  let inside = fromStart ? 0 : 1;
  let outside = fromStart ? 1 : 0;
  if (!insidePanel(frame, curve(inside))) return inside;
  if (insidePanel(frame, curve(outside))) return outside;
  for (let i = 0; i < 30; i++) {
    const mid = (inside + outside) / 2;
    if (insidePanel(frame, curve(mid))) inside = mid;
    else outside = mid;
  }
  return outside;
}

type Drawn = {
  points: Tuple3[];
  tip: Tuple3;
  dir: Tuple3;
  arrowLength: number;
  labelAt: Tuple3;
};

const tuple = (v: Vector3): Tuple3 => [v.x, v.y, v.z];

function arrowLengthFor(width: number): number {
  return Math.max(0.12, 4 * width);
}

/** Curve between two Nodes, cut at the panel borders, with the line ending at the arrow base. */
function layoutCurve(from: Node, to: Node, offset: number, width: number, poses: NodePoses | undefined): Drawn | null {
  const fromFrame = frameOf(from, poses);
  const toFrame = frameOf(to, poses);
  // Canonical frame: A is the end with the smaller id (R-VIEW-05.5).
  const fromIsA = compareCodePoints(from.id, to.id) <= 0;
  const aFrame = fromIsA ? fromFrame : toFrame;
  const bFrame = fromIsA ? toFrame : fromFrame;
  const a = aFrame.center;
  const b = bFrame.center;
  const mid = edgeMidpoint(a, b, offset);
  const mid0 = edgeMidpoint(a, b, 0);
  const control = new Vector3(2 * mid.x - mid0.x, 2 * mid.y - mid0.y, 2 * mid.z - mid0.z);
  // Draw from `from` to `to`.
  const start = fromIsA ? a : b;
  const end = fromIsA ? b : a;
  const curve = (t: number): Vector3 => (fromIsA ? bezier(start, control, end, t) : bezier(end, control, start, 1 - t));
  const t0 = exitParameter(curve, fromFrame, true);
  const t1 = exitParameter(curve, toFrame, false);
  if (!(t1 > t0)) return null;

  const tipPoint = curve(t1);
  const dir = (fromIsA ? bezierTangent(start, control, end, t1) : bezierTangent(end, control, start, 1 - t1).negate())
    .clone()
    .normalize();
  const length = Math.min(arrowLengthFor(width), tipPoint.distanceTo(curve(t0)));
  const base = tipPoint.clone().addScaledVector(dir, -length);
  const points: Tuple3[] = [];
  for (let i = 0; i < CURVE_SEGMENTS; i++) points.push(tuple(curve(t0 + ((t1 - t0) * i) / CURVE_SEGMENTS)));
  points.push(tuple(base));
  return { points, tip: tuple(tipPoint), dir: tuple(dir), arrowLength: length, labelAt: [mid.x, mid.y, mid.z] };
}

/** Circle tangent to the top edge from outside, in the panel's local frame; the arrow ends on the edge. */
function layoutLoop(node: Node, radius: number, width: number, poses: NodePoses | undefined): Drawn {
  const frame = frameOf(node, poses);
  const length = Math.min(arrowLengthFor(width), 2 * radius);
  const delta = 2 * Math.asin(Math.min(1, length / (2 * radius)));
  const cy = frame.hy + radius;
  const at = (angle: number): Vector3 => new Vector3(radius * Math.cos(angle), cy + radius * Math.sin(angle), 0);
  const a0 = -Math.PI / 2;
  const a1 = (3 * Math.PI) / 2 - delta;
  const points: Tuple3[] = [];
  for (let i = 0; i <= CURVE_SEGMENTS; i++) points.push(tuple(at(a0 + ((a1 - a0) * i) / CURVE_SEGMENTS)));
  const tip = new Vector3(0, frame.hy, 0);
  const dir = tip.clone().sub(at(a1)).normalize();
  return {
    points,
    tip: tuple(tip),
    dir: tuple(dir),
    arrowLength: tip.distanceTo(at(a1)),
    labelAt: [0, frame.hy + 2 * radius, 0],
  };
}

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

function EdgeLabel({ text, color, at }: { text: string; color: string; at: Tuple3 }): React.JSX.Element {
  const texture = useMemo(() => createLabelTexture(text, color), [text, color]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  return (
    <Billboard position={[at[0], at[1] + LABEL_LIFT, at[2]]}>
      <mesh>
        <planeGeometry args={[LABEL_WIDTH, LABEL_WIDTH * (LABEL_CANVAS_HEIGHT / LABEL_CANVAS_WIDTH)]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
    </Billboard>
  );
}

/** Width of the invisible hit line in screen px (design.md D20). */
const HIT_LINE_WIDTH = 12;

/**
 * Click on an Edge (R-VIEW-23.1). Notes from the installed @react-three/fiber (dist/events-*.cjs.dev.js):
 * - `e.delta` is `round(hypot(offsetX - initialX, offsetY - initialY))` in canvas CSS px, where the initial point is
 *   stored on every canvas `pointerdown`, handler or not. So an Edge needs no `onPointerDown`.
 * - `onClick` runs from the canvas `click` event; R3F raycasts every object that has a handler and its descendants,
 *   and three's Raycaster does not look at `visible`. A Line2 with `worldUnits` false only needs a camera and a
 *   non-zero `material.resolution`, which drei sets from the canvas size. So the hit line can be `visible={false}`
 *   (drei passes it to the object and the material). Fallback if it ever gets no click: `material.visible = false`.
 */
function edgeClickHandler(store: ViewStore, edgeId: string) {
  return (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    if (e.delta > 5) return;
    const view = store.getSnapshot().view;
    if (edgeClickAction(view.editMode, view.connect !== null) === "select") {
      store.dispatch({ type: "select", selection: { kind: "edge", id: edgeId } });
    } else {
      store.emptyClick();
    }
  };
}

const Drawing = memo(function Drawing({
  drawn,
  edge,
  theme,
  font,
  store,
  selected,
}: {
  drawn: Drawn;
  edge: Edge;
  theme: Theme;
  font: FontState;
  store: ViewStore;
  selected: boolean;
}): React.JSX.Element {
  const style = edgeStyleFor(theme, edge.type);
  const width = selected ? 2 * style.width : style.width;
  const color = selected ? SELECTION_COLOR : style.color;
  // The hit line runs along the curve and includes the arrow tip.
  const hitPoints = useMemo(() => [...drawn.points, drawn.tip], [drawn]);
  const onClick = useMemo(() => edgeClickHandler(store, edge.id), [store, edge.id]);
  const { quat, center } = useMemo(() => {
    const d = new Vector3(...drawn.dir);
    return {
      quat: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d),
      center: new Vector3(...drawn.tip).addScaledVector(d, -drawn.arrowLength / 2),
    };
  }, [drawn]);
  const label = edge.label?.en ?? "";
  return (
    <>
      <group onClick={onClick}>
        <Line
          points={drawn.points}
          color={color}
          lineWidth={width}
          worldUnits
          dashed={style.dashed}
          dashSize={0.2}
          gapSize={0.12}
        />
        <mesh position={center} quaternion={quat}>
          <coneGeometry args={[Math.max(width * 1.5, drawn.arrowLength * 0.3), drawn.arrowLength, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <Line points={hitPoints} color={color} lineWidth={HIT_LINE_WIDTH} worldUnits={false} visible={false} />
      </group>
      {font === "ready" && label !== "" ? <EdgeLabel text={label} color={theme.text} at={drawn.labelAt} /> : null}
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

const LoopDrawing = memo(function LoopDrawing({
  node,
  edge,
  radius,
  theme,
  font,
  poses,
  store,
  selected,
}: {
  node: Node;
  edge: Edge;
  radius: number;
  theme: Theme;
  font: FontState;
  poses: NodePoses | undefined;
  store: ViewStore;
  selected: boolean;
}): React.JSX.Element {
  const width = edgeStyleFor(theme, edge.type).width;
  const frame = useMemo(() => frameOf(node, poses), [node, poses]);
  const drawn = useMemo(() => layoutLoop(node, radius, width, poses), [node, radius, width, poses]);
  return (
    <group position={frame.center} quaternion={frame.quat}>
      <Drawing drawn={drawn} edge={edge} theme={theme} font={font} store={store} selected={selected} />
    </group>
  );
});

/** World-space points of the drawn curve of an Edge (a loop included), for the fog tube (D14). */
export function drawnEdgePoints(
  scenario: Scenario,
  edge: Edge,
  offset: number,
  loopRadius: number | undefined,
  theme: Theme,
  poses?: NodePoses,
): Tuple3[] | null {
  const from = scenario.nodes.find((n) => n.id === edge.from);
  const to = scenario.nodes.find((n) => n.id === edge.to);
  if (from === undefined || to === undefined) return null;
  const width = edgeStyleFor(theme, edge.type).width;
  if (edge.from === edge.to) {
    if (loopRadius === undefined) return null;
    const frame = frameOf(from, poses);
    return layoutLoop(from, loopRadius, width, poses).points.map((p) =>
      tuple(new Vector3(...p).applyQuaternion(frame.quat).add(frame.center)),
    );
  }
  return layoutCurve(from, to, offset, width, poses)?.points ?? null;
}

function visibleEdgesOf(
  scenario: Scenario,
  settings: ViewSettings,
  shownPresetId: string,
): { edges: Edge[]; ids: string[] } {
  const preset = settings.presets.find((p) => p.id === shownPresetId) ?? settings.presets[0];
  const ids = computeVisibleSet(scenario, preset.filter).edges;
  const wanted = new Set(ids);
  return { edges: scenario.edges.filter((e) => wanted.has(e.id)), ids };
}

type EdgeProps = { snapshot: ViewSnapshot; poses?: NodePoses; store: ViewStore };

/** Skips a redraw unless an input the Edges use changed (a walk tick or an orbit move changes none). */
function edgeLinesUnchanged(a: EdgeProps, b: EdgeProps): boolean {
  return (
    a.store === b.store &&
    a.poses === b.poses &&
    a.snapshot.history.present === b.snapshot.history.present &&
    a.snapshot.settings === b.snapshot.settings &&
    a.snapshot.theme === b.snapshot.theme &&
    a.snapshot.view.shownPresetId === b.snapshot.view.shownPresetId &&
    a.snapshot.view.selection === b.snapshot.view.selection &&
    a.snapshot.view.editMode === b.snapshot.view.editMode
  );
}

type EdgeItem = { kind: "loop"; node: Node; radius: number } | { kind: "curve"; drawn: Drawn };

function layoutEdge(
  edge: Edge,
  nodes: ReadonlyMap<string, Node>,
  offsets: ReadonlyMap<string, number>,
  loops: ReadonlyMap<string, number>,
  theme: Theme,
  poses: NodePoses | undefined,
): EdgeItem | null {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (from === undefined || to === undefined) return null;
  if (edge.from === edge.to) {
    const radius = loops.get(edge.id);
    return radius === undefined ? null : { kind: "loop", node: from, radius };
  }
  const drawn = layoutCurve(from, to, offsets.get(edge.id) ?? 0, edgeStyleFor(theme, edge.type).width, poses);
  return drawn === null ? null : { kind: "curve", drawn };
}

/** One curve, arrow head, and optional label per visible Edge, or a loop for a self-edge (R-VIEW-05). */
export const EdgeLines = memo(function EdgeLines({ snapshot, poses, store }: EdgeProps): React.JSX.Element {
  const font = useFontState();
  const selection = snapshot.view.selection;
  const selectedEdgeId = selection?.kind === "edge" ? selection.id : null;
  const scenario = snapshot.history.present;
  const { theme, settings } = snapshot;
  const shownPresetId = snapshot.view.shownPresetId;
  const { edges, ids } = useMemo(
    () => visibleEdgesOf(scenario, settings, shownPresetId),
    [scenario, settings, shownPresetId],
  );
  const offsets = useMemo(() => edgeOffsets(scenario, ids, theme), [scenario, ids, theme]);
  const loops = useMemo(() => loopSizes(scenario, ids), [scenario, ids]);
  const nodes = useMemo(() => new Map(scenario.nodes.map((n) => [n.id, n])), [scenario]);

  // Layout without a preview, kept while the camera moves. Only Edges that touch a previewed Node are laid out again.
  const base = useMemo(
    () => edges.map((edge) => layoutEdge(edge, nodes, offsets, loops, theme, undefined)),
    [edges, nodes, offsets, loops, theme],
  );

  return (
    <>
      {edges.map((edge, i) => {
        const touched = poses !== undefined && (poses.has(edge.from) || poses.has(edge.to));
        const item = touched ? layoutEdge(edge, nodes, offsets, loops, theme, poses) : base[i];
        if (item === null) return null;
        if (item.kind === "loop") {
          return (
            <LoopDrawing
              key={edge.id}
              node={item.node}
              edge={edge}
              radius={item.radius}
              theme={theme}
              font={font}
              poses={touched ? poses : undefined}
              store={store}
              selected={edge.id === selectedEdgeId}
            />
          );
        }
        return (
          <Drawing
            key={edge.id}
            drawn={item.drawn}
            edge={edge}
            theme={theme}
            font={font}
            store={store}
            selected={edge.id === selectedEdgeId}
          />
        );
      })}
    </>
  );
}, edgeLinesUnchanged);
