# Requirements Document

## Introduction

`core-rules` is the second of three specs that together make up the shared core of Unit 1 (intent.md 3.1, 3.2, 10.2, 10.6). The `core` spec is split into `core-graph`, `core-rules`, and `core-view` (decision-log 2026-11-15). This spec defines the Rule_Engine in `core/model/`: the pure functions that judge a Scenario defined by `core-graph`, and the plain data they return for later display.

In scope:
- Rule_Definitions: the plain data an App gives the core to say how its Scenarios are judged (intent.md 3.2: "Apps give the core only: scenario JSON, rule definitions, theme, and view settings"), and their schema validation.
- The Propagation_Policy: for each Edge_Type, whether it passes or stops automatic propagation, declared in the Rule_Definition (intent.md 3.1, ch. 8; decision-log 2026-11-12).
- Condition checks on the graph, including Check_Sets whose verdict is "every Condition holds" and the result of each Condition one by one (intent.md 3.1 `RuleEngine`; the motivating need is the precondition `check` of intent.md 4.7).
- Per-Node checks that find the Nodes for which a Condition holds (motivating need: intent.md 4.5, 4.6, a Node not linked to another kind of Node gets fog).
- Reachability and path search along directed Edges (intent.md 3.1, ch. 7 "rule checks (conditions and path search)").
- Automatic propagation from seed Nodes along Edges whose Edge_Type passes it, with an optional step limit (intent.md 3.1, 4.4, 4.6; the step limit is the fallback in intent.md ch. 7).
- Numeric aggregation of Numeric_Attributes: sums over a set of Nodes, and the change of a value along the Zone order, with shift and long-run detection whose thresholds are settings supplied by the App (intent.md 3.1, 3.2, 5.4, 5.5).
- The interface that passes judgement results to visual effects as Effect_Requests, plain data that `core-view` reads later (intent.md 3.1 "visual effects"; fog is Must, glow is Should).
- Timeline: an ordered list of steps and the pure functions that move through it (intent.md 3.1, ch. 7 "Timeline ordered playback"; decision-log 2026-11-15).
- AI_Adapter: the swap point for explanations, with a No_AI_Adapter that returns fixed text from judgement results (intent.md 3.1, ch. 0 rule 5; decision-log 2026-11-15). Real AI is Could and is not built here.

The Rule_Engine is generic. It gives no Node_Type, Edge_Type, attribute name, Identifier, or Effect_Kind a meaning of its own. Every such name reaches the Rule_Engine through a Rule_Definition, a setting, or a Scenario from an App. The core boundary rules of R-GRAPH-10 apply to every file of this spec under `core/model/` (R-GRAPH-10.8); they are referred to here, not repeated.

Out of scope for this spec, with the place each item belongs to:
- Node, Edge, Zone, Scenario I/O, schema validation of Scenarios, Edit_Commands, undo and redo: `core-graph` (R-GRAPH-01 to R-GRAPH-12). Removing an Edge or a Node is an Edit_Command of `core-graph`; this spec only judges the Scenario that results.
- Drawing fog, glow, or any other effect, animation and timing of Timeline playback, camera movement, walkthrough, ViewPreset (including its visibility filter by Zone), zoom detail layers, and Theme: `core-view`.
- Checking the order of a person's actions by before/after rules: the App spec (intent.md 4.6; decided at requirements approval).
- Score formulas and lookup tables, the content of each App's Rule_Definitions, and the texts shown to people: the App specs (intent.md 10.6).
- Computing numeric attributes from image pixels: `apps/` (intent.md 3.2).
- A real AI implementation of the AI_Adapter: Could (intent.md ch. 7), not built.
- An AI swap point for image analysis (intent.md 3.1, the tension estimate): App-side Could, not part of this spec.

## Glossary

Terms reused from `core-graph` (`.kiro/specs/core-graph/requirements.md`, Glossary) keep their meaning there: **App**, **App_Specific_Name**, **Repository**, **Graph_Model**, **Scenario**, **Scenario_Schema**, **Node**, **Node_Type**, **Edge**, **Edge_Type**, **Zone**, **Numeric_Attributes**, **Identifier**, **Localized_Text**, **Finite_Number**, **Positive_Integer**, **Validation_Error**, **Field_Path**, **Lint_Sensor**, **Schema_Sensor**, **Edit_Command**.

