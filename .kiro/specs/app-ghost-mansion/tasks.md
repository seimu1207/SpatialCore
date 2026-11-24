# Implementation Plan: app-ghost-mansion

## Overview

Language: TypeScript (design.md uses TypeScript). Build order follows design.md and keeps the public URL working after every task:

1. `repo-foundation` changes first (task 1): the lint scope for the game model and the replacement of the placeholder Scenario_File. The placeholder page (`apps/ghost-mansion/main.ts`, `index.html`) keeps working until task 7.2.
2. Game_Data schemas, data files, and loading (task 2), then the game model (task 4): pure functions under `apps/ghost-mansion/model/` with their example tests and the property tests P-APP1-1 to P-APP1-12. No file of the model imports a view, React, or three.js module.
3. UI texts and the `GameController` (task 6), tested in Node with a recording stub of the Core_View handle.
4. The DOM panel and the page wiring (task 7): the first task that imports `core/view/start-view.tsx` from the App page. The placeholder is replaced here.
5. Decision records (task 8) and the verification gate (task 10).

Nothing under `core/` changes (R-APP1-21.2). The Top_Page, `vite.config.ts`, and `package.json` do not change (no new package).

Conventions for every task:
- Requirement IDs `X.Y` mean R-APP1-X.Y. IDs written `R-FND-X.Y`, `R-GRAPH-X.Y`, `R-RULES-X.Y`, `R-VIEW-X.Y` belong to `repo-foundation`, `core-graph`, `core-rules`, `core-view`. "Design:" names the design.md section used. G1 to G16 are the design decisions of design.md.
- Tests and PBT run only when a task is completed (tech.md). Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:build`, `npm run check:sections`, `npm run check:schema`.
- Every task leaves `tsc --noEmit` and lint green, and `npm run build` plus `npm run check:build` green. Failing sensors block a change (tech.md). Run lint with `npm run lint`, not `npx eslint` (lessons.md 2026-11-15). When tasks run in parallel, re-run lint after the wave ends before judging a failure (lessons.md 2026-11-16).
- Check every clause of the requirement IDs a task names, not only the main path (lessons.md 2026-11-16).
- Property tests: one test per property, `numRuns` ≥ 100, the test name starts with the property ID (`P-APP1-n`), and a tag comment `// Feature: app-ghost-mansion, Property n: <title>` (design.md Testing Strategy, R-FND-10.5). Each property is its own sub-task, placed right after the code it tests.
- As in `core-graph`, `core-rules`, and `core-view`, tests are required by the repo-foundation convention, so no test sub-task is marked optional with `*`.
- Test files sit next to their source, named `<source file base name>.test.ts`, run under Vitest in Node with no DOM, and import no `three`, React, Fiber, or drei module (R-APP1-21.6). `apps/ghost-mansion/model/arbitraries.ts` is test support, imported only by `*.test.ts` files.
- The game model (`apps/ghost-mansion/model/`) imports only `zod`, non-test files of `core/model/`, `core/view/helpers/settings-schema.ts`, `core/view/helpers/theme-schema.ts`, the bundled data files, and itself (R-APP1-21.1). `controller.ts` imports only types from `core/view/start-view.tsx` (`import type`). No App file imports `core/view/demo/` or a `*.test.ts` file.
- Every model test file runs in Node with no DOM and imports no `three`, React, Fiber, or drei module; the first model test file (`built-rules.test.ts`, task 2.1) is the first check of this rule (R-APP1-21.6).
- Judgement code uses no AI_Adapter, LLM client, `fetch`, `Date`, or `Math.random` (R-APP1-21.5). No function of the model throws and none writes to its arguments.
- The App draws text only with `textContent` and SVG text nodes, never `innerHTML` (R-APP1-22.3). Every UI and Game_Data text is `{ en, ja }` with a non-empty `en` (R-APP1-22.1).
- Ghost Mansion names stay under `apps/ghost-mansion/`. Nothing is written under `core/` (R-APP1-21.2, 21.7). No Game_Data text contains code, a command, a URL, or text that works as an attack (S-APP1-1).
- No new dependency. Only `zod`, `vitest`, and `fast-check` already in `package.json`.
- Decisions and fallbacks found during a task go into `docs/decision-log.md` as one line: `date | section | decision | reason`. Do not edit older lines.
- Do not commit or push unless the human says so.

## Tasks

