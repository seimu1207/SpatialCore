# Implementation Plan: core-graph

## Overview

Language: TypeScript (design.md uses TypeScript). Build order follows design.md: `json.ts`, the placeholder Scenario_Files, `scenario-schema.ts`, `scenario-io.ts` with the shared generators, the Schema_Sensor change, `commands.ts`, `history.ts`, the name-test extension, then the verification gate.

The placeholder Scenario_Files are rewritten in task 2, before the schema changes in task 3. The old schema ignores unknown fields, so they pass both before and after the change. This keeps `npm run check:schema` green after every task.

Conventions for every task:
- Requirement IDs `X.Y` mean R-GRAPH-X.Y. IDs written `R-FND-X.Y` belong to `repo-foundation`. "Design:" names the design.md section used.
- Tests and PBT run only when a task is completed (tech.md). Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:schema`.
- Every task leaves `tsc --noEmit`, lint, and the schema sensor green. Failing sensors block a change (tech.md).
- Property tests: one test per property, `numRuns` ≥ 100, the test name starts with the property ID (`P-GRAPH-n`), and a tag comment `// Feature: core-graph, Property n: <title>` (design.md Testing Strategy, R-FND-10.5).
- Tests are required by R-GRAPH-10.5 and the repo-foundation convention, so no test sub-task is marked optional.
- Test files sit next to their source (`*.test.ts`). Test files under `core/model/` import nothing from `scripts/`, `three`, or React.
- No file under `core/model/` contains an app-specific name (R-GRAPH-10.2), including comments, test names, and test data.
- Decisions found during a task go into `docs/decision-log.md` as one line: `date | section | decision | reason`.
- Do not commit or push unless the human says so.

## Tasks

- [x] 1. JSON helpers
  - [x] 1.1 Implement `core/model/json.ts`
    - Export `JsonValue`, `JsonObject`, `isPlainObject`, `checkJsonValue` (first fault in a fixed order: keys sorted by code point, arrays by index; cycles reported as a fault; rejects NaN, Infinity, functions, class instances), `compareCodePoints` (walks with `codePointAt`), and `canonicalJson` (sorted keys, 2-space indent, `undefined` values skipped, `-0` written as `0`, one trailing newline, never assigns a `__proto__` key).
    - No imports. No Node.js-only API.
    - Design: File layout, Scenario_Saver (`canonicalJson`, `compareCodePoints`), `checkMetadata`.
    - _Requirements: 1.5, 8.4, 8.8, 8.9, 9.7, 10.6_
    - Done when: `npx tsc --noEmit -p tsconfig.json` and `npm run lint` exit 0.

  - [x] 1.2 Write example tests for `json.ts`
    - In `core/model/json.test.ts`: `compareCodePoints` on an astral character against a BMP character above U+D800; `canonicalJson` layout on a small nested value, `undefined` skipped, `-0` written as `0`, a `__proto__` key written; `checkJsonValue` on a cycle, NaN, a function, a class instance.
    - Tests that must pass: `json.test.ts`.
    - _Requirements: 8.4, 8.8, 8.9, 10.5_

- [x] 2. Placeholder Scenario_Files
  - [x] 2.1 Rewrite the existing placeholder Scenario_Files under `apps/*/scenarios/`
    - Replace the content of each existing placeholder Scenario_File with the saved format from design.md (keys sorted, 2-space indent, one trailing newline): keep `schemaVersion: 1`, `id`, and `title`, and add `"edges": []`, `"nodes": []`, `"zones": []`. Write the file as UTF-8 and keep the Japanese `title.ja` text unchanged.
    - Design: Placeholder Scenario_Files.
    - _Requirements: 9.5, 8.8_
    - Done when: `npm run check:schema` and `npm test` exit 0.

