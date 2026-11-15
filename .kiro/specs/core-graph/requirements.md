# Requirements Document

## Introduction

`core-graph` is the first of three specs that together make up the shared core of Unit 1 (intent.md 3.1, 3.2, 10.2, 10.6). The `core` spec is split into `core-graph`, `core-rules`, and `core-view` (decision-log 2026-11-15). This spec defines the graph data model in `core/model/`, the Scenario I/O that saves, loads, and validates that model as scenario JSON, and the edit commands with undo and redo that change the model.

In scope:
- `Node`, `Edge`, and `Zone` as data in `core/model/` (intent.md 3.1).
- Node numeric attributes, stored as `Record<string, number>` (intent.md 3.1, 3.2).
- Node front and back (intent.md 3.1). intent.md ch. 7 lists front/back as a core Should item. It is written here because this spec defines the Node data, and it can be dropped without affecting the other requirements.
- Detail data: an optional extra text on a Face, shown when zoomed in. This spec stores it. When to show it is decided by `core-view` (intent.md ch. 7, "zoom detail layers").
- Membership of a Node in a Zone, as an optional reference from the Node to a Zone.
- Scenario JSON save, load, and schema validation with Zod, with every text stored as `{ en, ja }` (intent.md 3.1, ch. 7, ch. 8).
- Edit commands recorded on `core/model` and undo/redo of those commands (intent.md 3.3, ch. 8: "Edit operations are recorded as commands on core/model; the core provides undo/redo").

The model is generic. An App gives the core its scenario JSON and its rule definitions (intent.md 3.2). This spec stores node types, edge types, attribute names, and metadata as opaque values and gives none of them a meaning. Which edge types pass or stop automatic propagation is declared in an App's rule definitions, not here.

This spec extends the minimal Scenario_Schema envelope created by `repo-foundation` (R-FND-08.1) in `core/model/scenario-schema.ts`. The envelope rules stay valid: `schemaVersion` (an integer greater than or equal to 1, as in R-FND-08.1), `id`, and `title` are required, and unknown top-level fields are ignored (decision-log 2026-11-13).

The core boundary rules in R-GRAPH-10 also apply to `core-rules` and to the `core/model/` parts of later specs. Those specs refer to R-GRAPH-10 instead of repeating it.

Out of scope for this spec, with the spec each item belongs to:
- Condition checks, propagation along Edges, path search, numeric attribute aggregation (sum, change along an order), and the PBT properties "removing edges never increases the set of reachable nodes" and "automatic propagation never reaches past an edge type that stops it" (intent.md 10.6): `core-rules`.
- Timeline (ordered playback): `core-rules`.
- The interface that passes judgement results to visual effects (fog, glow): `core-rules`. Drawing those effects: `core-view`.
- 3D rendering, interaction (drag, snapping, gizmo, connecting by clicks, selection), zone height and walls as visuals, the Zone footprint, and the side of a Node currently shown: `core-view`.
- Zoom detail layers as display (level-of-detail, when to show `detail`): `core-view`.
- ViewPreset (camera position, visibility filter, path movement) and walkthrough playback: `core-view`.
- Theme swapping: `core-view`.
- Grouping one user gesture into one Edit_Command: the caller, which is `core-view`.
- AIAdapter (the interface plus a no-AI implementation that returns fixed text from judgement results; real AI is Could): `core-rules`, because its input is judgement results.
- App-specific data analysis (for example, computing numeric attributes from image pixels): `apps/` (intent.md 3.2).
- Storage in IndexedDB, file pickers, and file download: `apps/`. Save and load in this spec work on JSON text only.

## Glossary

- **App**: a program under `apps/` that uses the core. The core knows no App by name.
- **Repository**: this project's Git repository and the files in it.
- **Graph_Model**: the set of types and pure functions in `core/model/` defined by this spec: Scenario, Node, Edge, Zone, the Scenario_IO functions, Edit_Command, the Command_Applier, History, and the History functions.
- **Scenario**: one in-memory document made of the envelope fields (`schemaVersion`, `id`, `title`) and the lists of Nodes, Edges, and Zones.
- **Scenario_File**: a `.json` file under `apps/<app>/scenarios/` (as in R-FND-08).
- **Scenario_Schema**: the single Zod schema in `core/model/scenario-schema.ts` that defines a valid Scenario, including the cross-element checks in R-GRAPH-06.
- **Structural_Check**: every Scenario_Schema check that looks at one value on its own (presence, type, range, Identifier, Localized_Text).
- **Cross_Element_Check**: a Scenario_Schema check that compares values of different elements: duplicate `id` (R-GRAPH-06.3), Edge references (R-GRAPH-06.4), Node Zone references (R-GRAPH-06.9), and duplicate Zone `order` (R-GRAPH-06.10).
- **Scenario_IO**: the pair of pure functions in `core/model/` named Scenario_Loader and Scenario_Saver.
- **Scenario_Loader**: the function that takes JSON text and returns a Load_Result.
- **Scenario_Saver**: the function that takes a Scenario and returns JSON text or a Save_Failure.
- **Load_Result**: either a Load_Success holding one Scenario, or a Load_Failure holding a non-empty list of Validation_Errors.
- **Save_Failure**: the result of the Scenario_Saver when its input is not a valid Scenario; it holds a non-empty list of Validation_Errors.
- **Validation_Error**: one finding with a field path and an English message.
- **Field_Path**: the location of a value. Segments (field names and list indexes) are joined with `.` (for example `nodes.2.position.x`). List indexes are zero-based. The empty string means the root of the input.
- **Schema_Sensor**: the sensor from R-FND-08 that validates Scenario_Files.
- **Lint_Sensor**: the sensor from R-FND-04 and R-FND-07 that runs ESLint with the committed config (`npm run lint`).
- **Localized_Text**: a text value stored as `{ en, ja }`, where `en` is required and is a string of at least 1 character after trimming, and `ja`, if present, is a string (R-FND-08.1).
- **Identifier**: a string of at least 1 character after trimming. Identifiers are stored and compared exactly, character for character, and are never trimmed.
- **Node**: one element of the graph with an Identifier, a Node_Type, a position, a rotation, a scale, a Front_Face, an optional Back_Face, an optional Zone reference, Metadata, and Numeric_Attributes.
- **Node_Type**: an Identifier chosen by the App that names the kind of a Node. The Graph_Model gives it no meaning.
- **Face**: the content of one side of a Node: an optional Localized_Text `text`, an optional Image_Reference `image`, and an optional Localized_Text `detail`. A Face holds `text`, `image`, or both.
- **Front_Face**: the Face shown by default.
- **Back_Face**: the optional second Face of a Node.
- **Image_Reference**: a string of at least 1 character after trimming that the App uses to find an image (for example a storage key or a bundled file path, chosen by the App). The Graph_Model stores it unchanged and never reads the image.
- **Metadata**: a JSON object attached to a Node whose content the App defines. The Graph_Model stores it unchanged.
- **Numeric_Attributes**: a `Record<string, number>` attached to a Node, whose attribute names are Identifiers and whose values are Finite_Numbers.
- **Edge**: a directed connection with an Identifier, a source Node (`from`), a target Node (`to`), an Edge_Type, and an optional label as Localized_Text.
- **Edge_Type**: an Identifier chosen by the App that names the kind of an Edge. The Graph_Model gives it no meaning; App rule definitions decide whether it passes or stops automatic propagation.
- **Zone**: a part of the space with an Identifier, a label as Localized_Text, an order, an elevation, and an enclosure flag.
- **Finite_Number**: a JSON number that is not NaN, Infinity, or -Infinity.
- **Positive_Number**: a Finite_Number greater than 0.
- **App_Specific_Name**: any name in the list in `.kiro/steering/structure.md` under "Core / app boundary", and the folder names under `apps/`.
- **Edit_Command**: a plain data value that describes one change to a Scenario. It has a `kind` and the fields that kind needs (R-GRAPH-11.1). The kind `batch` holds a list of other Edit_Commands in a field named `commands` (Batch_Command).
- **Batch_Command**: an Edit_Command of kind `batch`. Its `commands` list holds Edit_Commands of any kind except `batch`, and is applied as one change (R-GRAPH-11.17 to R-GRAPH-11.20).
- **Command_Applier**: the pure function `apply(scenario, command)` that returns an Apply_Result.
- **Apply_Result**: either an Apply_Success holding one new Scenario, or an Apply_Failure holding a non-empty list of Validation_Errors.
- **History**: a plain data value with `past` (a list of Scenarios), `present` (one Scenario), `future` (a list of Scenarios), and `limit` (a Positive_Integer, the maximum length of `past`).
- **Positive_Integer**: a JSON number that is an integer greater than 0 and at most 9,007,199,254,740,991.
- **History_Functions**: the pure functions that create a History (taking a Scenario and an optional `limit`, default 100), execute an Edit_Command on a History, undo, and redo.