- [x] 1. Repo-foundation changes
  - [x] 1.1 Add the game-model lint scope and the App import bans
    - In `scripts/sensors/boundary-rules.ts`: in the scope `app-ghost-mansion`, add a ban of the path segment `demo` under `core/view` (`core[\x2F\x5C]view[\x2F\x5C]demo`) and of specifiers ending in `.test.ts`, next to the existing `moodwalk` ban. Add the scope `app-ghost-mansion-model` for `apps/ghost-mansion/model/**/*.{ts,tsx}` after `app-ghost-mansion`, built with the existing `scope()` and `ban()` helpers, repeating the `moodwalk`, demo, and test bans (a later flat-config entry replaces the rule options), adding `...modelPackageBans`, and banning `core/view/` paths except `core/view/helpers/settings-schema.ts` and `core/view/helpers/theme-schema.ts`. Use the lookahead regex `core[\x2F\x5C]view[\x2F\x5C](?!helpers[\x2F\x5C](?:settings|theme)-schema\.ts$)`; if esquery rejects it, use the two-ban form (path segments `scene` and `demo` under `core/view`, and `start-view`). Both forms must give the same results on the fixtures below.
    - In `scripts/sensors/boundary-rules.test.ts` add fixtures for `apps/ghost-mansion/model/a.ts`. Rejected: `three`, `react`, `../../../core/view/start-view.tsx`, `../../../core/view/scene/x.ts`, `../../../core/view/demo/main.tsx`, `./x.test.ts`. Accepted: `../../../core/model/history.ts`, `../../../core/view/helpers/theme-schema.ts`, `./phase.ts`. Add a fixture for `apps/ghost-mansion/main.ts`: `../../core/view/demo/main.tsx` is rejected. Keep every existing fixture passing.
    - Add one line to `docs/decision-log.md`: this changes a `repo-foundation` sensor, names the two scopes, and which regex form was used.
    - Design: Lint scope for the game model; Changes outside apps/ghost-mansion/.
    - _Requirements: 21.1_
    - Done when: `npm test` and `npm run lint` exit 0.

  - [x] 1.2 Replace the placeholder Scenario_File with the Preset_Mansion
    - Create `apps/ghost-mansion/scenarios/preset-mansion.json` in the saved format (keys sorted, 2-space indent, trailing newline): the four Zones, ten Nodes, and six Edges of design.md "Preset_Mansion" with the exact ids, types, positions, scales, attributes, and `{ en, ja }` texts. `page` holds the Hidden_Text of G12 in its Front face `detail`. Check by hand that it passes `validateScenario`.
    - Delete `apps/ghost-mansion/scenarios/placeholder.json`. In `scripts/sensors/schema.cli.test.ts` the test "real placeholder Scenario_Files pass in single-file runs (08.3)" loops over both apps with the path `apps/${app}/scenarios/placeholder.json`. Split the loop or change its array to a list of `[app, file]` pairs: `ghost-mansion` uses `apps/ghost-mansion/scenarios/preset-mansion.json`, `moodwalk` keeps `placeholder.json`. Rename the test so its name no longer says "placeholder" for Ghost Mansion (keep the `(08.3)` reference). Search the repository (`grep_search` for `placeholder.json`) for any other reference to the removed file and update it (design.md names only that test).
    - Add one line to `docs/decision-log.md`: the placeholder was replaced by the Preset_Mansion and the schema sensor test follows.
    - Design: Preset_Mansion; Changes outside apps/ghost-mansion/.
    - _Requirements: 2.1, 3.1, 3.3, 3.4, 3.5, 3.6, 3.8_
    - Done when: `npm run check:schema`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:build` exit 0.

- [x] 2. Game_Data schemas, data files, and loading
  - [x] 2.1 Add fixed names and Built_Rules builders
    - `apps/ghost-mansion/model/names.ts`: the Identifiers of design.md "Fixed names" (Node_Types, Edge_Types, Effect_Kinds, attribute names, the Robot Node id, Check_Set ids, Response_Operation ids) as `as const` values.
    - `apps/ghost-mansion/model/built-rules.ts`: `withCheckSet` (calls `loadRuleDefinition` on `{ ...rules, checkSets: [...] }` and returns its `RuleOutcome`), `attackCheckSet(card)` (one item per Precondition, same id and order, `label` and `highlight` not copied), and `responseCheckSet(nightStart)` with the three items of design.md (`stop-robot`, `cut-key` with `max: N − 1` over Key_Edges, `consult` to a Helper_Node; for N = 0 the `cut-key` Condition is an empty `any`). `AttackCard` may be a type-only import from `./game-data.ts` written in task 2.2; until then declare the minimal type needed in this file and replace it in 2.2.
    - Example tests in `built-rules.test.ts`: `responseCheckSet` for N = 0 (an empty `any`, never holds) and N = 4 (`max: 3`), every result loads with `loadRuleDefinition`, an invalid set gives a Rule_Failure.
    - Design: Fixed names; Built_Rules.
    - _Requirements: 2.8, 5.3, 16.7, 21.6, 21.7_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 2.2 Implement `model/game-data.ts`
    - Zod schemas of design.md: `preconditionSchema`, `attackCardSchema` (reuses `conditionSchema`, `localizedTextSchema`, `nonBlank`; at least 3 Preconditions; unique Precondition ids), `robotJobsSchema` (`plain ≥ bell`; unique job ids), `orderRulesSchema` (two different Response_Operations), `starTableSchema` (at least one rule; stars strictly decreasing; `rules[0].minConvenience ≥ 1`; `defaultStars` 1). Export the inferred types and `GameData`, `RawGameData`, `DataResult`.
    - `loadGameData(raw)`: `loadScenario`, `loadRuleDefinition`, `loadViewSettings`, `loadTheme`, then the four App schemas, collecting every error with its file name; one outer `try` (unexpected exception gives one error at `""`); never throws. `crossReferenceErrors(data)`: every Node and Edge id named by a Robot_Job, a Highlight_List, or the Attack_Card `targets` exists in the Preset_Mansion; Job_Check_Set item ids equal the Robot_Job ids in order; Order_Rules name Response_Operation ids; the `unresolved` lists of `evaluateCheckSets` and `evaluateNodeRules` on the Preset_Mansion with the attack Built_Rules are empty. Each error names the Identifier. Replace the temporary `AttackCard` type of task 2.1.
    - Example tests in `game-data.test.ts` with small in-test fixtures: each schema rejects its listed faults (a Precondition list of 2, a duplicate id, `plain < bell`, an empty star rules list, equal order operations); `loadGameData` with a broken file of each kind returns `ok: false` naming the file and does not throw (2.4); `crossReferenceErrors` names a missing Node id and a missing Edge id (2.6, 2.9).
    - Design: Game data loading; Judgement (Star_Table).
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 2.9, 5.1, 5.2, 9.4, 10.2, 10.4, 17.1_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 2.3 Add the Game_Data files and the bundle
    - Create `apps/ghost-mansion/rules/game-rules.json`, `attack-card.json`, `robot-jobs.json`, `order-rules.json`, `star-table.json`, `apps/ghost-mansion/view-settings.json`, and `apps/ghost-mansion/theme/theme.json` with exactly the contents of design.md "Data Models" (Game_Rules, Attack_Card, Robot_Jobs, Order_Rules, Star_Table, View_Settings, Theme with all required keys). Remove the two `.gitkeep` files in `rules/` and `theme/` only if the folders now hold other files.
    - `apps/ghost-mansion/model/bundled.ts`: `BUNDLED: RawGameData` with `import … from "../scenarios/preset-mansion.json?raw"` and JSON module imports (`with { type: "json" }`). If `tsc` or Vite reject one of these import forms, use the form `core/view/demo/main.tsx` already uses for its sample and note the choice for task 8.1.
    - Add one line to `docs/decision-log.md`: G4, the Robot_Job order (`sort-photos`, `reply-messages`, `summarize-page`) differs from the example order of intent.md 4.6 step 3 because the hidden job must be last (R-APP1-15.3).
    - Design: Data Models; View_Settings; Theme.
    - _Requirements: 2.1, 2.2, 2.3, 8.4, 9.1, 11.2, 11.3, 11.6_
    - Done when: `npm run typecheck`, `npm run lint`, `npm run check:schema`, `npm run build`, and `npm run check:build` exit 0, and `loadGameData(BUNDLED)` returns `ok: true` (checked by task 2.4).

  - [x] 2.4 Write the example tests on the bundled Game_Data
    - Example tests in `game-data.test.ts` (the same file as task 2.2, so this task runs in a later wave) on `BUNDLED` (the list of design.md Testing Strategy): every bundled file loads (2.5); `crossReferenceErrors` is empty and the attack Built_Rules load (2.6, 2.8, 2.9); four Zones with ascending `order`, different `elevation`, `enclosed` as specified, four ring footprints with Outside_Road outermost (3.1 to 3.3); one robot, 3 or 4 rooms, a Hidden_Text node, a Text_Node on the Outside_Road, a helper, an answer, a source (3.4, 3.5); room scale monotone in Importance (3.6); every label or face text has a non-empty `en` (3.8, 22.1); `plain-key` in `pass`, `bell-key` in `stop`, no `reads`, `no-read`, `cites`, `consult` in `pass` (4.1, 4.2); Hidden_Text ≤ 60 characters in `en` and `ja` (5.4); a scan of every Game_Data string for `://`, `@`, `<`, `{`, a backtick, and the words "ignore", "system", "prompt" (5.4, 5.5); the Attack_Card holds the three Preconditions named in R-APP1-05.2; the hidden job is the last job and its `reads` Node has a `front.detail` (15.3); Ghost_View is the first preset, its camera height is below the Garden `elevation` + `wallHeight`, filter `zones: ["outside-road"]` with `anyEnd` (11.2, 11.6); the three zoom-distance checks of design.md "View_Settings" with `0.1` copied from `camera-rig.tsx` and a source comment (11.4, 11.5); every Node with a `front.detail` has `y − 1.2 × scale.y` at or above its Zone `elevation`, constants `BASE_HEIGHT` 1.2 and `DETAIL_BASE_HEIGHT` 0.6 copied from `node-panel.tsx` with a source comment (11.4); the Theme passes `loadTheme` and every Effect_Kind has a `fog` style (2.3, 8.4); save → load of the Preset_Mansion unchanged (intent.md 10.6).
    - Design: Data Models; View_Settings; Theme; Testing Strategy (`game-data.test.ts`).
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 4.1, 4.2, 5.2, 5.4, 5.5, 8.4, 9.1, 11.2, 11.3, 11.4, 11.5, 11.6, 15.3, 22.1_
    - Done when: `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:schema`, `npm run build`, and `npm run check:build` exit 0.

