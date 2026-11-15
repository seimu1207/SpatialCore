// Entry for Kiro hooks: node scripts/sensors/hook-dispatch.ts <sections|code|schema|test>
// Kiro passes no saved path (stdin is {}), so each sensor runs on its whole scope. Runs the matching Sensor CLI(s) with captured output.
// Pass: prints nothing, exit 0. Fail: writes captured stdout then stderr to stderr, exit 1.
// Bad kind: exit 2.
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const sensorsDir = import.meta.dirname;
type Step = { command: string; args: string[] };

function nodeStep(file: string, extra: string[] = []): Step {
  return { command: process.execPath, args: [join(sensorsDir, file), ...extra] };
}

function stepsFor(kind: string): Step[] | undefined {
  const extra: string[] = [];
  switch (kind) {
    case "sections":
      return [nodeStep("required-sections.cli.ts", extra)];
    case "schema":
      return [nodeStep("schema.cli.ts", extra)];
    case "code":
      // The code hook never passes a file argument.
      return [nodeStep("typecheck.ts"), nodeStep("lint.ts")];
    case "test":
      return [{ command: process.platform === "win32" ? "npm.cmd" : "npm", args: ["test"] }];
    default:
      return undefined;
  }
}

function main(): number {
  const kind = process.argv[2] ?? "";
  const steps = stepsFor(kind);
  if (steps === undefined) {
    console.error(`hook-dispatch: unknown kind "${kind}" (use sections, code, schema, or test)`);
    return 2;
  }
  let failed = false;
  const output: string[] = [];
  for (const step of steps) {
    const result = spawnSync(step.command, step.args, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: step.command.endsWith(".cmd"),
    });
    if (result.error || result.status !== 0) {
      failed = true;
      output.push(result.stdout, result.stderr);
      if (result.error) output.push(`hook-dispatch: could not run ${step.args.join(" ")}: ${result.error.message}\n`);
    }
  }
  if (!failed) return 0;
  process.stderr.write(output.filter((s) => s !== "").join(""));
  return 1;
}

process.exit(main());
