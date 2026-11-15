# Requirements Document

## Introduction

`repo-foundation` is the preparation step before Unit 1 (intent.md 10.2, 10.6). It sets up the repository layout (intent.md ch. 11), the four sensors in `scripts/sensors/` (intent.md 10.3), the hooks that call them, two empty apps (`apps/ghost-mansion/`, `apps/moodwalk/`), and publishing to GitHub Pages.

Completion criterion (intent.md 10.6): the top page and the two empty apps open at the public URL. This is "submittable state ①".

The scope gate is recorded in `docs/decision-log.md` (2026-11-13).

Each acceptance criterion is verified by one of these methods: a test in R-FND-10, a `check:*` script, a file inspection (for example `git ls-files` or reading a workflow or hook file), a reviewer-agent reading of the source, or a manual check on the Public_URL. design.md maps each criterion to one method, and tasks.md uses that mapping. Criteria that name a manual check or a reviewer reading are marked as such in their text. Criteria R-FND-01.1 to R-FND-01.7, R-FND-12.1, R-FND-12.3, R-FND-12.4, R-FND-12.5, and R-FND-12.6 are verified by file inspection and `git ls-files`.

Checks for publishing (R-FND-11) are performed by each Deploy_Workflow run itself, not by a separate test.

Out of scope for this spec:
- Any `core/model` or `core/view` feature (Node, Edge, Zone, RuleEngine, Timeline, 3D rendering). These belong to the `core` spec. This spec creates only the folders and the minimal scenario schema that the schema sensor needs.
- Any game or board content in the apps.
- The `submission-pack` skill and the `new-app-template` spec.
- Checks done by the `reviewer` agent instead of sensors: requirement coverage, claim sources, app names written inside `core/`.

## Glossary

- **Repository**: the public GitHub repository of Haunted Graph Kit.
- **Build_System**: the single Vite project at the repository root, with `package.json`, `tsconfig.json`, `vite.config.ts`, and the ESLint config.
- **Site**: the static site produced by the Build_System and served on GitHub Pages.
- **Build_Output**: the folder `dist/` that `npm run build` writes and that `check:build` scans.
- **Top_Page**: `index.html` at the root of the Site; it lets the visitor choose an app.
- **Ghost_Mansion_App**: the empty app served at `/ghost-mansion/`, source in `apps/ghost-mansion/`.
- **Moodwalk_App**: the empty app served at `/moodwalk/`, source in `apps/moodwalk/`.
- **Empty_App**: either Ghost_Mansion_App or Moodwalk_App in its placeholder state (title and a link back to the Top_Page, no features).
- **Localized_Text**: a text value stored as `{ en, ja }`, where `en` is required and shown by default.
- **Sensor**: a script in `scripts/sensors/` that checks one thing, prints its findings, and exits with code 0 on pass and a non-zero code on fail.
- **Required_Sections_Sensor**: the Sensor that checks spec documents for required headings.
- **Type_Check_Sensor**: the Sensor that runs `tsc --noEmit`.
- **Lint_Sensor**: the Sensor that runs ESLint with typescript-eslint.
- **Schema_Sensor**: the Sensor that validates scenario JSON files with Zod.
- **Spec_Document**: a file `.kiro/specs/<spec>/requirements.md` or `.kiro/specs/<spec>/design.md`.
- **Source_File**: a file with the extension `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, or `.cjs` that lies under `core/`, `apps/`, or `scripts/`.
- **Required_Heading**: a heading line as defined in R-FND-05.7 whose text, trimmed and compared case-insensitively, equals `PBT properties` or `Safety`.
- **Scenario_File**: a `.json` file under `apps/<app>/scenarios/`.
- **Scenario_Schema**: the Zod schema for Scenario_Files, defined in `core/model/scenario-schema.ts`. In this spec it holds only a minimal envelope; the `core` spec extends it.
- **Hook**: a file in `.kiro/hooks/` that calls a Sensor or the test command on a Kiro event.
- **Test_Command**: `npm test`, which runs Vitest once (no watch mode), including fast-check properties. It does not run `check:build`.
- **Deploy_Workflow**: the GitHub Actions workflow that builds the Site and publishes it to GitHub Pages.
- **Public_URL**: the GitHub Pages URL of the Site, `https://seimu1207.github.io/SpatialCore/`.
- **Public_URL base path**: `/SpatialCore/`, the path part of the Public_URL. The Build_System uses it as the Vite `base` setting, and every asset path in the Site starts with it.

## Requirements

### Requirement 1: Repository layout (R-FND-01)

**User Story:** As the developer, I want the folder layout from intent.md ch. 11 to exist from day one, so that every later spec has a fixed place for its files.

#### Acceptance Criteria

