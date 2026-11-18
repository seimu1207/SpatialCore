# Implementation Plan: core-rules

## Overview

Language: TypeScript (design.md uses TypeScript). Build order follows design.md: `rule-schema.ts`, `rule-input.ts`, `graph-index.ts`, `conditions.ts`, `paths.ts`, `series.ts`, `effects.ts`, `timeline.ts`, `ai-adapter.ts`, then the cross-file properties, the decision records, and the verification gate. The new generators are added to the shared `core/model/arbitraries.ts` in the task that first needs them.

Every task changes files under `core/model/` only (plus `docs/decision-log.md` and `.kiro/steering/lessons.md` in task 12). No task touches `core/view/`, `apps/`, `index.html`, or the Vite config, so the public URL builds and works the same after every task. The new files are not imported by any App yet. Only if the name test over `core/model/` does not cover the new files, `scripts/sensors/repo-rules.test.ts` is also changed (task 14).

Conventions for every task:
- Requirement IDs `X.Y` mean R-RULES-X.Y. IDs written `R-GRAPH-X.Y` belong to `core-graph`; `R-FND-X.Y` belong to `repo-foundation`. "Design:" names the design.md section used.
- Tests and PBT run only when a task is completed (tech.md). Commands: `npm test`, `npm run typecheck`, `npm run lint`.
- Every task leaves `tsc --noEmit` and lint green. Failing sensors block a change (tech.md).
- Property tests: one test per property, `numRuns` ≥ 100, the test name starts with the property ID (`P-RULES-n`), and a tag comment `// Feature: core-rules, P-RULES-n: <title>` (design.md Testing Strategy, R-FND-10.5).
- Tests are required by R-GRAPH-10.5 and the repo-foundation convention, as in `core-graph`, so no test sub-task is marked optional.
- Test files sit next to their source (`*.test.ts`) and import nothing from `scripts/`, `three`, or React. Reference models (closure, relaxation distances, counts, sums) live inside the test files and are written independently of the code under test.
- No file under `core/model/` contains an app-specific name (R-GRAPH-10.2, R-RULES-16.1), including comments, test names, and test data. Use generic words (`t1`, `t2`, `item`, `link`, `level`, `fog`).
- No function throws and none writes to its arguments (R-RULES-16.5, 16.6). Every public function checks every argument before it computes (R-RULES-16.3, 16.4, 16.9).
- No new dependency. Only `zod`, `vitest`, and `fast-check` already in `package.json`.
- Decisions found during a task go into `docs/decision-log.md` as one line: `date | section | decision | reason` (collected in task 12).
- Do not commit or push unless the human says so.

## Tasks

