# Implementation Plan: repo-foundation

## Overview

Language: TypeScript (design.md uses TypeScript). Order: toolchain, layout, schema, pages and build, test setup, sensors (each with its tests), repo-level tests, `check:build`, hooks, README, deploy workflow, then the human verification gate. The build works from the pages task. The public URL exists only after the workflow, the Pages setting, and the human's first push.

Conventions for every task:
- Requirement IDs `X.Y` mean R-FND-X.Y. "Design:" names the design.md section used.
- Tests and PBT run only when a task is completed (tech.md). Commands: `npm test`, `npm run typecheck`, `npm run lint`.
- Decisions found during a task go into `docs/decision-log.md` as one line: `date | section | decision | reason`.
- Do not commit or push unless the human says so.

## Tasks

- [x] 1. Toolchain and root files
  - [x] 1.1 Pin toolchain and create root config files
    - Look up the latest 26.x LTS Node.js patch. Write the exact `MAJOR.MINOR.PATCH` string in `.nvmrc` and `engines.node`.
    - Create `package.json` (`"type": "module"`, no `imports` field, exact ESLint ≥ 9.37.0, dependencies limited to the R-FND-02.7 list; React and the React plugin are not installed in this spec), `package-lock.json` (via `npm install`), `tsconfig.json` (as in design.md, no `paths`), `.gitignore` (`node_modules/`, `dist/` only).
    - Add all seven npm scripts from the design table (`build`, `test`, `typecheck`, `lint`, `check:sections`, `check:schema`, `check:build`). Scripts that point to files made later are fine.
    - Check that `LICENSE` is the unmodified MIT text with one line naming a year and a holder. Fix only if it is not.
    - **Confirm:** the Vite major that was installed and its input key (`build.rollupOptions.input` or `build.rolldownOptions.input`). Record Node patch, Vite major, input key in `docs/decision-log.md`.
    - Design: Toolchain, Build: Vite multi-page.
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.8, 2.10, 4.8, 4.9, 12.1, 12.6_
    - Done when: `npm ci` exits 0 and leaves `package-lock.json` unchanged; `git status` shows no untracked file from `node_modules/`.

  - [x] 1.2 Create folder layout and placeholder documents
    - Create `core/model/`, `core/view/`, `apps/ghost-mansion/{scenarios,rules,theme}/`, `apps/moodwalk/{scenarios,rules,theme}/`, `scripts/sensors/`, `.kiro/hooks/`, `.kiro/agents/`, `.kiro/skills/`, `.github/workflows/`. Put an empty `.gitkeep` only in folders that will otherwise hold no tracked file.
    - Create one `placeholder.json` in each `apps/<app>/scenarios/` (content from design.md Data Models).
    - Create `docs/process.md` and `docs/judges-tldr.md`: one level-1 heading and one English sentence stating the purpose.
    - Do not create a folder for `new-app-template`.
    - Design: Repository tree after this spec.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.3_
    - Done when: `git ls-files` shows at least one file in each required folder; `apps/` has exactly two subfolders.

