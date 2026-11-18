import { access, mkdir, rename, rmdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

export const PUBLIC_ORIGIN = "https://seimu1207.github.io";
export const BASE_PATH = "/SpatialCore/";

// Each built page: where Vite writes it, and where it must end up in dist/.
const PAGE_MOVES = [
  { from: "apps/ghost-mansion/index.html", to: "ghost-mansion/index.html" },
  { from: "apps/moodwalk/index.html", to: "moodwalk/index.html" },
  { from: "core/view/demo/index.html", to: "core-demo/index.html" },
] as const;
// Emptied folders, deepest first. rmdir fails loudly if one is not empty.
const EMPTY_FOLDERS = [
  "apps/ghost-mansion",
  "apps/moodwalk",
  "apps",
  "core/view/demo",
  "core/view",
  "core",
] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Windows can report transient errors right after a write; retry those a few times.
async function retry(action: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const transient = code === "EBUSY" || code === "EPERM" || code === "EACCES";
      if (!transient || attempt >= 5) throw error;
      await new Promise((done) => setTimeout(done, 50 * (attempt + 1)));
    }
  }
}

// Vite writes dist/<source path>/index.html. Move each page to its public path.
// Asset references use the absolute base path, so moving the HTML does not break them.
// Moves run one after another so no two file operations race.
function flattenPages(): Plugin {
  let outDir = "";
  return {
    name: "flatten-pages",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle(error?: Error) {
      // On a failed build, stay silent so the original error is the one shown.
      if (error) return;
      for (const { from } of PAGE_MOVES) {
        if (!(await exists(resolve(outDir, from)))) return;
      }
      for (const { from, to } of PAGE_MOVES) {
        await mkdir(dirname(resolve(outDir, to)), { recursive: true });
        await retry(() => rename(resolve(outDir, from), resolve(outDir, to)));
      }
      for (const folder of EMPTY_FOLDERS) {
        await retry(() => rmdir(resolve(outDir, folder)));
      }
    },
  };
}
export default defineConfig({
  base: BASE_PATH,
  appType: "mpa",
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  build: {
    outDir: "dist",
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        "ghost-mansion": resolve(import.meta.dirname, "apps/ghost-mansion/index.html"),
        moodwalk: resolve(import.meta.dirname, "apps/moodwalk/index.html"),
        "core-demo": resolve(import.meta.dirname, "core/view/demo/index.html"),
      },
    },
  },
  plugins: [flattenPages()],
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    watch: false,
  },
});
