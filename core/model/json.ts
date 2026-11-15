export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** True for objects made by `{}` / `JSON.parse` (prototype is Object.prototype or null). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Compare two strings by Unicode code point (not UTF-16 code unit). Returns -1, 0, or 1. */
export function compareCodePoints(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.codePointAt(i) as number;
    const cb = b.codePointAt(j) as number;
    if (ca !== cb) return ca < cb ? -1 : 1;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  const restA = a.length - i;
  const restB = b.length - j;
  if (restA === restB) return 0;
  return restA < restB ? -1 : 1;
}

/**
 * Returns `null` when `value` is a JSON value, else a short fault description.
 * Faults are found in a fixed order (keys by code point, arrays by index).
 * A cycle is reported as a fault.
 */
export function checkJsonValue(value: unknown): string | null {
  const stack: unknown[] = [];
  const walk = (v: unknown): string | null => {
    if (v === null || typeof v === "boolean" || typeof v === "string") return null;
    if (typeof v === "number") return Number.isFinite(v) ? null : "number is not finite";
    if (typeof v !== "object") return `${typeof v} is not a JSON value`;
    if (stack.includes(v)) return "cycle";
    if (!Array.isArray(v) && !isPlainObject(v)) return "not a plain object";
    stack.push(v);
    try {
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (!(i in v)) return "array has a hole";
          const fault = walk(v[i] as unknown);
          if (fault !== null) return fault;
        }
      } else {
        for (const key of Object.keys(v).sort(compareCodePoints)) {
          const fault = walk(v[key]);
          if (fault !== null) return fault;
        }
      }
    } finally {
      stack.pop();
    }
    return null;
  };
  return walk(value);
}

/**
 * Canonical JSON text: keys sorted by code point, 2-space indent, `undefined` values skipped,
 * `-0` written as `0`, exactly one trailing newline. Never assigns a `__proto__` key.
 * The input must pass `checkJsonValue`-like rules (finite numbers, plain data).
 */
export function canonicalJson(value: unknown): string {
  return `${write(value, "")}\n`;
}

function write(value: unknown, indent: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Object.is(value, -0) ? "0" : JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item: unknown) => `${inner}${write(item === undefined ? null : item, inner)}`);
    return `[\n${items.join(",\n")}\n${indent}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(compareCodePoints);
    if (keys.length === 0) return "{}";
    const items = keys.map((k) => `${inner}${JSON.stringify(k)}: ${write(obj[k], inner)}`);
    return `{\n${items.join(",\n")}\n${indent}}`;
  }
  throw new TypeError("value cannot be written as JSON");
}