## Requirements

### Requirement 1: Node data (R-GRAPH-01)

**User Story:** As an App developer, I want one generic Node record with type, transform, content, and metadata, so that each App can describe its own elements without changing the core.

#### Acceptance Criteria

1. THE Graph_Model SHALL define a Node with the required fields `id` (Identifier), `type` (Node_Type), `position` (`x`, `y`, `z`), `rotation` (`x`, `y`, `z`), `scale` (`x`, `y`, `z`), `front` (Front_Face), `metadata` (Metadata), and `attributes` (Numeric_Attributes), and the optional fields `back` (Back_Face) and `zone` (Identifier of a Zone).
2. THE Scenario_Schema SHALL accept as `position` and `rotation` only objects that have all three of `x`, `y`, and `z`, each a Finite_Number. It SHALL reject a missing component, a string, a boolean, `null`, or a non-finite value with a Validation_Error whose Field_Path names the component (for example `nodes.2.position.x`).
3. THE Scenario_Schema SHALL accept as `scale` only objects that have all three of `x`, `y`, and `z`, each a Positive_Number. It SHALL reject a missing component, a non-number, a non-finite value, `0`, or a negative value with a Validation_Error whose Field_Path names the component (for example `nodes.2.scale.y`).
4. THE Scenario_Schema SHALL accept any Identifier as a Node_Type, SHALL contain no list of allowed Node_Type values, and SHALL reject a `type` that is not a string or is empty after trimming with a Validation_Error whose Field_Path is `nodes.<index>.type`.
5. THE Scenario_Schema SHALL accept as `metadata` any JSON object, including the empty object `{}` and objects whose values are nested objects, arrays, strings, numbers, booleans, or `null`. THE Graph_Model SHALL keep `metadata` unchanged through save and load: the loaded value has the same keys and the same values at every nesting level, so it is deeply equal to the saved value (P-GRAPH-1).
6. IF a Node in a Scenario lacks a required field of criterion 1, or has a field of the wrong type, THEN THE Scenario_Schema SHALL report one Validation_Error per faulty field, with the Field_Path `nodes.<index>.<field>`, where `<index>` is the zero-based position of the Node in `nodes`. It SHALL report the faulty fields of every Node in the Scenario, not only the first one found, and the Scenario_Loader SHALL return a Load_Failure holding no Scenario.
7. IF a Node's `metadata` is an array, `null`, a string, a number, or a boolean, THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path is `nodes.<index>.metadata`.
8. THE Graph_Model SHALL store `rotation` as data only, with each component in radians, and no function in the Graph_Model SHALL read `rotation` to decide any result other than validation, save, load, and edit (intent.md 3.3: rotation has no meaning in the rules of either app).
9. IF a Node has a `zone` field that is not an Identifier, THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path is `nodes.<index>.zone`. The check that the Identifier names a Zone is R-GRAPH-06.9.

### Requirement 2: Node numeric attributes (R-GRAPH-02)

**User Story:** As an App developer, I want to attach named numbers to a Node, so that the App can compute values in `apps/` and pass them to the core as plain numbers.

#### Acceptance Criteria

1. THE Graph_Model SHALL store the Numeric_Attributes of each Node in that Node's `attributes` field as a `Record<string, number>` that maps each attribute name to exactly one Finite_Number.
2. THE Scenario_Schema SHALL accept `{}` (zero attribute names) as the `attributes` value of a Node, and THE Graph_Model SHALL add no attribute name to it on load or save.
3. THE Scenario_Schema SHALL accept any Identifier as an attribute name and any Finite_Number as a value, including negative, zero, and fractional values. THE Scenario_Schema SHALL contain no list of allowed attribute names, no default attributes, and no value range narrower than Finite_Number.
4. IF a Numeric_Attributes value is not a Finite_Number (for example a JSON string, including a numeric string such as `"1"`, a boolean, `null`, an array, or an object), THEN THE Scenario_Schema SHALL report a Validation_Error with the Field_Path `nodes.<node index>.attributes.<attribute name>` and SHALL NOT convert the value to a number.
5. IF a Numeric_Attributes attribute name is not an Identifier (the empty string or a string made only of whitespace), THEN THE Scenario_Schema SHALL report a Validation_Error with the Field_Path `nodes.<node index>.attributes`, and its message SHALL quote the rejected attribute name.
6. THE Graph_Model SHALL keep Numeric_Attributes unchanged through save and load (P-GRAPH-1): the same set of attribute names, each name identical character for character with no trimming and no case change, and each value equal to the saved number (`-0` and `0` count as equal). Names that differ only in letter case or in leading or trailing whitespace SHALL stay separate attributes.
7. IF the `attributes` field of a Node is not a JSON object (for example an array, `null`, a string, a number, or a boolean), THEN THE Scenario_Schema SHALL report a Validation_Error with the Field_Path `nodes.<node index>.attributes`.
8. IF one Node has more than one invalid attribute name or value, THEN THE Scenario_Schema SHALL report one Validation_Error for each invalid name or value, not only the first one (consistent with R-GRAPH-07.4).
9. WHERE an attribute name equals a built-in JavaScript object property name (`__proto__`, `constructor`, or `prototype`), THE Graph_Model SHALL store it as an ordinary attribute that is kept through save and load (criterion 6), and SHALL change no attribute of any other Node and no field of the Scenario (S-GRAPH-2).

### Requirement 3: Node front, back, and detail (R-GRAPH-03)

**User Story:** As an App developer, I want a Node to have a front side, an optional back side, and optional detail text, so that the App can show more layers of content on the same Node.

#### Acceptance Criteria

1. THE Graph_Model SHALL define a Face as an object with three optional fields: `text` (Localized_Text), `image` (Image_Reference), and `detail` (Localized_Text). Text and image SHALL be the only content kinds of a Face.
2. THE Scenario_Schema SHALL require a `front` field holding a Face on every Node, and SHALL accept a Node that has no `back` field.
3. WHERE a Node has a `back` field, THE Scenario_Schema SHALL validate `back` with the same Face rules as `front` (criteria 1, 4, 6, 7, and 9).
4. IF a Face has neither `text` nor `image`, THEN THE Scenario_Schema SHALL report one Validation_Error whose Field_Path names the Node index and the Face field (for example `nodes.2.front` or `nodes.2.back`). A Face that holds only `detail` SHALL get this error too.
5. THE Graph_Model SHALL store an Image_Reference as the same string, character for character, through save and load (P-GRAPH-1). It SHALL NOT read, fetch, or decode the image the string names, and SHALL give the string's content no meaning (S-GRAPH-3).
6. IF a Node's `front` field is missing, or a `front` or `back` field is present but is not a JSON object (including `null`), THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path names the Node index and that field (for example `nodes.2.front`).
7. IF a Face's `text` or `detail` is present but is not a Localized_Text, or its `image` is present but is not an Image_Reference (not a string, or a string with 0 characters after trimming), THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path names the Node index, the Face field, and the inner field (for example `nodes.2.back.text.en`, `nodes.2.front.detail.en`, or `nodes.2.front.image`).
8. WHEN the Scenario_Saver saves a Node that has no `back` field, THE Scenario_Saver SHALL write no `back` field for that Node, and THE Scenario_Loader SHALL return that Node with no `back` field (P-GRAPH-1).
9. THE Graph_Model SHALL keep `detail` unchanged through save and load, with and without `ja` (P-GRAPH-1), and SHALL give `detail` no meaning beyond storing and validating it. When `detail` is shown is decided by `core-view`.
10. THE Graph_Model SHALL store no field for the side of a Node currently shown. That side is view state of `core-view`.

