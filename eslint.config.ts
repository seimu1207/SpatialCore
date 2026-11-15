import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { boundaryConfigs } from "./scripts/sensors/boundary-rules.ts";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  {
    files: ["core/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...boundaryConfigs(),
);
