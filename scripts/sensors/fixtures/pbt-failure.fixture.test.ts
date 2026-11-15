import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const vitestBin = resolve(repoRoot, "node_modules/vitest/vitest.mjs");

describe("PBT failure output (R-FND-10.3, R-FND-10.6)", { timeout: 60_000 }, () => {
  test("a failing property exits non-zero and prints file, property ID, counterexample, seed", () => {
    const result = spawnSync(
      process.execPath,
      [vitestBin, "run", "--config", "scripts/sensors/fixtures/vitest.fixture.config.ts"],
      { cwd: repoRoot, encoding: "utf8", env: { ...process.env, CI: "1", FORCE_COLOR: "0" } },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).not.toBe(0);
    expect(output).toContain("pbt-failure.fixture.ts");
    expect(output).toContain("P-FND-FAIL");
    expect(output).toContain("Counterexample");
    expect(output).toContain("seed");
  });
});