### Requirement 4: Edge data (R-GRAPH-04)

**User Story:** As an App developer, I want directed, typed, labeled Edges between Nodes, so that the App can express its own kinds of connections and leave their meaning to its rule definitions.

#### Acceptance Criteria

1. THE Graph_Model SHALL define an Edge with exactly these fields: `id` (Identifier, required), `from` (Identifier of the source Node, required), `to` (Identifier of the target Node, required), `type` (Edge_Type, required), and `label` (Localized_Text, optional). An Edge SHALL have no Metadata and no Numeric_Attributes.
2. THE Scenario_Schema SHALL accept an Edge that has no `label` field.
3. THE Graph_Model SHALL treat every Edge as directed from `from` to `to`: THE Graph_Model SHALL never swap, sort, or merge the `from` and `to` values. An Edge from Node A to Node B and an Edge from Node B to Node A, each with its own `id`, SHALL be two separate Edges in the Scenario.
4. THE Scenario_Schema SHALL accept any Identifier as an Edge_Type and SHALL contain no list of allowed Edge_Type values.
5. THE Graph_Model SHALL contain no field, constant, default value, or rule that marks any Edge_Type as passing or stopping automatic propagation, and SHALL give no Edge_Type a meaning.
6. IF an Edge in a Scenario lacks `id`, `from`, `to`, or `type`, or one of those fields is not a string, or is a string with 0 characters after trimming, THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path is `edges.<index>.<field>` (for example `edges.3.type`).
7. IF an Edge has a `label` field that is not a Localized_Text (`label` is not an object, `en` is missing or has 0 characters after trimming, or `ja` is present and is not a string), THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path begins with `edges.<index>.label` and names the failing part (for example `edges.0.label.en`).
8. WHEN a valid Scenario is saved and loaded again, THE Graph_Model SHALL keep the Edges in the same list order, with every field value (`id`, `from`, `to`, `type`, and `label` including `ja` when present) unchanged character for character (P-GRAPH-1).
9. THE Scenario_Schema SHALL accept an Edge whose `from` equals its `to`, and SHALL accept two or more Edges with the same `from`, `to`, and `type` when their `id` values differ. THE Graph_Model SHALL give neither case a meaning.

Reference checks for `from` and `to` and the duplicate-`id` check are in R-GRAPH-06.3 and R-GRAPH-06.4. They are not repeated here.

### Requirement 5: Zone data (R-GRAPH-05)

**User Story:** As an App developer, I want Zones that divide the space and give it an order, a height, and walls, so that the App can arrange its Nodes by order or level.

#### Acceptance Criteria

1. THE Graph_Model SHALL define a Zone with exactly these required fields: `id` (Identifier), `label` (Localized_Text), `order` (integer), `elevation` (Finite_Number), and `enclosed` (boolean, true when the Zone has walls that occlude).
2. THE Scenario_Schema SHALL accept as `order` only a JSON number that is an integer in the range 0 to 9,007,199,254,740,991 inclusive, and SHALL reject a negative number or a number with a fractional part (for example `1.5`) with a Validation_Error whose Field_Path is `zones.<index>.order`. The check that `order` values are unique is R-GRAPH-06.10.
3. THE Scenario_Schema SHALL accept as `elevation` any Finite_Number, including 0 and negative values, and SHALL accept as `enclosed` only the JSON values `true` and `false`. `elevation` SHALL use the same unit as `position.y` of a Node.
4. THE Scenario_Schema SHALL accept a Scenario whose `zones` list is empty, and SHALL validate the `nodes` and `edges` of that Scenario by the same rules as in a Scenario with one or more Zones.
5. IF a Zone in a Scenario lacks any required field of criterion 1, or has a field whose value breaks criterion 1, 2, or 3 (for example a string `"true"` or the number `0` as `enclosed`, or a plain string as `label`), THEN THE Scenario_Loader SHALL return a Load_Failure that holds no Scenario and contains one Validation_Error for each such field, each with the Field_Path `zones.<Zone index>.<field name>`.
6. THE Graph_Model SHALL keep the Zones list in the order given in the input and SHALL NOT sort, renumber, or fill in the `order`, `elevation`, or `enclosed` value of any Zone.
7. THE Graph_Model SHALL keep every field of every Zone unchanged through save and load, including `label` with and without `ja` (P-GRAPH-1).
8. THE Graph_Model SHALL give `order`, `elevation`, and `enclosed` no meaning beyond storing and validating them. Visibility, occlusion, and height rendering belong to `core-view` and to App rule definitions.
9. THE Graph_Model SHALL store no parent Zone and no Zone footprint or shape. Zones SHALL NOT nest, and one `enclosed` flag SHALL be the only wall data. The footprint is decided by `core-view`.

### Requirement 6: Scenario structure and reference integrity (R-GRAPH-06)

**User Story:** As an App developer, I want a loaded Scenario to be internally consistent, so that later core parts can rely on every Edge pointing to real Nodes and every Node Zone reference pointing to a real Zone.

#### Acceptance Criteria

1. THE Scenario_Schema SHALL define a Scenario as a JSON object with the envelope fields of R-FND-08.1 (`schemaVersion` as an integer greater than or equal to 1, `id`, `title`) plus the required lists `nodes` (an array of Nodes), `edges` (an array of Edges), and `zones` (an array of Zones), and SHALL accept each of the three lists when it holds zero elements.
2. THE Scenario_Schema SHALL report no Validation_Error for an unknown field, and SHALL leave each unknown field out of the Scenario it returns. An unknown field is any field other than those this spec defines, at the top level of the Scenario and inside every Node, `position`, `rotation`, `scale`, Face, Localized_Text, Edge, and Zone. This rule does not apply inside Metadata or Numeric_Attributes, which keep every key (decision-log 2026-11-13, P-GRAPH-6).
3. IF two or more elements of the same list (`nodes`, `edges`, or `zones`) have `id` values that are equal character for character, THEN THE Scenario_Schema SHALL report one Validation_Error for each element after the first one with that `id`, with the Field_Path `<list>.<index>.id` and a message that names the repeated `id`. The same `id` in two different lists SHALL be accepted.
4. IF an Edge's `from` or `to` does not equal, character for character, the `id` of any Node in the `nodes` list of the same Scenario, THEN THE Scenario_Schema SHALL report one Validation_Error for each such field, with the Field_Path `edges.<index>.from` or `edges.<index>.to` and a message that names the missing Node Identifier (P-GRAPH-3).
5. THE Scenario_Loader SHALL return a Load_Success only for a Scenario in which the `from` and the `to` of every Edge each equal, character for character, the `id` of a Node in that Scenario's `nodes` list, and the `zone` of every Node that has one equals the `id` of a Zone in that Scenario's `zones` list (P-GRAPH-3).
6. THE Scenario_Schema SHALL accept only Localized_Text as the value of every text that a Scenario shows to a person: the Scenario `title`, each Face `text`, each Face `detail`, each Edge `label`, and each Zone `label`.
7. IF `nodes`, `edges`, or `zones` is missing from a Scenario or is not a JSON array, THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path is that list name (`nodes`, `edges`, or `zones`).
8. IF a field listed in criterion 6 holds a value that is not Localized_Text (for example a plain string, an object with no `en`, an `en` that is empty after trimming, or a `ja` that is not a string), THEN THE Scenario_Schema SHALL report a Validation_Error whose Field_Path names that field (for example `nodes.<index>.front.text.en` or `zones.<index>.label`).
9. IF a Node's `zone` does not equal, character for character, the `id` of any Zone in the `zones` list of the same Scenario, THEN THE Scenario_Schema SHALL report one Validation_Error with the Field_Path `nodes.<index>.zone` and a message that names the missing Zone Identifier (P-GRAPH-3).
10. IF two or more Zones in a Scenario have equal `order` values, THEN THE Scenario_Schema SHALL report one Validation_Error for each Zone after the first one with that value, with the Field_Path `zones.<index>.order` and a message that names the repeated value.
11. IF a Scenario fails one or more Structural_Checks, THEN THE Scenario_Schema SHALL report only the Structural_Check errors and SHALL run no Cross_Element_Check. THE Scenario_Schema SHALL run the Cross_Element_Checks only on a Scenario that passes every Structural_Check.
12. THE Graph_Model SHALL compare every Identifier (`id`, `from`, `to`, `zone`) exactly, character for character, and SHALL never trim or change the case of an Identifier.

