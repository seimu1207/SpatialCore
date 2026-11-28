# Implementation Plan: app-moodwalk

## Overview

Language: TypeScript (design.md uses TypeScript). Build order follows design.md and keeps the public URL building and deploying after every task:

1. `repo-foundation` changes first (task 1): the lint scope `app-moodwalk-model` with its six Moodwalk bans and fixtures, and the replacement of `placeholder.json` by the Demo_Board Scenario_File together with the `schema.cli.test.ts` change. The placeholder page (`apps/moodwalk/main.ts`, `index.html`, `text.ts` with `body`) keeps working until task 10.3.
2. Pure model under `apps/moodwalk/model/` (tasks 2, 4, 5, 6): Mood_Analyzer, sample recipes, Board_Settings, data files and loading, Route_Layout, Shift_Check, Linked_Timeline, Edit_Command builders, Image_Store, controls, and curve layout. Each file is written with its example tests, and each of the properties P-APP2-1 to P-APP2-12 is its own sub-task right after the code it tests. No file of the model imports a view, React, or three.js module.
3. Browser part `apps/moodwalk/browser/` (task 8): not imported by any entry page until task 10.3.
4. UI texts and the `BoardController` (task 9), tested in Node with recording stubs of the Core_View handle, the image reader, and the UI.
5. The DOM panel, the Curve_Panel, and the page wiring (task 10): the first task that imports `core/view/start-view.tsx` from the Moodwalk page. The placeholder page is replaced here.
6. Decision records (task 11) and the verification gate (task 13).

Nothing under `core/` changes (R-APP2-14.3). The Top_Page, `vite.config.ts`, `package.json`, and the `check:build` allow list do not change (no new package, no new URL string). The frame-budget fallback steps that would change `core/` (design.md "Frame budget fallback", steps 1 and 2) are not planned here; they need a separate human decision.

Conventions for every task:
- Requirement IDs `X.Y` mean R-APP2-0X.Y (for example `6.2` is R-APP2-06.2; `12.3` is R-APP2-12.3). IDs written `R-FND-X.Y`, `R-GRAPH-X.Y`, `R-RULES-X.Y`, `R-VIEW-X.Y` belong to `repo-foundation`, `core-graph`, `core-rules`, `core-view`. Safety rules are written `S-APP2-n` on a separate "Safety" line. "Design:" names the design.md section used. M1 to M21 and D-O1 to D-O3 are the design decisions of design.md.
- Tests and PBT run only when a task is completed (tech.md). Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:build`, `npm run check:sections`, `npm run check:schema`.
- Every task leaves `tsc --noEmit` and lint green, and `npm run build` plus `npm run check:build` green. Failing sensors block a change (tech.md), including during Vibe work. Run lint with `npm run lint`, not `npx eslint` (lessons.md 2026-11-15). When tasks run in parallel, re-run lint after the wave ends before judging a failure (lessons.md 2026-11-16, 2026-11-23). Run `npm run build` after any large file write (lessons.md 2026-11-23).
- Check every clause of the requirement IDs a task names, not only the main path (lessons.md 2026-11-16).
- Write every relative import with its `.ts` (or `.tsx`) extension (lessons.md 2026-11-23).
- Property tests: one test per property, `numRuns` of at least 100, the test name starts with the property ID (`P-APP2-n`), and a tag comment `// Feature: app-moodwalk, Property n: <title>` (design.md Testing Strategy, R-FND-10.5). Each property is its own sub-task, placed right after the code it tests. Generators build plain objects (`{}` literals or a JSON round trip), never rely on `structuredClone` of `fc.record` output, and compare Scenarios through a JSON round trip or `toStrictEqual` on plain objects (lessons.md 2026-11-23).
- Tests are required by the repo-foundation convention and by design.md, so no test sub-task is marked optional with `*`.
- Test files sit next to their source, named `<source file base name>.test.ts`, run under Vitest in Node with no DOM, and import no `three`, React, Fiber, or drei module (R-APP2-14.2). `apps/moodwalk/model/arbitraries.ts` is test support, imported only by `*.test.ts` files.
- The model (`apps/moodwalk/model/`) imports only `zod`, non-test files of `core/model/`, the View_Helpers `core/view/helpers/settings-schema.ts`, `theme-schema.ts`, `camera-path.ts`, and `link.ts`, the bundled data files, and itself (R-APP2-14.1, 14.2). `browser/` imports only `../model/pixels.ts`, `../model/sample-images.ts`, and types. `controller.ts` imports only types from `core/view/start-view.tsx` (`import type`). No App file imports `core/view/demo/`, `core/view/scene/`, or a `*.test.ts` file.
- Judgement code uses no AI_Adapter, LLM client, `fetch`, `Date`, `Math.random`, or DOM global (R-APP2-06.1, 06.9, 14.4). No function of the model throws and none writes to its arguments.
- The App draws text only with `textContent` and SVG text nodes, never `innerHTML`. Every UI and scenario text is `{ en, ja }` with a non-empty `en` (R-APP2-01.5).
- Moodwalk names stay under `apps/moodwalk/`. Nothing is written under `core/` (R-APP2-14.3). No AI, no AI-generated image: the Sample_Images are pixel recipes (M13).
- No new dependency. Only `zod`, `vitest`, and `fast-check` already in `package.json`.
- Decisions and fallbacks found during a task go into `docs/decision-log.md` as one line: `date | section | decision | reason`. Do not edit older lines and do not edit the approval lines of 2026-11-25.
- Do not commit or push unless the human says so.

## Tasks

