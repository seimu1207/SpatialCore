# Requirements Document

## Introduction

`app-ghost-mansion` is the spec of Unit 2, the first App: **Ghost Mansion** (スマホ屋敷のおばけ退治), in `apps/ghost-mansion/` (intent.md ch. 4, ch. 7, ch. 9, 10.2, 10.6). The shared core (Unit 1: `core-graph`, `core-rules`, `core-view`) is complete and its verification gate is recorded in `docs/decision-log.md` (2026-11-16, amended 2026-11-19).

This spec covers **only the Ghost Mansion Must items of intent.md ch. 7**: Stage 2 "A Day of the Robot" only; the risky Preset_Mansion as a refactoring puzzle (one loop in 60–90 seconds); the Sample_Mansion intro; the key types (plain / bell / none); the Hidden-Command → Key-Thief Chained_Attack; the Plausible_Ghost (fog); the Weak_Spot_Scanner and the Intrusion_Replay; the three Response_Operations on the 3D graph; and the 2-axis score with stars.

Rules for this spec:
- The App uses **only the public interfaces of `core/`** as built and specified in `core-graph`, `core-rules`, and `core-view`. The App gives the core only scenario JSON, rule definitions, a theme, and view settings (intent.md 3.2). Where a wish would need a change to `core/`, it is not a requirement here; it is listed under "Open questions" with the core change it would need.
- Every game judgement (attack success, the extent of damage, the 2-axis score, the stars, Plausible_Ghost fog, the Response_Operation check) is decided deterministically by rules: by the Rule_Engine of `core-rules` with the Game_Rules supplied by the App, or, where the Rule_Engine offers no matching function, by a deterministic App_Rule_Function over Rule_Engine results (decided at Q1; `core/` is not changed). No AI is used, and the Robot runs on rules, never on a real LLM (intent.md ch. 0 rule 5, 4.4, ch. 9).
- Formulas and contents are **decided in design.md**: the `check` format of Preconditions, the 2-axis score formula, the Star_Table, the response Order_Rules, the contents of the Preset_Mansion (rooms, keys, Robot_Jobs, Helper_Node places), the Hidden_Text wording, and the timing values. This document states only what those values must satisfy.
- All Ghost Mansion words stay in `apps/ghost-mansion/`. `core/` gets no file, no name, and no change from this spec (structure.md, R-GRAPH-10, R-VIEW-01.6).

Today is 2026-11-23, the date of the first fallback in intent.md ch. 7. The human decided on 2026-11-23 **not to apply** the fallback, because the schedule can be recovered later (recorded in `docs/decision-log.md`). The Plausible_Ghost stays Must. The fallback variants stay in this document as optional features that are off by default (R-APP1-23), so that a later decision needs no rewrite.

Difficulty: the Must scope has **one difficulty level only** (the Must_Level). The Must_Level combines the beginner room count of intent.md 4.8 (3–4 rooms) with two ghosts (the Chained_Attack and the Plausible_Ghost) and three Response_Operations.

Out of scope (intent.md ch. 7 Should and Could, and other items not in the Ghost Mansion Must):
- Should: the Eavesdrop Ghost and the Mimic Ghost (and therefore front/back voice nodes), the field guide (and the technical terms and OWASP mapping it would show), the JA/EN switch UI, and splitting the Must_Level into separate beginner and intermediate levels (decided at Q3).
- Could: building from a blank board after clearing, AI explanations by "Dr. Ghost" (a real AIAdapter), versus mode, Stage 1 "First Smartphone", make-your-own-ghost mode, and the advanced level.
- Saving or exporting a mansion, any storage in the browser.
- Core Should items (glow and other effects than fog, front/back flip display, new-app-template).

## Glossary

Terms reused from `core-graph` (`.kiro/specs/core-graph/requirements.md`) keep their meaning there: **App**, **App_Specific_Name**, **Repository**, **Scenario**, **Scenario_File**, **Scenario_Schema**, **Scenario_Loader**, **Schema_Sensor**, **Lint_Sensor**, **Node**, **Node_Type**, **Edge**, **Edge_Type**, **Zone**, **Face**, **Numeric_Attributes**, **Identifier**, **Localized_Text**, **Validation_Error**, **Field_Path**, **Edit_Command**, **Batch_Command**, **Command_Applier**, **History**. Terms reused from `core-rules` keep their meaning there: **Rule_Engine**, **Rule_Definition**, **Rule_Definition_Loader**, **Rule_Failure**, **Propagation_Policy**, **Passing_Edge_Type**, **Stopping_Edge_Type**, **Condition**, **Check_Set**, **Check_Item**, **Check_Result**, **Node_Rule**, **Node_Rule_Result**, **Propagation_Result**, **Step_Number**, **Stopped_Edge**, **Max_Steps**, **Sum_Result**, **Effect_Kind**, **Effect_Rule**, **Effect_Request**, **Timeline**, **Timeline_Step**, **Timeline_Cursor**, **AI_Adapter**, **No_AI_Adapter**. Terms reused from `core-view` keep their meaning there: **Core_View**, **View_Settings**, **View_Settings_Loader**, **ViewPreset**, **Visibility_Filter**, **Visible_Set**, **Active_Preset**, **Zone_Footprint**, **Wall**, **Detail_Distance**, **Detail_Layer**, **Theme**, **Theme_Loader**, **Edit_Mode**, **Selection**, **Connect_Mode**, **Edit_Callback**, **Select_Callback**, **Timeline_Callback**, **Image_Resolver**, **Reference_Machine**. Terms reused from `repo-foundation`: **Public_URL**, **Top_Page**.