- **Rule_Engine**: the set of types and pure functions in `core/model/` defined by this spec.
- **Rule_Definition**: one plain data value supplied by an App that holds a `schemaVersion` (an integer greater than or equal to 1), an `id` (Identifier), a Propagation_Policy, and the optional lists `checkSets` (Check_Sets), `nodeRules` (Node_Rules), and `effectRules` (Effect_Rules).
- **Rule_Definition_Schema**: the single Zod schema in `core/model/` that defines a valid Rule_Definition.
- **Rule_Definition_Loader**: the pure function that takes any value and returns either a Rule_Definition or a non-empty list of Validation_Errors.
- **Rule_Failure**: the failure result of a Rule_Engine function: a non-empty list of Validation_Errors and no other result.
- **Propagation_Policy**: the part of a Rule_Definition with two lists of Edge_Types: `pass` (Passing_Edge_Types) and `stop` (Stopping_Edge_Types).
- **Passing_Edge_Type**: an Edge_Type listed in `pass`. Automatic propagation moves along an Edge of this type.
- **Stopping_Edge_Type**: an Edge_Type listed in `stop`. Automatic propagation does not move along an Edge of this type, and the Edge is reported as a Stopped_Edge.
- **Undeclared_Edge_Type**: an Edge_Type listed in neither `pass` nor `stop`.
- **Node_Selector**: a plain data value that picks Nodes of a Scenario by any combination of the fields `ids` (Identifiers), `types` (Node_Types), `zones` (Zone Identifiers), and `self` (the value `true`). A Node is picked when it matches every field given. A Node_Selector with no field picks every Node.
- **Self_Node**: the one Node that a Node_Rule is checking at the moment. Only a Node_Selector inside the Condition of a Node_Rule may use `self`.
- **Unresolved_Reference**: an Identifier named in a Node_Selector `ids` or `zones` field that names no Node or Zone of the Scenario.
- **Condition**: a plain data value that the Rule_Engine evaluates on a Scenario to `true` or `false`. Its kinds are listed in R-RULES-04.
- **Condition_Depth**: 1 for a Condition with no `all`, `any`, or `not`, plus 1 for each `all`, `any`, or `not` on the longest chain from the outermost Condition to an innermost one.
- **Condition_Size**: the number of Conditions in the expanded tree of a Condition, counting each place where a sub-Condition is listed separately (a Condition listed in two places counts twice).
- **Check_Set**: a named list with an `id` (Identifier) and an ordered list `items` of Check_Items. Its verdict is true when every Check_Item holds.
- **Check_Item**: an entry of a Check_Set with an `id` (Identifier) and a Condition.
- **Check_Result**: the result of evaluating one Check_Set: the Check_Set `id`, one entry per Check_Item, in list order, with its `id` and whether it holds, the verdict `allHold`, and the Unresolved_References.
- **Node_Rule**: an entry of a Rule_Definition with an `id` (Identifier), a Node_Selector of candidate Nodes, and a Condition evaluated once for each candidate as the Self_Node.
- **Node_Rule_Result**: the result of one Node_Rule: the Node_Rule `id`, the Identifiers of the candidate Nodes for which the Condition holds, in `nodes` list order, and the Unresolved_References.
- **Path**: a non-empty ordered list of Edges in which the `to` of each Edge equals the `from` of the next one.
- **Path_Search_Result**: the result of a Path search: either the list of Edge `id`s of a Path, from the start Node to the end Node, or "no path", together with the Unresolved_References.
- **Edge_Filter**: a plain data value with the optional lists `include` (Edge_Types allowed) and `exclude` (Edge_Types not allowed). An Edge passes the filter when its type is in `include` (or `include` is absent) and is not in `exclude`. An empty `include` list is accepted by the schema and lets no Edge pass.
- **Reachable_Set**: the set of Nodes that can be reached from a set of start Nodes by a Path whose Edges all pass an Edge_Filter, followed from `from` to `to`. The result of computing a Reachable_Set also holds the Unresolved_References of the start Node_Selector.
- **Seed_Nodes**: the Nodes picked by a Node_Selector as the start of automatic propagation.
- **Propagation_Result**: the result of automatic propagation: the reached Nodes, each with its step number and the Edge it was reached by (none for Seed_Nodes); the traversed Edges; the Stopped_Edges; and the Unresolved_References.
- **Step_Number**: the number of Edges on the shortest Path made only of Edges of Passing_Edge_Types from a Seed_Node to a reached Node. Seed_Nodes have Step_Number 0.
- **Stopped_Edge**: an Edge of a Stopping_Edge_Type whose `from` is a reached Node.
- **Max_Steps**: an optional integer setting of automatic propagation, greater than or equal to 0, that limits the Step_Number of reached Nodes.
- **Sum_Result**: the result of summing one attribute name over a set of Nodes: the sum, the number of Nodes that hold that attribute, and the Unresolved_References.
- **Series_Settings**: a plain data value supplied by an App for one attribute name: `attribute` (Identifier), `zoneValue` (`sum` or `mean`), `shiftThreshold` (Finite_Number ≥ 0), `direction` (`up`, `down`, or `both`), `runTolerance` (Finite_Number ≥ 0), and `minRunLength` (integer ≥ 2).
- **Zone_Series**: the ordered list of Zone_Values of one attribute name, one per Zone that has a value, in ascending Zone `order`.
- **Zone_Value**: the value of one attribute name for one Zone: the sum or the mean (by `zoneValue`) of that attribute over the Nodes whose `zone` is that Zone and that hold that attribute.
- **Step_Change**: the difference `later value − earlier value` between two neighbouring entries of a Zone_Series.
- **Shift**: a Step_Change whose size is greater than `shiftThreshold` in the direction given by `direction`. It is reported at the later Zone of the two.
- **Intentional_Mark**: a Zone Identifier supplied by the App that marks a Shift arriving at that Zone as intended.
- **Long_Run**: a maximal run of neighbouring entries of a Zone_Series in which every Step_Change has a size at most `runTolerance`, and whose length (number of Zones) is at least `minRunLength`.
- **Series_Result**: the Zone_Series, the Step_Changes, the Shifts (each with an `intentional` flag), the Long_Runs, and the Unresolved_References for one Series_Settings value.
- **Effect_Kind**: an Identifier that names a visual effect (for example `fog` or `glow`). The Rule_Engine gives it no meaning; `core-view` decides which kinds it draws.
- **Effect_Target**: a reference `{ kind, id }` where `kind` is `node`, `edge`, or `zone` and `id` is the Identifier of an element of that list.
- **Effect_Rule**: an entry of a Rule_Definition with an `id`, an Effect_Kind, and a source that names one judgement result: a Node_Rule by `id`, the Shifts or the Long_Runs of an attribute name, or the reached Nodes and traversed Edges of automatic propagation.
- **Effect_Request**: a plain data value `{ effect, target, source }`: an Effect_Kind, an Effect_Target, and the `id` of the Effect_Rule that produced it.
- **Timeline**: a plain data value holding an ordered, non-empty list of Timeline_Steps.
- **Timeline_Step**: one entry of a Timeline with an `id` (Identifier), an optional `label` (Localized_Text), a list of Effect_Targets (`targets`), and a list of Effect_Requests (`effects`).
- **Timeline_Cursor**: a plain data value holding a Timeline and a zero-based `position` within it.
- **AI_Adapter**: the interface through which an explanation is asked for one judgement result. Its input is an Explanation_Request and its output is a Localized_Text or "no explanation".
- **Explanation_Request**: a plain data value with a `topic` (Identifier) that names a judgement result, for example the `id` of a Check_Item and whether it holds. The App builds the `topic`.
- **Explanation_Table**: a plain data value supplied by the App that maps `topic` values to Localized_Text.
- **No_AI_Adapter**: the AI_Adapter implementation in `core/model/` that uses no AI and answers from an Explanation_Table.

## Requirements

### Requirement 1: Rule definitions and their validation (R-RULES-01)

**User Story:** As an App developer, I want to hand the core one plain rule definition that is checked before use, so that a broken rule definition never produces a judgement.

#### Acceptance Criteria

1. THE Rule_Engine SHALL define the Rule_Definition_Schema exactly once, in a file under `core/model/`, and THE TypeScript types for Rule_Definition, Propagation_Policy, Node_Selector, Edge_Filter, Condition, Check_Set, Check_Item, Node_Rule, Effect_Rule, Series_Settings, Effect_Request, and Timeline SHALL be inferred from Zod schemas in `core/model/`, as in R-GRAPH-09.6. Localized_Text and Identifier SHALL reuse the schemas of `core/model/scenario-schema.ts` and SHALL not be defined a second time (R-GRAPH-09.1). The reviewer agent checks this before each gate.
2. WHEN the Rule_Definition_Loader receives a value that matches the Rule_Definition_Schema, THE Rule_Definition_Loader SHALL return that Rule_Definition with unknown fields removed at every level of nesting, as in R-GRAPH-06.2.
3. IF the Rule_Definition_Loader receives a value that does not match the Rule_Definition_Schema, THEN THE Rule_Definition_Loader SHALL return every Validation_Error, each with a Field_Path that names the failing field relative to the Rule_Definition (for example `checkSets.0.items.2.condition.min`) and an English message, and no Rule_Definition. The Field_Paths in R-RULES-01 and R-RULES-02 are relative to the Rule_Definition, because the Rule_Definition is the Rule_Definition_Loader's own input; when a Rule_Engine function receives an invalid Rule_Definition, the same paths get the prefix `rules.` (R-RULES-16.4). The errors SHALL come in the same order on every call with a deeply equal value.
4. IF two or more entries of the same list in a Rule_Definition (`checkSets`, the `items` of one Check_Set, `nodeRules`, or `effectRules`) have `id` values that are equal character for character, THEN THE Rule_Definition_Loader SHALL report one Validation_Error for each entry after the first one with that `id`, with the Field_Path `<list path>.<index>.id`. The same `id` in two different lists SHALL be accepted, as in R-GRAPH-06.3.
5. IF an Effect_Rule names a Node_Rule `id` that equals the `id` of no Node_Rule in the same Rule_Definition, THEN THE Rule_Definition_Loader SHALL report a Validation_Error whose Field_Path names that field of the Effect_Rule.
6. IF a Node_Selector gives `self` with a value other than `true`, or gives `self` anywhere other than inside the Condition of a Node_Rule (including in the candidate Node_Selector of that Node_Rule and in any Check_Item Condition), THEN THE Rule_Definition_Loader SHALL report a Validation_Error whose Field_Path names that `self` field.
7. IF a Condition has a Condition_Depth greater than 32, THEN THE Rule_Definition_Loader SHALL report exactly one Validation_Error for that Condition, with the Field_Path of the outermost Condition (the `condition` of the Check_Item or Node_Rule) that holds it, and SHALL return the result without exhausting the call stack (S-RULES-2). A Condition SHALL also be rejected in the same way, with exactly one Validation_Error at the Field_Path of the outermost Condition, when its Condition_Size is more than 10,000; a Condition of depth 32 whose Condition_Size is at most 10,000 SHALL be accepted. This SHALL also hold for a Condition nested 10,000 levels deep and for an in-memory Condition that contains itself.
8. THE Rule_Definition_Loader SHALL return a result for every input value without throwing an exception, and SHALL evaluate no part of its input as code (S-RULES-2).
9. THE Rule_Definition_Schema SHALL accept any Identifier as a Node_Type, Edge_Type, attribute name, Effect_Kind, or `id`, and SHALL contain no list of allowed values for any of them (R-GRAPH-10.3).