- [x] 1. Rule schema and loader
  - [x] 1.1 Add selectors, filters, and Conditions to `core/model/rule-schema.ts`
    - Export `MAX_CONDITION_DEPTH` (32), `RuleFailure`, `RuleOutcome<T>`, `nonNegativeInteger`, `nodeSelectorSchema` (`self` as `z.literal(true).optional()`), `edgeFilterSchema`, the six Condition schemas, `checkRange` (`min or max is required`, `min must not be greater than max`; `min === max` passes), and `conditionSchema` as `z.discriminatedUnion("kind", …)`. `all`, `any`, and `not` use getters with explicit return types. Reuse `nonBlank` from `scenario-schema.ts` as the Identifier schema. Infer every type with `z.infer`.
    - No list of Node_Types, Edge_Types, attribute names, or `id`s. No `.default(...)`.
    - If `tsc` reports a circularity error on a getter, apply the annotation fix and note it for task 12.2 (design.md: Rule_Definition_Schema, notes per rule).
    - Design: Results and Rule_Failure; Rule_Definition_Schema.
    - _Requirements: 1.1, 1.2, 1.9, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
    - Done when: `npx tsc --noEmit -p tsconfig.json` and `npm run lint` exit 0.

  - [x] 1.2 Add `limitConditionDepth` to `rule-schema.ts`
    - Export `MAX_CONDITION_OCCURRENCES` (10,000, the Condition_Size limit of R-RULES-01.7) and `limitConditionDepth(condition, path)`: an iterative walk with a frontier `Map` keyed by object identity and a multiplicity per entry (capped at 10,001), at most 32 loops. Over either limit it returns `{ value: { kind: "all", conditions: [] }, error }` with the single message `condition is nested deeper than 32 levels or has more than 10,000 parts`; otherwise `{ value: condition, error: null }`. Depth exactly 32 passes; a Condition_Size of exactly 10,000 passes.
    - No recursion. A 10,000-level chain, a Condition that contains itself, and a shared sub-Condition that expands past 10,000 occurrences all stop in bounded work.
    - Design: Condition depth limit.
    - _Requirements: 1.7_

  - [x] 1.3 Add the Rule_Definition schemas and cross-field checks to `rule-schema.ts`
    - `checkItemSchema`, `checkSetSchema`, `nodeRuleSchema`, `effectSourceSchema`, `effectRuleSchema`, `propagationPolicySchema`, `ruleDefinitionSchema` (`schemaVersion` `int().min(1)`), and `checkRuleCrossFields` registered with `when: (p) => isPlainObject(p.value)`. Issue order: duplicate ids (check sets, items by set, node rules, effect rules), pass/stop overlap at `propagation.stop.<i>`, misplaced `self: true`, unknown node rule `source.id`. Read every field defensively so no fault is reported twice.
    - Design: Rule_Definition_Schema (`checkRuleCrossFields`).
    - _Requirements: 1.4, 1.5, 1.6, 2.1, 2.2, 2.5, 6.5_

  - [x] 1.4 Add `loadRuleDefinition` with the depth and size pre-check to `rule-schema.ts`
    - `loadRuleDefinition(value)`: `limitConditionDepth` (depth 32 and Condition_Size 10,000, R-RULES-01.7) on every `checkSets.<i>.items.<j>.condition` and `nodeRules.<i>.condition` with path copies built by spreads (the input is never written), then `safeParse`, depth and size errors first, then Zod errors in Zod's order. One outer `try` returns one error at path `""` (`the rule definition could not be validated`) on an unexpected exception. Unknown fields are removed at every level.
    - Design: Rule_Definition_Loader.
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 16.2, 16.5_

  - [x] 1.5 Add the Series and result schemas to `rule-schema.ts`
    - `seriesSettingsSchema` (no defaults; `minRunLength` integer ≥ 2), `intentionalMarksSchema`, `nodeRuleResultSchema`, `propagationResultSchema`, `seriesResultSchema`, `judgementResultsSchema`, `effectTargetSchema`, and `effectRequestSchema`. Export the inferred types of these schemas.
    - Design: Data Models; Series schemas.
    - _Requirements: 10.6, 10.7, 13.4, 16.9_

  - [x] 1.6 Add the Timeline, Cursor, and Explanation schemas to `rule-schema.ts`
    - `timelinePropagationSchema` with `stepsWithinCount` (`when` no earlier issues), `timelineStepSchema`, `timelineSchema` (`min(1)` plus `duplicateStepIds`), `timelineCursorSchema` (plus `positionInRange`), `explanationRequestSchema`, and `explanationTableSchema` (`z.custom` + `superRefine`, keys read with `Object.keys` sorted by `compareCodePoints`, paths built by plain joining so the key `""` gives `table.`). Export every inferred type listed under Data Models.
    - Design: Data Models; Timeline schemas; AI_Adapter (`explanationTableSchema`).
    - _Requirements: 14.1, 14.2, 14.9, 14.13, 15.6, 16.9_

  - [x] 1.7 Add the Rule_Definition generators to `core/model/arbitraries.ts`
    - Add `typePoolArb`, `attrPool` (`["v", "w", "__proto__"]`, built with `Object.fromEntries`), `ruleScenarioArb`, `selectorArb(s, { self })`, `edgeFilterArb`, `conditionArb(s, { self, maxDepth })` (built with `fc.letrec`, default `maxDepth` 4), `ruleDefinitionArb(s)`, `maxStepsArb(s)`, `ruleMutationArb(def)`, and the example helpers `deepNot(n)` (loop, no recursion) and `selfContaining()`. Reuse the `core-graph` generators already in the file. Integer values only, so sums stay exact.
    - Test-only file. Imports `rule-schema.ts`.
    - Design: PBT properties → Generators.
    - _Requirements: 16.1_

  - [x] 1.8 Write example tests for `rule-schema.ts`
    - In `core/model/rule-schema.test.ts`: 1.4 (duplicate ids in each of the four lists; the same id across lists accepted), 1.5, 1.6 (`self: false` in a node rule Condition; `self: true` in a check item and in a node rule candidate selector fail; `self: true` inside a node rule Condition passes), 1.7 (depth 32 accepted; depth 33 one error; `deepNot(10000)` one error and no stack overflow; `selfContaining()` one error; a Condition listing itself twice, and 20 nested `all` levels listing the same child twice, each one error; Condition_Size exactly 10,000 accepted and 10,001 one error), 2.1 (duplicates in `pass` and empty lists accepted), 2.2, 4.1 (unknown `kind` at `checkSets.0.items.0.condition.kind`), 4.8 (no bound, `min > max`, `min === max`), and the example Rule_Definition of the design loading unchanged.
    - Tests that must pass: `rule-schema.test.ts`.
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 4.1, 4.8, 16.1_

  - [x] 1.9 Write property test for rule definitions
    - In `core/model/rule-schema.test.ts`.
    - **Property 14: P-RULES-14 rule definitions are checked without throwing.** Inputs `fc.oneof(fc.jsonValue(), fc.anything())`; `ruleMutationArb` errors include the mutated path; `extraFieldsArb` at every object level leaves the loaded value `jsonEqual` to the input; same content gives `toStrictEqual` results.
    - **Validates: Requirements 1.2, 1.3, 1.8, 1.9, 16.2**

