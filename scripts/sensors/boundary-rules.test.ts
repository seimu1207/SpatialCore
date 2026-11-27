import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import config from "../../eslint.config.ts";

const repoRoot = import.meta.dirname + "/../..";

// Committed config with type information switched off, so virtual files need no tsconfig entry.
const testConfig: Linter.Config[] = [
  ...(config as Linter.Config[]).map((c) => {
    const parserOptions = c.languageOptions?.parserOptions as Record<string, unknown> | undefined;
    if (parserOptions && "projectService" in parserOptions) {
      return {
        ...c,
        languageOptions: { ...c.languageOptions, parserOptions: { ...parserOptions, projectService: false } },
      };
    }
    return c;
  }),
  { files: ["**/*.{ts,tsx}"], ...(tseslint.configs.disableTypeChecked as Linter.Config) },
];

const linter = new Linter({ cwd: repoRoot });

export function lintText(source: string, virtualFilePath: string): Linter.LintMessage[] {
  return linter.verify(source, testConfig, { filename: virtualFilePath });
}

/** Boundary findings only: messages that start with `[boundary]` or name it in a restricted-imports text. */
export function boundaryMessages(source: string, virtualFilePath: string): Linter.LintMessage[] {
  return lintText(source, virtualFilePath).filter((m) => m.message.includes("[boundary]"));
}

const fatal = (msgs: Linter.LintMessage[]) => msgs.filter((m) => m.fatal);

// One source text per import form of R-FND-04.5 for a given specifier.
const FORMS: Record<string, (spec: string) => string> = {
  "static import": (s) => `import { a } from "${s}";\nexport const b = a;\n`,
  "import type": (s) => `import type { A } from "${s}";\nexport type B = A;\n`,
  "export { } from": (s) => `export { a } from "${s}";\n`,
  "export * from": (s) => `export * from "${s}";\n`,
  "import x = require()": (s) => `import x = require("${s}");\nexport { x };\n`,
  "require()": (s) => `const x = require("${s}");\nexport { x };\n`,
  "import() literal": (s) => `export const p = import("${s}");\n`,
  "import() template": (s) => `export const p = import(\`${s}\`);\n`,
  "type-position import()": (s) => `export type T = import("${s}").A;\n`,
};

function expectReported(source: string, file: string, specifier: string) {
  const msgs = lintText(source, file);
  expect(fatal(msgs), `parse error in: ${source}`).toEqual([]);
  const hits = msgs.filter((m) => m.message.includes("[boundary]"));
  expect(hits.length, `expected boundary error for ${file}: ${source}`).toBeGreaterThan(0);
  for (const h of hits) {
    expect(h.line).toBeGreaterThanOrEqual(1);
  }
  return { hits, specifier };
}

function expectNotReported(source: string, file: string) {
  const msgs = lintText(source, file);
  expect(fatal(msgs), `parse error in: ${source}`).toEqual([]);
  expect(msgs.filter((m) => m.message.includes("[boundary]"))).toEqual([]);
}