- **Must_Level**: the one difficulty level of this spec: 3–4 Room_Nodes, the Chained_Attack and the Plausible_Ghost, and three Response_Operations.
- **Mansion_App**: the Ghost Mansion App: every file under `apps/ghost-mansion/` and the page served at `/ghost-mansion/` under the Public_URL.
- **Game_Data**: the plain data the Mansion_App gives the core and uses itself: the Preset_Mansion Scenario, the Game_Rules, the Attack_Card, the Robot_Jobs, the Order_Rules, the Star_Table, the View_Settings, the Theme, and the UI texts. All of it is stored under `apps/ghost-mansion/`.
- **Game_Rules**: the one Rule_Definition of the Mansion_App (Propagation_Policy, Check_Sets, Node_Rules, Effect_Rules), validated with the Rule_Definition_Loader.
- **App_Rule_Function**: a pure, deterministic TypeScript function under `apps/ghost-mansion/` that computes a judgement from Rule_Engine results and Game_Data only, for a judgement that no Rule_Engine function provides (the score formula, the Star_Table lookup, and the Order_Rule check). It uses no AI, no clock, and no random source.
- **Floor**: one of the four Zones of the mansion, in ascending Zone `order`: **Outside_Road** (anyone), **Garden** (friends), **House** (family), **Safe** (only me) (intent.md 4.3). Floors differ in `elevation`, and the inner three are enclosed by Walls.
- **Preset_Mansion**: the one Scenario that the student fixes: maximum convenience, with too many keys given to the Robot (intent.md 4.2). Its contents are decided in design.md.
- **Sample_Mansion**: the Preset_Mansion with every Key_Edge set to Plain_Key, used only in the Sample phase. It is derived from the Preset_Mansion and is not a second mansion definition (intent.md 4.2).
- **Robot_Node**: the one Node of the AI helper robot. Its behaviour comes only from the Game_Rules, the Robot_Jobs, and App_Rule_Functions.
- **Room_Node**: a Node that stands for a room or belonging the Robot can be given a key to. Each Room_Node holds the Numeric_Attribute **Importance** (a Finite_Number ≥ 0), the damage if it is taken.
- **Text_Node**: a Node that stands for a letter or page the Robot reads.
- **Hidden_Text**: the `detail` Localized_Text on the Face of one Text_Node, a fixed short phrase placed by the game (R-APP1-05.4). It becomes visible by zoom through the Detail_Layer of `core-view`.
- **Dont_Read_Mark**: the change the student makes to a Text_Node in Prepare so that the Robot no longer reads it (intent.md 4.6 step 2). How the mark is stored (Node_Type, Edge_Type, or Numeric_Attribute) is decided in design.md, using only Edit_Commands of `core-graph`.
- **Helper_Node**: a Node for an adult or a friend that the student can consult.
- **Answer_Node**: a Node for a homework answer made by the Robot.
- **Source_Node**: a Node for a source that an Answer_Node can cite.
- **Key_Edge**: an Edge whose `from` is the Robot_Node and whose Edge_Type is Plain_Key or Bell_Key.
- **Plain_Key**: the Edge_Type of a key that runs automatically: high convenience, and a Passing_Edge_Type of the Game_Rules.
- **Bell_Key**: the Edge_Type of a key that a human confirms each time (human-in-the-loop): medium convenience, and a Stopping_Edge_Type of the Game_Rules.
- **No_Line**: the absence of a Key_Edge between the Robot_Node and a Room_Node: no added convenience, and nothing beyond it is reached.
- **Key_Choice**: one of Plain_Key, Bell_Key, or No_Line for one Key_Edge.
- **Read_Edge**: an Edge of the Edge_Type the Game_Rules use for "the Robot reads this Text_Node".
- **Cite_Edge**: an Edge of the Edge_Type the Game_Rules use for "this Answer_Node cites this Source_Node".
- **Consult_Edge**: an Edge of the Edge_Type the Game_Rules use for a consultation line whose `to` is a Helper_Node.
- **Attack_Card**: the abstract description of one attack: `id`, `name`, `attackerGoal`, `motives`, `targets`, `preconditions`, `impact`, and `counters` (intent.md 4.7). It holds no code, command, or usable text.
- **Precondition**: one entry of an Attack_Card with an `id`, a display `label` (Localized_Text), a machine `check`, and a `highlight` list. Its `check` format is decided in design.md and is a Condition of `core-rules`.
- **Highlight_List**: the fixed `highlight` list of one Precondition: the Node and Edge Identifiers of the Preset_Mansion that the Mansion_App marks when that Precondition holds. It is Game_Data and is not computed by the Rule_Engine.
- **Built_Rules**: a Rule_Definition that the Mansion_App builds at run time from the Game_Rules plus Check_Sets made from the Attack_Card or from the night start state. It is validated with `loadRuleDefinition` of `core/model/rule-schema.ts` after building and before any Rule_Engine call.
- **Chained_Attack**: the one Attack_Card of this spec: the Hidden-Command Ghost tricks the Robot, and the Key-Thief Ghost spreads the damage along the keys (intent.md 4.5, 4.6; one chained attack).
- **Attack_Verdict**: `allHold` of the Check_Result of the Check_Set built from the Preconditions of the Chained_Attack.
- **Plausible_Ghost**: the ghost that puts fog on every Answer_Node that has no Cite_Edge to a Source_Node (intent.md 4.5, 4.6).
- **Fog_Kind**: the Effect_Kind the Game_Rules use for Plausible_Ghost fog, mapped to the `fog` style in the Theme.
- **Damage_Kind**: the Effect_Kind the Game_Rules use to show reached Nodes and traversed Edges of the damage, mapped to the `fog` style in the Theme with its own color.
- **Highlight_Kind**: the Effect_Kind the Mansion_App uses to draw the Nodes and Edges of a Highlight_List. Its Theme mapping is decided in design.md. The Theme Effect_Style of `core-view` accepts only `style` `fog` (`effectStyleSchema` in `core/view/helpers/theme-schema.ts`), so the Highlight_Kind is mapped to the `fog` style with its own color, as the Damage_Kind is.
- **Bell_Stop_Kind**: the Effect_Kind the Mansion_App uses to draw a Stopped_Edge as a place where a Bell_Key stopped the damage, mapped to the `fog` style in the Theme with its own color (same Theme limit as the Highlight_Kind).
- **Damage_Set**: the reached Nodes other than the Robot_Node of the Propagation_Result whose Seed_Node is the Robot_Node, under the Propagation_Policy of the Game_Rules.
- **Damage_Score**: the Sum_Result of Importance over the Damage_Set and nothing else. Plausible_Ghost fog is display only and never enters the Damage_Score (decided at Q8).
- **Robot_Job**: one fixed job the Robot does in Ghost Night (for example "summarize a page", "sort photos", "reply to a message"; intent.md 4.6 step 3), with a display label and the Room_Node or Text_Node it needs. The list and its order are Game_Data decided in design.md.
- **Job_Check_Set**: the Check_Set of the Game_Rules with one Check_Item per Robot_Job that holds when the Robot can do that job under the current keys.
- **Convenience_Score**: the number computed from the Job_Check_Set Check_Result and the Key_Choices by the formula decided in design.md (intent.md 4.4: jobs finished; Plain_Key high, Bell_Key medium, No_Line none).
- **Score_Point**: the pair (Convenience_Score, Damage_Score).
- **Star_Table**: the Game_Data that maps every Score_Point to a number of stars from 1 to 3 (range decided in design.md), looked up by an App_Rule_Function.
- **Look_Back_Effects**: the list of Effect_Requests the Mansion_App passes to `setEffects` in Look Back, defined in R-APP1-18.6.
- **Phase**: the current step of the loop: `sample`, `prepare`, `ghostNight`, `fixIt`, or `lookBack` (intent.md 4.2).
- **Phase_Machine**: the App_Rule_Function that takes the current Phase state and one Phase action as plain data and returns the next Phase state.
- **Overhead_View**: the ViewPreset that shows every Node, Edge, and Zone from above (the whole wiring).
- **Ghost_View**: the ViewPreset with a low camera on the Outside_Road whose Visibility_Filter shows only the Outside_Road Zone, the Nodes in it, and the Edges with at least one end in it (`edgeRule` `anyEnd`) (intent.md 4.3).
- **Weak_Spot_Scanner**: the use of the Ghost_View as a defence tool in Prepare and Look Back (intent.md 4.2).
- **Night_Timeline**: the Timeline of Ghost Night: one Timeline_Step per Robot_Job in order, followed, when the Attack_Verdict is `true`, by one Timeline_Step per Step_Number of the damage propagation.
- **Intrusion_Replay**: the playback of the Night_Timeline with the Core_View (Ghost Night) and its replay in Look Back.
- **Response_Operation**: one of the three operations of Fix It: **Stop_Robot** (an Edit_Command that marks the Robot_Node as stopped, stored as decided in design.md), **Cut_Key** (a remove Edge Edit_Command on a Key_Edge), and **Consult** (an add Edge Edit_Command of a Consult_Edge made with Connect_Mode).
- **Action_Log**: the ordered list of Response_Operations accepted in the current Fix It phase, derived from the History given by the Edit_Callback and therefore in step with undo and redo.
- **Order_Rule**: one before/after rule of Game_Data of the form "operation A comes before operation B" (intent.md 4.6 step 4; moved from `core-rules` to this spec at core-rules requirements approval).
- **Response_Result**: the result of Fix It: whether each Response_Operation was done (from a Check_Set of the Game_Rules) and whether the Action_Log meets every Order_Rule (from an App_Rule_Function).
- **Fallback_F1**: intent.md ch. 7, 11/23 first step: narrow to the single "Hidden-Command + key spread" scenario; the Plausible_Ghost goes back to Should (fog stays a core Must).
- **Fallback_F2**: intent.md ch. 7, 11/23 second step: Fallback_F1 plus three Robot_Jobs and damage spread of one step only (Max_Steps 1).

## Requirements

### Requirement 1: App page and start (R-APP1-01)

**User Story:** As a judge, I want to open the Ghost Mansion URL and start playing at once, so that I can feel the value within 60 seconds with no install and no key.

#### Acceptance Criteria

1. WHEN a visitor opens `/ghost-mansion/` under the Public_URL in a desktop browser, THE Mansion_App SHALL load the Game_Data, start the Core_View with the Sample_Mansion, and show the Sample phase, with no login, no API key, and no server other than the static host of the Public_URL.
2. THE Mansion_App SHALL replace the placeholder page of `repo-foundation` at `/ghost-mansion/`, and THE Top_Page link to Ghost Mansion SHALL keep pointing to `/ghost-mansion/` (R-FND-03.1).
3. THE Mansion_App SHALL show one control that leads back to the Top_Page in every Phase.
4. THE Mansion_App SHALL make no network request to any origin other than the Public_URL origin, and SHALL load every image, icon, and font from files bundled with the build (S-VIEW-3).
5. WHERE the browser cannot create a WebGL context, THE Mansion_App SHALL keep the start control visible (the control of criterion 3 and the message the Core_View draws in its host) and SHALL throw no uncaught exception. The Core_View gives the App no report in this case (`startCoreView` returns a handle whose functions do nothing and calls no Edit_Callback), so the way the Mansion_App detects it is decided in design.md.

### Requirement 2: Game data and its validation (R-APP1-02)

**User Story:** As the developer, I want all game content to be checked data, so that a broken scenario or rule never reaches a student.

#### Acceptance Criteria

1. THE Mansion_App SHALL store the Preset_Mansion as one Scenario_File under `apps/ghost-mansion/scenarios/`, and THE Schema_Sensor SHALL report zero Validation_Errors for every Scenario_File under that folder. The placeholder Scenario_File of `repo-foundation` SHALL be replaced or removed.
2. THE Mansion_App SHALL store the Game_Rules, the Attack_Card, the Robot_Jobs, the Order_Rules, and the Star_Table as JSON files under `apps/ghost-mansion/rules/`, the Theme under `apps/ghost-mansion/theme/`, and the View_Settings under `apps/ghost-mansion/` (decided at Q5). The Schema_Sensor stays unchanged; these files are checked at startup (criterion 3) and by the example test (criterion 5).
3. WHEN the Mansion_App starts, THE Mansion_App SHALL validate the Preset_Mansion with the Scenario_Loader, the Game_Rules with the Rule_Definition_Loader, the View_Settings with the View_Settings_Loader, the Theme with the Theme_Loader, and the Attack_Card, Robot_Jobs, Order_Rules, and Star_Table with Zod schemas under `apps/ghost-mansion/`.
4. IF any validation of criterion 3 fails, THEN THE Mansion_App SHALL show one English message saying the game data is invalid, SHALL start no game Phase, and SHALL throw no exception.
5. THE Repository SHALL contain one example test next to the Game_Data loading code that loads every bundled Game_Data file and checks that each validation of criterion 3 succeeds, so that a broken file fails `npm test`.
6. IF a Precondition `check`, a Robot_Job, an Order_Rule, or an Effect_Rule of the Game_Data names a Node, Zone, Check_Item, or Robot_Job Identifier that does not exist in the Preset_Mansion or the Game_Data, THEN the test of criterion 5 SHALL fail and name that Identifier. A Rule_Engine Unresolved_Reference for the Preset_Mansion SHALL count as such a failure.
7. THE Attack_Card schema SHALL reuse the Condition schema exported by `core/model/rule-schema.ts` for each Precondition `check`, and SHALL define no second schema for a Condition (R-RULES-01.1).
8. WHEN the Mansion_App builds a Built_Rules value (R-APP1-05.3, R-APP1-16.7), THE Mansion_App SHALL validate the Built_Rules with `loadRuleDefinition` before passing the Built_Rules to any Rule_Engine function, and IF that validation fails, THEN THE Mansion_App SHALL act as in criterion 4.
9. IF a Highlight_List names a Node or Edge Identifier that does not exist in the Preset_Mansion, THEN the test of criterion 5 SHALL fail and name that Identifier.

### Requirement 3: Mansion layout (R-APP1-03)

**User Story:** As a student, I want a mansion whose floors show who can see what, so that I can understand exposure by where things are placed.

#### Acceptance Criteria