### Requirement 2: Propagation policy by Edge_Type (R-RULES-02)

**User Story:** As an App developer, I want to declare in my rule definition which Edge_Types pass and which stop automatic propagation, so that the core stays generic and my App decides what each connection means.

#### Acceptance Criteria

1. THE Rule_Definition_Schema SHALL require a Propagation_Policy with the lists `pass` and `stop`, each holding zero or more Edge_Types, and SHALL accept both lists when empty. An Edge_Type listed twice in the same list SHALL be accepted and SHALL have the same effect as listing it once.
2. IF an Edge_Type is listed in both `pass` and `stop`, THEN THE Rule_Definition_Loader SHALL report a Validation_Error whose Field_Path is `propagation.stop.<index>` for that entry of `stop`.
3. THE Rule_Engine SHALL move automatic propagation only along Edges whose Edge_Type is a Passing_Edge_Type.
4. THE Rule_Engine SHALL treat an Undeclared_Edge_Type like a Stopping_Edge_Type for automatic propagation, and SHALL report no Edge of an Undeclared_Edge_Type as a Stopped_Edge.
5. THE Rule_Engine SHALL contain no Edge_Type in any constant, default value, enum, or union of literal types. It SHALL compare an Edge's `type` only with Edge_Types taken from the Rule_Definition or from an Edge_Filter given by the caller, and SHALL take every Passing_Edge_Type and Stopping_Edge_Type from the Rule_Definition (R-GRAPH-04.5, R-GRAPH-10.3).
6. THE Propagation_Policy SHALL change automatic propagation only. Condition checks, Check_Sets, Node_Rules, reachability, and path search SHALL use their own Edge_Filter and SHALL ignore the Propagation_Policy, so that their results stay deeply equal when only the Propagation_Policy of the Rule_Definition changes.

### Requirement 3: Node selectors (R-RULES-03)

**User Story:** As an App developer, I want one generic way to pick Nodes by id, type, or Zone, so that every rule can name the Nodes it is about without core code for my App.

#### Acceptance Criteria

1. WHEN the Rule_Engine applies a Node_Selector to a Scenario, THE Rule_Engine SHALL pick each Node that matches every field the Node_Selector gives: its `id` is in `ids`, its `type` is in `types`, its `zone` is in `zones`, and, when `self` is given, it is the Self_Node.
2. THE Rule_Engine SHALL return the picked Nodes in the order of the `nodes` list of the Scenario, each Node at most once.
3. WHEN a Node_Selector has no field, THE Rule_Engine SHALL pick every Node of the Scenario.
4. WHEN a Node_Selector gives `zones`, THE Rule_Engine SHALL pick no Node that has no `zone` field.
5. IF an Identifier in `ids` names no Node, or an Identifier in `zones` names no Zone, of the Scenario, THEN THE Rule_Engine SHALL pick no Node for that Identifier, SHALL return no Rule_Failure for it, and SHALL add it to the Unresolved_References of the result. Each Unresolved_Reference SHALL appear once, in code point order. It SHALL be added whether or not the enclosing Condition needs that Node_Selector to decide its result (for example, the second Condition of an `any` whose first Condition is `true`).
6. THE Rule_Engine SHALL compare every Identifier exactly, character for character, with no trimming, case folding, or Unicode normalization (R-GRAPH-06.12).
7. THE Rule_Engine SHALL read from a Node only `id`, `type`, `zone`, and `attributes`, and from an Edge only `id`, `from`, `to`, and `type`, and from a Zone only `id` and `order`. No judgement SHALL depend on `position`, `rotation`, `scale`, a Face, a `label`, Metadata, `elevation`, or `enclosed` (R-GRAPH-01.8).
8. WHEN a Node_Selector gives `ids`, `types`, or `zones` as an empty list, THE Rule_Engine SHALL pick no Node and SHALL return no Rule_Failure for it.

### Requirement 4: Conditions (R-RULES-04)

**User Story:** As an App developer, I want a small set of generic Condition kinds that I can combine, so that my App's rule checks are data and not core code.

#### Acceptance Criteria

1. THE Rule_Engine SHALL define exactly the Condition kinds `edgeCount`, `reach`, `attribute`, `all`, `any`, and `not`, each as plain data with a `kind` field, and SHALL name no Condition kind after an App concept. IF a Condition has any other `kind` value, THEN THE Rule_Definition_Loader SHALL report a Validation_Error whose Field_Path names that `kind` field.
2. WHEN the Rule_Engine evaluates an `edgeCount` Condition (fields: an Edge_Filter, a `from` Node_Selector, a `to` Node_Selector, an optional `min`, and an optional `max`, each an integer ≥ 0), THE Rule_Engine SHALL count the Edges that pass the Edge_Filter whose `from` Node is picked by `from` and whose `to` Node is picked by `to`, and SHALL return `true` exactly when the count is at least `min` (when given) and at most `max` (when given). Each Edge SHALL count once, a self-loop included, and two Edges with equal `from`, `to`, and `type` SHALL count as two.
3. WHEN the Rule_Engine evaluates a `reach` Condition (fields: a `from` Node_Selector, a `to` Node_Selector, and an Edge_Filter), THE Rule_Engine SHALL return `true` exactly when a Path of one or more Edges, all passing the Edge_Filter, leads from a Node picked by `from` to a Node picked by `to`. It SHALL return `false` when `from` or `to` picks no Node.
4. WHEN the Rule_Engine evaluates an `attribute` Condition (fields: a Node_Selector, an attribute name, an optional `min`, and an optional `max`, each a Finite_Number), THE Rule_Engine SHALL compute the Sum_Result of that attribute over the picked Nodes (R-RULES-09) and SHALL return `true` exactly when the sum is at least `min` (when given) and at most `max` (when given). When no picked Node holds the attribute, the sum 0 (R-RULES-09.3) SHALL be compared with `min` and `max`.
5. WHEN the Rule_Engine evaluates an `all` Condition and no part of the call produces a Rule_Failure (criterion 10), THE Rule_Engine SHALL return `true` exactly when every Condition in its list is `true`, and SHALL return `true` for an empty list.
6. WHEN the Rule_Engine evaluates an `any` Condition and no part of the call produces a Rule_Failure (criterion 10), THE Rule_Engine SHALL return `true` exactly when at least one Condition in its list is `true`, and SHALL return `false` for an empty list.
7. WHEN the Rule_Engine evaluates a `not` Condition, THE Rule_Engine SHALL return the opposite of its one inner Condition.
8. IF an `edgeCount` or `attribute` Condition gives neither `min` nor `max`, or gives a `min` greater than its `max`, THEN THE Rule_Definition_Loader SHALL report a Validation_Error whose Field_Path names that Condition. A `min` equal to `max` SHALL be accepted.
9. WHEN the Rule_Engine evaluates a Condition on a Scenario that has cycles, self-loops, or repeated Edges, THE Rule_Engine SHALL finish the evaluation and SHALL return the same `true` or `false` on every call with deeply equal arguments.
10. IF any part of a call produces a Rule_Failure (for example an `attribute` Condition whose Sum_Result is a Rule_Failure by R-RULES-09.4, in any Check_Item, for any candidate Node of a Node_Rule, or in any branch of `all`, `any`, or `not`, whether or not short-circuit evaluation would skip that branch), THEN THE Rule_Engine SHALL return a Rule_Failure for the whole call and no partial result (no `true` or `false`, no Check_Result, and no Node_Rule_Result). Each Validation_Error SHALL have a Field_Path that names that Condition, with the prefix of R-RULES-16.8 (for example `rules.checkSets.0.items.2.condition`).