### Requirement 7: Scenario load (R-GRAPH-07)

**User Story:** As an App developer, I want one function that turns scenario JSON text into a validated Scenario or a list of clear errors, so that an App never runs on a broken scenario.

#### Acceptance Criteria

1. WHEN the Scenario_Loader receives JSON text that matches the Scenario_Schema, THE Scenario_Loader SHALL return a Load_Success holding one Scenario. That Scenario SHALL contain the fields `schemaVersion`, `id`, `title`, `nodes`, `edges`, and `zones` with values deeply equal to those in the text after unknown fields are removed (R-GRAPH-06.2), and SHALL contain no other top-level field.
2. IF the Scenario_Loader receives text that cannot be parsed as JSON, including the empty string and text made only of whitespace, THEN THE Scenario_Loader SHALL return a Load_Failure with exactly one Validation_Error. That error SHALL have an empty Field_Path and one fixed English message, the same for every such input, stating that the text is not valid JSON. The message SHALL contain no position of the fault and no part of the input text.
3. IF the Scenario_Loader receives text that parses as JSON whose top-level value is not a JSON object (an array, string, number, boolean, or `null`), THEN THE Scenario_Loader SHALL return a Load_Failure with exactly one Validation_Error. That error SHALL have an empty Field_Path and an English message stating that a JSON object is expected.
4. IF the Scenario_Loader receives text that parses as a JSON object that does not match the Scenario_Schema, THEN THE Scenario_Loader SHALL return a Load_Failure listing every Validation_Error that the Scenario_Schema reports, with no maximum count, in the order the Scenario_Schema reports them. The list SHALL hold at least 1 error. Each error SHALL have a Field_Path that names the failing field (for example `nodes.2.position.x`, or `edges.0.to` for the reference errors of R-GRAPH-06.4) and a message of at least 1 character in English.
5. IF the Scenario_Loader returns a Load_Failure, THEN THE Load_Failure SHALL hold no Scenario, and no partial Scenario either.
6. THE Scenario_Loader SHALL return a Load_Result for every input string, and SHALL report every failure through a Load_Failure without throwing an exception (P-GRAPH-7).
7. THE Scenario_Loader SHALL treat its input only as data. It SHALL parse the text with a JSON parser and validate the result with the Scenario_Schema. It SHALL evaluate no part of the input as code. It SHALL use no value from the input to read a file, make a network request, or load a module (S-GRAPH-2, S-GRAPH-3).
8. THE Scenario_Loader SHALL return deeply equal Load_Results for any two calls with the same input text, including the same Validation_Errors with the same Field_Paths and messages in the same order (P-GRAPH-4).
9. WHEN the input text starts with a UTF-8 byte order mark (U+FEFF), THE Scenario_Loader SHALL remove that one leading character before parsing.
10. WHEN a JSON object in the input repeats a key, THE Scenario_Loader SHALL use the last value for that key and SHALL report no Validation_Error for the repetition.

### Requirement 8: Scenario save (R-GRAPH-08)

**User Story:** As an App developer, I want one function that turns a Scenario into JSON text that loads back to the same Scenario, so that saving never loses or changes content.

#### Acceptance Criteria

1. WHEN the Scenario_Saver receives a Scenario that matches the Scenario_Schema, THE Scenario_Saver SHALL return a string that a standard JSON parser accepts without error, and whose parsed value holds the fields `schemaVersion`, `id`, `title`, `nodes`, `edges`, and `zones`.
2. IF the Scenario_Saver receives a Scenario that does not match the Scenario_Schema (for example, a field holding NaN, Infinity, or -Infinity, a missing required field, a repeated `id`, or an Edge whose `from` or `to` names no Node), THEN THE Scenario_Saver SHALL return a Save_Failure and no JSON text, without throwing an exception.
3. WHEN the Scenario_Saver returns a Save_Failure, THE Save_Failure SHALL list every Validation_Error that the Scenario_Schema reports for that Scenario, each with its Field_Path and English message, in the same order as the Scenario_Schema reports them.
4. WHEN the Scenario_Saver receives two Scenarios that are deeply equal, whether they are the same object, two separate objects, or two objects whose keys were inserted in a different order, THE Scenario_Saver SHALL return identical text, character for character (P-GRAPH-4).
5. WHEN the Scenario_Saver returns JSON text, THE Scenario_Loader SHALL return a Load_Success for that text holding a Scenario deeply equal to the saved Scenario after unknown fields are removed, including every Node, Edge, and Zone in its original list order, Metadata, Numeric_Attributes, both Faces with `detail`, and every Localized_Text with and without `ja` (P-GRAPH-1).
6. WHEN the Scenario_Saver runs, THE Scenario_Saver SHALL leave the input Scenario unmodified, so that the input stays deeply equal to its value before the call.
7. WHEN the text returned by the Scenario_Saver is written unchanged to a Scenario_File, THE Schema_Sensor SHALL report zero Validation_Errors for that file and exit with code 0 (P-GRAPH-2).
8. WHEN the Scenario_Saver returns JSON text, THE text SHALL use an indent of 2 spaces per level, SHALL end with exactly one newline character, and SHALL list the keys of every object, at every level including Metadata and Numeric_Attributes, in Unicode code point order. Arrays SHALL keep their element order.
9. WHERE an optional field (`back`, `zone`, `label`, `ja`, `text`, `image`, or `detail`) is set to `undefined` in the input, THE Scenario_Saver SHALL treat the field as absent and SHALL write no key for it.
10. WHERE an object in the input Scenario holds an unknown field as defined in R-GRAPH-06.2, THE Scenario_Saver SHALL report no Validation_Error for it and SHALL write no key for it.

### Requirement 9: One schema for load, save, and the sensor (R-GRAPH-09)

**User Story:** As the developer, I want the loader, the saver, and the Schema_Sensor to use the same schema, so that a scenario that passes the sensor on save also loads in the browser.

#### Acceptance Criteria