1. THE Preset_Mansion SHALL hold exactly four Zones, the Floors Outside_Road, Garden, House, and Safe, with ascending `order` in that sequence and pairwise different `elevation` values.
2. THE View_Settings SHALL give each Floor a `ring` Zone_Footprint (the Safe may use a `rect` or a `ring` with `innerRadius` 0), so that the four Floors form concentric areas around one center, with the Outside_Road outermost.
3. THE Preset_Mansion SHALL set `enclosed` to `true` for the Garden, the House, and the Safe, and to `false` for the Outside_Road.
4. THE Preset_Mansion SHALL hold exactly one Robot_Node, from 3 to 4 Room_Nodes (the Must_Level; intent.md 4.8 beginner room count), at least one Text_Node whose Face holds a Hidden_Text, at least one Text_Node on the Outside_Road, and at least one Helper_Node.
5. WHERE Fallback_F1 is not in effect, THE Preset_Mansion SHALL hold at least one Answer_Node and at least one Source_Node.
6. THE Preset_Mansion SHALL give every Room_Node an Importance attribute and SHALL set the `scale` of each Room_Node so that a Room_Node with a larger Importance has a `scale.x` and `scale.y` at least as large as a Room_Node with a smaller Importance (intent.md 4.3: size = importance). An example test SHALL check this on the bundled Preset_Mansion.
7. THE Mansion_App SHALL read Importance only from the Numeric_Attribute, and no judgement SHALL depend on `scale` (R-RULES-03.7; core-rules Q12).
8. THE Preset_Mansion SHALL give every Node and Zone a `label` or Face `text` in Localized_Text with a non-empty `en` value, and SHALL use only fictional content made by the developer (no real person, address, or photo).

### Requirement 4: Key types and propagation policy (R-APP1-04)

**User Story:** As a student, I want to choose for each robot key whether it runs automatically, rings a bell for a human check, or is not given, so that I can balance convenience and safety.

#### Acceptance Criteria

1. THE Game_Rules SHALL list Plain_Key in `propagation.pass` and Bell_Key in `propagation.stop`. Other Passing_Edge_Types (for example a password chain between rooms, intent.md 4.3) SHALL be listed only when design.md adds them.
2. THE Game_Rules SHALL list no Read_Edge, Cite_Edge, or Consult_Edge Edge_Type in `propagation.pass`, so that damage spreads only along keys and the Edge_Types design.md adds under criterion 1.
3. THE Mansion_App SHALL represent a Key_Choice of Plain_Key or Bell_Key as the Edge_Type of a Key_Edge, and a Key_Choice of No_Line as the absence of a Key_Edge.
4. WHEN the student changes the Key_Choice of a selected Key_Edge between Plain_Key and Bell_Key, THE Mansion_App SHALL pass one update Edge Edit_Command that sets only `type` to the Core_View `execute` function (R-VIEW-23.10).
5. WHEN the student sets the Key_Choice of a selected Key_Edge to No_Line, THE Mansion_App SHALL pass one remove Edge Edit_Command for that Edge to the Core_View `execute` function.
6. WHILE the Selection is not a Key_Edge, THE Mansion_App SHALL show the Key_Choice controls as disabled and SHALL issue no Key_Choice Edit_Command.

### Requirement 5: Attack card (R-APP1-05)

**User Story:** As a teacher, I want the attack shown only as an abstract card with its conditions, so that students learn what an attack needs without learning how to do it.

#### Acceptance Criteria

1. THE Mansion_App SHALL describe the Chained_Attack as one Attack_Card with the fields `id`, `name`, `attackerGoal`, `motives`, `targets`, `preconditions`, `impact`, and `counters`, where every text shown to a person is a Localized_Text.
2. THE Attack_Card SHALL hold at least three Preconditions, including "the Robot reads text from outside", "the Robot holds a key", and "no human check on the key path" (intent.md 4.7), each with an `id`, a `label`, a `check`, and a Highlight_List.
3. THE Mansion_App SHALL build at run time, from the Preconditions, one Check_Set with one Check_Item per Precondition, whose Check_Item `id` equals the Precondition `id` and whose Condition equals the Precondition `check`, in the same order, and SHALL add that Check_Set to the Game_Rules to form a Built_Rules value validated as in R-APP1-02.8. The `label` and the Highlight_List SHALL stay in the Attack_Card and SHALL not reach the core (R-RULES-05.5).
4. THE Hidden_Text SHALL be one fixed phrase of at most 60 characters in `en` (and in `ja` when present), decided in design.md, that names only things inside the game (for example the Robot or a room of the mansion), and SHALL contain no URL, no e-mail address, no code, no command, and no instruction addressed to a real AI system (safety.md).
5. THE Attack_Card and every Game_Data text SHALL contain no code, command, script, URL to an attack resource, or text that works as a real attack (safety.md).
6. WHEN the Mansion_App shows the Attack_Card (in Sample and in Look Back), THE Mansion_App SHALL show each Precondition `label` with its current Check_Item result (met or not met) and SHALL show the `counters`.

### Requirement 6: Chained attack judgement (R-APP1-06)

**User Story:** As a student, I want the game to decide by fixed rules whether the robot is tricked, so that the same mansion always gives the same result and I can see which condition I broke.

#### Acceptance Criteria

1. WHEN the Mansion_App needs the Attack_Verdict, THE Mansion_App SHALL call `evaluateCheckSets` of the Rule_Engine with the current Scenario and the Game_Rules and SHALL use `allHold` of the Chained_Attack Check_Result as the Attack_Verdict.
2. THE Mansion_App SHALL treat the Robot as tricked exactly when the Attack_Verdict is `true`.
3. WHILE the Robot_Node is marked as stopped (Stop_Robot), THE Game_Rules SHALL make at least one Precondition of the Chained_Attack not hold, so that the Attack_Verdict is `false`.
4. WHEN every Text_Node that holds a Hidden_Text has a Dont_Read_Mark, THE Game_Rules SHALL make the Precondition "the Robot reads text from outside" not hold.
5. IF the Rule_Engine returns a Rule_Failure, THEN THE Mansion_App SHALL show one English message saying the game could not judge the mansion, SHALL keep the current Phase, and SHALL throw no exception.
6. THE Mansion_App SHALL compute the Attack_Verdict without any AI_Adapter, LLM, network request, clock value, or random value.

### Requirement 7: Damage propagation (R-APP1-07)

**User Story:** As a student, I want to see how far damage spreads from a tricked robot along its keys and where a bell key stops it, so that I learn how permission size relates to damage.

#### Acceptance Criteria

1. WHEN the Mansion_App computes damage, THE Mansion_App SHALL call `propagate` of the Rule_Engine with the current Scenario, the Game_Rules, and the Node_Selector `{ ids: [<Robot_Node id>] }`, and SHALL take the Damage_Set from its reached Nodes without the Robot_Node (the seed at Step_Number 0). Propagation follows Edges from `from` to `to` only.
2. THE Mansion_App SHALL compute the Damage_Score with `sumAttribute` of the Rule_Engine over a Node_Selector whose `ids` are the Damage_Set. A Node_Selector with an empty `ids` list matches no Node (a missing field matches every Node), so an empty Damage_Set gives a Damage_Score of 0. The number of fogged Answer_Nodes SHALL NOT change the Damage_Score, the Score_Point, or the stars.
3. WHEN the Attack_Verdict is `false`, THE Mansion_App SHALL use an empty Damage_Set and a Damage_Score of 0 for the Ghost Night result.
4. WHEN the Attack_Verdict of the night is `true`, THE Mansion_App SHALL show each Stopped_Edge of the Propagation_Result as a place where a Bell_Key stopped the damage, with Effect_Requests of the Bell_Stop_Kind, in Ghost Night (inside the Night_Timeline, R-APP1-15.2) and in Look Back (with `setEffects`, as part of the Look_Back_Effects of R-APP1-18.6). WHEN the Attack_Verdict is `false`, THE Mansion_App SHALL show no Stopped_Edge as such. Reason: `propagate` lists in `stopped` every Edge of a Stopping_Edge_Type whose `from` is reached (`core/model/paths.ts`), and the Robot_Node seed is always reached, so every Bell_Key is a Stopped_Edge even when the Robot is not tricked.
5. WHERE Fallback_F2 is in effect, THE Mansion_App SHALL call `propagate` with Max_Steps 1.
6. WHEN the Mansion_App shows damage on the 3D graph, THE Mansion_App SHALL draw it with Effect_Requests of the Damage_Kind built by `buildEffects` of the Rule_Engine from the Propagation_Result and an Effect_Rule with a propagation source. Because a propagation source targets every reached Node, including the seed, THE Mansion_App SHALL remove the Effect_Request whose target is the Robot_Node, so that the Damage_Kind Node targets equal the Damage_Set.

### Requirement 8: Plausible Ghost fog (R-APP1-08)

**User Story:** As a student, I want an answer that cites no source to be covered by fog, so that I learn to check AI answers against sources.

Under Fallback_F1 this requirement is removed (it goes back to Should); fog stays a core Must for Moodwalk.

#### Acceptance Criteria

1. WHERE Fallback_F1 is not in effect, THE Game_Rules SHALL hold one Node_Rule whose candidates are the Answer_Nodes and whose Condition holds exactly when the candidate has no Cite_Edge to a Source_Node, and one Effect_Rule with the Fog_Kind whose source is that Node_Rule.
2. WHERE Fallback_F1 is not in effect, WHEN the Mansion_App gives the Core_View a new History with `setHistory` or receives a new History from the Edit_Callback (after a Gesture, `execute`, undo, or redo), THE Mansion_App SHALL itself evaluate the Node_Rules with `evaluateNodeRules`, build Effect_Requests with `buildEffects`, and pass the Fog_Kind Effect_Requests to the Core_View `setEffects` function together with the other current Effect_Requests. `setHistory` calls no Edit_Callback, so the Mansion_App does this recomputation itself after each `setHistory` call. Effect_Requests given by `setEffects` are drawn only while no Timeline is set in the Core_View, so fog in Prepare after the Sample replay depends on the `stopTimeline` call of R-APP1-12.8.
3. WHERE Fallback_F1 is not in effect, WHILE the Phase is `prepare`, THE Mansion_App SHALL let the student add a Cite_Edge with Connect_Mode on with the Cite_Edge Edge_Type, by clicking the Answer_Node first and the Source_Node second (Connect_Mode sets `from` to the first clicked Node and `to` to the second), so that fog on that Answer_Node disappears in the next drawn frame after the Edit_Callback. WHEN the add Edge Edit_Command of that connection is accepted, THE Mansion_App SHALL turn Connect_Mode off (as in R-APP1-16.4). The student can also leave Connect_Mode without a connection as in R-APP1-19.9.
4. WHERE Fallback_F1 is not in effect, THE Theme SHALL map the Fog_Kind to an Effect_Style with `style` `fog`.

