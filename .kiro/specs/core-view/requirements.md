# Requirements Document

## Introduction

`core-view` is the third of three specs that together make up the shared core of Unit 1 (intent.md 3.1, 3.2, 10.2, 10.6). The `core` spec is split into `core-graph`, `core-rules`, and `core-view` (decision-log 2026-11-15). This spec defines the view layer in `core/view/`: the 3D rendering of a Scenario, the zoom detail layers, ViewPresets, walkthrough playback, and Theme swapping (intent.md 3.1, 3.2, ch. 7, ch. 8).

In scope (as asked for this spec):
- 3D rendering of Nodes, Edges, and Zones with React Three Fiber and drei (tech.md "Stack"), including Zone elevation and enclosing walls (intent.md 3.1 `Zone`, 10.6).
- Zoom detail layers: the Face `detail` stored by `core-graph` (R-GRAPH-03.9) becomes visible when the camera comes close to a Node (intent.md 3.1 "level-of-detail on zoom", ch. 7).
- ViewPreset: camera position, visibility filter, and movement along a path (intent.md 3.1 `ViewPreset`), and switching between ViewPresets (intent.md 3.3, ch. 7 "view switching").
- Walkthrough playback: the camera moves along a Camera_Path (intent.md 3.1, 3.3, ch. 7).
- Theme swapping (intent.md 3.1 `Theme`).

Also in this spec, because intent.md 10.6 places them in `core/view` ("3D表示・操作、ゾーンの高低差と囲い、ズームで見える層、視点、ウォークスルー、霧") and the approved specs `core-graph` and `core-rules` handed them to `core-view` in their out-of-scope lists:
- Drawing the fog effect from Effect_Requests (intent.md 3.1 "fog is Must and shared by both apps"; R-RULES-13.4).
- Playback timing of a Timeline (R-RULES-14.11).
- The Must 3D interaction of intent.md 3.3: drag on the Zone plane with snapping, gizmo rotation (3 axes) and scaling, connecting two Nodes by clicking them in turn with Edges that follow automatically, and undo/redo through the `core-graph` History. Each gesture becomes one Edit_Command (R-GRAPH-11.16, R-GRAPH-12.9).

Both groups stay in this spec (decided, Q1).

This spec also defines a generic Core_Demo page (R-VIEW-21) for the intent.md 10.6 completion criterion "a demo that switches between two viewpoints runs". R-VIEW-21.8 amends `repo-foundation` (R-FND-02.4, R-FND-02.5, R-FND-02.7, R-FND-03.1, R-FND-03.9, R-FND-10.11) for the fourth page and the 3D packages.

Dependency rule: `core/view` may import from `core/model` (the Graph_Model of `core-graph` and the Rule_Engine of `core-rules`). `core/model` never imports from `core/view` and never depends on three.js (tech.md "Technical rules", R-GRAPH-10.1). `core/view` never imports from `apps/` (structure.md).

`core/view` is not the main PBT target (tech.md: `core/model` is the PBT target). Only the pure, three.js-free helper functions of this spec (View_Helpers) are property-tested. Rendering is checked by example tests where possible and by a human at the verification gate.

Out of scope for this spec, with the place each item belongs to:
- Node, Edge, Zone data, Scenario I/O, Edit_Commands, History, undo and redo logic: `core-graph`.
- Judgement (conditions, propagation, sums, shifts), Effect_Request creation, Timeline data and cursor moves, AI_Adapter: `core-rules`.
- The content of each App's View_Settings, Theme, Scenarios, and Rule_Definitions; App screens, buttons, scores, and texts: the App specs (intent.md 3.2).
- Computing numeric attributes from image pixels, loading images from files, IndexedDB storage: `apps/` (intent.md 3.2, 5.5).
- Core Should items: front/back flip display, glow and other effects except fog (intent.md ch. 7). See Open questions Q6 and Q7.
- Should interaction: multi-select, align, keyboard operation (intent.md 3.3). Not built.
- Physics, free-form surfaces, VR (intent.md 3.3). Not built.
- A real AI implementation (Could). Not built.

## Glossary

Terms reused from `core-graph` (`.kiro/specs/core-graph/requirements.md`, Glossary) keep their meaning there: **App**, **App_Specific_Name**, **Repository**, **Graph_Model**, **Scenario**, **Node**, **Node_Type**, **Edge**, **Edge_Type**, **Zone**, **Face**, **Front_Face**, **Back_Face**, **Image_Reference**, **Localized_Text**, **Identifier**, **Finite_Number**, **Positive_Number**, **Positive_Integer**, **Validation_Error**, **Field_Path**, **Lint_Sensor**, **Edit_Command**, **Batch_Command**, **Command_Applier**, **History**, **History_Functions**. Terms reused from `core-rules` (`.kiro/specs/core-rules/requirements.md`, Glossary) keep their meaning there: **Rule_Engine**, **Effect_Kind**, **Effect_Target**, **Effect_Request**, **Timeline**, **Timeline_Step**, **Timeline_Cursor**. Terms reused from `repo-foundation` (`.kiro/specs/repo-foundation/requirements.md`, Glossary) keep their meaning there: **Build_System**, **Top_Page**, **Public_URL**.

- **Core_View**: the set of React components, hooks, and functions in `core/view/` defined by this spec.
- **View_Helpers**: the functions of the Core_View that import no three.js, React, React Three Fiber, or drei package, and that take and return plain data only. They are the PBT target of this spec.
- **View_Host**: the HTML element given by the App in which the Core_View draws one 3D scene.
- **View_Settings**: one plain data value supplied by an App that holds the Zone_Footprints, the ViewPresets, the Camera_Paths, the Detail_Distance, the Snap_Step, the Wall_Height, the Edit_Mode, and the Step_Duration (each defined below).
- **View_Settings_Schema**: the single Zod schema in `core/view/` that defines valid View_Settings.
- **View_Settings_Loader**: the View_Helper that takes any value and returns either View_Settings or a non-empty list of Validation_Errors.
- **Zone_Footprint**: the floor shape of one Zone on the horizontal plane, given in View_Settings by Zone `id`. Its kinds are a `rect` (center `x`, `z`, `width`, `depth`) and a `ring` (center `x`, `z`, `innerRadius`, `outerRadius`). All lengths use the unit of `position.y` (R-GRAPH-05.3).
- **Zone_Plane**: the horizontal plane at the `elevation` of a Zone. For a Node with no `zone`, the plane at height 0.
- **Wall**: the vertical surface drawn on the outer edge of the Zone_Footprint of a Zone whose `enclosed` is `true`, with the height Wall_Height.
- **Wall_Height**: a Positive_Number in View_Settings.
- **Detail_Distance**: a Positive_Number in View_Settings: the camera distance at or below which the Detail_Layer of a Node is shown.
- **Detail_Layer**: the `detail` Localized_Text of the Face of a Node, drawn next to that Face.
- **ViewPreset**: an entry of View_Settings with an `id` (Identifier), a `label` (Localized_Text), a Camera_Pose, and a Visibility_Filter.
- **Camera_Pose**: a plain data value with a `position` (`x`, `y`, `z`) and a `target` (`x`, `y`, `z`), each component a Finite_Number, where `position` and `target` are not equal.
- **Visibility_Filter**: a plain data value with the optional lists `zones` (Zone Identifiers), `nodeTypes` (Node_Types), and `edgeTypes` (Edge_Types), the optional boolean `includeUnzoned`, and the required `edgeRule` (`bothEnds` or `anyEnd`).
- **Visible_Set**: the result of the View_Helper that applies a Visibility_Filter to a Scenario: the Identifiers of the visible Nodes, visible Edges, and visible Zones.
- **Active_Preset**: the ViewPreset that the Core_View currently uses.
- **Camera_Path**: an entry of View_Settings with an `id` (Identifier) and an ordered list of two or more Camera_Poses (Waypoints), or a `fromZones` value that asks the Core_View to build the Waypoints from the Zones (R-VIEW-09.4).
- **Waypoint**: one Camera_Pose of a Camera_Path.
- **Path_Progress**: a Finite_Number from 0 to 1 that gives a place on a Camera_Path, where 0 is the first Waypoint and 1 is the last Waypoint, measured by the length of the `position` polyline.
- **Walkthrough**: the playback in which the Core_View moves the camera along one Camera_Path from Path_Progress 0 to 1 over a Walk_Duration.
- **Walk_Duration**: a Positive_Number of seconds given by the caller when a Walkthrough starts.
- **Walk_State**: the state of a Walkthrough: `idle`, `playing`, `paused`, or `finished`.
- **Step_Duration**: a Positive_Number of seconds in View_Settings: the time each Timeline_Step is shown during Timeline playback.
- **Theme**: one plain data value supplied by an App that holds the colors of the background, Zone floors, Walls, and text; a Node_Style per Node_Type; an Edge_Style per Edge_Type; and an Effect_Style per Effect_Kind.
- **Theme_Schema**: the single Zod schema in `core/view/` that defines a valid Theme.
- **Theme_Loader**: the View_Helper that takes any value and returns either a Theme or a non-empty list of Validation_Errors.
- **Node_Style**: the color and the border color of a Node.
- **Edge_Style**: the color, the line width, and the `dashed` flag of an Edge.
- **Effect_Style**: a plain data value with a `style` that names how an Effect_Kind is drawn and the parameters of that style. This spec defines the style `fog` only, with a color and an opacity from 0 to 1.
- **Default_Style**: the Node_Style, Edge_Style, and colors the Theme uses for any Node_Type or Edge_Type it does not list.
- **Edit_Mode**: a value in View_Settings, `view` (no gesture changes the Scenario) or `edit` (the gestures of R-VIEW-12 to R-VIEW-15 are on).
- **Selection**: the one Node the person has picked, or none.
- **Gesture**: one continuous user action from pointer press to pointer release (a drag, a gizmo drag) or the pair of clicks of a connection.
- **Snap**: the View_Helper that rounds each horizontal component (`x`, `z`) of a position to the nearest multiple of the Snap_Step.
- **Snap_Step**: a Positive_Number in View_Settings.
- **Connect_Mode**: the state in which the next two Node clicks create one Edge with an Edge_Type given by the App.
- **Edit_Callback**: a function given by the App that receives each new History and every Validation_Error that the Core_View reports.
- **Walk_Callback**: a function given by the App when it starts the Core_View (R-VIEW-03.1), which the Core_View calls with the Walk_State and the Path_Progress (R-VIEW-17.9, R-VIEW-17.10).
- **Timeline_Callback**: a function given by the App when it starts the Core_View (R-VIEW-03.1), which the Core_View calls with each new Timeline_Cursor `position` and with the end of a Timeline playback (R-VIEW-18.2, R-VIEW-18.4, R-VIEW-18.5).
- **Linked_Timeline**: a Timeline that the App passes as the optional argument of the Walkthrough start function (R-VIEW-17.1), so that its Timeline_Cursor moves with the Waypoints of the Camera_Path (R-VIEW-17.11, R-VIEW-18.10). The Core_View links a Timeline to a Walkthrough only through this argument and never infers a link.
- **Link_Conditions**: the conditions of R-VIEW-17.11 that a Linked_Timeline must meet to be linked to a Walkthrough.
- **View_State**: the plain data value that holds the Active_Preset `id`, the Walk_State, the Path_Progress, the Selection, the Connect_Mode and its pending first Node, and the Timeline playback state (R-VIEW-01.9).
- **View_State_Reducer**: the View_Helper that takes a View_State and one view action as plain data and returns the next View_State (R-VIEW-08.11).
- **Core_Demo**: the generic demo page of the Core_View under `core/view/demo/` (R-VIEW-21).
- **Sample_Scenario**: the generic Scenario that the Core_Demo draws (R-VIEW-21.2).
- **Image_Resolver**: a function given by the App that takes an Image_Reference and returns an image source that the browser can draw, or "no image".
- **Reference_Machine**: a desktop computer running the latest stable Microsoft Edge or Google Chrome, on which the performance criterion of R-VIEW-16 is measured. design.md names the exact machine and browser versions.