- [x] 2. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm test`. All exit 0. Ask the user if questions arise.

- [x] 3. Argument checks and graph index
  - [x] 3.1 Implement `core/model/rule-input.ts`
    - Export `guard` (an unexpected exception gives one error at `""`, message `the rules could not be evaluated`), `prefixErrors` (path `""` becomes the prefix, any other path `q` becomes `p.q`), `parseArg`, `checkScenario` (`validateScenario` + prefix `scenario`), `checkRules` (`loadRuleDefinition` + prefix `rules`), `rejectSelf` (one error at `<prefix>.self`), and `combine` (errors in the order given, so `scenario.` comes before `rules.`).
    - Design: Argument checks.
    - _Requirements: 6.5, 16.3, 16.4, 16.5, 16.8, 16.9_

  - [x] 3.2 Implement `core/model/graph-index.ts`
    - Export `GraphIndex`, `buildIndex` (node index map, zone and edge id sets, out-edge lists in `edges` order, zones sorted by `order`), `matchSelector` (a flag per Node; absent field matches all, empty list matches none, `zones` never matches a Node without `zone`), `prepareFilter`, `passesFilter` (empty `include` passes no Edge), `addUnresolved`, `addConditionUnresolved` (static walk of every selector), `sortedIds` (`compareCodePoints`, each once), `sumOver` (`Object.hasOwn`, list order), and `selectNodes(scenario, selector)`.
    - Read only Node `id`, `type`, `zone`, `attributes`, Edge `id`, `from`, `to`, `type`, and Zone `id`, `order`.
    - Design: Graph index and Node_Selector matching.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 9.1, 9.2, 9.3, 9.5_

  - [x] 3.3 Write example tests for `graph-index.ts`
    - In `core/model/graph-index.test.ts`: 3.5 (a missing id in the second branch of an `any` whose first branch holds is still reported), 3.6 (`"a"`, `"A"`, `" a"` stay distinct), 3.8 (empty lists pick nothing and give no failure), a Node without `zone` is never picked by `zones`, `sumOver` reads an own `__proto__` attribute.
    - Tests that must pass: `graph-index.test.ts`.
    - _Requirements: 3.5, 3.6, 3.8, 9.2, 9.5_

- [x] 4. Conditions, check sets, node rules
  - [x] 4.1 Implement `evaluateCondition` and the leaf Conditions in `core/model/conditions.ts`
    - Export `CheckResult` and `evaluateCondition`. One internal `evaluate(g, c, path, self, errors)` with no short-circuit: `all` and `any` evaluate every child, then combine. `edgeCount` counts Edges in list order (self-loop once, parallel Edges separately). `reach` is a breadth-first search whose start Nodes are not pre-marked and that ends on cycles. `attribute` uses `sumOver`; a non-finite sum pushes an error at `<Condition path>.attribute` and the whole call fails. Duplicate errors are kept once at their first position.
    - `evaluateCondition` runs `limitConditionDepth`, rejects `self: true`, and validates with `conditionSchema`. Paths are `condition`, nested `.conditions.<k>` or `.condition`.
    - Design: Conditions.
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 4.10, 9.4_

  - [x] 4.2 Add `evaluateCheckSets` and `evaluateNodeRules` to `conditions.ts`
    - Check set paths `rules.checkSets.<s>.items.<i>.condition`, node rule paths `rules.nodeRules.<r>.condition`. A Node_Rule evaluates its Condition once per candidate with that candidate as Self_Node. Absent lists give `[]`. References are collected with `addConditionUnresolved`, also when no candidate is picked. Any Rule_Failure makes the whole call a Rule_Failure. Never read `rules.propagation`.
    - Design: Check_Sets, Node_Rules.
    - _Requirements: 2.6, 4.10, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 4.3 Write example tests for `conditions.ts`
    - In `core/model/conditions.test.ts`: 4.9 (a 2,000-Node cycle with `reach`), 4.10 (an overflowing `attribute` in the second branch of an `any` whose first branch holds gives a failure at `rules.checkSets.0.items.0.condition.conditions.1.attribute`, no partial result), 5.5 (item ids opaque), 5.6 and 6.4 (absent lists give `[]`), 6.6 (references reported with no candidate), 6.7.
    - Tests that must pass: `conditions.test.ts`.
    - _Requirements: 4.9, 4.10, 5.5, 5.6, 5.7, 6.4, 6.6, 6.7_

  - [x] 4.4 Write property test for condition logic
    - In `core/model/conditions.test.ts`.
    - **Property 6: P-RULES-6 condition logic.** Double `not`, empty `all` and `any`, `all` and `any` against the member results, and monotonic `edgeCount` and `reach` after edge removal.
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.6, 4.7**

  - [x] 4.5 Write property test for check set verdicts
    - In `core/model/conditions.test.ts`.
    - **Property 7: P-RULES-7 check set verdict.** One Check_Result per Check_Set; `allHold` is the conjunction; each item equals `evaluateCondition`; reversing items changes no item result.
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**

  - [x] 4.6 Write property test against the reference model
    - In `core/model/conditions.test.ts`.
    - **Property 15: P-RULES-15 leaf conditions, selectors, and node rules agree with a reference model.** Includes `selectNodes` against a reference filter, the `self` substitution check for node rules, and `unresolved` collected by a reference walk (also with no candidate).
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 4.2, 4.3, 4.4, 5.4, 6.1, 6.2, 6.3, 6.6**

- [x] 5. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm test`. All exit 0. Ask the user if questions arise.

