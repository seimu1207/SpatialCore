// Test helper: temporary projects under node_modules/.cache/fnd-tmp/<name>-<random>/.
// They sit inside the repo, so packages resolve by walking up to the repo's node_modules/.
// The folder is gitignored through node_modules/. Sensors run from scripts/sensors/ with cwd = project dir.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "..", "..");
const tmpRoot = join(repoRoot, "node_modules", ".cache", "fnd-tmp");

export type TmpProject = { dir: string; cleanup: () => void };

/** Creates a project with the given files (relative path -> text). Call cleanup() in afterEach. */
export function makeTmpProject(name: string, files: Record<string, string>): TmpProject {
  mkdirSync(tmpRoot, { recursive: true });
  const dir = mkdtempSync(join(tmpRoot, `${name.replace(/[^A-Za-z0-9_-]/g, "_")}-`));
  for (const [rel, text] of Object.entries(files)) {
    const file = join(dir, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text, "utf8");
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export type RunResult = { status: number | null; stdout: string; stderr: string };

/** Runs `node scripts/sensors/<sensor>` (for example "typecheck.ts") with cwd = the temporary project. */
export function runSensor(sensor: string, cwd: string, args: string[] = []): RunResult {
  const r = spawnSync(process.execPath, [join(repoRoot, "scripts", "sensors", sensor), ...args], {
    cwd,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
