import type { LocalizedText } from "../../../core/model/scenario-schema.ts";
import type { MoodCurve } from "./shift-check.ts";
import { ATTR_BRIGHTNESS, ATTR_TEMPERATURE } from "./names.ts";

/** Curve_Panel geometry (design.md "UI and Curve_Panel", M18, M19). Pure; no DOM. */

export const CURVE_PAD = 24;

export type CurveTag = "entrance" | "exit" | null;

export type CurveZoneLabel = {
  zone: string;
  x: number;
  label: LocalizedText;
  tag: CurveTag;
};

export type CurvePoint = {
  zone: string;
  x: number;
  y: number;
  /** True value, not clamped. */
  value: number;
  /** Pointer text with the true value. */
  text: string;
};

export type CurveEmptyPlace = { zone: string; x: number; y: number };

export type CurveChart = {
  attribute: string;
  /** Display range: `min` is drawn at the bottom, `max` at the top. */
  range: { min: number; max: number };
  points: CurvePoint[];
  /** `"x,y"` pairs of the points in rank order, for an SVG polyline. */
  polyline: string;
  noData: CurveEmptyPlace[];
};

export type CurveLayout = {
  width: number;
  height: number;
  pad: number;
  labels: CurveZoneLabel[];
  charts: CurveChart[];
};

function range(attribute: string): { min: number; max: number } {
  return attribute === ATTR_TEMPERATURE ? { min: -0.5, max: 0.5 } : { min: 0, max: 1 };
}

function fixed2(value: number): string {
  const s = value.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
}

function pointerText(attribute: string, zoneLabel: string, value: number): string {
  if (attribute === ATTR_BRIGHTNESS) return `${zoneLabel}: brightness ${fixed2(value)}`;
  const v = fixed2(value);
  return `${zoneLabel}: warmth ${v.startsWith("-") ? v : `+${v}`}`;
}

function yOf(value: number, r: { min: number; max: number }, height: number, pad: number): number {
  const clamped = Math.min(r.max, Math.max(r.min, value));
  const t = (clamped - r.min) / (r.max - r.min);
  return pad + (1 - t) * (height - 2 * pad);
}

export function curveLayout(curve: MoodCurve, width: number, height: number): CurveLayout {
  const pad = CURVE_PAD;
  const zones = [...curve.zones].sort((a, b) => a.order - b.order);
  const n = zones.length;
  const xs = new Map<string, number>();
  const labelOf = new Map<string, string>();
  zones.forEach((z, rank) => {
    xs.set(z.id, pad + (rank * (width - 2 * pad)) / Math.max(1, n - 1));
    labelOf.set(z.id, z.label.en);
  });
  const rankOf = new Map(zones.map((z, i) => [z.id, i]));

  const labels: CurveZoneLabel[] = zones.map((z, rank) => ({
    zone: z.id,
    x: xs.get(z.id) ?? pad,
    label: z.label,
    tag: rank === 0 ? "entrance" : rank === n - 1 ? "exit" : null,
  }));

  const charts: CurveChart[] = curve.attributes.map((a) => {
    const r = range(a.attribute);
    const points: CurvePoint[] = [...a.series]
      .filter((s) => rankOf.has(s.zone))
      .sort((p, q) => (rankOf.get(p.zone) ?? 0) - (rankOf.get(q.zone) ?? 0))
      .map((s) => ({
        zone: s.zone,
        x: xs.get(s.zone) ?? pad,
        y: yOf(s.value, r, height, pad),
        value: s.value,
        text: pointerText(a.attribute, labelOf.get(s.zone) ?? s.zone, s.value),
      }));
    const noData: CurveEmptyPlace[] = a.noData
      .filter((id) => rankOf.has(id))
      .sort((p, q) => (rankOf.get(p) ?? 0) - (rankOf.get(q) ?? 0))
      .map((id) => ({ zone: id, x: xs.get(id) ?? pad, y: height - pad }));
    return {
      attribute: a.attribute,
      range: r,
      points,
      polyline: points.map((p) => `${p.x},${p.y}`).join(" "),
      noData,
    };
  });

  return { width, height, pad, labels, charts };
}