- [x] 6. Reachability, path search, propagation
  - [x] 6.1 Implement `findReachable` and `findPath` in `core/model/paths.ts`
    - `findReachable`: the same search as `reach`; a start Node is in the result only if a Path leads back to it; result in `nodes` order with `unresolved`. `findPath(scenario, from, to, edges)`: Identifiers for `from` and `to`; a missing Node gives `{ path: null, unresolved }` (listed once, code point order); otherwise breadth-first search with a parent edge map, start Node never given a parent, so `from === to` returns the shortest cycle and never an empty Path. Result is Edge ids.
    - Design: Reachability, path search, propagation (Reachable_Set, Path search).
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 6.2 Implement `propagate` in `core/model/paths.ts`
    - `propagate(scenario, rules, seeds, maxSteps?)`: `pass` and `stop` as `Set`s, `maxSteps` checked as an integer ≥ 0 at path `maxSteps`, level-by-level search over `pass` Edges in `edges` order, each Node given a step once, `via` Edge recorded. `stopped` = Edges with a `stop` type whose `from` is reached, in `edges` order. At `maxSteps = k`, step-k Nodes are not expanded. Undeclared Edge_Types carry nothing and are never stopped. Return `PropagationResult` with `unresolved` from `seeds`.
    - Design: Reachability, path search, propagation (Automatic propagation).
    - _Requirements: 2.3, 2.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

  - [x] 6.3 Write example tests for `paths.ts`
    - In `core/model/paths.test.ts`: 7.4 (two shortest Paths, the one of the 8.3 visit order returned), 7.5 (including `from === to` with that Node missing: listed once), 7.7 (self-loop gives a one-Edge Path; no cycle gives `null`), 8.3 (order of reached Nodes on a small graph), 8.6 (Max_Steps 0 gives only seeds; a passing Edge out of a step-k Node is neither traversed nor stopped), 8.7 (`-1`, `1.5`, `"2"`, NaN), 8.8, 8.10, and a 2,000-Node cycle for termination.
    - Tests that must pass: `paths.test.ts`.
    - _Requirements: 7.4, 7.5, 7.7, 8.3, 8.6, 8.7, 8.8, 8.9, 8.10_

  - [x] 6.4 Write property test for edge removal
    - In `core/model/paths.test.ts`.
    - **Property 2: P-RULES-2 removing edges never increases the reachable set.** For `findReachable` and `propagate`.
    - **Validates: Requirements 7.1, 8.1**

  - [x] 6.5 Write property test for stopping Edge_Types
    - In `core/model/paths.test.ts`.
    - **Property 3: P-RULES-3 propagation never passes a stopping Edge_Type.** Includes the retyped-Edges subset check and the empty `pass` case.
    - **Validates: Requirements 2.3, 2.4, 8.1**

  - [x] 6.6 Write property test for step numbers
    - In `core/model/paths.test.ts`.
    - **Property 4: P-RULES-4 step numbers are shortest distances.** Reference distances by repeated relaxation; Max_Steps `k` equals the unlimited run cut at step `k`.
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6**

  - [x] 6.7 Write property test for path search
    - In `core/model/paths.test.ts`.
    - **Property 5: P-RULES-5 path search agrees with reachability.** Reference closure, shortest length, and the `propagate` chain equality for include-only filters.
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.6, 7.7**