- [x] 2. Schema, pages and build
  - [x] 2.1 Implement Scenario_Schema
    - Create `core/model/scenario-schema.ts` with `localizedTextSchema`, `scenarioSchema`, and their types, as in design.md Data Models. No app names in the file, in names, comments, or messages.
    - Design: Data Models, Core / app interface.
    - _Requirements: 8.1, 8.2_

  - [x] 2.2 Implement the simple-page renderer
    - Depends on 2.1 (imports the `LocalizedText` type).
    - Create `core/view/simple-page.ts` with `SimplePage` and `renderSimplePage(root, page)`. It sets `document.title`, writes one `h1`, an optional `p`, and links, always using `text.en`. Import `LocalizedText` as a type only. No app names.
    - Design: Pages.
    - _Requirements: 3.6, 3.7_

  - [x] 2.3 Create the top page and the two empty apps
    - Create `index.html`, `apps/top-page.ts`, `apps/ghost-mansion/{index.html,main.ts,text.ts}`, `apps/moodwalk/{index.html,main.ts,text.ts}`. HTML files hold no visible text. Every visible string comes from a `LocalizedText` in `text.ts`. Links use `import.meta.env.BASE_URL`.
    - Design: Pages, Safety (S-FND-2).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
    - Done when: `npx tsc --noEmit -p tsconfig.json` exits 0.

  - [x] 2.4 Create `vite.config.ts` with `flattenAppPages`
    - Create `vite.config.ts`: export `PUBLIC_ORIGIN` and `BASE_PATH`, set `base`, `appType: "mpa"`, `build.outDir`, the three inputs (using the key recorded in task 1.1), and the `flattenAppPages` plugin (`closeBundle`, skips when the error argument is set or the source file is missing, uses `fs.rmdir` for `dist/apps`).
    - **Confirm (flattenAppPages):** temporarily put a syntax error in `apps/moodwalk/main.ts`, run `npm run build`, check that the error names that file and that no `flattenAppPages` error appears, then remove the syntax error. Record the result in `docs/decision-log.md`.
    - Design: Build: Vite multi-page, Pages, Safety (S-FND-2, S-FND-3).
    - _Requirements: 2.4, 2.5, 2.6, 2.11, 3.8, 3.9_
    - Done when: `npm run build` writes `dist/index.html`, `dist/ghost-mansion/index.html`, `dist/moodwalk/index.html`, with no `dist/apps`; `npx tsc --noEmit -p tsconfig.json` exits 0.

- [x] 3. Test setup
  - [x] 3.1 Configure Vitest and fast-check
    - Add the `test` field to `vite.config.ts`: `include: ["**/*.test.ts"]`, `exclude: ["node_modules/**", "dist/**"]`, `watch: false`. `npm test` stays `vitest run`.
    - Confirm fast-check imports in a `.test.ts` file with `tsc` (done by the first property test in 4.2).
    - Design: Build: Vite multi-page (Vitest settings), Testing Strategy.
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 4. Required-sections sensor
  - [x] 4.1 Implement the sensor and CLI
    - Create `scripts/sensors/required-sections.ts` (`checkRequiredSections`, `isSpecDocumentPath`; the fence and heading algorithm from design.md) and `required-sections.cli.ts` (no argument: all Spec_Documents, no early stop; one argument: that file; bad argument: exit 2). Pure function does no file reads and no exits. Use erasable syntax only.
    - Design: Sensors, Error Handling.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 10.7, 2.10_

  - [x] 4.2 Write property tests P-FND-1 to P-FND-3
    - In `scripts/sensors/required-sections.test.ts`, one test per property, names starting `P-FND-1`, `P-FND-2`, `P-FND-3`, each with `numRuns` ≥ 100 and a `Feature: repo-foundation, Property n` tag comment. Add examples: unclosed fence, long fence, `#Safety`, `## Safety notes`, closing `#` run.
    - **Property 1: P-FND-1 same input gives same result.** **Validates: Requirements 5.1, 5.2**
    - **Property 2: P-FND-2 adding and removing a heading.** **Validates: Requirements 5.1, 5.2, 5.7**
    - **Property 3: P-FND-3 headings in code blocks do not count.** **Validates: Requirements 5.6**
    - Tests that must pass: `required-sections.test.ts`.
    - _Requirements: 10.5, 10.7_

  - [x] 4.3 Write CLI example tests
    - In `scripts/sensors/required-sections.cli.test.ts`: all-files run reports every failing document; single-file pass and fail; missing path and non-spec path exit non-zero and name the reason (R-FND-10.16 for 05.2 and 05.5).
    - Use the real `.kiro/specs/` files only for this spec's own `requirements.md` and `design.md`. All other cases use temporary-project fixtures, so unfinished specs of other Units never break `npm test`.
    - Tests that must pass: `required-sections.cli.test.ts`.
    - _Requirements: 2.9, 5.2, 5.3, 5.4, 5.5, 10.16_