## Requirements

### Requirement 1: Packages and boundary of the Core_View (R-VIEW-01)

**User Story:** As the developer, I want the view layer to depend on the model and never the other way round, so that the model stays testable without rendering and the view stays usable by any App.

#### Acceptance Criteria

1. THE Repository SHALL list `three`, `@react-three/fiber`, `@react-three/drei`, `react`, and `react-dom` in `package.json` (tech.md "Stack"). It SHALL also list every type package that `tsc --noEmit` needs to check `core/view/` with zero errors. Each of these entries SHALL use an exact version string with no range operator (no `^`, `~`, `>`, `<`, `*`, or `x`).
2. WHEN the task that adds the packages of criterion 1 is completed, THE Repository SHALL contain one new line in `docs/decision-log.md` that names each added package and its exact version.
3. THE Core_View SHALL place every file under `core/view/`. Non-test files under `core/view/` SHALL import from `core/model/` only symbols that a non-test source file of the Graph_Model or the Rule_Engine exports. They SHALL import no `*.test.ts` file under `core/model/`.
4. THE Lint_Sensor SHALL report a lint error, using the rules of R-FND-04 and R-GRAPH-10.1, for each of these imports: an import under `core/model/` of three.js, React, React Three Fiber, drei, or any path with a `view` segment; and an import under `core/view/` of any path with an `apps` segment.
5. IF a file change adds an import that criterion 4 forbids, THEN THE Lint_Sensor SHALL fail and name the file and the forbidden import, and the change SHALL NOT be accepted until the import is removed (tech.md "Sensors and checks").
6. THE Core_View SHALL contain no App_Specific_Name, compared case-insensitively, in any identifier, type name, field name, string literal, error message, comment, test name, test data, or file name under `core/view/`. The tasks of this spec SHALL extend the test of R-FND-10.15 so that it scans every file under `core/view/`. The task that makes this change SHALL add one line to `docs/decision-log.md` (as in R-GRAPH-10.2).
7. THE Core_View SHALL contain no Node_Type, Edge_Type, attribute name, Effect_Kind, Zone Identifier, or ViewPreset Identifier in any constant, default value, enum, union of literal types, or allowed-value list. Every such name SHALL reach the Core_View through a Scenario, View_Settings, a Theme, or Effect_Requests from an App.
8. THE Core_View SHALL change a Scenario only by passing Edit_Commands to the History_Functions of `core-graph` (R-GRAPH-11, R-GRAPH-12). It SHALL write no field of a Scenario, Node, Edge, or Zone directly.
9. THE Core_View SHALL keep its view state (Active_Preset, camera pose, Selection, Walk_State, Connect_Mode, Timeline playback state) outside the Scenario and SHALL pass none of it to the Scenario_Saver (R-GRAPH-03.10, R-GRAPH-12.8). WHEN only view state changes between two saves of the same Scenario, THE Scenario_Saver output SHALL be identical for both saves.
10. THE Repository SHALL place each View_Helper in its own file under `core/view/` that imports none of the packages of criterion 1, either directly or through another file under `core/view/`. Its test SHALL sit next to it, named `<source file base name>.test.ts`, and SHALL run under Vitest in a Node environment with no browser or DOM emulation (R-FND-10.4).

### Requirement 2: View settings and their validation (R-VIEW-02)

**User Story:** As an App developer, I want to hand the core one plain view settings value that is checked before use, so that broken settings never produce a broken scene.

#### Acceptance Criteria

1. THE Core_View SHALL define the View_Settings_Schema exactly once, in a file under `core/view/`, and THE TypeScript types for View_Settings, Zone_Footprint, ViewPreset, Camera_Pose, Visibility_Filter, and Camera_Path SHALL be inferred from Zod schemas. Localized_Text and Identifier SHALL reuse the schemas of `core/model/scenario-schema.ts` (R-GRAPH-09.1).
2. WHEN the View_Settings_Loader receives a value that matches the View_Settings_Schema and breaks none of the checks of criteria 4 to 6, THE View_Settings_Loader SHALL return those View_Settings with unknown fields removed at every level of nesting (as in R-GRAPH-06.2), and no Validation_Error.
3. IF the View_Settings_Loader receives a value that does not match the View_Settings_Schema or that breaks one or more checks of criteria 4 to 6, THEN THE View_Settings_Loader SHALL return a non-empty list holding every Validation_Error found, each with a Field_Path relative to the View_Settings and a non-empty English message, in the same order on every call with a deeply equal value, and no View_Settings.
4. IF two or more ViewPresets, two or more Camera_Paths, or two or more Zone_Footprints have equal `id` values, THEN THE View_Settings_Loader SHALL report one Validation_Error for each entry after the first one with that `id`, with the Field_Path `<list>.<index>.id`, where `<index>` is the 0-based position of that entry in its list.
5. IF View_Settings have no `presets` field or hold an empty list of ViewPresets, THEN THE View_Settings_Loader SHALL report a Validation_Error with the Field_Path `presets`.
6. IF a Camera_Pose has equal `position` and `target` (all three components equal), a `ring` Zone_Footprint has an `innerRadius` that is negative or not less than its `outerRadius`, a `rect` Zone_Footprint has a `width` or `depth` that is not a Positive_Number, or a Camera_Path holds fewer than two Waypoints, both Waypoints and a `fromZones` value, or neither of them, THEN THE View_Settings_Loader SHALL report a Validation_Error whose Field_Path names that field or that Camera_Path.
7. THE View_Settings_Loader SHALL return a result for every input value, including `null`, `undefined`, numbers, strings, arrays, and objects of any shape, without throwing an exception, SHALL leave its input value unchanged, and SHALL evaluate no part of its input as code (S-VIEW-2).
8. View_Settings name Zone Identifiers in two places only: the `id` of a Zone_Footprint and the entries of `presets.<index>.filter.zones`; View_Settings hold no Node or Edge Identifier. WHEN the Core_View is started, or receives a new History, and one of these Zone Identifiers is not the `id` of a Zone in the `present` Scenario, THE Core_View SHALL treat each Zone_Footprint with that `id` as absent, SHALL draw every other element, SHALL not throw an exception, and SHALL report that Identifier to the App through the Edit_Callback as a Validation_Error whose Field_Path names the View_Settings field that holds it (for example `zoneFootprints.2.id` or `presets.0.filter.zones.1`). THE Core_View SHALL report each such Field_Path once per start, and once more per new History only when that History makes the Identifier missing where the previous `present` Scenario had it. The Visibility_Filter View_Helper itself still returns no Validation_Error for a missing Identifier (R-VIEW-07.6), and a Zone that has no Zone_Footprint is still not reported (R-VIEW-06.6).

### Requirement 3: Starting and stopping the view (R-VIEW-03)

**User Story:** As an App developer, I want one call that draws a Scenario in a page element, so that every App starts the 3D scene the same way.

#### Acceptance Criteria

1. WHEN the App starts the Core_View with a View_Host, a History, View_Settings, a Theme, an Image_Resolver, an Edit_Callback, a Walk_Callback, and a Timeline_Callback, THE Core_View SHALL draw the `present` Scenario of the History in the View_Host, with the first ViewPreset of the View_Settings as the Active_Preset, the camera at the Camera_Pose of that ViewPreset, and only the Visible_Set of its Visibility_Filter drawn.
2. IF the View_Settings, the Theme, or both fail their schema at start, THEN THE Core_View SHALL draw no 3D scene, SHALL show exactly one English message in the View_Host saying the settings are invalid, and SHALL call the Edit_Callback once with the Validation_Errors from the View_Settings_Loader and the Theme_Loader together.
3. IF the browser cannot create a WebGL context, THEN THE Core_View SHALL draw no 3D scene, SHALL show exactly one English message in the View_Host saying 3D display is not available, and SHALL throw no exception to the App.
4. WHEN the App gives the Core_View a new History, THE Core_View SHALL draw the `present` Scenario of that History in the next drawn frame, SHALL keep the Active_Preset and the camera pose unchanged, and SHALL apply the Visibility_Filter of the Active_Preset to the new Scenario.
5. WHEN the App stops the Core_View, THE Core_View SHALL remove every element it added to the View_Host, SHALL release the WebGL resources it created, and SHALL not call the Edit_Callback after the stop returns.
6. IF the App stops a Core_View that is already stopped, or gives a new History to a stopped Core_View, THEN THE Core_View SHALL throw no exception and SHALL leave the View_Host unchanged.
7. WHILE the Core_View shows the message of criterion 2 or criterion 3, THE Core_View SHALL ignore any new History from the App and SHALL keep showing that message until the App stops the Core_View.
8. THE Core_View SHALL show the `en` value of every Localized_Text it draws (tech.md "UI text ... are English by default").
9. THE Core_View SHALL draw all text only with font files that are bundled with the build and served from the Public_URL origin. THE Core_View SHALL load no external font fallback and no other remote resource (S-VIEW-3, R-FND-03.8).

