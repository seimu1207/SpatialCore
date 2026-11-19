# Implementation Plan: core-view

## Overview

Language: TypeScript (design.md uses TypeScript; scene files are TSX). Build order follows design.md and keeps the public URL working after every task:

1. Package, TSX, and `repo-foundation` sensor changes, including the `check:build` amendments, and a stub Core_Demo page that the build, the top page, and `check:build` already know (tasks 1.1 to 1.6).
2. Pure View_Helpers with their tests, one helper per task (tasks 3 and 4), then the View_State_Reducer (task 6).
3. Scene components (task 8), then interaction (task 10).
4. The Core_Demo content (task 12), decision records (task 13), and the verification gate (task 15).
5. Amendment 2026-11-16 (Edge selection, Select_Callback, `execute`): task 16, after task 15, with its own gate 16.7.

Nothing under `core/view/` is imported by an entry page until task 8.9, which wires a temporary minimal start into the stub demo page so that the first bundle that contains three.js and Fiber is built and scanned by `check:build` early. Task 12.3 replaces that start with the real demo. The top page and the two App pages are never changed except for the one Core_Demo link (task 1.6).

Conventions for every task:
- Requirement IDs `X.Y` mean R-VIEW-X.Y. IDs written `R-FND-X.Y`, `R-GRAPH-X.Y`, `R-RULES-X.Y` belong to `repo-foundation`, `core-graph`, `core-rules`. "Design:" names the design.md section used.
- Tests and PBT run only when a task is completed (tech.md). Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:build`.
- Every task leaves `tsc --noEmit` and lint green, and `npm run build` plus `npm run check:build` green once task 1.3 is done. Tasks are numbered by group, not by execution order; the Task Dependency Graph gives the order (for example 8.9 runs before 8.5 to 8.8, and 8.10 after 8.5). Failing sensors block a change (tech.md).
- Property tests: one test per property, `numRuns` ≥ 100, the test name starts with the property ID (`P-VIEW-n`), and a tag comment `// Feature: core-view, Property n: <title>` (design.md Testing Strategy, R-FND-10.5).
- As in `core-graph` and `core-rules`, tests are required by the repo-foundation convention and R-GRAPH-10.5, so no test sub-task is marked optional with `*`. Property tests are separate sub-tasks placed right after the code they test.
- Test files sit next to their source, named `<source file base name>.test.ts`, run under Vitest in Node with no DOM or WebGL, and import no `three`, React, Fiber, or drei module (R-VIEW-01.10). No `.test.tsx` file is written.
- View_Helpers import only `zod`, `core/model/` (symbols exported by non-test files), and each other. `core/view/helpers/arbitraries.ts` is test support, imported only by `*.test.ts` files.
- No file under `core/view/` contains an app-specific name (R-VIEW-01.6, R-VIEW-21.3), including comments, test names, test data, SVG text, and file names. Use generic words (`card`, `note`, `link`, `step`, `haze`, `area-a`).
- No Node_Type, Edge_Type, attribute name, Effect_Kind, Zone Identifier, or ViewPreset Identifier appears as a constant, default, enum, or allowed-value list in `core/view/` product code (R-VIEW-01.7). The `fog` style name, `bothEnds`/`anyEnd`, `view`/`edit`, and `rect`/`ring` are View_Settings vocabulary and are allowed.
- No View_Helper throws and none writes to its arguments (R-VIEW-20.1, 20.2, 20.7). Scene code draws text only with canvas `fillText` and DOM `textContent`, never as HTML (S-VIEW-2). Nothing under `core/view/` uses cookies, `localStorage`, `sessionStorage`, or IndexedDB (S-VIEW-5).
- The view changes a Scenario only by passing Edit_Commands to `core/model/history.ts` (R-VIEW-01.8).
- No dependency other than those of task 1.1. Do not add `@vitejs/plugin-react` or a React lint plugin.
- Decisions and fallbacks found during a task go into `docs/decision-log.md` as one line: `date | section | decision | reason`. Do not edit older lines.
- Do not commit or push unless the human says so.
- The four spike checks of intent.md 3.3 (gizmo vs. camera controls, snapping, Edge following, 60 fps with 50 images) are manual and are listed in the verification gate (task 15). A failing check takes the intent.md 3.3 fallback and adds a decision-log line.

## Tasks

- [x] 1. Packages, build configuration, and sensor amendments
  - [x] 1.1 Add the 3D packages, TSX settings, and the allowed-package list entries
    - In `package.json` add `dependencies` with exact versions (no `^`, `~`, ranges): `three` 0.187.0, `@react-three/fiber` 9.8.2, `@react-three/drei` 10.7.9, `react` 19.3.1, `react-dom` 19.3.1; add to `devDependencies` `@types/three` 0.187.0, `@types/react` 19.3.0, `@types/react-dom` 19.3.0. Run `npm install` so `package-lock.json` matches. Keep every existing entry unchanged. If `npm install` reports a peer-range conflict, keep these versions and report the conflict to the human before changing any version (design.md, Packages, TSX, tsconfig, ESLint).
    - `tsconfig.json`: add `"jsx": "react-jsx"`. No `paths` key. `types` stays `["node", "vite/client"]`.
    - `vite.config.ts`: add `oxc: { jsx: { runtime: "automatic", importSource: "react" } }`. No `@vitejs/plugin-react`.
    - `scripts/sensors/repo-rules.ts`: `ALLOWED_PACKAGES` gets `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei` (R-FND-02.7 amendment; `react`, `react-dom`, `@types/react`, and `@types/react-dom` are checked against the list as design.md and the existing file require; if they are not yet listed, add them with the same one-line reason and report it). Update `scripts/sensors/repo-rules.test.ts` so the allowed-package test lists the new entries and still rejects an unlisted package.
    - Add one line to `docs/decision-log.md` naming each added package with its exact version (R-VIEW-01.2).
    - Design: Packages, TSX, tsconfig, ESLint; repo-foundation changes (R-FND-02.7).
    - _Requirements: 1.1, 1.2, 1.7, 21.8_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0.

  - [x] 1.2 Allow four exact non-fetched URL strings in the `check:build` scan
    - In `scripts/sensors/build-output.ts` give `findForeignUrls` a third argument, an exact-match list (`url === entry`), next to the existing prefix list. Add `ALLOWED_EXACT` with exactly: `https://react.dev/link/hydration-mismatch`, `https://github.com/pmndrs/react-three-fiber#readme`, `https://github.com/pmndrs/react-three-fiber/issues`, `https://opencollective.com/react-three-fiber`. Leave `ALLOWED_PREFIXES` unchanged. Pass the list from `build-output.cli.ts`.
    - `scripts/sensors/build-output.test.ts`: each of the four exact entries passes; `https://github.com/pmndrs/react-three-fiber/x` and `https://cdn.jsdelivr.net/x` still fail.
    - Add one line to `docs/decision-log.md`: the four allowed strings, that they are text embedded by React DOM and Fiber and never fetched, and the human approval of open question O6 (design.md, Resolved).
    - Design: repo-foundation changes (R-FND-02.11 / 10.12); Research findings (Fiber embeds its package metadata).
    - _Requirements: 3.9, 21.8_
    - Done when: `npm test` and `npm run check:build` exit 0.

  - [x] 1.3 Add the stub Core_Demo page, the Vite entry, and the `check:build` page list
    - Create `core/view/demo/index.html` and `core/view/demo/main.tsx`: a page with a title and one line of generic text, and a script that imports no `core/view` module yet. The page must load under the Public_URL base path.
    - `vite.config.ts`: `rolldownOptions.input` gets `"core-demo"` = `core/view/demo/index.html` (four entry pages, R-FND-02.4). Rename `flattenAppPages` to `flattenPages` with the move list `apps/ghost-mansion/index.html → ghost-mansion/index.html`, `apps/moodwalk/index.html → moodwalk/index.html`, `core/view/demo/index.html → core-demo/index.html`; after the moves remove the emptied folders `apps/<app>`, `apps`, `core/view/demo`, `core/view`, `core` with `rmdir` (it fails loudly if a folder is not empty). Output path `dist/core-demo/index.html`, served at `/SpatialCore/core-demo/` (D10, R-FND-02.5).
    - `scripts/sensors/build-output.ts` and `build-output.cli.ts`: `PAGES` gets `core-demo/index.html` (a missing page fails); the CLI loop scans the script, style, and asset references of all four pages (R-FND-10.11). `build-output.test.ts` gets a missing-demo-page case.
    - Design: repo-foundation changes (R-FND-02.4, 02.5, 10.11); D10.
    - _Requirements: 21.1, 21.8_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0, and `dist/core-demo/index.html` exists after the build.

  - [x] 1.4 Add the `core-view-helpers` lint scope
    - In `scripts/sensors/boundary-rules.ts` add the scope `core-view-helpers` for `core/view/helpers/**/${TS}` after `core-view`, with `appsBan` repeated (a later flat-config entry replaces rule options), `modelPackageBans`, `helpersEscapeBan`, `modelDotDotBan`, and `dotDotAfterDotBan` as in design.md. If esquery rejects the lookahead in the `helpersEscapeBan` selector regex, replace it with bans on the path segments `scene` and `demo` and on `start-view`, and note this for task 13.1.
    - `scripts/sensors/boundary-rules.test.ts`: fixtures for `core/view/helpers/a.ts`. Rejected: `three`, `react`, `@react-three/drei`, `../scene/x.ts`, `./../scene/x.ts`, `../../../apps/x/y.ts`, `../../model/../view/scene/x.ts`. Accepted: `../../model/history.ts`, `./snap.ts`. Keep the existing fixtures for `core/model/` (no `three`, React, `view`) and for `core/view/` (no `apps`) passing (R-VIEW-01.4).
    - Add one line to `docs/decision-log.md`: this changes a `repo-foundation` sensor.
    - Design: Lint scope for View_Helpers.
    - _Requirements: 1.3, 1.4, 1.5, 1.10_
    - Done when: `npm test` and `npm run lint` exit 0.

  - [x] 1.5 Extend the name test to every file under `core/view/`
    - `scripts/sensors/repo-rules.test.ts`: the R-FND-10.15 name test also lists every file under `core/view/` and checks its path and, for text files, its content for each App_Specific_Name, case-insensitive (fonts and SVG files included; a binary font file is checked by name only, and this is noted in the test). It must still cover `core/model/`.
    - Add one line to `docs/decision-log.md` (R-VIEW-01.6, as in R-GRAPH-10.2).
    - Design: repo-foundation changes (R-VIEW-01.6).
    - _Requirements: 1.6, 21.3_
    - Done when: `npm test` exits 0.

  - [x] 1.6 Add the Core_Demo link to the top page and log the `repo-foundation` amendments
    - `apps/top-page.ts`: add exactly one third link with a Localized_Text label `{ en: "Core demo", ja: "コアのデモ" }` and `href` `${import.meta.env.BASE_URL}core-demo/` (R-FND-03.1, R-VIEW-21.5). Update the existing top-page test, if there is one, to expect three links. The two App pages are not changed.
    - No `404.html` is added; the Core_Demo path stays reachable (R-FND-03.9, checked by hand at the gate).
    - Add one line to `docs/decision-log.md` that names R-FND-02.4, R-FND-02.5, R-FND-02.7, R-FND-03.1, R-FND-03.9, and R-FND-10.11 and the change made to each (R-VIEW-21.9; R-FND-02.7 was changed in task 1.1, R-FND-02.4, 02.5, and 10.11 in task 1.3).
    - Design: repo-foundation changes (R-FND-03.1, 03.9); D10.
    - _Requirements: 21.5, 21.9_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0.

