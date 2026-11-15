import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkScenarioText } from "./schema.ts";

// Project root = the working directory (npm scripts and hooks run from the repo root).
const repoRoot = resolve(process.cwd());

function findScenarioFiles(): string[] {
  const appsDir = join(repoRoot, "apps");
  if (!existsSync(appsDir)) return [];
  const files: string[] = [];
  for (const app of readdirSync(appsDir, { withFileTypes: true })) {
    if (!app.isDirectory()) continue;
    const dir = join(appsDir, app.name, "scenarios");
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) files.push(join(dir, entry.name));
    }
  }
  return files.sort();
}

function checkFile(file: string, label: string): boolean {
  const result = checkScenarioText(readFileSync(file, "utf8"));
  if (result.ok) return true;
  for (const error of result.errors) {
    console.error(`${label}: ${error.path === "" ? "(root)" : error.path}: ${error.message}`);
  }
  return false;
}
function main(): number {
  const args = process.argv.slice(2);
  if (args.length > 1) {
    console.error("usage: check:schema [file.json]");
    return 2;
  }
  if (args.length === 1) {
    const given = args[0];
    if (!given.endsWith(".json")) {
      console.error(`${given}: rejected: not a .json file`);
      return 2;
    }
    const file = resolve(given);
    if (!existsSync(file) || !statSync(file).isFile()) {
      console.error(`${given}: rejected: does not exist`);
      return 2;
    }
    return checkFile(file, given) ? 0 : 1;
  }
  const files = findScenarioFiles();
  if (files.length === 0) {
    console.error("No Scenario_File found under apps/*/scenarios/");
    return 1;
  }
  let allOk = true;
  for (const file of files) {
    if (!checkFile(file, file.slice(repoRoot.length + 1).replaceAll("\\", "/"))) allOk = false;
  }
  return allOk ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error);
  process.exitCode = 2;
}
