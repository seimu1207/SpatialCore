import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeTmpProject, repoRoot, runSensor, type TmpProject } from "./tmp-project.ts";

// include is explicit and exclude is empty, so tsc's default node_modules exclusion cannot skip the files.
const tsconfig = JSON.stringify({
  compilerOptions: { strict: true, noEmit: true, types: [], target: "ES2023", module: "nodenext" },
  include: ["**/*.ts"],
  exclude: [],
});

function listAll(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" }).sort();
}

function findJs(dir: string): string[] {
  return listAll(dir).filter((f) => /\.(js|jsx|mjs|cjs)$/.test(f));
}

describe("typecheck sensor", { timeout: 60_000 }, () => {
  let project: TmpProject | undefined;
  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("R-FND-06.3 / 02.9: type error exits 1 and prints file and line", () => {
    project = makeTmpProject("type-error", {
      "tsconfig.json": tsconfig,
      "core/bad.ts": "export const n: number = \"text\";\n",
    });
    const r = runSensor("typecheck.ts", project.dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/bad\.ts\(1,\d+\)/);
    expect(r.stdout).toContain("TS2322");
  });

  it("R-FND-06.5 / 02.9: missing tsconfig.json exits 2 and names the cause", () => {
    project = makeTmpProject("no-tsconfig", { "core/a.ts": "export const a = 1;\n" });
    const r = runSensor("typecheck.ts", project.dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("tsconfig.json not found");
  });

  it("R-FND-06.2 / 02.9: clean project exits 0", () => {
    project = makeTmpProject("clean", {
      "tsconfig.json": tsconfig,
      "core/ok.ts": "export const ok: number = 1;\n",
    });
    const r = runSensor("typecheck.ts", project.dir);
    expect(r.status).toBe(0);
  });

  it("R-FND-06.4: npm run typecheck writes no dist/ change and no .js file", () => {
    const dist = join(repoRoot, "dist");
    const before = listAll(dist);
    const existed = existsSync(dist);
    const r = spawnSync("npm run typecheck", { cwd: repoRoot, shell: true, encoding: "utf8" });
    expect(r.status).not.toBeNull();
    expect(existsSync(dist)).toBe(existed);
    expect(listAll(dist)).toEqual(before);
    for (const folder of ["core", "apps", "scripts"]) {
      expect(findJs(join(repoRoot, folder))).toEqual([]);
    }
  });
});