- [x] 2. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 3. Settings and Theme schemas
  - [x] 3.1 Implement `core/view/helpers/settings-schema.ts`
    - Export `cameraPoseSchema` (issue at `target` when position equals target), `zoneFootprintSchema` (`rect` and `ring`; ring radii check at `innerRadius`), `visibilityFilterSchema`, `viewPresetSchema`, `cameraPathSchema` (exactly one of `waypoints` with ≥ 2 poses and `fromZones`; issue at the path entry), `viewSettingsSchema` (`presets` `min(1)`; `duplicateIds` over `presets`, `paths`, `zoneFootprints` in that order, running only when no other issue exists), inferred types, and `loadViewSettings(value)` with one outer `try` (unexpected exception → one error at `""`, message `the view settings could not be validated`). Reuse `localizedTextSchema` and `nonBlank` from `core/model/scenario-schema.ts`. Unknown fields are removed at every level. No defaults.
    - Example tests in `settings-schema.test.ts`: 02.4 (two duplicate preset ids give `presets.1.id` and `presets.2.id`), 02.5 (missing and empty `presets`), 02.6 (each listed fault with its exact path), 02.7 (`null`, `undefined`, `42`, `"x"`, `[]` return a failure and do not throw; the input is unchanged), and the example View_Settings of the design loads unchanged.
    - Design: Settings (`helpers/settings-schema.ts`); Data Models.
    - _Requirements: 1.7, 1.10, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 20.7_
    - Done when: `npx tsc --noEmit -p tsconfig.json`, `npm run lint`, and `npm test` exit 0.

  - [x] 3.2 Implement `core/view/helpers/theme-schema.ts` and `neutral-theme.ts`
    - `theme-schema.ts`: `nodeStyleSchema`, `edgeStyleSchema`, `effectStyleSchema` (`style` literal `fog`, opacity 0 to 1, colors `#rrggbb`, either case), `styleMap` (`z.custom` + `superRefine` + `transform`, keys walked by `compareCodePoints`, `Object.fromEntries` output so `__proto__` stays an own key, no allowed-key list), `themeSchema`, inferred types, `loadTheme`, `nodeStyleFor`, `edgeStyleFor`, `effectStyleFor` (all with `Object.hasOwn`).
    - `neutral-theme.ts`: `NEUTRAL_THEME` with the values of design.md and empty `nodes`, `edges`, `effects` maps.
    - Example tests in `theme-schema.test.ts`: 19.3 (`#ABCdef` passes; `#abc`, `red`, `#1234567` fail), 19.5 (non-object, missing `wall`, `style: "glow"`, opacity `-0.1`), 19.8 (`nodeStyleFor(theme, "constructor")` returns the default), 19.9 (`NEUTRAL_THEME` passes `loadTheme` and has three empty maps).
    - Design: Theme (`helpers/theme-schema.ts`, `helpers/neutral-theme.ts`).
    - _Requirements: 1.7, 19.1, 19.2, 19.3, 19.4, 19.5, 19.8, 19.9, 20.7_

  - [x] 3.3 Add the settings and Theme generators and write the property test for both loaders
    - Create `core/view/helpers/arbitraries.ts` (test support). Add `finiteArb`, `boundedArb`, `vec3Arb`, `poseArb`, `footprintsArb(s)`, `filterArb(s)`, `settingsArb(s)`, `themeArb`, `settingsMutationArb`, and `themeMutationArb` (each mutation carries its expected Field_Path). Reuse `identifierArb`, `localizedTextArb`, `scenarioArb`, `ruleScenarioArb`, `extraFieldsArb`, and `jsonEqual` from `core/model/arbitraries.ts`.
    - In `core/view/helpers/settings-schema.test.ts`:
    - **Property 8: P-VIEW-8 settings and themes are checked without throwing.** `fc.anything()` and `fc.jsonValue()` give a result with no throw and an unchanged input; each mutation gives `ok: false` with errors that include the expected path, in the same order on two calls; `extraFieldsArb` at every fixed-shape level leaves the result `jsonEqual`; every key of `nodes`, `edges`, `effects` (including `__proto__`, `constructor`, `toString`) is an own key of the result.
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 19.2, 19.3, 19.4, 19.5**

