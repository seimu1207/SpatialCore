import { afterEach, describe, expect, it } from "vitest";
import { makeTmpProject, repoRoot, runSensor, type TmpProject } from "./tmp-project.ts";

const GOOD = "# Doc\n\n## PBT properties\n\n## Safety\n";
const NO_SAFETY = "# Doc\n\n## PBT properties\n";
const NO_PBT = "# Doc\n\n## Safety\n";
const NEITHER = "# Doc\n";
const CLI = "required-sections.cli.ts";

let project: TmpProject | undefined;
afterEach(() => {
  project?.cleanup();
  project = undefined;
});

function make(files: Record<string, string>): TmpProject {
  project = makeTmpProject("sections-cli", files);
  return project;
}

describe("required-sections CLI", { timeout: 60_000 }, () => {
  it("no argument: reports every failing document without stopping at the first, exit 1 (05.3)", () => {
    const p = make({
      ".kiro/specs/a/requirements.md": NO_SAFETY,
      ".kiro/specs/a/design.md": GOOD,
      ".kiro/specs/b/requirements.md": NO_PBT,
      ".kiro/specs/b/design.md": NEITHER,
    });
    const r = runSensor(CLI, p.dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('.kiro/specs/a/requirements.md: missing "Safety"');
    expect(r.stdout).toContain('.kiro/specs/b/requirements.md: missing "PBT properties"');
    expect(r.stdout).toContain('.kiro/specs/b/design.md: missing "PBT properties"');
    expect(r.stdout).toContain('.kiro/specs/b/design.md: missing "Safety"');
    expect(r.stdout).not.toContain(".kiro/specs/a/design.md");
  });

  it("no argument: exit 0 when every document passes", () => {
    const p = make({
      ".kiro/specs/a/requirements.md": GOOD,
      ".kiro/specs/a/design.md": GOOD,
    });
    const r = runSensor(CLI, p.dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("single file that fails: exit 1, prints the missing heading, checks no other file (05.2, 05.4)", () => {
    const p = make({
      ".kiro/specs/a/requirements.md": NO_SAFETY,
      ".kiro/specs/a/design.md": NEITHER,
    });
    const r = runSensor(CLI, p.dir, [".kiro/specs/a/requirements.md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('.kiro/specs/a/requirements.md: missing "Safety"');
    expect(r.stdout).not.toContain("design.md");
  });

  it("single file that passes: exit 0 even if another spec document fails (05.4)", () => {
    const p = make({
      ".kiro/specs/a/requirements.md": GOOD,
      ".kiro/specs/a/design.md": NEITHER,
    });
    const r = runSensor(CLI, p.dir, [".kiro/specs/a/requirements.md"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("missing path: exit 2, prints path and reason, checks nothing else (05.5)", () => {
    const p = make({ ".kiro/specs/a/design.md": NEITHER });
    const r = runSensor(CLI, p.dir, [".kiro/specs/a/requirements.md"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(".kiro/specs/a/requirements.md");
    expect(r.stderr).toContain("does not exist");
    expect(r.stdout).toBe("");
  });

  it("non-spec path: exit 2, prints path and reason, checks nothing else (05.5)", () => {
    const p = make({ "README.md": NEITHER, ".kiro/specs/a/design.md": NEITHER });
    const r = runSensor(CLI, p.dir, ["README.md"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("README.md");
    expect(r.stderr).toContain("not a spec requirements.md or design.md");
    expect(r.stdout).toBe("");
  });

  it("two arguments: exit 2 with usage", () => {
    const p = make({ ".kiro/specs/a/design.md": GOOD });
    const r = runSensor(CLI, p.dir, [".kiro/specs/a/design.md", "x"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("usage");
  });

  it("this spec's own requirements.md and design.md pass (single-file runs)", () => {
    for (const name of ["requirements.md", "design.md"]) {
      const r = runSensor(CLI, repoRoot, [`.kiro/specs/repo-foundation/${name}`]);
      expect(r.status, r.stdout + r.stderr).toBe(0);
    }
  });
});