### Requirement 4: Rendering Nodes (R-VIEW-04)

**User Story:** As an App developer, I want each Node drawn at its position, rotation, and scale with its content, so that the scene shows the Scenario as stored.

#### Acceptance Criteria

1. THE Core_View SHALL draw each visible Node (R-VIEW-07) as one flat rectangular panel whose center is at the Node's `position`, whose orientation is the Node's `rotation` (`x`, `y`, `z` in radians, applied as one Euler rotation in the axis order fixed in design.md), and whose width and height are a base panel size fixed in design.md multiplied by `scale.x` and `scale.y`. With a `rotation` of (0, 0, 0), the panel SHALL face the positive `z` direction.
2. IF the Front_Face holds `text` and no `image`, THEN THE Core_View SHALL draw the `en` value of that text on the panel, wrapped to the panel width. Text that does not fit the panel height after wrapping SHALL be cut off at the panel edge and SHALL NOT be drawn outside the panel.
3. IF the Front_Face holds `image`, THEN THE Core_View SHALL pass that Image_Reference to the Image_Resolver once per distinct Image_Reference and SHALL draw the returned image inside the panel, scaled to fit, with the image's width-to-height ratio kept to within 1 %.
4. IF the Front_Face holds both `image` and `text`, THEN THE Core_View SHALL draw the image as in criterion 3 and SHALL draw the `en` value of the text on the same panel, in a text area whose placement is fixed in design.md, without covering more than that text area of the image.
5. WHILE an image passed to the Image_Resolver has not finished loading, THE Core_View SHALL draw the panel as it would be drawn under criterion 6, and WHEN loading finishes, THE Core_View SHALL replace that drawing with the image within the next rendered frame.
6. IF the Image_Resolver returns "no image", throws an exception, or returns a source that fails to load, THEN THE Core_View SHALL draw the panel with the `en` value of the Front_Face `text` when present, or as an empty panel in the Node_Style of criterion 7 when no `text` is present. THE Core_View SHALL throw no exception, SHALL keep drawing every other Node, and SHALL leave the Scenario unchanged.
7. THE Core_View SHALL fill each Node panel with the color of the Node_Style listed in the Theme for the Node's Node_Type and SHALL draw the panel border with that Node_Style's border color. IF the Theme lists no Node_Style for that Node_Type, THEN THE Core_View SHALL use the Default_Style Node_Style.
8. WHEN the Scenario given to the Core_View changes (including after an Edit_Command, undo, or redo), THE Core_View SHALL draw every visible Node with the new `position`, `rotation`, `scale`, and Front_Face content within the next rendered frame.
9. THE Core_View SHALL draw only the Front_Face of a Node. Drawing the Back_Face is Open question Q6.

### Requirement 5: Rendering Edges (R-VIEW-05)

**User Story:** As an App developer, I want each Edge drawn as a directed line that follows its Nodes, so that connections stay readable while Nodes move.

#### Acceptance Criteria

1. THE Core_View SHALL draw each visible Edge (R-VIEW-07) as one line that starts at the outer edge of the panel of its `from` Node and ends at the outer edge of the panel of its `to` Node, with one arrow head whose tip touches the outer edge of the `to` Node panel and points toward that panel.
2. WHEN the Scenario given to the Core_View changes, including a Node position change during a drag (R-VIEW-13) or a gizmo Gesture (R-VIEW-14), an Edge being added or removed, and an undo or redo through the History, THE Core_View SHALL draw every affected Edge at its new position, add newly visible Edges, and remove deleted Edges in the first frame drawn after the change.
3. THE Core_View SHALL draw each Edge with the color, line width, and `dashed` flag of the Edge_Style of its Edge_Type from the Theme, and SHALL use the Default_Style Edge_Style for any Edge whose Edge_Type the Theme does not list.
4. WHEN two or more visible Edges connect the same pair of Nodes, in either direction, THE Core_View SHALL draw each of them as a separate line with its own arrow head, offset so that no two of these lines share a midpoint and the midpoints of any two of them are separated by at least the larger of their two line widths.
5. THE View_Helper that computes the offsets of R-VIEW-05.4 SHALL return the same offset for each Edge for the same Scenario, whatever order the Edges have in the Scenario, by ordering the Edges of one Node pair by their `id`.
6. WHEN a visible Edge has the same `from` and `to`, THE Core_View SHALL draw it as a closed loop that starts and ends at the outer edge of that Node panel, lies outside the panel, and has an arrow head pointing back at the panel; IF the same Node has two or more such Edges, THEN THE Core_View SHALL draw each loop at a different size or angle so that no two loops overlap along their whole length.
7. WHEN a visible Edge has a `label` whose `en` value is not empty, THE Core_View SHALL draw that `en` value at the midpoint of the line (or at the point of the loop farthest from the Node, for an Edge of R-VIEW-05.6), in the text color of the Theme, facing the camera.
8. IF a visible Edge has no `label`, or its `label` has an empty `en` value, THEN THE Core_View SHALL draw the Edge line and arrow head without any label text.

### Requirement 6: Rendering Zones (R-VIEW-06)

**User Story:** As an App developer, I want Zones drawn as floors at their height with walls when enclosed, so that the space shows order and levels.

#### Acceptance Criteria

1. THE Core_View SHALL draw each visible Zone (R-VIEW-07) that has a Zone_Footprint as one horizontal floor on its Zone_Plane, at height equal to the Zone's `elevation`, in the floor color of the Theme. A `rect` floor SHALL cover the rectangle of `width` along `x` and `depth` along `z` centered on (`x`, `z`). A `ring` floor SHALL cover the area between the circles of `innerRadius` and `outerRadius` around (`x`, `z`), and SHALL leave the area inside `innerRadius` uncovered.
2. THE Core_View SHALL draw the `en` value of the `label` of each Zone whose floor is drawn under criterion 1, in the text color of the Theme, on or above that floor and inside its Zone_Footprint.
3. WHEN a visible Zone that has a Zone_Footprint has `enclosed` set to `true`, THE Core_View SHALL draw one opaque Wall in the Wall color of the Theme, from its Zone_Plane up to the height `elevation` + Wall_Height. For a `rect` Zone_Footprint, the Wall SHALL follow all four sides of the rectangle. For a `ring` Zone_Footprint, the Wall SHALL follow the circle of `outerRadius` only.
4. WHILE a Wall is drawn, THE Core_View SHALL hide from the camera every drawn element whose line of sight from the camera position passes through that Wall, and SHALL keep visible every drawn element whose line of sight does not pass through a Wall.
5. IF a Zone is not visible under R-VIEW-07, or has `enclosed` set to `false`, THEN THE Core_View SHALL draw no Wall for it.
6. IF a Zone has no Zone_Footprint in the View_Settings, THEN THE Core_View SHALL draw no floor, no label, and no Wall for it, SHALL still draw its visible Nodes, and SHALL report no error for the missing Zone_Footprint.
7. WHEN the History gives a new Scenario in which the `elevation`, `enclosed`, or `label` of a Zone has changed, THE Core_View SHALL draw that Zone's floor, label, and Wall from the new values in the next drawn frame. The drawing SHALL keep no part based on the old values.
8. THE Core_View SHALL give `order`, `elevation`, and `enclosed` no meaning beyond the drawing of criteria 1 to 5 and the Camera_Path of R-VIEW-09.4. Only the Visibility_Filter (R-VIEW-07) SHALL decide which elements are visible: for any Scenario and Visibility_Filter, changing the `order`, `elevation`, or `enclosed` of any Zone SHALL leave the Visible_Set unchanged. Walls SHALL only support the Visibility_Filter visually (intent.md 4.3, as a generic rule).

### Requirement 7: Visibility filter (R-VIEW-07)

**User Story:** As an App developer, I want each ViewPreset to decide by rule which elements are visible, so that a viewpoint can show only part of the Scenario.

#### Acceptance Criteria

1. THE Core_View SHALL compute the Visible_Set with a View_Helper that takes a Scenario and a Visibility_Filter and reads from a Node only `id`, `type`, and `zone`, from an Edge only `id`, `from`, `to`, and `type`, and from a Zone only `id`.
2. THE View_Helper SHALL make a Node visible exactly when every given field holds: its `zone` is in `zones` (or, when the Node has no `zone`, `includeUnzoned` is `true`), and its `type` is in `nodeTypes`. A list field that is absent SHALL not restrict. When `includeUnzoned` is absent, it SHALL default to `true` if `zones` is absent and to `false` if `zones` is present.
3. THE View_Helper SHALL treat a list field that is present but empty (`zones`, `nodeTypes`, or `edgeTypes` with zero entries) as matching no element, so that no Zone, no zoned Node, no Node, or no Edge respectively passes that field.
4. THE View_Helper SHALL make an Edge visible exactly when its `type` is in `edgeTypes` (or `edgeTypes` is absent) and, for `edgeRule` `bothEnds`, both its `from` and `to` Nodes are visible, or, for `edgeRule` `anyEnd`, at least one of them is visible.
5. THE View_Helper SHALL make a Zone visible exactly when `zones` is absent or holds its `id`.
6. IF a Visibility_Filter lists a Zone Identifier, Node_Type, or Edge_Type that no element of the Scenario has, THEN THE View_Helper SHALL return no Validation_Error for that entry, SHALL let that entry match no element, and SHALL return the same Visible_Set as for the filter without that entry. When removing that entry would leave the list empty, the result is still the same, because an empty list also matches no element (criterion 3); ignoring an entry never turns a present list into an absent one.
7. THE View_Helper SHALL return the Identifiers of the Visible_Set in the order of the `nodes`, `edges`, and `zones` lists of the Scenario, with each Identifier at most once, and SHALL leave the Scenario and the Visibility_Filter it was given unchanged (deeply equal to their values before the call).
8. WHILE a ViewPreset is the Active_Preset, THE Core_View SHALL draw no element outside the Visible_Set of that ViewPreset's Visibility_Filter (including the Walls of a Zone outside it and the Detail_Layer of a Node outside it), SHALL let no element outside the Visible_Set be clicked or dragged, and SHALL draw no effect on it (R-VIEW-10.4).
9. WHEN the Active_Preset changes or the Scenario shown by the Core_View changes, THE Core_View SHALL recompute the Visible_Set before it draws the next frame, so that the drawn elements match the Visible_Set of the current Scenario and the current Active_Preset.
10. THE View_Helper SHALL return deeply equal Visible_Sets for deeply equal arguments, and SHALL return a result for every Scenario that passes the Scenario_Schema.