### Requirement 9: Robot jobs and convenience (R-APP1-09)

**User Story:** As a student, I want more keys to make the robot finish more jobs, so that I feel the trade-off between convenience and safety.

#### Acceptance Criteria

1. THE Game_Data SHALL hold an ordered list of Robot_Jobs with at least one job that needs a Text_Node on the Outside_Road (the job during which the Robot reads the Hidden_Text). The number of jobs is decided in design.md.
2. WHERE Fallback_F2 is in effect, THE Game_Data SHALL hold exactly three Robot_Jobs.
3. THE Game_Rules SHALL hold the Job_Check_Set, and THE Mansion_App SHALL compute the Convenience_Score from its Check_Result (`evaluateCheckSets`) and the Key_Edge types of the current Scenario with an App_Rule_Function whose formula is decided in design.md.
4. THE Convenience_Score formula SHALL give a job done through a Plain_Key at least as many points as the same job done through a Bell_Key, and a job done through a Bell_Key at least as many points as a job that cannot be done (No_Line) (intent.md 4.4).
5. WHEN every Key_Edge is removed, THE Convenience_Score SHALL be 0 (intent.md 4.4: removing every key is safe but gives zero convenience points).
6. WHILE the Phase is `prepare`, WHEN the Mansion_App gives the Core_View a new History with `setHistory` or receives a new History from the Edit_Callback, THE Mansion_App SHALL show the current Convenience_Score and the Damage_Score that the Robot would cause if tricked (computed as in R-APP1-07.1 and R-APP1-07.2 without the Attack_Verdict), so that the student can watch both move (intent.md 4.6 step 2).

### Requirement 10: Two-axis score and stars (R-APP1-10)

**User Story:** As a student, I want my result shown as a point on two axes with stars, so that I see the balance of convenience and safety and not only one number.

#### Acceptance Criteria

1. WHEN Ghost Night ends, THE Mansion_App SHALL compute the Score_Point from the Scenario as it was when Ghost Night started: the Convenience_Score of R-APP1-09.3 and the Damage_Score of the Ghost Night result (R-APP1-07, including R-APP1-07.3).
2. THE Mansion_App SHALL look up the number of stars for the Score_Point in the Star_Table with an App_Rule_Function. Every Score_Point that the Preset_Mansion can produce SHALL map to exactly one number of stars.
3. THE Star_Table SHALL never give fewer stars to a Score_Point with a lower Damage_Score and the same Convenience_Score, and SHALL never give fewer stars to a Score_Point with a higher Convenience_Score and the same Damage_Score.
4. THE Star_Table SHALL give the highest number of stars to no Score_Point whose Convenience_Score is 0, so that removing every key does not win (intent.md 4.4).
5. WHILE the Phase is `lookBack`, THE Mansion_App SHALL show the Score_Point as a point on a chart with a convenience axis and a damage axis, together with the number of stars.
6. THE Mansion_App SHALL compute the Score_Point and the stars without any AI_Adapter, LLM, network request, clock value, or random value.

### Requirement 11: Viewpoints and zoom (R-APP1-11)

**User Story:** As a student, I want to switch between the whole wiring and the ghost's low view from the road, and to zoom into letters, so that I find what an attacker can see and what the robot will read.

#### Acceptance Criteria

1. THE View_Settings SHALL hold the Overhead_View and the Ghost_View, and the Mansion_App SHALL show one control per ViewPreset that calls the Core_View `setPreset` function.
2. THE Ghost_View SHALL place the camera on the Outside_Road below the Wall top of the Garden (`elevation` of the Garden + Wall_Height), and its Visibility_Filter SHALL list only the Outside_Road in `zones` with `edgeRule` `anyEnd`, so that only Nodes on the Outside_Road and Edges that reach it are drawn (intent.md 4.3).
3. THE Mansion_App SHALL decide what the Ghost_View shows only by its Visibility_Filter; the Walls only support it visually (R-VIEW-06.8).
4. THE View_Settings SHALL set a Detail_Distance at which the Hidden_Text of a Text_Node is drawn when the camera comes close, and at which it is not drawn from the Camera_Pose of the Overhead_View.
5. WHILE the Phase is `sample` or `prepare`, THE Mansion_App SHALL let the student orbit and zoom the camera (R-VIEW-08.8) so that the Hidden_Text can be found by zoom.
6. THE Mansion_App SHALL show the Ghost_View in the Sample phase by default, and SHALL offer it as the Weak_Spot_Scanner in the Prepare and Look Back phases.

### Requirement 12: Phase flow (R-APP1-12)

**User Story:** As a student, I want the loop to go Sample → Prepare → Ghost Night → Fix It → Look Back in a fixed order, so that I always know what to do next.

#### Acceptance Criteria

1. THE Phase_Machine SHALL start in `sample` and SHALL allow only these moves: `sample` → `prepare`; `prepare` → `ghostNight`; `ghostNight` → `fixIt` when the Damage_Set is not empty; `ghostNight` → `lookBack` when the Damage_Set is empty; `fixIt` → `lookBack`; `lookBack` → `prepare` (retry).
2. IF a Phase action asks for a move that criterion 1 does not allow, THEN THE Phase_Machine SHALL return the Phase state unchanged.
3. THE Mansion_App SHALL show, in every Phase, the name of the Phase, one short English instruction for that Phase, and the one control that moves to the next Phase.
4. WHEN the Phase changes to `ghostNight`, THE Mansion_App SHALL keep the History as it was at that moment as the start state of the night, for the Score_Point (R-APP1-10.1) and for the retry of criterion 5.
5. WHEN the Phase changes from `lookBack` to `prepare`, THE Mansion_App SHALL give the Core_View a new History whose `present` is the start state of the last night (criterion 4), so that the student prepares again from the mansion they prepared before (the Fix It changes are dropped; decided at Q10).
6. THE Mansion_App SHALL offer, in the Prepare phase, one control that gives the Core_View a new History whose `present` is the Preset_Mansion (start over).
7. THE Phase_Machine SHALL be an App_Rule_Function that takes and returns plain data, so that it can be tested without rendering.
8. WHEN the Phase changes, THE Mansion_App SHALL call the Core_View `stopTimeline` function before any other Core_View call for the new Phase (`setHistory`, `setEffects`, or `startTimeline`). Reason: while a Timeline is set in the Core_View, also after its end (status `ended`, Timeline not `null`), `shownEffects` (`core/view/helpers/effects-view.ts`) draws only the Timeline effects and ignores the Effect_Requests given by `setEffects`; only `stopTimeline` (`CoreViewHandle.stopTimeline` in `core/view/start-view.tsx`, action `timelineStop`) sets the Timeline to `null`, and `setHistory` does not.
9. WHEN the Core_View reports the end of the Fix It replay (R-APP1-16.9) or of the Look Back replay (R-APP1-18.2), THE Mansion_App SHALL call `stopTimeline` and SHALL then pass the current Effect_Requests of that Phase to `setEffects`. After the Sample replay (R-APP1-13.4) the ended Timeline stays set, so that the whole damage spread stays drawn, until the Phase change to `prepare` calls `stopTimeline` (criterion 8).

### Requirement 13: Sample phase (R-APP1-13)

**User Story:** As a student, I want to play the ghost once against a careless sample mansion and watch the attack conditions get met one by one, so that I understand what an attack needs.

#### Acceptance Criteria

1. WHILE the Phase is `sample`, THE Mansion_App SHALL show the Sample_Mansion, set Edit_Mode to `view`, and show the Attack_Card.
2. THE Mansion_App SHALL derive the Sample_Mansion from the Preset_Mansion by one Batch_Command that sets the Edge_Type of every Key_Edge to Plain_Key, applied with the Command_Applier of `core-graph`. If no Key_Edge needs a change, the Sample_Mansion SHALL equal the Preset_Mansion.
3. WHILE the Phase is `sample`, WHEN the student activates the "next" control, THE Mansion_App SHALL show the next Precondition of the Attack_Card as met, in Attack_Card order, and SHALL draw, with `setEffects`, one Effect_Request of the Highlight_Kind on each Node and Edge of that Precondition's Highlight_List, keeping the Highlight_Kind Effect_Requests of the Preconditions shown before. No Timeline is set in the Core_View at this point (Sample is the first Phase and the damage Timeline of criterion 4 starts only after the last Precondition), so these Effect_Requests are drawn. The Precondition results SHALL come from the Check_Result of the Sample_Mansion; the Check_Result gives only `holds` per Check_Item, so the drawn targets come only from the Highlight_List.
4. WHEN every Precondition is shown as met, THE Mansion_App SHALL play the damage spread of the Sample_Mansion through the Core_View `startTimeline` function, as a Timeline built with `createTimeline` of the Rule_Engine that holds one Timeline_Step per Step_Number from 1 to the largest Step_Number of the Propagation_Result, whose `effects` hold the Damage_Kind Effect_Requests of the Nodes reached at that Step_Number and the Edges by which they were reached (the same damage steps as R-APP1-15.2). Because the Core_View draws only Timeline effects while the Timeline is set (R-APP1-12.8), the `effects` of the first of these Timeline_Steps SHALL also hold the Highlight_Kind Effect_Requests of criterion 3 and the Fog_Kind Effect_Requests of R-APP1-08.2 (where Fallback_F1 is not in effect), so that the highlights and the fog stay drawn during and after the replay. `timelineFromPropagation` is not used, because the steps it builds hold `targets` only and empty `effects`, so they would draw no Damage_Kind effect.
5. THE Attack_Verdict of the Sample_Mansion SHALL be `true` and its Damage_Set SHALL not be empty; an example test SHALL check this on the bundled Game_Data.
6. THE Mansion_App SHALL let the student act as the ghost only in the Sample phase. In every later Phase the attack comes from the game, and the Ghost_View is a defence tool (intent.md 4.2).

