import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../core/model/commands.ts";
import { createHistory, executeCommand, undo } from "../../../core/model/history.ts";
import type { Node, Scenario, Zone } from "../../../core/model/scenario-schema.ts";
import {
  addImageCommand,
  addZoneCommand,
  checkImageFile,
  classifyMove,
  newImageId,
  newZone,
  removeImageCommand,
  removeZoneCheck,
} from "./commands.ts";
import { boardArb } from "./arbitraries.ts";
import { footprintAt, routeFootprints } from "./layout.ts";

function zone(i: number): Zone {
  return { id: `z${i}`, label: { en: `Zone ${i}` }, order: i, elevation: 0, enclosed: false };
}

function image(id: string, zoneId: string, x = 0, z = 0): Node {
  return {
    id,
    type: "image",
    position: { x, y: 1.3, z },
    rotation: { x: 0, y: Math.PI, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    front: { image: "sample:lamp" },
    zone: zoneId,
    metadata: {},
    attributes: { brightness: 0.5, temperature: 0 },
  };
}

function board(zoneCount: number, nodes: Node[] = []): Scenario {
  return {
    schemaVersion: 1,
    id: "b",
    title: { en: "Board" },
    zones: Array.from({ length: zoneCount }, (_, i) => zone(i)),
    nodes,
    edges: [],
  };
}

const MB10 = 10_485_760;

describe("checkImageFile (R-APP2-04.3 to 04.5)", () => {
  it("accepts the size limit and rejects one byte more", () => {
    expect(checkImageFile({ name: "a.png", type: "image/png", size: MB10 }, 0)).toStrictEqual({ ok: true });
    expect(checkImageFile({ name: "a.png", type: "image/png", size: MB10 + 1 }, 0)).toStrictEqual({
      ok: false,
      reason: "size",
    });
  });

  it("accepts 49 images and rejects 50", () => {
    const f = { name: "a.png", type: "image/png", size: 1 };
    expect(checkImageFile(f, 49).ok).toBe(true);
    expect(checkImageFile(f, 50)).toStrictEqual({ ok: false, reason: "limit" });
  });

  it("accepts png, jpeg, and webp and rejects gif", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(checkImageFile({ name: "a", type, size: 1 }, 0).ok).toBe(true);
    }
    expect(checkImageFile({ name: "a.gif", type: "image/gif", size: 1 }, 0)).toStrictEqual({
      ok: false,
      reason: "format",
    });
  });

  it("rejects a .webp name with an empty type as format", () => {
    expect(checkImageFile({ name: "a.webp", type: "", size: 1 }, 0)).toStrictEqual({ ok: false, reason: "format" });
  });

  it("reports format before size before limit", () => {
    expect(checkImageFile({ name: "a", type: "image/gif", size: MB10 + 1 }, 50)).toStrictEqual({
      ok: false,
      reason: "format",
    });
    expect(checkImageFile({ name: "a", type: "image/png", size: MB10 + 1 }, 50)).toStrictEqual({
      ok: false,
      reason: "size",
    });
  });
});

describe("ids and new zones (M17)", () => {
  it("newImageId and newZone pick the smallest unused k", () => {
    const s = board(2, [image("image-1", "z0"), image("image-3", "z0")]);
    expect(newImageId(s)).toBe("image-2");
    const withZones = { ...s, zones: [...s.zones, { ...zone(2), id: "zone-1" }, { ...zone(3), id: "zone-3" }] };
    const z = newZone(withZones);
    expect(z.id).toBe("zone-2");
    expect(z.label.en).toBe("New zone 2");
    expect(z.order).toBe(4);
    expect(z.elevation).toBe(0);
    expect(z.enclosed).toBe(false);
  });
});

describe("addImageCommand (R-APP2-04.2, 04.7)", () => {
  const s = board(3);
  const fps = routeFootprints(s.zones);
  const input = { reference: "upload:1", zone: "z1", mood: { brightness: 0.4, temperature: -0.2 } };

  it("builds one addNode that applies and holds no file name", () => {
    const cmd = addImageCommand(s, input, fps);
    expect(cmd?.kind).toBe("addNode");
    if (cmd === null || cmd.kind !== "addNode") return;
    expect(cmd.node.type).toBe("image");
    expect(cmd.node.zone).toBe("z1");
    expect(cmd.node.rotation).toStrictEqual({ x: 0, y: Math.PI, z: 0 });
    expect(cmd.node.front).toStrictEqual({ image: "upload:1" });
    expect(cmd.node.attributes).toStrictEqual({ brightness: 0.4, temperature: -0.2 });
    expect(applyCommand(s, cmd).ok).toBe(true);
  });

  it("uses the next free slot when the first is taken", () => {
    const first = addImageCommand(s, input, fps);
    if (first === null || first.kind !== "addNode") throw new Error("expected addNode");
    const s2 = { ...s, nodes: [first.node] };
    const second = addImageCommand(s2, input, fps);
    if (second === null || second.kind !== "addNode") throw new Error("expected addNode");
    expect(second.node.position).not.toStrictEqual(first.node.position);
    expect(second.node.id).toBe("image-2");
  });

  it("writes only brightness under brightnessOnly", () => {
    const cmd = addImageCommand(s, input, fps, { brightnessOnly: true });
    if (cmd === null || cmd.kind !== "addNode") throw new Error("expected addNode");
    expect(cmd.node.attributes).toStrictEqual({ brightness: 0.4 });
  });

  it("returns null for an unknown Zone", () => {
    expect(addImageCommand(s, { ...input, zone: "nope" }, fps)).toBeNull();
  });
});

