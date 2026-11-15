import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkLayout, findBadAssetRefs, findForeignUrls } from "./build-output.ts";
import { makeTmpProject, repoRoot, runSensor, type TmpProject } from "./tmp-project.ts";

const BASE = "/SpatialCore/";
const ORIGIN = "https://seimu1207.github.io";
const ALLOW = ["http://www.w3.org/", "https://react.dev/errors/"] as const;
const PAGES = ["index.html", "ghost-mansion/index.html", "moodwalk/index.html"];
const GOOD_HTML = `<html><head><script type="module" src="${BASE}assets/a.js"></script></head><body></body></html>`;

function fakeDist(extra: Record<string, string> = {}): Record<string, string> {
  const files: Record<string, string> = { "dist/assets/a.js": "export {};" };
  for (const page of PAGES) files[`dist/${page}`] = GOOD_HTML;
  for (const [k, v] of Object.entries(extra)) files[`dist/${k}`] = v;
  return files;
}

describe("build-output", { timeout: 60_000 }, () => {
  const projects: TmpProject[] = [];
  afterEach(() => {
    for (const p of projects.splice(0)) p.cleanup();
  });
  const tmp = (name: string, files: Record<string, string>) => {
    const p = makeTmpProject(name, files);
    projects.push(p);
    return p;
  };

  describe("checkLayout", () => {
    it("passes with all pages", () => {
      expect(checkLayout([...PAGES, "assets/a.js"])).toEqual([]);
    });
    it("reports a missing page", () => {
      const findings = checkLayout(["index.html", "moodwalk/index.html"]);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toContain("ghost-mansion/index.html");
    });
    it("reports dist/apps, including an empty folder entry", () => {
      expect(checkLayout([...PAGES, "apps"]).join("\n")).toContain("dist/apps");
      expect(checkLayout([...PAGES, "apps/moodwalk/index.html"]).join("\n")).toContain("dist/apps");
    });
  });

  describe("findBadAssetRefs", () => {
    const files = new Set(["assets/a.js"]);
    it("accepts a path under the base that exists", () => {
      expect(findBadAssetRefs(GOOD_HTML, BASE, files)).toEqual([]);
    });
    it("reports a path outside the base path", () => {
      const html = '<script src="/assets/a.js"></script>';
      expect(findBadAssetRefs(html, BASE, files)).toHaveLength(1);
    });
    it("reports a file that is not in dist", () => {
      const html = `<link href="${BASE}assets/missing.css">`;
      expect(findBadAssetRefs(html, BASE, files)[0]).toContain("no such file");
    });
  });

  describe("findForeignUrls", () => {
    it("reports a foreign URL", () => {
      expect(findForeignUrls("fetch('https://example.com/x')", ORIGIN, ALLOW)).toEqual(["https://example.com/x"]);
    });
    it("allows the public origin, W3C namespace and react.dev/errors", () => {
      const text = `${ORIGIN}/SpatialCore/ http://www.w3.org/2000/svg https://react.dev/errors/418`;
      expect(findForeignUrls(text, ORIGIN, ALLOW)).toEqual([]);
    });
    it("does not allow other react.dev paths", () => {
      expect(findForeignUrls("https://react.dev/learn", ORIGIN, ALLOW)).toHaveLength(1);
    });
  });

  describe("CLI exit codes (R-FND-02.9)", () => {
    it("exits 0 for a good fake dist", () => {
      const p = tmp("bo-pass", fakeDist());
      const r = runSensor("build-output.cli.ts", p.dir, [join(p.dir, "dist")]);
      expect(r.status).toBe(0);
    });
    it("exits 1 and names the problem for a missing page", () => {
      const files = fakeDist();
      delete files["dist/moodwalk/index.html"];
      const p = tmp("bo-missing", files);
      const r = runSensor("build-output.cli.ts", p.dir, [join(p.dir, "dist")]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("moodwalk/index.html");
    });
    it("exits 1 for a foreign URL", () => {
      const p = tmp("bo-foreign", fakeDist({ "assets/a.js": 'fetch("https://example.com/x")' }));
      const r = runSensor("build-output.cli.ts", p.dir, [join(p.dir, "dist")]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("https://example.com/x");
    });
    it("exits 1 when the scanned folder is missing", () => {
      const p = tmp("bo-nodist", { "x.txt": "x" });
      const r = runSensor("build-output.cli.ts", p.dir, [join(p.dir, "dist")]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("dist/ is missing");
    });
  });

  describe("R-FND-02.6 build error", () => {
    it("exits non-zero and names the file with the syntax error", () => {
      const p = tmp("bo-vite", {
        "index.html": '<!doctype html><html><body><script type="module" src="/main.ts"></script></body></html>',
        "main.ts": "const = ;\n",
      });
      const viteBin = join(repoRoot, "node_modules", "vite", "bin", "vite.js");
      const r = spawnSync(process.execPath, [viteBin, "build"], {
        cwd: p.dir,
        encoding: "utf8",
      });
      const out = r.stdout + r.stderr;
      expect(r.status).not.toBe(0);
      expect(out).toContain("main.ts");
    });
  });
});