### Requirement 14: Prepare phase (R-APP1-14)

**User Story:** As a student, I want to fix my preset mansion by changing robot keys and marking suspicious letters, so that the robot stays useful but cannot be tricked into causing damage.

#### Acceptance Criteria

1. WHEN the Phase changes to `prepare` for the first time, THE Mansion_App SHALL give the Core_View a new History whose `present` is the Preset_Mansion, and SHALL set Edit_Mode to `edit` and Connect_Mode off.
2. WHILE the Phase is `prepare`, THE Mansion_App SHALL offer the Key_Choice controls of R-APP1-04 for the selected Key_Edge.
3. WHILE the Phase is `prepare`, WHEN the Selection is a Text_Node and the student activates the "don't read" control, THE Mansion_App SHALL pass the Edit_Command of the Dont_Read_Mark (decided in design.md) to the Core_View `execute` function.
4. WHILE the Phase is `prepare`, WHEN the Mansion_App gives the Core_View a new History with `setHistory` or receives a new History from the Edit_Callback, THE Mansion_App SHALL update the values of R-APP1-09.6 and the Effect_Requests of R-APP1-08.2 from that History. No Timeline is set in the Core_View during Prepare, because every change to `prepare` (from `sample` after the Sample replay, or from `lookBack` after a replay) calls `stopTimeline` first (R-APP1-12.8).
5. THE Mansion_App SHALL make every Prepare change with an Edit_Command through the Core_View (`execute`, a Gesture, or Connect_Mode), and SHALL change no Scenario field directly (R-VIEW-01.8).
6. THE Preset_Mansion SHALL have an Attack_Verdict of `true` and a non-empty Damage_Set before any change, and SHALL allow at least one set of Prepare changes that gives the highest number of stars; an example test SHALL check both on the bundled Game_Data by applying that set of Edit_Commands.

### Requirement 15: Ghost Night intrusion replay (R-APP1-15)

**User Story:** As a student, I want to watch the robot do its jobs in order and see whether a hidden command tricks it and where damage spreads, so that I see the effect of my keys.

#### Acceptance Criteria

1. WHEN the Phase changes to `ghostNight`, THE Mansion_App SHALL set Edit_Mode to `view`, compute the Attack_Verdict (R-APP1-06) and the damage (R-APP1-07) on the start state of the night, build the Night_Timeline with `createTimeline` of the Rule_Engine, and start it with the Core_View `startTimeline` function.
2. THE Night_Timeline SHALL hold one Timeline_Step per Robot_Job, in Robot_Job order, whose `targets` hold the Robot_Node and the Node of that job. WHEN the Attack_Verdict is `true`, the Night_Timeline SHALL continue with one Timeline_Step per Step_Number from 1 to the largest Step_Number of the Propagation_Result, whose `effects` hold the Damage_Kind Effect_Requests of the Nodes reached at that Step_Number and the Edges by which they were reached. WHEN the Attack_Verdict is `true`, the `effects` of the Timeline_Step of the Robot_Job that reads the Hidden_Text SHALL hold the Bell_Stop_Kind Effect_Requests of R-APP1-07.4 (this step exists also when the Damage_Set is empty). Because the Core_View draws only Timeline effects while the Timeline is set (R-APP1-12.8), the `effects` of the first Timeline_Step SHALL also hold the Fog_Kind Effect_Requests of R-APP1-08.2 for the night start state (where Fallback_F1 is not in effect).
3. WHEN the Attack_Verdict is `true`, the Timeline_Step of the Robot_Job that reads the Hidden_Text SHALL be the step after which the damage steps start, and THE Mansion_App SHALL show on that step an English line saying the robot followed a hidden command placed by the game.
4. WHILE the Night_Timeline plays, THE Mansion_App SHALL show the label of the current Robot_Job, taken from the Timeline_Callback `position`.
5. WHEN the Core_View reports the end of the Night_Timeline (R-VIEW-18.5), THE Mansion_App SHALL move the Phase as in R-APP1-12.1 (to `fixIt` when the Damage_Set is not empty, else to `lookBack`).
6. THE Mansion_App SHALL offer the Overhead_View and the Ghost_View controls during Ghost Night.

### Requirement 16: Fix It response operations (R-APP1-16)

**User Story:** As a student, I want to respond to the incident on the same 3D graph by stopping the robot, cutting a key line, and consulting an adult or friend, so that I learn what to do when something goes wrong.

#### Acceptance Criteria

1. WHEN the Phase changes to `fixIt`, THE Mansion_App SHALL give the Core_View, with `setHistory`, the `history` of the result of `createHistory(<night start state>, 100)` of `core/model/history.ts` (empty `past` and `future`; 100 is `DEFAULT_HISTORY_LIMIT`), set Edit_Mode to `edit`, show the incident "the robot sent a strange message to the class group!" (wording in design.md), and start an empty Action_Log. Because `past` starts empty, the Fix It start state is `past[0]` (or `present` while `past` is empty), and undo cannot go back into Prepare. `createHistory` returns `{ ok: true, history }` or `{ ok: false, errors }`; IF it returns `ok: false`, THEN THE Mansion_App SHALL act as in R-APP1-02.4.
2. WHILE the Phase is `fixIt`, WHEN the Selection is the Robot_Node and the student activates the "stop the robot" control, THE Mansion_App SHALL pass the Stop_Robot Edit_Command to the Core_View `execute` function.
3. WHILE the Phase is `fixIt`, WHEN the Selection is a Key_Edge and the student activates the "cut the key line" control, THE Mansion_App SHALL pass one remove Edge Edit_Command for that Edge to the Core_View `execute` function.
4. WHILE the Phase is `fixIt`, WHEN the student activates the "consult" control, THE Mansion_App SHALL turn Connect_Mode on with the Consult_Edge Edge_Type (R-VIEW-15.1; the first clicked Node becomes `from` and the second becomes `to`, so the student clicks the Helper_Node second), and WHEN the add Edge Edit_Command of that connection is accepted, THE Mansion_App SHALL turn Connect_Mode off. The student can also leave Connect_Mode without a connection as in R-APP1-19.9, so that Stop_Robot and Cut_Key stay reachable after "consult".
5. WHEN the Edit_Callback reports `{ kind: "history", history }` during Fix It, THE Mansion_App SHALL derive the Action_Log from that History alone. A History stores Scenarios only (`{ past, present, future, limit }`) and no Edit_Commands, so THE Mansion_App SHALL walk the Scenario sequence `past[0]`, …, `past[past.length − 1]`, `present` in order and classify the difference between each pair of adjacent Scenarios into at most these Response_Operations: **Stop_Robot** when the stop mark of the Robot_Node (stored as decided in design.md) changes from not stopped to stopped; **Cut_Key** when a Key_Edge of the earlier Scenario is missing from the later one; **Consult** when a Consult_Edge whose `to` is a Helper_Node is in the later Scenario and not in the earlier one. Every other difference, including differences only in `position`, `rotation`, or `scale` (R-APP1-19.5), SHALL add no entry. When one pair holds more than one kind, the entries SHALL be added in the order Stop_Robot, Cut_Key, Consult.
6. WHEN the student undoes or redoes a step of Fix It, THE Mansion_App SHALL derive the Action_Log again as in criterion 5 from the reported History, so that an undone step leaves the Action_Log and a redone step returns to it. IF `past[0]` is not deeply equal to the night start state (the History limit of 100 dropped the oldest entries), THEN THE Mansion_App SHALL first classify the difference between the night start state and `past[0]` as in criterion 5 and SHALL put those entries before the entries of the walk. No change to `core/` is needed. This pair can span many dropped steps, so its entries take the fixed order Stop_Robot, Cut_Key, Consult of criterion 5 and lose the real order of those steps. Also, IF the dropped steps hold Response_Operations whose effects later steps took back, so that `past[0]` is deeply equal to the night start state again, THEN those dropped Response_Operations are missing from the Action_Log. These approximations are accepted, because they need more than 100 Fix It edits, which the three Response_Operations do not need.
7. THE Mansion_App SHALL build at run time one Check_Set with one Check_Item per Response_Operation that holds when its effect is in the Scenario: Robot_Node stopped; a Key_Edge removed, expressed as an `edgeCount` Condition over Key_Edges (Plain_Key and Bell_Key from the Robot_Node) with `max` N − 1, where N is the Key_Edge count of the night start state; and a Consult_Edge to a Helper_Node exists. The Mansion_App SHALL add that Check_Set to the Game_Rules to form a Built_Rules value validated as in R-APP1-02.8, because a Condition sees only the current Scenario. WHEN N is 0, the Key_Edge Check_Item SHALL be built as a Condition that never holds (decided in design.md).
8. WHILE the Phase is `fixIt`, THE Mansion_App SHALL show the three Response_Operations with their done or not-done state from the Check_Result of criterion 7, and one control that moves to Look Back.
9. WHEN the Phase changes to `fixIt`, THE Mansion_App SHALL replay the Night_Timeline up to and including its first damage step (the Timeline_Steps of every Robot_Job and the step of Step_Number 1, built with `createTimeline`) with the Core_View `startTimeline` function, so that the student sees where to act. WHEN the Core_View reports the end of this replay, THE Mansion_App SHALL first call `stopTimeline` (R-APP1-12.9) and SHALL then pass to `setEffects` the Damage_Kind Effect_Requests of the night (R-APP1-07.6) together with the current Fog_Kind Effect_Requests (R-APP1-08.2), so that the damage stays drawn during Fix It (decided at Q15). Without the `stopTimeline` call, the ended replay Timeline would stay set and the Core_View would ignore these Effect_Requests. Effect_Requests that the Mansion_App passes to `setEffects` while the replay runs are drawn only after this `stopTimeline` call.
10. IF the Edit_Callback reports `{ kind: "errors", context, errors, history? }` during Fix It, THEN THE Mansion_App SHALL leave the Action_Log unchanged; the Action_Log is built only from `kind: "history"` reports (criterion 5).

