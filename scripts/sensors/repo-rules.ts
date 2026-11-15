import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".git"]);
const SOURCE_ROOTS = ["core", "apps", "scripts"] as const;
const JS_EXTENSION = /\.(?:js|jsx|mjs|cjs)$/;
const SOURCE_EXTENSION = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

export const APP_NAMES = ["ghost", "robot", "mansion", "mood curve", "moodwalk", "ghost mansion"] as const;

function toPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

/** Recursively lists files under `dir` as POSIX paths relative to `dir`. Skips node_modules, dist, .git. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(join(current, entry.name));
      } else if (entry.isFile()) {
        out.push(toPosix(relative(dir, join(current, entry.name))));
      }
    }
  };
  walk(dir);
  return out.sort();
}

function underSourceRoot(relPath: string): boolean {
  const p = toPosix(relPath);
  return SOURCE_ROOTS.some((r) => p.startsWith(`${r}/`));
}

/** Pure: from relative file paths, those with a JS extension under core/, apps/, scripts/. */
export function filterJsFiles(files: readonly string[]): string[] {
  return files.filter((f) => underSourceRoot(f) && JS_EXTENSION.test(f));
}

/** Lists .js/.jsx/.mjs/.cjs files under core/, apps/, scripts/ of `root`. */
export function findJsFiles(root: string): string[] {
  return filterJsFiles(listFiles(root));
}

/** Pure: import specifiers in `text` that start with `pkgName`. */
export function findSelfImportsInText(text: string, pkgName: string): string[] {
  if (pkgName === "") return [];
  const patterns = [
    /\bfrom\s*(["'`])([^"'`\n]*)\1/g,
    /\bimport\s*(["'`])([^"'`\n]*)\1/g,
    /\b(?:import|require)\s*\(\s*(["'`])([^"'`\n]*)\1\s*\)/g,
    /\bimport\s+[\w$]+\s*=\s*require\s*\(\s*(["'`])([^"'`\n]*)\1\s*\)/g,
  ];
  const found: string[] = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const spec = m[2];
      if (spec !== undefined && spec.startsWith(pkgName) && !found.includes(spec)) found.push(spec);
    }
  }
  return found;
}

export type SelfImport = { file: string; specifier: string };

/** Finds self-imports in Source_Files under core/, apps/, scripts/ of `root`. */
export function findSelfImports(root: string, pkgName: string): SelfImport[] {
  const result: SelfImport[] = [];
  for (const file of listFiles(root)) {
    if (!underSourceRoot(file) || !SOURCE_EXTENSION.test(file)) continue;
    const text = readFileSync(join(root, file), "utf8");
    for (const specifier of findSelfImportsInText(text, pkgName)) result.push({ file, specifier });
  }
  return result;
}

/** Pure: app-specific names found in `text`, case-insensitive, in APP_NAMES order. */
export function findAppNames(text: string): string[] {
  const lower = text.toLowerCase();
  return APP_NAMES.filter((n) => lower.includes(n));
}

/** Reads a file and returns the app-specific names it contains. */
export function findAppNamesInFile(path: string): string[] {
  return findAppNames(readFileSync(path, "utf8"));
}

/** R-FND-02.7: each allowed package maps to one named tool. */
export const ALLOWED_PACKAGES: Readonly<Record<string, string>> = {
  typescript: "TypeScript",
  vite: "Vite",
  react: "React",
  "react-dom": "React",
  "@vitejs/plugin-react": "Vite plugin for React",
  vitest: "Vitest",
  "fast-check": "fast-check",
  eslint: "ESLint",
  "@eslint/js": "ESLint config package",
  "typescript-eslint": "typescript-eslint",
  zod: "Zod",
  "@types/node": "Node.js type definitions",
  "@types/react": "React type definitions",
  "@types/react-dom": "React type definitions",
};

export const MIN_ESLINT = [9, 37, 0] as const;

function parseExactVersion(v: string): [number, number, number] | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (m === null) return undefined;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export type PackageJsonLike = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  imports?: unknown;
};

/** Pure: returns findings (empty when the package.json is acceptable). */
export function checkDependencies(pkg: PackageJsonLike): string[] {
  const findings: string[] = [];
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(all)) {
    if (!(name in ALLOWED_PACKAGES)) findings.push(`dependency not allowed: ${name}`);
  }
  const eslint = all["eslint"];
  if (eslint === undefined) {
    findings.push("eslint is not listed");
  } else {
    const v = parseExactVersion(eslint);
    if (v === undefined) {
      findings.push(`eslint version must be exact, got "${eslint}"`);
    } else {
      const [a, b, c] = v;
      const [x, y, z] = MIN_ESLINT;
      const ok = a !== x ? a > x : b !== y ? b > y : c >= z;
      if (!ok) findings.push(`eslint version must be >= ${MIN_ESLINT.join(".")}, got "${eslint}"`);
    }
  }
  if (pkg.imports !== undefined) findings.push('package.json must not have an "imports" field');
  return findings;
}

/** Reads package.json at `root` and checks it. */
export function checkDependenciesInFile(root: string): string[] {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageJsonLike;
  return checkDependencies(pkg);
}