- [x] 3. Scenario_Schema
  - [x] 3.1 Replace the envelope with the leaf schemas in `core/model/scenario-schema.ts`
    - Export `nonBlank`, `localizedTextSchema`, `faceSchema` (with the `requireTextOrImage` check that runs only on plain objects), `edgeSchema`, and `zoneSchema` (`order` integer 0 to `Number.MAX_SAFE_INTEGER`, `elevation` finite, `enclosed` boolean). Remove `ScenarioEnvelope`. Keep the export name `LocalizedText` and the type of `schemaVersion` (`int().min(1)`).
    - Infer all types with `z.infer`. No hand-written type with the same fields.
    - No Node_Type, Edge_Type, or attribute-name list; no `.default(...)`.
    - Design: Scenario_Schema (building blocks, `requireTextOrImage`), Data Models.
    - _Requirements: 3.1, 3.3, 3.4, 3.6, 3.7, 4.1, 4.2, 4.4, 4.6, 4.7, 4.9, 5.1, 5.2, 5.3, 5.5, 5.9, 6.6, 6.8, 9.1, 9.6, 9.7, 10.3_

  - [x] 3.2 Add Node schema and the Metadata and Numeric_Attributes checks
    - In `scenario-schema.ts` add `ValidationError`, `toValidationErrors` (path = `issue.path.map(String).join(".")`), `metadataSchema` (`z.custom` + `checkMetadata` using `checkJsonValue`), `attributesSchema` (`z.custom` + `checkAttributes`: keys sorted by code point, one issue per bad name or value, messages from design.md), `vector3`, `scale3`, and `nodeSchema` (`zone` optional Identifier, `back` optional Face).
    - Do not use `z.record` or `z.json()` for these two fields (design.md: they drop `__proto__`).
    - Design: Scenario_Schema (`checkAttributes`, `checkMetadata`), Validation errors and results.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 3.2, 3.8, 9.7, 10.3, 10.4_

  - [x] 3.3 Add the Scenario schema, cross-element checks, `validateScenario`, and `changes` schemas
    - In `scenario-schema.ts`: `scenarioSchema` with `nodes`, `edges`, `zones` arrays and the `checkCrossElements` `superRefine` registered with `when: (p) => p.issues.length === 0` (order: duplicate ids per list, Edge `from` then `to`, Node `zone`, duplicate Zone `order`). Export `validateScenario(value)`, the types `Scenario`, `Node`, `Edge`, `Zone`, `Face`, `LocalizedText`, `NumericAttributes`, and `nodeChangesSchema`, `edgeChangesSchema`, `zoneChangesSchema` (`null` clears an optional field; `id` not included).
    - Compare Identifiers exactly with `Map` and `Set`, no trimming, no case change.
    - Design: Scenario_Schema (`checkCrossElements`, `validateScenario`, Changes schemas), Data Models.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.9, 6.10, 6.11, 6.12, 7.8, 9.1, 9.2, 9.6_
    - Done when: `npx tsc --noEmit -p tsconfig.json` and `npm run lint` exit 0.

  - [x] 3.4 Update the sensor tests for the new required lists
    - In `scripts/sensors/schema.test.ts` and `scripts/sensors/schema.cli.test.ts` add `nodes: []`, `edges: []`, `zones: []` to the valid Scenario generators and fixtures so they pass the new schema. Keep the `schemaVersion` generator `fc.integer({ min: 1 })`. Add examples for a missing `nodes`, `edges`, or `zones` list. The sensor code itself changes in task 6.
    - Tests that must pass: `schema.test.ts`, `schema.cli.test.ts`.
    - _Requirements: 6.1, 6.7, 9.5, 10.5_

  - [x] 3.5 Write example tests for `scenario-schema.ts`
    - In `core/model/scenario-schema.test.ts`, one example per criterion that is not covered by a property: 1.6 (two broken Nodes both reported), 1.7, 1.9, 2.4 (`"1"` not converted), 2.5 (message quotes the name), 2.7, 2.8, 3.3, 3.6, 3.7 (`nodes.2.back.text.en`, `nodes.2.front.detail.en`, `nodes.2.front.image`), 4.7, 5.2 (`1.5`, `-1`), 5.3 and 5.5 (`"true"`, `0` as `enclosed`), 6.1 (`schemaVersion` 1 and 7 pass; 0, -1, 1.5, `"1"` fail at `schemaVersion`; three empty lists pass), 6.6, 6.7, 6.8 (plain-string `title`, Zone `label` without `en`), 6.11 (a blank Node `type` plus a dangling Edge reports only the `type` error), a Face `{ detail: … }` with an invalid `detail` reporting both errors, and the same `id` in two different lists passing.
    - Tests that must pass: `scenario-schema.test.ts`.
    - _Requirements: 1.6, 1.7, 1.9, 2.4, 2.5, 2.7, 2.8, 3.3, 3.6, 3.7, 4.7, 5.2, 5.3, 5.5, 6.1, 6.6, 6.7, 6.8, 6.11, 10.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:schema`, `npm test`. All exit 0. Ask the user if questions arise.

- [x] 5. Scenario_IO
  - [x] 5.1 Implement `loadScenario` in `core/model/scenario-io.ts`
    - Export `NOT_JSON_MESSAGE`, `NOT_OBJECT_MESSAGE`, `LoadResult`, `loadScenario(text)`: drop one leading U+FEFF; `JSON.parse` in `try` with the fixed parse message (parser text discarded); reject non-object top levels; `validateScenario`; one outer `try` that returns the fixed message `the scenario could not be validated` on an unexpected exception.
    - Design: Scenario_Loader.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 9.2, 10.6_

  - [x] 5.2 Implement `saveScenario` in `core/model/scenario-io.ts`
    - Export `SaveResult`, `saveScenario(scenario)`: `validateScenario` in `try`; on failure return its errors; on success return `canonicalJson` of the Zod output. The input is only read.
    - Design: Scenario_Saver.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.8, 8.9, 8.10, 9.2, 10.7_

  - [x] 5.3 Create the shared generators in `core/model/arbitraries.ts`
    - Test-only file (not matched by the Vitest `include`, imported by no product module). Export `identifierArb`, `localizedTextArb`, `faceArb`, `attributesArb` (built with `Object.fromEntries`, includes `__proto__`, `constructor`, `prototype`, case and whitespace variants), `metadataArb`, `scenarioArb` (unique ids, valid references, unique Zone `order`, any `schemaVersion` ≥ 1, self-loops, parallel Edges, empty lists), `extraFieldsArb`, and `jsonEqual` (own enumerable keys, `-0` equals `0`, `undefined` equals absent). The command and limit generators are added in tasks 8.3 and 9.2.
    - Design: Shared generators.
    - _Requirements: 10.5, 10.6_

  - [x] 5.4 Write property test for save → load
    - In `core/model/scenario-io.test.ts`.
    - **Property 1: P-GRAPH-1 save → load leaves the content unchanged.** Also assert the input equals a deep copy taken before the call and that `Object.prototype` gained no own key.
    - **Validates: Requirements 1.5, 2.6, 2.9, 3.5, 3.8, 3.9, 4.3, 4.8, 5.6, 5.7, 6.1, 8.5, 8.6**

  - [x] 5.5 Write property test for saved text format
    - In `core/model/scenario-io.test.ts`.
    - **Property 2: P-GRAPH-2 saved text stays valid and stable.** Checks: loads again, ends with exactly one `"\n"`, indent multiple of 2, keys in code point order, save of the loaded Scenario equals the text. The Schema_Sensor parity half is in task 6.3.
    - **Validates: Requirements 8.1, 8.7, 8.8, 9.3**

  - [x] 5.6 Write property test for reference integrity
    - In `core/model/scenario-io.test.ts`.
    - **Property 3: P-GRAPH-3 every reference points to an existing element.** Includes the mutation that replaces one Edge `from`/`to` or Node `zone` with an unknown Identifier and expects the error path.
    - **Validates: Requirements 6.4, 6.5, 6.9, 6.12**

  - [x] 5.7 Write property test for determinism
    - In `core/model/scenario-io.test.ts`.
    - **Property 4: P-GRAPH-4 same input → same result.** Loader on valid, broken, and arbitrary strings (twice, same errors in the same order); saver on a Scenario and on a key-reordered copy.
    - **Validates: Requirements 7.4, 7.8, 8.4, 10.6**

  - [x] 5.8 Write property test for broken scenarios
    - In `core/model/scenario-io.test.ts`.
    - **Property 5: P-GRAPH-5 broken scenarios fail with a Field_Path.** Mutations from the design table; the generator picks only mutations that apply to the generated Scenario.
    - **Validates: Requirements 1.2, 1.3, 1.6, 2.4, 3.4, 4.6, 5.5, 6.3, 6.10, 10.4**

  - [x] 5.9 Write property test for unknown fields
    - In `core/model/scenario-io.test.ts`.
    - **Property 6: P-GRAPH-6 unknown fields are ignored.** Extra fields at every fixed-shape level; load result and saved text are unchanged.
    - **Validates: Requirements 6.2, 7.1, 8.10**

  - [x] 5.10 Write property test for the loader never throwing
    - In `core/model/scenario-io.test.ts`.
    - **Property 7: P-GRAPH-7 the loader never throws.** Inputs: `fc.string()`, `fc.fullUnicodeString()`, `fc.json()`, mutated valid text. Failure has non-empty `errors` and no `scenario` key; unparseable text gives exactly the fixed parse error.
    - **Validates: Requirements 7.2, 7.5, 7.6**

  - [x] 5.11 Write example tests for Scenario_IO
    - In `core/model/scenario-io.test.ts`: 7.2 (fixed message for `""`, `"   "`, `"{"`; no input text in the message), 7.3 (each non-object kind), 7.9 (BOM), 7.10 (repeated key, last wins), 8.2 and 8.3 (NaN, Infinity, -Infinity in `position.x` give a failure equal to `validateScenario`'s errors), 8.9 (`back: undefined` writes no key), `schemaVersion: 7` saved as 7, 10.7 (arguments unchanged on failure paths).
    - Tests that must pass: `scenario-io.test.ts`.
    - _Requirements: 7.2, 7.3, 7.9, 7.10, 8.2, 8.3, 8.9, 6.1, 10.7_

- [x] 6. Schema_Sensor uses the loader
  - [x] 6.1 Change `scripts/sensors/schema.ts`
    - Replace `checkScenarioText` so it calls `loadScenario` and returns `{ ok: true } | { ok: false; errors: ValidationError[] }`. Remove the `kind` and `issues` shape. No file reads, no exits.
    - Design: Schema_Sensor change.
    - _Requirements: 9.2, 9.3_

  - [x] 6.2 Change `scripts/sensors/schema.cli.ts`
    - Print one line per error: `<file>: <path>: <message>`, with `(root)` in place of an empty path (this includes the parse-failure line). Exit codes stay 0, 1, 2 as in R-FND-08; the file is never written.
    - _Requirements: 9.4_

  - [x] 6.3 Update `scripts/sensors/schema.test.ts` and add the parity test
    - Adapt P-FND-4 and P-FND-5 to read `errors` instead of `kind` and `issues`. Add a parity test (name starts with `P-GRAPH-2`, ≥ 100 runs) that checks `checkScenarioText(t)` and `loadScenario(t)` give the same verdict and the same errors for texts from `saveScenario` on `scenarioArb` and for the P-GRAPH-5 mutations. Import generators from `core/model/arbitraries.ts`.
    - **Property 2 (sensor half): P-GRAPH-2 saved text passes the sensor check.** **Validates: Requirements 8.7, 9.3**
    - Tests that must pass: `schema.test.ts`.
    - _Requirements: 8.7, 9.3, 10.5_

  - [x] 6.4 Update `scripts/sensors/schema.cli.test.ts`
    - Cases: `<file>: (root): JSON could not be parsed…` for invalid JSON (exit 1), `(root)` line for a non-object top level, `nodes.0.type` line for a nested error, file left unchanged, and the real placeholder files pass (exit 0).
    - Tests that must pass: `schema.cli.test.ts`.
    - _Requirements: 9.4, 9.5, 10.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:schema`, `npm test`. All exit 0. Ask the user if questions arise.