- [x] 5. Schema sensor
  - [x] 5.1 Implement the sensor and CLI
    - Create `scripts/sensors/schema.ts` (`checkScenarioText` returning the `SchemaResult` union with paths like `title.en`) and `schema.cli.ts` (no argument: every `apps/*/scenarios/*.json`, no early stop; one path argument; rejects missing or non-`.json` path; reports no files found). Pure function does no file reads and no exits.
    - Design: Sensors, Data Models, Error Handling.
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 10.7_

  - [x] 5.2 Write property tests P-FND-4, P-FND-5 and constraint examples
    - In `scripts/sensors/schema.test.ts`: P-FND-4 and P-FND-5 (≥ 100 runs, IDs in names). Examples: whitespace-only `id`, whitespace-only `title.en`, `schemaVersion` 0 and 1.5, non-string `ja`, invalid JSON text.
    - **Property 4: P-FND-4 valid scenarios pass.** **Validates: Requirements 8.1, 8.8**
    - **Property 5: P-FND-5 broken scenarios fail with the field path.** **Validates: Requirements 8.7, 8.1**
    - Tests that must pass: `schema.test.ts`.
    - _Requirements: 8.1, 8.6, 8.7, 10.5, 10.16_

  - [x] 5.3 Write CLI example tests
    - Depends on 6.2: the "no files found" case uses a temporary project and the temporary-project helper and exclusion confirm from task 6.2.
    - In `scripts/sensors/schema.cli.test.ts`: the two real placeholder Scenario_Files pass; invalid JSON, schema failure, missing path, non-`.json` path, and "no files found" (temporary project, see the 6.2 note) each exit non-zero with the printed message.
    - Tests that must pass: `schema.cli.test.ts`.
    - _Requirements: 2.9, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 10.16_

- [x] 6. Type-check sensor
  - [x] 6.1 Implement the sensor
    - Create `scripts/sensors/typecheck.ts`: check that `tsconfig.json` exists in the cwd, spawn `process.execPath <repo>/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (path from `import.meta.dirname`, no `require.resolve`), pass output through, exit 0, 1, or 2 as in design.md.
    - Design: Sensors, Error Handling.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Write type-check tests
    - In `scripts/sensors/typecheck.test.ts` (60 s timeout on the `describe`): type error project (06.3), missing `tsconfig.json` (06.5), clean project passes (06.2). For R-FND-06.4, after `npm run typecheck` on the repo, check that no `.js` file exists under `core/`, `apps/`, `scripts/`, and that `dist/` is unchanged if it existed before the run, or still absent if it did not.
    - Create temporary projects only under `node_modules/.cache/fnd-tmp/<test-name>-<random>/`, remove in `afterEach`.
    - **Confirm (temporary-project exclusions):** `tsc` default `exclude` and ESLint's `**/node_modules/` ignore do not skip files in the temporary project. If they do, use the fallback from design.md and record it in `docs/decision-log.md` (also touch `.gitignore` only with that record).
    - Tests that must pass: `typecheck.test.ts`.
    - _Requirements: 2.9, 6.2, 6.3, 6.4, 6.5, 10.16_

- [ ] 7. Boundary rules and lint sensor
  - [x] 7.1 Implement boundary rule generation (`boundary-rules.ts`)
    - Create `scripts/sensors/boundary-rules.ts` (`boundaryConfigs()`, seven disjoint scopes, regexes with `[\x2F\x5C]` separators, `no-restricted-imports` patterns, `no-restricted-syntax` selectors, `[boundary]` message prefix).
    - Design: ESLint config.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.10_

  - [x] 7.2 Create `eslint.config.ts` and confirm config loading and `import x = require()`
    - Create the single root `eslint.config.ts` (`@eslint/js` recommended, `recommendedTypeChecked`, `projectService: true`, then `boundaryConfigs()`).
    - **Confirm (config loading):** `eslint.config.ts` loads through Node type stripping, with `--flag unstable_native_nodejs_ts_config` only if the pinned ESLint still needs it. Fallback: `eslint.config.mjs` with `// @ts-check`. Record the result in `docs/decision-log.md`.
    - **Confirm (`import x = require()`):** `no-restricted-imports` reports it in the pinned ESLint. If not, move it to `no-restricted-syntax` (in `boundary-rules.ts`) and record the choice.
    - Design: ESLint config.
    - _Requirements: 4.5, 4.10, 7.1_

  - [x] 7.3 Implement the lint sensor
    - Create `scripts/sensors/lint.ts`: spawn ESLint's bin from the repo path with `--max-warnings 0 core apps scripts` (plus the flag if 7.2 needs it); exit 0, 1, or 2; add a one-line message when the config cannot be loaded.
    - Design: Sensors, Error Handling.
    - _Requirements: 7.1, 7.3, 7.4, 7.5_
    - Done when: `npm run lint` and `npm run typecheck` exit 0 on the repo.

  - [x] 7.4 Write Linter API tests for the import forms and scopes (R-FND-04.1–04.7)
    - In `scripts/sensors/boundary-rules.test.ts`: import the default export of the committed `eslint.config.ts`; set `projectService: false` on every object that has it and append `tseslint.configs.disableTypeChecked`; use `new Linter({ cwd })` with virtual file paths. Cover: R-FND-04.1 to 04.4 for every import form in 04.5 (static, `import type`, `export … from`, `export *`, `import x = require`, `require()`, `import()` literal and substitution-free template, type-position `import()`), both separators, every scope in the scope table (including `core/x.ts` and `apps/x.tsx`), allowed imports (04.7), and a clean file (04.6).
    - Tests that must pass: `boundary-rules.test.ts`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 10.8_

  - [~] 7.5 Write Linter API tests for R-FND-04.10 forms
    - In `scripts/sensors/boundary-rules.test.ts` (same file as 7.4, added after it): every R-FND-04.10 form, including the substitution-free template that is allowed.
    - Tests that must pass: `boundary-rules.test.ts`.
    - _Requirements: 4.10, 10.8_

  - [~] 7.6 Write lint sensor tests
    - In `scripts/sensors/lint.test.ts` (60 s timeout): temporary project with a plain-JS-valid finding in each of `core/`, `apps/`, `scripts/`, and an `eslint.config.mjs` with `js.configs.recommended` only (07.3); clean project (07.4); broken config (07.5); two runs on the repo give identical output (07.2).
    - Tests that must pass: `lint.test.ts`.
    - _Requirements: 2.9, 7.2, 7.3, 7.4, 7.5, 10.16_

