import { describe, expect, it } from "vitest";
import { loadScenario, saveScenario } from "../../../core/model/scenario-io.ts";
import { loadTheme } from "../../../core/view/helpers/theme-schema.ts";
import { BUNDLED } from "./bundled.ts";
import { attackCheckSet, withCheckSet } from "./built-rules.ts";
import { EDGE_TYPES, EFFECT_KINDS, NODE_TYPES } from "./names.ts";
import { loadRuleDefinition } from "../../../core/model/rule-schema.ts";
import type { Condition } from "../../../core/model/rule-schema.ts";
import {
  attackCardSchema,
  crossReferenceErrors,
  loadGameData,
  orderRulesSchema,
  robotJobsSchema,
  starTableSchema,
} from "./game-data.ts";
import type { GameData, RawGameData } from "./game-data.ts";

const text = (en: string) => ({ en, ja: en });
const trivial: Condition = { kind: "all", conditions: [] };

function precondition(id: string) {
  return { id, label: text(id), check: trivial, highlight: [] };
}

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "card",
    name: text("n"),
    attackerGoal: text("g"),
    motives: [text("m")],
    targets: ["robot"],
    preconditions: [precondition("p1"), precondition("p2"), precondition("p3")],
    impact: text("i"),
    counters: [text("c")],
    ...overrides,
  };
}

const jobs = {
  weights: { plain: 2, bell: 1 },
  jobs: [
    { id: "j1", label: text("a"), room: "r1" },
    { id: "j2", label: text("b"), room: "r1", reads: "page" },
  ],
};

const stars = { defaultStars: 1, rules: [{ stars: 3, minConvenience: 4, maxDamage: 0 }, { stars: 2, minConvenience: 2, maxDamage: 3 }] };

describe("App schemas", () => {
  it("accept valid fixtures", () => {
    expect(attackCardSchema.safeParse(card()).success).toBe(true);
    expect(robotJobsSchema.safeParse(jobs).success).toBe(true);
    expect(orderRulesSchema.safeParse([{ before: "stop-robot", after: "cut-key" }]).success).toBe(true);
    expect(starTableSchema.safeParse(stars).success).toBe(true);
  });

  it("attackCardSchema rejects 2 Preconditions and duplicate ids", () => {
    expect(attackCardSchema.safeParse(card({ preconditions: [precondition("p1"), precondition("p2")] })).success).toBe(false);
    const dup = card({ preconditions: [precondition("p1"), precondition("p1"), precondition("p3")] });
    expect(attackCardSchema.safeParse(dup).success).toBe(false);
  });

  it("robotJobsSchema rejects plain < bell and duplicate job ids", () => {
    expect(robotJobsSchema.safeParse({ ...jobs, weights: { plain: 1, bell: 2 } }).success).toBe(false);
    const dup = { ...jobs, jobs: [jobs.jobs[0], jobs.jobs[0]] };
    expect(robotJobsSchema.safeParse(dup).success).toBe(false);
  });

  it("orderRulesSchema rejects equal operations", () => {
    expect(orderRulesSchema.safeParse([{ before: "consult", after: "consult" }]).success).toBe(false);
  });

  it("starTableSchema rejects an empty list, equal stars, and minConvenience 0 in the first rule", () => {
    expect(starTableSchema.safeParse({ ...stars, rules: [] }).success).toBe(false);
    const equal = { ...stars, rules: [stars.rules[0], { ...stars.rules[1], stars: 3 }] };
    expect(starTableSchema.safeParse(equal).success).toBe(false);
    const zero = { ...stars, rules: [{ ...stars.rules[0], minConvenience: 0 }] };
    expect(starTableSchema.safeParse(zero).success).toBe(false);
  });
});