- [x] 1. Repo-foundation changes
  - [x] 1.1 Add the Moodwalk lint scopes and the six bans
    - In `scripts/sensors/boundary-rules.ts`, with the existing `scope()` and `ban()` builders and the separator class `S`, define the six bans of design.md "Lint scope for the board model" with their own messages: `ghostMansionBan` (the existing inline `moodwalk`-scope ban of ghost-mansion, given a name), `moodwalkDemoBan`, `moodwalkTestFileBan`, `moodwalkModelViewBan` (lookahead `core${S}view${S}(?!helpers${S})`), `moodwalkHelpersDotDotBan`, and `moodwalkModelDotDotBan`. Do not reuse `demoBan` or `testFileBan` (their messages name ghost-mansion). Scope `app-moodwalk` (`apps/moodwalk/**`) uses `[ghostMansionBan, moodwalkDemoBan, moodwalkTestFileBan]`. Add the scope `app-moodwalk-model` for `apps/moodwalk/model/**/*.{ts,tsx}` after it, with `[ghostMansionBan, moodwalkDemoBan, moodwalkTestFileBan, ...modelPackageBans, moodwalkModelViewBan, moodwalkHelpersDotDotBan, moodwalkModelDotDotBan]`. The Ghost Mansion scopes, bans, and messages do not change.
    - In `scripts/sensors/boundary-rules.test.ts` add fixtures for `apps/moodwalk/model/a.ts`. Rejected: `three`, `react`, `@react-three/fiber`, `../../../core/view/start-view.tsx`, `../../../core/view/scene/x.ts`, `../../../core/view/demo/main.tsx`, `../../../core/view/helpers/../scene/x.ts`, `../../../core/model/../view/scene/x.ts`, `./x.test.ts`, `../../ghost-mansion/x.ts`. Accepted: `../../../core/model/series.ts`, `../../../core/view/helpers/camera-path.ts`, `./mood.ts`. Add fixtures for `apps/moodwalk/main.ts`: rejected `../../core/view/demo/main.tsx` and `./x.test.ts`, accepted `../../core/view/start-view.tsx`. The demo and test-file rejections in Moodwalk files must carry the Moodwalk messages. Keep every existing fixture passing.
    - If esquery rejects the lookahead regex, use the two-ban form (path segments `scene` and `demo` under `core/view`, and `start-view`); both forms must give the same results on the fixtures. Note the form used for task 11.1.
    - Add one line to `docs/decision-log.md`: this changes a `repo-foundation` sensor (D-O2), names the two scopes, and which regex form was used.
    - The lint scopes cover `apps/moodwalk/model/**` and the whole `apps/moodwalk/**` only. The import limits of `apps/moodwalk/browser/` (only `../model/pixels.ts`, `../model/sample-images.ts`, and types) and of `controller.ts` (only `import type` from `core/view/start-view.tsx`) are **not lint-enforced**. The gate reviewer (task 13) checks them explicitly. Say so in the decision-log line.
    - Design: Lint scope for the board model; Changes outside apps/moodwalk/.
    - _Requirements: 14.1, 14.2, 14.6_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 1.2 Replace the placeholder Scenario_File with the Demo_Board file
    - Create `apps/moodwalk/scenarios/school-festival-haunted-house.json` in the saved format (keys sorted, 2-space indent, trailing newline): id `school-festival-haunted-house`, title `{ en: "School festival haunted house plan", ja }`, the seven Zones of design.md "Demo_Board" (ids, `{ en, ja }` labels, `order` 0 to 6, `elevation 0`, `enclosed false`), ten Image_Nodes (type `image`, `front.image` `sample:<recipe-id>`, `front.text` `{ en, ja }` captions of the table, `rotation (0, π, 0)`, `scale (1, 1, 1)`, `metadata {}`, positions from the slot rule of "Route_Layout", `attributes { brightness, temperature }`), and no Edge. For now the attribute values are the target values of the table; task 2.6 replaces them with the exact analyzer output. The attribute values are provisional until task 2.6, and no test before task 2.6 compares them to analyzer output. Every text is fictional and names no real person, place, or brand. The file stays at most 16 KB (M14).
    - Delete `apps/moodwalk/scenarios/placeholder.json`. In `scripts/sensors/schema.cli.test.ts` change the pair `["moodwalk", "placeholder.json"]` to `["moodwalk", "school-festival-haunted-house.json"]` and rename the test so its name no longer says "placeholder" for Moodwalk (keep the `(08.3)` reference). Run `grep_search` for `placeholder.json` and update any other reference to the removed file.
    - The placeholder page does not import the Scenario_File, so the public page is unchanged.
    - Add one line to `docs/decision-log.md`: the placeholder was replaced by the Demo_Board file and the schema sensor test follows.
    - Design: Demo_Board; Changes outside apps/moodwalk/.
    - _Requirements: 2.1, 2.2, 2.3, 13.1, 13.2, 14.5_
    - Safety: S-APP2-5.
    - Done when: `npm run check:schema`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:build` exit 0.

- [x] 2. Mood analyzer and sample images
  - [x] 2.1 Implement fixed names, pixels, the Mood_Analyzer, and the fallback switch
    - `model/names.ts`: the fixed names of design.md "Fixed names" (Node_Type `image`, attributes `brightness`, `temperature`, `sameMood`, flag kinds, Effect_Kinds, Effect_Rule ids, preset ids, path id `route`, `EYE_HEIGHT` 1.5, reference prefixes) as `as const` values.
    - `model/pixels.ts`: `ANALYSIS_SIZE = 64`, `PixelData`, `ReadResult`, `analysisSize(width, height)` (M3: `k = min(1, 64 / w, 64 / h)`, `max(1, round(w·k))`, `null` for a side that is not a positive integer).
    - `model/mood.ts`: `analyzeMood`, `TEMPERATURE_RANGE`, `MoodValues`, `AnalysisFailure` exactly as in design.md "Pixel data and Mood_Analyzer" and "Formulas": validation to `bad-data`, `too-large`, `no-pixels`, integer sums `A`, `Y`, `W`, `transparent` when `A = 0`, `brightness = Y / (A × 2,550,000)`, `temperature = W / (A × 255)`, one `try`, no exception escapes, no DOM global.
    - `model/fallback.ts`: `FALLBACK = { brightnessOnly: false }` and the `Fallback` type (M20).
    - Example tests in `mood.test.ts`: a 1 × 1 white pixel gives (1, 0), black (0, 0), pure red (0.2126, 1), pure blue (0.0722, −1); a half-transparent pixel weighs by alpha; `bad-data` and `too-large` inputs; the input is unchanged; `analysisSize` for 10000 × 10 and 64 × 64 and 0. In `fallback.test.ts`: `FALLBACK.brightnessOnly` is `false`.
    - Design: Fixed names; Pixel data and Mood_Analyzer; Formulas; M1 to M4, M20.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.10, 16.1, 16.2, 16.3_
    - Safety: S-APP2-1.
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 2.2 Add the pixel generators in `model/arbitraries.ts`
    - Test support only. `pixelDataArb(opts)` with the variants `visible`, `transparent`, `empty` (sides from `opts.minSide` to 64; plain `number[]` data of `4·w·h` integers 0..255; channel values from `fc.oneof(fc.integer(0..255), fc.constantFrom(0, 1, 254, 255))`; one random alpha in 1..255 for `visible`), and `raiseArb(pixels)` (non-negative increments clamped to 255, alpha unchanged). Imports `fast-check` and `pixels.ts`.
    - Example test in `arbitraries.test.ts`: generator sanity (every `visible` value has `data.length = 4·w·h`, integer channels, at least one alpha above 0; every `transparent` value has alpha 0 everywhere; `empty` has a zero side).
    - Design: PBT properties → Generators.
    - _Requirements: 6.2, 6.3_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 2.3 Write property test for the analyzer
    - In `model/mood.test.ts`, using `pixelDataArb`.
    - **Property 1: P-APP2-1 analyzer is total, in range, and deterministic.** For `visible` Pixel_Data `analyzeMood` returns `ok: true` with `brightness` in [0, 1] and `temperature` in [−1, 1], both finite; a second call on a deep copy returns a `toStrictEqual` result and the input equals a copy taken before the call. For `transparent` and `empty` variants it returns `ok: false` (`transparent` or `no-pixels`). Design clause: for positive integers `w, h` up to 10,000, `analysisSize(w, h)` has both sides from 1 to 64, is never larger than `(w, h)` in either side, equals `(w, h)` when both are at most 64, and keeps `w/h` within one pixel of rounding.
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.7, 16.1, 16.2**
    - Done when: `npm test` exits 0.

  - [x] 2.4 Write property test for brightness monotonicity
    - In `model/mood.test.ts` (the same file as task 2.3, so it runs in a later wave), using `pixelDataArb` and `raiseArb`.
    - **Property 2: P-APP2-2 brightness is monotone.** For `visible` Pixel_Data and any raise from `raiseArb`, the `brightness` of the raised data is greater than or equal to the original (exact comparison).
    - **Validates: Requirements 6.5**
    - Done when: `npm test` exits 0.

  - [x] 2.5 Write property test for color temperature
    - In `model/mood.test.ts` (a later wave than task 2.4).
    - **Property 3: P-APP2-3 red is not cooler than blue.** For `visible` Pixel_Data changed so that every pixel has `r ≥ b` (swap where `r < b`), the `temperature` of that data is greater than or equal to the `temperature` of the same data with `r` and `b` swapped in every pixel.
    - **Validates: Requirements 6.6**
    - Done when: `npm test` exits 0.

  - [x] 2.6 Implement `model/sample-images.ts`, tune the recipes, and fix the Demo_Board attributes
    - `SampleRecipe`, `SAMPLE_WIDTH = 64`, `SAMPLE_HEIGHT = 48`, `SAMPLE_RECIPES` (ten recipes with the ids of the Demo_Board table: `lanterns`, `corridor`, `lamp`, `desks`, `doll`, `piano`, `tea`, `flowers`, `stairs`, `daylight`; vertical gradient plus optional soft spot), and `samplePixels(recipe)` with the exact pixel rule of design.md (`+ − × /`, `Math.sqrt`, `Math.round` only; alpha 255; clamp 0..255). The recipes are the developer's fixed fictional color fields, not AI output (M13, S-APP2-2).
    - Tune the recipes until every Zone mean of both attributes (mean over the Zone's Image_Nodes of `analyzeMood(samplePixels(recipe))`) is within ±0.01 of the target table of design.md "Demo_Board". Then write into `apps/moodwalk/scenarios/school-festival-haunted-house.json` the exact analyzer output of each recipe as the `brightness` and `temperature` of its Image_Node (full precision numbers; the file stays valid and at most 16 KB). A throwaway computation (a Vitest run or a script that is not committed) may be used to read the values.
    - Example tests in `sample-images.test.ts`: every recipe is 64 × 48 with alpha 255 and channels in 0..255 (16.2, 16.4); `samplePixels` called twice gives equal data; recipe ids are unique; Zone means of both attributes are within ±0.01 of the target table (hard-coded in the test, with the recipe-to-Zone mapping); the Demo_Board file values equal `analyzeMood(samplePixels(recipe))` within 1e-9 (the Demo_Board test in task 5.11 repeats this on the loaded Scenario).
    - Design: Sample images; Demo_Board; M13.
    - _Requirements: 13.5, 13.6, 16.2, 16.3, 16.4_
    - Safety: S-APP2-2, S-APP2-5.
    - Done when: `npm test`, `npm run check:schema`, `npm run typecheck`, and `npm run lint` exit 0.

- [x] 3. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 4. Board settings, data files, and loading
  - [x] 4.1 Implement `model/board-settings.ts` with example tests
    - `boardSettingsSchema` (strict object; `shiftThreshold ≥ 0`, `runTolerance ≥ 0`, `minRunLength` integer ≥ 2), `loadBoardSettings` (`safeParse` in `try`, `toValidationErrors`, one error at `""` on an unexpected exception, never throws), `parseSettingField` (trim; empty text first; finite non-negative number; for `minRunLength` an integer ≥ 2).
    - Example tests in `board-settings.test.ts`: `parseSettingField` rejects `-1`, `abc`, `""`, `"NaN"`, `"Infinity"`, and for `minRunLength` `1` and `2.5`; accepts `0`, `0.15`, `3` (8.4, 8.5); the schema rejects an extra key and a missing key.
    - Design: Board_Settings.
    - _Requirements: 8.1, 8.4, 8.5, 8.6_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.2 Write property test for the settings schema
    - Add `anyValueArb` (`fc.anything()` plus near-valid settings: each field replaced by `NaN`, `Infinity`, `-1`, `1`, `2.5`, a string, `null`, or removed, and objects with an extra key) to `model/arbitraries.ts`. Test in `model/board-settings.test.ts`.
    - **Property 12: P-APP2-12 settings schema is total.** For any value from `anyValueArb`, `loadBoardSettings` returns without throwing either `ok: true` with values that meet R-APP2-08.4, or `ok: false` with a non-empty list of errors each with a string `path` and a non-empty English `message`; two calls on deeply equal values return `toStrictEqual` results.
    - **Validates: Requirements 8.6, 8.7**
    - Done when: `npm test` exits 0.

  - [x] 4.3 Add the rule, settings, and theme files and the bundle
    - Create `apps/moodwalk/rules/mood-rules.json` (the Rule_Definition of design.md: empty propagation, Effect_Rules `mark-sudden-brightening` with source `shifts` on `brightness` and `mark-same-mood` with source `longRuns` on `sameMood`; no other Effect_Rule), `apps/moodwalk/rules/board-settings.json` (`0.15`, `0.05`, `3`), and `apps/moodwalk/theme/theme.json` (the Theme of design.md with the two `fog` Effect_Styles). Remove `rules/.gitkeep` and `theme/.gitkeep`.
    - `model/bundled.ts`: `BUNDLED` with `import … from "../scenarios/school-festival-haunted-house.json?raw"` and JSON module imports (`with { type: "json" }`). If `tsc` or Vite reject one of these forms, use the form `apps/ghost-mansion/model/bundled.ts` uses and note the choice for task 11.1.
    - Design: Data Models (Rule_Definition, Board_Settings, Theme); File layout.
    - _Requirements: 8.2, 9.4, 9.5, 14.5_
    - Done when: `npm run typecheck`, `npm run lint`, `npm run check:schema`, `npm run build`, and `npm run check:build` exit 0.

  - [x] 4.4 Implement `model/board-data.ts` with loading example tests
    - `loadBoardData(raw)`: `loadScenario`, `loadRuleDefinition`, `loadBoardSettings`, `loadTheme`, then `loadViewSettings(buildViewSettings(zones, "overview"))`; collect every error with its file name (`view settings` for the last); one outer `try`; never throws. `crossReferenceErrors(data)`: at least 2 Zones; every Node has type `image`, a `zone`, a `front.image` `sample:<id>` with a recipe in `SAMPLE_RECIPES`, and both attributes; every Effect_Kind of the rules has a `fog` style in the Theme; the rules hold exactly the two Effect_Rules.
    - Example tests in `board-data.test.ts`: `loadBoardData(BUNDLED)` is `ok: true` and `crossReferenceErrors` is empty (1.3, 14.5); a broken copy of each file gives `ok: false` naming that file and does not throw (1.4); `crossReferenceErrors` names a missing recipe, a missing attribute, and an Effect_Kind without a fog style.
    - Design: Board data loading; Data Models.
    - _Requirements: 1.3, 1.4, 14.5_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

- [x] 5. Route layout, Shift_Check, and Linked_Timeline
  - [x] 5.1 Implement `model/layout.ts` with example tests
    - `LAYOUT`, `routeFootprints`, `buildViewSettings`, `footprintAt`, `slotPosition`, `freeSlot`, `walkDuration` exactly as in design.md "Route_Layout": rect footprints 8 × 4 at `z = 5·rank`, `x = 0`; slot columns and layers; Overview_Preset and Visitor_Preset (Visitor position `(0, e₀ + 1.5, z₀ − 7)`, target `(0, e₁ + 1.5, z₁)`), active preset first, one `route` path with `fromZones.height 1.5`, `snapStep 0.5`, `detailDistance 2`, `wallHeight 1.2`, `stepDuration 2`; valid settings also with fewer than 2 Zones.
    - Example tests in `layout.test.ts`: the seven Demo_Board footprints and presets; slots are multiples of 0.5 and never cross `x = 0` (4.7); `footprintAt` returns `null` in the 1-unit gap; `freeSlot` returns the first unused slot and `null` for an unknown Zone; `walkDuration(7) = 24`, `walkDuration(2) = 4`, `walkDuration(1) = 4`; the Visitor field-of-view numbers of design.md (outer slots at 16:9 and 4:3) computed in the test with a source comment for the 50° field of view of `view-root.tsx`.
    - Design: Route_Layout; M8, M9, M10.
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.7, 11.1, 11.2, 11.3, 12.4_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 5.2 Add the board generators in `model/arbitraries.ts`
    - Test support only (a later wave than tasks 2.2 and 4.2, which write the same file). `zonesArb` (2 to 12 Zones, ids `z0…`, `fc.uniqueArray` distinct `order`, `elevation 0`, `enclosed false`, label `{ en: "Zone i" }`, shuffled), `boardArb` (a `zonesArb` and 0 to 50 Image_Nodes in a random subset of the Zones so "no data" Zones appear; `position` finite in ±50, `rotation` in ±π, `scale` in 0.1..3, Mood_Values from a small base set plus noise in ±0.02 clamped to the attribute range, with a share of boards using free `fc.double` values; every output passes `validateScenario`), `settingsArb` (`shiftThreshold` and `runTolerance` from `fc.oneof(fc.double(0..1), fc.constantFrom(0, 0.02, 0.05, 0.15, 0.3))`, `minRunLength` 2 to 6), and `marksArb(zones)` (a subarray of the Zone ids plus 0 to 2 unknown ids). All outputs are plain objects.
    - Example test in `arbitraries.test.ts` (same file as task 2.2, later wave): 100 boards pass `validateScenario`; some boards have a Zone without an Image_Node; 100 `settingsArb` values pass `loadBoardSettings`.
    - Design: PBT properties → Generators.
    - _Requirements: 7.2, 9.3_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 5.3 Write property test for depth is order
    - In `model/layout.test.ts` (a later wave than task 5.1), using `zonesArb`.
    - **Property 8: P-APP2-8 depth is order.** `routeFootprints` returns one `rect` footprint per Zone, equal width and depth (positive), centers along `z` strictly increasing with `order`, no two overlapping; `buildViewSettings(zones, active)` passes `loadViewSettings`, is `toStrictEqual` for every permutation of the list, lists `active` first, and has one Camera_Path `route` with `fromZones.height = 1.5`; `buildZoneWaypoints(scenario, footprints, 1.5)` returns `ok: true` with one Waypoint per Zone in ascending `order`, each `target` different from its `position`, `position.x` and `position.z` equal to the footprint center, and `position.y` equal to the Zone `elevation + 1.5`. Design clause: the Visitor_Preset position has `y = elevation₀ + 1.5`, `x = 0`, `z = z₀ − 7`, and its target is the second Waypoint position.
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 11.3, 12.4**
    - Done when: `npm test` exits 0.

  - [x] 5.4 Implement `model/shift-check.ts` with example tests
    - `seriesSettingsFor` (brightness then temperature, `zoneValue: "mean"`, `direction: "up"`; only brightness under `brightnessOnly`), `sameMoodRuns` (pairwise Run_Intersections of at least `minRunLength`; Brightness Long_Runs only under `brightnessOnly`), and `checkMood` with the six steps of design.md "Shift_Check": `checkSeriesList`, the Mood_Curve with `noData`, Same_Mood_Runs, the Judgement_Results with the `sameMood` Series_Result (empty `series`, `changes`, `shifts`, `unresolved`), `buildEffects`, and Mood_Flags sorted by Zone `order` then kind. A Rule_Failure is returned as is. Export `MoodCurve`, `MoodFlag`, `FlagReason`, `MoodReport`.
    - Example tests in `shift-check.test.ts`: `seriesSettingsFor` with the defaults (8.1); `brightnessOnly` gives one series and Same_Mood_Runs equal to the Brightness Long_Runs; a Board with no flag gives an empty effect list (9.6); a Rule_Failure from a broken Scenario is returned and nothing throws (7.9, 9.12); the Judgement_Results built by `checkMood` pass `judgementResultsSchema`; Example 1 and Example 2 of R-APP2-09.3 flag no Zone.
    - Design: Shift_Check; M4, M6, M7, M20.
    - _Requirements: 7.1, 7.2, 7.9, 8.1, 9.1, 9.2, 9.3, 9.4, 9.6, 9.7, 9.12, 10.4_
    - Safety: S-APP2-1.
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 5.5 Write property test for shift-check determinism
    - In `model/shift-check.test.ts` (a later wave than task 5.4), using `boardArb`, `settingsArb`, `marksArb`.
    - **Property 4: P-APP2-4 curve, flags, and effects are deterministic.** Calling `checkMood` twice, the second time on JSON-round-trip copies of plain objects, gives `toStrictEqual` reports (Mood_Curve, Mood_Flags, Mood_Effects, Same_Mood_Runs), and every argument equals a copy taken before the call.
    - **Validates: Requirements 7.8, 9.8, 14.4**
    - Done when: `npm test` exits 0.

  - [x] 5.6 Write property test for transforms and node order
    - In `model/shift-check.test.ts` (a later wave than task 5.5).
    - **Property 5: P-APP2-5 transforms and node order do not change the curve.** Changing `position` (any finite point, `zone` unchanged), `rotation`, or `scale` of any Image_Node with `updateNode` leaves the Mood_Curve, Mood_Flags, and Mood_Effects `toStrictEqual`; a random permutation of the `nodes` list changes no Zone_Value by more than `1e-9 × (1 + |v|)` and keeps the same Zone ids in `series` and `noData`; every Brightness Zone_Value lies in [−1e-9, 1 + 1e-9] and every Color temperature Zone_Value in [−1 − 1e-9, 1 + 1e-9].
    - **Validates: Requirements 5.5, 7.6, 7.7, 7.8**
    - Done when: `npm test` exits 0.

  - [x] 5.7 Write property test for threshold monotonicity
    - In `model/shift-check.test.ts` (a later wave than task 5.6).
    - **Property 6: P-APP2-6 thresholds are monotone.** With `s′` equal to `s` except a larger `shiftThreshold`, the `sudden-brightening` Zones of `s′` are a subset of those of `s`; with a larger `minRunLength` or a smaller `runTolerance`, the `same-mood-too-long` Zones of `s′` are a subset of those of `s`.
    - **Validates: Requirements 9.9, 9.10, 9.11**
    - Done when: `npm test` exits 0.

  - [x] 5.8 Write property test for marks and flag-effect pairing
    - In `model/shift-check.test.ts` (a later wave than task 5.7). The test holds a reference that computes from the Scenario alone each Zone mean (sum in list order divided by count), the Valued_Route_Zones in ascending `order`, the Step_Changes, the Long_Runs per attribute, and the Run_Intersections of at least Min_Run_Length Zones.
    - **Property 7: P-APP2-7 marks only remove warnings, and every effect has a flag.** The `sudden-brightening` Zones are exactly the later Zones of the Brightness Step_Changes greater than the Shift_Threshold whose Zone is not marked; the `same-mood-too-long` Zones are exactly the union of the reference Run_Intersections, each a consecutive part of the Valued_Route_Zones; the Mood_Curve `series` equals the reference means and `noData` the Zones without a Node holding the attribute; every Effect_Request targets a Zone with exactly one Mood_Flag of the matching kind and every Mood_Flag has exactly one Effect_Request; adding any Zone id to the marks adds no Mood_Flag and no Effect_Request and changes no `same-mood-too-long` flag and no Zone_Value. Fixed example tests in the same file: Example 1 and Example 2 of R-APP2-09.3; a Zone in Long_Runs of both attributes only through Run_Intersections shorter than Min_Run_Length gets no flag.
    - **Validates: Requirements 7.1, 7.2, 9.1, 9.2, 9.3, 9.4, 10.4, 10.6**
    - Done when: `npm test` exits 0.

  - [x] 5.9 Implement `model/walk.ts` with example tests
    - `linkedTimeline(scenario, effects)`: `timelineFromZones(scenario)` with step 0 `effects` set to `sortUniqueEffects(effects)` (M11), checked with `createTimeline`, returned as a `RuleOutcome`; `canWalk(scenario, footprints)`: at least 2 Zones and a footprint for every Zone.
    - Example tests in `walk.test.ts`: the Demo_Board gives 7 steps, step 0 holds the effects and later steps none, `checkLinkedTimeline` returns `[]` against `buildZoneWaypoints` (use `layout.ts`); `canWalk` is false for 1 Zone and for a Zone without a footprint (12.9); two calls give equal results.
    - Design: Linked_Timeline; M11.
    - _Requirements: 9.13, 12.2, 12.3, 12.9, 12.12_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 5.10 Write property test for the walkthrough link
    - In `model/walk.test.ts` (a later wave than task 5.9), using `boardArb` and `checkMood` effects.
    - **Property 11: P-APP2-11 walkthrough link holds.** For any Board with at least 2 Zones and any effect list built by `checkMood` on it, `linkedTimeline(board, effects)` returns `ok: true`; the Timeline passes `createTimeline`; `checkLinkedTimeline(route, buildZoneWaypoints(board, footprints, 1.5), timeline)` returns `[]`; it has one step per Zone, step `i` has exactly one target, the Zone of rank `i`; step 0 `effects` equals `sortUniqueEffects(effects)` and every other step has none; two calls on copies give `toStrictEqual` results.
    - **Validates: Requirements 9.13, 12.2, 12.3, 12.12**
    - Done when: `npm test` exits 0.

  - [x] 5.11 Write the Demo_Board example tests
    - In `model/board-data.test.ts` (a later wave than tasks 4.4 and 6.3 where needed), on `BUNDLED`: the first Image_Node positions of each Demo_Board Zone equal `slotPosition` of slots 0 and 1 from `layout.ts` (3.3, 4.7); the title is `School festival haunted house plan` (13.1); at least 5 Zones with `{ en, ja }` labels, at least 8 Image_Nodes, one in every Zone, every Zone `label` and Face `text` has `en` and `ja` (2.3, 13.2); Brightness rises at a midway Zone and the Zone before the Exit has the lowest Brightness (13.3); every Zone mean is within ±0.01 of the target table for both attributes; with the default Board_Settings and no marks the Mood_Flags are exactly (`corridor`, `classroom`, `music-room`: `same-mood-too-long`; `rest-corner`, `exit`: `sudden-brightening`) and the Mood_Effects are exactly the five matching Effect_Requests (13.4, 9.5); the stored attributes of each Image_Node equal `analyzeMood(samplePixels(recipe))` within 1e-9 (13.5, 16.4); the Scenario_File text is at most 16,384 bytes (13.8, M14); the Theme passes `loadTheme` and both Effect_Kinds have a `fog` style (9.5); marking `rest-corner` removes its flag (10.2, 10.4).
    - Design: Demo_Board; Testing Strategy (example tests).
    - _Requirements: 2.3, 9.4, 9.5, 10.2, 10.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.8, 16.4_
    - Safety: S-APP2-5, S-APP2-7.
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

- [x] 6. Commands, image store, controls, and curve layout
  - [x] 6.1 Implement `model/commands.ts` with example tests
    - `checkImageFile` (format, then size 10,485,760, then limit 50), `newImageId`, `newZone`, `addImageCommand` (one `addNode` with the node of design.md; `rotation (0, π, 0)`; slot from `freeSlot`; only `brightness` under `brightnessOnly`; no Face text for an upload; `null` for an unknown Zone), `addZoneCommand`, `removeZoneCheck`, `removeImageCommand`, `classifyMove`. No builder creates an Edge, and only `addImageCommand` writes the two attributes.
    - Example tests in `commands.test.ts`: `checkImageFile` at 10,485,760 and 10,485,761 bytes, 49 and 50 images, each accepted format, `image/gif`, and a `.webp` name with an empty `type` (rejected as `format`) (4.3, 4.4, 4.5); `addZoneCommand` order and id (3.6); `removeZoneCheck` for a Zone with images, a Board with 2 Zones, an empty Zone, and an unknown Zone (3.7, 3.8); `removeImageCommand` (5.2); `classifyMove` for a move inside the own Zone, into another Zone, into the gap, and for a rotation (5.3, 5.4); `newImageId` and `newZone` pick the smallest unused `k` (M17); the uploaded node holds no file name (S-APP2-4).
    - Design: Edit_Commands; M5, M9, M17.
    - _Requirements: 2.4, 3.1, 3.6, 3.7, 3.8, 4.2, 4.3, 4.4, 4.5, 4.7, 5.2, 5.3, 5.4, 6.8_
    - Safety: S-APP2-4.
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 6.2 Write property test for adding an image
    - Add `boardOpsArb` (0 to 30 steps of `addImage`, `addZone`, `removeZone` through `removeZoneCheck`, `removeImage`, `move`, `undo`, `redo`, applied with `executeCommand`, `undo`, `redo` from the Demo_Board or a `boardArb` start) to `model/arbitraries.ts` (a later wave than task 5.2). Test in `model/commands.test.ts` (a later wave than task 6.1).
    - **Property 10: P-APP2-10 adding an image is one undoable step.** For any Board from `boardArb` with fewer than 50 Image_Nodes, any Zone of it, and any Mood_Values, `addImageCommand` returns one `addNode` command; `executeCommand` on `createHistory(board, 100)` accepts it; the new Node has type `image`, the given `zone`, `front.image` equal to the reference, `attributes` exactly `{ brightness, temperature }`, a `position` inside the footprint of that Zone (`footprintAt`), and a `position` equal to no other Image_Node of that Zone; and `undo` gives a `present` `toStrictEqual` to the Board before.
    - **Validates: Requirements 4.2, 4.7, 5.7, 6.8**
    - Done when: `npm test` exits 0.

  - [x] 6.3 Write property test for save and load
    - In `model/board-data.test.ts` (a later wave than task 4.4), using `boardOpsArb`.
    - **Property 9: P-APP2-9 save then load leaves the board unchanged.** For any Board produced by `boardOpsArb` (from the Demo_Board and from `boardArb` starts), `saveScenario` then `loadScenario` returns a Scenario `toStrictEqual` to the saved one; every Image_Node `zone` names a Zone of the Scenario; every Zone and Node `id` is unique in its list; the Scenario holds no Edge; the Zones keep at least 2 entries with distinct `order`; the saved text is the same for any Board_Settings and marks (the saver never receives them). The Demo_Board passes the same round trip as a fixed case.
    - **Validates: Requirements 2.2, 2.5, 2.6, 2.7, 3.1**
    - Done when: `npm test` exits 0.

  - [x] 6.4 Implement `model/image-store.ts` with example tests
    - `referencesIn(history)` (every `front.image` in `past`, `present`, `future`), and `ImageStore` with `put`, `url` (`null` for an unknown reference), `remove`, and `prune(history)` (removes and releases every entry not referenced). The release function is injected.
    - Example tests in `image-store.test.ts`: `prune` keeps an entry while any of `past`, `present`, `future` refers to it and releases it once none does, through add, undo, a new command that clears `future`, and the History limit (15.6); `url` returns `null` for unknown references (4.11); `remove` releases once.
    - Design: Image_Store; M15, M16.
    - _Requirements: 4.6, 4.11, 15.6_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 6.5 Implement `model/controls.ts` with example tests
    - `controlsFor(state)` with the table of design.md "Controls" (including `rotateMode` and `scaleMode`) and `statusFor(state)` with the three status hints.
    - Example tests in `controls.test.ts`: the table row by row; `rotateMode`, `scaleMode`, and all editing controls disabled while the walk is `playing` or `paused` and while `busy` (5.1, 5.8, 12.8); `start` disabled for a Board with 1 Zone and for a Zone without a footprint; `pause`, `resume`, `stop` enabled only in their Walk_States (12.7); viewpoint buttons always enabled; `statusFor` gives the 12.8 hint in `playing` and `paused`, the two 12.9 hints for 1 Zone and for a missing footprint, and no hint otherwise.
    - Design: Controls.
    - _Requirements: 5.1, 5.8, 12.7, 12.8, 12.9_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 6.6 Implement `model/curve-layout.ts` with example tests
    - `curveLayout(curve, width, height)`: x place per rank `x = pad + rank × (width − 2·pad) / max(1, n − 1)`, y per point with the M19 ranges (brightness 0 to 1; color temperature −0.5 to +0.5, values outside drawn at the edge), polyline points, empty places for `noData` Zones, Zone labels with the Entrance and Exit tags, and the pointer text of each point (`{zone}: brightness {value}`, `{zone}: warmth {signed value}`, 2 decimals, true value). Pure; no DOM.
    - Example tests in `curve-layout.test.ts`: points ordered by rank; `noData` places; the Entrance and Exit tags; a value outside ±0.5 is drawn at the edge while its pointer text holds the true value; a single Zone does not divide by zero (3.10, 7.3, 7.4).
    - Design: UI and Curve_Panel; M18, M19.
    - _Requirements: 3.10, 7.3, 7.4_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

- [x] 7. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 8. Browser image reading and samples
  - [x] 8.1 Implement `browser/images.ts` and `browser/samples.ts`
    - `browser/images.ts`: `readImageFile(file)`: `createImageBitmap`, `analysisSize`, one `drawImage` into a canvas of that size with `imageSmoothingEnabled = true` and `imageSmoothingQuality = "high"`, `getImageData` in sRGB, a display copy that fits 512 × 384 (never enlarged) as a PNG `blob:` URL, `bitmap.close()`, no reference to the `File` kept, no metadata read, no network call; a decode failure returns `{ ok: false, reason: "decode" }`. Imports only `../model/pixels.ts`.
    - `browser/samples.ts`: `renderSamples(recipes)` turns each `samplePixels` result into a PNG `blob:` URL with `putImageData` and `toBlob("image/png")`, returning `Map<string, string>` keyed `sample:<id>`. Imports only `../model/sample-images.ts`.
    - These files use DOM APIs and are not unit-tested (browser only); they are checked by the human gate. Not imported by any entry page until task 10.3, so the public URL is unchanged.
    - Design: Browser image reading; Sample images; M3, M13, M15.
    - _Requirements: 4.2, 4.8, 4.9, 13.6, 16.1, 16.2, 16.3_
    - Safety: S-APP2-2, S-APP2-3, S-APP2-4.
    - Done when: `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:build` exit 0.

- [x] 9. Controller
  - [x] 9.1 Extend `apps/moodwalk/text.ts` with the UI texts
    - Add the `LocalizedText` constants of design.md "UI texts" (walk controls, viewpoints, image controls, gizmo, status hints, pointer text builders, zone controls, history, setting labels, chart titles, flag labels and reasons, all messages and field messages), each `{ en, ja }`. Keep `title`, `backLink`, and `body` (the placeholder page still uses `body`; it is removed in task 10.3). No claim, comparison, or technical term.
    - Example test in `text.test.ts`: every exported `LocalizedText` has a non-empty `en` and a non-empty `ja` (1.5); no text contains a competitor claim or an OWASP item (S-APP2-7, S-APP2-8).
    - Design: UI texts; D-O3.
    - _Requirements: 1.5, 8.5, 9.7_
    - Safety: S-APP2-7, S-APP2-8.
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 9.2 Implement `controller.ts`: state, start, and zone operations
    - `ViewPort`, `ImagePort`, `FileLike`, `UiSink`, `BoardViewState`, and `BoardController` as in design.md: the state fields (`history`, `settings`, `marks`, `activePreset`, `walk`, `marker`, `selection`, `targetZone`, `busy`, `pending`, `report`); `start()` (recompute, `setEffects`, render); `recompute()` (`checkMood`, `setEffects` or `setEffects([])` plus the Rule_Failure message); `act` and the `onEdit` handler with every body inside `try`, restoring `history`, `settings`, and `marks` and showing the "action failed" message on an exception; add and remove zone through `execute` with `pending`; removing a Zone drops its mark; the Restart in `queueMicrotask` (`restart`, then `setEffects`, then `setGizmoMode`, then `walk = "idle"` and `marker = null`, then render) when Zone ids or `order` changed, with the active preset first. Imports only types from `core/view/start-view.tsx`. Every other `act` case (gestures, undo and redo, remove image, gizmo buttons, viewpoints, settings, marks, adding files, walk controls) returns without change here; tasks 9.3 and 9.4 fill them in.
    - Design: Controller; Controls; M17, M18, M21.
    - _Requirements: 1.1, 2.4, 3.6, 3.7, 3.8, 3.9, 5.1, 7.9, 9.5, 9.12, 10.5, 11.5, 15.1, 15.2_
    - Done when: `npm run typecheck` and `npm run lint` exit 0.

  - [x] 9.3 Extend `controller.ts`: gestures, undo and redo, settings, marks, and viewpoints
    - In the same file as task 9.2 (so it runs in a later wave): the Gesture `history` report path with `classifyMove` (`zone` → nested `execute`; `outside` → `setHistory(prev)` and the message) with the `pending` save-and-restore `finally`; the controller sets its own `history` after each `setHistory` and then runs `prune` and `recompute`, so the nested `execute` causes exactly one recompute per History change; undo and redo with `pending`; remove image; Rotate and Scale buttons (`setGizmoMode`); viewpoint buttons (`stopWalk` first when the walk is `finished`, then `setPreset`); setting fields with `parseSettingField`; mark and unmark; `prune` after every History change; the restore on exception of task 9.2 also covers these cases. Adding files and the walk controls are left to task 9.4.
    - Design: Controller; Controls; M17, M18, M21.
    - _Requirements: 2.7, 5.1, 5.2, 5.3, 5.4, 5.6, 7.5, 8.4, 8.5, 10.2, 10.3, 11.4, 15.1, 15.2, 15.6_
    - Done when: `npm run typecheck` and `npm run lint` exit 0.

  - [x] 9.4 Extend `controller.ts`: adding images and the walkthrough
    - In the same file as tasks 9.2 and 9.3 (so it runs in a later wave): `addFiles` (busy, `setEditMode("view")`, per file in browser order: `checkImageFile` with the current `present` count, `await images.read`, `analyzeMood`, release the display URL on failure, reference `upload:<counter++>`, `store.put`, `pending = "execute"`, `execute(addImageCommand(present at that moment, …))`, remove the store entry on an `errors` report; `finally`: `busy = false`, `setEditMode("edit")`); `dropText()` message; the walk controls: Start (`canWalk`, `setEditMode("view")`, `linkedTimeline`, `startWalk("route", walkDuration(n), timeline)`), Pause, Resume, Stop (`stopWalk`, `setEditMode("edit")`, `marker = null`); `onWalk` `finished` → `stopTimeline()`, `setEditMode("edit")`, marker stays on the Exit (M12); `onTimeline` position → `marker` from the step target; the `walk` error context shows each Field_Path and message and leaves the Board unchanged; the other Edit_Callback contexts of design.md "Callbacks"; the 12.8 and 12.9 status hints through `statusFor`; setting fields, marks, and editing controls stay disabled while the walk is `playing` or `paused`; a viewpoint during a walk only changes the Active_Preset.
    - Design: Controller (Adding images; Callbacks); M11, M12.
    - _Requirements: 4.2, 4.4, 4.5, 4.6, 4.10, 5.8, 9.13, 12.1, 12.2, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 15.1, 15.2, 15.5_
    - Safety: S-APP2-3.
    - Done when: `npm run typecheck` and `npm run lint` exit 0.

  - [x] 9.5 Write example tests for the controller: start, zones, gestures, settings, marks
    - In `controller.test.ts`, with a recording stub `ViewPort` (whose `execute` mimics `ViewStore.execute`: applies `executeCommand` and calls `controller.onEdit({ kind: "history" })` synchronously before returning), a stub `ImagePort`, and a stub `UiSink`. These cases use only the behaviour of tasks 9.2 and 9.3, so the task needs no walk behaviour of task 9.4: `start` calls `setEffects` with the Demo_Board effects (1.1, 9.5); add zone → `execute(addZone)` then after the microtask `restart(history, settings)` with the active preset first, then `setEffects`, then `setGizmoMode` with the chosen mode (3.9, 11.5, 5.1); undo of an add zone restarts too; remove zone drops its mark (10.5); a Gesture move into another Zone sends one `updateNode` with `zone`, a move into the gap calls `setHistory(prev)` with the message (5.3, 5.4); undo and redo recompute and prune (5.6); **re-entrancy**: a Gesture report of a move into another Zone records exactly one nested `execute(updateNode zone)`, the controller History equals the stub History at the end, `pending` is back to `null`, and there is one recompute per History change; a stub `setHistory` that sends no report still leaves the controller History equal to the History passed (move into a gap); remove image (5.2); the Scale and Rotate buttons call `setGizmoMode` (5.1); a viewpoint button calls `setPreset` (11.4); invalid setting keeps the settings and sets the field notice (8.5); a valid setting recomputes (8.4); mark and unmark recompute and change the effects (10.2, 10.3); a Rule_Failure gives `setEffects([])` and the message (7.9, 9.12); a throwing stub leaves the History, settings, and marks unchanged and shows the failure message (15.1); each message replaces the previous one (15.2).
    - Design: Testing Strategy (`controller.test.ts`); Controller.
    - _Requirements: 1.1, 3.9, 5.1, 5.2, 5.3, 5.4, 5.6, 7.9, 8.4, 8.5, 9.5, 9.12, 10.2, 10.3, 10.5, 11.4, 11.5, 15.1, 15.2_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 9.6 Write example tests for the controller: images, walkthrough, errors
    - In `controller.test.ts` (the same file as task 9.5, so it runs in a later wave; it also needs task 9.4): `addFiles` with three files where the second fails gives two `addNode` calls in order and one message, keeps going after the failure (4.4, 15.5); `addFiles` calls `setEditMode("view")` before the first `images.read` and `setEditMode("edit")` after the last file, also when a stub read throws (5.8, 15.5); each `addImageCommand` is built from the `present` at execution time; a failing `execute` removes the store entry (4.6); a 51st image shows the limit message (4.5); an `Analysis_Failure` releases the display URL and shows the message (4.4); a dropped link gives the message and no call (4.10); Start → `setEditMode("view")`, `startWalk("route", 24, timeline)` on the Demo_Board (12.1, 12.2); Start is a no-op with 1 Zone and the hint stays (12.9); `finished` → `stopTimeline`, `setEditMode("edit")`, marker on the Exit (12.6); after a finished walk (marker on the Exit) an add zone and its restart leave `walk = "idle"` and `marker = null` in the last `render` state (3.9, 12.6); a viewpoint button after `finished` calls `stopWalk` before `setPreset` (11.4, 12.11); Timeline positions move the marker (12.5); Pause, Resume, Stop call the handle functions and Stop clears the marker (12.7); editing controls are disabled during the walk (12.8); a `walk` error shows each Field_Path and leaves the Board unchanged (12.10); the Mood_Effects do not change while the walk is `playing` (9.13).
    - Design: Testing Strategy (`controller.test.ts`); Controller.
    - _Requirements: 3.9, 4.4, 4.5, 4.6, 4.10, 5.8, 9.13, 11.4, 12.1, 12.2, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 15.5_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

- [x] 10. DOM panel and page wiring
  - [x] 10.1 Implement `ui.ts` controls and the page shell
    - `ui.ts`: a `UiSink` that draws the Route_Controls with `document.createElement` and `textContent` only: "Start walkthrough" as the first and largest button (13.7), Pause, Resume, Stop, the status hint, the viewpoint buttons, the file picker (`<input type="file" multiple accept="image/png,image/jpeg,image/webp">`), the "Add images to" Zone list with Entrance and Exit tags, add and remove zone, remove image, Rotate and Scale (the pressed one marked), Undo and Redo, the three setting fields with their field messages, the "Mark as intended" and "Remove mark" buttons, and the single message line. The `render` of the Curve_Panel is a call to a stub that task 10.2 fills in. No `innerHTML`. It holds no judgement logic.
    - `apps/moodwalk/index.html`: `<title>Moodwalk</title>`, keeping the entry script reference to `main.ts`. All new elements (`#header`, `#view` with CSS height from the start and `aspect-ratio: 16 / 9` (lessons.md 2026-11-23), `#panel`, `#curve`, `#notice`) go inside `#app`, and their styles are scoped under `#app`. Nothing is added outside `#app`.
    - Not imported by any entry page until task 10.3, so the public URL is unchanged.
    - Design: UI and Curve_Panel; Layout; UI texts.
    - _Requirements: 1.5, 4.1, 5.1, 7.5, 8.3, 9.7, 10.1, 10.3, 11.4, 12.1, 12.6, 12.7, 12.9, 13.7_
    - Safety: S-APP2-3, S-APP2-4.
    - Done when: `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:build` exit 0, and the public page is unchanged: the built `dist/moodwalk/index.html` still loads the placeholder `main.ts` and the placeholder page shows the same title, text, and back link as before (the new markup is inside `#app` and is not imported or drawn by any entry page).

  - [x] 10.2 Implement the SVG Curve_Panel in `ui.ts`
    - In the same file as task 10.1 (so it runs in a later wave): the Curve_Panel as SVG made with `createElementNS` from `curveLayout`, inside `#curve` in `#app`: circles with a `<title>` pointer text, polylines, open circles for `noData`, a flag icon and color under each flagged Zone, the walk marker line, one line per Mood_Flag with its reason, and the no-flag message. SVG text nodes and `textContent` only; no `innerHTML`.
    - Design: UI and Curve_Panel; M18, M19.
    - _Requirements: 3.10, 7.3, 7.4, 9.6, 9.7, 12.5, 12.6_
    - Safety: S-APP2-3, S-APP2-4.
    - Done when: `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:build` exit 0, and the public page is still unchanged (as in task 10.1).

  - [x] 10.3 Implement the startup in `main.ts` and remove the placeholder
    - Replace `main.ts`: `loadBoardData(BUNDLED)`; on failure show "The board data is invalid." with each file, path, and message, plus the back link, and start nothing (1.4); `createHistory(scenario, 100)`; `renderSamples(SAMPLE_RECIPES)` into an `ImageStore` (release `URL.revokeObjectURL`; a failure shows the failure message and the Board still starts); `getContext("webgl2")` probe inside `try` (M21): without it call `startCoreView` as Ghost Mansion does, show the back link and "3D display is not available, so the board cannot be shown." and wire no control; otherwise build the `ViewPort` (`restart` = `handle.stop()` then `startCoreView(...)`), the `ImagePort` over `readImageFile`, the controller, and the UI; call `startCoreView` with `host = #view`, the History, `buildViewSettings(zones, "overview")`, the Theme, `resolveImage: (ref) => store.url(ref)`, and the controller callbacks; call `controller.start()`. The back link `href` is `import.meta.env.BASE_URL` and is always shown (1.6). Nothing is written to `localStorage`, IndexedDB, or cookies (1.7).
    - Remove the `body` constant from `text.ts` (and its use and test) and the `renderSimplePage` import from this page. Do not change `core/view/simple-page.ts`.
    - **Do not push this change to `main`** before the human check of task 10.4: this task replaces the public placeholder page.
    - Design: UI (`main.ts`); M13, M21; Error Handling.
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 1.7, 4.9, 13.6, 13.7, 14.1, 14.3_
    - Safety: S-APP2-3, S-APP2-4, S-APP2-6.
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0.

  - [x] 10.4 Add drag and drop to `main.ts` and measure the bundle
    - In the same file as task 10.3 (so it runs in a later wave): page-wide `dragover` and `drop` handlers on `document` with `preventDefault` (files go to `addFiles`, a drop with no file calls `dropText`).
    - Run `npm run build` and `npm run check:build`. If `check:build` reports a foreign URL, stop and ask the human before changing the allow list. Check the build output: Moodwalk's own JavaScript (chunks not shared with Ghost Mansion or the core demo) is at most 60 KB before gzip (M14) and the Scenario_File is at most 16 KB; report the numbers in the checkpoint. The Top_Page link to `/moodwalk/` keeps working.
    - Design: UI (`main.ts`); M14; Error Handling.
    - _Requirements: 1.2, 4.1, 4.10, 13.6, 13.8_
    - Safety: S-APP2-3, S-APP2-4.
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0, and the human checks `npm run build && npx vite preview` (the Demo_Board is shown and one walkthrough plays) **before the first push**. Nothing from tasks 10.3 and 10.4 is pushed to `main` until that check passes.