1. THE Graph_Model SHALL define the Scenario_Schema exactly once, in `core/model/scenario-schema.ts`. No other file under `core/`, `apps/`, or `scripts/sensors/` SHALL declare a second Zod schema for a Scenario, Node, Edge, Zone, Face, or Localized_Text. The reviewer agent checks this before each gate.
2. THE Scenario_Loader and THE Scenario_Saver SHALL each validate by importing the Scenario_Schema from `core/model/scenario-schema.ts`.
3. WHEN the Schema_Sensor checks the text of one Scenario_File, THE Schema_Sensor SHALL call the Scenario_Loader on that text and SHALL give the same verdict (pass or fail) and, on fail, the same list of Validation_Errors with equal Field_Paths and equal messages in the same order. The tasks of this spec update `scripts/sensors/schema.ts` to do so.
4. IF a Scenario_File fails the Scenario_Schema, THEN THE Schema_Sensor SHALL exit with code 1 and SHALL print one line per Validation_Error. Each line SHALL hold the file path, the Field_Path, and the message. For a Validation_Error whose Field_Path is the empty string (the root), the line SHALL hold `(root)` in place of the Field_Path. THE Schema_Sensor SHALL leave the file unchanged (R-FND-08.6, R-FND-08.7). Exit code 2 for usage errors stays defined by R-FND-08 only.
5. WHEN the tasks of this spec are complete, THE Repository SHALL contain only Scenario_Files under `apps/*/scenarios/` that pass the Schema_Sensor, and running the Schema_Sensor over all of them SHALL exit with code 0 (R-FND-08.3). The tasks of this spec update the existing placeholder Scenario_Files under `apps/*/scenarios/` so that they hold the required lists `nodes`, `edges`, and `zones`.
6. THE TypeScript types for Scenario, Node, Edge, Zone, Face, and Localized_Text SHALL be inferred from the Scenario_Schema with Zod type inference. No file SHALL declare a hand-written interface or type alias with the same fields for any of these six types (intent.md ch. 8). The reviewer agent checks this before each gate.
7. THE Scenario_Schema module SHALL import only `zod` and other files under `core/model/`, and SHALL use no Node.js-only API (file system, process, path). Both the browser build and the Schema_Sensor running in Node.js SHALL then be able to load the same module.

### Requirement 10: Core boundary of the Graph_Model (R-GRAPH-10)

**User Story:** As the developer, I want the Graph_Model to stay generic and free of rendering code, so that it can be tested without a browser and reused by any App.

#### Acceptance Criteria

1. THE Graph_Model SHALL contain no import, in any of the forms listed in R-FND-04.5, whose specifier is `three`, `react`, or `react-dom` or a subpath of one of them, matches `@react-three/*`, starts with `three-`, is a relative specifier with a `node_modules` path segment, or contains a `view` or `apps` path segment. THE Lint_Sensor checks this with the rules of R-FND-04.1 to R-FND-04.3: on a violation it reports the file path, the line number, and the specifier, and exits with a non-zero code.
2. THE Graph_Model SHALL contain no App_Specific_Name, compared case-insensitively, in any identifier, type name, field name, string literal, error message, comment, test name, test data, or file name under `core/model/`. The reviewer agent checks every file under `core/model/` before each gate. The tasks of this spec extend the test of R-FND-10.15 to every file under `core/model/`. This changes `repo-foundation`, so the task that makes the change adds one line to `docs/decision-log.md`.
3. THE Graph_Model SHALL contain no string literal used as a Node_Type, Edge_Type, or attribute name in any of these places: a constant, a default value, an enum, a union of literal types, or an allowed-value list. A schema field for a Node_Type, Edge_Type, or attribute name SHALL accept any Identifier (R-GRAPH-01.4, R-GRAPH-02.3, R-GRAPH-04.4).
4. IF a Scenario lacks a Node `type` or an Edge `type`, THEN THE Scenario_Schema SHALL report a Validation_Error for that field (R-GRAPH-01.6, R-GRAPH-04.6) and SHALL NOT fill in a default Node_Type or Edge_Type.
5. THE Repository SHALL place each test for the Graph_Model in the same folder as its source file, named `<source file base name>.test.ts` (R-FND-10.4). Each such test SHALL run under Vitest in a Node environment with no browser or DOM emulation, and SHALL import none of the packages listed in criterion 1.
6. THE Graph_Model SHALL make every exported function return a result determined only by its arguments. Each function SHALL NOT read or write a file, use the network, read the clock, use a random source, or read or change a module-level variable that changes after the module loads. The determinism tests of P-GRAPH-4 and P-GRAPH-10 and the reviewer agent check this; no lint rule is added for it.
7. WHEN a Graph_Model function returns, THE Graph_Model SHALL leave each argument deeply equal to its value before the call. This holds whether the function returns a success or a failure (Load_Failure, Save_Failure, Apply_Failure). An example test checks this by comparing each argument to a deep copy taken before the call.
8. THE Graph_Model SHALL be the place where the boundary rules of `core/model/` are written. The specs `core-rules` and `core-view` SHALL refer to this requirement for the `core/model/` boundary instead of repeating it.

### Requirement 11: Edit commands (R-GRAPH-11)

**User Story:** As an App developer, I want every edit to a Scenario to be a plain data command applied by one pure function, so that edits are checked, repeatable, and can be undone.

#### Acceptance Criteria

1. THE Graph_Model SHALL define the Edit_Command kinds add Node, remove Node, update Node, add Edge, remove Edge, update Edge, add Zone, remove Zone, update Zone, and batch, each as plain data with a `kind` field. THE Graph_Model SHALL name no Edit_Command kind after an App operation.
2. WHEN the Command_Applier receives a valid Scenario and an Edit_Command whose result passes the Scenario_Schema, THE Command_Applier SHALL return an Apply_Success holding a new Scenario that differs from the input only by the change that Edit_Command describes.
3. WHEN the Command_Applier applies an add Node, add Edge, or add Zone command, THE Command_Applier SHALL append the given element to the end of the matching list and keep the order of all other elements.
4. WHEN the Command_Applier applies a remove Node command, THE Command_Applier SHALL remove that Node and every Edge whose `from` or `to` equals that Node's `id`, and SHALL keep the order of the remaining Nodes and Edges.
5. WHEN the Command_Applier applies an update Node command, THE Command_Applier SHALL set each field the command gives among `type`, `position`, `rotation`, `scale`, `front`, `back`, `metadata`, `attributes`, and `zone`, SHALL remove `back` or `zone` when the command asks to clear that field, and SHALL keep the Node's `id` and every field the command does not name.
6. WHEN the Command_Applier applies a remove Edge command, THE Command_Applier SHALL remove that Edge and keep the order of the remaining Edges.
7. WHEN the Command_Applier applies an update Edge command, THE Command_Applier SHALL set `type` or `label` as the command gives, SHALL remove `label` when the command asks to clear it, and SHALL keep `id`, `from`, and `to`.
8. IF a remove Zone command names a Zone that the `zone` field of one or more Nodes references, THEN THE Command_Applier SHALL return an Apply_Failure with one Validation_Error for each such Node, with the Field_Path `nodes.<index>.zone` and a message that names the Zone Identifier.
9. WHEN the Command_Applier applies a remove Zone command for a Zone that no Node references, THE Command_Applier SHALL remove that Zone and keep the order of the remaining Zones.
10. WHEN the Command_Applier applies an update Zone command, THE Command_Applier SHALL set each field the command gives among `label`, `order`, `elevation`, and `enclosed`, and SHALL keep the Zone's `id`.
11. IF a remove or update command names an Identifier that equals the `id` of no element in the matching list, THEN THE Command_Applier SHALL return an Apply_Failure with a Validation_Error whose Field_Path names the command field that holds the Identifier and whose message names the Identifier.
12. IF the Scenario that an Edit_Command would produce fails the Scenario_Schema (for example a repeated `id`, an Edge to a missing Node, a Node `zone` naming a missing Zone, a `scale` component that is not a Positive_Number, or a repeated Zone `order`), THEN THE Command_Applier SHALL return an Apply_Failure listing the Validation_Errors that the Scenario_Schema reports for that Scenario, and no Scenario.
13. IF the Command_Applier receives an input Scenario that fails the Scenario_Schema, or a value that is not a valid Edit_Command (an unknown `kind`, or a missing or wrong-type command field), THEN THE Command_Applier SHALL return an Apply_Failure with at least one Validation_Error whose Field_Path names the faulty field.
14. THE Command_Applier SHALL return an Apply_Result for every input without throwing an exception, and SHALL leave the input Scenario and the Edit_Command unmodified (R-GRAPH-10.7).
15. THE Command_Applier SHALL return deeply equal Apply_Results for any two calls with deeply equal arguments (P-GRAPH-10).
16. THE Command_Applier SHALL receive final values only. Snapping, click handling, gizmo handling, and selection belong to `core-view`, and THE Graph_Model SHALL contain no snapping step.
17. WHEN the Command_Applier receives a Batch_Command whose `commands` list holds one or more Edit_Commands, THE Command_Applier SHALL apply them in list order, each on the Scenario produced by the previous one, and SHALL return an Apply_Success holding the Scenario produced by the last one when every command succeeds.
18. IF one command of a Batch_Command fails, THEN THE Command_Applier SHALL stop at the first failing command, SHALL apply none of the later commands, SHALL return an Apply_Failure that holds the Validation_Errors of that command and no Scenario, and SHALL leave the input Scenario unchanged (all-or-nothing). THE Command_Applier SHALL prefix the Field_Path of each such Validation_Error with `commands.<index>.`, where `<index>` is the zero-based position of the failing command in `commands`, followed by the Field_Path that the failing command alone would report (for example `commands.2.id`). Each command is validated against the Scenario_Schema as it is applied (criterion 12), so the final Scenario of a Batch_Command whose commands all succeed passes the Scenario_Schema.
19. IF the `commands` list of a Batch_Command is empty, or is missing or not a list, THEN THE Command_Applier SHALL return an Apply_Failure with a Validation_Error whose Field_Path is `commands`.
20. IF a command inside the `commands` list of a Batch_Command has the kind `batch`, THEN THE Command_Applier SHALL return an Apply_Failure with a Validation_Error whose Field_Path is `commands.<index>.kind`.