- [x] 3. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 4. Game model
  - [x] 4.1 Implement `model/commands.ts` and `model/sample.ts`
    - `commands.ts`: `isKeyEdge`, `keyChoiceCommand` (plain/bell → `updateEdge` of `type` only, `null` when unchanged; none → `removeEdge`; `null` for a non-Key_Edge), `dontReadCommand` (`reads` → `no-read`; one `updateEdge`, a `batch` for several, `null` for none), `stopRobotCommand` (`updateNode` with full `attributes` and `stopped: 1`, `null` when already stopped), `cutKeyCommand` (only Key_Edges). No function changes `zone` or removes a non-key Edge.
    - `sample.ts`: `deriveSample(preset)`: one `batch` of `updateEdge` to `plain-key` for each Key_Edge not already plain; the same Scenario when none; an error result when `applyCommand` fails.
    - Example tests in `commands.test.ts` and `sample.test.ts`: each command shape (4.4, 4.5, 14.3, 16.2, 16.3); a non-key Edge gives `null`; no command changes `zone` or removes a non-key Edge (19.6, 19.7); on the bundled data only `k-diary` changes in the Sample_Mansion.
    - Design: Commands; Sample_Mansion.
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 13.2, 14.3, 16.2, 16.3, 19.6, 19.7_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.2 Add the test generators in `model/arbitraries.ts`
    - Test support only. `variantArb` (random Key_Choices per Key_Edge, Dont_Read_Mark, Stop_Robot, right and wrong-way Cite_Edges, 0 to 3 Consult_Edges to random Nodes, random `position`, `rotation`, `scale`; every output passes `validateScenario`), `scorePointArb`, `starTableArb`, `actionLogArb`, `orderRulesArb`, `phaseActionsArb`, `fixStepsArb`, as described in design.md "Generators". Imports `fast-check`, `commands.ts`, `bundled.ts`, `game-data.ts`.
    - Example test in `arbitraries.test.ts`: generator sanity, 100 variants all pass `validateScenario`, 100 `starTableArb` values pass `starTableSchema`.
    - Design: PBT properties → Generators.
    - _Requirements: 21.4_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.3 Write property test for the Sample_Mansion derivation
    - In `model/sample.test.ts`.
    - **Property 9: P-APP1-9 sample mansion derivation.** Every Key_Edge of the result is `plain-key`; the result differs from the input only in the `type` of Key_Edges (all other fields and the Edge list order equal); `deriveSample` of the result is deeply equal to the result.
    - **Validates: Requirements 13.2**
    - Done when: `npm test` exits 0.

  - [x] 4.4 Implement `model/effects.ts` and `model/judge.ts`
    - `effects.ts`: `highlightEffects`, `bellStopEffects`, `couldStopEffects`, `jobFocusEffects`, `withoutRobot`, `lookBackEffects` with the Effect_Kind names of `names.ts` (design.md "Effects"). Lists are passed through `sortUniqueEffects` before use.
    - `judge.ts`: `MansionJudgement`, `NightResult`, `Flags`, `judgeMansion` (steps 1 to 5 of design.md; `evaluateCheckSets`, `propagate` with Max_Steps 1 under `f2`, `sumAttribute`, `evaluateNodeRules` plus `buildEffects` for fog unless `f1`), `judgeNight` (empty Damage_Set and Damage_Score 0 when the verdict is false, `damage` requests without the Robot_Node, `bellStops` only when the verdict is true, stars), `convenienceScore`, `starsFor`, `prepareStatus`. A Rule_Failure is returned as is.
    - Design: Judgement; Effects.
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 18.3, 21.3_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.5 Write example tests for `judge.ts` and `effects.ts`
    - In `model/judge.test.ts`: the five rows of the design.md results table (Sample_Mansion, Preset_Mansion, Preset + Dont_Read_Mark with 3 stars, all Bell_Keys with 2 stars, `k-homework` plain with 2 stars) (13.5, 14.6); the Preset_Mansion has verdict true and a non-empty Damage_Set before any change (14.6); a Rule_Failure for a broken Scenario is returned and nothing throws (6.5); with `f2` the propagation has Max_Steps 1 (7.5); `bellStops` is empty when the verdict is false (7.4); `prepareStatus` reports `reachScore` without the verdict (9.6); `lookBackEffects` with and without `bell-stop` requests for verdict true (also with an empty Damage_Set) and false (18.6); no `damage` request targets `robot` (7.6).
    - Design: Data Models (results table); Testing Strategy (`judge.test.ts`).
    - _Requirements: 6.5, 7.4, 7.5, 7.6, 9.6, 13.5, 14.6, 18.6_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.6 Write property test for safer keys
    - In `model/judge.test.ts`.
    - **Property 2: P-APP1-2 safer keys never increase damage.** For any variant and any Key_Edge, changing it from `plain-key` to `bell-key` or removing it (with `keyChoiceCommand`), and removing any subset of Key_Edges, never adds a Node to `reachSet` or the Night `damageSet`, and never raises `reachScore` or `damageScore`.
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5, 7.1, 7.2**
    - Done when: `npm test` exits 0.

  - [x] 4.7 Write property test for convenience
    - In `model/judge.test.ts`.
    - **Property 3: P-APP1-3 fewer keys never increase convenience.** Plain → Bell or removal never raises the Convenience_Score; removing every Key_Edge gives 0; the score equals a reference sum written in the test (per job whose Check_Item holds: 2 for a Plain_Key to its room, else 1 for a Bell_Key, else 0).
    - **Validates: Requirements 9.3, 9.4, 9.5**
    - Done when: `npm test` exits 0.

  - [x] 4.8 Write property test for the Star_Table
    - In `model/judge.test.ts`.
    - **Property 4: P-APP1-4 star table is total and monotone.** `starsFor` returns one integer from 1 to 3; raising `c` or lowering `d` never lowers it; no point with `c = 0` gets `rules[0].stars`.
    - **Validates: Requirements 10.2, 10.3, 10.4**
    - Done when: `npm test` exits 0.

  - [x] 4.9 Write property test for the attack verdict
    - In `model/judge.test.ts`.
    - **Property 5: P-APP1-5 attack needs every precondition.** The verdict equals the conjunction of the three Precondition results; a false verdict gives an empty `damageSet`, `damageScore` 0, and empty `bellStops`; Stop_Robot or the Dont_Read_Mark on `page` gives a false verdict; a true verdict gives a non-empty `damageSet`.
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.3, 7.4**
    - Done when: `npm test` exits 0.

  - [x] 4.10 Write property test for transforms
    - In `model/judge.test.ts`.
    - **Property 6: P-APP1-6 transforms do not change judgements.** Changing `position`, `rotation`, or `scale` of any Node with `updateNode` leaves every judgement result `toStrictEqual`, except results that copy Node data.
    - **Validates: Requirements 3.7, 19.5**
    - Done when: `npm test` exits 0.

  - [x] 4.11 Write property test for Plausible_Ghost fog
    - In `model/judge.test.ts`.
    - **Property 10: P-APP1-10 plausible ghost fog.** The `unsourced-fog` targets are exactly the `answer` Nodes with no `cites` Edge to a `source` Node (reference in the test); adding or removing any Cite_Edge, right or wrong way, leaves `damageSet`, `damageScore`, `convenience`, and `stars` unchanged.
    - **Validates: Requirements 7.2, 8.1, 8.2, 19.8**
    - Done when: `npm test` exits 0.

  - [x] 4.12 Implement `model/phase.ts`
    - `Phase`, `PhaseState`, `PhaseAction`, `initialPhase`, `nextPhase` with exactly the rows of the design.md table; any other pair returns the same state object.
    - Design: Phase_Machine.
    - _Requirements: 12.1, 12.2, 12.7_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.13 Write property test for the Phase flow
    - In `model/phase.test.ts`.
    - **Property 8: P-APP1-8 phase flow.** Folding `phaseActionsArb` from `initialPhase`: every state is one of the five Phases; every change is a row of the table; `fixIt` is entered only from `ghostNight` with `damageEmpty: false`; an action not in the table returns the same state object.
    - **Validates: Requirements 12.1, 12.2, 12.7**
    - Done when: `npm test` exits 0.

  - [x] 4.14 Implement `model/order.ts`
    - `checkOrder(log, rules)`: `notApplicable` when B is missing, `notMet` when A is missing or B comes first, else `met`; reads only the order of entries.
    - Design: Order check.
    - _Requirements: 17.1, 17.2, 17.3_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.15 Write property test for the order check
    - In `model/order.test.ts`.
    - **Property 7: P-APP1-7 order check agrees with a reference model.** Equals the reference of R-APP1-17.2; appending an entry already in the log changes no result; two logs with the same first-occurrence order give the same result.
    - **Validates: Requirements 17.2, 17.3**
    - Done when: `npm test` exits 0.

  - [x] 4.16 Implement `model/action-log.ts` with example tests
    - `classifyPair` (order Stop_Robot, Cut_Key, Consult, each at most once; nothing for positions, rotations, scales, Cite_Edges, or a Consult_Edge whose `to` is not a `helper`) and `deriveActionLog(nightStart, history)` (walk `[...past, present]`; classify `nightStart` → `past[0]` first when `past[0]` is not deeply equal to `nightStart`; local structural deep-equal function).
    - Example tests in `action-log.test.ts`: 105 Fix It steps drop the oldest `past` entries and the log still starts with the entries from `nightStart` to `past[0]` (16.6); a second Stop_Robot, a move, and a Consult_Edge to a non-helper add no entry (16.5, 19.8); undo removes the entry and redo restores it (16.6).
    - Design: Action_Log.
    - _Requirements: 16.5, 16.6, 19.5, 19.8_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.17 Write property test for the Action_Log
    - In `model/action-log.test.ts`.
    - **Property 12: P-APP1-12 action log from history.** Applying `fixStepsArb` to `createHistory(nightStart, 100)` with `executeCommand`, `undo`, and `redo`, then `deriveActionLog` equals the reference list kept by the test; the `response` Check_Result of the final `present` agrees with the log (`stop-robot`, `cut-key`, `consult`).
    - **Validates: Requirements 16.1, 16.5, 16.6, 16.7, 19.8**
    - Done when: `npm test` exits 0.

  - [x] 4.18 Implement `model/timelines.ts` with example tests
    - `damageSteps`, `sampleTimeline`, `nightTimeline`, `fixReplayTimeline` as in design.md, all built with `createTimeline` (not `timelineFromPropagation`). Job steps carry `job-focus` effects; the first step also carries the fog (and, for the Sample, the highlights); the hidden job step carries `bell-stop` effects when the verdict is true. `hiddenJobId` is found from the Robot_Job whose `reads` Node has a `front.detail`.
    - Example tests in `timelines.test.ts`: the G9 timing bounds computed from the bundled data and `stepDuration` (Sample ≤ 15 s, Ghost Night ≤ 15 s, Fix It ≤ 15 s, total ≤ 35 s) (20.1); the Sample Timeline is not empty and shows the highlights and fog on its first step (13.4); the Fix It replay has four steps (16.9); a Timeline step holds no time value.
    - Design: Timelines.
    - _Requirements: 7.4, 7.6, 13.4, 15.1, 15.2, 15.3, 16.9, 20.1_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.19 Write property test for the night Timeline
    - In `model/timelines.test.ts`.
    - **Property 11: P-APP1-11 night timeline shape.** The three job steps first, in order, each with targets `robot` and its job Nodes and `job-focus` effects equal to `jobFocusEffects`; damage steps only when the verdict is true, one per Step_Number; every Node of `damageSet` appears in exactly one `damage` request, in the step equal to its Step_Number; no `damage` request targets `robot`; `bell-stop` only on the hidden job step and only when the verdict is true; `fixReplayTimeline` equals the first four steps.
    - **Validates: Requirements 7.4, 7.6, 15.2, 15.3, 16.9**
    - Done when: `npm test` exits 0.

  - [x] 4.20 Implement `model/controls.ts` with example tests
    - `controlsFor(state)` returning `{ shown, enabled }` per control id with the rules of design.md "Controls".
    - Example tests in `controls.test.ts`: Key_Choice disabled without a Key_Edge selection (4.6); undo and redo enabled only in `prepare` and `fixIt` (19.1, 19.2); "cancel" shown only while Connect_Mode is on in `prepare` or `fixIt` (19.9); "connect source" hidden under Fallback_F1 (23.1); the back link and ViewPreset controls always shown (1.3, 11.1); Sample "next" enabled until every Precondition is shown (13.3).
    - Design: Controls.
    - _Requirements: 1.3, 4.6, 11.1, 13.3, 14.2, 15.6, 19.1, 19.2, 19.9, 23.1_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 4.21 Implement `model/fallback.ts` with example tests
    - `FALLBACK` (`{ f1: false, f2: false }`) and `applyFallback(data, flags)`: with `f1`, one `batch` of `removeNode` for every `answer` and `source` Node and the Game_Rules without the `unsourced-answer` Node_Rule and the `mark-unsourced` Effect_Rule (validated again with `loadRuleDefinition`); `f2` forces `f1` and gives Max_Steps 1.
    - Example tests in `fallback.test.ts`: with `f1` no answer, source, Node_Rule, or fog; with `f2` also Max_Steps 1 and three Robot_Jobs; `FALLBACK` is off (23.1, 23.2, 23.3).
    - Design: Fallbacks.
    - _Requirements: 7.5, 8.1, 9.2, 23.1, 23.2, 23.3_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