### Requirement 17: Response order check (R-APP1-17)

**User Story:** As a student, I want the game to check the order of my responses by simple before/after rules, so that I learn which step comes first when trouble happens.

#### Acceptance Criteria

1. THE Game_Data SHALL hold the Order_Rules, each naming two different Response_Operations A and B and meaning "A comes before B". The rules are decided in design.md (for example "Stop_Robot comes before Cut_Key", intent.md 4.6 step 4).
2. THE Mansion_App SHALL check the Action_Log against the Order_Rules with an App_Rule_Function that, for each Order_Rule, returns met when the first entry of A comes before the first entry of B in the Action_Log, not met when B comes first or A is missing while B is present, and not applicable when B is missing.
3. THE App_Rule_Function of criterion 2 SHALL read only the order of the Action_Log entries and the Order_Rules, and SHALL use no clock value or time stamp.
4. WHEN the Phase changes from `fixIt` to `lookBack`, THE Mansion_App SHALL store the Response_Result (R-APP1-16.7 and criterion 2) for display in Look Back.

### Requirement 18: Look Back phase (R-APP1-18)

**User Story:** As a student, I want to replay the night, see where the damage could have been stopped, and check my score, so that I can prepare again and do better.

#### Acceptance Criteria

1. WHILE the Phase is `lookBack`, THE Mansion_App SHALL set Edit_Mode to `view` and show the Score_Point and stars (R-APP1-10.5), the Attack_Card with the Precondition results of the night start state (R-APP1-05.6), and the Response_Result when Fix It took place.
2. WHILE the Phase is `lookBack`, WHEN the student activates the "replay" control, THE Mansion_App SHALL give the Core_View the History of the night start state and play the Night_Timeline again with `startTimeline`. WHEN the Core_View reports the end of this replay, THE Mansion_App SHALL call `stopTimeline` and pass the Look_Back_Effects of criterion 6 to `setEffects` again (R-APP1-12.9).
3. WHILE the Phase is `lookBack` and the Damage_Set of the night is not empty, THE Mansion_App SHALL mark, with Effect_Requests given by `setEffects` after the `stopTimeline` call of R-APP1-12.8, every traversed Edge of the Propagation_Result that is a Key_Edge as a place where a Bell_Key or a cut line would have stopped the damage, and SHALL mark in the Attack_Card every Precondition that held as a condition the student could break. The Effect_Kind of the traversed Key_Edge mark is decided in design.md.
4. WHILE the Phase is `lookBack`, THE Mansion_App SHALL show one "prepare again" control that moves to `prepare` as in R-APP1-12.5.
5. THE Mansion_App SHALL show no technical term (for example "prompt injection", "excessive agency", "hallucination") and no OWASP item in any Phase; such terms belong to the field guide (Should; intent.md 4.1).
6. WHEN the Phase changes to `lookBack`, THE Mansion_App SHALL, in this order, call `stopTimeline` (R-APP1-12.8), give the Core_View with `setHistory` the `history` of the result of `createHistory(<night start state>, 100)` (an `ok: false` result handled as in R-APP1-16.1), and then pass the Look_Back_Effects to `setEffects`. The Look_Back_Effects are: the Effect_Requests of criterion 3 (when the Damage_Set of the night is not empty); WHEN the Attack_Verdict of the night is `true`, the Bell_Stop_Kind Effect_Requests of R-APP1-07.4 for the night start state, also when the Damage_Set is empty (no Bell_Stop_Kind Effect_Request when the Attack_Verdict is `false`); and the Fog_Kind Effect_Requests of R-APP1-08.2 for the night start state (where Fallback_F1 is not in effect). Reason: the Core_View computes the Visible_Set from `history.present` (`core/view/scene/fog-volume.tsx`, `core/view/scene/edge-line.tsx`), and `drawableEffects` (`core/view/helpers/effects-view.ts`) drops an Effect_Request whose target is not in the Visible_Set, so with the Fix It end state still set, the marks on Key_Edges cut in Fix It would not be drawn, and the board would disagree with the Attack_Card and the Score_Point of the night start state. The Fix It end state is not needed after this call: the Response_Result is stored before it (R-APP1-17.4), and the retry (R-APP1-12.5) and the Score_Point (R-APP1-10.1) use the night start state.

### Requirement 19: Edit mode, undo and redo (R-APP1-19)

**User Story:** As a student, I want to undo and redo every change I make while preparing or fixing, so that I can try ideas without fear.

#### Acceptance Criteria

1. WHILE the Phase is `prepare` or `fixIt`, THE Mansion_App SHALL show an undo control and a redo control that call the Core_View `undo` and `redo` functions.
2. WHILE the Phase is `sample`, `ghostNight`, or `lookBack`, THE Mansion_App SHALL set Edit_Mode to `view` and SHALL show the undo and redo controls as disabled.
3. WHEN the Phase changes, THE Mansion_App SHALL turn Connect_Mode off.
4. THE Mansion_App SHALL keep no edit state of its own besides the History given by the Edit_Callback, the night start state, and the Action_Log.
5. THE Mansion_App SHALL treat moving, rotating, and scaling Nodes as visual only: no judgement of this spec SHALL depend on `position`, `rotation`, or `scale` (intent.md 3.3; R-RULES-03.7; decided at Q6). Undo and the retry of R-APP1-12.5 and R-APP1-12.6 restore the earlier `scale`.
6. THE Mansion_App SHALL issue no Edit_Command that changes the `zone` of a Node, so that the Ghost_View Visibility_Filter and every Precondition that selects by Zone see the Zones of the Preset_Mansion. A core-view drag changes only `position.x` and `position.z` (`dragCommand` in `core/view/helpers/gesture-commands.ts`) and never `zone`, so a Node dragged outside its Floor footprint keeps its Zone.
7. THE Mansion_App SHALL issue a remove Edge Edit_Command only for a Key_Edge (R-APP1-04.5, R-APP1-16.3), and SHALL offer no control that removes a Read_Edge, a Cite_Edge, or a Consult_Edge. The Core_View itself makes no remove Edit_Command: its Gestures make only update Node Edit_Commands of `position`, `rotation`, or `scale` and, in Connect_Mode, add Edge Edit_Commands (`core/view/helpers/gesture-commands.ts`); the "Remove selected edge" button exists only in `core/view/demo/`, which the Mansion_App does not import (R-APP1-21.1). A Cite_Edge or Consult_Edge added by mistake is taken back only with undo. A Dont_Read_Mark that design.md stores on a Read_Edge SHALL use an update Edge Edit_Command, not a remove.
8. THE Game_Rules and the Action_Log SHALL judge a Cite_Edge only when its `from` is an Answer_Node and its `to` is a Source_Node (R-APP1-08.1), and a Consult_Edge only when its `to` is a Helper_Node (R-APP1-16.5, R-APP1-16.7), and SHALL list no Cite_Edge or Consult_Edge Edge_Type in `propagation.pass` (R-APP1-04.2), so that such an Edge between other Nodes changes no judgement. Reason: Connect_Mode connects any two different Nodes with the Edge_Type the Mansion_App set and checks no Node_Type (`connectClick` in `core/view/helpers/view-state.ts`, `connectCommand` in `core/view/helpers/gesture-commands.ts`).
9. WHILE the Phase is `prepare` or `fixIt` and Connect_Mode is on, THE Mansion_App SHALL show one enabled "cancel" control, and WHEN the student activates that control or any enabled control that starts another operation (a Key_Choice, "don't read", "stop the robot", or "cut the key line"), THE Mansion_App SHALL call the Core_View `connectOff` function before that operation. `connectOn` keeps the Selection it finds (`connectOn` in `core/view/helpers/view-state.ts`), but no new Node or Edge can be selected while Connect_Mode is on, so the "cancel" control is the way back to selecting. Reason: while Connect_Mode is on, the Core_View ignores every Node and Edge selection (`select` in `core/view/helpers/view-state.ts` keeps the Selection unchanged when `connect` is not `null`, and an Edge click is an empty click, `edgeClickAction` in `core/view/helpers/connect-ui.ts`), and an empty click clears the Selection and the pending first Node but leaves Connect_Mode on (`emptyClick` in `core/view/scene/view-store.ts`), so without `connectOff` the student could not select the Robot_Node or a Key_Edge for another operation.

### Requirement 20: Loop time and first minute (R-APP1-20)

**User Story:** As a judge, I want one full loop to take 60–90 seconds, so that I can try the game within the judging time.

#### Acceptance Criteria

1. THE View_Settings and the Game_Data SHALL set the Step_Duration, the number of Robot_Jobs, and the propagation length of the Preset_Mansion so that the automatic playback in Sample (R-APP1-13.4), in Ghost Night (R-APP1-15.1), and in Fix It (R-APP1-16.9) each take at most 15 seconds on the Reference_Machine, and the three together take at most 35 seconds. The Look Back replay (R-APP1-18.2) is started only by the student and is not on the click path of criterion 2.
2. THE Mansion_App SHALL let a person who knows one winning set of Prepare changes (R-APP1-14.6) go from opening `/ghost-mansion/` to the Look Back phase with at most 12 control activations or clicks, not counting camera moves. design.md lists that click path.
3. WHEN a person follows the click path of criterion 2 on the Public_URL, the time from opening the page to the Look Back phase SHALL be at most 90 seconds, checked by a human at the verification gate and recorded in `docs/decision-log.md`. Only the 90-second upper bound is pass/fail; 60 seconds is a guide for the intended length (intent.md 4.2) and a shorter time does not fail.