### Requirement 8: ViewPresets and switching (R-VIEW-08)

**User Story:** As a person using an App, I want to switch between named viewpoints with one action, so that I can see the same Scenario from different positions and with different visible parts.

#### Acceptance Criteria

1. THE Core_View SHALL offer the App one function that takes one ViewPreset `id` and sets the Active_Preset to the ViewPreset with that `id`.
2. WHEN the App sets the Active_Preset by an `id` that is in the View_Settings, THE Core_View SHALL move the camera from its current Camera_Pose to the Camera_Pose of that ViewPreset in a move that ends no later than 1.0 second after the call, and at the end of that move the camera `position` and `target` SHALL each equal the `position` and `target` of that ViewPreset.
3. WHILE the camera move of criterion 2 is in progress, THE Core_View SHALL draw only the elements in the Visible_Set of the previous Active_Preset. WHEN that move ends, THE Core_View SHALL draw from the next frame only the Nodes, Edges, and Zones in the Visible_Set (R-VIEW-07) of the new Active_Preset.
4. WHEN the App sets the Active_Preset while the camera move of an earlier call is still in progress, THE Core_View SHALL end the earlier move without applying its Visibility_Filter and SHALL start the move of criterion 2 from the camera's Camera_Pose at the moment of the new call.
5. WHEN the App sets the Active_Preset to the `id` of the current Active_Preset, THE Core_View SHALL move the camera back to the Camera_Pose of that ViewPreset as in criterion 2 and SHALL leave the Visible_Set unchanged.
6. IF the App asks for a ViewPreset `id` that is not in the View_Settings, THEN THE Core_View SHALL keep the Active_Preset, the camera pose, and the Visible_Set unchanged, and SHALL pass a Validation_Error with the Field_Path `presetId` to the Edit_Callback.
7. WHILE the Walk_State is `playing` or `paused`, WHEN the App sets the Active_Preset by an `id` that is in the View_Settings, THE Core_View SHALL set the Active_Preset and apply its Visibility_Filter from the next frame, SHALL leave the camera on the Camera_Path, and SHALL use the Camera_Pose of the new Active_Preset when the Walkthrough is stopped (R-VIEW-17.6).
8. WHILE no Walkthrough is `playing` and no camera move of criterion 2 is in progress, THE Core_View SHALL let the person orbit the camera around the `target` by dragging with the pointer on empty space and move the camera closer to or farther from the `target` with the mouse wheel, and SHALL keep the camera distance to the `target` greater than 0. Whether a ViewPreset can lock the camera is Open question Q8.
9. WHILE a gizmo Gesture (R-VIEW-14) or a drag (R-VIEW-13) is in progress, THE Core_View SHALL ignore camera orbit and zoom input, so that one pointer action moves either the camera or the Node, never both.
10. WHEN the Active_Preset changes, THE Core_View SHALL leave the History unchanged.
11. THE Core_View SHALL update the View_State (Active_Preset, Walk_State, Path_Progress, Selection, Connect_Mode, and Timeline playback state) only through the View_State_Reducer. THE View_State_Reducer SHALL be a View_Helper (R-VIEW-01.10) that takes one View_State and one view action as plain data and returns one View_State as plain data, and SHALL neither take a History as an argument nor hold or return a History in its result.

### Requirement 9: Camera paths (R-VIEW-09)

**User Story:** As an App developer, I want to describe a camera route as data, so that the core can move the camera along it the same way every time.

#### Acceptance Criteria

1. THE Core_View SHALL compute the Camera_Pose at a Path_Progress `p` with a View_Helper that takes a list of 2 or more Waypoints and `p`, and returns a Camera_Pose whose `position` lies on the `position` polyline at a distance of `p` × (total polyline length) from the first Waypoint, measured along the polyline, within an absolute tolerance of 1e-9 × (1 + total polyline length). At `p` = 0 the View_Helper SHALL return the first Waypoint exactly, and at `p` = 1 it SHALL return the last Waypoint exactly.
2. WHEN the View_Helper of criterion 1 places the `position` at fraction `t` (from 0 to 1) of the segment between two neighbouring Waypoints A and B, THE View_Helper SHALL return as `target` the point A.target + `t` × (B.target − A.target), within the same tolerance as criterion 1.
3. WHEN the View_Helper of criterion 1 is called twice with equal Waypoints and an equal Path_Progress, THE View_Helper SHALL return Camera_Poses whose components are equal number for number, and SHALL not change its inputs.
4. WHEN a Camera_Path has the value `fromZones`, THE Core_View SHALL build its Waypoints with a View_Helper that takes only the Zones that have a Zone_Footprint, in ascending `order`, and gives each such Zone one Waypoint. The `position` of that Waypoint SHALL be the footprint center (`x`, `z`) at the height `elevation` + camera height, where the camera height is a Finite_Number given in the Camera_Path. Its `target` SHALL be the `position` of the next Waypoint. For the last Waypoint, the `target` SHALL be its `position` + (previous Waypoint `target` − previous Waypoint `position`).
5. IF a Camera_Path built with `fromZones` has fewer than 2 Waypoints, or has a Waypoint whose `target` equals its `position` (two Zones next to each other in `order` give the same `position`), THEN THE Core_View SHALL start no Walkthrough on it, SHALL keep the Walk_State and the camera unchanged, and SHALL pass a Validation_Error with the Field_Path `paths.<index>` to the Edit_Callback.
6. IF a Path_Progress is not a Finite_Number from 0 to 1 inclusive (for example -0.01, 1.01, NaN, or Infinity), THEN THE View_Helper of criterion 1 SHALL return a failure with the Field_Path `progress` and no Camera_Pose.
7. WHEN two neighbouring Waypoints have the same `position`, THE View_Helper of criterion 1 SHALL treat that segment as length 0, SHALL return a Camera_Pose with only Finite_Number components for every Path_Progress from 0 to 1, and SHALL not divide by zero.
8. IF every Waypoint of a Camera_Path has the same `position` (total polyline length 0), THEN THE View_Helper of criterion 1 SHALL return the first Waypoint for every Path_Progress from 0 to less than 1, and the last Waypoint at Path_Progress 1.

### Requirement 10: Drawing fog from effect requests (R-VIEW-10)

**User Story:** As an App developer, I want the core to draw fog on the elements my rules mark, so that judgement results are visible without App drawing code.

#### Acceptance Criteria

1. THE Core_View SHALL offer the App one function that takes a list of zero or more Effect_Requests (R-RULES-13) and replaces the current list of Effect_Requests with it.
2. WHEN the Theme maps the Effect_Kind of an Effect_Request to an Effect_Style with `style` `fog`, THE Core_View SHALL draw one fog volume with the color and opacity of that Effect_Style. For a Node target, the volume encloses the Node panel. For an Edge target, it runs along the full length of the Edge line. For a Zone target, it covers the whole Zone_Footprint of that Zone at its Zone_Plane.
3. WHEN the Theme maps no Effect_Style to an Effect_Kind, THE Core_View SHALL draw nothing for Effect_Requests of that Effect_Kind and SHALL throw no exception.
4. IF an Effect_Target names an element that is outside the Visible_Set of the Active_Preset, THEN THE Core_View SHALL draw no effect for that Effect_Request.
5. IF an Effect_Target names no Node, Edge, or Zone of the drawn Scenario, THEN THE Core_View SHALL draw no effect for that Effect_Request, SHALL throw no exception, and SHALL still draw the other Effect_Requests of the same list.
6. WHEN the App sets a new list of Effect_Requests, THE Core_View SHALL draw only the Effect_Requests of the new list from the next drawn frame onward, and SHALL draw no effect of the previous list.
7. WHEN the App sets an empty list of Effect_Requests, THE Core_View SHALL draw no effect from the next drawn frame onward.
8. WHEN the Active_Preset changes, THE Core_View SHALL draw the effects of the current list of Effect_Requests on the elements of the new Visible_Set in the next drawn frame, and the App does not need to set the list again.
9. THE Core_View SHALL decide nothing about which elements get an effect. Every Effect_Request SHALL come from the App, which takes it from the Rule_Engine (intent.md ch. 0 rule 5).
10. IF an Effect_Request with a Zone target names a Zone that has no Zone_Footprint in the View_Settings, THEN THE Core_View SHALL draw no effect for that Effect_Request, SHALL report no error, and SHALL still draw the other Effect_Requests of the same list (consistent with R-VIEW-06.6).

### Requirement 11: Zoom detail layers (R-VIEW-11)

**User Story:** As a person using an App, I want extra text to appear when I zoom close to a Node, so that the scene shows more only where I look.

#### Acceptance Criteria

1. WHEN the straight-line 3D distance from the camera `position` to the `position` of a Node in the Visible_Set is less than or equal to Detail_Distance, THE Core_View SHALL draw the Detail_Layer of the Face currently drawn for that Node (the Front_Face unless another requirement of this spec draws the Back_Face).
2. WHEN the straight-line 3D distance from the camera `position` to the `position` of a Node in the Visible_Set is greater than Detail_Distance, THE Core_View SHALL draw no Detail_Layer for that Node.
3. THE Core_View SHALL decide criteria 1 and 2 with one View_Helper that takes a camera `position`, a Node `position`, and Detail_Distance, and returns `true` exactly when the straight-line 3D distance between the two positions is less than or equal to Detail_Distance, and `false` otherwise. For the same three inputs it SHALL always return the same result.
4. WHEN the camera `position` changes, a Node `position` changes, the Active_Preset changes, or the Visible_Set changes, THE Core_View SHALL update which Detail_Layers are drawn by the next drawn frame.
5. IF a Face has no `detail`, THEN THE Core_View SHALL draw no Detail_Layer for that Face at any distance.
6. IF a Node is not in the Visible_Set, THEN THE Core_View SHALL draw no Detail_Layer for that Node at any distance.

### Requirement 12: Selection (R-VIEW-12)

**User Story:** As a person using an App, I want to pick one Node by clicking it, so that I can then move, rotate, or scale it.

#### Acceptance Criteria