- [x] 11. Decision records
  - [x] 11.1 Record fallbacks and lessons
    - If task 4.3 used a different JSON import form, if task 1.1 used the two-ban lint form, or if any other fallback was taken, add one line to `docs/decision-log.md` per fallback and one line to `.kiro/steering/lessons.md` per lesson (`date | type | what happened | fix`). If none was taken, add no line and say so in the checkpoint report. The decision-log lines required by the design are already added in tasks 1.1 (lint scope, D-O2) and 1.2 (placeholder replaced). Confirm `FALLBACK.brightnessOnly` is `false` in `fallback.ts` (M20).
    - Design: Fallbacks; Changes outside apps/moodwalk/.
    - _Requirements: 14.6_
    - Done when: `npm run check:sections` exits 0.

- [x] 12. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 13. Verification gate (human approves; the agent must not mark this done)
  - Scope: this is the second App spec and Unit 3 (submission state ③, the most important). The gate includes the deploy check on the public URL. No Vibe polish is planned before this gate (00-scope.md: all Must items first).
  - **[Agent]** Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm run build`, `npm run check:build`; report each result and the test counts (test files, tests passed, how many are property tests, P-APP2-1 to P-APP2-12).
  - **[Agent]** Confirm the name test (R-FND-10.15) shows no Moodwalk name under `core/` and that `git status` shows no change under `core/` made by this spec (14.3). Confirm `docs/decision-log.md` holds the lines of tasks 1.1 and 1.2. Report any missing line.
  - **[Agent]** Confirm the latest build is deployed to the public URL: the GitHub Actions deploy run for the latest push to `main` succeeded and `/moodwalk/` shows the Moodwalk board, not the placeholder. Report the run and the commit (unit-approval 3.2). If the push is not done, say so and stop before the Human steps.
  - **[Agent: reviewer]** Check requirement coverage (R-APP2-01 to 16 and P-APP2-1 to 12 each have a task and a test or a gate item), the core/app boundary (no import of `core/view/demo/`, `core/view/scene/`, or test files; no change under `core/`; the import limits of `apps/moodwalk/browser/` (only `../model/pixels.ts`, `../model/sample-images.ts`, and types) and of `controller.ts` (only `import type` from `core/view/start-view.tsx`), which lint does not enforce, read file by file; no Moodwalk name in `core/`), no AI_Adapter, LLM client, `fetch`, `XMLHttpRequest`, `Date`, or `Math.random` in `apps/moodwalk/` (6.9, 14.4), no DOM global in `apps/moodwalk/model/` (6.1), no `innerHTML`, no browser storage (1.7, S-APP2-4), no key, token, or personal data (14.7), no image generation and no AI-generated image (S-APP2-1, S-APP2-2), every Sample_Image a code recipe and every Demo_Board text fictional (S-APP2-5), no competitor or expected-value claim in the UI (S-APP2-7), the fallback switch off, no feature beyond design.md (intent nodes, source records, export, storage), and test placement. Report READY or NOT-READY with findings.
  - **[Human]** Public-URL checklist (Moodwalk, desktop Chrome or Edge, after the push to `main` has deployed; design.md "Manual verification checklist"):
    1. The Top_Page link opens `/SpatialCore/moodwalk/`. The Demo_Board appears in the Overview with seven labelled Zones, ten images facing the camera, the Curve_Panel, and fog on `corridor`, `classroom`, `music-room` and `rest-corner`, `exit`. "Start walkthrough" is visible without scrolling (1.1, 13.4, 13.7).
    2. One click on "Start walkthrough": the camera walks from the Entrance to the Exit at eye height, the fog stays visible, the Curve_Panel marker moves Zone by Zone, and the walk ends at the Exit. Record the time from opening the URL to the end of the walk in `docs/decision-log.md`; it must be at most 60 seconds (12.1 to 12.6, intent.md 10.6).
    3. Pause, Resume, and Stop work; Stop returns the camera to the Active_Preset; the editing controls are disabled during the walk (12.7, 12.8, 12.11).
    4. "Visitor view" shows the Entrance at eye height with its image; "Overview" shows the whole route. Resize the window narrow and wide: `#view` keeps an aspect ratio of at least 1.26 and the Entrance image stays fully in the Visitor view (11.2 to 11.4).
    5. "Mark as intended" on `rest-corner` removes its fog and flag; "Remove mark" brings them back (10.1 to 10.4).
    6. Changing the three settings changes the flags at once; an invalid value shows its field message and keeps the flags (8.3 to 8.5).
    7. Add a PNG, a JPEG, and a WebP with the file picker and by dropping them: each appears in the chosen Zone facing the route and the curve point moves; a GIF, a file over 10 MB, and a dropped link each show their message (4.1 to 4.5, 4.10).
    8. Drag an image into the next Zone: its Zone changes and the curve updates; two undo steps restore it. Drag one into a gap: it goes back with the message. Select an image, press "Rotate" and rotate it with the gizmo, then "Scale" and scale it: the curve and the flags do not change and each gesture is one undo step; "Rotate" and "Scale" are disabled during a walkthrough; undo and redo work (5.1 to 5.6).
    9. Add a Zone (it appears as the new Exit), remove an empty Zone, and try to remove a Zone with images (message) (3.6 to 3.9).
    10. DevTools Network panel, cache disabled, full reload and a walkthrough: every request goes to `https://seimu1207.github.io`; adding an image makes no request (1.2, 4.9, S-APP2-3).
    11. Frame budget on the Demo_Board (7 Zones, no Zone added or removed) with 50 images (add 40 images until the limit message): orbit and drag for 10 seconds with "Frame rendering stats" on and confirm 60 fps or more; with the Performance panel, move one image and confirm the task after the edit (Mood_Curve, Shift_Check, Mood_Effects) takes at most 100 ms; with cache disabled the Demo_Board appears within 5 seconds. Record the values, the machine, and the browser version in `docs/decision-log.md` (13.8, 15.3, 15.4, R-VIEW-16). **If the median frame time is above 16.7 ms, ask the human which step of design.md "Frame budget fallback" to take; take no step without an answer, plan no change under `core/` in this spec (steps 1 and 2 need a separate approval and a Ghost Mansion re-check), and measure again after each step taken. Step 3 (drop the `same-mood-fog` style) and step 4 (lower the 50-image limit) are App-side and also need the human's answer.**
    12. Reload: the Demo_Board is shown again. The back link returns to the Top_Page (1.6, 1.7).
  - **[Human]** Then approve the spec's result and add one line to `docs/decision-log.md` (date / Unit / what was checked / result). This is the gate of Unit 3 (`app-moodwalk`), submission state ③.
  - **[Human]** Any Vibe polish (look and feel of the 3D scene or panel) happens only after this approval, only if the human asks, and is time-boxed to half a day (product.md fallback: freeze the look and move on). Failing sensors still block every polish change.
  - _Requirements: 1.1, 1.2, 1.6, 1.7, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 4.10, 5.1, 5.2, 5.3, 5.4, 5.6, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 11.2, 11.3, 11.4, 12.1, 12.5, 12.6, 12.7, 12.8, 12.11, 13.4, 13.7, 13.8, 14.3, 14.7, 15.3, 15.4_

