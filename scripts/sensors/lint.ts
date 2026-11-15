// Lint_Sensor: runs ESLint over core, apps and scripts in the current directory.
// The config is found by ESLint itself from the current directory (no -c), so a
// temporary project with its own eslint.config.mjs is linted with that config.
// Exit codes: 0 pass, 1 findings (errors or warnings), 2 ESLint cannot run.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
const repoRoot = resolve(import.meta.dirname, "..", "..");
const eslintBin = join(repoRoot, "node_modules", "eslint", "bin", "eslint.js");
const configNames = [
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
];
function main(): number {
  const cwd = process.cwd();
  if (!existsSync(eslintBin)) {
    console.error(`lint: ESLint is not installed (missing ${eslintBin})`);
    return 2;
  }
  if (!configNames.some((name) => existsSync(join(cwd, name)))) {
    console.error(`lint: ESLint config not found in ${cwd}`);
    return 2;
  }
  const result = spawnSync(
    process.execPath,
    [
      eslintBin,
      "--flag",
      "unstable_native_nodejs_ts_config",
      "--max-warnings",
      "0",
      "core",
      "apps",
      "scripts",
    ],
    { stdio: "inherit", cwd },
  );
  if (result.error) {
    console.error(`lint: ESLint could not start: ${result.error.message}`);
    return 2;
  }
  if (result.status === null) {
    console.error(`lint: ESLint was terminated by signal ${String(result.signal)}`);
    return 2;
  }
  if (result.status === 2) {
    console.error("lint: ESLint could not load its config or run (see output above)");
    return 2;
  }
  return result.status === 0 ? 0 : 1;
}
process.exit(main());