### Requirement 12: Undo and redo (R-GRAPH-12)

**User Story:** As an App developer, I want a pure edit history with undo and redo, so that every edit a person makes can be taken back and made again exactly.

#### Acceptance Criteria

1. THE History_Functions SHALL create, from a valid Scenario and an optional `limit`, a History whose `present` is deeply equal to that Scenario, whose `past` and `future` are empty, and whose `limit` is the given value, or 100 when no `limit` is given.
2. WHEN the History_Functions execute an Edit_Command that the Command_Applier accepts for the `present` of a History, THE History_Functions SHALL return a new History whose `present` is the Scenario from the Apply_Success, whose `past` is the old `past` followed by the old `present`, and whose `future` is empty. IF that `past` is longer than the `limit` of the History, THEN THE History_Functions SHALL drop the oldest entries of `past` so that its length equals `limit`. The `limit` of the new History equals the `limit` of the input History.
3. IF the Command_Applier rejects an Edit_Command executed on a History, THEN THE History_Functions SHALL return the Validation_Errors of the Apply_Failure together with a History deeply equal to the input History (P-GRAPH-11).
4. WHEN the History_Functions undo on a History whose `past` is not empty, THE History_Functions SHALL return a History whose `present` is the last Scenario of the old `past`, deeply equal to the `present` before the last executed Edit_Command, whose `past` is the old `past` without that last Scenario, and whose `future` is the old `present` followed by the old `future`.
5. WHEN the History_Functions redo on a History whose `future` is not empty, THE History_Functions SHALL return a History whose `present` is the first Scenario of the old `future`, deeply equal to the `present` before the matching undo, whose `past` is the old `past` followed by the old `present`, and whose `future` is the old `future` without its first Scenario.
6. IF the History_Functions undo on a History whose `past` is empty, THEN THE History_Functions SHALL return a History deeply equal to the input, with no error and without throwing an exception.
7. IF the History_Functions redo on a History whose `future` is empty, THEN THE History_Functions SHALL return a History deeply equal to the input, with no error and without throwing an exception.
8. THE Graph_Model SHALL keep the History out of scenario JSON: THE Scenario_Saver SHALL take a Scenario, not a History, and SHALL write no history field. A History is session state of the caller.
9. THE Graph_Model SHALL leave to the caller (`core-view`) the choice of which user gesture becomes one Edit_Command (a gesture that changes several elements becomes one Batch_Command), and SHALL execute each Edit_Command it receives, including a successful Batch_Command, as exactly one History step, so that one undo or one redo moves over the whole Batch_Command.
10. IF the `limit` given to the History creation function is not a Positive_Integer (for example `0`, a negative number, `1.5`, a string, `null`, or NaN), THEN THE History_Functions SHALL return a failure holding a Validation_Error whose Field_Path is `limit` and no History, without throwing an exception.
11. THE History_Functions SHALL keep the `limit` of a History unchanged by execute, undo, and redo, and SHALL change `limit` in no other way.

## PBT properties

These properties come from intent.md 10.6. This spec covers the three that apply to the data model, Scenario I/O, and edits: save → load leaves the content unchanged, every edge points to existing nodes (extended here to Node Zone references and to the Scenario after any sequence of edits), and same input → same result. The other two 10.6 properties ("removing edges never increases the set of reachable nodes" and "automatic propagation never reaches past an edge type that stops it") belong to `core-rules` and are out of scope here. Each property runs at least 100 generated cases with fast-check, and each test name contains its property ID (as in R-FND-10.5).

Generators produce Scenarios with any integer `schemaVersion` greater than or equal to 1, any number of Nodes, Edges, and Zones (including zero), random Identifiers (including ones with leading or trailing whitespace), random Node_Types and Edge_Types, Localized_Text with and without `ja`, Faces with text only, image only, or both, with and without `detail`, Nodes with and without a Back_Face and with and without a `zone`, Zones with unique non-negative integer `order` values, Positive_Number `scale` components, Edges that are self-loops or repeat another Edge's `from`, `to`, and `type`, arbitrary JSON Metadata, and Numeric_Attributes with random attribute names (including names that differ only in case or surrounding whitespace, and the names `__proto__`, `constructor`, and `prototype`) and Finite_Number values. Edit_Command generators produce every kind (including batches of one or more commands, empty batches, and nested batches), naming both existing and missing Identifiers. History generators produce `limit` values that are Positive_Integers, and invalid values. Deep equality treats `-0` and `0` as equal.