### Requirement 21: Determinism, rules decide, and boundary (R-APP1-21)

**User Story:** As the developer, I want every game result to come from rules over data and the App to use the core only through its public interfaces, so that results are repeatable and the core stays generic.

#### Acceptance Criteria

1. THE Mansion_App SHALL import from `core/` only symbols that non-test source files of `core/model/` and `core/view/` export (as in R-VIEW-01.3), and SHALL import no `*.test.ts` file and no file under `core/view/demo/`.
2. THE Repository SHALL contain no change to any file under `core/` made by the tasks of this spec, and no App_Specific_Name under `core/` (R-GRAPH-10.2, R-VIEW-01.6). The existing name test of R-FND-10.15 checks the second part.
3. THE Mansion_App SHALL decide the Attack_Verdict, the Damage_Set, the Damage_Score, the Convenience_Score, the stars, the Plausible_Ghost fog, and the Response_Result only by the Rule_Engine and App_Rule_Functions, from the current Scenario and the Game_Data.
4. WHEN any judgement function of criterion 3 is called twice with deeply equal arguments, THE Mansion_App SHALL return deeply equal results (intent.md 10.6 "same input → same result").
5. THE Mansion_App SHALL contain no AI_Adapter call, no LLM client, no AI package, and no network request in any judgement path. The Robot SHALL run on rules only.
6. THE Repository SHALL place each test of the Mansion_App next to its source as `<base name>.test.ts`. Tests of App_Rule_Functions and Game_Data SHALL run under Vitest in a Node environment with no browser or DOM emulation.
7. THE Mansion_App SHALL keep every Ghost Mansion name (ghost, robot, mansion, key, and the like) in files under `apps/ghost-mansion/`, and SHALL give the core these names only as Identifiers inside Game_Data.

### Requirement 22: UI text (R-APP1-22)

**User Story:** As an English-speaking judge, I want the whole game in English, so that I can play without translation.

#### Acceptance Criteria

1. THE Mansion_App SHALL store every text shown to a person (UI labels, instructions, Phase names, Attack_Card texts, Robot_Job labels, incident text, Game_Data labels) as a Localized_Text `{ en, ja }` with a non-empty `en` value.
2. THE Mansion_App SHALL show the `en` value of every Localized_Text (tech.md "English by default"). A JA/EN switch is Should and is not built.
3. THE Mansion_App SHALL draw every text as plain text and never as HTML (S-VIEW-2).

### Requirement 23: Fallback variants (R-APP1-23)

**User Story:** As the developer, I want the fallbacks of intent.md ch. 7 written as switches of this spec, so that I can narrow the scope without rewriting the requirements.

The human decided on 2026-11-23 not to apply Fallback_F1 or Fallback_F2 (decided at Q2, recorded in `docs/decision-log.md`). Both switches are off by default.

#### Acceptance Criteria

1. WHERE Fallback_F1 is in effect, THE Mansion_App SHALL build no Plausible_Ghost Node_Rule, Effect_Rule, Answer_Node, Source_Node, or Cite_Edge control, and R-APP1-03.5 and R-APP1-08 SHALL not apply.
2. WHERE Fallback_F2 is in effect, Fallback_F1 SHALL also be in effect, THE Game_Data SHALL hold three Robot_Jobs (R-APP1-09.2), and damage SHALL spread one step only (R-APP1-07.5).
3. THE Mansion_App SHALL build with Fallback_F1 and Fallback_F2 off, as recorded in `docs/decision-log.md` on 2026-11-23.
4. WHEN the human later decides to turn on a fallback, THE Repository SHALL contain one more line in `docs/decision-log.md` that names the fallback and its date (intent.md ch. 7).

## PBT properties

These properties come from intent.md 10.6. The five core properties are covered by `core-graph` (P-GRAPH-1, P-GRAPH-3, P-GRAPH-4) and `core-rules` (P-RULES-1 to P-RULES-3). This spec adds App-level properties over the Game_Rules, the App_Rule_Functions, and the bundled Preset_Mansion, all testable without rendering. Each property runs at least 100 generated cases with fast-check, and each test name contains its property ID (as in R-FND-10.5).

Generators produce variants of the bundled Preset_Mansion: every combination or random subset of Key_Choices (Plain_Key, Bell_Key, No_Line) for its Key_Edges, with and without Dont_Read_Marks, with and without Stop_Robot, with and without Cite_Edges and Consult_Edges, and with random `position`, `rotation`, and `scale` values; random Action_Logs over the three Response_Operations (with repeats and missing operations); random Order_Rule lists; random Score_Points within the range the Preset_Mansion can produce; and random sequences of Phase actions.

- **P-APP1-1 (same input → same result).** FOR ALL mansion variants, Action_Logs, and Phase states, computing the Attack_Verdict, the Damage_Set, the Damage_Score, the Convenience_Score, the stars, the fog Effect_Requests, the Response_Result, and the next Phase state twice on deep copies SHALL give deeply equal results, and SHALL leave every argument unchanged. (R-APP1-21.4, R-APP1-06.6, R-APP1-10.6)
- **P-APP1-2 (safer keys never increase damage).** FOR ALL mansion variants, changing any Key_Edge from Plain_Key to Bell_Key, or removing any Key_Edge, SHALL never add a Node to the Damage_Set and SHALL never increase the Damage_Score. (R-APP1-04.1, R-APP1-07.1, R-APP1-07.2; builds on P-RULES-2 and P-RULES-3, with Importance ≥ 0)
- **P-APP1-3 (fewer keys never increase convenience).** FOR ALL mansion variants, changing any Key_Edge from Plain_Key to Bell_Key, or removing any Key_Edge, SHALL never increase the Convenience_Score, and removing every Key_Edge SHALL give a Convenience_Score of 0. (R-APP1-09.4, R-APP1-09.5)
- **P-APP1-4 (star table is total and monotone).** FOR ALL Score_Points in range, the Star_Table lookup SHALL return exactly one star count in the range of design.md; lowering the Damage_Score with the same Convenience_Score, or raising the Convenience_Score with the same Damage_Score, SHALL never lower the stars; and no Score_Point with Convenience_Score 0 SHALL get the highest star count. (R-APP1-10.2 to R-APP1-10.4)
- **P-APP1-5 (attack needs every precondition).** FOR ALL mansion variants, the Attack_Verdict SHALL equal the conjunction of the Precondition results; when the Attack_Verdict is `false` the Ghost Night Damage_Set SHALL be empty; a Stop_Robot, or a Dont_Read_Mark on every Text_Node with a Hidden_Text, SHALL make the Attack_Verdict `false`. (R-APP1-06.1 to R-APP1-06.4, R-APP1-07.3)
- **P-APP1-6 (transforms do not change judgements).** FOR ALL mansion variants, changing the `position`, `rotation`, or `scale` of any Node SHALL leave every result of P-APP1-1 deeply equal. (R-APP1-03.7, R-APP1-19.5)
- **P-APP1-7 (order check agrees with a reference model).** FOR ALL Action_Logs and Order_Rules, the order App_Rule_Function SHALL return, for each Order_Rule, the value of a simple reference implementation of R-APP1-17.2; appending an operation that is already in the Action_Log SHALL change no result; and the result SHALL depend only on the order of the entries. (R-APP1-17.2, R-APP1-17.3)
- **P-APP1-8 (phase flow).** FOR ALL sequences of Phase actions from the initial state, every reached Phase state SHALL be one of the five Phases, every move SHALL be one allowed by R-APP1-12.1, `fixIt` SHALL be reached only from `ghostNight` with a non-empty Damage_Set, and a disallowed action SHALL leave the state unchanged. (R-APP1-12.1, R-APP1-12.2, R-APP1-12.7)
- **P-APP1-9 (sample mansion derivation).** FOR ALL mansion variants, the derived Sample_Mansion SHALL have every Key_Edge of type Plain_Key, SHALL differ from its input only in Key_Edge types, and deriving again from the Sample_Mansion SHALL give a deeply equal Scenario (idempotence). (R-APP1-13.2)
- **P-APP1-10 (plausible ghost fog).** WHERE Fallback_F1 is not in effect, FOR ALL mansion variants, the Fog_Kind Effect_Requests SHALL target exactly the Answer_Nodes that have no Cite_Edge to a Source_Node; and adding or removing a Cite_Edge (which changes the fog) SHALL leave the Damage_Score, the Score_Point, and the stars unchanged whenever the Key_Edges, Dont_Read_Marks, and stop mark are unchanged. (R-APP1-08.1, R-APP1-08.2, R-APP1-07.2)
- **P-APP1-11 (night timeline shape).** FOR ALL mansion variants, the Night_Timeline SHALL hold one step per Robot_Job in order, followed by damage steps only when the Attack_Verdict is `true`; across the damage steps every Node of the Damage_Set SHALL appear exactly once in a Damage_Kind Effect_Request, and the Robot_Node SHALL appear in no Damage_Kind Effect_Request (also for the effects of R-APP1-07.6). (R-APP1-15.2, R-APP1-07.6)
- **P-APP1-12 (action log from history).** FOR ALL sequences of at most 100 Fix It Edit_Commands (Response_Operations mixed with moves, rotations, and scalings of Nodes) applied to a History made by `createHistory(<night start state>, 100)`, followed by random undo and redo, the Action_Log derived by R-APP1-16.5 and R-APP1-16.6 SHALL equal the Response_Operations that appear as Scenario differences (R-APP1-16.5) among the applied steps that are still in `past` or `present`, in order; a step that makes no such difference (for example Stop_Robot on a Robot_Node that is already stopped) and moves, rotations, and scalings SHALL add no entry. (R-APP1-16.1, R-APP1-16.5, R-APP1-16.6)