1. THE Repository SHALL contain the folders `core/model/`, `core/view/`, `apps/ghost-mansion/`, `apps/moodwalk/`, `scripts/sensors/`, `docs/`, `.kiro/steering/`, `.kiro/specs/`, `.kiro/hooks/`, `.kiro/agents/`, and `.kiro/skills/`, and each of these folders SHALL contain at least one file tracked in Git, so that the folder still exists in a fresh clone of the Repository.
2. THE Repository SHALL contain the folders `scenarios/`, `rules/`, and `theme/` inside both `apps/ghost-mansion/` and `apps/moodwalk/`, and each of these 6 folders SHALL contain at least one file tracked in Git.
3. THE Repository SHALL contain at its root exactly one each of `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `README.md`, and `LICENSE`, and exactly one ESLint config file, with no second ESLint configuration in any other file at the root or in any subfolder.
4. THE Repository SHALL contain `docs/intent.md`, `docs/decision-log.md`, `docs/process.md`, and `docs/judges-tldr.md`, where `docs/process.md` and `docs/judges-tldr.md` are English placeholders that each contain exactly one level-1 heading and at least one English sentence stating the purpose of the document.
5. THE Repository SHALL keep the `apps/` folder limited to exactly two subfolders, `ghost-mansion/` and `moodwalk/`, with no folder for `new-app-template`.
6. THE Repository SHALL keep `.kiro/` at the repository root, and no pattern in any `.gitignore` file in the Repository SHALL match `.kiro/` or any path inside `.kiro/`.
7. THE Repository SHALL limit the top-level folders tracked in Git to `.kiro/`, `.github/`, `core/`, `apps/`, `scripts/`, and `docs/`.

### Requirement 2: Build system and toolchain (R-FND-02)

**User Story:** As the developer, I want one pinned toolchain at the root, so that builds behave the same on my machine and in GitHub Actions.

#### Acceptance Criteria

1. THE Build_System SHALL use npm with a committed `package-lock.json`, and running `npm ci` on a clean checkout SHALL exit with code 0 and leave `package-lock.json` unchanged (checked by the lock-file step in R-FND-11.3).
2. THE Build_System SHALL pin Node.js to the latest 26.x LTS patch version available at implementation time, written as one exact `MAJOR.MINOR.PATCH` string with no range operators, and SHALL write that same string in `.nvmrc` and in the `engines.node` field of `package.json`. WHEN that patch version is set, THE Repository SHALL record it in `docs/decision-log.md`.
3. THE Build_System SHALL compile TypeScript with `strict` enabled in the root `tsconfig.json`, and that config SHALL cover every `.ts` and `.tsx` file under `core/`, `apps/`, and `scripts/`, and no other file type.
4. THE Build_System SHALL build one multi-page Vite project with exactly three entry pages: `index.html`, `apps/ghost-mansion/index.html`, and `apps/moodwalk/index.html`.
5. WHEN `npm run build` is run, THE Build_System SHALL write the Site to one output folder named `dist/`, in which the Top_Page is written to `dist/index.html`, Ghost_Mansion_App to `dist/ghost-mansion/index.html`, and Moodwalk_App to `dist/moodwalk/index.html`. Relative to the Public_URL base path, these pages are served at `/`, `/ghost-mansion/`, and `/moodwalk/`. The design phase chooses how the build reaches these output paths (for example with a post-build step), whatever Vite does by default. No page SHALL be served under an `/apps/` path, and every script, style, and asset reference in the three pages SHALL resolve under the Public_URL base path. Checked by R-FND-10.11.
6. IF `npm run build` hits a compile or bundling error, THEN THE Build_System SHALL exit with a non-zero code and print the error with the file name it came from (checked by an example test in R-FND-10.16).
7. THE Build_System SHALL list in `dependencies` and `devDependencies` only these packages: TypeScript, Vite, React, react-dom, the Vite plugin for React, Vitest, fast-check, ESLint with typescript-eslint, Zod, `@types/node` (the type definitions for Node.js used by `scripts/sensors/`), the type-definition packages for these tools, and the ESLint config packages that ESLint and typescript-eslint publish. Each listed package SHALL map to one of these tools. THE ESLint version SHALL be 9.37.0 or later, and `package.json` SHALL pin it as an exact version with no range operator. React Three Fiber and drei are not listed here; the `core` spec adds them.
8. THE Build_System SHALL provide the npm scripts `build`, `test`, `typecheck`, `lint`, `check:sections`, `check:schema`, and `check:build`. `test` SHALL run the Test_Command once with no watch mode, `typecheck` SHALL run the Type_Check_Sensor, `lint` SHALL run the Lint_Sensor, `check:sections` SHALL run the Required_Sections_Sensor, `check:schema` SHALL run the Schema_Sensor, and `check:build` SHALL run the build output scans of R-FND-10.11 and R-FND-10.12 on the output folder `dist/` written by `build`. `check:build` SHALL run only after `build`.
9. WHEN any npm script listed in criterion 8 finishes, THE Build_System SHALL exit with code 0 if its check passed and with a non-zero code if it failed.
10. THE Build_System SHALL run the TypeScript files in `scripts/sensors/` with Node.js's built-in type stripping, SHALL use only erasable TypeScript syntax in those files (no `enum`, no `namespace` with runtime code, and no parameter properties), and SHALL add no other tool to run them.
11. THE `vite.config.ts` SHALL define the Public_URL origin, `https://seimu1207.github.io`, as one constant, and THE scan in R-FND-10.12 SHALL read that constant. THE design phase SHALL decide whether any URL outside the Public_URL origin and the `http://www.w3.org/` namespace, such as an error-explanation URL in React DOM output, is allowed by that scan, and SHALL record the decision in design.md.