- **P-GRAPH-1 (save → load leaves the content unchanged).** FOR ALL valid Scenarios `s`, the Scenario_Saver SHALL return text `t`, and the Scenario_Loader on `t` SHALL return a Load_Success holding a Scenario deeply equal to `s`, including Metadata, Numeric_Attributes, both Faces with `detail`, Image_References, Node `zone` values, and the list order of Nodes, Edges, and Zones. (R-GRAPH-01.5, R-GRAPH-02.6, R-GRAPH-02.9, R-GRAPH-03.5, R-GRAPH-03.8, R-GRAPH-03.9, R-GRAPH-04.8, R-GRAPH-05.7, R-GRAPH-08.5)
- **P-GRAPH-2 (saved text stays valid and stable).** FOR ALL valid Scenarios `s`, the text `t` returned by the Scenario_Saver SHALL pass the Schema_Sensor's check, SHALL use 2-space indent, sorted keys, and one trailing newline, and saving the Scenario loaded from `t` SHALL return text identical to `t`. (R-GRAPH-08.7, R-GRAPH-08.8, R-GRAPH-09.3)
- **P-GRAPH-3 (every reference points to an existing element).** FOR ALL Scenarios accepted by the Scenario_Loader, the `from` and `to` of every Edge SHALL name a Node in that Scenario, and the `zone` of every Node that has one SHALL name a Zone in that Scenario. FOR ALL valid Scenarios with one Edge's `from` or `to`, or one Node's `zone`, replaced by an Identifier that names no element of the matching list, the Scenario_Loader SHALL return a Load_Failure with a Validation_Error for that element's index and field. (R-GRAPH-06.4, R-GRAPH-06.5, R-GRAPH-06.9)
- **P-GRAPH-4 (same input → same result).** FOR ALL input strings (valid scenario JSON, invalid scenario JSON, and non-JSON text), running the Scenario_Loader twice SHALL return deeply equal Load_Results with the same Validation_Errors in the same order. FOR ALL valid Scenarios, running the Scenario_Saver on the Scenario and on a deep copy of it built with a different key insertion order SHALL return identical text. (R-GRAPH-07.8, R-GRAPH-08.4, R-GRAPH-10.6)
- **P-GRAPH-5 (broken scenarios fail with a Field_Path).** FOR ALL valid Scenarios, each of these single changes SHALL make the Scenario_Loader return a Load_Failure whose Validation_Errors include the path of the changed field: removing a required field of a Node, Edge, or Zone; replacing a numeric field or a Numeric_Attributes value with a non-number; replacing a `scale` component with `0` or a negative number; giving two Nodes, two Edges, or two Zones the same `id`, or two Zones the same `order` (the error path is the field of the later element in the list); and removing both `text` and `image` from a Face. (R-GRAPH-01.3, R-GRAPH-01.6, R-GRAPH-02.4, R-GRAPH-03.4, R-GRAPH-04.6, R-GRAPH-05.5, R-GRAPH-06.3, R-GRAPH-06.10)
- **P-GRAPH-6 (unknown fields are ignored).** FOR ALL valid Scenarios with one or more extra fields (any JSON values, names not defined by this spec) added at the top level or inside any Node, `position`, `rotation`, `scale`, Face, Localized_Text, Edge, or Zone, the Scenario_Loader SHALL return a Load_Success holding a Scenario deeply equal to the one without the extra fields, and the Scenario_Saver SHALL return the same text for both. (R-GRAPH-06.2, R-GRAPH-07.1, R-GRAPH-08.10)
- **P-GRAPH-7 (the loader never throws).** FOR ALL strings, the Scenario_Loader SHALL return a Load_Result without throwing an exception. (R-GRAPH-07.6)
- **P-GRAPH-8 (edits keep the Scenario valid).** FOR ALL valid Scenarios and all sequences of Edit_Commands, executing the commands in order from a History created from that Scenario SHALL leave a `present` that passes the Scenario_Schema after every step, so every Edge `from` and `to` names a Node and every Node `zone` names a Zone. This extends the 10.6 property "every edge points to existing nodes" to edits. (R-GRAPH-11.2 to R-GRAPH-11.12, R-GRAPH-12.2)
- **P-GRAPH-9 (undo and redo restore states).** FOR ALL valid Scenarios and Edit_Commands that the Command_Applier accepts, executing the command and then undoing SHALL return a History whose `present` is deeply equal to the original Scenario. FOR ALL valid Scenarios and sequences of n accepted Edit_Commands with n at most `limit`, executing all of them and then undoing n times SHALL return a `present` deeply equal to the original Scenario. FOR ALL Histories with a non-empty `past`, undoing and then redoing SHALL return a History deeply equal to the History before the undo. (R-GRAPH-12.2, R-GRAPH-12.4, R-GRAPH-12.5)
- **P-GRAPH-10 (same history and command → same result).** FOR ALL Histories and Edit_Commands, executing the command twice on deeply equal Histories SHALL return deeply equal results, and FOR ALL Scenarios and Edit_Commands the Command_Applier SHALL return deeply equal Apply_Results for deeply equal arguments. (R-GRAPH-11.15, R-GRAPH-10.6)
- **P-GRAPH-11 (rejected commands change nothing).** FOR ALL Histories and Edit_Commands that the Command_Applier rejects, executing the command SHALL return Validation_Errors and a History deeply equal to the input History. (R-GRAPH-11.8, R-GRAPH-11.11 to R-GRAPH-11.13, R-GRAPH-12.3). This includes a Batch_Command in which one command fails: the input Scenario stays unchanged and the Apply_Failure holds no Scenario. (R-GRAPH-11.18 to R-GRAPH-11.20)
- **P-GRAPH-12 (History never keeps more than `limit` steps).** FOR ALL valid Scenarios, all `limit` values that are Positive_Integers, and all sequences of Edit_Commands, a History created with that `limit` and then given the commands in order SHALL have a `past` no longer than `limit` after every step, and a `limit` equal to the given value. WHEN the `past` would be longer than `limit`, the entries kept SHALL be the newest `limit` entries. FOR ALL `limit` values that are not Positive_Integers, the creation function SHALL return a Validation_Error with the Field_Path `limit` and no History, without throwing. (R-GRAPH-12.1, R-GRAPH-12.2, R-GRAPH-12.10, R-GRAPH-12.11)
- **P-GRAPH-13 (a batch equals its commands in sequence, as one step).** FOR ALL valid Scenarios and non-empty lists of non-batch Edit_Commands, IF applying the commands one after another with the Command_Applier succeeds at every step, THEN applying a Batch_Command that holds the same list SHALL return a Scenario deeply equal to the final one of that sequence. Executing that Batch_Command on a History SHALL add exactly one entry to `past` (before any drop for `limit`), and one undo SHALL return a `present` deeply equal to the Scenario before the batch. FOR ALL lists in which at least one command fails when applied in sequence, the Batch_Command SHALL return an Apply_Failure whose Validation_Errors have the prefix `commands.<index>.` for the first failing command. (R-GRAPH-11.17 to R-GRAPH-11.20, R-GRAPH-12.9)

Non-finite numbers cannot appear in JSON text, so R-GRAPH-08.2 and R-GRAPH-08.3 are covered by example tests that pass a Scenario holding NaN, Infinity, or -Infinity to the Scenario_Saver. R-GRAPH-08.6, R-GRAPH-10.7, and R-GRAPH-11.14 (arguments left unchanged) are covered by example tests that compare each argument with a deep copy taken before the call. R-GRAPH-07.2 (fixed parse message), R-GRAPH-07.9 (byte order mark), R-GRAPH-07.10 (repeated keys), R-GRAPH-08.9 (`undefined` fields), R-GRAPH-06.11 (no Cross_Element_Check while Structural_Checks fail), R-GRAPH-11.4 (remove Node removes its Edges), and R-GRAPH-12.6 and R-GRAPH-12.7 (undo and redo at the ends) are covered by example tests.

## Safety

Follows `safety.md` (intent.md ch. 9).

- **S-GRAPH-1.** THE Graph_Model SHALL contain no attack content: no attack cards, hidden text, commands, or code that could work as a real attack. Generated test data SHALL be random generic values, not text that works as an instruction to an AI system. Edit_Commands are data edits of a Scenario only.
- **S-GRAPH-2.** THE Scenario_Loader SHALL treat scenario JSON as untrusted data: it SHALL parse it as JSON only, SHALL evaluate no part of it as code (R-GRAPH-07.7), SHALL return a Load_Failure instead of throwing on any input (R-GRAPH-07.6), SHALL echo no input text in the parse error (R-GRAPH-07.2), and SHALL let no attribute name change any other part of the Scenario (R-GRAPH-02.9). THE Command_Applier SHALL treat Edit_Commands the same way (R-GRAPH-11.13, R-GRAPH-11.14).
- **S-GRAPH-3.** THE Graph_Model SHALL make no network request and SHALL fetch no Image_Reference (R-GRAPH-03.5, R-GRAPH-07.7).
- **S-GRAPH-4.** THE Graph_Model SHALL collect no personal information and SHALL require no login. The History is kept only in memory by the caller and is not saved (R-GRAPH-12.8).
- **S-GRAPH-5.** THE Graph_Model SHALL use no AI and no real LLM, and SHALL generate no images.
- **S-GRAPH-6.** This spec makes no claim that needs a source. Claims with sources (OWASP mapping, competitor comparison) belong to the App specs and are checked by the `reviewer` agent.