1. WHILE Edit_Mode is `edit` and Connect_Mode is off, WHEN the person clicks a Node in the Visible_Set of the Active_Preset, THE Core_View SHALL set the Selection to that Node, replacing any earlier Selection, and SHALL draw a selection outline on that Node and on no other Node. A click is one press and release of the primary pointer button where the pointer moves no more than 5 CSS pixels between press and release.
2. WHILE Edit_Mode is `edit` and Connect_Mode is off, WHEN the person clicks at a screen point where the pointer ray meets more than one drawn Node, THE Core_View SHALL set the Selection to the Node nearest to the camera along that ray.
3. WHILE Edit_Mode is `edit`, WHEN the person clicks at a screen point where the pointer ray meets no drawn Node (empty space, a Zone floor, a Wall, or an Edge), THE Core_View SHALL clear the Selection and remove the selection outline.
4. WHILE Edit_Mode is `edit`, IF the pointer moves more than 5 CSS pixels between press and release of the primary pointer button and the press did not start a Gesture of R-VIEW-13 to R-VIEW-15, THEN THE Core_View SHALL leave the Selection unchanged and SHALL issue no Edit_Command.
5. WHEN a new History removes the selected Node from the Scenario, THE Core_View SHALL clear the Selection and remove the selection outline.
6. WHEN the Active_Preset changes and the selected Node is not in the Visible_Set of the new Active_Preset, THE Core_View SHALL clear the Selection and remove the selection outline.
7. WHILE Edit_Mode is `view`, THE Core_View SHALL keep the Selection empty, SHALL draw no selection outline, and SHALL issue no Edit_Command. If the Selection was not empty when Edit_Mode changed to `view`, THE Core_View SHALL clear it.

### Requirement 13: Drag on the Zone plane with snapping (R-VIEW-13)

**User Story:** As a person using an App, I want to drag a Node across its floor and have it snap to a grid, so that layouts stay tidy and each move can be undone.

#### Acceptance Criteria

1. WHILE Edit_Mode is `edit`, WHEN the person presses the pointer on the selected Node and moves the pointer more than 5 CSS pixels from the press point (the same threshold as R-VIEW-12.1), THE Core_View SHALL start a drag and SHALL move the Node on the Zone_Plane of its Zone (the plane at height 0 for a Node with no `zone`), with `x` and `z` taken from the point where the pointer ray meets that Zone_Plane, and SHALL leave `position.y` of the Node unchanged.
2. WHILE a drag is in progress, THE Core_View SHALL draw the Node and its Edges (R-VIEW-05.2) at the Snapped position of the current pointer point in each frame. The Node is never drawn at a position that is not Snapped.
3. THE Snap View_Helper SHALL return a position whose `x` and `z` are each the multiple of Snap_Step nearest to the input value, with a value exactly halfway between two multiples rounded toward positive infinity, and whose `y` equals the input `y`. Applying Snap to its own result SHALL return a deeply equal position.
4. IF the pointer ray does not meet the Zone_Plane during a drag (for example when the camera looks parallel to the plane), THEN THE Core_View SHALL keep the Node at its last Snapped position until the ray meets the plane again or the drag ends.
5. WHEN the person releases a drag at a Snapped position whose `x` or `z` differs from the start position, THE Core_View SHALL pass exactly one update Node Edit_Command, holding the Snapped `position` as its new `position`, to the History_Functions, and SHALL pass the resulting History to the Edit_Callback exactly once.
6. WHEN the person releases a drag at a Snapped position whose `x` and `z` both equal those of the start position, THE Core_View SHALL issue no Edit_Command and SHALL not call the Edit_Callback.
7. IF the Command_Applier rejects the Edit_Command of a drag, THEN THE Core_View SHALL leave the History unchanged, SHALL draw the Node at its `position` in that History in the next frame, and SHALL pass the Validation_Errors to the Edit_Callback.
8. WHILE Edit_Mode is `view`, THE Core_View SHALL not move any Node on pointer drag and SHALL issue no Edit_Command (R-VIEW-12.7).
9. THE Core_View SHALL leave the `zone` of a dragged Node unchanged. Whether a drag into another Zone_Footprint changes `zone` is Open question Q9.

### Requirement 14: Gizmo rotation and scaling (R-VIEW-14)

**User Story:** As a person using an App, I want a gizmo to rotate a Node around three axes and to scale it, so that I can change how it looks and undo each change.

#### Acceptance Criteria

1. WHILE Edit_Mode is `edit` and a Node is selected, THE Core_View SHALL show a gizmo on that Node in exactly one of two modes, `rotate` (one handle for each of the `x`, `y`, and `z` axes) or `scale`, and SHALL show the `rotate` mode by default when a Node becomes selected.
2. WHILE Edit_Mode is `edit` and a Node is selected, WHEN the App or the person switches the gizmo mode, THE Core_View SHALL show the other mode on the same Node, SHALL issue no Edit_Command for the switch, and SHALL leave the Node's `position`, `rotation`, and `scale` unchanged.
3. WHILE Edit_Mode is `view` or the Selection is empty, THE Core_View SHALL show no gizmo.
4. WHILE a gizmo Gesture is in progress, THE Core_View SHALL draw the Node with the current gizmo `rotation` or `scale`, SHALL change only the component or components of the dragged handle, and SHALL pass no Edit_Command to the History_Functions until the Gesture ends.
5. WHEN the person ends a gizmo Gesture whose `rotation` or `scale` differs from the value at the start of the Gesture, THE Core_View SHALL pass exactly one update Node Edit_Command holding only the changed field (`rotation` in `rotate` mode, `scale` in `scale` mode) to the History_Functions, and SHALL pass the resulting History to the Edit_Callback.
6. WHEN the person ends a gizmo Gesture whose `rotation` and `scale` equal the values at the start of the Gesture, THE Core_View SHALL issue no Edit_Command.
7. THE Core_View SHALL keep each `scale` component at or above a minimum Positive_Number given in design.md during a gizmo Gesture, so that the Edit_Command never holds a `scale` that the Scenario_Schema rejects (R-GRAPH-01.3).
8. IF the Command_Applier rejects the Edit_Command of a gizmo Gesture, THEN THE Core_View SHALL draw the Node with the `rotation` and `scale` of the unchanged History, SHALL keep that History as the current History, and SHALL pass the Validation_Errors to the Edit_Callback.

### Requirement 15: Connecting two Nodes by clicks (R-VIEW-15)

**User Story:** As a person using an App, I want to connect two Nodes by clicking one and then the other, so that I can add a connection without typing.

#### Acceptance Criteria

1. THE Core_View SHALL offer the App one function that turns Connect_Mode on with an Edge_Type given by the App, and one function that turns Connect_Mode off.
2. WHEN the App turns Connect_Mode on while Connect_Mode is already on, THE Core_View SHALL cancel any pending connection, issue no Edit_Command, and use the newly given Edge_Type for the next connection.
3. WHILE Edit_Mode is `edit` and Connect_Mode is on, WHEN the person clicks a first visible Node and then a second visible Node that is not the first one, THE Core_View SHALL pass exactly one add Edge Edit_Command to the History_Functions. The command's Edge SHALL go from the first Node to the second Node and SHALL have the Edge_Type given when Connect_Mode was turned on. THE Core_View SHALL then pass the resulting History to the Edit_Callback exactly once.
4. WHEN the add Edge Edit_Command of criterion 3 has been passed to the History_Functions, whether it was accepted or rejected, THE Core_View SHALL clear the picked first Node, stop drawing the line of criterion 6, and keep Connect_Mode on until the App turns it off.
5. THE Core_View SHALL give the new Edge an `id` chosen by a View_Helper. The `id` SHALL be a valid Identifier, SHALL be the same for deeply equal Scenarios, and SHALL never equal the `id` of an Edge already in the Scenario.
6. WHILE Connect_Mode is on and a first Node is picked, THE Core_View SHALL draw one line that starts at the drawn position of that Node and ends at the current pointer position on screen, updated on each pointer move.
7. WHEN any of the following happens while a first Node is picked, THE Core_View SHALL cancel the pending connection, stop drawing the line of criterion 6, and issue no Edit_Command:
   - the person clicks the first Node again;
   - the person clicks where no Node is drawn;
   - the App turns Connect_Mode off;
   - Edit_Mode changes to `view`;
   - a new History removes the first Node from the Scenario;
   - a change of the Active_Preset removes the first Node from the Visible_Set.
8. WHILE Edit_Mode is `view`, THE Core_View SHALL treat Node clicks as no part of a connection and SHALL issue no add Edge Edit_Command, even when Connect_Mode is on.
9. IF the Command_Applier rejects the add Edge Edit_Command, THEN THE Core_View SHALL pass the Validation_Errors to the Edit_Callback, SHALL leave the History and the Scenario unchanged, and SHALL draw no new Edge.

### Requirement 16: Undo, redo, and performance of interaction (R-VIEW-16)

**User Story:** As a person using an App, I want to undo and redo every gesture and to move things without lag, so that I can try changes without fear.

#### Acceptance Criteria

1. THE Core_View SHALL offer the App one undo function and one redo function. Each function SHALL call the matching History_Function (undo R-GRAPH-12.4, redo R-GRAPH-12.5) on the current History and SHALL pass the History it returns to the Edit_Callback exactly once per call.
2. WHEN a Gesture that changes one or more Nodes, Edges, or Zones ends, THE Core_View SHALL execute exactly one Edit_Command on the History. If the Gesture changes one element, that command is an Edit_Command. If it changes two or more elements, that command is one Batch_Command. THE Core_View SHALL execute no Edit_Command for the pointer moves in the middle of the Gesture, so that one undo takes back the whole Gesture and the `past` of the History grows by at most 1 entry per Gesture (R-GRAPH-12.9).
3. WHEN undo or redo returns a History whose `present` Scenario differs from the `present` Scenario before the call, THE Core_View SHALL draw the new `present` Scenario in the next drawn frame. Every Node, Edge, and Zone SHALL then match the `present` Scenario in position, rotation, scale, and presence.
4. WHEN a Scenario is drawn on the Reference_Machine at a View_Host size of 1920 × 1080 pixels, with 50 visible Nodes that each show an image, plus the Edges and Zones of that Scenario, THE Core_View SHALL keep the median frame time at or below 16.7 milliseconds. The median is measured over every frame drawn during 10 continuous seconds of camera orbit and Node drag (intent.md 3.3: 60 fps with 50 images). The image pixel size and the Edge and Zone counts of the test Scenario are the values named in design.md next to the Reference_Machine.
5. IF a Gesture ends and the resulting positions, rotations, and scales are all deeply equal to the values before the Gesture (for example, a drag whose Snapped position equals the start position), THEN THE Core_View SHALL execute no Edit_Command and SHALL NOT call the Edit_Callback.
6. IF the Command_Applier rejects the Edit_Command or Batch_Command of a Gesture (R-GRAPH-12.3), THEN THE Core_View SHALL call the Edit_Callback with the Validation_Errors and the unchanged History. In the next drawn frame it SHALL draw every element the Gesture touched at its pre-Gesture position, rotation, and scale.
7. IF undo is called on a History whose `past` is empty, or redo is called on a History whose `future` is empty, THEN THE Core_View SHALL leave the drawn Scenario unchanged, show no error, and throw no exception (R-GRAPH-12.6, R-GRAPH-12.7).