### Requirement 3: Top page and empty apps (R-FND-03)

**User Story:** As a judge, I want to open the public URL and reach both apps, so that I can see that the two apps exist and run without any install.

#### Acceptance Criteria

1. WHEN a visitor opens the Public_URL, THE Top_Page SHALL show the product name "Haunted Graph Kit", exactly one link labeled with the Ghost_Mansion_App title, and exactly one link labeled with the Moodwalk_App title (manual check on the Public_URL).
2. WHEN a visitor follows the Ghost_Mansion_App link on the Top_Page, THE Site SHALL show the Ghost_Mansion_App page at `/ghost-mansion/` under the Public_URL base path, with the title "Ghost Mansion" and exactly one link whose target is the Top_Page (manual check on the Public_URL).
3. WHEN a visitor follows the Moodwalk_App link on the Top_Page, THE Site SHALL show the Moodwalk_App page at `/moodwalk/` under the Public_URL base path, with the title "Moodwalk" and exactly one link whose target is the Top_Page (manual check on the Public_URL).
4. WHEN a visitor follows the link back to the Top_Page from either Empty_App, THE Site SHALL show the Top_Page at the Public_URL base path (manual check on the Public_URL).
5. WHEN a visitor opens `/ghost-mansion/` or `/moodwalk/` under the Public_URL base path directly (typed address, bookmark, or page reload), THE Site SHALL show the same Empty_App page that it shows when the visitor arrives through the Top_Page link (manual check on the Public_URL).
6. THE Top_Page and each Empty_App SHALL take every visible UI string (page title, headings, link labels, body text) from a Localized_Text value. No visible string SHALL be written as a literal outside Localized_Text. This criterion is verified by the reviewer agent, which reads the source files and confirms every visible string comes from a Localized_Text value (manual source review).
7. WHEN the Top_Page or an Empty_App loads, THE Site SHALL show the `en` value of every Localized_Text on that page. This criterion is verified by a manual check on the Public_URL, listed in the checklist in tasks.md (created in the tasks phase), not by a test.
8. THE Site SHALL run in a desktop browser as static files served by GitHub Pages. It SHALL have no server-side code, no login, no API key, and no request to any origin other than the Public_URL's origin. The build output is checked by R-FND-10.12 through `check:build`. Runtime requests are checked in the browser's network panel on the Public_URL (manual check on the Public_URL).
9. IF a visitor opens a path under the Public_URL base path that is not the Top_Page, `/ghost-mansion/`, `/moodwalk/`, or a built asset, THEN THE Site SHALL respond with the host's not-found page and SHALL leave the Top_Page and both Empty_Apps reachable at their own paths (manual check on the Public_URL).

### Requirement 4: Core and app boundary in the lint rules (R-FND-04)

**User Story:** As the developer, I want the import direction between `core/` and `apps/` checked on every save, so that the core never comes to depend on an app.

#### Acceptance Criteria

