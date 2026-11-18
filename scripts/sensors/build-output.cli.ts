import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { BASE_PATH, PUBLIC_ORIGIN } from "../../vite.config.ts";
import { checkLayout, findBadAssetRefs, findForeignUrls } from "./build-output.ts";

const repoRoot = resolve(import.meta.dirname, "..", "..");
// Optional first argument: the folder to scan (used by tests). Default: dist/ at the repo root.
const distDir = process.argv[2] === undefined ? join(repoRoot, "dist") : resolve(process.argv[2]);
const ALLOWED_PREFIXES = ["http://www.w3.org/", "https://react.dev/errors/"] as const;
// Strings that React DOM and Fiber embed as text and never fetch (core-view O6).
const ALLOWED_EXACT = [
  "https://react.dev/link/hydration-mismatch",
  "https://github.com/pmndrs/react-three-fiber#readme",
  "https://github.com/pmndrs/react-three-fiber/issues",
  "https://opencollective.com/react-three-fiber",
  "https://json-schema.org/draft/2020-12/schema",
  "http://json-schema.org/draft-07/schema#",
  "http://json-schema.org/draft-04/schema#",
  "http://[${e}]",
  "https://github.com/drcmda",
  "https://github.com/joshuaellis",
  "https://github.com/codyjasonbennett",
  "https://github.com/krispya",
  "https://github.com/pmndrs/react-three-fiber.git",
  "https://docs.pmnd.rs/react-three-fiber/api/objects#using-3rd-party-objects-declaratively",
  "https://github.com/react-spring/react-use-measure/#resize-observer-polyfills",
] as const;
const TEXT_EXTENSIONS = [".html", ".css", ".js"];

function walk(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(rel + "/", ...walk(join(dir, entry.name), rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function main(): number {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    console.error("dist/ is missing. Run `npm run build` first.");
    return 1;
  }
  const entries = walk(distDir);
  const files = entries.filter((entry) => !entry.endsWith("/"));
  // Folder entries end with "/", so an empty dist/apps folder is still reported.
  const findings: string[] = checkLayout(entries);
  const fileSet = new Set(files);
  for (const page of ["index.html", "ghost-mansion/index.html", "moodwalk/index.html", "core-demo/index.html"]) {
    if (!fileSet.has(page)) continue;
    const html = readFileSync(join(distDir, page), "utf8");
    for (const finding of findBadAssetRefs(html, BASE_PATH, fileSet)) {
      findings.push(`dist/${page}: ${finding}`);
    }
  }
  for (const file of files) {
    if (!TEXT_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;
    const text = readFileSync(join(distDir, file), "utf8");
    for (const url of findForeignUrls(text, PUBLIC_ORIGIN, ALLOWED_PREFIXES, ALLOWED_EXACT)) {
      findings.push(`dist/${file}: foreign URL ${url}`);
    }
  }
  for (const finding of findings) console.error(finding);
  return findings.length === 0 ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error);
  process.exitCode = 2;
}
