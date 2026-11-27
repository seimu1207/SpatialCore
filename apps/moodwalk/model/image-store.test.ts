import { describe, expect, it } from "vitest";
import { createHistory, executeCommand, redo, undo, type History } from "../../../core/model/history.ts";
import type { Node, Scenario } from "../../../core/model/scenario-schema.ts";
import { ImageStore, referencesIn } from "./image-store.ts";

function image(id: string, reference: string): Node {
  return {
    id,
    type: "image",
    position: { x: 0, y: 1.3, z: 0 },
    rotation: { x: 0, y: Math.PI, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    front: { image: reference },
    zone: "z0",
    metadata: {},
    attributes: { brightness: 0.5, temperature: 0 },
  };
}

const EMPTY: Scenario = {
  schemaVersion: 1,
  id: "b",
  title: { en: "Board" },
  zones: [
    { id: "z0", label: { en: "Zone 0" }, order: 0, elevation: 0, enclosed: false },
    { id: "z1", label: { en: "Zone 1" }, order: 1, elevation: 0, enclosed: false },
  ],
  nodes: [],
  edges: [],
};

function start(limit?: number): History {
  const r = createHistory(EMPTY, limit);
  if (!r.ok) throw new Error("history");
  return r.history;
}

function add(h: History, id: string, reference: string): History {
  const r = executeCommand(h, { kind: "addNode", node: image(id, reference) });
  if (!r.ok) throw new Error("add");
  return r.history;
}

function storeWith(references: string[]): { store: ImageStore; released: string[] } {
  const released: string[] = [];
  const store = new ImageStore((u) => released.push(u));
  for (const r of references) store.put(r, `blob:${r}`);
  return { store, released };
}

describe("referencesIn", () => {
  it("collects references from past, present, and future", () => {
    let h = add(add(start(), "a", "upload:1"), "b", "upload:2");
    h = undo(h);
    h = undo(h);
    h = redo(h);
    expect(h.past.length).toBe(1);
    expect(h.future.length).toBe(1);
    expect([...referencesIn(h)].sort()).toStrictEqual(["upload:1", "upload:2"]);
  });
});

describe("ImageStore (R-APP2-04.11, 15.6)", () => {
  it("url returns null for an unknown reference", () => {
    const { store } = storeWith(["upload:1"]);
    expect(store.url("upload:1")).toBe("blob:upload:1");
    expect(store.url("upload:9")).toBeNull();
  });

  it("remove releases once", () => {
    const { store, released } = storeWith(["upload:1"]);
    store.remove("upload:1");
    store.remove("upload:1");
    expect(released).toStrictEqual(["blob:upload:1"]);
    expect(store.url("upload:1")).toBeNull();
  });

  it("keeps an entry through add, undo, and redo", () => {
    const { store, released } = storeWith(["upload:1"]);
    let h = add(start(), "a", "upload:1");
    expect(store.prune(h)).toStrictEqual([]);
    h = undo(h);
    expect(store.prune(h)).toStrictEqual([]);
    h = redo(h);
    expect(store.prune(h)).toStrictEqual([]);
    expect(released).toStrictEqual([]);
  });

  it("releases an entry no Scenario refers to", () => {
    const { store, released } = storeWith(["upload:1", "sample:lamp"]);
    const h = add(start(), "a", "upload:1");
    expect(store.prune(h)).toStrictEqual(["sample:lamp"]);
    expect(released).toStrictEqual(["blob:sample:lamp"]);
    expect(store.prune(h)).toStrictEqual([]);
    expect(released.length).toBe(1);
  });

  it("releases after a new command clears the future", () => {
    const { store, released } = storeWith(["upload:1"]);
    let h = add(start(), "a", "upload:1");
    h = undo(h);
    expect(store.prune(h)).toStrictEqual([]);
    store.put("upload:2", "blob:upload:2");
    h = add(h, "b", "upload:2");
    expect(h.future.length).toBe(0);
    expect(store.prune(h)).toStrictEqual(["upload:1"]);
    expect(released).toStrictEqual(["blob:upload:1"]);
  });

  it("releases after the History limit drops the oldest Scenario", () => {
    const { store, released } = storeWith(["upload:1"]);
    let h = add(start(1), "a", "upload:1");
    const removed = executeCommand(h, { kind: "removeNode", id: "a" });
    if (!removed.ok) throw new Error("remove");
    h = removed.history;
    // past still holds the Scenario with the node
    expect(store.prune(h)).toStrictEqual([]);
    h = add(h, "b", "sample:other");
    // limit 1: past now holds the empty Scenario, so no Scenario refers to upload:1
    expect(h.past.length).toBe(1);
    expect(store.prune(h)).toStrictEqual(["upload:1"]);
    expect(released).toStrictEqual(["blob:upload:1"]);
    expect(store.url("upload:1")).toBeNull();
  });
});