- [x] 4. Pure helpers with property tests
  - [x] 4.1 Implement `core/view/helpers/visibility.ts`
    - `computeVisibleSet(scenario, filter)`: the six steps of design.md (empty list matches nothing; `includeUnzoned` default is `filter.zones === undefined`; `bothEnds`/`anyEnd`; Zone visible by `zones`; output in list order). Reads only Node `id`, `type`, `zone`; Edge `id`, `from`, `to`, `type`; Zone `id`. Body in `try`; any non-Scenario value gives an empty Visible_Set.
    - Example tests in `visibility.test.ts`: empty `zones` list shows no Node, a Node with no `zone` follows `includeUnzoned`, an Edge to a hidden Node under both rules, a missing Zone id in `zones` is not an error.
    - Design: Visible_Set.
    - _Requirements: 6.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.10, 20.7_

  - [x] 4.2 Add `filterArb` use and write property test for visibility
    - Extend `arbitraries.ts` only if `filterArb` from task 3.3 lacks empty lists or fresh Identifiers. In `visibility.test.ts`:
    - **Property 3: P-VIEW-3 visibility rules.** Reference model per R-VIEW-07.2 to 07.5; `bothEnds` ⊆ `anyEnd`; removing a list entry never adds an element; extra names change nothing; only Scenario ids, each once, in list order; changing `order`, `elevation`, `enclosed`, `label`, `position`, `rotation`, `scale`, Faces, Metadata, or Numeric_Attributes leaves the result unchanged.
    - **Validates: Requirements 6.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

  - [x] 4.3 Implement `core/view/helpers/camera-path.ts`
    - `poseAt` (arc length; exact first and last Waypoint; skip segments of length 0; `T === 0` returns the first Waypoint for `progress < 1`; failure at `progress` for non-finite or out-of-range input), `waypointMarks`, `buildZoneWaypoints` (Zones with a footprint, ascending `order`, `position_k = (x, elevation + height, z)`, `target_k` as in design.md; failure when fewer than 2 Waypoints or a `target` equals its `position`), `tweenPose` (smoothstep), `posesEqual`.
    - Example tests in `camera-path.test.ts`: 09.5 (two Zones with the same center), 09.7 (two equal neighbours), 09.8 (all equal).
    - Design: Camera paths (`helpers/camera-path.ts`).
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 20.7_

  - [x] 4.4 Add camera generators and write property test for camera paths
    - Extend `arbitraries.ts` with `waypointsArb`, `progressArb`, and `badProgressArb`. In `camera-path.test.ts`:
    - **Property 4: P-VIEW-4 camera path interpolation.** Exact ends; polyline length equals `p × T` within `1e-9 × (1 + T)` and does not decrease; `position` lies on a segment and `target` follows the same fraction; finite components; every `badProgressArb` value fails at `progress`; `buildZoneWaypoints` gives one Waypoint per Zone with a footprint in ascending `order`, or fails exactly when fewer than 2 Waypoints or a `target` equals its `position`.
    - **Validates: Requirements 9.1, 9.2, 9.4, 9.5, 9.6, 9.7, 9.8**

  - [x] 4.5 Implement `core/view/helpers/snap.ts` and `detail.ts`
    - `snap(p, step)`: for `x` and `z`, `q = c / step`; return `c` when `q` is not finite or `|q| > 2 ** 40`, else `Math.floor(q + 0.5) * step + 0`; `y` copied. `showsDetail(camera, node, detailDistance)`: `Math.hypot(difference) <= detailDistance`.
    - Example tests in `snap.test.ts` and `detail.test.ts`: halfway rounds toward positive infinity, `-0` is returned as `0`, a huge component is returned unchanged, distance exactly equal to the limit shows detail.
    - Design: Snap; Detail decision.
    - _Requirements: 11.1, 11.2, 11.3, 13.3_

  - [x] 4.6 Write property test for snapping
    - In `snap.test.ts`.
    - **Property 5: P-VIEW-5 snapping.** Idempotent; `y` unchanged; each of `x` and `z` moves by at most `s / 2` (plus `1e-9 × max(|c|, s)` when `|c| / s ≤ 2⁴⁰`, and by 0 otherwise); each snapped component with `|c| / s ≤ 2⁴⁰` is a multiple of `s`; exact halfway values `(k + 0.5) × s` with small `k` and power-of-two `s` give `(k + 1) × s`.
    - **Validates: Requirements 13.3**

  - [x] 4.7 Write property test for the detail decision
    - In `detail.test.ts`.
    - **Property 6: P-VIEW-6 detail layer decision.** `showsDetail` is `true` exactly when `Math.hypot` of the difference is at most the distance; moving the camera toward the Node by `λ` in `[0, 1]` never turns `true` into `false`.
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [x] 4.8 Implement `core/view/helpers/edge-layout.ts`
    - Export `MIN_EDGE_GAP` (0.15), `edgeOffsets` (group visible non-loop Edges by the unordered pair in `compareCodePoints` order, sort by Edge `id`, spacing `S = max(MIN_EDGE_GAP, 2 × max width)`, offset `(k − (n − 1) / 2) × S`), `edgeMidpoint` (canonical direction from the smaller-id end; `perp` falls back to `(1, 0, 0)` for a vertical direction or `A = B`), and `loopSizes` (radius `0.35 × (1 + 0.5 k)` per Node, Edges sorted by `id`). Edge widths come from `edgeStyleFor`.
    - Example tests in `edge-layout.test.ts`: one Edge gives offset 0, a pair and its reverse share one frame, three Edges get offsets `-S, 0, S`.
    - Design: Edge layout.
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 4.9 Write property test for parallel Edges
    - In `edge-layout.test.ts`.
    - **Property 9: P-VIEW-9 parallel edges stay apart.** For each Node pair with 2 or more visible non-loop Edges, in either direction, the midpoints are pairwise distinct and at least the larger of their two widths apart; `loopSizes` gives pairwise different radii per Node.
    - **Validates: Requirements 5.4, 5.5, 5.6**

  - [x] 4.10 Implement `core/view/helpers/gesture-commands.ts`
    - Export `MIN_SCALE` (0.05), `GizmoAxis`, `dragCommand`, `gizmoAxes` (rotate `X`/`Y`/`Z` → one component, scale `X`, `Y`, `XY`; every other value → `[]`), `rotationPreview`, `rotateCommand`, `scaleCommand`, `clampScale` (NaN → `MIN_SCALE`), `newEdgeId` (`edge-<k>`, smallest `k ≥ edges.length + 1` not used), `connectCommand`. Components outside the changed axes are copied unchanged from the stored Node. A command that would not change the stored value is `null`.
    - Example tests in `gesture-commands.test.ts`: drag with equal `x` and `z` is `null`; rotate delta 0 is `null`; a scale gesture at or below `MIN_SCALE` on a Node already at `MIN_SCALE` is `null`; `E`, `XYZE`, `null` give no axes; `scale.z` is never written.
    - Design: Gesture commands; D5, D6, D15.
    - _Requirements: 13.5, 13.6, 14.4, 14.5, 14.6, 14.7, 15.3, 15.5_

  - [x] 4.11 Write property test for gesture commands
    - In `gesture-commands.test.ts`. Add any generator it needs to `arbitraries.ts`.
    - **Property 7: P-VIEW-7 gesture commands are accepted and undone in one step.** `null` exactly when the built value equals the stored value; rotate changes exactly one component by `delta`, the others identical (`Object.is`); scale changes only components in `axes`, each to `max(MIN_SCALE, value[c])`; non-`null` commands are accepted by `executeCommand(createHistory(s), cmd)`, `past` grows by 1, one `undo` gives a `present` `jsonEqual` to `s`; `newEdgeId` is unused and `connectCommand` is accepted for any Node pair, including the same Node twice.
    - **Validates: Requirements 13.5, 13.6, 14.4, 14.5, 14.6, 14.7, 15.3, 15.5, 16.2, 16.5**

  - [x] 4.12 Implement `core/view/helpers/zone-refs.ts`
    - `missingZoneRefs(settings, scenario)`: walk `zoneFootprints.<i>.id`, then `presets.<i>.filter.zones.<j>`; report each entry that is not a Zone `id`, message `no zone with id <JSON id>`. `newlyMissingZoneRefs(settings, before, after)`: the paths in the result for `after` that are not in the result for `before`.
    - Example test in `zone-refs.test.ts`: a footprint id and a filter entry that name no Zone give `zoneFootprints.2.id` and `presets.0.filter.zones.1`.
    - Design: Missing Zone references.
    - _Requirements: 2.8_

  - [x] 4.13 Write property test for missing Zone references
    - In `zone-refs.test.ts`. Add any generator it needs to `arbitraries.ts`.
    - **Property 10: P-VIEW-10 missing Zone references are reported once.** Exactly the paths whose value is not a Zone id, each once, in walk order; `newlyMissingZoneRefs(settings, a, b)` is the set difference; `newlyMissingZoneRefs(settings, b, b)` is empty.
    - **Validates: Requirements 2.8**

  - [x] 4.14 Implement `core/view/helpers/effects-view.ts`
    - `shownEffects(app, timeline)`: the App list without a playback, else `cursorEffects(cursor)` `.value.upToCurrent` (empty on failure). `drawableEffects(effects, scenario, visible, footprintIds, theme)`: keep a request only when `effectStyleFor` is not `null`, the target is in the Visible_Set, and a Zone target has a footprint; input order kept; export `DrawableEffect`. Uses `cursorEffects` and `effectRequestSchema` types from `core/model/` only.
    - Example tests in `effects-view.test.ts`: no styled Effect_Kind draws nothing, a hidden target is dropped, a Zone without footprint is dropped and the others stay.
    - Design: Effects to draw.
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.9, 10.10, 18.4, 18.7_

  - [x] 4.15 Write property test for drawable effects
    - In `effects-view.test.ts`. Add `effectsArb(s)` to `arbitraries.ts`.
    - **Property 11: P-VIEW-11 only visible, styled, existing targets get effects.** `drawableEffects` equals the reference filter, in input order, with the style `effectStyleFor` gives; empty input gives empty output; `nodeStyleFor` and `edgeStyleFor` return the map entry for an own key and the default otherwise; `shownEffects` equals `upToCurrent` with a playback and the App list without.
    - **Validates: Requirements 7.8, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.10, 18.4, 18.7, 19.8**

  - [x] 4.16 Implement `core/view/helpers/link.ts`
    - `checkLinkedTimeline(path, built, timeline)`: in order, `timeline` error for a path without `fromZones` (stop); `createCursor` errors (stop); step count error at `timeline.steps`; per step `i` an error at `timeline.steps.<i>.targets` unless there is exactly one target with `kind === "zone"` and `id === built.zones[i]`. Matching is by index only.
    - Example tests in `link.test.ts`: one example per failing Link_Condition with its exact path and message.
    - Design: Link_Conditions.
    - _Requirements: 17.11, 17.12, 20.4_

  - [x] 4.17 Add Timeline generators and write property test for Link_Conditions
    - Add `timelineArb(s, zones)` (matching and broken variants) to `arbitraries.ts`. In `link.test.ts`:
    - **Property 13: P-VIEW-13 Link_Conditions.** `[]` exactly for matching Timelines; every broken variant gives a non-empty list with paths starting with `timeline`; a `waypoints` path gives exactly one error at `timeline`; a Timeline from `timelineFromZones` on a Scenario where every Zone has a footprint passes.
    - **Validates: Requirements 17.11, 17.12**