## Decisions

Answers to the earlier open questions (2026-11-15). Each line gives the question topic, the decision, and the affected criteria.

- Q1 Spec name: `core` is split into `core-graph`, `core-rules`, and `core-view`; edit commands and undo/redo are in `core-graph`, Timeline is in `core-rules` (decision-log 2026-11-15). Introduction.
- Q2 Graph edit functions: in this spec. R-GRAPH-11, R-GRAPH-12, P-GRAPH-8 to P-GRAPH-11.
- Q3 Where the boundary rules live: they stay in R-GRAPH-10; later specs refer to it. R-GRAPH-10.8, Introduction.
- Q4 Missing lists and fields: `nodes`, `edges`, `zones`, `metadata`, and `attributes` are required; the placeholder Scenario_Files are updated by this spec's tasks. R-GRAPH-01.1, R-GRAPH-06.1, R-GRAPH-06.7, R-GRAPH-09.5.
- Q5 Schema version: `schemaVersion` accepts any integer greater than or equal to 1, matching R-FND-08.1; the Scenario_Saver writes the value it was given; the Scenario_Files in this Repository use `1` (design review 2026-11-15, replaces the earlier "stays `1`"). R-GRAPH-06.1, Introduction.
- Q6 Unknown nested fields: ignored and dropped at every level except inside Metadata and Numeric_Attributes, on load and on save. R-GRAPH-06.2, R-GRAPH-07.1, R-GRAPH-08.5, R-GRAPH-08.10, P-GRAPH-6.
- Q7 Identifier whitespace: Identifiers are compared exactly and never trimmed. Glossary (Identifier), R-GRAPH-06.12.
- Q8 Identifier scope: `id` is unique per list only. R-GRAPH-06.3.
- Q9 Reference checks on broken ids: Cross_Element_Checks run only when every Structural_Check passes. Glossary, R-GRAPH-06.11.
- Q10 Size limits: none. No criterion.
- Q11 Node and Zone membership: optional Node `zone` field with a reference check. R-GRAPH-01.1, R-GRAPH-01.9, R-GRAPH-06.5, R-GRAPH-06.9, P-GRAPH-3.
- Q12 Zone shape, order, and walls: no nesting, `order` is a unique integer ≥ 0, `elevation` uses the unit of `position.y`, one `enclosed` flag, footprint decided by `core-view`. R-GRAPH-05.2, R-GRAPH-05.3, R-GRAPH-05.9, R-GRAPH-06.10.
- Q13 Rotation unit: radians. R-GRAPH-01.8.
- Q14 Scale limits: each component is a Positive_Number. Glossary, R-GRAPH-01.3, P-GRAPH-5.
- Q15 Image_Reference format: a string with at least 1 character after trimming; its content is chosen by the App. Glossary, R-GRAPH-03.5, R-GRAPH-03.7.
- Q16 Content of a Face: text and image are the only content kinds; a Face needs `text` or `image`; the same rule applies to `back`. R-GRAPH-03.1, R-GRAPH-03.3, R-GRAPH-03.4.
- Q17 Which side is showing: view state of `core-view`, not saved. R-GRAPH-03.10.
- Q18 Zoom detail layers: optional Face `detail` (Localized_Text); display decided by `core-view`. R-GRAPH-03.1, R-GRAPH-03.4, R-GRAPH-03.7, R-GRAPH-03.9, R-GRAPH-06.6, P-GRAPH-1.
- Q19 Metadata value types: any JSON value inside the object. R-GRAPH-01.5.
- Q20 Negative zero: `-0` and `0` count as equal for P-GRAPH-1. R-GRAPH-02.6, PBT properties.
- Q21 Edge data: no Metadata or Numeric_Attributes on Edges. R-GRAPH-04.1.
- Q22 Edge rules: self-loops and repeated `from`/`to`/`type` are allowed and have no meaning. R-GRAPH-04.9.
- Q23 Field path notation: `.`-joined segments, zero-based indexes, empty string for the root. Glossary (Field_Path).
- Q24 Error order: the order the Scenario_Schema reports, stable across runs. R-GRAPH-07.4, R-GRAPH-07.8.
- Q25 Error count cap: none. R-GRAPH-07.4.
- Q26 Duplicate keys in JSON: last value wins, no error. R-GRAPH-07.10.
- Q27 Parse error detail: one fixed English message, no position, no input text. R-GRAPH-07.2, S-GRAPH-2.
- Q28 Byte order mark: a leading U+FEFF is removed before parsing. R-GRAPH-07.9.
- Q29 Text format: 2-space indent, one trailing newline, keys sorted by Unicode code point order at every level, arrays keep their order. R-GRAPH-08.4, R-GRAPH-08.8, P-GRAPH-2, P-GRAPH-4.
- Q30 Undefined optional fields: treated as absent by the Scenario_Saver. R-GRAPH-08.9.
- Q31 Sensor messages: the Schema_Sensor calls the Scenario_Loader; `scripts/sensors/schema.ts` is updated by this spec's tasks. R-GRAPH-09.2, R-GRAPH-09.3.
- Q32 Sensor exit codes: exit code 2 stays defined by R-FND-08 only. R-GRAPH-09.4.
- Q33 Who checks "one schema, inferred types": the reviewer agent. R-GRAPH-09.1, R-GRAPH-09.6.
- Q34 App_Specific_Name list: the structure.md list plus the folder names under `apps/`. Glossary, R-GRAPH-10.2.
- Q35 Name test scope: the test of R-FND-10.15 is extended to every file under `core/model/`, with a decision-log line when that task is done. R-GRAPH-10.2.
- Q36 Automated purity checks: no new lint rules; determinism PBT and the reviewer agent. R-GRAPH-10.6.
- Q37 History size limit: History has a `limit` (Positive_Integer, default 100) on the length of `past`; the oldest entries are dropped first; `future` is not limited; an invalid `limit` returns a Validation_Error at `limit`. R-GRAPH-12.1, R-GRAPH-12.2, R-GRAPH-12.10, R-GRAPH-12.11, P-GRAPH-9, P-GRAPH-12.
- Q38 Remove Zone still referenced by Nodes: the command stays rejected (R-GRAPH-11.8 unchanged). Callers clear the Node references and remove the Zone together with one Batch_Command. R-GRAPH-11.8, R-GRAPH-11.17.
- Q39 Batch command: an Edit_Command kind `batch` holds a list of Edit_Commands, applied in order, all-or-nothing, as one History step; the list must not be empty; nested batches are rejected; error Field_Paths are prefixed with `commands.<index>.`. R-GRAPH-11.1, R-GRAPH-11.17 to R-GRAPH-11.20, R-GRAPH-12.9, P-GRAPH-11, P-GRAPH-13.
- Q40 AIAdapter owner: the `core-rules` spec owns it (the interface and a no-AI implementation that returns fixed text from judgement results; real AI is Could), because its input is judgement results. Introduction.
- Q41 Batch validation order (design review 2026-11-15): the commands of a Batch_Command are validated one at a time, in order, and the batch fails at the first failing command; the case "the final Scenario fails the Scenario_Schema" is removed because every step is already validated. R-GRAPH-11.17, R-GRAPH-11.18, P-GRAPH-13.
- Q42 Root Field_Path in sensor output (design review 2026-11-15): the Schema_Sensor prints `(root)` in place of an empty Field_Path. R-GRAPH-09.4.

## Open questions

None at this time.