- [x] 14. Vibe: usability polish of the Moodwalk page (after the gate, time-boxed to half a day)

  - [x] 14.1 Make the page easy to use (layout and styling only)
    - Context: the verification gate (task 13) was approved by the human on 2026-11-27, and the human asked for a more usable UI. This is Vibe work (intent.md 10.1, 00-scope.md: time-box, sensors still must pass). The human previews with `npm run build` and `npx vite preview` at `/SpatialCore/moodwalk/` and decides what to push.
    - Scope, presentation only: `apps/moodwalk/index.html` (CSS scoped under `#app`), DOM structure, class names, and ARIA in `apps/moodwalk/ui.ts`, and UI wording in `apps/moodwalk/text.ts` only if a label is unclear (keep `{ en, ja }` with a non-empty `en`, and keep `text.test.ts` and the `controls.test.ts` hint equality green).
    - Goals:
      - Group the right-hand panel into labelled sections with clear headings, spacing, and consistent buttons: Walkthrough, View, Images, Zones, Edit tools, Settings, Marks.
      - Make "Start walkthrough" the clearly primary control.
      - Show the notice and status message near the controls and visibly, not hidden below the fold.
      - Make the Curve_Panel visible without long scrolling (for example under or beside the 3D view) at common desktop sizes.
      - Use readable font sizes and contrast on a dark theme that matches the 3D scene.
      - Give buttons visible focus, hover, pressed (`aria-pressed`), and disabled states.
      - Keep the 3D view aspect ratio at least 1.26 (R-APP2-11, design.md View_Settings) and `#view` filling its area.
      - Give every input a label with `for` and `id`.
      - Add short helper text for the three settings.
      - Add a small legend for the flag colours in the Curve_Panel.
    - Must not change: judgement, `model/`, `controller.ts` behaviour, `main.ts` wiring, `core/`, any requirement behaviour or the set of operations, the meaning and enabled/disabled rules of `ControlId`. Text is drawn with `textContent` only (no `innerHTML`). All new elements stay inside `#app`. No new dependency, no external font, CSS, or URL (`check:build` allow list), no AI, no storage.
    - Time-box: half a day. If the 3D view styling takes longer, freeze the look and stop (00-scope.md).
    - Done when: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run check:build` exit 0. The existing tests need no semantic change (only selectors or class names if a test reads them). Report which files changed. The agent does not push; the human previews and approves, then one line is added to `docs/decision-log.md`.
    - _Requirements: 11.2, 11.3, 12.1, 13.7_

## Notes

- Files touched by more than one task, kept in different waves: `model/arbitraries.ts` (tasks 2.2, 4.2, 5.2, 6.2), `model/arbitraries.test.ts` (2.2, 5.2), `model/mood.test.ts` (2.1, 2.3, 2.4, 2.5), `model/shift-check.test.ts` (5.4, 5.5, 5.6, 5.7, 5.8), `model/layout.test.ts` (5.1, 5.3), `model/walk.test.ts` (5.9, 5.10), `model/commands.test.ts` (6.1, 6.2), `model/board-data.test.ts` (4.4, 6.3, 5.11), `controller.ts` (9.2, 9.3, 9.4), `controller.test.ts` (9.5, 9.6), `ui.ts` (10.1, 10.2), `main.ts` (10.3, 10.4), `text.ts` (9.1, 10.3), `apps/moodwalk/scenarios/school-festival-haunted-house.json` (1.2, 2.6), `docs/decision-log.md` (1.1, 1.2, 11.1, 13).
- The public URL keeps the placeholder Moodwalk page until task 10.3. The model, the browser part, the controller, and the UI are not imported by an entry page before that. The Demo_Board file replaces the placeholder Scenario_File in task 1.2 without a page change, because the placeholder page does not import it.
- Task 5.11 sits after task 6.3 in a later wave only because both write `board-data.test.ts`; it does not depend on it.
- Property to task map: P-APP2-1 → 2.3, P-APP2-2 → 2.4, P-APP2-3 → 2.5, P-APP2-4 → 5.5, P-APP2-5 → 5.6, P-APP2-6 → 5.7, P-APP2-7 → 5.8, P-APP2-8 → 5.3, P-APP2-9 → 6.3, P-APP2-10 → 6.2, P-APP2-11 → 5.10, P-APP2-12 → 4.2.
- Safety map: S-APP2-1 → 2.1, 5.4, gate reviewer; S-APP2-2 → 2.6, 8.1, gate reviewer; S-APP2-3 → 8.1, 9.4, 10.1, 10.2, 10.3, 10.4, gate item 10; S-APP2-4 → 6.1, 8.1, 10.1, 10.2, 10.3, 10.4; S-APP2-5 → 1.2, 2.6, 5.11; S-APP2-6 → 10.3, gate item 10; S-APP2-7 → 5.11, 9.1; S-APP2-8 → 9.1.
- Out of scope, so no task: intent nodes, source records, JSON export, IndexedDB storage, AI tension estimate, share links, glow and other effects, JA/EN switch UI, `new-app-template`, and any change under `core/` (requirements.md "Out of scope"; design.md "Core changes: None").
- Waves are a guide for parallel work; the checkpoints are kept in task-number order (a checkpoint runs after the tasks it follows).
- No `tasks.meta.json` is created here; Kiro writes it when tasks are executed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.6"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["2.5"] },
    { "id": 6, "tasks": ["3"] },
    { "id": 7, "tasks": ["4.1", "4.3", "5.1"] },
    { "id": 8, "tasks": ["4.2", "4.4", "5.4", "5.9", "6.1", "6.4", "6.5"] },
    { "id": 9, "tasks": ["5.2", "6.6"] },
    { "id": 10, "tasks": ["5.3", "5.5", "5.10", "6.2"] },
    { "id": 11, "tasks": ["5.6", "6.3"] },
    { "id": 12, "tasks": ["5.7", "5.11"] },
    { "id": 13, "tasks": ["5.8"] },
    { "id": 14, "tasks": ["7"] },
    { "id": 15, "tasks": ["8.1", "9.1"] },
    { "id": 16, "tasks": ["9.2", "10.1"] },
    { "id": 17, "tasks": ["9.3", "10.2"] },
    { "id": 18, "tasks": ["9.4", "9.5"] },
    { "id": 19, "tasks": ["9.6"] },
    { "id": 20, "tasks": ["10.3"] },
    { "id": 21, "tasks": ["10.4"] },
    { "id": 22, "tasks": ["11.1"] },
    { "id": 23, "tasks": ["12"] },
    { "id": 24, "tasks": ["13"] },
    { "id": 25, "tasks": ["14.1"] }
  ]
}
```