- [x] 5. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 6. View_State_Reducer
  - [x] 6.1 Implement the state types, preset switching, and camera selection in `core/view/helpers/view-state.ts`
    - Export `TimelinePlayback`, `ViewState`, `ViewEvent`, `ViewAction`, `initialViewState(settings)` (first preset active and shown, walk `idle`, `cameraOnce` = first preset pose), `reduceViewState` handling `setPreset` (transition of 0.6 s, replaced by a later `setPreset` without changing `shownPresetId`; no move during `playing` or `paused` walk; `finished` walk goes to `idle` first), `tick` for the transition (at 0.6 s: `shownPresetId = activePresetId`, `cameraOnce = to`), `cameraApplied`, `cameraFor` (transition → walk → `cameraOnce` → `null`), `orbitAllowed`. No History in any type. Every action carries what the reducer needs; no clock or global is read.
    - Design: View_State_Reducer (rules per action: `setPreset`, `tick`, `cameraApplied`; `cameraOnce`); D8.
    - _Requirements: 3.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9, 8.11_

  - [x] 6.2 Add the Walkthrough actions and walk events to `view-state.ts`
    - `walkStart` (time and progress 0, `playing`, transition cleared, `shownPresetId = activePresetId`, linked playback stopped, optional linked Timeline started with `timelinePosition 0` in the same action), `walkPause`, `walkResume`, `walkStop` (state `idle`, linked Timeline stopped, `cameraOnce = presetPose`; each ignored with an empty outbox outside the states R-VIEW-17.6 lists), the walk part of `tick` (progress `min(1, time / duration)`, `finished` at `time >= duration`), and the D9 frame rule (one walk event when the state differs from the last reported one, else one progress event while `playing`; at most one per tick).
    - Design: View_State_Reducer (`walkStart`, `walkPause` / `walkResume` / `walkStop`, `tick`); D9.
    - _Requirements: 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.9, 17.10, 17.13, 17.14_

  - [x] 6.3 Add Timeline playback to `view-state.ts`
    - `timelineStart` (replaces any playback, emits `timelinePosition 0`), `timelinePause`, `timelineResume` (ignored while a linked playback runs with a `playing` or `paused` walk), `timelineStop`, the Timeline part of `tick` (paced mode: `sinceMove` against `stepDuration`, `nextStep` per step, `timelineEnd` once; linked mode: move to step `i` when `marks[i] <= walk.progress`, never use `stepDuration`, end when the walk is `finished`, no move while paused). Uses `createCursor`, `nextStep` from `core/model/timeline.ts`.
    - Example tests in `view-state.test.ts`: 17.5 (preset switch after `finished` gives `idle` and a transition), 17.13 (a new start while a linked playback is `ended` stops it first), 18.5 (a one-step Timeline ends one Step_Duration after start), 18.6 (resume after a pause at 0.4 × Step_Duration moves after the remaining 0.6 × Step_Duration).
    - Design: View_State_Reducer (`timelineStart`, `timelinePause`, `timelineStop`, `tick`).
    - _Requirements: 17.15, 18.2, 18.3, 18.5, 18.6, 18.7, 18.8, 18.10_

  - [x] 6.4 Add selection, Connect_Mode, Edit_Mode, and model-change actions to `view-state.ts`
    - `select` (`null` always clears; an id is ignored in `view` mode or while connect is on), `setGizmoMode`, `connectOn`, `connectOff`, `connectClick` (store `first`, cancel on the same Node, otherwise emit one `connect` event with distinct `from` and `to`, clear `first`, connect stays on; ignored in `view` mode), `setEditMode` (`view` clears `selection` and `connect.first`), `modelChanged` (clear `selection` or `connect.first` when that Node is not in `nodeIds` or `visibleNodeIds`).
    - Design: View_State_Reducer (`select`, `connectOn` / `connectOff` / `connectClick`, `setEditMode`, `modelChanged`); Connect.
    - _Requirements: 12.3, 12.5, 12.6, 12.7, 15.2, 15.4, 15.7, 15.8_

  - [x] 6.5 Add `actionSeqArb` and example tests for the reducer
    - Add `actionSeqArb(settings)` to `arbitraries.ts` as described in design.md (ticks with `dt` up to 0.3, preset switches, walk and Timeline controls in any state, select, connect, edit mode, `cameraApplied`, `modelChanged` with random lists).
    - Example tests in `view-state.test.ts`: `cameraFor(initialViewState(settings))` is the first preset pose; after `walkStop` the preset pose is returned until `cameraApplied`; `select(null)` clears the Selection while connect is on; `view` mode keeps `selection` and `connect.first` empty.
    - _Requirements: 8.11, 12.3, 12.7, 17.14_

  - [x] 6.6 Write property test for the reducer
    - In `view-state.test.ts`.
    - **Property 12: P-VIEW-12 the View_State_Reducer follows the playback and selection rules.** After every action of a sequence: walk progress in `[0, 1]` and changes only on `tick` while `playing`; `finished` exactly when summed `dt` reaches `duration`; pause, resume, and stop in an unlisted state return a `jsonEqual` state with an empty outbox; at most one `walk` event per tick; preset `shownPresetId` changes only when summed `dt` since the call reaches 0.6 s, with `cameraFor` equal to the preset pose at that tick; paced Timeline position `min(last, floor(t / stepDuration))`, `timelineEnd` once at `t ≥ (last + 1) × stepDuration`, no time counted while paused; linked Timeline position is the largest `i` with `marks[i] ≤ progress`, pause and resume ignored while the walk is `playing` or `paused`; `cameraFor` rules after `walkStop`, `cameraApplied`, `walkStart`; Selection and Connect_Mode rules, with one `connect` event only for two different Node ids in `edit` mode. The reference model accumulates `dt` in the reducer's operation order, or compares near step boundaries with a small tolerance.
    - **Validates: Requirements 3.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.9, 12.3, 12.5, 12.6, 12.7, 15.2, 15.4, 15.7, 15.8, 17.2, 17.3, 17.5, 17.6, 17.7, 17.9, 17.10, 17.13, 17.14, 17.15, 18.2, 18.3, 18.5, 18.6, 18.8, 18.10**

  - [x] 6.7 Write property test that the view never changes the model
    - In `view-state.test.ts`.
    - **Property 2: P-VIEW-2 the view never changes the model.** Folding `reduceViewState` over `actionSeqArb` and calling `computeVisibleSet`, `poseAt`, `showsDetail`, `loadTheme`, and `drawableEffects` on the way leaves `h = createHistory(s)` `jsonEqual` to its copy, leaves `saveScenario(h.present).text` identical, and no returned View_State holds a value with the fields `past`, `present`, `future` (deep walk).
    - **Validates: Requirements 1.8, 1.9, 8.10, 8.11, 20.5**

  - [x] 6.8 Write property test for determinism of every helper
    - Create `core/view/helpers/determinism.test.ts` (imports every helper).
    - **Property 1: P-VIEW-1 same input → same result.** Run each helper listed in design.md twice, the second time on `structuredClone` copies, and compare with `jsonEqual` (list and map order included); no call throws; every argument is `jsonEqual` to its pre-call copy; `edgeOffsets` returns the same offset per Edge `id` for a permuted `edges` list; `fc.anything()` in place of a Scenario, filter, or Waypoints returns a result or a failure.
    - **Validates: Requirements 5.5, 7.10, 15.5, 20.1, 20.2, 20.6, 20.7**