describe("R-FND-04.1-04.7 boundary import rules", () => {
  describe("R-FND-04.1 core/ must not import from apps/ (scopes 1, 2, 3)", () => {
    const files = ["core/model/x.ts", "core/view/x.ts", "core/x.ts", "core/other/x.tsx", "core/model/sub/x.tsx"];
    for (const file of files) {
      for (const [form, make] of Object.entries(FORMS)) {
        it(`R-FND-04.1 ${file}: ${form}`, () => {
          expectReported(make("../apps/x"), file, "../apps/x");
        });
      }
    }
    for (const spec of ["../../apps/x", "..\\apps\\x", "..\\..\\apps\\ghost-mansion\\text.ts", "../apps"]) {
      it(`R-FND-04.1 separators: ${spec}`, () => {
        expectReported(`import "${spec.replaceAll("\\", "\\\\")}";\n`, "core/x.ts", spec);
        expectReported(`export const p = import("${spec.replaceAll("\\", "\\\\")}");\n`, "core/x.ts", spec);
      });
    }
    it("R-FND-04.1 error names line and specifier (restricted-imports form)", () => {
      const msgs = boundaryMessages(`export const a = 1;\nimport { b } from "../apps/x";\n`, "core/x.ts");
      expect(msgs.length).toBeGreaterThan(0);
      expect(msgs[0]?.line).toBe(2);
      expect(msgs[0]?.message).toContain("../apps/x");
      expect(msgs[0]?.ruleId).toBe("no-restricted-imports");
    });
    it("R-FND-04.1 error reports line (syntax form)", () => {
      const msgs = boundaryMessages(`export const a = 1;\nexport const p = import("../apps/x");\n`, "core/x.ts");
      expect(msgs.length).toBeGreaterThan(0);
      expect(msgs[0]?.line).toBe(2);
    });
    it("R-FND-04.1 does not flag names that only contain 'apps' inside a segment", () => {
      expectNotReported(`import "./myapps/x.ts";\nimport "./apps2/x.ts";\n`, "core/x.ts");
    });
  });

  describe("R-FND-04.2 core/model must not import from core/view (scope 1)", () => {
    for (const [form, make] of Object.entries(FORMS)) {
      it(`R-FND-04.2 ${form}`, () => {
        expectReported(make("../view/x.ts"), "core/model/x.ts", "../view/x.ts");
      });
    }
    for (const spec of ["../view/x.ts", "../../view/x.ts", "..\\view\\x.ts", "../view"]) {
      it(`R-FND-04.2 separators: ${spec}`, () => {
        expectReported(`import "${spec.replaceAll("\\", "\\\\")}";\n`, "core/model/x.ts", spec);
      });
    }
    it("R-FND-04.2 error names line and specifier", () => {
      const msgs = boundaryMessages(`\nimport { v } from "../view/x.ts";\n`, "core/model/x.ts");
      expect(msgs[0]?.line).toBe(2);
      expect(msgs[0]?.message).toContain("../view/x.ts");
    });
  });

  describe("R-FND-04.3 core/model forbidden packages (scope 1)", () => {
    const specs = [
      "three",
      "three/examples/jsm/x",
      "three-stdlib",
      "@react-three/fiber",
      "@react-three/drei",
      "@react-three/rapier",
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "../node_modules/x/index.ts",
      "./node_modules/x",
      "..\\node_modules\\x",
    ];
    for (const spec of specs) {
      for (const [form, make] of Object.entries(FORMS)) {
        it(`R-FND-04.3 ${spec}: ${form}`, () => {
          const src = make(spec.replaceAll("\\", "\\\\"));
          expectReported(src, "core/model/x.ts", spec);
        });
      }
    }
    it("R-FND-04.3 error names line and specifier", () => {
      const msgs = boundaryMessages(`\n\nimport * as T from "three";\n`, "core/model/x.ts");
      expect(msgs[0]?.line).toBe(3);
      expect(msgs[0]?.message).toContain("three");
    });
    it("R-FND-04.3 does not flag look-alike package names", () => {
      expectNotReported(`import "reactive";\nimport "threejs-helper";\nimport "./three/x.ts";\n`, "core/model/x.ts");
    });
    it("R-FND-04.3 packages are allowed outside core/model", () => {
      expectNotReported(`import "three";\nimport "react";\nimport "@react-three/fiber";\n`, "core/view/x.tsx");
    });
  });

  describe("R-FND-04.4 apps must not import each other (scopes 4, 5)", () => {
    for (const [form, make] of Object.entries(FORMS)) {
      it(`R-FND-04.4 ghost-mansion -> moodwalk: ${form}`, () => {
        expectReported(make("../moodwalk/x.ts"), "apps/ghost-mansion/x.ts", "../moodwalk/x.ts");
      });
      it(`R-FND-04.4 moodwalk -> ghost-mansion: ${form}`, () => {
        expectReported(make("../ghost-mansion/x.ts"), "apps/moodwalk/x.ts", "../ghost-mansion/x.ts");
      });
    }
    for (const spec of ["..\\moodwalk\\x.ts", "../../moodwalk/x.ts", "../moodwalk"]) {
      it(`R-FND-04.4 separators: ${spec}`, () => {
        expectReported(`import "${spec.replaceAll("\\", "\\\\")}";\n`, "apps/ghost-mansion/sub/x.tsx", spec);
      });
    }
    it("R-FND-04.4 error names line and specifier", () => {
      const msgs = boundaryMessages(`\nimport { m } from "../moodwalk/x.ts";\n`, "apps/ghost-mansion/x.ts");
      expect(msgs[0]?.line).toBe(2);
      expect(msgs[0]?.message).toContain("../moodwalk/x.ts");
    });
  });

  describe("scope coverage (scope table: 7 scopes)", () => {
    it("R-FND-04.1 scope 3: core/x.ts bans apps", () => {
      expectReported(`import "../apps/x.ts";\n`, "core/x.ts", "../apps/x.ts");
    });
    it("R-FND-04.1 scope 2: core/view bans apps but not view-internal or model imports", () => {
      expectReported(`import "../../apps/x.ts";\n`, "core/view/x.ts", "../../apps/x.ts");
      expectNotReported(`import "../model/x.ts";\nimport "./y.ts";\n`, "core/view/x.ts");
    });
    it("R-FND-04.4 scope 6: apps/x.tsx has no segment ban", () => {
      expectNotReported(`import "./ghost-mansion/text.ts";\nimport "./moodwalk/text.ts";\n`, "apps/x.tsx");
      expectNotReported(`import "./ghost-mansion/text.ts";\n`, "apps/top-page.ts");
    });
    it("R-FND-04.4 scope 4 does not ban ghost-mansion, scope 5 does not ban moodwalk", () => {
      expectNotReported(`import "./ghost-mansion/x.ts";\n`, "apps/ghost-mansion/y.ts");
      expectNotReported(`import "./moodwalk/x.ts";\n`, "apps/moodwalk/y.ts");
    });
    it("R-FND-04 scope 7: scripts/ has no segment ban", () => {
      expectNotReported(`import "../../apps/x.ts";\nimport "../../core/view/x.ts";\nimport "three";\n`, "scripts/x.ts");
    });
    it("R-FND-04 scope 7: scripts/ still reports R-FND-04.10 forms", () => {
      const msgs = boundaryMessages(`export const p = (n: string) => import(n);\n`, "scripts/x.ts");
      expect(msgs.length).toBeGreaterThan(0);
    });
  });

  describe("R-FND-04.7 allowed imports report no boundary error", () => {
    for (const [form, make] of Object.entries(FORMS)) {
      it(`R-FND-04.7 apps/ghost-mansion -> core/model, core/view: ${form}`, () => {
        expectNotReported(make("../../core/model/x.ts"), "apps/ghost-mansion/x.ts");
        expectNotReported(make("../../core/view/x.ts"), "apps/ghost-mansion/x.ts");
      });
      it(`R-FND-04.7 apps/moodwalk -> core/model, core/view: ${form}`, () => {
        expectNotReported(make("../../core/model/x.ts"), "apps/moodwalk/x.ts");
        expectNotReported(make("../../core/view/x.ts"), "apps/moodwalk/x.ts");
      });
      it(`R-FND-04.7 core/view -> core/model: ${form}`, () => {
        expectNotReported(make("../model/x.ts"), "core/view/x.ts");
      });
    }
    it("R-FND-04.7 core/model -> core/model", () => {
      expectNotReported(`import { a } from "./y.ts";\nexport const b = a;\n`, "core/model/x.ts");
    });
  });

  describe("R-VIEW-01.3-01.5 core/view/helpers scope", () => {
    const file = "core/view/helpers/a.ts";
    const rejected = [
      "three",
      "react",
      "@react-three/drei",
      "../scene/x.ts",
      "./../scene/x.ts",
      "../../../apps/x/y.ts",
      "../../model/../view/scene/x.ts",
    ];
    for (const spec of rejected) {
      for (const [form, make] of Object.entries(FORMS)) {
        it(`R-VIEW-01.10 rejects ${spec}: ${form}`, () => {
          expectReported(make(spec), file, spec);
        });
      }
    }
    for (const spec of ["../../model/history.ts", "./snap.ts"]) {
      it(`R-VIEW-01.10 accepts ${spec}`, () => {
        expectNotReported(`import { a } from "${spec}";\nexport const b = a;\n`, file);
      });
    }
    it("R-VIEW-01.4 core/view keeps allowing scene and package imports, and still bans apps", () => {
      expectNotReported(`import "../scene/x.ts";\nimport "three";\n`, "core/view/x.ts");
      expectReported(`import "../../apps/x.ts";\n`, "core/view/x.ts", "../../apps/x.ts");
    });
  });

  describe("R-APP1-21.1 ghost-mansion game model scope", () => {
    const file = "apps/ghost-mansion/model/a.ts";
    const rejected = [
      "three",
      "react",
      "../../../core/view/start-view.tsx",
      "../../../core/view/scene/x.ts",
      "../../../core/view/demo/main.tsx",
      "./x.test.ts",
    ];
    for (const spec of rejected) {
      for (const [form, make] of Object.entries(FORMS)) {
        it(`R-APP1-21.1 model rejects ${spec}: ${form}`, () => {
          expectReported(make(spec), file, spec);
        });
      }
    }
    for (const spec of ["../../../core/model/history.ts", "../../../core/view/helpers/theme-schema.ts", "./phase.ts"]) {
      for (const [form, make] of Object.entries(FORMS)) {
        it(`R-APP1-21.1 model accepts ${spec}: ${form}`, () => {
          expectNotReported(make(spec), file);
        });
      }
    }
    it("R-APP1-21.1 model still rejects moodwalk", () => {
      expectReported(`import "../../moodwalk/x.ts";\n`, file, "../../moodwalk/x.ts");
    });
    it("R-APP1-21.1 App page rejects core/view/demo and test files", () => {
      expectReported(`import "../../core/view/demo/main.tsx";\n`, "apps/ghost-mansion/main.ts", "demo");
      expectReported(`import "./x.test.ts";\n`, "apps/ghost-mansion/main.ts", "./x.test.ts");
    });
    it("R-APP1-21.1 App page still allows start-view and core/view", () => {
      expectNotReported(`import "../../core/view/start-view.tsx";\nimport "three";\n`, "apps/ghost-mansion/main.ts");
    });
  });

  describe("R-APP2-14.1-14.2 moodwalk model scope", () => {
    const file = "apps/moodwalk/model/a.ts";
    const rejected = [
      "three",
      "react",
      "@react-three/fiber",
      "../../../core/view/start-view.tsx",
      "../../../core/view/scene/x.ts",
      "../../../core/view/demo/main.tsx",
      "../../../core/view/helpers/../scene/x.ts",
      "../../../core/model/../view/scene/x.ts",
      "./x.test.ts",
      "../../ghost-mansion/x.ts",
    ];
    for (const spec of rejected) {
      for (const [form, make] of Object.entries(FORMS)) {
        it(`R-APP2-14.2 model rejects ${spec}: ${form}`, () => {
          expectReported(make(spec), file, spec);
        });
      }
    }
    for (const spec of ["../../../core/model/series.ts", "../../../core/view/helpers/camera-path.ts", "./mood.ts"]) {
      for (const [form, make] of Object.entries(FORMS)) {
        it(`R-APP2-14.2 model accepts ${spec}: ${form}`, () => {
          expectNotReported(make(spec), file);
        });
      }
    }
    it("R-APP2-14.1 App page rejects core/view/demo and test files with Moodwalk messages", () => {
      const demo = boundaryMessages(`import "../../core/view/demo/main.tsx";\n`, "apps/moodwalk/main.ts");
      expect(demo.length).toBeGreaterThan(0);
      expect(demo.every((m) => m.message.includes("moodwalk") && !m.message.includes("ghost-mansion"))).toBe(true);
      const test = boundaryMessages(`import "./x.test.ts";\n`, "apps/moodwalk/main.ts");
      expect(test.length).toBeGreaterThan(0);
      expect(test.every((m) => m.message.includes("moodwalk") && !m.message.includes("ghost-mansion"))).toBe(true);
    });
    it("R-APP2-14.1 model demo and test-file rejections carry Moodwalk messages", () => {
      for (const spec of ["../../../core/view/demo/main.tsx", "./x.test.ts"]) {
        const msgs = boundaryMessages(`import "${spec}";\n`, file);
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs.some((m) => m.message.includes("moodwalk must not import"))).toBe(true);
        expect(msgs.some((m) => m.message.includes("ghost-mansion must not"))).toBe(false);
      }
    });
    it("R-APP2-14.1 App page still allows start-view and core/view", () => {
      expectNotReported(`import "../../core/view/start-view.tsx";\nimport "three";\n`, "apps/moodwalk/main.ts");
    });
  });

  describe("R-FND-04.6 clean file", () => {
    it("R-FND-04.6 a clean file reports no finding at all", () => {
      const msgs = lintText(`export const answer: number = 42;\n`, "core/model/x.ts");
      expect(msgs).toEqual([]);
    });
    it("R-FND-04.6 a clean file with allowed imports reports no finding", () => {
      expect(lintText(`import { a } from "./y.ts";\nexport const b = a;\n`, "core/model/x.ts")).toEqual([]);
    });
  });
});