1. IF a Source_File under `core/` has an import whose specifier contains an `apps` path segment, where `/` or `\` separates path segments (for example `../apps/x`, `../../apps/x`, or `..\apps\x`), THEN THE Lint_Sensor SHALL report an error that names the file path, the line number, and the import specifier, and SHALL exit with a non-zero code.
2. IF a Source_File under `core/model/` has an import whose specifier contains a `view` path segment, where `/` or `\` separates path segments, THEN THE Lint_Sensor SHALL report an error that names the file path, the line number, and the import specifier, and SHALL exit with a non-zero code.
3. IF a Source_File under `core/model/` has an import whose specifier is `three`, `react`, or `react-dom`, or is a subpath of one of them (`three/*`, `react/*`, or `react-dom/*`), or is `@react-three/*`, or starts with `three-` (for example `three-stdlib`), or is a relative specifier that contains a `node_modules` path segment, where `/` or `\` separates path segments, THEN THE Lint_Sensor SHALL report an error that names the file path, the line number, and the import specifier, and SHALL exit with a non-zero code.
4. IF a Source_File under `apps/ghost-mansion/` has an import whose specifier contains a `moodwalk` path segment, or a Source_File under `apps/moodwalk/` has an import whose specifier contains a `ghost-mansion` path segment, where `/` or `\` separates path segments, THEN THE Lint_Sensor SHALL report an error that names the file path, the line number, and the import specifier, and SHALL exit with a non-zero code.
5. THE Lint_Sensor SHALL treat each of the following forms as an import for criteria 1 to 4, whether the specifier is a relative path or a package name: static `import` declarations (including `import type`), `import x = require(...)`, `export ... from` and `export * from` declarations, `require("...")` calls, dynamic `import()` calls whose argument is a string literal or a template literal without substitutions, and a type-level `import("...")` in a type position. THE committed ESLint config SHALL check the static forms (`import` and `export ... from`) with the ESLint built-in rule `no-restricted-imports`, which inspects import specifiers. THE committed ESLint config SHALL check `import x = require(...)` with either `no-restricted-imports` or `no-restricted-syntax`, and THE design phase SHALL record that choice in design.md. THE committed ESLint config SHALL check the other forms with the ESLint built-in rule `no-restricted-syntax`, which inspects syntax nodes, and SHALL match the specifier with a pattern that accepts both `/` and `\` as separators. THE design phase SHALL choose the exact selectors for both rules. R-FND-10.8 tests every form listed in this criterion, so a form that the design phase has not verified fails R-FND-10.8. Both rules SHALL be used with the ESLint version in R-FND-02.7.
6. WHEN the Lint_Sensor runs on a Repository with no boundary error and no other ESLint error or warning, THE Lint_Sensor SHALL exit with code 0.
7. THE Lint_Sensor SHALL report no boundary error for imports of `core/model/` or `core/view/` from files under `apps/ghost-mansion/` or `apps/moodwalk/`, or for imports of `core/model/` from files under `core/view/`.
8. THE `tsconfig.json` SHALL define no `paths` alias, so that every import specifier is either a relative path or a package name. Checked by R-FND-10.13.
9. THE `package.json` SHALL define no `imports` field, and no import specifier in a Source_File under `core/`, `apps/`, or `scripts/` SHALL use this package's own name, so that no subpath or self-reference can point into `apps/` or `core/` without using one of the segments above. THE Repository's tests SHALL check the absence of the `imports` field (R-FND-10.10) and SHALL check that no JavaScript file exists under `core/`, `apps/`, or `scripts/` (R-FND-10.9). The self-reference check is R-FND-10.14.
10. IF a Source_File under `core/`, `apps/`, or `scripts/` calls `import()` or `require()` with an argument that is not a string literal or a template literal without substitutions (a template literal with a substitution is reported), uses `import.meta.glob` or `require.resolve`, calls the result of `createRequire(...)`, calls `module.require(...)`, calls `eval(...)`, uses `new Function(...)`, or uses the global `Function` constructor in any form, THEN THE Lint_Sensor SHALL report a boundary error that names the file path, the line number, and the call, and SHALL exit with a non-zero code.

### Requirement 5: Required-sections sensor (R-FND-05)

**User Story:** As the developer, I want each spec document checked for its required headings on save, so that no requirements or design document lacks a PBT properties or Safety section.

#### Acceptance Criteria

1. WHEN a Spec_Document is checked and the Spec_Document contains at least one Required_Heading whose text equals `PBT properties` and at least one Required_Heading whose text equals `Safety`, at any heading level, THE Required_Sections_Sensor SHALL treat that Spec_Document as passing.
2. IF a checked Spec_Document lacks a Required_Heading for `PBT properties`, a Required_Heading for `Safety`, or both, THEN THE Required_Sections_Sensor SHALL print the path of the Spec_Document and the name of each missing heading, and SHALL exit with a non-zero code.
3. WHEN `npm run check:sections` is run with no file argument, THE Required_Sections_Sensor SHALL check every Spec_Document under `.kiro/specs/`, SHALL print a finding for every failing Spec_Document without stopping at the first failure, SHALL exit with code 0 only if every Spec_Document passes, and SHALL otherwise exit with a non-zero code.
4. WHEN `npm run check:sections` is run with one file path that names a Spec_Document, THE Required_Sections_Sensor SHALL check only that file and SHALL exit with code 0 if that file passes, or with a non-zero code if it fails.
5. IF `npm run check:sections` is run with a file path that does not exist or does not name a Spec_Document, THEN THE Required_Sections_Sensor SHALL print the given path and the reason it was rejected, SHALL exit with a non-zero code, and SHALL check no other file.
6. THE Required_Sections_Sensor SHALL ignore every line inside a fenced code block when looking for Required_Headings. A fence line is a line with up to three leading spaces, followed by three or more backticks or three or more tildes. A fenced code block starts at a fence line. It ends at the next closing fence line: a line with the same fence character, repeated at least as many times as the opening fence, with up to three leading spaces and nothing else on the line. If no closing fence line exists, the block ends at the end of the file.
7. THE Required_Sections_Sensor SHALL count a line as a heading line only if it has up to three leading spaces, then one to six `#` characters, then a space or the end of the line, then the heading text. A closing run of `#` characters at the end of the heading text is not part of the text. THE Required_Sections_Sensor SHALL compare the heading text after trimming and after removing a closing `#` run, so that a line such as `#Safety` or a heading for `Safety notes` does not count as a Required_Heading.

### Requirement 6: Type-check sensor (R-FND-06)

**User Story:** As the developer, I want type errors caught on code save, so that broken types never reach the deployed site.

#### Acceptance Criteria

1. WHEN `npm run typecheck` is run, THE Type_Check_Sensor SHALL run `tsc --noEmit` with the root `tsconfig.json`, so that the check covers every `.ts` and `.tsx` file under `core/`, `apps/`, and `scripts/`.
2. WHEN `tsc --noEmit` reports zero errors, THE Type_Check_Sensor SHALL exit with code 0.
3. IF `tsc --noEmit` reports one or more errors, THEN THE Type_Check_Sensor SHALL exit with a non-zero code and print every reported error with its file path, line number, and error message.
4. WHEN the Type_Check_Sensor finishes, on a pass or a fail, THE Type_Check_Sensor SHALL have written no compiled output files to the Repository. This is checked by a test that runs `npm run typecheck`, then checks that the file list of `dist/` is unchanged (if `dist/` does not exist before the check, it SHALL still not exist after) and that no `.js` file exists under `core/`, `apps/`, or `scripts/`.
5. IF `tsc` cannot start, for example because TypeScript is not installed or the root `tsconfig.json` is missing or invalid, THEN THE Type_Check_Sensor SHALL exit with a non-zero code and print a message that names the cause.

### Requirement 7: Lint sensor (R-FND-07)

**User Story:** As the developer, I want lint run on code save with fixed rules, so that code style and the boundary rules are checked the same way every time.

#### Acceptance Criteria

1. WHEN `npm run lint` is run, THE Lint_Sensor SHALL run ESLint with the typescript-eslint `recommended-type-checked` rule set (the rules that need type information) and the boundary rules of R-FND-04, all taken from the single ESLint config file committed at the repository root, over every Source_File under `core/`, `apps/`, and `scripts/`. The type-aware parser settings are the only parser-level option this criterion requires. The design phase decides how the ESLint config points at `tsconfig.json`.
2. THE Lint_Sensor SHALL produce the same findings for the same files and the same committed ESLint config file on every run, with no rule set or rule severity supplied from outside the committed config. This is checked by the example test in R-FND-10.16 that runs ESLint twice and compares the output.
3. IF ESLint reports one or more errors or one or more warnings, THEN THE Lint_Sensor SHALL exit with a non-zero code and print each finding with its file path, line number, and rule name.
4. WHEN ESLint reports zero errors and zero warnings, THE Lint_Sensor SHALL exit with code 0.
5. IF ESLint cannot complete a run because the ESLint config file is missing or invalid, THEN THE Lint_Sensor SHALL exit with a non-zero code and print a message that names the config problem.

### Requirement 8: Schema sensor and minimal scenario schema (R-FND-08)

**User Story:** As the developer, I want every scenario JSON validated on save against one schema, so that apps never ship a scenario the core cannot load.

#### Acceptance Criteria

1. THE Scenario_Schema SHALL be defined once with Zod in `core/model/scenario-schema.ts` and SHALL require three top-level fields: `schemaVersion` (an integer greater than or equal to 1), `id` (a string of at least 1 character after trimming), and `title` (a Localized_Text whose `en` is a string of at least 1 character after trimming and whose `ja`, if present, is a string). THE Scenario_Schema SHALL ignore each top-level field other than these three, so that a Scenario_File with such a field still passes when the three required fields are valid.
2. THE Scenario_Schema file `core/model/scenario-schema.ts` SHALL contain none of the app-specific names listed in `structure.md` (ghost, robot, mansion, mood curve, Moodwalk, Ghost Mansion), compared case-insensitively, in its field names, type names, comments, or error messages. This criterion is limited to the Scenario_Schema file. The rest of `core/` is checked by the reviewer agent, as listed in Out of scope. Checked by R-FND-10.15.
3. THE Repository SHALL contain exactly one minimal Scenario_File in `apps/ghost-mansion/scenarios/` and exactly one in `apps/moodwalk/scenarios/`, and each SHALL pass the Schema_Sensor with exit code 0.
4. WHEN `npm run check:schema` is run with no file argument, THE Schema_Sensor SHALL validate every Scenario_File under `apps/*/scenarios/` and SHALL report the results for all of them, without stopping at the first invalid file.
5. WHEN `npm run check:schema` is run with one file path, THE Schema_Sensor SHALL validate only that file.
6. IF a checked Scenario_File cannot be parsed as JSON, THEN THE Schema_Sensor SHALL exit with a non-zero code and print the file path and a message saying the JSON could not be parsed.
7. IF a checked Scenario_File parses as JSON but does not match the Scenario_Schema, THEN THE Schema_Sensor SHALL exit with a non-zero code and print the file path, plus the field path and message of each validation error.
8. WHEN every checked Scenario_File matches the Scenario_Schema, THE Schema_Sensor SHALL exit with code 0.
9. IF the file path given to `npm run check:schema` does not exist or does not end in `.json`, THEN THE Schema_Sensor SHALL exit with a non-zero code and print the given path and the reason it was rejected.
10. IF `npm run check:schema` is run with no file argument and no Scenario_File exists under `apps/*/scenarios/`, THEN THE Schema_Sensor SHALL exit with a non-zero code and print a message saying no Scenario_File was found.

### Requirement 9: Hooks that call the sensors and tests (R-FND-09)

**User Story:** As the developer, I want Kiro to run the right check at the right moment, so that I do not have to remember to run them and credits are not spent on tests at every save.

The criteria in this Requirement are verified by reading the hook files and by triggering each Hook once by hand.

#### Acceptance Criteria

1. WHEN a Spec_Document is saved, THE Hook for required-sections SHALL run the Required_Sections_Sensor with the saved file's path as its only file argument.
2. WHEN a `.ts` or `.tsx` file under `core/`, `apps/`, or `scripts/` is saved, THE Hook for code SHALL run the Type_Check_Sensor and then the Lint_Sensor (the Type_Check_Sensor covers TypeScript files only, while the Lint_Sensor covers every Source_File). It SHALL run the Lint_Sensor even if the Type_Check_Sensor exits with a non-zero code.
3. WHEN a Scenario_File is saved, THE Hook for schema SHALL run the Schema_Sensor with the saved file's path as its only file argument.
4. WHEN a task in a spec's `tasks.md` is marked complete, THE Hook for tests SHALL run the Test_Command once.
5. THE Hooks SHALL run the Test_Command only for the task-completion event in criterion 4, and SHALL NOT run it when any file is saved. No Hook SHALL run `check:build`.
6. IF a Sensor or the Test_Command run by a Hook exits with a non-zero code, THEN THE Hook SHALL show that command's printed findings in the Kiro session and report the check as failed.
7. WHEN a file is saved that matches none of the paths in criteria 1–3, THE Hooks SHALL run no Sensor (checked by hand, one save of a non-matching file).

### Requirement 10: Test setup (R-FND-10)

**User Story:** As the developer, I want Vitest and fast-check ready, so that the sensors in this spec and the core PBT in the next spec can be tested right away.

#### Acceptance Criteria

1. WHEN the Test_Command is run, THE Build_System SHALL run every `*.test.ts` file in the Repository, excluding `node_modules/` and `dist/`, exactly once and SHALL exit without entering watch mode. The Test_Command SHALL NOT run `check:build`, so the build output scans of R-FND-10.11 and R-FND-10.12 are not part of it.
2. WHEN the Test_Command finishes and every test passes, THE Build_System SHALL exit with code 0.
3. IF one or more tests fail during the Test_Command, THEN THE Build_System SHALL exit with a non-zero code and print the file path and test name of each failing test.
4. THE Repository SHALL place each `*.test.ts` file in the same folder as the source file it covers, named `<source file base name>.test.ts`.
5. THE Repository SHALL contain, next to the Required_Sections_Sensor and the Schema_Sensor sources, at least one fast-check property test for each of P-FND-1, P-FND-2, P-FND-3, P-FND-4, and P-FND-5, where each test name contains its property ID and each property runs at least 100 generated cases.
6. IF a fast-check property test fails, THEN THE Build_System SHALL print the property ID, the counterexample that failed, and the seed that reproduces the failure (checked by the example test in R-FND-10.16).
7. THE Required_Sections_Sensor and THE Schema_Sensor SHALL each expose its check as a pure function that takes the text of a file and returns its findings, with no file reads or process exits inside that function. THE command-line entry point of each Sensor SHALL only read the files and call that function. THE property tests P-FND-1 to P-FND-5 SHALL call the pure function, not the command line.
8. FOR each form in R-FND-04.5 and each of R-FND-04.1 to R-FND-04.4, THE Repository's tests SHALL run ESLint's Linter API on in-memory source text that uses a forbidden specifier, with the committed ESLint config and a virtual file path under the folder that the criterion names, and SHALL check that the boundary error is reported. For each allowed import in R-FND-04.7, THE Repository's tests SHALL check that no boundary error is reported. For each form in R-FND-04.10, THE Repository's tests SHALL run the same Linter API check on in-memory source text with a virtual file path under `core/`, `apps/`, or `scripts/`, covering `import()` and `require()` with a non-literal argument, `import()` and `require()` with a template literal that has a substitution (reported), `import()` and `require()` with a template literal without substitutions (allowed, no boundary error unless the specifier breaks R-FND-04.1 to R-FND-04.4), `import.meta.glob`, `require.resolve`, a call on the result of `createRequire(...)`, `module.require(...)`, `eval(...)`, `new Function(...)`, and any use of the global `Function` constructor, and SHALL check that each one except the allowed template literal without substitutions reports a boundary error. For the case in R-FND-04.6, THE Repository's tests SHALL run the Linter API on in-memory source text with no forbidden import and no other finding, and SHALL check that no finding is reported, so that the Lint_Sensor exits with code 0. The design phase confirms how type-aware linting handles virtual files outside the tsconfig include list.
9. THE Repository SHALL contain no file with the extension `.js`, `.jsx`, `.mjs`, or `.cjs` under `core/`, `apps/`, or `scripts/`, and THE Repository's tests SHALL check this by listing every file under those three folders, so that no file type escapes the boundary rules of R-FND-04.
10. THE Repository's tests SHALL check that `package.json` has no `imports` field, as R-FND-04.9 requires.
11. THE check:build script SHALL scan the output of `npm run build` in `dist/`, and the scan SHALL fail if `dist/` is missing. The scan SHALL fail if any of `dist/index.html`, `dist/ghost-mansion/index.html`, or `dist/moodwalk/index.html` does not exist. The scan SHALL fail if a folder named `apps` exists in `dist/`, and SHALL fail if any script, style, or asset path referenced by the three pages does not resolve under the Public_URL base path, which is `/SpatialCore/` (R-FND-02.5).
12. THE check:build script SHALL scan the HTML, CSS, and JS files in `dist/` for absolute URLs that begin with `http://` or `https://`. The scan SHALL read the Public_URL origin from the origin defined in the Vite config and SHALL NOT hard-code it. The scan SHALL fail on any such URL whose origin is not that origin, except URLs under `http://www.w3.org/`, which React DOM includes as XML namespace strings, and except URLs that design.md allows (R-FND-02.11). Runtime requests are not scanned; R-FND-03.8 checks them by a manual check on the Public_URL.
13. THE Repository's tests SHALL read `tsconfig.json` and SHALL fail if it contains a `paths` key (R-FND-04.8).
14. THE Repository's tests SHALL read the `name` field of `package.json` and SHALL fail if any import specifier in a Source_File under `core/`, `apps/`, or `scripts/` starts with that name (R-FND-04.9).
15. THE Repository's tests SHALL read `core/model/scenario-schema.ts` and SHALL fail if it contains any app-specific name listed in R-FND-08.2, compared case-insensitively (R-FND-08.2).
16. THE Repository SHALL contain at least one example-based test for each IF/THEN error criterion of R-FND-02.6, 05.2, 05.5, 06.3, 06.5, 07.3, 07.5, 08.6, 08.7, 08.9, and 08.10. THE Repository SHALL also contain an example-based test for R-FND-10.6 that deliberately fails a fast-check property. That test SHALL live in a separate test file that is the one exception to R-FND-10.1: the Test_Command SHALL NOT run it as an ordinary pass-or-fail test, and it SHALL run only through a separate run that expects failure. The test SHALL pass only when that failing run exits with a non-zero code and its printed output contains the property ID, the counterexample, and the seed. THE Repository SHALL also contain an example-based test for R-FND-07.2 that runs ESLint twice on the same Source_Files with the committed config and checks that both runs print the same findings.

### Requirement 11: Publishing to GitHub Pages (R-FND-11)

**User Story:** As the developer, I want the Site deployed automatically on every push to the `main` branch, so that the project is submittable at any moment.

#### Acceptance Criteria

1. WHEN a commit is pushed to the `main` branch, THE Deploy_Workflow SHALL build the Site from that commit, using the Public_URL base path, and publish the Site to GitHub Pages.
2. THE Deploy_Workflow SHALL run `npm ci` followed by the lock-file check (`git diff --exit-code package-lock.json`), then the Type_Check_Sensor, the Lint_Sensor, the Required_Sections_Sensor (with no file argument), the Schema_Sensor (with no file argument), and the Test_Command before the build step in every run, and SHALL run `check:build` after the build step and before publishing in every run.
3. IF any Sensor, the Test_Command, `check:build`, the build, or the lock-file check (`git diff --exit-code package-lock.json` after `npm ci`) exits with a non-zero code in the Deploy_Workflow, THEN THE Deploy_Workflow SHALL stop without publishing and mark the run as failed in GitHub Actions, naming the failed step, so that the Public_URL keeps serving the last Site that was published (checked after a failed run, by hand).
4. WHEN a Deploy_Workflow run publishes successfully, THE Site at the Public_URL SHALL serve the Top_Page at `Public_URL`, Ghost_Mansion_App at `Public_URL` followed by `ghost-mansion/`, and Moodwalk_App at `Public_URL` followed by `moodwalk/`, from the commit that run built (manual check on the Public_URL after the first successful publish and after any change to the build).
5. THE Deploy_Workflow SHALL set up Node.js with the exact version pinned in `.nvmrc`.
6. THE Deploy_Workflow SHALL use no secret except the token GitHub Actions provides for Pages deployment, and SHALL need no repository or environment secrets configured by the developer.
7. IF a Deploy_Workflow run starts while another Deploy_Workflow run is publishing, THEN THE Deploy_Workflow SHALL let only one run publish at a time, so that the Public_URL serves the Site from one complete run and never a mix of two runs (checked by reading the workflow file).

### Requirement 12: Public repository files (R-FND-12)

**User Story:** As a judge, I want the repository to show its license and an English README, so that I can check the hackathon rules and understand the project quickly.

#### Acceptance Criteria

1. THE Repository SHALL contain at its root a file named `LICENSE` that holds the unmodified MIT License text with one copyright line naming a year and a copyright holder.
2. WHEN the Repository's GitHub page is opened, THE Repository SHALL show "MIT" as the license in the About section. This criterion is verified by a manual check of the GitHub page, not by a test.
3. THE Repository SHALL contain at its root a `README.md` written in English whose first heading is the project name "Haunted Graph Kit".
4. THE `README.md` SHALL state the Public_URL as a clickable link and SHALL name the app paths `/ghost-mansion/` and `/moodwalk/`, each as a link relative to the Public_URL.
5. THE `README.md` SHALL state the Node.js version that equals the version in `.nvmrc`, and SHALL list the commands `npm ci`, `npm run build`, and `npm test` inside code blocks.
6. THE Repository SHALL contain at its root a `.gitignore` that excludes `node_modules/` and `dist/`, the output folder that `npm run build` writes, so that `git status` lists no untracked file from either folder after `npm ci` and `npm run build` are run on a clean checkout.

## PBT properties

The core PBT properties from intent.md 10.6 (save → load unchanged, edges point to existing nodes, same input → same result, removing edges never grows the reachable set, stop-type edges block automatic propagation) belong to the `core` spec. This spec tests only its own two Sensors. Fence lines and heading lines in P-FND-1 to P-FND-3 use the definitions in R-FND-05.6 and R-FND-05.7.

- **P-FND-1 (same input → same result).** FOR ALL Markdown texts, running the Required_Sections_Sensor check twice on the same text SHALL give the same pass/fail result and the same list of missing headings. (R-FND-05)
- **P-FND-2 (adding and removing a heading).** FOR ALL Markdown texts that contain no fence line (as defined in R-FND-05.6) and no Required_Heading line, appending both Required_Headings SHALL make the check pass, and removing either one (with the rest unchanged) SHALL make the check fail and report exactly that heading as missing. (R-FND-05.1, R-FND-05.2)
- **P-FND-3 (headings in code blocks do not count).** FOR ALL Markdown texts that contain no fence line (as defined in R-FND-05.6) and no Required_Heading line, placing both Required_Heading lines inside a fenced code block SHALL make the check fail, with both headings reported as missing. (R-FND-05.6)
- **P-FND-4 (valid scenarios pass).** FOR ALL generated objects that satisfy the Scenario_Schema envelope, the Schema_Sensor check on their JSON text SHALL pass, and FOR ALL such objects with one or more extra top-level fields added (with any JSON values, and with names other than `schemaVersion`, `id`, and `title`), the Schema_Sensor check on their JSON text SHALL pass. (R-FND-08.1, R-FND-08.8)
- **P-FND-5 (broken scenarios fail).** FOR ALL generated valid objects, removing one of the three required top-level fields (`schemaVersion`, `id`, or `title`, as defined in R-FND-08.1) or replacing it with a value of the wrong type SHALL make the Schema_Sensor check fail and report that field's path. For `title`, the missing or wrong-type case applies to the `title` object and to `title.en`. (R-FND-08.7)

## Safety

Follows `safety.md` (intent.md ch. 9).

- **S-FND-1.** THE Site SHALL collect no personal information, SHALL have no login, and SHALL make no request to any origin other than the Public_URL's origin (R-FND-03.8).
- **S-FND-2.** THE Empty_Apps SHALL contain no attack content: no attack cards, hidden text, commands, or code that could work as a real attack. Attack cards arrive only in `app-ghost-mansion`, under its own safety review.
- **S-FND-3.** THE Site SHALL use no AI, no real LLM, and no image generation.
- **S-FND-4.** THE Repository SHALL keep `.kiro/` committed and out of `.gitignore` (hackathon rule).
- **S-FND-5.** THE Repository SHALL contain no secrets or API keys; the Deploy_Workflow uses only the token GitHub provides.
- **S-FND-6.** The README and placeholder docs SHALL make no claim that needs a source. Claims with sources (OWASP mapping, competitor comparison) are added in later specs and checked by the `reviewer` agent.

## Open questions

今のところありません。
