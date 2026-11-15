// Type_Check_Sensor: runs `tsc --noEmit -p tsconfig.json` in the current directory.
// Exit codes: 0 pass, 1 type errors, 2 tsc cannot start.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const tscBin = join(repoRoot, "node_modules", "typescript", "bin", "tsc");

function main(): number {
  const tsconfig = join(process.cwd(), "tsconfig.json");
  if (!existsSync(tsconfig)) {
    console.error(`typecheck: tsconfig.json not found in ${process.cwd()}`);
    return 2;
  }
  if (!existsSync(tscBin)) {
    console.error(`typecheck: TypeScript is not installed (missing ${tscBin})`);
    return 2;
  }
  const result = spawnSync(
    process.execPath,
    [tscBin, "--noEmit", "-p", "tsconfig.json"],
    { stdio: "inherit", cwd: process.cwd() },
  );
  if (result.error) {
    console.error(`typecheck: tsc could not start: ${result.error.message}`);
    return 2;
  }
  if (result.status === null) {
    console.error(`typecheck: tsc was terminated by signal ${String(result.signal)}`);
    return 2;
  }
  return result.status === 0 ? 0 : 1;
}

process.exit(main());