- [x] 8. Repo-level rules
  - [x] 8.1 Implement repo-rule helpers
    - Create `scripts/sensors/repo-rules.ts`: `listFiles`, `findJsFiles`, `findSelfImports`, `findAppNames`, `checkDependencies`.
    - Design: Sensors table.
    - _Requirements: 4.9, 8.2, 10.9, 10.14, 10.15_

  - [x] 8.2 Write repo-rules tests
    - In `scripts/sensors/repo-rules.test.ts`: no `.js/.jsx/.mjs/.cjs` under `core/`, `apps/`, `scripts/` (10.9); no `imports` field (10.10); no `paths` in `tsconfig.json` (10.13); no import starting with the `package.json` name (10.14); no app name in `core/model/scenario-schema.ts`, case-insensitive (10.15); dependency list matches R-FND-02.7 and ESLint is exact and ≥ 9.37.0 (02.7). Add example cases for each helper with a failing input.
    - Tests that must pass: `repo-rules.test.ts`.
    - _Requirements: 2.7, 4.8, 4.9, 8.2, 10.9, 10.10, 10.13, 10.14, 10.15_

- [x] 9. Build output checks
  - [x] 9.1 Implement `check:build`
    - Create `scripts/sensors/build-output.ts` (`checkLayout`, `findBadAssetRefs`, `findForeignUrls`) and `build-output.cli.ts` (walks `dist/`, imports `PUBLIC_ORIGIN` and `BASE_PATH` from `../../vite.config.ts`, fails if `dist/` is missing).
    - **Confirm (URL allowlist):** allow only the `PUBLIC_ORIGIN` origin, `http://www.w3.org/`, and `https://react.dev/errors/`, as decided in design.md. Record "allowlist implemented as designed" (or any change) in `docs/decision-log.md`.
    - Design: check:build scans, Safety (S-FND-1).
    - _Requirements: 2.5, 2.8, 2.11, 3.8, 10.11, 10.12_

  - [x] 9.2 Write build-output tests
    - In `scripts/sensors/build-output.test.ts` (60 s timeout): the three pure scans on small inputs (missing page, `dist/apps` present, asset path outside `/SpatialCore/`, foreign URL, allowed W3C and `react.dev/errors/` URLs); one temporary Vite project with a syntax error that must exit non-zero and name the file (R-FND-02.6). No test reads or depends on the `dist/` of the repo.
    - Tests that must pass: `build-output.test.ts`.
    - _Requirements: 2.5, 2.6, 10.11, 10.12, 10.16_