### Requirement 17: Walkthrough playback (R-VIEW-17)

**User Story:** As a person using an App, I want to start a walkthrough with one action and watch the camera move along a route, so that I can see the space in the order it is meant to be experienced.

#### Acceptance Criteria

1. THE Core_View SHALL offer the App one start function that takes a Camera_Path `id`, a Walk_Duration, and an optional Linked_Timeline, so that the App can start a Walkthrough with one person action (intent.md 5.7, as a generic rule).
2. WHEN the App calls the start function with a Camera_Path `id` that is in the View_Settings and a Walk_Duration that is a Positive_Number, THE Core_View SHALL set the playing time to 0 seconds, set the camera to the first Waypoint, and set the Walk_State to `playing`. This applies in every Walk_State, including `playing` and `paused`, where the running Walkthrough is replaced.
3. WHILE the Walk_State is `playing`, THE Core_View SHALL set the camera in each drawn frame to the Camera_Pose at Path_Progress = min(1, playing time ÷ Walk_Duration) (R-VIEW-09.1). Playing time is the seconds spent in the `playing` state since the last start, and time spent in `paused` does not count.
4. WHILE the Walk_State is `playing` or `paused`, THE Core_View SHALL ignore camera orbit and zoom input, and SHALL issue no Edit_Command.
5. WHEN the playing time reaches or passes Walk_Duration, THE Core_View SHALL set the camera to the last Waypoint (Path_Progress 1), set the Walk_State to `finished`, and leave the camera at that Camera_Pose until the App calls start or stop, or sets the Active_Preset. WHEN the App sets the Active_Preset while the Walk_State is `finished`, THE Core_View SHALL set the Walk_State to `idle` and move the camera to the Camera_Pose of that ViewPreset as in R-VIEW-08.2.
6. THE Core_View SHALL offer the App pause, resume, and stop functions with these effects:
   - Pause, called in `playing`, keeps the Path_Progress and sets the Walk_State to `paused`.
   - Resume, called in `paused`, continues from that Path_Progress and sets the Walk_State to `playing`.
   - Stop, called in `playing`, `paused`, or `finished`, sets the Walk_State to `idle` and sets the camera to the Camera_Pose of the Active_Preset.
7. IF the App calls pause, resume, or stop in a Walk_State that criterion 6 does not list for that function, THEN THE Core_View SHALL leave the Walk_State, the Path_Progress, and the camera unchanged and SHALL report no Walk_State change.
8. IF the App calls the start function with a Camera_Path `id` that is not in the View_Settings or with a Walk_Duration that is not a Positive_Number, THEN THE Core_View SHALL pass a Validation_Error naming the invalid argument to the Edit_Callback, and SHALL leave the Walk_State, the Path_Progress, and the camera unchanged.
9. WHEN the Walk_State changes, THE Core_View SHALL call the Walk_Callback exactly once in that frame, with the new Walk_State and the current Path_Progress.
10. WHILE the Walk_State is `playing`, THE Core_View SHALL call the Walk_Callback once per drawn frame with the current Path_Progress, and each reported value SHALL be from 0 to 1 and not less than the value reported before it since the last start. In a frame where the Walk_State changes, the call of criterion 9 is the only Walk_Callback call of that frame, and this criterion adds no second call.
11. WHEN the App calls the start function with a valid Camera_Path `id`, a valid Walk_Duration, and a Linked_Timeline that meets all of these Link_Conditions, THE Core_View SHALL start the Walkthrough as in criterion 2 and the linked Timeline playback of R-VIEW-18.10 in the same rendered frame. The Link_Conditions are: the Camera_Path has the value `fromZones`; the Linked_Timeline passes the Timeline and Timeline_Step schema of the Rule_Engine (R-RULES-14.1, R-RULES-14.2); the number of its Timeline_Steps equals the number of Waypoints built by R-VIEW-09.4; and for each index `i`, the `targets` of Timeline_Step `i` hold exactly one target, which is the Zone of Waypoint `i` (so the steps follow the Zones that have a Zone_Footprint, in ascending `order`). Timeline_Steps are matched to Waypoints by index only. The check of the Link_Conditions is a View_Helper. Note for Apps: a Timeline built with one step per Zone of the Scenario meets the Link_Conditions only when every Zone has a Zone_Footprint; otherwise the App builds the Linked_Timeline from the Zones that have a Zone_Footprint only, in ascending `order`.
12. IF the App calls the start function with a Linked_Timeline that breaks one or more Link_Conditions of criterion 11, THEN THE Core_View SHALL start neither the Walkthrough nor a Timeline playback, SHALL leave the Walk_State, the Path_Progress, the camera, any running Timeline playback, and the drawn Effect_Requests unchanged, and SHALL pass a Validation_Error with a Field_Path that starts with `timeline` to the Edit_Callback.
13. WHEN the App calls the start function with a valid Camera_Path `id` and a valid Walk_Duration, with or without a Linked_Timeline, while a Timeline playback linked to an earlier Walkthrough is running, paused, or ended, THE Core_View SHALL first stop that linked Timeline playback as in R-VIEW-18.7, and then start the new Walkthrough as in criterion 2 or criterion 11.
14. WHEN the App calls stop (criterion 6) on a Walkthrough that was started with a Linked_Timeline, THE Core_View SHALL also stop the linked Timeline playback as in R-VIEW-18.7.
15. WHILE a Walkthrough started with a Linked_Timeline is `playing` or `paused`, THE Core_View SHALL ignore calls to the Timeline pause and resume functions of R-VIEW-18.1, leaving the Timeline_Cursor and the drawn Effect_Requests unchanged. WHEN the App calls pause or resume of that Walkthrough (criterion 6), THE Core_View SHALL pause or resume both the Walkthrough and the linked Timeline playback.

### Requirement 18: Timeline playback timing (R-VIEW-18)

**User Story:** As an App developer, I want the core to step through a Timeline at a fixed pace and show each step's effects, so that ordered changes can be replayed (R-RULES-14.11).

#### Acceptance Criteria

1. THE Core_View SHALL offer the App functions that start, pause, resume, and stop the playback of one Timeline, and SHALL run at most one Timeline playback per View_Host at a time.
2. WHEN the App starts Timeline playback, THE Core_View SHALL create a Timeline_Cursor at `position` 0 (R-RULES-14.6), draw the Effect_Requests of step 0 in the same rendered frame, and report `position` 0 to the App through the Timeline_Callback.
3. WHILE Timeline playback is running, THE Core_View SHALL move the Timeline_Cursor to the next step with the Rule_Engine function (R-RULES-14.7) each time one Step_Duration has passed since the last move. The time between moves SHALL be within 100 ms of Step_Duration on the Reference_Machine, and time spent paused SHALL not count.
4. WHEN the Timeline_Cursor moves, THE Core_View SHALL draw the Effect_Requests of steps 0 to `position` together (R-RULES-14.10) in place of the Effect_Requests set by the App, and SHALL report the new `position` to the App through the Timeline_Callback exactly once per move.
5. WHEN the Timeline_Cursor has been on the last step for one Step_Duration, THE Core_View SHALL end the playback, keep the Timeline_Cursor on the last step, keep drawing the Effect_Requests of steps 0 to the last step, and report the end to the App through the Timeline_Callback. For a Timeline with one step, this happens one Step_Duration after start.
6. WHEN the App pauses Timeline playback, THE Core_View SHALL keep the current Timeline_Cursor and the drawn Effect_Requests unchanged and make no further cursor move until the App resumes. WHEN the App resumes, THE Core_View SHALL make the next move after the part of the Step_Duration that had not passed at the time of the pause.
7. WHEN the App stops Timeline playback, whether it is running, paused, or ended, THE Core_View SHALL stop all cursor moves, draw again the Effect_Requests set by the App (R-VIEW-10.1), and make no further position callback.
8. IF the App starts Timeline playback while another Timeline playback is running, paused, or ended, THEN THE Core_View SHALL stop the earlier playback as in criterion 7 and then start the new playback from `position` 0 as in criterion 2.
9. IF the Timeline given at start does not match the Timeline and Timeline_Step schema of the Rule_Engine (R-RULES-14.2), THEN THE Core_View SHALL not start playback, SHALL keep drawing the Effect_Requests that were drawn before the call, and SHALL pass the Validation_Errors to the Edit_Callback.
10. WHEN a Walkthrough is started with a Linked_Timeline that R-VIEW-17.11 accepts, THE Core_View SHALL stop any earlier Timeline playback as in criterion 7, SHALL start the playback of the Linked_Timeline as in criterion 2, SHALL move the Timeline_Cursor to step `i` in the same rendered frame in which the Path_Progress reaches or passes the Path_Progress of Waypoint `i` (its polyline length from the first Waypoint divided by the total polyline length), and SHALL not use the Step_Duration pace. A Timeline that the App passes without the Linked_Timeline argument is never linked to a Walkthrough and keeps the Step_Duration pace of criterion 3. WHILE that Walkthrough is `paused`, THE Core_View SHALL make no cursor move. WHEN that Walkthrough reaches `finished`, THE Core_View SHALL end the Timeline playback as in criterion 5 at once.

### Requirement 19: Theme swapping (R-VIEW-19)

**User Story:** As an App developer, I want to swap the whole look of the scene with one plain data value, so that each App can have its own look on the same engine.

#### Acceptance Criteria

