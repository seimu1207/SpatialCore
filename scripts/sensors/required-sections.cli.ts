import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { checkRequiredSections, isSpecDocumentPath } from "./required-sections.ts";

const root = process.cwd();

function toRel(p: string): string {
  const abs = path.resolve(root, p);
  return path.relative(root, abs).replace(/\\/g, "/");
}

function allSpecDocuments(): string[] {
  const specs = path.join(root, ".kiro", "specs");
  if (!existsSync(specs)) return [];
  const out: string[] = [];
  for (const dir of readdirSync(specs).sort()) {
    if (!statSync(path.join(specs, dir)).isDirectory()) continue;
    for (const name of ["requirements.md", "design.md"]) {
      const rel = `.kiro/specs/${dir}/${name}`;
      if (existsSync(path.join(root, rel))) out.push(rel);
    }
  }
  return out;
}

function run(): number {
  const args = process.argv.slice(2);
  let files: string[];

  if (args.length === 0) {
    files = allSpecDocuments();
  } else if (args.length === 1 && args[0] !== undefined) {
    const given = args[0];
    const rel = toRel(given);
    if (!isSpecDocumentPath(rel) || !existsSync(path.join(root, rel))) {
      const reason = !isSpecDocumentPath(rel)
        ? "not a spec requirements.md or design.md"
        : "does not exist";
      console.error(`${given}: rejected: ${reason}`);
      return 2;
    }
    files = [rel];
  } else {
    console.error("usage: required-sections.cli.ts [<spec requirements.md or design.md>]");
    return 2;
  }

  let failed = false;
  for (const file of files) {
    const { missing } = checkRequiredSections(readFileSync(path.join(root, file), "utf8"));
    for (const heading of missing) {
      console.log(`${file}: missing "${heading}"`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

try {
  process.exitCode = run();
} catch (error) {
  console.error(error);
  process.exitCode = 2;
}