### Requirement 5: Check sets (R-RULES-05)

**User Story:** As an App developer, I want to evaluate a named list of Conditions and see which ones hold, so that a person can see which item to break to change the verdict (motivating need: intent.md 4.7).

#### Acceptance Criteria

1. WHEN the Rule_Engine evaluates a Check_Set on a Scenario, THE Rule_Engine SHALL return a Check_Result with one entry per Check_Item, in the order of the Check_Set, holding the Check_Item `id` and whether its Condition holds.
2. THE Rule_Engine SHALL set `allHold` of a Check_Result to `true` exactly when every Check_Item holds, and to `true` for a Check_Set with no Check_Items.
3. WHILE no Check_Item produces a Rule_Failure, THE Rule_Engine SHALL evaluate each Check_Item independently, so that the `true` or `false` result of one Check_Item does not depend on the other Check_Items or on their order. A Rule_Failure in any Check_Item makes the whole call a Rule_Failure (R-RULES-04.10).
4. THE Check_Result SHALL hold the Unresolved_References of every Node_Selector in every Condition of the Check_Set, as in R-RULES-03.5.
5. THE Rule_Engine SHALL treat a Check_Item `id` as an opaque Identifier and SHALL attach no display text to it. Texts shown to a person belong to the App.
6. WHEN the Rule_Engine evaluates the Check_Sets of a Rule_Definition, THE Rule_Engine SHALL return one Check_Result per Check_Set, in the order of `checkSets`, each holding the `id` of its Check_Set. THE Rule_Engine SHALL return an empty list when `checkSets` is absent or empty.
7. IF evaluating any Check_Set of the call produces a Rule_Failure, THEN THE Rule_Engine SHALL return a Rule_Failure and no Check_Result, as in R-RULES-04.10.

### Requirement 6: Node rules (R-RULES-06)

**User Story:** As an App developer, I want to find every Node for which a Condition about that Node holds, so that the App can mark those Nodes (motivating need: intent.md 4.5, 4.6).

#### Acceptance Criteria

1. WHEN the Rule_Engine evaluates a Node_Rule on a Scenario, THE Rule_Engine SHALL evaluate its Condition once for each candidate Node picked by the Node_Rule's Node_Selector, with that candidate as the Self_Node.
2. THE Rule_Engine SHALL return a Node_Rule_Result holding the `id` of each candidate Node for which the Condition holds, in the order of the `nodes` list, each at most once.
3. WHEN the candidate Node_Selector of a Node_Rule picks no Node, THE Rule_Engine SHALL return a Node_Rule_Result with an empty list of Nodes.
4. WHEN the Rule_Engine evaluates the Node_Rules of a Rule_Definition, THE Rule_Engine SHALL return one Node_Rule_Result per Node_Rule, in the order of `nodeRules`, each holding the `id` of its Node_Rule. THE Rule_Engine SHALL return an empty list when `nodeRules` is absent or empty.
5. IF the candidate Node_Selector of a Node_Rule uses `self`, THEN THE Rule_Definition_Loader SHALL report a Validation_Error as in R-RULES-01.6.
6. THE Node_Rule_Result SHALL hold the Unresolved_References of the candidate Node_Selector and of every Node_Selector in the Condition, as in R-RULES-03.5, also when no candidate Node is picked.
7. IF evaluating the Condition for any candidate Node of any Node_Rule of the call produces a Rule_Failure, THEN THE Rule_Engine SHALL return a Rule_Failure and no Node_Rule_Result, as in R-RULES-04.10.

### Requirement 7: Reachability and path search (R-RULES-07)

**User Story:** As an App developer, I want to ask which Nodes can be reached and by which Path, so that the App can show how one Node connects to another.

#### Acceptance Criteria

1. WHEN the Rule_Engine computes a Reachable_Set from start Nodes picked by a Node_Selector with an Edge_Filter, THE Rule_Engine SHALL return the Identifiers of every Node reachable by a Path of one or more Edges that pass the Edge_Filter, following each Edge from `from` to `to` only, in the order of the `nodes` list. THE Rule_Engine SHALL also return the Unresolved_References of the start Node_Selector, as in R-RULES-03.5.
2. THE Rule_Engine SHALL include a start Node in the Reachable_Set only when a Path of one or more Edges leads back to it.
3. WHEN the Rule_Engine searches a Path from a start Node Identifier to an end Node Identifier with an Edge_Filter, THE Rule_Engine SHALL return either "no path", when no such Path exists, or a Path with the fewest Edges among the Paths whose Edges all pass the Edge_Filter. A returned Path SHALL be the list of its Edge `id`s from the start Node to the end Node.
4. WHEN two or more Paths have the fewest Edges, THE Rule_Engine SHALL return the Path picked by the visiting order of R-RULES-08.3, starting from the start Node alone and using only Edges that pass the Edge_Filter. The Path ends with the first visited Edge whose `to` is the end Node. Each earlier Edge is the Edge by which the `from` Node of the next Edge was first reached. This way the same input always gives the same Path.
5. IF the start Node or the end Node of a Path search names no Node of the Scenario, THEN THE Rule_Engine SHALL return "no path" and add that Identifier to the Unresolved_References, as in R-RULES-03.5.
6. THE Rule_Engine SHALL finish reachability and path search on a Scenario with cycles and self-loops, and SHALL include each Node at most once in a Reachable_Set.
7. WHEN the start Node and the end Node of a Path search are the same Node, THE Rule_Engine SHALL return a Path of one or more Edges that leaves that Node and leads back to it with the fewest Edges, chosen as in criterion 4. If no such Path exists, THE Rule_Engine SHALL return "no path". THE Rule_Engine SHALL never return an empty Path.

### Requirement 8: Automatic propagation (R-RULES-08)

**User Story:** As an App developer, I want the core to spread an effect from seed Nodes along the Edges my rules let pass, and to report where it stopped, so that the App can show how far an effect reaches and where it is held back (motivating need: intent.md 4.4, 4.6).

#### Acceptance Criteria

1. WHEN the Rule_Engine runs automatic propagation on a Scenario with a Rule_Definition and a Node_Selector for the Seed_Nodes, THE Rule_Engine SHALL return a Propagation_Result whose reached Nodes are the Seed_Nodes plus every Node reachable from a Seed_Node by a Path made only of Edges of Passing_Edge_Types.
2. THE Rule_Engine SHALL give each reached Node its Step_Number and the `id` of the Edge it was first reached by, and SHALL give Seed_Nodes Step_Number 0 and no Edge.
3. THE Rule_Engine SHALL list the reached Nodes by ascending Step_Number. Seed_Nodes SHALL come in the order of the `nodes` list. The Nodes with Step_Number k + 1 SHALL come in the order they are first reached when the Nodes with Step_Number k are visited in their listed order and the outgoing Edges of each Node are visited in the order of the `edges` list. Each Node SHALL appear at most once.
4. THE Propagation_Result SHALL list as traversed Edges exactly the Edges by which a non-seed Node was first reached, in the order of the reached Nodes.
5. THE Propagation_Result SHALL list as Stopped_Edges every Edge of a Stopping_Edge_Type whose `from` is a reached Node (within Max_Steps), in the order of the `edges` list, each at most once, whether or not its `to` Node is reached by another Path.
6. WHERE a Max_Steps value is given, THE Rule_Engine SHALL reach only Nodes whose Step_Number is at most Max_Steps; with Max_Steps 0 the reached Nodes SHALL be the Seed_Nodes only. An Edge of a Passing_Edge_Type whose `from` Node has Step_Number equal to Max_Steps SHALL be neither a traversed Edge nor a Stopped_Edge. With Max_Steps k, the Stopped_Edges SHALL be exactly the Edges of a Stopping_Edge_Type whose `from` Node is reached with Step_Number at most k.
7. IF a Max_Steps value is given that is not an integer greater than or equal to 0, THEN THE Rule_Engine SHALL return a Rule_Failure with the Field_Path `maxSteps`.
8. WHEN the Node_Selector for the Seed_Nodes picks no Node, THE Rule_Engine SHALL return a Propagation_Result with no reached Node, no traversed Edge, and no Stopped_Edge.
9. THE Rule_Engine SHALL finish automatic propagation on a Scenario with cycles and self-loops.
10. THE Propagation_Result SHALL hold the Unresolved_References of the Seed_Node Node_Selector, as in R-RULES-03.5.