1. THE Core_View SHALL define the Theme_Schema exactly once, in one file under `core/view/`, and THE Core_View SHALL infer the TypeScript types for Theme, Node_Style, Edge_Style, and Effect_Style from Zod schemas, with no hand-written duplicate type declarations.
2. THE Theme_Schema SHALL accept any Identifier as a key of the Node_Style, Edge_Style, and Effect_Style maps, SHALL accept maps with zero entries, and SHALL contain no list of allowed keys (R-VIEW-01.7).
3. THE Theme_Schema SHALL require every color in the Theme to be a `#rrggbb` string of 7 characters with hexadecimal digits in upper or lower case, every Edge_Style line width to be a Positive_Number, every Edge_Style `dashed` flag to be a boolean, every Effect_Style `style` to be `fog`, and every fog opacity to be a Finite_Number from 0 to 1 inclusive.
4. WHEN the Theme_Loader receives a value that matches the Theme_Schema, THE Theme_Loader SHALL return a Theme that is deeply equal to that value with unknown fields removed at every level of nesting (as in R-VIEW-02.2), and SHALL leave the input value unchanged.
5. IF the Theme_Loader receives a value that does not match the Theme_Schema, including a value that is not an object, a missing required field, a color that is not a `#rrggbb` string, an Effect_Style `style` other than `fog`, or a fog opacity outside 0 to 1, THEN THE Theme_Loader SHALL return every Validation_Error, each with a Field_Path relative to the Theme, and no Theme, without throwing an exception.
6. WHEN the App gives the Core_View a new Theme that passes the Theme_Schema, THE Core_View SHALL draw the next frame with the new Theme and SHALL leave the Scenario, the History, the Active_Preset, the camera pose, the Selection, and the Walk_State unchanged.
7. IF the App gives the Core_View a Theme that fails the Theme_Schema, THEN THE Core_View SHALL keep drawing with the current Theme, SHALL leave the Scenario, the History, the Active_Preset, the camera pose, the Selection, and the Walk_State unchanged, and SHALL call the Edit_Callback once with the Validation_Errors that the Theme_Loader returns for that value.
8. IF the Scenario contains a Node whose Node_Type or an Edge whose Edge_Type is not a key of the current Theme's Node_Style or Edge_Style map, THEN THE Core_View SHALL draw that Node or Edge with the Default_Style of the current Theme and SHALL not report an error.
9. THE Core_View SHALL provide one neutral Theme in `core/view/` that passes the Theme_Schema and holds only Default_Styles and colors, with zero entries in the Node_Style, Edge_Style, and Effect_Style maps. App looks belong to `apps/<app>/theme/` (structure.md).

### Requirement 20: View determinism and model independence (R-VIEW-20)

**User Story:** As the developer, I want the view never to change a judgement and its pure helpers to be repeatable, so that rules alone decide every result.

#### Acceptance Criteria

1. WHEN a View_Helper is called twice with deeply equal arguments, THE View_Helper SHALL return deeply equal results, where deep equality treats `-0` and `0` as equal. This equality is the one defined in the generators note of the PBT properties section of `.kiro/specs/core-graph/requirements.md`; R-GRAPH-10.6 states the matching determinism rule for the Graph_Model.
2. WHEN a View_Helper returns, THE View_Helper SHALL leave every argument deeply equal to its value before the call (as in R-GRAPH-10.7).
3. THE View_Helpers SHALL read no clock, random source, file, network, DOM, or global mutable state. This is checked by the determinism property tests of criterion 1 and by the reviewer agent, with no new lint rule (as in `core-graph` Q36).
4. THE Core_View SHALL call no Rule_Engine function that produces a judgement result (conditions, propagation, sums, shifts, or Effect_Request creation). THE Core_View SHALL call the Timeline creation and validation function of the Rule_Engine (R-RULES-14.1, R-RULES-14.2) only to check a Timeline given by the App (R-VIEW-17.11, R-VIEW-18.9), and the Timeline_Cursor functions of the Rule_Engine (R-RULES-14.6, R-RULES-14.7, R-RULES-14.10) only for the playback timing of R-VIEW-18; these functions compute no judgement and only check or step through the Timeline_Steps that the App gave. The only judgement results the Core_View SHALL draw are the Effect_Requests and Timeline_Steps that the App passes in, which the App takes from the Rule_Engine (intent.md ch. 0 rule 5; R-VIEW-10.9).
5. WHEN the Core_View draws, switches the Active_Preset, zooms, plays a Walkthrough, plays a Timeline, or swaps the Theme, THE Core_View SHALL leave the History deeply equal to its value before that action. The History SHALL change only through a Gesture of R-VIEW-13 to R-VIEW-15 that the Command_Applier accepts, or through the undo and redo functions of R-VIEW-16.1.
6. WHEN the Core_View receives a Scenario, View_Settings, Theme, list of Effect_Requests, or Timeline from the App, THE Core_View SHALL leave that value deeply equal to its value at the time it was received, for as long as the Core_View runs.
7. IF a View_Helper receives any argument value, including a value that fails the View_Settings_Schema, the Theme_Schema, or the Scenario_Schema, a non-finite number, `null`, `undefined`, or an empty list, THEN THE View_Helper SHALL return either a result or a failure holding a non-empty list of Validation_Errors, and SHALL throw no exception.

### Requirement 21: Core demo (R-VIEW-21)

**User Story:** As a judge, I want to open a generic demo of the core on the public URL and switch between two viewpoints, so that I can see that the shared engine runs on its own (intent.md 10.6 completion criterion: a demo that switches between two viewpoints runs).

#### Acceptance Criteria

1. THE Repository SHALL contain the Core_Demo as one HTML entry page with its script under `core/view/demo/`, and THE Build_System SHALL build that page as one entry of the Vite multi-page project. design.md fixes the output path of the Core_Demo in `dist/` and its path under the Public_URL base path; that path SHALL not contain an `apps` segment (R-FND-02.5).
2. THE Core_Demo SHALL start the Core_View with one Sample_Scenario stored under `core/view/demo/`, View_Settings that hold at least two ViewPresets with different Camera_Poses, and the neutral Theme of R-VIEW-19.9 or a Theme stored under `core/view/demo/`. THE Sample_Scenario SHALL pass the Scenario_Schema, checked by one example test next to it.
3. THE Sample_Scenario, the View_Settings, the Theme, and every file under `core/view/demo/` SHALL contain no App_Specific_Name (R-VIEW-01.6) and SHALL use only generic Node_Types, Edge_Types, Zone Identifiers, and texts.
4. THE Core_Demo SHALL show one control per ViewPreset, labelled with the `en` value of that ViewPreset's `label`. WHEN the person activates one such control with one click, THE Core_Demo SHALL set the Active_Preset to that ViewPreset through the function of R-VIEW-08.1.
5. THE Top_Page SHALL contain exactly one link to the Core_Demo, labelled with a Localized_Text value (R-FND-03.6), in addition to the two App links of R-FND-03.1.
6. THE Core_Demo code under `core/view/demo/` SHALL be the only code under `core/view/` that starts the Core_View with sample data. No other non-test file under `core/view/` SHALL import from `core/view/demo/`.
7. WHEN a visitor opens the Core_Demo on the Public_URL in a desktop browser, THE Core_Demo SHALL draw the Sample_Scenario with the first ViewPreset, and WHEN the visitor clicks the control of the other ViewPreset, THE Core_Demo SHALL show the Sample_Scenario from that ViewPreset (manual check on the Public_URL at the verification gate of this Unit).
8. This spec amends `repo-foundation` as follows, and THE Repository SHALL hold these amendments once the Core_Demo task is completed:
   - R-FND-02.4: the multi-page Vite project has exactly four entry pages, the three listed there plus the Core_Demo page.
   - R-FND-02.5: the build also writes the Core_Demo page to the output path fixed in design.md, and the sentence "every script, style, and asset reference in the three pages SHALL resolve under the Public_URL base path" reads "the four pages", so the Core_Demo page is included in base-path resolution.
   - R-FND-03.1: the Top_Page also shows exactly one link to the Core_Demo (criterion 5).
   - R-FND-03.9: the list of paths that are not answered with the host's not-found page ("the Top_Page, `/ghost-mansion/`, `/moodwalk/`, or a built asset") also includes the Core_Demo path fixed in design.md, and the Core_Demo stays reachable at its own path.
   - R-FND-02.7: the allowed package list also includes the packages of R-VIEW-01.1: `three`, `@react-three/fiber`, `@react-three/drei`, and their type-definition packages, including `@types/three`.
   - R-FND-10.11: the check:build scan also fails if the Core_Demo output page does not exist, and checks the script, style, and asset paths of the Core_Demo page in the same way as the other three pages.
9. WHEN the task that makes the amendments of criterion 8 is completed, THE Repository SHALL contain one new line in `docs/decision-log.md` that names R-FND-02.4, R-FND-02.5, R-FND-02.7, R-FND-03.1, R-FND-03.9, and R-FND-10.11 and the change made to each.

## PBT properties

These properties come from intent.md 10.6. `core/view` is not the main PBT target; the five 10.6 properties are covered by `core-graph` (P-GRAPH-1, P-GRAPH-3, P-GRAPH-4) and `core-rules` (P-RULES-1 to P-RULES-3). This spec applies "same input → same result" to the View_Helpers and adds "the view never changes the model". Only View_Helpers, which import no three.js or React package, are property-tested. Each property runs at least 100 generated cases with fast-check, and each test name contains its property ID (as in R-FND-10.5).

Generators produce valid Scenarios with the `core-graph` arbitraries (`core/model/arbitraries.ts`), Visibility_Filters naming existing and missing Identifiers with both `edgeRule` values, Camera_Paths of 2 to 10 Waypoints (including Waypoints with equal `position`), Path_Progress values from 0 to 1 and invalid values, positions with Finite_Number components, Snap_Step values that are Positive_Numbers, Zones with and without Zone_Footprints (including pairs of Zones with equal footprint centers), Timelines with matching and non-matching steps, sequences of view actions for the View_State_Reducer, and any JSON values for the loaders.

