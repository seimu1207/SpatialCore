import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkDependencies,
  checkDependenciesInFile,
  APP_NAMES,
  filterJsFiles,
  findAppNames,
  findJsFiles,
  findSelfImports,
  findSelfImportsInText,
  listFiles,
} from "./repo-rules.ts";

const root = join(import.meta.dirname, "..", "..");

/** Strips // and /* *\/ comments outside strings and trailing commas, then parses as JSON. */
function parseJsonWithComments(text: string): Record<string, unknown> {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
}

describe("R-FND-10.9 no JavaScript files", () => {
  it("real repo has no .js/.jsx/.mjs/.cjs under core/, apps/, scripts/", () => {
    expect(findJsFiles(root)).toEqual([]);
  });
  it("filterJsFiles reports JS files in the three folders only", () => {
    const files = ["core/a.js", "apps/x/b.jsx", "scripts/c.mjs", "scripts/d.cjs", "core/ok.ts", "docs/e.js", "eslint.config.mjs"];
    expect(filterJsFiles(files)).toEqual(["core/a.js", "apps/x/b.jsx", "scripts/c.mjs", "scripts/d.cjs"]);
  });
  it("listFiles skips node_modules and returns POSIX paths", () => {
    const files = listFiles(root);
    expect(files).toContain("package.json");
    expect(files.some((f) => f.startsWith("node_modules/"))).toBe(false);
    expect(files.some((f) => f.includes("\\"))).toBe(false);
  });
});

describe("R-FND-10.10 no imports field", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<string, unknown>;
  it("real package.json has no imports field", () => {
    expect("imports" in pkg).toBe(false);
  });
  it("checkDependencies reports an imports field", () => {
    expect(checkDependencies({ devDependencies: { eslint: "9.37.0" }, imports: { "#a": "./a.ts" } })).toEqual([
      'package.json must not have an "imports" field',
    ]);
  });
});

describe("R-FND-10.13 no paths key in tsconfig.json", () => {
  // Parsed with a comment-tolerant parser (comments and trailing commas stripped).
  const tsconfig = parseJsonWithComments(readFileSync(join(root, "tsconfig.json"), "utf8"));
  it("real tsconfig.json has no compilerOptions.paths", () => {
    const options = tsconfig["compilerOptions"] as Record<string, unknown>;
    expect("paths" in options).toBe(false);
    expect("paths" in tsconfig).toBe(false);
  });
  it("comment-tolerant parse sees a paths key hidden among comments", () => {
    const parsed = parseJsonWithComments(
      '{ // c\n "compilerOptions": { /* x */ "paths": { "@/*": ["a"] }, "u": "//not comment", } }',
    );
    const options = parsed["compilerOptions"] as Record<string, unknown>;
    expect("paths" in options).toBe(true);
    expect(options["u"]).toBe("//not comment");
  });
});

describe("R-FND-10.14 no self-imports", () => {
  const name = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string }).name;
  it("real Source_Files do not import the package's own name", () => {
    expect(findSelfImports(root, name)).toEqual([]);
  });
  it("findSelfImportsInText detects each import form", () => {
    const P = "spatial-" + "core";
    const text = [
      `import a from "${P}/core/x";`,
      `export * from "${P}";`,
      `const b = require("${P}/y");`,
      `const c = await import("${P}/z");`,
      `import d = require("${P}/w");`,
      `import e from "./${P}-local.ts";`,
      'import f from "zod";',
    ].join("\n");
    const found = findSelfImportsInText(text, P);
    expect(found).toEqual(
      expect.arrayContaining([`${P}/core/x`, P, `${P}/y`, `${P}/z`, `${P}/w`]),
    );
    expect(found).not.toContain("zod");
    expect(found).not.toContain(`./${P}-local.ts`);
  });
  it("findSelfImportsInText returns nothing for a clean text", () => {
    expect(findSelfImportsInText('import x from "zod";', "spatial-core")).toEqual([]);
  });
});

describe("R-FND-10.15 / R-FND-08.2 no app names in the scenario schema", () => {
  it("every file under core/model/ has no app name in its path or content (R-GRAPH-10.2)", () => {
    const appFolders = readdirSync(join(root, "apps"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const names = [...new Set([...APP_NAMES, ...appFolders])];
    const dir = join(root, "core", "model");
    const files = listFiles(dir);
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      const haystack = `${file}\n${readFileSync(join(dir, file), "utf8")}`.toLowerCase();
      for (const name of names) {
        if (haystack.includes(name.toLowerCase())) hits.push(`${file}: ${name}`);
      }
      for (const name of findAppNames(haystack)) {
        if (!hits.includes(`${file}: ${name}`)) hits.push(`${file}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });
  it("findAppNames is case-insensitive and reports names", () => {
    expect(findAppNames("// Robot helper in the Mansion")).toEqual(["robot", "mansion"]);
    expect(findAppNames("Ghost Mansion and MOODWALK and Mood Curve")).toEqual([
      "ghost",
      "mansion",
      "mood curve",
      "moodwalk",
      "ghost mansion",
    ]);
  });
  it("findAppNames returns nothing for a generic text", () => {
    expect(findAppNames("scenario schemaVersion id title")).toEqual([]);
  });
});

describe("R-FND-02.7 dependency list", () => {
  it("real package.json passes checkDependencies", () => {
    expect(checkDependenciesInFile(root)).toEqual([]);
  });
  it("rejects an extra dependency", () => {
    expect(checkDependencies({ devDependencies: { eslint: "9.37.0", lodash: "4.0.0" } })).toEqual([
      "dependency not allowed: lodash",
    ]);
  });
  it("rejects a ranged, too-old, or missing eslint", () => {
    expect(checkDependencies({ devDependencies: { eslint: "^9.37.0" } })[0]).toContain("exact");
    expect(checkDependencies({ devDependencies: { eslint: "9.36.9" } })[0]).toContain(">= 9.37.0");
    expect(checkDependencies({ devDependencies: { zod: "1.0.0" } })).toEqual(["eslint is not listed"]);
  });
  it("accepts exact eslint at or above the minimum", () => {
    expect(checkDependencies({ devDependencies: { eslint: "9.37.0" } })).toEqual([]);
    expect(checkDependencies({ devDependencies: { eslint: "10.15.0" } })).toEqual([]);
  });
});