describe("loadGameData", () => {
  const broken: RawGameData = {
    scenarioText: "{",
    rules: 1,
    attackCard: {},
    jobs: {},
    orderRules: "x",
    starTable: {},
    viewSettings: [],
    theme: null,
  };

  it("names every broken file and does not throw", () => {
    const result = loadGameData(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const files = new Set(result.errors.map((e) => e.file));
    for (const f of [
      "scenarios/preset-mansion.json",
      "rules/game-rules.json",
      "rules/attack-card.json",
      "rules/robot-jobs.json",
      "rules/order-rules.json",
      "rules/star-table.json",
      "view-settings.json",
      "theme/theme.json",
    ]) {
      expect(files.has(f)).toBe(true);
    }
  });

  it("does not throw for hostile values", () => {
    const hostile = { ...broken, scenarioText: undefined as unknown as string };
    expect(() => loadGameData(hostile)).not.toThrow();
    expect(loadGameData(hostile).ok).toBe(false);
  });
});

describe("crossReferenceErrors", () => {
  const scenarioText = JSON.stringify({
    schemaVersion: 1,
    id: "s",
    title: text("t"),
    zones: [],
    nodes: ["robot", "r1", "page"].map((id, i) => ({
      id,
      type: id === "robot" ? "robot" : "room",
      position: { x: i, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      front: { text: text(id) },
      metadata: {},
      attributes: {},
    })),
    edges: [{ id: "k1", from: "robot", to: "r1", type: "plain-key" }],
  });

  function base(): GameData {
    const sc = loadScenario(scenarioText);
    const rules = loadRuleDefinition({
      schemaVersion: 1,
      id: "rules",
      propagation: { pass: ["plain-key"], stop: ["bell-key"] },
      checkSets: [{ id: "jobs", items: [{ id: "j1", condition: trivial }, { id: "j2", condition: trivial }] }],
    });
    if (!sc.ok || !rules.ok) throw new Error("fixture invalid");
    return {
      preset: sc.scenario,
      rules: rules.value,
      attackCard: attackCardSchema.parse(card()),
      jobs: robotJobsSchema.parse(jobs),
      orderRules: [{ before: "stop-robot", after: "cut-key" }],
      starTable: starTableSchema.parse(stars),
      viewSettings: {} as GameData["viewSettings"],
      theme: {} as GameData["theme"],
    };
  }

  it("is empty for consistent data", () => {
    expect(crossReferenceErrors(base())).toEqual([]);
  });

  it("names a missing Node id and a missing Edge id", () => {
    const data = base();
    data.attackCard = attackCardSchema.parse(
      card({
        targets: ["ghost-node"],
        preconditions: [
          { ...precondition("p1"), highlight: [{ kind: "edge", id: "no-edge" }] },
          precondition("p2"),
          precondition("p3"),
        ],
      }),
    );
    const messages = crossReferenceErrors(data).map((e) => e.message);
    expect(messages.some((m) => m.includes("ghost-node"))).toBe(true);
    expect(messages.some((m) => m.includes("no-edge"))).toBe(true);
  });

  it("reports job ids that differ from the Job_Check_Set and an unknown order operation", () => {
    const data = base();
    data.jobs = robotJobsSchema.parse({ ...jobs, jobs: [jobs.jobs[1], jobs.jobs[0]] });
    data.orderRules = [{ before: "nope" as never, after: "cut-key" }];
    const errors = crossReferenceErrors(data);
    expect(errors.some((e) => e.path.startsWith("rules.checkSets"))).toBe(true);
    expect(errors.some((e) => e.message.includes("nope"))).toBe(true);
  });
});

describe("bundled Game_Data", () => {
  const loaded = loadGameData(BUNDLED);
  if (!loaded.ok) throw new Error(`bundled data does not load: ${JSON.stringify(loaded.errors)}`);
  const data = loaded.data;
  const nodes = data.preset.nodes;
  const zoneById = new Map(data.preset.zones.map((z) => [z.id, z]));
  const presets = data.viewSettings.presets;
  const ghostView = presets[0];

  it("every bundled file loads (2.5)", () => {
    expect(loaded.ok).toBe(true);
  });

  it("has no cross reference errors and the attack Built_Rules load (2.6, 2.8, 2.9)", () => {
    expect(crossReferenceErrors(data)).toEqual([]);
    expect(withCheckSet(data.rules, attackCheckSet(data.attackCard)).ok).toBe(true);
  });

  it("has four Zones with ascending order, different elevations, and the specified enclosure (3.1)", () => {
    const zones = data.preset.zones;
    expect(zones.map((z) => z.id)).toEqual(["outside-road", "garden", "house", "safe"]);
    const orders = zones.map((z) => z.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(4);
    expect(new Set(zones.map((z) => z.elevation ?? 0)).size).toBe(4);
    expect(zones.map((z) => z.enclosed === true)).toEqual([false, true, true, true]);
  });

  it("has four ring footprints with the Outside_Road outermost (3.2, 3.3)", () => {
    const rings = data.viewSettings.zoneFootprints;
    expect(rings).toHaveLength(4);
    const outer: Record<string, number> = {};
    for (const f of rings) {
      expect(f.kind).toBe("ring");
      if (f.kind === "ring") outer[f.id] = f.outerRadius;
    }
    expect(Object.keys(outer).sort()).toEqual(["garden", "house", "outside-road", "safe"]);
    expect(outer["outside-road"]).toBeGreaterThan(outer["garden"]);
    expect(outer["garden"]).toBeGreaterThan(outer["house"]);
    expect(outer["house"]).toBeGreaterThan(outer["safe"]);
  });

  it("has one robot, 3 or 4 rooms, a Hidden_Text node, an outside Text_Node, a helper, an answer, and a source (3.4, 3.5)", () => {
    const ofType = (t: string) => nodes.filter((n) => n.type === t);
    expect(ofType(NODE_TYPES.robot)).toHaveLength(1);
    expect(ofType(NODE_TYPES.room).length).toBeGreaterThanOrEqual(3);
    expect(ofType(NODE_TYPES.room).length).toBeLessThanOrEqual(4);
    expect(nodes.some((n) => n.front.detail !== undefined)).toBe(true);
    expect(ofType(NODE_TYPES.text).some((n) => n.zone === "outside-road")).toBe(true);
    expect(ofType(NODE_TYPES.helper).length).toBeGreaterThanOrEqual(1);
    expect(ofType(NODE_TYPES.answer).length).toBeGreaterThanOrEqual(1);
    expect(ofType(NODE_TYPES.source).length).toBeGreaterThanOrEqual(1);
  });

  it("scales rooms monotonically in Importance (3.6)", () => {
    const rooms = nodes
      .filter((n) => n.type === NODE_TYPES.room)
      .map((n) => ({ importance: n.attributes["importance"] ?? 0, scale: n.scale.x }));
    for (const a of rooms) {
      for (const b of rooms) {
        if (a.importance > b.importance) expect(a.scale).toBeGreaterThan(b.scale);
        if (a.importance === b.importance) expect(a.scale).toBe(b.scale);
      }
    }
  });

  it("gives every label and face text a non-empty en (3.8, 22.1)", () => {
    const check = (t: { en: string } | undefined) => {
      if (t !== undefined) expect(t.en.trim().length).toBeGreaterThan(0);
    };
    check(data.preset.title);
    for (const z of data.preset.zones) check(z.label);
    for (const e of data.preset.edges) check(e.label);
    for (const n of nodes) {
      check(n.front.text);
      check(n.front.detail);
      check(n.back?.text);
      check(n.back?.detail);
    }
    for (const p of presets) check(p.label);
    for (const j of data.jobs.jobs) check(j.label);
    const card = data.attackCard;
    for (const t of [card.name, card.attackerGoal, card.impact, ...card.motives, ...card.counters]) check(t);
    for (const p of card.preconditions) check(p.label);
  });

  it("sorts Edge types into pass and stop as specified (4.1, 4.2)", () => {
    const { pass, stop } = data.rules.propagation;
    expect(pass).toContain(EDGE_TYPES.plainKey);
    expect(stop).toContain(EDGE_TYPES.bellKey);
    for (const t of [EDGE_TYPES.reads, EDGE_TYPES.noRead, EDGE_TYPES.cites, EDGE_TYPES.consult]) {
      expect(pass).not.toContain(t);
    }
  });

  it("keeps the Hidden_Text short (5.4)", () => {
    const hidden = nodes.filter((n) => n.front.detail !== undefined);
    expect(hidden.length).toBeGreaterThan(0);
    for (const n of hidden) {
      const d = n.front.detail;
      expect(d?.en.length).toBeLessThanOrEqual(60);
      expect(d?.ja?.length ?? 0).toBeLessThanOrEqual(60);
    }
  });

  it("holds no URL, address, markup, code mark, or instruction word in any Game_Data string (5.4, 5.5)", () => {
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === "string") strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v !== null && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(data);
    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) {
      for (const bad of ["://", "@", "<", "{", "`"]) expect(s.includes(bad), `"${s}" has ${bad}`).toBe(false);
      expect(/ignore|system|prompt/i.test(s), `"${s}" has a banned word`).toBe(false);
    }
  });

  it("holds the three Preconditions of R-APP1-05.2", () => {
    expect(data.attackCard.preconditions.map((p) => p.id)).toEqual(["reads-outside", "holds-key", "no-human-check"]);
  });

  it("puts the hidden job last and its read Node has a front.detail (15.3)", () => {
    const jobs = data.jobs.jobs;
    const hiddenIndexes = jobs
      .map((j, i) => ({ j, i }))
      .filter(({ j }) => j.reads !== undefined && nodes.find((n) => n.id === j.reads)?.front.detail !== undefined)
      .map(({ i }) => i);
    expect(hiddenIndexes).toEqual([jobs.length - 1]);
  });

  it("opens in the Ghost_View, below the Garden Wall top, filtered to the Outside_Road (11.2, 11.6)", () => {
    expect(ghostView.id).toBe("ghost-view");
    const garden = zoneById.get("garden");
    expect(garden).toBeDefined();
    expect(ghostView.pose.position.y).toBeLessThan((garden?.elevation ?? 0) + data.viewSettings.wallHeight);
    expect(ghostView.filter.zones).toEqual(["outside-road"]);
    expect(ghostView.filter.edgeRule).toBe("anyEnd");
  });

  describe("zoom distances (11.4, 11.5)", () => {
    // Source: core/view/scene/camera-rig.tsx, OrbitControls minDistance. The model may not import core/view/scene/.
    const MIN_DISTANCE = 0.1;
    type P = { x: number; y: number; z: number };
    const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const page = nodes.find((n) => n.id === "page");
    if (page === undefined) throw new Error("page missing");

    /** Minimum distance from the point to the dolly segment: pose position to the point MIN_DISTANCE from the target. */
    function dollyMin(pose: { position: P; target: P }, point: P): number {
      const total = dist(pose.position, pose.target);
      const t = (total - MIN_DISTANCE) / total;
      const end = {
        x: pose.position.x + (pose.target.x - pose.position.x) * t,
        y: pose.position.y + (pose.target.y - pose.position.y) * t,
        z: pose.position.z + (pose.target.z - pose.position.z) * t,
      };
      const d = { x: end.x - pose.position.x, y: end.y - pose.position.y, z: end.z - pose.position.z };
      const len2 = d.x * d.x + d.y * d.y + d.z * d.z;
      const s = Math.min(
        1,
        Math.max(
          0,
          ((point.x - pose.position.x) * d.x + (point.y - pose.position.y) * d.y + (point.z - pose.position.z) * d.z) / len2,
        ),
      );
      return dist(point, { x: pose.position.x + d.x * s, y: pose.position.y + d.y * s, z: pose.position.z + d.z * s });
    }

    it("hides the Hidden_Text at the Ghost_View pose", () => {
      expect(dist(ghostView.pose.position, page.position)).toBeGreaterThan(data.viewSettings.detailDistance);
    });
    it("reaches the Hidden_Text by dolly from the Ghost_View", () => {
      expect(dollyMin(ghostView.pose, page.position)).toBeLessThanOrEqual(data.viewSettings.detailDistance);
    });
    it("never reaches the Hidden_Text by dolly from the Overhead_View", () => {
      const overhead = presets.find((p) => p.id === "overhead");
      expect(overhead).toBeDefined();
      if (overhead === undefined) return;
      expect(dollyMin(overhead.pose, page.position)).toBeGreaterThan(data.viewSettings.detailDistance);
    });
  });

  it("keeps every Detail_Layer at or above its Zone floor (11.4)", () => {
    // Source: core/view/scene/node-panel.tsx constants BASE_HEIGHT and DETAIL_BASE_HEIGHT (copied; scene files are not importable).
    const BASE_HEIGHT = 1.2;
    const DETAIL_BASE_HEIGHT = 0.6;
    const withDetail = nodes.filter((n) => n.front.detail !== undefined);
    expect(withDetail.length).toBeGreaterThan(0);
    for (const n of withDetail) {
      const bottom =
        n.position.y - ((BASE_HEIGHT + DETAIL_BASE_HEIGHT) * n.scale.y) / 2 - (DETAIL_BASE_HEIGHT * n.scale.y) / 2;
      const floor = (n.zone !== undefined ? zoneById.get(n.zone)?.elevation : undefined) ?? 0;
      expect(bottom).toBeGreaterThanOrEqual(floor - 1e-9);
    }
  });

  it("has a Theme that passes loadTheme with a fog style for every Effect_Kind (2.3, 8.4)", () => {
    expect(loadTheme(BUNDLED.theme).ok).toBe(true);
    for (const kind of Object.values(EFFECT_KINDS)) {
      expect(data.theme.effects?.[kind]?.style, kind).toBe("fog");
    }
  });

  it("saves and loads the Preset_Mansion unchanged (intent.md 10.6)", () => {
    const saved = saveScenario(data.preset);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const reloaded = loadScenario(saved.text);
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) expect(reloaded.scenario).toEqual(data.preset);
  });
});