- **P-VIEW-1 (same input → same result).** FOR ALL arguments, running each View_Helper twice on deep copies SHALL return deeply equal results, including list order, and SHALL leave the arguments unchanged. FOR ALL Scenarios, permuting the order of the Edges in the Scenario SHALL leave the offset of each Edge (R-VIEW-05.5) unchanged. (R-VIEW-05.5, R-VIEW-07.10, R-VIEW-15.5, R-VIEW-20.1, R-VIEW-20.2)
- **P-VIEW-2 (the view never changes the model).** FOR ALL Histories, View_States, and sequences of non-editing view actions (ViewPreset switch, Walkthrough start, pause, resume, and stop, Path_Progress update, Selection change, Connect_Mode change, Timeline playback change, Visible_Set computation, Camera_Pose computation, Detail_Layer decision, Theme load), applying the View_State_Reducer and the other View_Helpers SHALL leave the History deeply equal to its value before the sequence, and no View_State returned by the View_State_Reducer SHALL hold a History. This is checked on plain data, without rendering. (R-VIEW-08.10, R-VIEW-08.11, R-VIEW-20.5)
- **P-VIEW-3 (visibility rules).** FOR ALL Scenarios and Visibility_Filters, every visible Edge with `edgeRule` `bothEnds` SHALL have both end Nodes visible; the visible Edges with `bothEnds` SHALL be a subset of those with `anyEnd`; removing an entry from `zones`, `nodeTypes`, or `edgeTypes` SHALL never add an element to the Visible_Set; the Visible_Set SHALL list only Identifiers of the Scenario, in list order; and changing the `order`, `elevation`, or `enclosed` of any Zone SHALL leave the Visible_Set unchanged. (R-VIEW-06.8, R-VIEW-07.2 to R-VIEW-07.7)
- **P-VIEW-4 (camera path interpolation).** FOR ALL Camera_Paths, the Camera_Pose at Path_Progress 0 SHALL equal the first Waypoint and at 1 the last Waypoint; the polyline length from the start to the pose SHALL not decrease as Path_Progress grows; every pose `position` SHALL lie on a segment between two neighbouring Waypoints; the pose `target` SHALL equal A.target + `t` × (B.target − A.target) for the segment A to B and fraction `t` of that `position`, within the tolerance of R-VIEW-09.1; and every invalid Path_Progress SHALL return a failure with the Field_Path `progress`. FOR ALL Scenarios and Zone_Footprints, the `fromZones` View_Helper SHALL build exactly one Waypoint per Zone that has a Zone_Footprint, in ascending Zone `order`, and SHALL return a failure when it would build fewer than 2 Waypoints or a Waypoint whose `target` equals its `position`. (R-VIEW-09.1, R-VIEW-09.2, R-VIEW-09.4, R-VIEW-09.5, R-VIEW-09.6, R-VIEW-09.7, R-VIEW-09.8)
- **P-VIEW-5 (snapping).** FOR ALL positions and Snap_Steps, Snap SHALL be idempotent (snapping twice equals snapping once), SHALL leave `y` unchanged, and SHALL move `x` and `z` each by at most half of Snap_Step. (R-VIEW-13.3)
- **P-VIEW-6 (detail layer decision).** FOR ALL camera positions, Node positions, and Detail_Distances, the decision SHALL be `true` exactly when the distance is at most Detail_Distance, so moving the camera closer to the Node never turns `true` into `false`. (R-VIEW-11.1 to R-VIEW-11.3)
- **P-VIEW-7 (gesture commands are accepted and undone in one step).** FOR ALL valid Scenarios, Nodes, and Snapped drag positions or gizmo results within the scale minimum, the Edit_Command built by the View_Helper for that Gesture SHALL be accepted by the Command_Applier, and one undo SHALL return a `present` deeply equal to the Scenario before the Gesture. FOR ALL Scenarios and Node pairs, the new Edge `id` SHALL be absent from the Scenario. (R-VIEW-13.5, R-VIEW-14.5, R-VIEW-14.7, R-VIEW-15.5, R-VIEW-16.2)
- **P-VIEW-8 (settings and themes are checked without throwing).** FOR ALL JSON values, the View_Settings_Loader and the Theme_Loader SHALL return a result without throwing; FOR ALL valid values with one required field removed or given a value of the wrong type, they SHALL return Validation_Errors that include the path of that field; FOR ALL valid values with unknown fields added at any level of nesting, they SHALL return a value deeply equal to the valid value without those fields. (R-VIEW-02.2, R-VIEW-02.3, R-VIEW-02.7, R-VIEW-19.4, R-VIEW-19.5)
- **P-VIEW-9 (parallel edges stay apart).** FOR ALL Scenarios, Themes, and Node pairs connected by 2 or more visible Edges in either direction, the line midpoints computed with the offsets of the View_Helper of R-VIEW-05.5 SHALL be pairwise distinct, and any two of them SHALL be separated by at least the larger of their two Edge_Style line widths. (R-VIEW-05.4, R-VIEW-05.5)

Rendering criteria (R-VIEW-02.8, R-VIEW-03 to R-VIEW-06 except the Visible_Set part of R-VIEW-06.8, R-VIEW-07.8, R-VIEW-07.9, R-VIEW-08.2 to R-VIEW-08.9, R-VIEW-10, R-VIEW-11.4 to R-VIEW-11.6, R-VIEW-12 to R-VIEW-15 pointer handling, R-VIEW-17, R-VIEW-18, R-VIEW-19.6 to R-VIEW-19.8) are not property-tested. They are covered by example tests where they can run without WebGL, and by a human check on the public URL at the verification gate. For R-VIEW-03.9 and S-VIEW-3, that human check includes the browser network panel on the Public_URL, which SHALL show no request to any origin other than the Public_URL origin. The Link_Conditions check of R-VIEW-17.11 and R-VIEW-17.12 is a View_Helper covered by P-VIEW-1 and by example tests for each failing condition. R-VIEW-21 is checked by the example test of R-VIEW-21.2, by the check:build scan (R-VIEW-21.8), and by a human on the public URL (R-VIEW-21.7). R-VIEW-16.4 (frame time) is measured by hand on the Reference_Machine in the build task of R-VIEW-16.4 and at the gate, and the result is recorded in `docs/decision-log.md` (see Q2).

## Safety

Follows `safety.md` (intent.md ch. 9).

- **S-VIEW-1.** THE Core_View SHALL contain no attack content: no attack cards, hidden text, commands, or code that could work as a real attack. It draws only the text and images of the Scenario given by the App. Example and generated test data SHALL be random generic values, not text that works as an instruction to an AI system.
- **S-VIEW-2.** THE Core_View SHALL treat View_Settings, Themes, Scenarios, and Effect_Requests as untrusted data: it SHALL evaluate no part of them as code, SHALL draw every text as plain text and never as HTML, and SHALL return a failure instead of throwing (R-VIEW-02.7, R-VIEW-19.5, R-VIEW-20.7).
- **S-VIEW-3.** THE Core_View SHALL make no network request of its own. It SHALL load only the image sources returned by the Image_Resolver of the App, and SHALL never fetch an Image_Reference by itself (S-GRAPH-3). Fonts are bundled with the build and served from the Public_URL origin; THE Core_View SHALL load no remote font or font fallback (R-VIEW-03.9, R-FND-03.8).
- **S-VIEW-4.** Rules decide, AI only explains (intent.md ch. 0 rule 5): THE Core_View SHALL compute no judgement and SHALL use no AI (R-VIEW-20.4).
- **S-VIEW-5.** THE Core_View SHALL collect no personal information, SHALL require no login, and SHALL store nothing in the browser (no cookies, no local storage, no IndexedDB). Storage belongs to `apps/`.
- **S-VIEW-6.** THE Core_View SHALL generate no images and no voice, and SHALL create no voice clone or deepfake.
- **S-VIEW-7.** This spec makes no claim that needs a source. Claims with sources belong to the App specs and are checked by the `reviewer` agent.

## Open questions

### Open

None.

### Resolved

- Q1 Scope split: interaction (R-VIEW-12 to R-VIEW-16), fog drawing (R-VIEW-10), and Timeline playback timing (R-VIEW-18) stay in this spec. Decision: decided, no fourth spec.
- Q2 Spike results: the spike of intent.md 3.3 is deferred by human decision, and that decision is recorded in `docs/decision-log.md`. The four spike checks become checks in the build tasks: gizmo vs. camera controls in the task of R-VIEW-14 (with R-VIEW-08.9), snapping in the task of R-VIEW-13, Edge following in the task of R-VIEW-05.2, and 60 fps with 50 images in the task of R-VIEW-16.4. IF one of these checks fails, the fallback follows intent.md 3.3 and is recorded in `docs/decision-log.md`. The deferral decision is recorded in `docs/decision-log.md` at requirements approval. Decision: resolved on that basis.
- Q3 Reference_Machine: a desktop computer with the latest stable Microsoft Edge or Google Chrome. design.md names the exact machine and versions. Decision: resolved.
- Q4 Packages and JSX: React, `.tsx` files, and the `tsconfig.json` and ESLint changes are made by the tasks of this spec, each with a decision-log line (R-VIEW-01.1, R-VIEW-01.2). Decision: accepted.
- Q5 Core demo: Decision: recommendation accepted, written as R-VIEW-21. A generic demo page lives under `core/view/demo/` (its own Vite page, a generic Sample_Scenario with no App_Specific_Name, two or more switchable ViewPresets), is added to the Vite multi-page inputs, is linked from the top page, and amends R-FND-02.4, R-FND-02.5, R-FND-02.7, R-FND-03.1, R-FND-03.9, and R-FND-10.11 with one decision-log line (R-VIEW-21.8, R-VIEW-21.9).
- Q6 Front/back display: only the Front_Face is drawn (R-VIEW-04.9). The flip action stays out of this spec. Should items are handled later only if credits remain. Decision: accepted as written.
- Q7 Glow and other effects: only the Effect_Style `fog` is defined (R-VIEW-10.2). Glow stays out of this spec. Should items are handled later only if credits remain. Decision: accepted as written.
- Q8 Camera control per preset: orbit and zoom are allowed in every ViewPreset (R-VIEW-08.8), with no camera lock. Decision: default accepted.
- Q9 Drag across Zones: a dragged Node keeps its `zone` (R-VIEW-13.9). Decision: default accepted.
- Q10 Edge selection and removal: no Edge selection; clicking an Edge clears the Node Selection (R-VIEW-12.3). Decision: default accepted.
- Q11 Connect to the same Node: a second click on the first Node cancels the connection (R-VIEW-15.7), so clicks make no self-loop. Decision: default accepted.
- Q12 Zone_Footprint kinds: `rect` and `ring` in View_Settings (Glossary). Decision: default accepted.
- Q13 Japanese text: the Core_View always shows `en` (R-VIEW-03.8). Decision: default accepted.
- Q14 Detail level: one Detail_Distance for all Nodes and one level (R-VIEW-11). Decision: default accepted.
- Q15 Timeline playback and walkthrough together: the Timeline_Cursor is tied to Zone Waypoints when both are built from Zones (R-VIEW-18.10). Decision: default accepted.
- Q16 Transition time: the camera moves to a new ViewPreset within 1.0 second (R-VIEW-08.2). Decision: default accepted.