- [x] 8. Edit commands
  - [x] 8.1 Implement `editCommandSchema` in `core/model/commands.ts`
    - Export `singleCommandSchema`, `editCommandSchema` (discriminated union on `kind`: add, remove, update for Node, Edge, Zone, plus `batch` with `commands: z.array(singleCommandSchema).min(1)`), `SingleCommand`, `EditCommand`, `ApplyResult`. Reuse `nodeSchema`, `edgeSchema`, `zoneSchema`, the `changes` schemas, and `nonBlank` from `scenario-schema.ts`. Declare no second schema for these elements.
    - Design: Edit commands and the Command_Applier.
    - _Requirements: 11.1, 11.13, 11.16, 11.19, 11.20, 9.1_

  - [x] 8.2 Implement `applyCommand`
    - Steps in design.md: validate the Scenario; parse the command; batch folds `applySingle` in order and stops at the first failure with paths prefixed `commands.<i>.`; `applySingle` builds a new Scenario with spreads, handles `null` clears, returns an error at path `id` for a missing id, then calls `validateScenario` (this gives 11.8). One outer `try` returns one error at path `""` on an unexpected exception. Never writes to its arguments.
    - Design: Edit commands and the Command_Applier.
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 11.15, 11.17, 11.18, 11.19, 11.20, 10.7_

  - [x] 8.3 Add `commandArb` to `core/model/arbitraries.ts`
    - `commandArb(ids)`: every kind, ids from existing and missing pools, `changes` with random subsets and `null` clears, batches of 0 to 4 commands including nested batches. Imports `commands.ts` (test-only file).
    - Design: Shared generators.
    - _Requirements: 10.5_

  - [x] 8.4 Write property test for command effects
    - In `core/model/commands.test.ts`.
    - **Property 14: P-GRAPH-14 each accepted command makes exactly its change.** Compare with a reference model computed in the test.
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.9, 11.10**

  - [x] 8.5 Write example tests for `commands.ts`
    - In `core/model/commands.test.ts`: 11.4 (remove a Node with two Edges), 11.8 (paths and message), 11.11 (path `id`), 11.13 (unknown kind, missing `node`), 11.19 (`[]`, missing, string), 11.20 (`commands.1.kind`), 11.17 (clear-`zone`-then-remove-Zone batch succeeds), 11.18 (same two commands in reverse order fail at `commands.0.nodes.<j>.zone`; a batch whose command 1 fails returns only errors prefixed `commands.1.` and command 2 is not applied), 11.14 and 10.7 (arguments unchanged).
    - Tests that must pass: `commands.test.ts`.
    - _Requirements: 11.4, 11.8, 11.11, 11.13, 11.14, 11.17, 11.18, 11.19, 11.20, 10.7_

