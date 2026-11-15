import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Standalone config: does not extend vite.config.ts. Runs only the failing fixture.
export default defineConfig({
  root: resolve(import.meta.dirname, "../../.."),
  test: {
    include: ["scripts/sensors/fixtures/pbt-failure.fixture.ts"],
    watch: false,
  },
});