- [x] 7. Sums and series
  - [x] 7.1 Implement `sumAttribute` in `core/model/series.ts` and add the series generators
    - `sumAttribute(scenario, nodes, attribute)`: `sumOver` on the picked Nodes, `{ sum, count, unresolved }`; a non-finite sum gives one error at `attribute` with message `sum of attribute "<name>" is not a finite number`.
    - In `arbitraries.ts` add `seriesSettingsArb`, `flatZoneScenarioArb`, and `marksArb(s)`.
    - Design: Sums and series; PBT properties → Generators.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 7.2 Implement `seriesFor` and `checkSeries` in `series.ts`
    - Internal `seriesFor(g, settings, marks, path)`: Zone_Series in `order` (Zones with no value left out, `sum` or `mean`), Step_Changes, Shifts by `direction` with strict comparison and `intentional` from the marks, Long_Runs by one scan cut at `|change| > runTolerance` with `minRunLength`, and `unresolved` marks. Non-finite Zone_Value or Step_Change gives one error each at the `attribute` path and no result. `checkSeries` validates its arguments (`settings.<field>`, `marks.<i>`) and returns one Series_Result.
    - Design: Sums and series (`seriesFor` algorithm).
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 7.3 Implement `checkSeriesList` in `series.ts`
    - `checkSeriesList` validates the list (`settings.<i>.<field>`), reports a repeated `attribute` at `settings.<i>.attribute`, calls `seriesFor` once per entry, and returns results equal to the single `checkSeries` results, in list order.
    - Design: Sums and series (`checkSeriesList`).
    - _Requirements: 10.6, 11.8, 11.9_

  - [x] 7.4 Write example tests for `series.ts`
    - In `core/model/series.test.ts`: 9.4 (two values of `Number.MAX_VALUE`), 9.6, 10.2 (no Zone), 10.5 (overflowing Zone_Value and Step_Change, one error each), 10.6 (each bad field, in both path forms), 11.3 (a change equal to the threshold is never a Shift), 11.7, 11.9, and the series example of the design.
    - Tests that must pass: `series.test.ts`.
    - _Requirements: 9.4, 9.6, 10.2, 10.5, 10.6, 11.3, 11.7, 11.9_

  - [x] 7.5 Write property test for sums
    - In `core/model/series.test.ts`.
    - **Property 8: P-RULES-8 sums.** Reference loop with `Object.hasOwn`; the same result for any permutation of `nodes`.
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

  - [x] 7.6 Write property test for shifts
    - In `core/model/series.test.ts`.
    - **Property 9: P-RULES-9 shift detection.** Reference series, offset invariance for `mean`, threshold monotonicity, marks change only `intentional`, `both` is the union of `up` and `down`, list equals single results.
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.8**

  - [x] 7.7 Write property test for long runs
    - In `core/model/series.test.ts`.
    - **Property 10: P-RULES-10 long runs.** No overlap, ordering, minimum length, tolerance inside, maximality, and monotonicity in `minRunLength` and `runTolerance`.
    - **Validates: Requirements 11.6**