describe("addZoneCommand (R-APP2-03.6)", () => {
  it("adds a Zone with the next larger order and a unique id", () => {
    const s = board(3);
    const cmd = addZoneCommand(s);
    expect(cmd.kind).toBe("addZone");
    if (cmd.kind !== "addZone") return;
    expect(cmd.zone.order).toBe(3);
    expect(cmd.zone.id).toBe("zone-1");
    expect(applyCommand(s, cmd).ok).toBe(true);
  });
});

describe("removeZoneCheck (R-APP2-03.7, 03.8)", () => {
  it("refuses a Zone with images", () => {
    const s = board(3, [image("image-1", "z1")]);
    expect(removeZoneCheck(s, "z1")).toStrictEqual({ ok: false, reason: "has-images" });
  });

  it("refuses when the Board has 2 Zones", () => {
    expect(removeZoneCheck(board(2), "z1")).toStrictEqual({ ok: false, reason: "too-few-zones" });
  });

  it("removes an empty Zone of a 3-Zone Board", () => {
    expect(removeZoneCheck(board(3), "z2")).toStrictEqual({
      ok: true,
      command: { kind: "removeZone", id: "z2" },
    });
  });

  it("refuses an unknown Zone", () => {
    expect(removeZoneCheck(board(3), "nope")).toStrictEqual({ ok: false, reason: "unknown" });
  });
});

describe("removeImageCommand (R-APP2-05.2)", () => {
  it("removes an image Node and returns null otherwise", () => {
    const other = { ...image("t-1", "z0"), type: "text" };
    const s = board(2, [image("image-1", "z0"), other]);
    expect(removeImageCommand(s, "image-1")).toStrictEqual({ kind: "removeNode", id: "image-1" });
    expect(removeImageCommand(s, "t-1")).toBeNull();
    expect(removeImageCommand(s, "nope")).toBeNull();
  });
});

describe("classifyMove (R-APP2-05.3, 05.4)", () => {
  const before = board(3, [image("image-1", "z0", -1.5, 1.5)]);
  const fps = routeFootprints(before.zones);
  const moved = (x: number, z: number): Scenario => ({
    ...before,
    nodes: [{ ...before.nodes[0], position: { x, y: 1.3, z } }],
  });

  it("is none for a move inside the own Zone", () => {
    expect(classifyMove(before, moved(1, 0), fps)).toStrictEqual({ kind: "none" });
  });

  it("gives an updateNode for a move into another Zone", () => {
    expect(classifyMove(before, moved(0, 5), fps)).toStrictEqual({
      kind: "zone",
      command: { kind: "updateNode", id: "image-1", changes: { zone: "z1" } },
    });
  });

  it("is outside for a move into the gap", () => {
    expect(classifyMove(before, moved(0, 2.5), fps)).toStrictEqual({ kind: "outside" });
  });

  it("is none for a rotation", () => {
    const rotated: Scenario = {
      ...before,
      nodes: [{ ...before.nodes[0], rotation: { x: 0, y: 1, z: 0 } }],
    };
    expect(classifyMove(before, rotated, fps)).toStrictEqual({ kind: "none" });
  });

  it("is none when the Zones changed too", () => {
    const after = { ...moved(0, 5), zones: before.zones.slice(0, 2) };
    expect(classifyMove(before, after, fps)).toStrictEqual({ kind: "none" });
  });
});

describe("P-APP2-10 adding an image is one undoable step", () => {
  // Feature: app-moodwalk, Property 10: P-APP2-10 adding an image is one undoable step
  // **Validates: Requirements 4.2, 4.7, 5.7, 6.8**
  it("P-APP2-10: addImageCommand is one addNode, accepted, placed in its Zone, and undone in one step", () => {
    const inputArb = boardArb
      .filter((b) => b.nodes.filter((n) => n.type === "image").length < 50)
      .chain((board) =>
        fc.record({
          board: fc.constant(board),
          zone: fc.constantFrom(...board.zones.map((z) => z.id)),
          brightness: fc.double({ min: 0, max: 1, noNaN: true }).map((v) => v + 0),
          temperature: fc.double({ min: -1, max: 1, noNaN: true }).map((v) => v + 0),
        }),
      );
    fc.assert(
      fc.property(inputArb, ({ board, zone, brightness, temperature }) => {
        const before = JSON.parse(JSON.stringify(board)) as Scenario;
        const footprints = routeFootprints(board.zones);
        const reference = "upload:1";
        const cmd = addImageCommand(board, { reference, zone, mood: { brightness, temperature } }, footprints);
        expect(cmd).not.toBeNull();
        if (cmd === null || cmd.kind !== "addNode") throw new Error("expected one addNode");
        const created = createHistory(board, 100);
        if (!created.ok) throw new Error("board is not valid");
        const result = executeCommand(created.history, cmd);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const node = result.history.present.nodes.find((n) => n.id === cmd.node.id);
        if (node === undefined) throw new Error("new node missing");
        expect(node.type).toBe("image");
        expect(node.zone).toBe(zone);
        expect(node.front.image).toBe(reference);
        expect(node.attributes).toStrictEqual({ brightness, temperature });
        expect(footprintAt(footprints, node.position.x, node.position.z)).toBe(zone);
        const others = board.nodes.filter((n) => n.type === "image" && n.zone === zone);
        for (const o of others) expect(o.position).not.toStrictEqual(node.position);
        expect(result.history.present.nodes).toHaveLength(board.nodes.length + 1);
        expect(JSON.parse(JSON.stringify(undo(result.history).present))).toStrictEqual(before);
      }),
      { numRuns: 100 },
    );
  });
});