- [x] 9. History
  - [x] 9.1 Implement `core/model/history.ts`
    - Export `History`, `DEFAULT_HISTORY_LIMIT` (100), `CreateHistoryResult`, `ExecuteResult`, `createHistory(scenario, limit?)` (limit must be a safe integer > 0, else one error at path `limit`), `executeCommand` (on failure returns the input History itself; on success appends to `past`, keeps the newest `limit` entries, clears `future`), `undo`, `redo` (return the input History when empty). `History` is a plain type, not a Zod schema.
    - Design: History.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11_

  - [x] 9.2 Add `limitArb` and `badLimitArb` to `core/model/arbitraries.ts`
    - `limitArb`: `fc.integer({ min: 1, max: 20 })`. `badLimitArb`: `fc.constantFrom(0, -1, 1.5, NaN, Infinity, "3", null)`.
    - _Requirements: 12.10_

  - [x] 9.3 Write property test for valid edits
    - In `core/model/history.test.ts`.
    - **Property 8: P-GRAPH-8 edits keep the Scenario valid.** Up to 10 commands; `validateScenario(present)` succeeds after every step.
    - **Validates: Requirements 11.2, 11.12, 12.2**

  - [x] 9.4 Write property test for undo and redo
    - In `core/model/history.test.ts`.
    - **Property 9: P-GRAPH-9 undo and redo restore states.** Uses `jsonEqual`.
    - **Validates: Requirements 12.2, 12.4, 12.5**

  - [x] 9.5 Write property test for the History limit
    - In `core/model/history.test.ts`.
    - **Property 12: P-GRAPH-12 History never keeps more than `limit` steps.** Includes the reference list of the newest `limit` entries, `badLimitArb` failures at path `limit`, and the default 100.
    - **Validates: Requirements 12.1, 12.2, 12.10, 12.11**

  - [x] 9.6 Write property test for command determinism
    - In `core/model/commands.test.ts` (imports `history.ts`).
    - **Property 10: P-GRAPH-10 same history and command → same result.** Commands from `fc.oneof(commandArb(ids), fc.jsonValue())`; arguments equal their deep copies afterwards; nothing throws.
    - **Validates: Requirements 10.6, 10.7, 11.14, 11.15**

  - [x] 9.7 Write property test for rejected commands
    - In `core/model/commands.test.ts`.
    - **Property 11: P-GRAPH-11 rejected commands change nothing.** `executeCommand` returns the same History reference with the same errors; the failure has no `scenario` key.
    - **Validates: Requirements 11.8, 11.11, 11.12, 11.13, 11.18, 12.3**

  - [x] 9.8 Write property test for batches
    - In `core/model/commands.test.ts`.
    - **Property 13: P-GRAPH-13 a batch equals its commands in sequence, as one step.** Includes the one-entry `past` growth, one undo, and the `commands.<k>.` prefix on failure.
    - **Validates: Requirements 11.17, 11.18, 12.9**

  - [x] 9.9 Write example tests for `history.ts`
    - In `core/model/history.test.ts`: 12.1 (default limit 100), 12.6 and 12.7 (undo and redo at the ends return the input), 12.10 (each bad `limit` value).
    - Tests that must pass: `history.test.ts`.
    - _Requirements: 12.1, 12.6, 12.7, 12.10_