- [x] 8. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm test`. All exit 0. Ask the user if questions arise.

- [x] 9. Effect requests and Timeline
  - [x] 9.1 Implement `core/model/effects.ts`
    - Export `JudgementResults`, `compareEffects` (Effect_Kind, target `kind`, target `id`, `source`, each by `compareCodePoints`), `sortUniqueEffects`, and `buildEffects(scenario, rules, results)`: validate `results` with `judgementResultsSchema` (prefix `results`); per Effect_Rule by source kind (`nodeRule`, `shifts` non-intentional only, `longRuns`, `propagation`); a missing result produces nothing and no error; targets that name no element of the Scenario are dropped; output sorted and unique, with exactly the keys `effect`, `target`, `source`. Never compare `effect` with a constant.
    - Design: Effect_Requests.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 16.9_

  - [x] 9.2 Add `judgementResultsArb` to `core/model/arbitraries.ts`
    - Node_Rule_Results, Series_Results, and a Propagation_Result whose ids come from the Scenario plus `identifierArb`, each part present or absent, every `step` ≤ `reached.length − 1`.
    - _Requirements: 13.3_

  - [x] 9.3 Write example tests for `effects.ts`
    - In `core/model/effects.test.ts`: 13.6 (missing result, no error), 13.7 (no Effect_Rules gives `[]`), intentional Shifts produce no request, and the Effect_Request example of the design.
    - Tests that must pass: `effects.test.ts`.
    - _Requirements: 13.1, 13.6, 13.7_

  - [x] 9.4 Write property test for effect requests
    - In `core/model/effects.test.ts`.
    - **Property 12: P-RULES-12 effect requests are well formed.** Sorted, unique, every target exists, exact keys, equals the result for cleaned input, matches a reference built from the table.
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4**

  - [x] 9.5 Implement the Timeline builders in `core/model/timeline.ts`
    - Export `createTimeline(steps)` (parse `{ steps }` with `timelineSchema`, so paths start with `steps`), `timelineFromPropagation` (validate with `timelinePropagationSchema`, prefix `propagation`; no reached Node gives one error at `propagation.reached`; step `n` holds the Nodes with step `n`, then their `via` Edges for `n > 0`), and `timelineFromZones` (one step per Zone in `order`; no Zone gives one error at `scenario.zones`). Built step ids are `step-<index>`. Steps hold no time, duration, or speed.
    - Design: Timeline.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.11, 14.13_

  - [x] 9.6 Implement the cursor functions in `timeline.ts`
    - Export `createCursor`, `nextStep`, `previousStep` (clamped), `seekStep` (error at `position`, message `position must be an integer from 0 to <last>`), and `cursorEffects` (`current` = the step's `effects`; `upToCurrent` = `sortUniqueEffects` of steps `0 … position`). Every move returns a new cursor; the input is not changed.
    - Design: Timeline (cursor).
    - _Requirements: 14.6, 14.7, 14.8, 14.9, 14.10, 14.12_

  - [x] 9.7 Add `timelineArb` and `cursorMovesArb` to `arbitraries.ts`
    - `timelineArb`: 1 to 6 steps with unique ids, random targets, Effect_Requests with repeats across steps. `cursorMovesArb(n)`: up to 20 moves from `next`, `previous`, `seek(fc.nat(n − 1))`.
    - _Requirements: 14.6_

  - [x] 9.8 Write example tests for `timeline.ts`
    - In `core/model/timeline.test.ts`: 14.1, 14.2 (empty list, bad field, repeated id), 14.4, 14.5, 14.7 and 14.8 (ends clamp), 14.9 (seek outside), 14.13, the propagation Timeline example of the design, and the `stepsWithinCount` bound (`step: 9007199254740991` fails at `propagation.reached.0.step`).
    - Tests that must pass: `timeline.test.ts`.
    - _Requirements: 14.1, 14.2, 14.4, 14.5, 14.7, 14.8, 14.9, 14.13_

  - [x] 9.9 Write property test for the cursor
    - In `core/model/timeline.test.ts`.
    - **Property 13: P-RULES-13 timeline cursor.** Moves leave old cursors unchanged, position stays in range, seek is exact, `cursorEffects` matches its definition, and a propagation Timeline holds each reached Node once at its step with ids `step-0 … step-<max>`.
    - **Validates: Requirements 14.3, 14.6, 14.7, 14.8, 14.9, 14.10, 14.12**

- [x] 10. AI adapter
  - [x] 10.1 Implement `core/model/ai-adapter.ts`
    - Export `Explanation`, `AIAdapter` (`explain(request): Promise<Explanation>`), and `createNoAiAdapter(table)`: validate the table, copy it into a `Map` of parsed Localized_Texts, and answer from it. `explain` checks the request inside `try`, resolves `null` for an invalid request or a missing topic, and resolves a fresh copy for a hit. The promise never rejects. No network call. No judgement function takes an AI_Adapter.
    - Design: AI_Adapter.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 10.2 Write example tests for `ai-adapter.ts`
    - In `core/model/ai-adapter.test.ts`: 15.2 (a hit returns the stored text), 15.3 (missing topic and blank `topic` resolve to `null`), 15.4 (same answer after other requests; changing a returned object does not change the next answer; `globalThis.fetch` stubbed to fail the test if called), 15.6 (blank key `""` gives path `table.`, a non-object table gives `table`, an entry without `en`), a table key `__proto__` found as an ordinary key, and a later change to the caller's table has no effect.
    - Tests that must pass: `ai-adapter.test.ts`.
    - _Requirements: 15.2, 15.3, 15.4, 15.6_

- [x] 11. Cross-file properties
  - [x] 11.1 Write property test for determinism of the whole pipeline
    - In `core/model/effects.test.ts` (the pipeline ends there).
    - **Property 1: P-RULES-1 same input → same result.** Run `evaluateCheckSets`, `evaluateNodeRules`, `findReachable`, `findPath`, `propagate`, `sumAttribute`, `checkSeriesList`, `buildEffects`, `timelineFromPropagation`, `timelineFromZones` twice, the second time on `structuredClone` copies, and compare with `toStrictEqual`; every argument stays `jsonEqual` to its copy.
    - **Validates: Requirements 3.2, 4.9, 5.4, 6.6, 7.4, 8.3, 13.2, 16.2, 16.6**

  - [x] 11.2 Write property test for fields the engine reads
    - In `core/model/conditions.test.ts`.
    - **Property 16: P-RULES-16 results depend only on the fields the engine reads.** Replacing `propagation` leaves the condition, node rule, reachability, and path results unchanged; changing unread Node, Edge, and Zone fields leaves every result of P-RULES-1 unchanged.
    - **Validates: Requirements 2.6, 3.7**

  - [x] 11.3 Write property test for engine functions never throwing
    - In `core/model/rule-input.test.ts`.
    - **Property 17: P-RULES-17 engine functions never throw.** For each function of the "Public functions" table, arguments drawn independently from `fc.anything()` give `ok: true` with a `value`, or `ok: false` with a non-empty `errors` and no `value` key.
    - **Validates: Requirements 16.5**

  - [x] 11.4 Write example tests for argument handling
    - In `core/model/rule-input.test.ts`: one example test per public function. Each checks 16.8 (a bad value in each argument gives the documented prefix), 16.9 (every argument is checked before any result), and one light determinism assertion (the same call twice gives `toStrictEqual` results), so P-RULES-1 failures show earlier. Add the `scenario.` then `rules.` order of 16.4 and a case for 16.3.
    - Tests that must pass: `rule-input.test.ts`.
    - _Requirements: 16.3, 16.4, 16.8, 16.9_

- [x] 12. Decisions and lessons
  - [x] 12.1 Log the design decisions in `docs/decision-log.md`
    - Add one line each (`date | section | decision | reason`): AI_Adapter `explain` is asynchronous (D1); built Timeline step ids are `step-<index>` (D2); `stepsWithinCount` applies only to `timelineFromPropagation` arguments (D3); Rule_Definition file storage and Schema_Sensor coverage stay open (D4, decided before the App specs). D5 (Condition_Size limit of 10,000 beside the depth limit of 32; limit now in R-RULES-01.7, approved) is already logged: the requirements amendment is in `docs/decision-log.md` on 2026-11-15 ("R-RULES-01.7 and S-RULES-2 amended"), so do not add a line for it. Do not edit older lines.
    - Design: Open questions.
    - _Requirements: 1.7, 14.3, 14.4, 15.1_

  - [x] 12.2 Record fallbacks and lessons
    - If task 1.1 needed the getter return-type annotation or any hand-written type to resolve a Zod recursive-type circularity error, add one line to `docs/decision-log.md` with the fix used, and one line to `.kiro/steering/lessons.md` naming the Zod 4 getter pattern and its fix. Add one lessons line for each fallback taken in other tasks. If no fallback was taken, add no line and note that in the checkpoint report.
    - Design: Rule_Definition_Schema (notes per rule).
    - _Requirements: 1.1_

- [x] 13. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm test`, `npm run build`, `npm run check:build`. All exit 0. Ask the user if questions arise.