- [x] 5. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 6. Controller
  - [x] 6.1 Extend `apps/ghost-mansion/text.ts` with the UI texts
    - Add the `LocalizedText` constants of design.md "UI texts" (Phase names and instructions, incident, hidden-command line, fog note, control labels, score labels, `reachNote`, `canBreak`, status words, the four error messages), each `{ en, ja }`. Keep `title` and `backLink`. The old `body` is removed only in task 7.2, with the placeholder `main.ts` that uses it. No technical term and no OWASP item (R-APP1-18.5).
    - Example test in `text.test.ts`: every exported `LocalizedText` has a non-empty `en`; no text contains a technical term of intent.md 4.1 ("prompt injection", "excessive agency", "hallucination", "OWASP").
    - Design: UI texts.
    - _Requirements: 18.5, 22.1, 22.2_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 6.2 Implement `controller.ts`: start, Sample, Prepare, and Ghost Night
    - `ViewPort`, `UiSink`, `GameViewState`, `ControlId`, and `GameController` as in design.md: the state fields and `start()`; the Phase changes `start → sample → prepare → ghostNight` with the Core_View call order of the rows of the call table for those Phases (`stopTimeline` first on every phase change and replay end, then `connectOff`, `setPreset("overhead")` where G16 lists it, `setEditMode`, `setHistory`, `setEffects`, `startTimeline`); the Sample "next" steps (R-APP1-13.6 included) and the Prepare controls (Key_Choice, Dont_Read_Mark, Cite_Edge, "start night"); `onTimeline` for the Sample and the night, with the view switch to the Overhead_View for Ghost Night (R-APP1-15.6); `onSelect`; and the part of `onEdit` that serves Prepare (history reports, the error contexts of Prepare). A control that starts an operation calls `connectOff` first while `connectType` is set. Every new History is made with `createHistory(scenario, 100)`; `ok: false` and Built_Rules failures show the "game data is invalid" message; a Rule_Failure keeps the Phase. Imports only types from `core/view/start-view.tsx`. Phases `fixIt` and `lookBack` are left to task 6.3 (the `act` cases for them return without change here).
    - Design: Controller; The core/app interface.
    - _Requirements: 1.5, 2.4, 2.8, 4.4, 4.5, 6.5, 8.3, 9.6, 10.1, 12.4, 12.8, 12.9, 13.1, 13.3, 13.4, 13.6, 14.1, 14.2, 14.3, 14.4, 14.5, 15.1, 15.4, 15.5, 15.6, 19.9_
    - Done when: `npm run typecheck` and `npm run lint` exit 0.

  - [x] 6.3 Extend `controller.ts`: Fix It, Look Back, error contexts, and control buttons
    - In the same file as task 6.2 (so it runs in a later wave): the Phase changes `ghostNight → fixIt → lookBack` and back to `prepare` ("retry", "start over", "replay") with the call table rows of those Phases; the Fix It operations (Stop_Robot, Cut_Key, Consult) and the Action_Log update; the Fix It replay of four steps; `deriveActionLog` and `checkOrder` use; the Response_Result stored on the change to `lookBack` from `fixIt`; the Look Back display and `lookBackEffects`; all eight error contexts of `onEdit` (a `timeline` error runs the end handler); and `act` for every remaining control, including "cancel" and undo/redo per Phase.
    - Design: Controller; Callbacks; The core/app interface.
    - _Requirements: 8.2, 12.5, 12.6, 16.1, 16.2, 16.3, 16.4, 16.8, 16.9, 16.10, 17.4, 18.1, 18.2, 18.3, 18.4, 18.6, 19.3, 19.4, 19.9_
    - Done when: `npm run typecheck` and `npm run lint` exit 0.

  - [x] 6.4 Write example tests for the controller: start, Sample, Prepare, Ghost Night
    - In `controller.test.ts` with a recording stub of `ViewPort` and a stub `UiSink`: the call order of the call table rows for `start`, `sample`, `prepare`, and `ghostNight`, with `stopTimeline` first on every phase change and `setPreset("overhead")` only where G16 lists it (12.8, 12.9); the Sample steps and the Sample "next" control until every Precondition is shown (13.3, 13.4, 13.6); the Ghost Night view switch to the Overhead_View (15.6); a `timeline` report runs the end handler so a night moves on (15.5); the Prepare display updates after `setHistory` and after `onEdit` (9.6, 14.4); the Score_Point uses the night start state (10.1); a failed `judgeNight` keeps `prepare` (6.5); "cancel" calls `connectOff` and any operation control calls `connectOff` first while Connect_Mode is on (19.9); `connectOff` after an accepted Cite_Edge (8.3); Edit_Mode per Phase (19.1).
    - Design: Testing Strategy (`controller.test.ts`); Click path.
    - _Requirements: 6.5, 8.3, 9.6, 10.1, 12.8, 12.9, 13.3, 13.4, 13.6, 14.4, 15.5, 15.6, 19.1, 19.9_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 6.5 Write example tests for the controller: Fix It, Look Back, errors, controls
    - In `controller.test.ts` (the same file as task 6.4, so it runs in a later wave): the change to `lookBack` as `stopTimeline`, `connectOff`, `setEditMode`, `setHistory(nightStart)`, `setEffects(lookBackEffects)` (18.6); Look_Back_Effects with `bell-stop` for a true verdict and without for false (7.4); after an `errors` report the Action_Log and History are unchanged (16.10); every `errors` context gives the handling of "Callbacks" (16.10); the `createHistory` failure path (16.1); the Fix It replay is four steps and its end calls `stopTimeline` then `setEffects` with damage and fog (16.9, 12.9); `connectOff` after an accepted Consult_Edge (16.4); the Response_Result is stored on the change to `lookBack` (17.4); on entering `fixIt` the response Check_Result (all not done) is rendered with no Edit_Callback (16.8); "retry" restores the night start state and "start over" restores the Preset_Mansion (12.5, 12.6); undo/redo state per Phase (19.1, 19.2); a full click path with the winning set (Sample ×3 "next", to Prepare, Dont_Read_Mark, start night) reaches `lookBack` with 3 stars in at most 12 activations (20.2).
    - Design: Testing Strategy (`controller.test.ts`); Click path.
    - _Requirements: 7.4, 12.5, 12.6, 12.9, 16.1, 16.4, 16.8, 16.9, 16.10, 17.4, 18.6, 19.1, 19.2, 20.2_
    - Done when: `npm test`, `npm run typecheck`, and `npm run lint` exit 0.

  - [x] 6.6 Write property test for determinism of the judgement
    - In `model/judge.test.ts`.
    - **Property 1: P-APP1-1 same input → same result.** For any variant, Action_Log, Order_Rules, Phase state, and Phase action, `judgeMansion`, `judgeNight`, `convenienceScore`, `starsFor`, `nightTimeline`, `sampleTimeline`, `lookBackEffects`, `deriveActionLog`, `checkOrder`, `nextPhase`, and `controlsFor` called twice, the second time on `structuredClone` copies, give `toStrictEqual` results, and every argument stays deeply equal to a copy taken before the call.
    - **Validates: Requirements 6.6, 10.6, 21.3, 21.4**
    - Done when: `npm test` exits 0.