### Requirement 9: Sums of numeric attributes (R-RULES-09)

**User Story:** As an App developer, I want the core to sum one numeric attribute over a set of Nodes, so that the App can compute totals from the numbers it stores on Nodes.

#### Acceptance Criteria

1. WHEN the Rule_Engine sums an attribute name over the Nodes picked by a Node_Selector, THE Rule_Engine SHALL return a Sum_Result holding the sum of that attribute's values over the picked Nodes that hold it, added in the order of the `nodes` list, and the number of those Nodes.
2. WHEN a picked Node does not hold the attribute name, THE Rule_Engine SHALL add nothing to the sum for that Node and SHALL not count that Node, so that a missing attribute is never treated as the value 0.
3. WHEN no picked Node holds the attribute name, including when the Node_Selector picks no Node, THE Rule_Engine SHALL return a Sum_Result with sum 0 and count 0.
4. IF the final sum is not a Finite_Number (Infinity, -Infinity, or NaN), THEN THE Rule_Engine SHALL return a Rule_Failure holding one Validation_Error whose message names the attribute name and whose Field_Path names the field that gave the attribute name (with the prefix of R-RULES-16.8), and no Sum_Result. A Rule_Engine call that needs that Sum_Result, including the evaluation of an `attribute` Condition, SHALL return a Rule_Failure for the whole call as in R-RULES-04.10.
5. THE Rule_Engine SHALL compare attribute names exactly, character for character (R-GRAPH-02.6).
6. WHEN the Node_Selector of a sum names Unresolved_References, THE Rule_Engine SHALL return them with the Sum_Result, as in R-RULES-03.5, and SHALL compute the sum and count from the Nodes that were picked.

### Requirement 10: Change along the Zone order (R-RULES-10)

**User Story:** As an App developer, I want the core to turn per-Zone numbers into an ordered series, so that the App can show how a value changes from the first Zone to the last (motivating need: intent.md 5.4, 5.5).

#### Acceptance Criteria

1. WHEN the Rule_Engine builds a Zone_Series for Series_Settings, THE Rule_Engine SHALL compute one Zone_Value per Zone that has at least one Node holding the attribute name, by `zoneValue`: `sum` is the Sum_Result of the Zone's Nodes, and `mean` is that sum divided by the count. Each Zone_Series entry SHALL hold the Zone Identifier and its Zone_Value.
2. THE Rule_Engine SHALL order the Zone_Series by ascending Zone `order` (R-GRAPH-05.2, R-GRAPH-06.10), and SHALL leave out every Zone with no Node holding the attribute name. WHEN no Zone has a Node holding the attribute name, including when the Scenario has no Zone, THE Rule_Engine SHALL return an empty Zone_Series and no Rule_Failure.
3. THE Rule_Engine SHALL compute one Step_Change for each pair of neighbouring entries of the Zone_Series as `later value − earlier value`, so a Zone_Series of n entries has `max(n − 1, 0)` Step_Changes.
4. THE Rule_Engine SHALL ignore Nodes that have no `zone` field when building a Zone_Series.
5. IF a Zone_Value or a Step_Change is not a Finite_Number, THEN THE Rule_Engine SHALL return a Rule_Failure holding one Validation_Error per such value, whose message names the attribute name and the Zone Identifier (for a Zone_Value, its Zone; for a Step_Change, its later Zone) and whose Field_Path is `settings.<index>.attribute` (or `settings.attribute` for a single Series_Settings value), and no Series_Result.
6. IF a Series_Settings value breaks the ranges in the Glossary (for example a negative `shiftThreshold`, a `minRunLength` of 1 or a non-integer `minRunLength`, a `direction` other than `up`, `down`, or `both`, a `zoneValue` other than `sum` or `mean`, an `attribute` that is not an Identifier, or a missing field), THEN THE Rule_Engine SHALL return a Rule_Failure with one Validation_Error per failing field, whose Field_Path is `settings.<index>.<field>` when the Series_Settings value is part of a list (R-RULES-11.8) and `settings.<field>` otherwise, and SHALL return no Series_Result for any Series_Settings value of that call.
7. THE Rule_Engine SHALL take every threshold, tolerance, and run length from the Series_Settings given by the App, and SHALL contain no default value for any of them.

### Requirement 11: Shift and long-run detection (R-RULES-11)

**User Story:** As an App developer, I want the core to find sudden changes and long unchanged stretches in a Zone_Series, so that the App can warn about them and let the author mark intended changes (motivating need: intent.md 5.4, 5.5).

#### Acceptance Criteria

1. WHEN the Rule_Engine checks a Zone_Series with Series_Settings whose `direction` is `up`, THE Rule_Engine SHALL report a Shift for each Step_Change greater than `shiftThreshold`.
2. WHEN the Rule_Engine checks a Zone_Series with Series_Settings whose `direction` is `down`, THE Rule_Engine SHALL report a Shift for each Step_Change less than `−shiftThreshold`.
3. WHEN the Rule_Engine checks a Zone_Series with Series_Settings whose `direction` is `both`, THE Rule_Engine SHALL report a Shift for each Step_Change whose absolute value is greater than `shiftThreshold`. A Step_Change equal to `shiftThreshold` (or to `−shiftThreshold`) SHALL never be a Shift, for any `direction`.
4. THE Rule_Engine SHALL report each Shift with the Identifier of the earlier Zone, the Identifier of the later Zone, and the Step_Change, in Zone_Series order.
5. WHEN the Rule_Engine reports a Shift whose later Zone is listed in the Intentional_Marks given by the App, THE Rule_Engine SHALL report that Shift with `intentional` set to `true`; every other Shift SHALL have `intentional` set to `false`. Intentional_Marks SHALL change no Step_Change, no Long_Run, and no other field of the Series_Result.
6. THE Rule_Engine SHALL report each Long_Run as the ordered list of its Zone Identifiers, in Zone_Series order, and SHALL list the Long_Runs in Zone_Series order of their first Zone. Long_Runs SHALL not overlap, and each SHALL hold at least `minRunLength` Zones. THE Rule_Engine SHALL find Shifts and Long_Runs independently, so that one Step_Change can be both part of a Long_Run and a Shift.
7. IF an Intentional_Mark names no Zone of the Scenario, THEN THE Rule_Engine SHALL return no Rule_Failure for it and SHALL add it to the Unresolved_References of the Series_Result, as in R-RULES-03.5. An Intentional_Mark that names a Zone of the Scenario but no later Zone of a Shift, or that is repeated, SHALL change no result and SHALL not be an Unresolved_Reference.
8. WHEN the Rule_Engine checks a Scenario with a list of Series_Settings and one list of Intentional_Marks given by the App, THE Rule_Engine SHALL return one Series_Result per Series_Settings value, in list order, apply the same Intentional_Marks to each, and return for each Series_Settings value the same Series_Result it would return if it were the only entry of the list. An empty list SHALL give an empty list of Series_Results.
9. IF two or more Series_Settings values in one list have equal `attribute` values, THEN THE Rule_Engine SHALL return a Rule_Failure with one Validation_Error for each such value after the first one, with the Field_Path `settings.<index>.attribute`, and no Series_Result.

