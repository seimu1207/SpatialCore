import { access, mkdir, rename, rmdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

export const PUBLIC_ORIGIN = "https://seimu1207.github.io";
export const BASE_PATH = "/SpatialCore/";

const APP_NAMES = ["ghost-mansion", "moodwalk"] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Vite writes dist/apps/<app>/index.html. Move each page to dist/<app>/index.html.
// Asset references use the absolute base path, so moving the HTML does not break them.
function flattenAppPages(): Plugin {
  let outDir = "";
  return {
    name: "flatten-app-pages",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle(error?: Error) {
      // On a failed build, stay silent so the original error is the one shown.
      if (error) return;
      const sources = APP_NAMES.map((name) => ({
        name,
        from: resolve(outDir, "apps", name, "index.html"),
      }));
      for (const source of sources) {
        if (!(await exists(source.from))) return;
      }
      for (const { name, from } of sources) {
        await mkdir(resolve(outDir, name), { recursive: true });
        await rename(from, resolve(outDir, name, "index.html"));
      }
      for (const { name } of sources) {
        await rmdir(resolve(outDir, "apps", name));
      }
      await rmdir(resolve(outDir, "apps"));
    },
  };
}

export default defineConfig({
  base: BASE_PATH,
  appType: "mpa",
  build: {
    outDir: "dist",
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        "ghost-mansion": resolve(import.meta.dirname, "apps/ghost-mansion/index.html"),
        moodwalk: resolve(import.meta.dirname, "apps/moodwalk/index.html"),
      },
    },
  },
  plugins: [flattenAppPages()],
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    watch: false,
  },
});