- [x] 7. DOM panel and page wiring
  - [x] 7.1 Implement `ui.ts` and the page shell
    - `ui.ts`: a `UiSink` that draws the panel with `document.createElement` and `textContent` only: Phase name, instruction, the buttons from `controlsFor` (disabled state included), the incident and hidden-command lines, Convenience and "Damage if the robot is tricked" with `reachNote` in Prepare, the Attack_Card with each Precondition `label`, "Met" or "Not met", the `counters`, and `canBreak` in Look Back, the three Response_Operations with Done or Not done in Fix It, the Response_Result in Look Back, and the SVG score chart (two axes, convenience 0 to 6, damage 0 to 11, one circle, star count as text) made with `createElementNS`. The ViewPreset controls call `setPreset`. No `innerHTML`. It holds no game logic.
    - `apps/ghost-mansion/index.html`: `<title>Ghost Mansion</title>`, `#panel` and `#view` elements, keeping the entry script reference to `main.ts`.
    - Not imported by any entry page until task 7.2, so the public URL is unchanged.
    - Design: UI; File layout.
    - _Requirements: 1.3, 5.6, 9.6, 10.5, 11.1, 12.3, 15.4, 15.6, 16.8, 18.1, 18.3, 19.1, 19.2, 22.1, 22.2, 22.3_
    - Done when: `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:build` exit 0.

  - [x] 7.2 Implement `main.ts` and remove the placeholder
    - Replace `main.ts`: `loadGameData(BUNDLED)` and `applyFallback(data, FALLBACK)`; on failure show "The game data is invalid." and the back link, and start nothing (2.4); build the attack Built_Rules with `withCheckSet` (failure gives the same message); derive the Sample_Mansion; probe `canvas.getContext("webgl2")` inside `try` (G11); call `startCoreView` with `host = #view`, the Sample History from `createHistory(sample, 100)`, the settings, the Theme, `resolveImage: () => null`, `onEdit`, `onTimeline`, `onSelect` of the controller, and `onWalk: () => undefined`; call `controller.start()` only when the probe passed, else show the back link and "3D display is not available, so the game cannot start." with no Phase (1.5). The back link `href` is `import.meta.env.BASE_URL` and is always shown (1.3). Remove the `body` text and the `renderSimplePage` import from this page (do not change `core/view/simple-page.ts`, the Moodwalk page may use it).
    - Run `npm run build` and `npm run check:build`. If `check:build` reports a foreign URL, stop and ask the human before changing the allow list. The Top_Page link to `/ghost-mansion/` keeps working (1.2).
    - Design: UI (`main.ts`); G11.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3, 2.4, 2.8, 13.1, 21.1, 21.5_
    - Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run check:build` exit 0.

- [x] 8. Decision records
  - [x] 8.1 Record fallbacks and lessons
    - If task 2.3 used a different JSON import form, if task 1.1 used the two-ban lint form, or if any other fallback was taken, add one line to `docs/decision-log.md` per fallback and one line to `.kiro/steering/lessons.md` for each lesson (`date | type | what happened | fix`). If none was taken, add no line and say so in the checkpoint report. The decision-log lines required by the design are already added in tasks 1.1 (lint scope), 1.2 (placeholder replaced), and 2.3 (G4 job order). Confirm Fallback_F1 and Fallback_F2 are off in `fallback.ts` (23.3); no new line is needed, since the 2026-11-23 line already records that.
    - Design: Fallbacks; Changes outside apps/ghost-mansion/.
    - _Requirements: 23.3, 23.4_
    - Done when: `npm run check:sections` exits 0.

- [x] 9. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 10. Verification gate (human approves; the agent must not mark this done)
  - Scope: this is the first App spec of Unit 2. The gate includes the deploy check on the public URL.
  - **[Agent]** Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm run build`, `npm run check:build`; report each result and the test counts (test files, tests passed, how many are property tests, P-APP1-1 to P-APP1-12).
  - **[Agent]** Confirm the name test (R-FND-10.15) shows no Ghost Mansion name under `core/` and that `git status` shows no change under `core/` made by this spec (21.2). Confirm `docs/decision-log.md` holds the lines of tasks 1.1, 1.2, and 2.3. Report any missing line.
  - **[Agent]** Confirm the latest build is deployed to the public URL: the GitHub Actions deploy run for the latest push to `main` succeeded and the public page shows the Ghost Mansion game, not the placeholder. Report the run and the commit (unit-approval 3.2). If the push is not done, say so and stop before the Human steps.
  - **[Agent: reviewer]** Check requirement coverage (R-APP1-01 to 23 and P-APP1-1 to 12 each have a task and a test or a gate item), the core/app boundary (no import of `core/view/demo/`, test files, or non-schema `core/view/` files from `model/`; no change under `core/`), no AI_Adapter, LLM client, `fetch`, `Date`, or `Math.random` in `apps/ghost-mansion/` (21.5), no `innerHTML` (22.3), no browser storage (S-APP1-5), the Hidden_Text and all Game_Data strings free of URLs, code, and commands (S-APP1-1), no technical term or OWASP item in the UI (18.5), the fallback switches off (23.3), no feature beyond design.md, and test placement. Report READY or NOT-READY with findings.
  - **[Human]** Public-URL checklist (Ghost Mansion, desktop Chrome or Edge, after the push to `main` has deployed):
    1. The Top_Page link opens `/ghost-mansion/`; the Sample opens in the Ghost_View with the Attack_Card (1.1, 1.2, 11.6).
    2. The back link works in every Phase (1.3).
    3. Sample: the first "Next" moves the camera to the Overhead_View; three "Next" clicks highlight each Precondition, then the damage spreads and stays drawn (13.3, 13.4).
    4. Prepare: opens in the Overhead_View; in the Ghost_View, zooming in on "Fun web page" shows the Hidden_Text in full above the road floor; the Overhead_View hides it (11.4, 11.5); after dragging "Fun web page", "Start over" or undo puts it back and zoom in the Ghost_View shows the Hidden_Text again; Key_Choice, "don't read", and "connect source" work; fog leaves the answer after the Cite_Edge; convenience and "damage if tricked" move (8.3, 9.6, 14).
    5. Ghost Night: in the Overhead_View, each job step marks the robot, its room, and its key line; job labels change, the hidden-command line shows when tricked, bell keys glow blue where they stopped damage (7.4, 15.3, 15.4).
    6. Fix It: the replay stops at the first damage step; the three operations and undo/redo work; the done states update (16).
    7. Look Back: chart and stars, Attack_Card results, the could-stop marks, "Replay", "Prepare again" (18).
    8. DevTools Network panel on a full reload: every request goes to the Public_URL origin (1.4).
    9. The click path of design.md "Click path" from opening the page to Look Back takes at most 90 seconds; record the time in `docs/decision-log.md` (20.2, 20.3).
    10. The three replays fit the G9 bounds (20.1).
  - **[Human]** Then approve the spec's result and add one line to `docs/decision-log.md` (date / Unit / what was checked / result). The line is for the gate of the spec `app-ghost-mansion` only; Unit 2 also includes `app-moodwalk`, which gets its own line at its own gate later.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.4, 11.5, 11.6, 13.3, 13.4, 14.4, 15.3, 15.4, 16.9, 18.1, 20.1, 20.2, 20.3, 21.2, 21.5, 23.3_