### Requirement 12: (removed) (R-RULES-12)

**User Story:** (removed) Moved to the App spec at requirements approval: checking the order of a person's actions by before/after rules belongs to the App (intent.md 4.6). The ID is kept so that later IDs do not shift.

#### Acceptance Criteria

1. THE Rule_Engine SHALL leave checks of the order of a person's actions to the App spec (intent.md 4.6).

### Requirement 13: Effect requests (R-RULES-13)

**User Story:** As an App developer, I want judgement results turned into plain effect requests, so that `core-view` can draw fog or glow later without knowing my rules.

#### Acceptance Criteria

1. WHEN the Rule_Engine turns judgement results into Effect_Requests with the Effect_Rules of a Rule_Definition, THE Rule_Engine SHALL produce for each Effect_Rule, with that Effect_Rule's Effect_Kind as `effect` and its `id` as `source`, one of the following: for a Node_Rule source, one Effect_Request with target `kind` `node` per Node of the Node_Rule_Result of the Node_Rule with that `id` (R-RULES-06.4); for a Shift source, one Effect_Request with target `kind` `zone` per later Zone of each Shift with `intentional` `false`, taken from the Series_Result whose Series_Settings `attribute` equals the named attribute name (unique by R-RULES-11.9); for a Long_Run source, one Effect_Request with target `kind` `zone` per Zone of each Long_Run, taken from the same Series_Result; or for a propagation source, one Effect_Request with target `kind` `node` per reached Node and one with target `kind` `edge` per traversed Edge of the Propagation_Result.
2. THE Rule_Engine SHALL return the Effect_Requests sorted by Effect_Kind, then target `kind`, then target `id`, then `source`, each in code point order, with no two Effect_Requests deeply equal.
3. IF a judgement result names a Node, Edge, or Zone Identifier that names no element of the given Scenario, THEN THE Rule_Engine SHALL produce no Effect_Request for that Identifier, SHALL return no Rule_Failure for it, and SHALL still return the Effect_Requests for every other target.
4. THE Effect_Request SHALL be plain data that holds no function, no three.js object, no color, and no drawing parameter. How an Effect_Kind looks is decided by `core-view` and the Theme.
5. THE Rule_Engine SHALL contain no Effect_Kind in any constant, default value, or allowed-value list, and SHALL take every Effect_Kind from the Rule_Definition.
6. IF an Effect_Rule names judgement results that were not given (for example a Propagation_Result when propagation did not run, or an attribute name with no Series_Result), THEN THE Rule_Engine SHALL produce no Effect_Request for that Effect_Rule, SHALL return no Rule_Failure, and SHALL still return the Effect_Requests of every other Effect_Rule.
7. WHEN the Rule_Definition has no `effectRules`, or every Effect_Rule produces no Effect_Request, THE Rule_Engine SHALL return an empty list of Effect_Requests.

### Requirement 14: Timeline (R-RULES-14)

**User Story:** As an App developer, I want an ordered list of steps that I can move through one step at a time, so that changes can be replayed in order (intent.md 3.1).

#### Acceptance Criteria

1. THE Rule_Engine SHALL create a Timeline from a non-empty list of Timeline_Steps given by the caller, and SHALL keep the steps in the given order.
2. IF the list of Timeline_Steps is empty, a Timeline_Step does not match the Timeline_Step schema, or two Timeline_Steps have equal `id` values, THEN THE Rule_Engine SHALL return a Rule_Failure and no Timeline, holding one Validation_Error with the Field_Path `steps` for an empty list, one Validation_Error whose Field_Path starts with `steps.<index>` for each failing field of a Timeline_Step, and one Validation_Error with the Field_Path `steps.<index>.id` for each Timeline_Step after the first one with that `id`.
3. WHEN the Rule_Engine builds a Timeline from a Propagation_Result that has at least one reached Node, THE Rule_Engine SHALL create one Timeline_Step per Step_Number from 0 to the largest Step_Number, in ascending Step_Number, each with a distinct `id` (format decided in design.md), no `label`, an empty `effects` list, and `targets` that list first the Nodes reached at that Step_Number in Propagation_Result order and then the Edges by which those Nodes were reached in the same order. The step for Step_Number 0 SHALL hold the Seed_Nodes and no Edge.
4. WHEN the Rule_Engine builds a Timeline from the Zones of a Scenario that has at least one Zone, THE Rule_Engine SHALL create one Timeline_Step per Zone in ascending Zone `order`, each with a distinct `id` (format decided in design.md), no `label`, an empty `effects` list, and `targets` holding only that Zone.
5. IF the Scenario has no Zone when a Timeline is built from Zones, THEN THE Rule_Engine SHALL return a Rule_Failure with the Field_Path `scenario.zones`.
6. WHEN a Timeline_Cursor is created, THE Rule_Engine SHALL set `position` to 0.
7. WHEN the Rule_Engine moves a Timeline_Cursor to the next step, THE Rule_Engine SHALL return a new Timeline_Cursor whose `position` is 1 greater, or equal to the old `position` when the old `position` is the last step.
8. WHEN the Rule_Engine moves a Timeline_Cursor to the previous step, THE Rule_Engine SHALL return a new Timeline_Cursor whose `position` is 1 smaller, or equal to the old `position` when the old `position` is 0.
9. IF a seek asks for a position that is not an integer from 0 to the number of steps minus 1, THEN THE Rule_Engine SHALL return a Rule_Failure with the Field_Path `position` and no Timeline_Cursor.
10. THE Rule_Engine SHALL return, for a Timeline_Cursor, both the Effect_Requests of the step at `position` only, in that step's list order, and the Effect_Requests of steps 0 to `position` together, the latter sorted and without duplicates as in R-RULES-13.2.
11. THE Timeline SHALL hold no time value, duration, or speed. Playback timing and animation belong to `core-view`.
12. WHEN a seek asks for a position that is an integer from 0 to the number of steps minus 1, THE Rule_Engine SHALL return a new Timeline_Cursor with the same Timeline and that `position`.
13. IF the Rule_Engine builds a Timeline from a Propagation_Result that has no reached Node (R-RULES-08.8), THEN THE Rule_Engine SHALL return a Rule_Failure with the Field_Path `propagation.reached`, and no Timeline.

### Requirement 15: AI adapter with a no-AI implementation (R-RULES-15)

**User Story:** As the developer, I want a swap point for explanations that works with no AI, so that the product runs end to end without AI and rules alone decide every result (intent.md ch. 0 rule 5).

#### Acceptance Criteria