- [x] 7. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 8. Scene components
  - [x] 8.1 Add the bundled font, text layout, and image cache
    - `core/view/fonts/inter-regular.woff2` and `core/view/fonts/OFL.txt`: take the Inter Regular file and its SIL OFL 1.1 license text from the official Inter release (D1). If the files cannot be fetched, stop and ask the human; do not substitute another font or add a CDN reference.
    - `core/view/scene/font.ts`: `import fontUrl from "../fonts/inter-regular.woff2?url"` and `loadFont()` using `new FontFace("CoreViewSans", url)`. On failure: no text is drawn, no system-font fallback, one `console.warn` (O4).
    - `core/view/scene/text-layout.ts`: word wrap with `measureText`, break words longer than the line, drop lines that do not fit the area height.
    - `core/view/scene/image-cache.ts`: call the Image_Resolver once per distinct Image_Reference inside `try` (a throw counts as "no image"); load with `new Image()` and no `crossOrigin`; a 1-pixel `getImageData` probe detects canvas taint; states `loading`, `ready`, `failed`. The Core_View never fetches an Image_Reference itself (S-VIEW-3).
    - Design: File layout; D1; Images; Panel textures.
    - _Requirements: 3.8, 3.9, 4.2, 4.3, 4.5, 4.6_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test` exit 0 (the name test now covers the font folder by name).

  - [x] 8.2 Implement `core/view/scene/view-store.ts`
    - `ViewStore`: holds the current History, View_Settings, Theme, App Effect_Requests, and View_State; `dispatch`, `subscribe`, `getSnapshot` for `useSyncExternalStore`; `execute(command)` (`executeCommand`, pass the new History or the errors to the Edit_Callback, then dispatch `modelChanged` with both id lists); `undo()` and `redo()` (call the Edit_Callback once per call with the returned History, dispatch `modelChanged` only when the History changed); `setHistory` (keep Active_Preset and camera, dispatch `modelChanged`, report `newlyMissingZoneRefs`); the outbox flush that calls the Edit, Walk, and Timeline callbacks; every callback dropped after `stop`.
    - Handle-side checks with reports through `onEdit` (design.md table): `setPreset` (`presetId`), `setTheme` (`loadTheme`), `setEffects` (`z.array(effectRequestSchema)`, previous list kept), `startWalk` (`pathId`, `duration`, `fromZones` build, `checkLinkedTimeline`; nothing changes on failure), `startTimeline` (`createCursor`), `connectOn` (`nonBlank`). Imports no React, three.js, Fiber, or drei module, so it can be tested in Node.
    - Design: Gestures and the History (`ViewStore.execute`); The core/app interface (handle checks table); D12.
    - _Requirements: 2.8, 3.4, 3.5, 3.6, 8.1, 8.6, 9.5, 10.1, 16.1, 16.6, 16.7, 17.1, 17.8, 17.12, 18.1, 18.9, 19.6, 19.7_

  - [x] 8.3 Implement `start-view.tsx` and the handle
    - `core/view/start-view.tsx`: export `CoreViewOptions`, `CoreViewHandle`, the callback types, and `startCoreView(options)` with the steps of design.md: check settings and Theme (one `The view settings are invalid.` message and one `onEdit` call with context `start`), probe WebGL 2 inside `try` (one `3D display is not available in this browser.` message, no exception), create the store, report `missingZoneRefs`, append one `div`, `createRoot(div).render(<ViewRoot store={store} />)` without `StrictMode` (D11), return the handle. A "message" handle ignores every call except `stop`. `stop` unmounts the root, releases WebGL resources, removes the `div`, and is safe to call twice. Message text is set with `textContent` and uses `font-family: CoreViewSans, sans-serif` (D19).
    - Create `scene/view-root.tsx` only as a placeholder `ViewRoot({ store })` that returns `null`, so `start-view.tsx` compiles; task 8.9 fills it in. No entry page imports `start-view.tsx` yet.
    - Design: The core/app interface; D11, D19; File layout.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0.

  - [x] 8.4 Write example tests for `view-store.ts`
    - In `core/view/scene/view-store.test.ts` (Node, no DOM): `execute` with a valid and a rejected command reports the new History or the errors with the unchanged History; `undo` on an empty `past` calls `onEdit` once with the same History and draws nothing new; `setHistory` keeps the Active_Preset and reports `newlyMissingZoneRefs` once; `setPreset` with an unknown id reports `presetId` and changes nothing; `startWalk` with a bad `pathId`, a duration of 0, and a Link_Condition failure each leave the Walk_State unchanged; no callback is called after `stop`.
    - Tests that must pass: `view-store.test.ts`.
    - _Requirements: 2.8, 3.4, 3.5, 3.6, 8.6, 16.1, 16.6, 16.7, 17.8, 17.12_

  - [x] 8.5 Draw Node panels
    - `scene/panel-texture.ts`: one 512 × 384 canvas per visible Node: fill and 8 px border from `nodeStyleFor`; image fitted with its aspect kept (contain); text-only wrapped in the panel; image plus text with the bottom 30 % band at 85 % fill alpha (D4); `fillText` only. The texture is rebuilt only when the Face, Node style, Theme, image state, or font state changes, never on a position change. Waits for `loadFont()` before drawing text.
    - `scene/node-panel.tsx`: one panel per Node of the Visible_Set, 1.6 × 1.2 base size times `scale.x`, `scale.y`, thickness 0.02 × `scale.z`, Euler order `XYZ`, `rotation` (0, 0, 0) faces +z (D2, D3). Only the Front_Face is drawn. The Visible_Set is recomputed with `computeVisibleSet` from the current Scenario and Active_Preset before each frame is drawn, and only its elements are drawn. After undo or redo the panels are drawn from the new `present` Scenario in the next frame. Mount in `view-root.tsx`.
    - Design: Panel textures; Images; D2, D3, D4.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.8, 7.9, 16.3_

  - [x] 8.6 Draw Zones and Walls
    - `scene/zone-floor.tsx`: `rect` as `PlaneGeometry(width, depth)` and `ring` as `RingGeometry(innerRadius, outerRadius, 64)`, both flat at `y = elevation` in the Theme floor color; the Zone label as a canvas text plane 0.01 above the floor inside the footprint (center for `rect`, `(x, z + (inner + outer) / 2)` for `ring`). `scene/wall.tsx`: for visible, `enclosed`, footprinted Zones only: four 0.05 thick `BoxGeometry` sides for `rect`, an open `CylinderGeometry(outer, outer, wallHeight, 64, 1, true)` for `ring`, from `elevation` to `elevation + wallHeight`, opaque, `DoubleSide`, `depthWrite: true`. Every other element uses `depthTest: true` so Walls hide what lies behind them (D7). A Zone with no footprint draws nothing and reports no error. Rebuild from the current Scenario on every change. Mount in `view-root.tsx`.
    - Design: Scene components (Zones); D7.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.7 Draw Edges, arrow heads, loops, and labels
    - `scene/edge-line.tsx`: for each visible Edge a drei `Line` with `worldUnits: true`, the Edge_Style color, width, and `dashed`, as a quadratic Bézier of 24 segments through `edgeMidpoint` with control point `(A + B) / 2 + 2 × offset × perp`; ends cut back to the panel border in the panel's local frame; an arrow head cone of length `max(0.12, 4 × width)` whose tip touches the `to` panel; a self-loop as a circle of the `loopSizes` radius tangent to the panel's top edge with the arrow head ending on the edge; the `en` label in a drei `Billboard` at the midpoint (or the far point of a loop) in the Theme text color, none when the label is absent or empty. A dragged or previewed Node position is used while it exists, so Edges follow in the same frame. Mount in `view-root.tsx`.
    - Design: Edge layout; Labels and Detail_Layers; D13.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8_

  - [x] 8.8 Draw fog from Effect_Requests
    - `scene/fog-volume.tsx`: for each `drawableEffects` entry a `MeshBasicMaterial` volume (`transparent`, `depthWrite: false`, Effect_Style color and opacity): a box 1.25 × panel width, 1.25 × panel height, 0.6 deep with the panel's rotation for a Node; a tube of radius 0.3 along the drawn curve for an Edge; the footprint shape extruded upward by `min(1, wallHeight)` from the Zone_Plane for a Zone (D14). Uses `shownEffects` with the App list or the Timeline playback. Mount in `view-root.tsx`.
    - Design: Effects to draw; D14.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 18.4, 18.7_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0.

  - [x] 8.9 Implement the view root, frame driver, and camera rig, and start the stub demo
    - `scene/view-root.tsx`: replace the placeholder with `<Canvas>` with lights, Theme background, device pixel ratio capped at 1.5, no shadows. `scene/frame-driver.tsx`: per frame dispatch `tick` with `dt` capped at 0.25, apply `cameraFor` to the camera and the controls target, dispatch `cameraApplied` after a `cameraOnce` pose, flush the outbox (walk to `onWalk`, Timeline to `onTimeline`, `connect` to `store.execute`); skipped after `stop`. `scene/camera-rig.tsx`: drei `OrbitControls` with `makeDefault`, `minDistance` 0.1, enabled only when `orbitAllowed`.
    - Replace the stub script of `core/view/demo/main.tsx` with a temporary minimal start (an inline one-Node Scenario, one ViewPreset, `NEUTRAL_THEME`). Task 12.3 replaces it.
    - Run `npm run build` and `npm run check:build`. If `check:build` reports a foreign URL beyond the four of task 1.2, stop and ask the human before changing the allow list.
    - Design: The core/app interface; Scene components (Frame driver); D11, D19; File layout.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.8, 8.9, 17.4_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0.

  - [x] 8.10 Draw Detail_Layers
    - In scene/node-panel.tsx: a useFrame call uses showsDetail with the camera position and the drawn position to toggle the Detail_Layer plane (1.6 × 0.6 base size, Theme text color on the Node fill, below the panel, only when the Face has a detail). A Node outside the Visible_Set has no Detail_Layer. Text is drawn with illText only.
    - Design: Labels and Detail_Layers; Detail decision.
    - _Requirements: 7.8, 11.1, 11.4, 11.5, 11.6_
    - Done when: 
pm run typecheck, 
pm run lint, 
pm test, 
pm run build, 
pm run check:build exit 0.

- [x] 9. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 10. Interaction
  - [x] 10.1 Selection, drag on the Zone_Plane, and snapping
    - `scene/node-panel.tsx`: pointer events with `stopPropagation` after the nearest hit; a click selects (Edit_Mode `edit`, connect off); `onPointerMissed` and hits on floors, Walls, and Edges dispatch `select(null)`; the selected Node gets an outline; no outline in `view` mode. `pointerdown` on the selected Node in `edit` mode sets `gestureActive` at once, with pointer capture; `pointerup`, `pointercancel`, `lostpointercapture` clear it.
    - `scene/drag.ts`: the 5 px press-and-move threshold, the ray-to-Zone_Plane test (plane `y = elevation` of the Node's Zone, or 0), `snap` for the preview position (the last preview is kept when the ray misses), drag preview shown in the same frame with Edges following. On release, `dragCommand` goes to `store.execute` when it is not `null`; a rejected command clears the preview. The Node's `zone` is never changed (R-VIEW-13.9).
    - Design: Gestures and the History (Click and drag).
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 16.2, 16.6_

  - [x] 10.2 Gizmo rotation and scaling
    - `scene/gizmo.tsx`: drei `TransformControls` with `mode` rotate or scale, `space="local"`, mounted only in `edit` mode with a selected Node; `showZ` false in `scale` mode (D6). `mouseDown` stores the stored `rotation` and `scale` and sets `gestureActive`; `objectChange` overwrites the panel with `rotationPreview` (rotate, one component from `rotationAngle × sign(rotationAxis[c])`) or with the stored scale whose components in `gizmoAxes` take the object's values, then `clampScale`; `mouseUp` sends `rotateCommand` or `scaleCommand` to `store.execute` when not `null` and clears `gestureActive`. The History is not touched during the drag. The `E` and `XYZE` rotate handles produce no command and no preview. A rejected command clears the preview.
    - Design: Gizmo; D5, D6.
    - _Requirements: 8.9, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 16.2, 16.5, 16.6_

  - [x] 10.3 Connect two Nodes by clicks
    - `scene/connect-overlay.tsx`: an absolutely positioned `<svg>` over the canvas that draws a line from the screen projection of the first Node to the pointer while `connect.first` is set. `node-panel.tsx` dispatches `connectClick(id)` for a visible Node while connect is on; the `connect` event from the reducer becomes `connectCommand(present, from, to, edgeType)` through `store.execute` (new Edge `id` from `newEdgeId`); a rejected command leaves the History unchanged and draws no Edge. A click on a hidden Node or on nothing is ignored for the connection.
    - Design: Connect.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 16.2_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0.

- [x] 11. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 12. Core demo
  - [x] 12.1 Add the Sample_Scenario, its View_Settings, and the schema example test
    - `core/view/demo/sample-scenario.json` in the saved format (keys sorted, 2-space indent, trailing newline): three Zones `area-a`, `area-b`, `area-c` (orders 0, 1, 2; elevations 0, 0.5, 1; `area-b` enclosed), eight Nodes of types `card` and `note` (two with a `detail`, one with no `zone`), seven Edges of types `link` and `step` including one parallel pair and one self-loop, generic texts (`First card`, `Second card`, …), all with `{ en, ja }`.
    - `core/view/demo/sample-settings.ts`: the example View_Settings of design.md (three footprints, two ViewPresets `overview` and `low-front` with different poses, one `fromZones` path, `detailDistance` 4, `snapStep` 0.5, `wallHeight` 2, `editMode` `edit`, `stepDuration` 1.5), plus the example Theme with generic `card`, `link`, and `haze` entries.
    - `core/view/demo/sample-scenario.test.ts`: the Scenario passes `validateScenario`; the settings pass `loadViewSettings` with at least two ViewPresets with different poses; the Theme passes `loadTheme`; `missingZoneRefs` is empty; `buildZoneWaypoints` succeeds.
    - No App_Specific_Name anywhere (R-VIEW-21.3).
    - Design: Data Models (Sample_Scenario).
    - _Requirements: 21.2, 21.3_
    - Done when: `npm test` and `npm run lint` exit 0.

  - [x] 12.2 Add the 50-image performance Scenario
    - `core/view/demo/perf-scenario.ts`: generate at runtime 50 image Nodes in a 10 × 5 grid, 60 Edges, 5 Zones (4 `rect`, 1 `ring`, one of them `enclosed`), with their footprints (D17). `core/view/demo/images/*.svg`: 10 developer-made SVG files (1024 × 768 viewBox, shapes and gradients only, no text, no external reference), each used by 5 Nodes. Add a small frame-time overlay module used only with `?perf`: it records frame times for 10 s and shows the median.
    - Example test in `perf-scenario.test.ts`: the Scenario passes `validateScenario` and has 50 image Nodes, 60 Edges, 5 Zones.
    - Design: D17; Performance plan.
    - _Requirements: 16.4, 21.3_

  - [x] 12.3 Build the Core_Demo page with preset and walkthrough controls
    - Replace the temporary start of `core/view/demo/main.tsx` with the real demo: `createHistory` of the Sample_Scenario, the sample settings and Theme, an Image_Resolver for the demo SVGs, and `startCoreView`. `?perf` loads the perf Scenario and the overlay instead. `index.html` declares the bundled font with `@font-face` pointing at the same asset and sets `font-family: CoreViewSans, sans-serif` (D19).
    - One button per ViewPreset labelled with the `en` label (one click calls `setPreset`), and buttons for walkthrough (start, pause, resume, stop), Timeline (start, pause, resume, stop), and linked walkthrough. Buttons call only handle functions and add no feature beyond them. The Timeline for the buttons comes from `timelineFromZones` on the sample Scenario; effects use the `haze` Effect_Kind through `setEffects` of a fixed generic list.
    - No other non-test file under `core/view/` imports from `core/view/demo/` (R-VIEW-21.6).
    - Design: Testing Strategy (Core_Demo controls); D10, D19.
    - _Requirements: 8.1, 17.1, 18.1, 21.1, 21.2, 21.3, 21.6, 21.7_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0.

  - [x] 12.4 Add edit controls and the Theme switch to the Core_Demo page
    - In `core/view/demo/main.tsx` (and `index.html` for layout only): buttons for edit mode (view, edit), gizmo mode (rotate, scale), connect (on, off), undo, and redo, and a Theme swap between the sample Theme and `NEUTRAL_THEME`. Buttons call only handle functions (`setEditMode`, `setGizmoMode`, `connectOn`, `connectOff`, `undo`, `redo`, `setTheme`) and add no feature beyond them. The demo keeps its History through the Edit_Callback.
    - Design: Testing Strategy (Core_Demo controls); D10, D19.
    - _Requirements: 16.1, 19.6, 21.2, 21.3, 21.4, 21.6_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:build` exit 0.

- [x] 13. Decision records
  - [x] 13.1 Record fallbacks and lessons
    - If task 1.4 used the path-segment bans instead of the lookahead selector, if task 1.1 changed any version, if an allowed-URL stop happened in task 8.9, or if any other fallback was taken, add one line to `docs/decision-log.md` per fallback and one line to `.kiro/steering/lessons.md` for each lesson. If no fallback was taken, add no line and say so in the checkpoint report. The decision-log lines required by the requirements are already added in tasks 1.1 (packages and versions, R-VIEW-01.2), 1.2 (four allowed URL strings, O6), 1.6 (R-FND amendments, R-VIEW-21.9), 1.4 (helpers lint scope), and 1.5 (name test, R-VIEW-01.6).
    - Design: repo-foundation changes; Lint scope for View_Helpers.
    - _Requirements: 1.2, 1.6, 21.9_

- [x] 14. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 15. Verification gate (human approves; the agent must not mark this done)
  - Scope: this is the last spec of the `core` Unit, so the gate includes the deploy check on the public URL that `core-graph` and `core-rules` deferred.
  - **[Agent]** Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm run build`, `npm run check:build`; report each result and the test counts (test files, tests passed, how many are property tests, P-VIEW-1 to P-VIEW-13).
  - **[Agent]** Confirm the name test (task 1.5) covers every file under `core/view/` including the demo and fonts, and that `docs/decision-log.md` holds the five lines of tasks 1.1, 1.2, 1.4, 1.5, and 1.6. Report any missing line.
  - **[Agent: reviewer]** Check requirement coverage (R-VIEW-01 to 21 and P-VIEW-1 to 13 each have a task and a test or a gate item), the core/app boundary (no App_Specific_Name, no `apps/` import, `core/model` imports no `core/view` and no 3D package, 01.3 to 01.7), no Node_Type, Edge_Type, attribute, Effect_Kind, Zone, or preset constants (01.7), View_Helpers import none of the packages of 01.1 (01.10), the view changes a Scenario only through Edit_Commands (01.8), no judgement function used and no AI (20.3, 20.4, S-VIEW-4), no HTML text drawing, no `eval` (S-VIEW-2), no network request of its own and no drei `Text` or troika (S-VIEW-3, D1), no browser storage (S-VIEW-5), no generated images or voice (S-VIEW-6), no feature beyond design.md, and test placement. Report READY or NOT-READY with findings.
  - **[Human]** Public-URL checklist (Core_Demo, desktop Chrome or Edge, after the push to `main` has deployed):
    1. The top page shows exactly one link to the Core demo, and it opens `/SpatialCore/core-demo/` with no not-found page (R-VIEW-21.5, R-FND-03.9). The two App pages still open.
    2. The Sample_Scenario is drawn with the first ViewPreset; one click on the other ViewPreset's button moves the camera within 1 s and changes the visible parts. **Core demo: switching between the two viewpoints works** (R-VIEW-21.7, 08.2, 08.3; intent.md 10.6 completion criterion).
    3. Floors at different heights; the enclosed Zone's Wall hides what is behind it from the low view; labels sit inside floors (R-VIEW-06).
    4. Panels show wrapped text cut at the edge; image panels keep their aspect; the text band covers only the bottom 30 % (R-VIEW-04).
    5. Parallel Edges are separate curves; the self-loop is outside its panel; labels face the camera; the dashed style shows (R-VIEW-05).
    6. Zooming close shows Detail_Layers; moving away hides them (R-VIEW-11).
    7. Select, drag with snapping (Edges follow during the drag), rotate on three axes, scale, connect two Nodes; one undo takes back each Gesture and redo restores it, and after undo and redo the drawing returns to the earlier Scenario (R-VIEW-16.3); orbit does not move while a gizmo or drag is active; the `E` and `XYZE` rotate handles do nothing (R-VIEW-12 to 16; spike checks of gizmo vs. camera controls, snapping, and Edge following). An empty click, a click on a floor or Wall, or a Wall in front of a Node cancels a pending first connection and clears the Selection, and a Node behind a Wall cannot be selected through it (R-VIEW-12.2, 12.3, 15.7). Note: R3F's own click threshold (a small pixel delta between press and release) is used for a click, not the 5 px drag threshold; a small drift can count as a click or a drag start, so check that a 1 to 2 px jitter still selects. A plain click on a gizmo handle does not clear the Selection (R-VIEW-14). A failing check takes the intent.md 3.3 fallback and is logged in `docs/decision-log.md`.
    8. The walkthrough button moves the camera along the Zones; pause, resume, and stop work; the Timeline button steps fog through the Zones; the linked walkthrough moves fog with the camera; pause and resume of the linked walkthrough pause and resume the fog, and the Timeline buttons are ignored while linked (R-VIEW-17.15), and switching the preset keeps the fog (R-VIEW-10.8) (R-VIEW-10, 17, 18).
    9. The Theme switch button changes colors and keeps the camera and Selection (R-VIEW-19.6).
    10. **Network panel:** with DevTools open, cache disabled, a full reload of the Core_Demo, and a walkthrough, every request goes to `https://seimu1207.github.io`. There is no font, CDN, or other foreign request (R-VIEW-03.9, S-VIEW-3).
    11. **60 fps measurement:** open the Core_Demo with `?perf`. The overlay records frame times for 10 s while the tester orbits and drags. The median must be ≤ 16.7 ms at a 1920 × 1080 View_Host on the Reference_Machine. **Record the value, the CPU model, and the browser version in `docs/decision-log.md`** (R-VIEW-16.4, D16, D17). If the median is above 16.7 ms, take the fallbacks of design.md in order (256 × 192 panel textures, `frameloop="demand"`, then the intent.md 3.3 fallback) and log each one.
    12. Pass invalid View_Settings or no WebGL (in a browser with WebGL disabled) to see the fixed English messages and that stop() leaves the host empty (R-VIEW-03.2, 03.3, 03.5, 03.6) — if WebGL cannot be disabled, mark as not checked in the decision-log.
  - **[Human]** Then approve the spec's result and add one line to `docs/decision-log.md` (date / Unit / what was checked / result). Because this is the last spec of the `core` Unit, the line covers the Unit.
  - _Requirements: 1.3, 1.6, 1.7, 3.9, 16.3, 16.4, 20.3, 20.4, 21.5, 21.7_

- [ ] 16. Amendment: Selection notification and Edge selection
  - Scope: the approved 2026-11-16 amendment (design.md, "Amendment 2026-11-16: Selection notification and Edge selection", D20, D21). Existing tasks and their `[x]` marks are unchanged, except that 16.1 updates existing code and tests to the new `Selection` type. Each sub-task leaves `tsc`, lint, and the public build green.
  - [x] 16.1 Selection type, reducer, `edgeClickAction`, and all call-site updates
    - In `core/view/helpers/view-state.ts`: export `Selection`; `ViewState.selection` becomes `Selection`; `select` takes a `Selection` and is ignored in `view` mode or while connect is on (so an Edge is selected only in `edit` with connect off); `modelChanged` carries `edgeIds` and `visibleEdgeIds` and clears a Node Selection missing from the Node lists or an Edge Selection missing from the Edge lists; `setEditMode("view")` clears either kind; `select` returns the same state object when the Selection is unchanged in `kind` and `id`; wrap the reducer so a changed Selection appends one `selection` outbox event (`sameSelection`), and `initialViewState` emits none.
    - `helpers/connect-ui.ts`: add `edgeClickAction(editMode, connectOn): "select" | "empty"`, `"select"` only for `edit` with connect off. Example tests in `connect-ui.test.ts` for all four input combinations.
    - `helpers/arbitraries.ts`: extend `actionSeqArb` with `select` drawing `null`, `{ kind: "node", id }` (`n1`–`n4`), and `{ kind: "edge", id }` (`e1`–`e3`); `modelChanged` with `edgeIds` and `visibleEdgeIds` from `fc.subarray(["e1", "e2", "e3"])`; and the pseudo-action `edgeClick(id)`, expanded with the real `edgeClickAction`. Update every existing property test that folds actions (P-VIEW-1, P-VIEW-2, P-VIEW-12) to expand `edgeClick` with `edgeClickAction`, and change the Selection check of P-VIEW-12 to "a Node Selection is in both Node lists, an Edge Selection in both Edge lists".
    - Update every call site of the old Selection and `select` shapes so `tsc`, lint, and the build stay green: `scene/view-store.ts` (`emptyClick` dispatches `select` with `selection: null`; `modelChangedAction()` gains `edgeIds` and `visibleEdgeIds`), `scene/gizmo.tsx` (Selection comparison), `scene/node-panel.tsx` (`selected`; `onClick` dispatches `select({ kind: "node", id })`), the existing cases in `scene/view-store.test.ts` and `helpers/view-state.test.ts` (`{ kind: "node", id }`), and anything else `tsc` reports.
    - Design: Amendment sections 1, 2, 6 (generator change, P-VIEW-12 update).
    - _Requirements: 3.10, 12.3, 12.5, 12.7, 12.9, 20.8, 22.1, 22.2, 22.3, 22.4, 23.1, 23.6, 23.7_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0.

  - [x] 16.2 P-VIEW-14 property test and P-VIEW-2 extension
    - In `view-state.test.ts` add its own test, **Property 14: P-VIEW-14 Edge selection and Selection notification**: the name starts with `P-VIEW-14`, `numRuns` ≥ 100, tag comment `// Feature: core-view, Property 14: Edge selection and Selection notification`, and the checks of design.md Property 14 (`edgeClick` expanded with `edgeClickAction`; a raw Edge `select` folded as is). Add generators to `helpers/arbitraries.ts` only if Property 14 needs them.
    - Extend P-VIEW-2 so action sequences with Edge Selections still change no History and issue no Edit_Command.
    - **Property 14: P-VIEW-14 Edge selection and Selection notification**
    - **Validates: Requirements 12.8, 20.8, 22.2, 22.3, 22.4, 23.1, 23.6, 23.8, 23.9**
    - Design: Amendment sections 1, 2, 6; Property 14.
    - _Requirements: 12.8, 20.8, 22.2, 22.3, 22.4, 23.1, 23.6, 23.8, 23.9_
    - Done when: `npm run typecheck`, `npm run lint`, and `npm test` exit 0.

  - [x] 16.3 ViewStore `onSelect`, `cancelGesture`, and `execute` on the handle
    - `scene/view-store.ts`: `modelChangedAction()` builds the four lists from one `computeVisibleSet` call (if not already done in 16.1); optional `onSelect` in `ViewStoreInit`, routed in `flush` with a copy of the Selection; `cancelGesture()` (`setPreview(null)`, `setGestureActive(false)`, and `connectClick(null)` when `connect.first` is set); `stop` resets `onSelect` to a no-op.
    - `start-view.tsx`: `CoreViewOptions.onSelect?`, re-export `Selection` and `SelectCallback`, `CoreViewHandle.execute(command)` as `guard((c) => { store.cancelGesture(); store.execute(c); })`, and `execute: noop` on the message handle.
    - New example tests in `scene/view-store.test.ts` as listed in design.md Amendment section 6: one `onSelect` call per change after `flush`; none at start; none for a repeated select; none after `stop` with an event pending; a store with no `onSelect` works; preset `p2` hides the selected Edge and gives one `onSelect(null)`; `execute` during a drag clears preview, `gestureActive`, and `connect.first` and applies the command once; a rejected command keeps History and Selection; `execute` in `view` mode and during a `playing` walk leaves `walk` and `timeline` unchanged; `execute` after `stop` changes nothing and calls no callback.
    - Design: Amendment sections 3, 5, 6; D20.
    - _Requirements: 3.6, 3.7, 3.10, 12.7, 13.8, 17.4, 20.5, 22.1, 22.2, 22.3, 22.4, 22.5, 23.6, 23.10, 23.11, 23.12_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0.

  - [x] 16.4 Scene: Edge hit line, highlight, and click-distance rule
    - `scene/edge-line.tsx`: one `<group onClick>` around the line and the arrow cone (the label stays outside); a hidden hit `Line` that includes the arrow tip, `worldUnits={false}`, `lineWidth={12}`, `visible={false}` (fallback `material.visible = false` if the hidden line gets no click; note the choice); the handler calls `e.stopPropagation()`, returns when `e.delta > 5`, then `edgeClickAction` gives `select` of the Edge or `store.emptyClick()`; no `onPointerDown`. A selected Edge gets `SELECTION_COLOR` and `lineWidth = 2 * style.width` on the line and the cone. `scene/view-root.tsx`: pass `store` and extend `edgeLinesUnchanged` with `store`, `view.selection`, and `view.editMode`.
    - `scene/node-panel.tsx`: the Node outline shows only for a Node Selection (none for an Edge Selection); export `SELECTION_COLOR`; add `if (e.delta > 5) return;` to `onClick`; Gesture move and end honour `store.gestureActive`. `scene/gizmo.tsx`: mount only for `selection?.kind === "node"` (no gizmo for an Edge Selection) and honour `store.gestureActive` in `onObjectChange` and `finish`. `scene/wall.tsx`: add `if (e.delta > 5) return;` to `wallHandlers.onClick`.
    - Once by hand on the Core_Demo: confirm that R3F `delta` is the pointer travel in CSS px since `pointerdown`, and that the hidden hit line receives clicks. Record the result in `docs/decision-log.md` as one line.
    - Design: Amendment section 4 (D20, D21) and section 5 (Gesture flag).
    - _Requirements: 12.4, 12.8, 14.3, 23.1, 23.2, 23.3, 23.4, 23.5, 23.8, 23.12_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0.
  - [x] 16.5 Core_Demo: Selection line and Remove selected edge
    - `core/view/demo/main.tsx`: one text line `Selection: none`, `Selection: node <id>`, or `Selection: edge <id>`, set with `textContent` from `onSelect`; one button `Remove selected edge` that calls `handle.execute({ kind: "removeEdge", id })` only when the last Selection is an Edge. Put the line text and the button decision in a small pure helper in the demo folder with an example test (`*.test.ts`, no DOM). The `?perf` page needs no change because it passes no `onSelect`; check that it still builds and starts.
    - Design: Amendment section 6 (Core_Demo).
    - _Requirements: 21.7, 22.2, 23.10, 23.11_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0.

- [x] 16.6 Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [~] 16.7 Verification gate for the amendment (human approves; the agent must not mark this done)
  - **[Agent]** Run all sensors of task 16.6; report each result and the test counts (test files, tests passed, property tests P-VIEW-1 to P-VIEW-14).
  - **[Agent: reviewer]** Review the amendment code against R-VIEW-03.6, 03.7, 03.10, 12.4, 12.7 to 12.9, 13.8, 17.4, 20.5, 20.8, 22, 23, P-VIEW-14, safety.md, and the core/app boundary. Report READY or NOT-READY with findings.
  - **[Human]** Public-URL checklist (Core_Demo, desktop Chrome or Edge, after deploy):
    1. In Edit mode with connect off, clicking an Edge selects it and draws it highlighted.
    2. A Node in front of an Edge wins the click; a Wall in front of an Edge blocks the click and clears the Selection.
    3. The Selection line shows node, edge, or none correctly.
    4. A drag that starts on the selected Edge and ends on a floor or a Node leaves the Selection unchanged.
    5. `Remove selected edge` removes the Edge; Undo restores it.
    6. Selecting an Edge removes the Node outline and shows no gizmo.
    7. While a gizmo handle is pressed, `execute` does not move the camera (if testable).
    8. `?perf` median re-measured with the hit lines in place; record the value, CPU model, and browser version in `docs/decision-log.md`. It must stay ≤ 16.7 ms; otherwise take the fallbacks of design.md in order and log each.
  - **[Human]** Then approve and add one line to `docs/decision-log.md` (date / Unit / what was checked / result).
  - _Requirements: 3.6, 3.7, 3.10, 12.4, 12.7, 12.8, 12.9, 13.8, 17.4, 20.5, 20.8, 22.1, 23.1, 23.2, 23.3, 23.4, 23.5, 23.10, 23.11, 23.12_

## Notes

- `core/view/helpers/arbitraries.ts` is touched by tasks 3.3, 4.2, 4.4, 4.9 (no change expected), 4.11, 4.13, 4.15, 4.17, 6.5, 16.1, and 16.2, in wave order. It is not matched by the Vitest `include` pattern.
- `core/view/scene/view-root.tsx` is touched by tasks 8.3 (placeholder), 8.9, 8.5, 8.6, 8.7, 8.8, 10.1, 10.2, and 10.3, and `node-panel.tsx` by 8.5, 8.10, 10.1, and 10.3, so those tasks sit in different waves. In task 16, `view-store.ts` is touched by 16.1 and 16.3, `node-panel.tsx` by 16.1 and 16.4, and `view-root.tsx` by 16.4 only; `view-state.test.ts` by 16.1 and 16.2; `view-store.test.ts` by 16.1 and 16.3; each pair sits in different waves.
- P-VIEW-1 (task 6.8) is last among the property tests because it imports every helper.
- P-VIEW-8 sits in `settings-schema.test.ts` and covers both loaders (D18, O8).
- Scene files are checked by the build (`tsc`, lint, `vite build`, `check:build`) and by the human gate, not by property tests (design.md, Testing Strategy). Only `view-store.ts` has example tests, because it imports no 3D or React module.
- Out of scope, so no task: Back_Face flip display, glow, other effects than fog, multi-select, align, keyboard operation, a real AI adapter, App content (design.md, requirements.md).
- Waves are a guide for parallel work; the checkpoints are kept in task-number order (a checkpoint runs after the tasks it follows).
- Failing sensors block acceptance of a change (tech.md), including during Vibe work.
- Task 16 is the approved 2026-11-16 amendment (Selection notification and Edge selection); 16.1 updates existing code and tests for the new Selection type and adds no other earlier-task changes, and its gate 16.7 is separate from gate 15. Checkpoint 16.6 is not in the graph.
- No `tasks.meta.json` is created here; Kiro writes it when tasks are executed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.3", "3.1", "3.2", "4.5", "4.10"] },
    { "id": 3, "tasks": ["1.6", "3.3", "4.1", "4.3", "4.6", "4.7", "4.8", "4.12", "4.14", "8.1"] },
    { "id": 4, "tasks": ["4.2", "4.16", "6.1", "12.1", "12.2"] },
    { "id": 5, "tasks": ["4.4", "6.2"] },
    { "id": 6, "tasks": ["4.9", "6.3"] },
    { "id": 7, "tasks": ["4.11", "6.4"] },
    { "id": 8, "tasks": ["4.13", "8.2"] },
    { "id": 9, "tasks": ["4.15", "8.3", "8.4"] },
    { "id": 10, "tasks": ["4.17", "8.9"] },
    { "id": 11, "tasks": ["6.5", "8.5"] },
    { "id": 12, "tasks": ["6.6", "8.6"] },
    { "id": 13, "tasks": ["6.7", "6.8", "8.7"] },
    { "id": 14, "tasks": ["8.8", "8.10"] },
    { "id": 15, "tasks": ["10.1"] },
    { "id": 16, "tasks": ["10.2"] },
    { "id": 17, "tasks": ["10.3"] },
    { "id": 18, "tasks": ["12.3"] },
    { "id": 19, "tasks": ["12.4"] },
    { "id": 20, "tasks": ["13.1"] },
    { "id": 21, "tasks": ["16.1"] },
    { "id": 22, "tasks": ["16.2", "16.3"] },
    { "id": 23, "tasks": ["16.4"] },
    { "id": 24, "tasks": ["16.5"] },
    { "id": 25, "tasks": ["16.7"] }
  ]
}
```