Example tests cover the bundled Game_Data (R-APP1-02.5, R-APP1-02.6, R-APP1-02.8, R-APP1-02.9, R-APP1-03.6, R-APP1-13.5, R-APP1-14.6), the Hidden_Text limits (R-APP1-05.4), the run-time Key_Edge Check_Item for N = 0 and N ≥ 1 (R-APP1-16.7), the Action_Log when more than 100 Fix It steps drop the oldest `past` entries (R-APP1-16.6), the unchanged Action_Log after an `errors` report (R-APP1-16.10), the Fix It replay Timeline that ends at the first damage step (R-APP1-16.9), the `createHistory` failure path (R-APP1-16.1), no Bell_Stop_Kind Effect_Request when the Attack_Verdict is `false` (R-APP1-07.4), the order of Core_View calls on a Phase change and on a replay end, with `stopTimeline` first (R-APP1-12.8, R-APP1-12.9; tested with a recording stub of the Core_View handle), including the change to `lookBack` as `stopTimeline`, then `setHistory` with the night start state, then `setEffects` with the Look_Back_Effects (R-APP1-18.6), and the Look_Back_Effects with and without Bell_Stop_Kind Effect_Requests for an Attack_Verdict of `true` (also with an empty Damage_Set) and `false` (R-APP1-18.6), and the `connectOff` call of the "cancel" control (R-APP1-19.9). The 3D behaviour, the click path, and the loop time (R-APP1-01, R-APP1-11, R-APP1-15.4, R-APP1-20.3) are checked by a human on the Public_URL at the verification gate.

## Safety

Follows `safety.md` (intent.md ch. 9). The `reviewer` agent checks every rule here before plan approval and before the verification gate.

- **S-APP1-1 (abstract attacks only).** THE Mansion_App SHALL show the attack only as the abstract Attack_Card of R-APP1-05. No file under `apps/ghost-mansion/` SHALL contain code, commands, or text that would work as a real attack, including the Hidden_Text, which is a fixed short phrase that only makes sense inside the game (R-APP1-05.4, R-APP1-05.5).
- **S-APP1-2 (teach spotting and stopping).** THE Mansion_App SHALL teach how to spot and stop the attack (keys, bell keys, cutting lines, not reading, stopping the robot, consulting a person) and SHALL show no attack steps. The student acts as the ghost only in the Sample phase, against the game's own Sample_Mansion (R-APP1-13.6).
- **S-APP1-3 (robot on rules).** THE Robot SHALL run on the Game_Rules and App_Rule_Functions only, never on a real LLM, and no AI_Adapter SHALL be called in this spec (R-APP1-21.5).
- **S-APP1-4 (no voice or deepfake).** This spec builds no voice node. The Mimic Ghost is Should and out of scope; no real voice clone or deepfake is made.
- **S-APP1-5 (no personal data, no login).** THE Mansion_App SHALL collect no personal information, SHALL require no login, SHALL ask for no name or text input about the student, and SHALL store nothing in the browser (no cookies, local storage, or IndexedDB).
- **S-APP1-6 (fictional material).** Every Node text, icon, and image in the Game_Data SHALL be fictional or made by the developer (R-APP1-03.8).
- **S-APP1-7 (claims and sources).** The Must scope shows no OWASP mapping and no competitor claim in the UI (R-APP1-18.5). IF the README, the demo text, or any later document of this App maps a ghost to OWASP, THEN it SHALL name the version (OWASP Top 10 for LLM Applications 2025, intent.md 4.9) with its source URL and check date, and SHALL describe the Mimic Ghost separately from the OWASP items. Before submission, the OWASP version and item numbers SHALL be re-checked against the official OWASP source (intent.md 4.9).
- **S-APP1-8 (static site).** THE Mansion_App SHALL run as a static site with no backend and SHALL make no network request to another origin (R-APP1-01.4).

## Open questions

### 決定済み

- **Q1 判定の一部をアプリ側の関数で行うこと**（決定済み 2026-11-23）：2軸評価の式、⭐の表引き、対処の順番の判定は、Rule_Engine の結果を入力にした決定論的なアプリ側の純関数（App_Rule_Function）で行います。core は変更しません。
- **Q2 11/23 の撤退ライン**（決定済み 2026-11-23、decision-log に記録済み）：F1・F2 は適用しません。理由：日程は後で取り戻せると人が判断したため。まことしやかおばけは Must のままです。R-APP1-23 の切り替えは残し、既定はオフです。
- **Q3 難しさの段階**（決定済み 2026-11-23、decision-log に記録済み）：Must は1段階だけです（Must_Level：初級の部屋数3〜4に、連鎖攻撃とまことしやかおばけの2体、対処3つを組み合わせたもの）。初級と中級に分けるのは Should です。
- **Q5 ルール定義などの保存場所**（決定済み 2026-11-23）：`apps/ghost-mansion/rules/` に JSON で置き、起動時と example test（R-APP1-02.5）で検証します。Schema_Sensor は変えません。
- **Q6 gizmo とドラッグを止められない**（決定済み 2026-11-23）：そのまま受け入れます。拡縮・回転は見た目だけで、判定は Importance だけを読みます。元に戻す（undo）とやり直し（R-APP1-12.5、12.6）で元の大きさに戻ります。回避策の要件は置きません。
- **Q4 英語名**（決定済み 2026-11-23）：Hidden-Command Ghost、Key-Thief Ghost、Plausible Ghost、各 Phase の英語名は仮訳のまま使います。
- **Q7 「読ませない」印とロボ停止の表し方**（決定済み 2026-11-23）：既定の方針を承認。「読ませない」印は Node_Type か Edge_Type の変更、ロボ停止は Robot_Node の数値属性（attribute 条件で判定）で表し、詳細は design.md で決めます。core は変更しません。「読ませない」印は Must に含めます。
- **Q8 霧と評価**（決定済み 2026-11-23）：霧のかかった答えの数は被害の軸に加えません。霧は表示だけで、Damage_Score は Damage_Set の Importance の合計だけです（Score_Point と⭐も霧で変わりません）。
- **Q9 ととのえる中の表示**（決定済み 2026-11-23）：ととのえる中は便利さと「だまされた場合の被害」を常に表示し、前提条件の成否はみほんとふりかえりでだけ表示します（R-APP1-09.6）。
- **Q10 再挑戦のときの屋敷**（決定済み 2026-11-23）：「ととのえ直す」はおばけの夜を始めた時点の屋敷に戻し、たいじする中の変更は捨てます。プリセットからやり直すボタンも置きます（R-APP1-12.5、12.6）。
- **Q11 みほんの操作**（決定済み 2026-11-23）：生徒が「次へ」を押すたびに前提条件が1つずつ満たされ、最後に被害の広がりを再生します。生徒が自分で攻撃を置く操作は作りません（R-APP1-13.3）。
- **Q12 写真の背景の手がかり**（決定済み 2026-11-23）：Must は隠れ文字だけです。写真の手がかりは入れません。
- **Q13 相談の線の始点**（決定済み 2026-11-23）：終点が大人・友達ノードであれば始点は問いません（R-APP1-16.5、19.8）。
- **Q14 1周の時間の確認方法**（決定済み 2026-11-23）：design.md のクリック手順に沿って人が公開URLで計測し、decision-log に記録します。合否は90秒以内だけで、60秒は目安です（R-APP1-20.3）。
- **Q15 たいじする（Fix It）で Timeline を使う**（決定済み 2026-11-23、decision-log に記録済み）：たいじするに入ったとき、おばけの夜の Night_Timeline を最初の被害ステップまで `startTimeline` で再生し、どこで手を打てばよいかを見せます（R-APP1-16.9）。

### コードで確認済み（未決にしない）

レビューで未確認とされた点は、core のコードで確かめて本文に書きました。
- ドラッグは Node の `zone` を変えません（`dragCommand` は `position.x`・`position.z` だけを変える）。ゴースト視点の見え方と Zone で選ぶ前提条件は、ドラッグで変わりません（R-APP1-19.6）。
- Node_Selector は、欠けた項目はすべての Node に当たり、空の `ids` リストはどの Node にも当たりません（`matchSelector`）。被害の合計は R-APP1-07.2 のとおりです。
- つなぐモードでは、1つ目にクリックした Node が `from`、2つ目が `to` になります（`connectClick`）。R-APP1-08.3 と R-APP1-16.4 に書きました。つなぐモードは Node_Type を確かめないので、どの2つの Node でもつなげます。判定側で始点・終点の種類を見ます（R-APP1-19.8）。
- Timeline が Core_View に設定されている間は、再生が終わった後（status `ended`）も、`shownEffects` は Timeline の効果だけを描き、`setEffects` で渡した効果を無視します。Timeline を外すのは `stopTimeline` だけで、`setHistory` は外しません。そのため Phase が変わるときと、たいじする・ふりかえりの再生が終わったときに `stopTimeline` を呼びます（R-APP1-12.8、12.9）。
- `propagate` の `stopped` には、到達した Node から出る止める種類の Edge がすべて入ります。ロボ（起点）は常に到達しているので、ロボから出るベル鍵は常に Stopped_Edge です。そのため「ベル鍵が止めた」表示は攻撃が成立したときだけにします（R-APP1-07.4）。
- Theme の効果スタイルは `fog` しかありません（`effectStyleSchema`）。Highlight_Kind と Bell_Stop_Kind は、Damage_Kind と同じく `fog` スタイルを別の色で使います。
- core-view の操作（Gesture）が作るのは、Node の位置・回転・拡縮の更新と、つなぐモードでの Edge 追加だけです。Edge を消す操作は core-view にはなく、「選んだ線を消す」ボタンは `core/view/demo/` にしかありません。Edge を消すのはアプリの操作だけで、消せるのは鍵の線だけにします（R-APP1-19.7）。

### 未決

なし