1. THE Rule_Engine SHALL define the AI_Adapter interface with one operation that takes an Explanation_Request and returns a Localized_Text or "no explanation".
2. WHEN the No_AI_Adapter, created from an Explanation_Table given by the App, receives an Explanation_Request whose `topic` equals a key of that Explanation_Table character for character (R-GRAPH-06.12), THE No_AI_Adapter SHALL return the Localized_Text stored for that key.
3. IF the Explanation_Table holds no entry for the request `topic`, or the Explanation_Request does not match its schema (for example a `topic` that is not an Identifier), THEN THE No_AI_Adapter SHALL return "no explanation" and SHALL throw no exception.
4. THE No_AI_Adapter SHALL return deeply equal answers for deeply equal Explanation_Requests, whatever requests it answered before, and SHALL make no network request.
5. THE Rule_Engine SHALL compute every Check_Result, Node_Rule_Result, Propagation_Result, Sum_Result, Series_Result, Effect_Request, and Timeline without calling the AI_Adapter, and no Rule_Engine function that returns one of these results SHALL take an AI_Adapter as an argument, so that no AI_Adapter answer can change a judgement result (S-RULES-4).
6. IF, when the No_AI_Adapter is created, an Explanation_Table key is not an Identifier or an entry is not a Localized_Text, THEN THE Rule_Engine SHALL return a Rule_Failure with one Validation_Error per failing entry, whose Field_Path is `table.<key>`, and no No_AI_Adapter.

### Requirement 16: Determinism, input checks, and boundary (R-RULES-16)

**User Story:** As the developer, I want every rule function to be pure, total, and generic, so that judgements are repeatable, testable without rendering, and reusable by any App.

#### Acceptance Criteria

1. THE Rule_Engine SHALL follow every boundary rule of R-GRAPH-10 (imports, App_Specific_Names, no type or attribute literals, tests next to the source in a Node environment, pure functions, arguments left unchanged).
2. THE Rule_Engine SHALL return deeply equal results for any two calls with deeply equal arguments (P-RULES-1).
3. IF a Rule_Engine function receives a Scenario that fails the Scenario_Schema, THEN THE Rule_Engine SHALL return a Rule_Failure holding every Validation_Error of the Scenario_Schema, each with its Field_Path prefixed by `scenario.`, and no judgement result.
4. IF a Rule_Engine function receives a Rule_Definition that fails the Rule_Definition_Schema, THEN THE Rule_Engine SHALL return a Rule_Failure holding every one of those Validation_Errors, each with its Field_Path prefixed by `rules.`, and no judgement result. IF the Scenario fails too, THEN the Rule_Failure SHALL hold the `scenario.` errors first and the `rules.` errors after them.
5. THE Rule_Engine SHALL return a result or a Rule_Failure for every input without throwing an exception.
6. THE Rule_Engine SHALL leave every argument deeply equal to its value before the call (R-GRAPH-10.7).
7. THE Rule_Engine SHALL write nothing to a Scenario and SHALL return no Scenario. Changes to a Scenario are Edit_Commands of `core-graph` (R-GRAPH-11).
8. THE Rule_Engine SHALL give every Validation_Error of a Rule_Failure a Field_Path that starts with the name of the argument the error belongs to: `scenario.` for the Scenario (criterion 3), `rules.` for the Rule_Definition (criterion 4), and the argument name for every other argument (for example `settings.0.attribute`, `steps.2.id`, `maxSteps`, `position`, `table.<key>`). The exact argument names are confirmed in design.md. The only exception is the Rule_Definition_Loader, whose paths are relative to its own input (R-RULES-01.3).
9. IF any other argument of a Rule_Engine function (for example a Node_Selector, Edge_Filter, Series_Settings, list of Intentional_Marks, judgement result, Timeline, or Timeline_Cursor) does not match its Zod schema, THEN THE Rule_Engine SHALL return a Rule_Failure with one Validation_Error per failing field, with a Field_Path as in criterion 8, and no judgement result.

## PBT properties

These properties come from intent.md 10.6. This spec covers "same input → same result", "removing edges never increases the set of reachable nodes", and "automatic propagation never reaches past an edge type that stops it" (decision-log 2026-11-12). "Save → load leaves the content unchanged" and "every edge points to existing nodes" are covered by `core-graph` (P-GRAPH-1, P-GRAPH-3). Each property runs at least 100 generated cases with fast-check, and each test name contains its property ID (as in R-FND-10.5).

Generators produce valid Scenarios with the `core-graph` arbitraries (`core/model/arbitraries.ts`), including cycles, self-loops, repeated Edges, Nodes with and without `zone`, and Zones in any list order; Rule_Definitions with random Passing_Edge_Types and Stopping_Edge_Types (overlapping with, and disjoint from, the Edge_Types in the Scenario); Node_Selectors naming existing and missing Identifiers; Conditions of every kind up to Condition_Depth 4; Max_Steps from 0 to the Node count, and absent; Series_Settings within their ranges; and sequences of Timeline_Cursor moves. Where a property compares sums, attribute values are integers whose sums stay below 2^53, so that the result does not depend on rounding.

- **P-RULES-1 (same input → same result).** FOR ALL Scenarios, Rule_Definitions, and settings, running each Rule_Engine function twice on deep copies SHALL return deeply equal results, including the order of every list. (R-RULES-03.2, R-RULES-05.4, R-RULES-06.6, R-RULES-07.4, R-RULES-08.3, R-RULES-13.2, R-RULES-16.2)
- **P-RULES-2 (removing edges never increases the reachable set).** FOR ALL Scenarios, start Node_Selectors, and Edge_Filters, and FOR ALL Scenarios made by removing any subset of Edges, the Reachable_Set after the removal SHALL be a subset of the Reachable_Set before it. The same SHALL hold for the reached Nodes of automatic propagation. (R-RULES-07.1, R-RULES-08.1)
- **P-RULES-3 (propagation never passes a stopping Edge_Type).** FOR ALL Scenarios and Rule_Definitions, every reached non-seed Node SHALL have been reached by an Edge of a Passing_Edge_Type, and the reached Nodes SHALL equal the Seed_Nodes together with the Reachable_Set from the Seed_Nodes with the Edge_Filter `include` = Passing_Edge_Types. Changing the type of any Edges to a Stopping_Edge_Type or an Undeclared_Edge_Type SHALL never add a reached Node. When `pass` is empty, the Edge_Filter has an empty `include` list, which lets no Edge pass, so the reached Nodes SHALL be exactly the Seed_Nodes; generators include this case. (R-RULES-02.3, R-RULES-02.4, R-RULES-08.1)
- **P-RULES-4 (step numbers are shortest distances).** FOR ALL Scenarios and Rule_Definitions, each reached Node SHALL appear once, its Step_Number SHALL equal the length of the shortest Path of Passing_Edge_Type Edges from a Seed_Node, its traversed Edge SHALL start at a Node with Step_Number one less, and with Max_Steps k the reached Nodes SHALL be exactly those with Step_Number at most k in the run without Max_Steps, and the Stopped_Edges SHALL be exactly those of the run without Max_Steps whose `from` Node has Step_Number at most k. (R-RULES-08.2, R-RULES-08.3, R-RULES-08.5, R-RULES-08.6)
- **P-RULES-5 (path search agrees with reachability).** FOR ALL Scenarios, Node pairs, and Edge_Filters, the Path search SHALL return a Path exactly when the end Node is in the Reachable_Set of the start Node; a returned Path SHALL be a non-empty list of `id`s of existing Edges that pass the Edge_Filter, chained from the start Node to the end Node, and no Path with fewer Edges SHALL exist. (R-RULES-07.1, R-RULES-07.3, R-RULES-07.7)
- **P-RULES-6 (condition logic).** FOR ALL Scenarios and Conditions c, `not(not(c))` SHALL equal c, `all([])` SHALL be `true`, `any([])` SHALL be `false`, `all(list)` SHALL equal the conjunction of the list, and `any(list)` SHALL equal the disjunction. An `edgeCount` count SHALL never increase when Edges are removed, and a `reach` Condition that is `false` SHALL stay `false` when Edges are removed. (R-RULES-04.2 to R-RULES-04.7)
- **P-RULES-7 (check set verdict).** FOR ALL Scenarios and Check_Sets, `allHold` SHALL equal the conjunction of the item results, and each item result SHALL equal the result of evaluating that Check_Item alone. (R-RULES-05.1 to R-RULES-05.3)
- **P-RULES-8 (sums).** FOR ALL Scenarios with integer attribute values and FOR ALL Node_Selectors, the Sum_Result SHALL equal the sum and count computed by a simple reference loop, and SHALL not change when the `nodes` list is reordered. (R-RULES-09.1 to R-RULES-09.3)
- **P-RULES-9 (shift detection).** FOR ALL Zone_Series with integer values and Series_Settings, adding the same integer to every Node value of the attribute SHALL not change the Shifts when `zoneValue` is `mean`. For this invariance, the generator gives every Node of one Zone the same integer value, so that each mean is an exact integer and every comparison with `shiftThreshold` is exact; raising `shiftThreshold` SHALL never add a Shift; adding Intentional_Marks SHALL change only `intentional` flags; and with `direction` `both` the Shifts SHALL be the union of those found with `up` and `down`. (R-RULES-10.3, R-RULES-11.1 to R-RULES-11.5)
- **P-RULES-10 (long runs).** FOR ALL Zone_Series and Series_Settings, Long_Runs SHALL not overlap, each SHALL hold at least `minRunLength` Zones with every inner Step_Change at most `runTolerance` in size, and raising `minRunLength` or lowering `runTolerance` SHALL never add a Zone to the union of Long_Runs. (R-RULES-11.6)
- **P-RULES-11** (removed: moved with R-RULES-12).
- **P-RULES-12 (effect requests are well formed).** FOR ALL Scenarios, Rule_Definitions, and judgement results, including judgement results that name Identifiers of no element of the Scenario, the Effect_Requests SHALL be sorted as in R-RULES-13.2, SHALL hold no duplicates, and every Effect_Target SHALL name an element of the Scenario; the Effect_Requests SHALL equal those produced after removing from the judgement results every Identifier that names no element. (R-RULES-13.1 to R-RULES-13.3)
- **P-RULES-13 (timeline cursor).** FOR ALL Timelines and sequences of next, previous, and valid seek moves, each move SHALL return a new Timeline_Cursor with the same Timeline and leave the old one unchanged; `position` SHALL stay between 0 and the number of steps minus 1; a valid seek SHALL give exactly the requested `position`; next followed by previous SHALL return to the same `position` when `position` is not the last step; and a Timeline built from a Propagation_Result SHALL hold every reached Node exactly once across its steps. (R-RULES-14.3, R-RULES-14.6 to R-RULES-14.9, R-RULES-14.12)
- **P-RULES-14 (rule definitions are checked without throwing).** FOR ALL JSON values, the Rule_Definition_Loader SHALL return a result without throwing; FOR ALL valid Rule_Definitions with one required field removed or replaced by a value of the wrong type, it SHALL return Validation_Errors that include the path of that field. (R-RULES-01.3, R-RULES-01.8)