- [x] 10. Boundary name test
  - [x] 10.1 Extend the R-FND-10.15 name test to every file under `core/model/`
    - In `scripts/sensors/repo-rules.test.ts` change the test to run `listFiles` on `core/model/` and pass both each file path and its text to `findAppNames`. The name list is `APP_NAMES` from `repo-rules.ts` plus the folder names under `apps/` read with `readdirSync`. The test must fail if any file under `core/model/` (including tests and `arbitraries.ts`) holds an app name, case-insensitive.
    - Add one line to `docs/decision-log.md`: `date | repo-foundation R-FND-10.15 | test extended to every file under core/model/ | R-GRAPH-10.2`.
    - Design: Name test extension.
    - _Requirements: 10.2_
    - Done when: `npm test` and `npm run lint` exit 0.

- [x] 11. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 12. Verification gate (human approves; the agent must not mark this done)
  - Scope: for this spec the gate is tests, sensors, the reviewer agent, and human approval. The human check on the public URL applies at the end of the whole `core` Unit (after `core-rules` and `core-view`), not here.
  - **[Agent]** Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm run build`, `npm run check:build`; report each result.
  - **[Agent: reviewer]** Check requirement coverage (R-GRAPH-01 to 12 and P-GRAPH-1 to 14 each have a task and a test), the `core/model` boundary (R-GRAPH-10.1 to 10.4, no app names, no `three`, no `view` or `apps` imports), one schema and inferred types (9.1, 9.6), rotation and Zone fields unused (1.8, 5.8), no propagation meaning (4.5), safety (S-GRAPH-1 to S-GRAPH-6), and test placement (10.5). Report READY or NOT-READY with findings.
  - **[Human]** Approve the spec's result and add one line to `docs/decision-log.md` (date / Unit / what was checked / result).
  - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.5_

## Notes

- Tasks 3.4 and 6.3 change the same sensor test file at different times: 3.4 only adds the new lists so tests pass against the new schema; 6.3 adapts them to the new result type.
- `arbitraries.ts` is touched by tasks 5.3, 8.3, and 9.2, in that order. It is not matched by the Vitest `include` pattern.
- P-GRAPH-10, P-GRAPH-11, and P-GRAPH-13 sit in `commands.test.ts` but are scheduled after `history.ts` (task 9) because they also check `executeCommand`.
- Out of scope here: RuleEngine, propagation, Timeline, AIAdapter (`core-rules`), rendering and interaction (`core-view`), and anything in `apps/` apart from the placeholder Scenario_Files.
- Failing sensors block acceptance of a change (tech.md), including during Vibe work.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.4", "3.5", "5.3"] },
    { "id": 6, "tasks": ["5.1", "8.1"] },
    { "id": 7, "tasks": ["5.2", "6.1", "8.2"] },
    { "id": 8, "tasks": ["5.4", "6.2", "8.3", "9.1"] },
    { "id": 9, "tasks": ["5.5", "6.3", "6.4", "8.4", "9.2", "9.3"] },
    { "id": 10, "tasks": ["5.6", "8.5", "9.4"] },
    { "id": 11, "tasks": ["5.7", "9.5", "9.6"] },
    { "id": 12, "tasks": ["5.8", "9.7", "9.9"] },
    { "id": 13, "tasks": ["5.9", "9.8"] },
    { "id": 14, "tasks": ["5.10"] },
    { "id": 15, "tasks": ["5.11"] },
    { "id": 16, "tasks": ["10.1"] }
  ]
}
```