- [x] 10. PBT failure fixture
  - [x] 10.1 Add the failing-property fixture and wrapper test
    - Create `scripts/sensors/fixtures/pbt-failure.fixture.ts` (property named `P-FND-FAIL` that always fails), `scripts/sensors/fixtures/vitest.fixture.config.ts` (standalone, `include` lists only the fixture file), and `scripts/sensors/fixtures/pbt-failure.fixture.test.ts`. The wrapper spawns `vitest run --config …`, and passes only when the run exits non-zero and its output contains `pbt-failure.fixture.ts`, `P-FND-FAIL`, `Counterexample`, and `seed`.
    - Check that `npm test` does not run the fixture itself and does not recurse.
    - Design: Testing Strategy (PBT failure wrapper).
    - _Requirements: 10.3, 10.4, 10.6, 10.16_
    - Tests that must pass: `pbt-failure.fixture.test.ts`.

- [ ] 11. Kiro hooks
  - [-] 11.1 Implement the dispatcher and create the first hook
    - Create `scripts/sensors/hook-dispatch.ts` (kinds: `sections`, `code`, `schema`, `test`; reads stdin JSON; falls back to no file argument when the path is missing; captures child output; prints nothing on pass; on fail writes captured stdout then stderr to stderr and exits 1; `code` runs lint even if typecheck failed). Let it write the raw stdin payload to `node_modules/.cache/hook-payload.json` while this task is open.
    - Create hook `check-sections-on-save` with the Kiro hook tool (`createHook`, not by hand): PostFileSave, matcher from design.md, command `node scripts/sensors/hook-dispatch.ts sections`.
    - **Confirm (a), hook stdin:** the stdin JSON field that holds the saved path, from the logged payload of one real save.
    - **Confirm (b), [Human]:** does a human save fire PostFileSave? The agent asks the human to save one file in the editor, then reports the result. If only agent writes fire, add the line that human edits rely on CI.
    - Set the dispatcher to use the confirmed field, remove the payload logging, and record (a) and (b) in `docs/decision-log.md`.
    - Design: Kiro hooks.
    - _Requirements: 9.1, 9.6, 9.7_

  - [~] 11.2 Create the other three hooks
    - With the Kiro hook tool create: `check-code-on-save` (matcher for `.ts`/`.tsx` under `core/`, `apps/`, `scripts/`; timeout 180), `check-schema-on-save` (Scenario_File matcher), `test-on-task-done` (PostTaskExec, command `npm test`, timeout 180). No hook runs `check:build`, and none runs tests on save.
    - **[Human]** The hand triggers: trigger each hook once by hand and once with a non-matching file; record the result in `docs/decision-log.md`.
    - Design: Kiro hooks.
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 12. README
  - [~] 12.1 Write `README.md`
    - English. First heading `Haunted Graph Kit`. Public_URL as a link, `/ghost-mansion/` and `/moodwalk/` as relative links, the Node.js version equal to `.nvmrc`, and `npm ci`, `npm run build`, `npm test` in code blocks. No unsourced claims.
    - _Requirements: 12.3, 12.4, 12.5_
    - Design: Safety (S-FND-6).