R-RULES-01.7 (Condition_Depth over 32, a 10,000-level Condition, and a Condition that contains itself), R-RULES-04.9 and R-RULES-07.6 (termination on cycles) are also covered by example tests with a deep Condition and a large cycle. R-RULES-09.4 and R-RULES-10.5 (non-finite results) are covered by example tests whose values overflow. R-RULES-15 (No_AI_Adapter) and R-RULES-16.6 (arguments unchanged) are covered by example tests.

## Safety

Follows `safety.md` (intent.md ch. 9).

- **S-RULES-1.** THE Rule_Engine SHALL contain no attack content: no attack cards, hidden text, commands, or code that could work as a real attack. Conditions describe graph structure and numbers only. Generated and example test data SHALL be random generic values, not text that works as an instruction to an AI system.
- **S-RULES-2.** THE Rule_Engine SHALL treat Rule_Definitions, settings, Explanation_Tables, and Scenarios as untrusted data: it SHALL evaluate no part of them as code (R-RULES-01.8), SHALL limit Condition_Depth and the number of Condition occurrences (R-RULES-01.7), and SHALL return a result or a Rule_Failure instead of throwing (R-RULES-16.5).
- **S-RULES-3.** THE Rule_Engine SHALL make no network request, read no file, and fetch no image (R-RULES-15.4, R-GRAPH-10.6).
- **S-RULES-4.** Rules decide, AI only explains (intent.md ch. 0 rule 5): every judgement result SHALL come from the Rule_Engine, and no AI_Adapter answer SHALL change one (R-RULES-15.5). This spec uses no AI and no real LLM; only the No_AI_Adapter is built.
- **S-RULES-5.** THE Rule_Engine SHALL collect no personal information and SHALL require no login.
- **S-RULES-6.** This spec makes no claim that needs a source. Claims with sources (OWASP mapping, competitor comparison) belong to the App specs and are checked by the `reviewer` agent.

## Open questions

Each question names the default this document assumes, so that the document can be approved as written or changed.

- Q1 Undeclared Edge_Types: this document treats an Edge_Type listed in neither `pass` nor `stop` as not carrying automatic propagation, and does not report it as a Stopped_Edge (R-RULES-02.4). Alternative: reject a Scenario or Rule_Definition in which an Edge_Type is undeclared. Which do you want?
- Q2 Where Rule_Definitions live: this document makes the Rule_Definition_Loader take an in-memory value. Should Apps store rule definitions as JSON files under `apps/<app>/rules/`, and should the Schema_Sensor (R-FND-08) also check those files? Extending the sensor changes `repo-foundation`.
- Q3 Where Series_Settings and Intentional_Marks are stored: the Scenario_Schema of `core-graph` has no field for board settings or marks (only Node Metadata). This document makes the App pass them in. Should `core-graph` get a place for them, or should the App store them (for example in its own JSON next to the Scenario)? This document also assumes one shared list of Intentional_Marks per call, applied to every Series_Settings value (marks are per Zone, not per attribute; R-RULES-11.8). Should marks be per attribute instead?
- Q4 Zone_Value: this document offers `sum` and `mean` per Zone (R-RULES-10.1). Is `mean` needed, or is the App expected to put one value per Zone in some other way?
- Q5 Shift definition: this document uses "greater than `shiftThreshold`" (strict) and a `direction` setting (`up`, `down`, `both`), since intent.md 5.4 names "sudden brightening". Is the direction setting wanted, or should every large change count?
- Q6 Long_Run definition: this document uses "every neighbouring Step_Change at most `runTolerance`" (R-RULES-11.6). This lets a slow drift count as one run. Alternative: the whole run stays within a range (max − min ≤ tolerance). Which do you want?
- Q7 Zones with no value: this document leaves such Zones out of the Zone_Series, so their neighbours are compared directly (R-RULES-10.2). Alternative: a Zone with no value breaks the series. Which do you want?
- Q8 Effect target of a Shift: this document puts the Effect_Request on the later Zone of a Shift, and on every Zone of a Long_Run (R-RULES-13.1). Is that the "section" intent.md 5.4 means?
- Q9 (resolved at requirements approval): before/after checks of a person's actions move to the App spec (intent.md 4.6); R-RULES-12 and P-RULES-11 are removed.
- Q10 Timeline storage: this document builds Timelines at runtime and does not store them in scenario JSON. The ordered list of jobs in intent.md 4.6 step 3 would then be App data. Is that acceptable?
- Q11 AI_Adapter call style: a real AI implementation (Could) would answer asynchronously. Should the interface be asynchronous from the start (decided in design.md), even though the No_AI_Adapter answers at once?
- Q12 Node size and importance: intent.md 4.3 says Node size means importance. This document reads no `scale` in any judgement (R-RULES-03.7), so the App must also store importance as a Numeric_Attribute to sum it. Is that acceptable?
- Q13 Condition_Depth limit: this document sets 32 (R-RULES-01.7). Is that value acceptable?