- [x] 14. Verification gate (human approves; the agent must not mark this done)
  - Scope: for this spec the gate is tests, sensors, the reviewer agent, and human approval. The deploy check on the public URL is deferred to the end of the whole `core` Unit (after `core-rules` and `core-view`), not done here, as in the `core-graph` gate.
  - **[Agent]** Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:sections`, `npm run check:schema`, `npm run build`, `npm run check:build`; report each result and report test counts (test files, tests passed, and how many of them are property tests).
  - **[Agent]** Confirm the R-FND-10.15 name test (extended by `core-graph` task 10.1 to every file under `core/model/`) covers the new files with no further change, and report that. If it does not, extend `scripts/sensors/repo-rules.test.ts` and log one line in `docs/decision-log.md`.
  - **[Agent: reviewer]** Check requirement coverage (R-RULES-01 to 16 and P-RULES-1 to 17 (R-RULES-12 and P-RULES-11 are removed) each have a task and a test), the `core/model` boundary (R-GRAPH-10.1 to 10.4, no app names, no `three`, no `view` or `apps` imports), one schema and inferred types (01.1), no Edge_Type or Effect_Kind constants (02.5, 13.5), only the listed fields read (03.7), opaque check item ids (05.5), no defaults in Series_Settings (10.7), no time values in the Timeline (14.11), no AI_Adapter argument in judgement functions (15.5), no Scenario returned (16.7), safety (S-RULES-1 to S-RULES-6), and test placement. Report READY or NOT-READY with findings.
  - **[Human]** Short checklist before approving: P-RULES-1 to 17 (R-RULES-12 and P-RULES-11 are removed) all pass; every R-RULES requirement is covered by a task and a test; all sensors are green. Then approve the spec's result and add one line to `docs/decision-log.md` (date / Unit / what was checked / result).
  - _Requirements: 1.1, 2.5, 3.7, 5.5, 10.7, 13.5, 14.11, 15.5, 16.1, 16.7_

## Notes

- `core/model/arbitraries.ts` is touched by tasks 1.7, 7.1, 9.2, and 9.7, in that order. It is not matched by the Vitest `include` pattern.
- P-RULES-1 is scheduled last (task 11.1) because its pipeline ends in `timeline.ts`. P-RULES-16 sits in `conditions.test.ts` but needs `paths.ts`, so it is task 11.2.
- Task 9.2 and task 9.7 can wait for their consumers; they are placed just before the tests that use them.
- Real AI, Rule_Definition file storage (D4), the order-of-actions check (R-RULES-12, moved to the App spec), and rendering are out of scope here (`core-view` and the App specs).
- Failing sensors block acceptance of a change (tech.md), including during Vibe work.
- Waves are a guide for parallel work; the checkpoints are kept in task-number order (a checkpoint runs after the tasks it follows).
- No `tasks.meta.json` is created here; Kiro writes it when tasks are executed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["1.5", "3.1"] },
    { "id": 5, "tasks": ["1.6", "3.2"] },
    { "id": 6, "tasks": ["1.7", "3.3", "4.1"] },
    { "id": 7, "tasks": ["1.8", "4.2", "6.1", "7.1"] },
    { "id": 8, "tasks": ["1.9", "4.3", "6.2", "7.2"] },
    { "id": 9, "tasks": ["4.4", "6.3", "7.3", "9.1"] },
    { "id": 10, "tasks": ["4.5", "6.4", "7.4", "9.2"] },
    { "id": 11, "tasks": ["4.6", "6.5", "7.5", "9.3", "9.5"] },
    { "id": 12, "tasks": ["6.6", "7.6", "9.4", "9.6"] },
    { "id": 13, "tasks": ["6.7", "7.7", "9.7", "10.1"] },
    { "id": 14, "tasks": ["9.8", "10.2"] },
    { "id": 15, "tasks": ["9.9"] },
    { "id": 16, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 17, "tasks": ["11.4", "12.1"] },
    { "id": 18, "tasks": ["12.2"] }
  ]
}
```