- [ ] 13. Deploy workflow and Pages
  - [~] 13.1 Write `.github/workflows/deploy.yml`
    - Trigger: push to `main` and `workflow_dispatch`. Permissions `contents: read`, `pages: write`, `id-token: write`. `concurrency: { group: pages, cancel-in-progress: false }`. Job `build`: checkout, `setup-node` with `node-version-file: .nvmrc`, `npm ci`, `git diff --exit-code package-lock.json`, typecheck, lint, `check:sections`, `check:schema`, `npm test`, `npm run build`, `npm run check:build`, `configure-pages`, `upload-pages-artifact` (`path: dist`). Job `deploy`: `needs: build`, `environment: github-pages`, `deploy-pages`. No `secrets.*`. Each step has its own name.
    - Design: Deploy workflow.
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.7_

  - [~] 13.2 **[Human only]** Enable GitHub Pages
    - On GitHub: repository `SpatialCore` → Settings → Pages → Source: **GitHub Actions**. Do this before the first push; otherwise `configure-pages` fails. Also check About → License shows MIT later at the gate.
    - _Requirements: 11.1, 11.4_

- [~] 14. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.
  - _Requirements: 2.9_

- [~] 15. Verification gate (human approves; the agent must not mark this done)
  - Prepared by the agent: the checklist below. The human does the steps marked **[Human]** after the first push to `main` and a successful Deploy_Workflow run.
  - **[Human]** Push when ready; open Actions and check the run is green and the step names are visible (R-FND-11.1, 11.2).
  - **[Human]** Open `https://seimu1207.github.io/SpatialCore/`: product name "Haunted Graph Kit", exactly one link each for Ghost Mansion and Moodwalk (3.1, 11.4).
  - **[Human]** Follow each link: titles "Ghost Mansion" and "Moodwalk", exactly one link back to the Top_Page; back link returns to the Top_Page (3.2, 3.3, 3.4).
  - **[Human]** Open `/ghost-mansion/` and `/moodwalk/` directly, and reload each (3.5).
  - **[Human]** All visible text is English (3.7).
  - **[Human]** Browser network panel: no request to any origin other than `seimu1207.github.io` (3.8).
  - **[Human]** Open a nonexistent path under `/SpatialCore/`: GitHub's not-found page shows, and the three pages still work (3.9).
  - **[Human]** GitHub repository page: About shows license MIT (12.2).
  - **[Human]** Hooks: save one spec file, one `.ts` file, one scenario JSON, and one non-matching file; complete one task; check each hook ran as in R-FND-09 (9.1–9.7).
  - **[Human]** Failed-run check: push a deliberately failing change on a branch or revert after, confirm the workflow stops, names the failed step, and the Public_URL keeps the last Site (11.3). Remove the failing change afterwards.
  - **[Agent: reviewer]** reads the source for 3.6 (every visible string from `LocalizedText`), for 10.4 and 10.7, and for the `core/` boundary, and reports findings.
  - **[Human]** Approve the Unit and add one line to `docs/decision-log.md` (date / Unit / what was checked / result).
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 11.3, 11.4, 12.2_

## Notes

- Commit and push only when the human says so. The first public deploy happens after task 13 (workflow and the Pages setting).
- Tasks are all required; the tests in this spec are required by R-FND-10, so none is marked optional.
- Every "Confirm" item is recorded in `docs/decision-log.md`: Node patch and Vite major (1.1), flattenAppPages (2.4), temporary-project exclusions (6.2), ESLint config loading and `import x = require()` (7.2), URL allowlist (9.1), hook stdin field and human-save behavior (11.1).
- Task 5.3 uses the temporary-project helper from task 6.2, so it is scheduled after 6.2.
- Option: a minimal workflow (build + deploy only) could be placed right after the pages task if an earlier public URL is wanted; decided by the human.
- Failing sensors block acceptance of a change (tech.md), including during Vibe work.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["2.4"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["4.1", "5.1", "6.1", "7.1", "8.1"] },
    { "id": 8, "tasks": ["4.2", "4.3", "5.2", "6.2", "7.2", "8.2", "9.1"] },
    { "id": 9, "tasks": ["5.3", "7.3", "7.4", "9.2", "10.1", "11.1"] },
    { "id": 10, "tasks": ["7.5", "7.6", "11.2", "12.1"] },
    { "id": 11, "tasks": ["13.1"] },
    { "id": 12, "tasks": ["13.2"] },
    { "id": 13, "tasks": ["14"] },
    { "id": 14, "tasks": ["15"] }
  ]
}
```