## Notes

- `apps/ghost-mansion/model/judge.test.ts` is touched by tasks 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, and 6.6, `game-data.test.ts` by 2.2 and 2.4, `controller.ts` by 6.2 and 6.3, `controller.test.ts` by 6.4 and 6.5, `decision-log.md` by 1.1, 1.2, 2.3, and 8.1, and `arbitraries.ts` by 4.2 only, so those tasks sit in different waves.
- P-APP1-1 (task 6.6) is placed after the controller because it also calls `controlsFor`, `nextPhase`, and the Timeline builders, which are done in task 4.
- The public URL keeps the placeholder page until task 7.2. Data files, the model, and the controller are not imported by an entry page before that.
- Out of scope, so no task: the Eavesdrop and Mimic Ghosts, the field guide, JA/EN switch UI, blank-board building, Dr. Ghost, versus mode, Stage 1, make-your-own-ghost mode, saving a mansion, and any change under `core/` (requirements.md, design.md).
- Failing sensors block acceptance of a change (tech.md), including during Vibe work.
- Waves are a guide for parallel work; the checkpoints are kept in task-number order (a checkpoint runs after the tasks it follows).
- No `tasks.meta.json` is created here; Kiro writes it when tasks are executed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["3"] },
    { "id": 6, "tasks": ["4.1", "4.4", "4.12", "4.14"] },
    { "id": 7, "tasks": ["4.2", "4.5", "4.16", "4.18", "4.20", "4.21"] },
    { "id": 8, "tasks": ["4.3", "4.6", "4.13", "4.15", "4.17", "4.19"] },
    { "id": 9, "tasks": ["4.7"] },
    { "id": 10, "tasks": ["4.8"] },
    { "id": 11, "tasks": ["4.9"] },
    { "id": 12, "tasks": ["4.10"] },
    { "id": 13, "tasks": ["4.11"] },
    { "id": 14, "tasks": ["5"] },
    { "id": 15, "tasks": ["6.1"] },
    { "id": 16, "tasks": ["6.2"] },
    { "id": 17, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 18, "tasks": ["6.5", "6.6"] },
    { "id": 19, "tasks": ["7.2"] },
    { "id": 20, "tasks": ["8.1"] },
    { "id": 21, "tasks": ["9"] },
    { "id": 22, "tasks": ["10"] }
  ]
}
```
