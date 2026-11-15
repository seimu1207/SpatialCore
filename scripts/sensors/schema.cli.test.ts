import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeTmpProject, repoRoot, runSensor, type TmpProject } from "./tmp-project.ts";

const CLI = "schema.cli.ts";
const GOOD = JSON.stringify({ schemaVersion: 1, id: "x", title: { en: "X" }, nodes: [], edges: [], zones: [] });
const BAD_SCHEMA = JSON.stringify({ schemaVersion: 1, id: "x", title: {}, nodes: [], edges: [], zones: [] });
const BAD_JSON = "{ not json";

let project: TmpProject | undefined;
afterEach(() => {
  project?.cleanup();
  project = undefined;
});

function make(files: Record<string, string>): TmpProject {
  project = makeTmpProject("schema-cli", files);
  return project;
}

describe("schema CLI", { timeout: 60_000 }, () => {
  it("real placeholder Scenario_Files pass in single-file runs (08.3)", () => {
    for (const app of ["ghost-mansion", "moodwalk"]) {
      const r = runSensor(CLI, repoRoot, [`apps/${app}/scenarios/placeholder.json`]);
      expect(r.status, r.stdout + r.stderr).toBe(0);
    }
  });

  it("no argument on the real repo: exit 0 (08.3, 08.4, 02.9)", () => {
    const r = runSensor(CLI, repoRoot);
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it("invalid JSON: exit 1, prints path and parse message (08.6)", () => {
    const p = make({ "apps/a/scenarios/s.json": BAD_JSON });
    const r = runSensor(CLI, p.dir, ["apps/a/scenarios/s.json"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("apps/a/scenarios/s.json: (root): JSON could not be parsed");
  });

  it("schema failure: exit 1, prints file path and field path (08.7)", () => {
    const p = make({ "apps/a/scenarios/s.json": BAD_SCHEMA });
    const r = runSensor(CLI, p.dir, ["apps/a/scenarios/s.json"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("apps/a/scenarios/s.json: title.en:");
  });

  it("non-object top level: a (root) line, exit 1 (09.4)", () => {
    const p = make({ "apps/a/scenarios/s.json": "[]" });
    const r = runSensor(CLI, p.dir, ["apps/a/scenarios/s.json"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("apps/a/scenarios/s.json: (root): a JSON object is expected at the top level");
  });
  it("nested error: path in the line, file left unchanged (09.4)", () => {
    const bad = JSON.stringify({
      schemaVersion: 1,
      id: "x",
      title: { en: "X" },
      zones: [],
      edges: [],
      nodes: [
        {
          id: "n",
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          front: { text: { en: "T" } },
          metadata: {},
          attributes: {},
        },
      ],
    });
    const p = make({ "apps/a/scenarios/s.json": bad });
    const r = runSensor(CLI, p.dir, ["apps/a/scenarios/s.json"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("apps/a/scenarios/s.json: nodes.0.type:");
    expect(readFileSync(join(p.dir, "apps/a/scenarios/s.json"), "utf8")).toBe(bad);
  });
  it("valid single file: exit 0 even if another file is invalid (08.5, 08.8)", () => {
    const p = make({ "apps/a/scenarios/ok.json": GOOD, "apps/a/scenarios/bad.json": BAD_JSON });
    const r = runSensor(CLI, p.dir, ["apps/a/scenarios/ok.json"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });

  it("missing path: exit 2, prints path and reason (08.9)", () => {
    const p = make({ "apps/a/scenarios/ok.json": GOOD });
    const r = runSensor(CLI, p.dir, ["apps/a/scenarios/none.json"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("apps/a/scenarios/none.json");
    expect(r.stderr).toContain("does not exist");
  });

  it("non-.json path: exit 2, prints path and reason (08.9)", () => {
    const p = make({ "README.md": "x", "apps/a/scenarios/ok.json": GOOD });
    const r = runSensor(CLI, p.dir, ["README.md"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("README.md");
    expect(r.stderr).toContain("not a .json file");
  });

  it("two arguments: exit 2 with usage", () => {
    const p = make({ "apps/a/scenarios/ok.json": GOOD });
    const r = runSensor(CLI, p.dir, ["a.json", "b.json"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("usage");
  });

  it("no files found: exit 1 with message (08.10)", () => {
    const p = make({ "apps/a/readme.txt": "x" });
    const r = runSensor(CLI, p.dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("No Scenario_File found under apps/*/scenarios/");
  });

  it("no argument: reports ALL invalid files, exit 1 (08.4)", () => {
    const p = make({
      "apps/a/scenarios/good.json": GOOD,
      "apps/a/scenarios/bad1.json": BAD_JSON,
      "apps/b/scenarios/bad2.json": BAD_SCHEMA,
    });
    const r = runSensor(CLI, p.dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("apps/a/scenarios/bad1.json: (root): JSON could not be parsed");
    expect(r.stderr).toContain("apps/b/scenarios/bad2.json: title.en:");
    expect(r.stderr).not.toContain("good.json");
  });

  it("no argument: exit 0 when all files are valid (08.8)", () => {
    const p = make({ "apps/a/scenarios/a.json": GOOD, "apps/b/scenarios/b.json": GOOD });
    const r = runSensor(CLI, p.dir);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });
});
