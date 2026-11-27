# Requirements Document

## Introduction

`app-moodwalk` is the spec of Unit 3, the second App: **Moodwalk**, in `apps/moodwalk/` (intent.md 5, ch. 7, ch. 9, 10.2, 10.6). The shared core (Unit 1: `core-graph`, `core-rules`, `core-view`) is complete. Moodwalk turns a mood board that people look at into a mood board that people walk through: images are placed in Zones that form a route from entrance to exit, the mood is read from the image colors by rules, the change of mood along the route is shown as a curve, a shift check marks sudden brightening and moods that stay the same for too long with fog, and a walkthrough moves the camera along the route at visitor eye level (intent.md 5.1, 5.4).

This spec covers **only the Moodwalk Must items of intent.md ch. 7**:
1. Zones that form a route, from entrance to exit, where depth is the order of experience.
2. Image placement.
3. A mood curve computed from image colors by rules (brightness and color temperature).
4. A shift check: sudden brightening and the same mood for too long, shown with fog, with thresholds as board settings.
5. Walkthrough playback: the camera moves along the route at visitor eye level.

The demo board "School festival haunted house plan" (intent.md 5.7) is included as R-APP2-13 because intent.md 10.6 makes it the completion criterion of this spec. intent.md ch. 7 does not list it as a Must row; the human confirmed it as a requirement (Q4, decided).

intent.md 10.6 lists intent nodes in `app-moodwalk`, but intent.md ch. 7 marks them Should. This spec follows ch. 7 and leaves intent nodes out (see "Out of scope").

Fallbacks of intent.md ch. 7 for Moodwalk:
- **Brightness only.** IF the fallback "mood curve uses brightness only" is applied, THEN the Moodwalk_App computes no Color_Temperature and no Color_Temperature series, and `same-mood-too-long` is judged on the Long_Runs of the Brightness_Attribute only: the Same_Mood_Runs are the Brightness Long_Runs. The following parts stop applying: the Color_Temperature parts of R-APP2-06.2, R-APP2-06.6, R-APP2-06.8, R-APP2-07.1, R-APP2-07.3 ("for each attribute" becomes the Brightness_Attribute only), R-APP2-07.7, and R-APP2-07.8; the Color_Temperature part of R-APP2-09.3 and of the Same_Mood_Runs definition; the Color_Temperature parts of P-APP2-1, P-APP2-5, and P-APP2-7; and P-APP2-3 as a whole. Every other requirement and property stays in force.
- **Straight-line walkthrough.** The fallback "walkthrough moves in a straight line" is not yet guaranteed by R-APP2-03.2: the Walkthrough passes the footprint centers at Eye_Height above each Zone `elevation` (`buildZoneWaypoints` in `core/view/helpers/camera-path.ts`), and R-APP2-03.2 and R-APP2-03.3 fix only the order along the `z` axis, not the `x` of the centers or the Zone `elevation`. IF this fallback is applied, THEN the Route_Layout SHALL also give every footprint center the same `x`, and every Route_Zone SHALL have the same `elevation`, so that all Waypoints lie on one straight line.

Rules for this spec:
- The App uses **only the public interfaces of `core/`** as built and specified in `core-graph`, `core-rules`, and `core-view`. The App gives the core only scenario JSON, rule definitions, a theme, and view settings (intent.md 3.2). Where a wish would need a change to `core/`, it is not a requirement here; it is listed under "Open questions" with the core change it would need, and the requirement that depends on it. No requirement in this spec depends on a change to `core/` (see Open questions, "Core changes needed").
- **No AI.** Brightness and color temperature are computed from image pixels by deterministic rules in `apps/moodwalk/`. No AI generates, edits, or analyzes images (intent.md ch. 0 rule 5, 5.5, ch. 9). Images load only through the file picker and drag-and-drop. A URL is never fetched to read pixels (intent.md 5.5; tech.md "Technical rules").
- **Rules decide.** The mood curve, the shifts, the long runs, and the fog are decided by the Rule_Engine of `core-rules` from numeric attributes (`Record<string, number>`). The core receives numbers only and judges shifts and long runs (intent.md 3.2, 5.5).
- Formulas and values are **decided in design.md**: the brightness formula, the color temperature formula and its range, the attribute names, the default thresholds, the Eye_Height, the walk duration, the image limits' enforcement details, and the layout of Route_Zones. This document states only what those values must satisfy.
- All Moodwalk words stay in `apps/moodwalk/`. `core/` gets no file, no name, and no change from this spec (structure.md, R-GRAPH-10, R-VIEW-01.6).
- The product is a static site with no backend, no login, and no API key. The UI is English by default. Text stored in scenario data is `{ en, ja }` (tech.md).

Out of scope for this spec: see the section "Out of scope".

## Glossary

Terms reused from `core-graph` (`.kiro/specs/core-graph/requirements.md`) keep their meaning there: **App**, **App_Specific_Name**, **Repository**, **Scenario**, **Scenario_Loader**, **Scenario_Saver**, **Scenario_Schema**, **Scenario_File**, **Schema_Sensor**, **Lint_Sensor**, **Node**, **Node_Type**, **Edge**, **Zone**, **Face**, **Front_Face**, **Image_Reference**, **Numeric_Attributes**, **Identifier**, **Localized_Text**, **Finite_Number**, **Positive_Number**, **Positive_Integer**, **Validation_Error**, **Field_Path**, **Edit_Command**, **Batch_Command**, **Command_Applier**, **History**, **History_Functions**. Terms reused from `core-rules` keep their meaning there: **Rule_Engine**, **Rule_Definition**, **Rule_Definition_Loader**, **Rule_Failure**, **Effect_Kind**, **Effect_Rule**, **Effect_Request**, **Series_Settings**, **Series_Result**, **Zone_Series**, **Zone_Value**, **Step_Change**, **Shift**, **Long_Run**, **Intentional_Mark**, **Timeline**, **Timeline_Step**, **Timeline_Cursor**, **AI_Adapter**. Terms reused from `core-view` keep their meaning there: **Core_View**, **View_Settings**, **ViewPreset**, **Camera_Pose**, **Active_Preset**, **Visibility_Filter**, **Zone_Footprint**, **Camera_Path**, **Waypoint**, **Selection**, **Effect_Style**, **Walkthrough**, **Walk_State**, **Walk_Duration**, **Path_Progress**, **Linked_Timeline**, **Link_Conditions**, **Theme**, **Edit_Mode**, **Edit_Callback**, **Walk_Callback**, **Timeline_Callback**, **Image_Resolver**, **Reference_Machine**. Terms reused from `repo-foundation` keep their meaning there: **Public_URL**, **Top_Page**.

- **Moodwalk_App**: the program in `apps/moodwalk/` defined by this spec.
- **Board**: the data of one mood board: one Scenario, one set of Board_Settings, and the set of Intentional_Marks.
- **Board_Settings**: plain data owned by the Moodwalk_App that holds the Shift_Threshold, the Run_Tolerance, and the Min_Run_Length (each defined below). It is checked by a schema in `apps/moodwalk/`.
- **Shift_Threshold**: a Finite_Number greater than or equal to 0: the size of a Step_Change of Brightness that counts as sudden brightening (the `shiftThreshold` of a Series_Settings).
- **Run_Tolerance**: a Finite_Number greater than or equal to 0: the largest Step_Change that still counts as "the same mood" (the `runTolerance` of a Series_Settings).
- **Min_Run_Length**: an integer greater than or equal to 2: the number of Route_Zones in a row that makes a Long_Run (the `minRunLength` of a Series_Settings).
- **Route_Zone**: a Zone of the Board's Scenario that is part of the route. Every Zone of a Board is a Route_Zone.
- **Entrance**: the Route_Zone with the smallest `order`. **Exit**: the Route_Zone with the largest `order`.
- **Route_Layout**: the pure function in `apps/moodwalk/` that takes the Zones of a Scenario and returns the Zone_Footprints and the Camera_Path of the View_Settings, so that depth along the route axis follows the Zone `order`.
- **Image_Node**: a Node whose Node_Type is the one Moodwalk image type (named in design.md), whose Front_Face holds an `image` (Image_Reference), whose `zone` is a Route_Zone, and whose Numeric_Attributes hold the Mood_Values.
- **Image_File**: a file chosen with the file picker or dropped on the page, which holds one raster image.
- **Image_Store**: the in-memory map in the Moodwalk_App from an Image_Reference to the image data of one Image_File, or to a bundled Sample_Image. The Image_Resolver given to the Core_View reads it.
- **Sample_Image**: an image bundled in `apps/moodwalk/` for the Demo_Board.
- **Pixel_Data**: the width, the height, and the list of red, green, blue, and alpha values (each an integer from 0 to 255) of an image, in a fixed order.
- **Mood_Analyzer**: the pure function in `apps/moodwalk/` that takes Pixel_Data and returns either two Mood_Values or an Analysis_Failure.
- **Analysis_Size**: the fixed largest width and height in pixels, fixed in design.md, to which the Moodwalk_App scales an image down before the Mood_Analyzer reads it.
- **Analysis_Pixel_Data**: the Pixel_Data of an image after it is scaled down to fit the Analysis_Size (R-APP2-16).
- **Valued_Route_Zones**: the Route_Zones that have a Zone_Value for a given attribute, in ascending Zone `order`. Step_Changes and Long_Runs are computed over this list only, so a Route_Zone with no data is skipped (as the series function of `core-rules` does).
- **Judgement_Results**: the input of the `buildEffects` function of `core-rules`, checked by `judgementResultsSchema` in `core/model/rule-schema.ts` (optional `nodeRules`, `series`, and `propagation` lists).
- **Run_Intersection**: for one Long_Run of the Brightness_Attribute and one Long_Run of the Color_Temperature_Attribute, the Zone Identifiers that lie in both, in ascending Zone `order`. Every Image_Node holds both attributes (R-APP2-06.8), so both attributes have the same Valued_Route_Zones; each Long_Run is a consecutive part of that list, so every Run_Intersection is also a consecutive part of it (possibly empty).
- **Same_Mood_Runs**: the Run_Intersections, over every pair of one Brightness Long_Run and one Color_Temperature Long_Run, that hold at least Min_Run_Length Route_Zones. Run_Intersections with fewer Route_Zones are dropped.
- **Mood_Values**: the pair of Brightness and Color_Temperature computed by the Mood_Analyzer for one image.
- **Brightness**: a Finite_Number from 0 to 1 inclusive; 0 is a fully dark image and 1 is a fully bright image.
- **Color_Temperature**: a Finite_Number within the closed Color_Temperature_Range; larger values mean warmer colors and smaller values mean cooler colors.
- **Color_Temperature_Range**: the closed range of Finite_Numbers, fixed in design.md, that the Mood_Analyzer can return for Color_Temperature.
- **Brightness_Attribute**: the attribute name (fixed in design.md) under which an Image_Node holds its Brightness.
- **Color_Temperature_Attribute**: the attribute name (fixed in design.md) under which an Image_Node holds its Color_Temperature.
- **Same_Mood_Attribute**: the attribute name (fixed in design.md) of the Series_Result that the Moodwalk_App builds itself to carry the Same_Mood_Runs to `buildEffects` (R-APP2-09.4). No Image_Node holds an attribute of this name.
- **Analysis_Failure**: the result of the Mood_Analyzer for Pixel_Data that has no usable pixel: zero pixels, or only pixels whose alpha is 0.
- **Mood_Curve**: the data for the curve display: for each of the two attributes, the Zone_Series (Zone_Values by `mean`) of the Board in ascending Zone `order`, plus the list of Route_Zones that have no Zone_Value for that attribute.
- **Curve_Panel**: the 2D part of the Moodwalk_App page that draws the Mood_Curve along the route, next to the 3D scene.
- **Shift_Check**: the judgement that applies the Rule_Engine series functions to the Board and returns the Series_Results of the two attributes, the Mood_Flags, and the Mood_Effects.
- **Mood_Flag**: a Route_Zone that the Shift_Check marks as `sudden-brightening` or as `same-mood-too-long`. A Route_Zone can hold both marks.
- **Mood_Effects**: the Effect_Requests that the Shift_Check builds, one per Mood_Flag, for the Core_View to draw as fog.
- **Mood_Effect_Kinds**: the two Effect_Kinds, fixed in design.md, that the Moodwalk_App uses for the fog of a sudden-brightening Mood_Flag and the fog of a same-mood-too-long Mood_Flag. The Theme gives each a `fog` Effect_Style.
- **Intentional_Shift_Marks**: the list of Zone Identifiers that the person marked as an intended shift. The Board holds it, and the Shift_Check gives it to the Rule_Engine as Intentional_Marks.
- **Eye_Height**: a Positive_Number, fixed in design.md, in the unit of `position.y`: the height of the camera above the `elevation` of a Route_Zone during a Walkthrough (the camera height of a `fromZones` Camera_Path).
- **Demo_Board**: the bundled Board "School festival haunted house plan" (R-APP2-13).
- **Overview_Preset**: the ViewPreset that shows the whole route from above. **Visitor_Preset**: the ViewPreset that shows the route from visitor eye level, with the camera just before the Entrance: outside the Entrance footprint, on the route axis, looking along the route (R-APP2-11.3).
- **Image_Adding**: the state of the Moodwalk_App from the moment the person chooses or drops one or more Image_Files until the Moodwalk_App has added or rejected every Image_File of that choice or drop (R-APP2-04.2, R-APP2-04.4, R-APP2-15.5).
- **Route_Controls**: the buttons and fields of the Moodwalk_App page: the file picker, the zone controls, the threshold fields, the intentional mark controls, the preset buttons, and the walkthrough buttons.
- **Image_Limits**: the limits of R-APP2-04: accepted formats, the largest accepted size of one Image_File, and the largest number of Image_Nodes on a Board.

## Requirements

### Requirement 1: Moodwalk page, start, and static delivery (R-APP2-01)

**User Story:** As a judge opening the public URL, I want the Moodwalk page to show a ready board without any setup, so that I can feel the value within 60 seconds.

#### Acceptance Criteria

1. WHEN a person opens the Moodwalk page at the Public_URL, THE Moodwalk_App SHALL load the Demo_Board, start the Core_View on it with the Overview_Preset as the Active_Preset, and draw the Curve_Panel for it, without a login, a file choice, or any other person action.
2. THE Moodwalk_App SHALL run as a static site: it SHALL need no backend, no API key, and no installation, and SHALL make no network request to any origin other than the origin of the Public_URL.
3. WHEN the Moodwalk page loads, THE Moodwalk_App SHALL validate the Demo_Board Scenario with the Scenario_Loader, the Rule_Definition with the Rule_Definition_Loader, and the Board_Settings with its own schema before it starts the Core_View.
4. IF the Scenario_Loader, the Rule_Definition_Loader, or the Board_Settings schema reports one or more Validation_Errors for a bundled file, THEN THE Moodwalk_App SHALL start no Core_View and SHALL show exactly one English message that says the board data is invalid, followed by the Field_Path and message of each Validation_Error.
5. THE Moodwalk_App SHALL hold every text that it shows to a person as a Localized_Text, and SHALL show the `en` value (tech.md).
6. THE Moodwalk_App SHALL show a link back to the Top_Page.
7. WHEN the person reloads the page, THE Moodwalk_App SHALL show the Demo_Board as in criterion 1. The Board is kept in memory for the session only; persistent storage is out of scope (Q1, decided).

### Requirement 2: Board data and scenario validity (R-APP2-02)

**User Story:** As the developer, I want a Board to be one valid Scenario plus plain settings, so that the core can load, judge, and replay it without Moodwalk code.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL represent the route, the images, and their numeric attributes only with the Scenario data model of `core-graph`: Zones for the route, Image_Nodes for the images, and Numeric_Attributes for the Mood_Values.
2. THE Moodwalk_App SHALL express the order of the route only by the `order` of the Zones, and SHALL create no Edge for the route.
3. THE Moodwalk_App SHALL store the Demo_Board Scenario as a Scenario_File under `apps/moodwalk/scenarios/` that passes the Schema_Sensor, with every Zone `label` and every Face `text` stored as `{ en, ja }`.
4. THE Moodwalk_App SHALL change a Scenario only through Edit_Commands passed to the History_Functions or to the `execute` function of the Core_View (R-VIEW-23).
5. FOR ALL Boards that the Moodwalk_App can produce, THE Scenario_Saver SHALL return JSON text that the Scenario_Loader loads back into a Scenario deeply equal to the saved one (round-trip, P-GRAPH-1; this spec checks it for Moodwalk boards in P-APP2-9).
6. FOR ALL Boards that the Moodwalk_App can produce, every `zone` of every Image_Node SHALL equal the `id` of a Zone of the same Scenario, and every `id` of Zones and Nodes SHALL be unique within its list (P-GRAPH-3).
7. THE Moodwalk_App SHALL hold the Board_Settings and the Intentional_Shift_Marks outside the Scenario, and WHEN only the Board_Settings or the Intentional_Shift_Marks change, THE Scenario_Saver output SHALL stay identical.

### Requirement 3: Route zones, entrance to exit (R-APP2-03)

**User Story:** As a creator, I want Zones laid out in order from entrance to exit, so that depth in the 3D space means the order in which a visitor experiences the board.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL keep at least 2 Route_Zones on every Board it shows or builds, with pairwise different Zone `order` values.
2. THE Route_Layout SHALL give every Route_Zone exactly one rectangular Zone_Footprint, and SHALL place the footprints so that the center along the route axis (the `z` axis, fixed in design.md) is strictly monotone in the Zone `order`: the Entrance has the smallest value on that axis and the Exit has the largest.
3. THE Route_Layout SHALL place the footprints so that no two footprints overlap, and SHALL give every footprint the same width across the route axis, the same size for every Route_Zone along the route axis, and a Positive_Number size (the values are fixed in design.md).
4. THE Route_Layout SHALL return deeply equal View_Settings parts for two calls with deeply equal Zones, whatever the order of the Zones in the Scenario's `zones` list.
5. THE Route_Layout SHALL build one Camera_Path with the value `fromZones` and the camera height Eye_Height, so that the Walkthrough passes the Route_Zones from the Entrance to the Exit in ascending `order` (R-VIEW-09.4).
6. WHEN the person adds a Route_Zone with the Route_Controls, THE Moodwalk_App SHALL add one Zone with the next larger `order`, with a unique `id` and a Localized_Text `label`, through one `addZone` Edit_Command, and SHALL show it as the new Exit.
7. WHEN the person removes a Route_Zone that holds no Image_Node and the Board keeps at least 2 Route_Zones, THE Moodwalk_App SHALL remove that Zone through one `removeZone` Edit_Command.
8. IF the person removes a Route_Zone that holds one or more Image_Nodes, or whose removal would leave fewer than 2 Route_Zones, THEN THE Moodwalk_App SHALL leave the Board unchanged and SHALL show one English message that names the reason.
9. WHEN the set of Route_Zones changes (including by undo or redo), THE Moodwalk_App SHALL rebuild the View_Settings with the Route_Layout and SHALL restart the Core_View with the resulting History, so that every Route_Zone has a Zone_Footprint. The restart is the confirmed behaviour because the Core_View has no function to replace View_Settings (Q3, decided; core change C1 not taken).
10. THE Moodwalk_App SHALL show the `en` value of each Route_Zone `label` in the 3D scene (R-VIEW-06.2) and in the Curve_Panel, and SHALL label the Entrance and the Exit.

### Requirement 4: Loading images with the file picker and drag-and-drop (R-APP2-04)

**User Story:** As a creator, I want to add my own images by choosing files or dropping them on the page, so that I can build a board without a server or an account.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL offer a file picker that accepts one or more Image_Files, and SHALL accept Image_Files dropped on the page, as the only two ways to load an image.
2. WHEN the person chooses or drops an Image_File that meets the Image_Limits, THE Moodwalk_App SHALL decode it in the browser, read its Analysis_Pixel_Data (R-APP2-16), run the Mood_Analyzer on it, and WHEN the Mood_Analyzer returns Mood_Values, SHALL add one Image_Node to the Board with one `addNode` Edit_Command that already holds the Mood_Values in its Numeric_Attributes.
3. THE Moodwalk_App SHALL accept the formats PNG, JPEG, and WebP, SHALL accept an Image_File of at most 10 MB (10,485,760 bytes), and SHALL accept a Board of at most 50 Image_Nodes. These are the Image_Limits (Q6, decided).
4. IF an Image_File has a format that is not accepted, is larger than the Image_Limits allow, cannot be decoded by the browser, or gets an Analysis_Failure from the Mood_Analyzer, THEN THE Moodwalk_App SHALL add no Image_Node, SHALL leave the Board unchanged, and SHALL show one English message that names the file and the reason, and SHALL keep processing the other Image_Files of the same choice or drop.
5. IF adding an Image_File would make the number of Image_Nodes on the Board larger than 50, THEN THE Moodwalk_App SHALL add no Image_Node for that file and SHALL show one English message that names the limit.
6. THE Moodwalk_App SHALL give each new Image_Node a Front_Face `image` Image_Reference that is a key of the Image_Store, and SHALL keep the image data of the Image_File in the Image_Store for the session.
7. THE Moodwalk_App SHALL place each new Image_Node in the Route_Zone that the person selected in the Route_Controls (the Entrance WHEN none is selected), at a position inside the footprint of that Zone, at a position that does not equal the position of another Image_Node of the same Zone.
8. THE Moodwalk_App SHALL read pixels only from the bytes of an Image_File that the person chose or dropped, and SHALL never request a URL to read pixels.
9. THE Moodwalk_App SHALL keep the bytes of every Image_File inside the browser and SHALL send them to no server.
10. WHEN the person gives a URL as a source (for example by dropping a link), THE Moodwalk_App SHALL load no image from it. Storing a source URL is Should and out of scope.
11. THE Image_Resolver that the Moodwalk_App gives to the Core_View SHALL return, for an Image_Reference, an image source that the browser can draw from the Image_Store or from the bundled Sample_Images of the same origin, and "no image" for any other Image_Reference.

### Requirement 5: Image placement and editing (R-APP2-05)

**User Story:** As a creator, I want to move, turn, and scale images in their Zone, remove them, and undo any change, so that I can arrange the board freely and safely.

#### Acceptance Criteria

1. WHILE the Walk_State is not `playing` and not `paused` and the Moodwalk_App is not in Image_Adding, THE Moodwalk_App SHALL set the Edit_Mode of the Core_View to `edit`, so that the person can drag an Image_Node on its Zone plane with snapping, rotate and scale it with the gizmo, and undo and redo every gesture (intent.md 3.3, R-VIEW-13 to R-VIEW-16) (D2, decided).
2. WHEN the person removes the selected Image_Node with the Route_Controls, THE Moodwalk_App SHALL remove it through one `removeNode` Edit_Command. The Image_Store entry of that Image_Node is kept while any Scenario in the History refers to it (R-APP2-15.6).
3. WHEN the end of a drag puts the center of an Image_Node inside the footprint of a Route_Zone other than its `zone`, THE Moodwalk_App SHALL change the `zone` of that Image_Node to that Route_Zone with one `updateNode` Edit_Command. The core leaves `zone` unchanged on a drag (R-VIEW-13.9), so one drag into another Zone takes two undo steps: the first undo restores the `zone`, the second restores the `position` (Q2, decided; core change C2 not taken).
4. IF the end of a drag puts the center of an Image_Node outside every footprint, THEN THE Moodwalk_App SHALL undo that drag and SHALL show one English message that says the image must stay inside a zone.
5. THE Moodwalk_App SHALL give `position`, `rotation`, and `scale` of an Image_Node no meaning in the Shift_Check and the Mood_Curve: WHEN only the `position` inside the same Zone, the `rotation`, or the `scale` of an Image_Node changes, THE Mood_Curve, the Mood_Flags, and the Mood_Effects SHALL stay deeply equal (rotation is visual only, intent.md 3.3).
6. WHEN the person undoes or redoes, THE Moodwalk_App SHALL draw the History's `present` Scenario in the Core_View, and SHALL recompute the Mood_Curve, the Mood_Flags, and the Mood_Effects from that Scenario.
7. WHEN the person adds an image and undoes that one step, THE Moodwalk_App SHALL return the Scenario deeply equal to the Scenario before the addition (P-APP2-10).
8. WHILE the Moodwalk_App is in Image_Adding, THE Moodwalk_App SHALL set the Edit_Mode of the Core_View to `view`, and WHEN Image_Adding ends, THE Moodwalk_App SHALL set the Edit_Mode as criterion 1 requires (D2, decided).

### Requirement 6: Mood analysis from image colors (R-APP2-06)

**User Story:** As a creator, I want brightness and color temperature to be read from the colors of each image by fixed rules, so that the mood curve is the same every time and needs no AI.

#### Acceptance Criteria

1. THE Mood_Analyzer SHALL be a pure function in `apps/moodwalk/` that takes Pixel_Data and returns either Mood_Values or an Analysis_Failure, and that imports no browser API, no `core/view` module, and no package that draws or decodes images.
2. WHEN the Mood_Analyzer receives Pixel_Data with at least one pixel whose alpha is greater than 0, THE Mood_Analyzer SHALL return a Brightness from 0 to 1 inclusive and a Color_Temperature inside the Color_Temperature_Range, both Finite_Numbers.
3. IF the Mood_Analyzer receives Pixel_Data with zero pixels, or whose pixels all have alpha 0, THEN THE Mood_Analyzer SHALL return an Analysis_Failure and no Mood_Values.
4. WHEN the Mood_Analyzer is called twice with deeply equal Pixel_Data, THE Mood_Analyzer SHALL return deeply equal results, and SHALL leave its input unchanged.
5. WHEN every red, green, and blue value of every pixel of one Pixel_Data is raised or kept, and no pixel's alpha changes, THE Mood_Analyzer SHALL return a Brightness that is not lower than before (brightness is monotone in the color channels).
6. WHEN the red and blue values of every pixel are swapped, and every pixel has a red value not less than its blue value, THE Mood_Analyzer SHALL return a Color_Temperature for the original Pixel_Data that is not lower than the one for the swapped Pixel_Data (red-heavy colors are not cooler than blue-heavy colors).
7. THE Mood_Analyzer SHALL take Analysis_Pixel_Data of any width and height from 0 to the Analysis_Size (R-APP2-16), SHALL return an Analysis_Failure for Pixel_Data with a width or height of 0 (zero pixels, R-APP2-06.3), and SHALL give results that depend only on the Pixel_Data and not on the time, the random numbers, or the number of earlier calls.
8. THE Moodwalk_App SHALL store the Brightness under the Brightness_Attribute and the Color_Temperature under the Color_Temperature_Attribute in the Numeric_Attributes of the Image_Node in the `addNode` Edit_Command that creates the Image_Node (R-APP2-04.2), and SHALL send no other Edit_Command that changes these two attributes.
9. THE Moodwalk_App SHALL use no AI model, no remote service, and no random number to compute Brightness or Color_Temperature (intent.md 5.5, safety.md).
10. THE Moodwalk_App SHALL be the only place that reads image pixels and computes Mood_Values, and `core/` SHALL receive them only as Numeric_Attributes (intent.md 3.2).

### Requirement 7: Mood curve along the route (R-APP2-07)

**User Story:** As a creator, I want to see how brightness and color temperature change from the entrance to the exit, so that I can judge the flow of the mood and not only single images.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL compute the Mood_Curve with the Rule_Engine series function of `core-rules` for the Brightness_Attribute and for the Color_Temperature_Attribute, with `zoneValue` set to `mean`, so that each Zone_Value is the mean of that attribute over the Image_Nodes of the Route_Zone that hold it.
2. THE Mood_Curve SHALL hold the Zone_Values in ascending Zone `order`, and SHALL list the Route_Zones that have no Image_Node holding the attribute as "no data" Route_Zones. Step_Changes and Long_Runs SHALL be computed over the Valued_Route_Zones of the attribute only, in ascending Zone `order`; a "no data" Route_Zone is skipped, so the Step_Change goes from the previous Valued_Route_Zone to the next one.
3. THE Curve_Panel SHALL draw, for each attribute, one point per Route_Zone that has a Zone_Value, at a horizontal place that follows the Zone `order` from the Entrance to the Exit, joined by lines, and SHALL draw each "no data" Route_Zone as an empty place on the same horizontal axis.
4. THE Curve_Panel SHALL show the `en` value of each Route_Zone `label` at its place on the horizontal axis and SHALL show the numeric value of each point when the person points at it.
5. WHEN the Scenario changes (an Edit_Command, undo, redo, or a restart of the Core_View), THE Moodwalk_App SHALL recompute the Mood_Curve and redraw the Curve_Panel from the new `present` Scenario within the next rendered frame.
6. THE Mood_Curve SHALL depend only on the Scenario's Zones (`id`, `order`) and on the `zone` and the Numeric_Attributes of its Nodes (R-RULES-03.7), so that the Mood_Curve stays deeply equal when only `position`, `rotation`, `scale`, Faces, or Metadata of Nodes change.
7. FOR ALL Boards, every Zone_Value of the Brightness_Attribute SHALL lie from 0 to 1 within an absolute tolerance of 1e-9, and every Zone_Value of the Color_Temperature_Attribute SHALL lie inside the Color_Temperature_Range within the same tolerance.
8. WHEN two calls compute the Mood_Curve of deeply equal Scenarios, THE Moodwalk_App SHALL return deeply equal Mood_Curves, and WHEN the `nodes` list of a Scenario is put in another order, THE Moodwalk_App SHALL return Zone_Values that differ by at most 1e-9 × (1 + the absolute value) from the Zone_Values before the reordering.
9. IF the Rule_Engine returns a Rule_Failure when it computes the Mood_Curve, THEN THE Moodwalk_App SHALL keep the Board, SHALL draw no Mood_Curve, and SHALL show one English message that holds the Field_Path and message of each Validation_Error.

### Requirement 8: Board settings for the shift check (R-APP2-08)

**User Story:** As a creator, I want to set how big a change counts as sudden and how many zones of the same mood are too many, so that the check fits my board.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL hold the Shift_Threshold, the Run_Tolerance, and the Min_Run_Length as Board_Settings of the Board (intent.md 5.5), and SHALL use them as the `shiftThreshold`, `runTolerance`, and `minRunLength` of the Series_Settings that it passes to the Rule_Engine. Whether each value is shared by both attributes or kept per attribute is decided in design.md.
2. THE Moodwalk_App SHALL contain default values for the Board_Settings, fixed in design.md, and WHEN the Demo_Board or a new Board loads, THE Moodwalk_App SHALL use those defaults unless the Board holds its own Board_Settings.
3. THE Moodwalk_App SHALL offer a field for each Board_Setting in the Route_Controls.
4. WHEN the person enters a Shift_Threshold or a Run_Tolerance that is a Finite_Number greater than or equal to 0, or a Min_Run_Length that is an integer greater than or equal to 2, THE Moodwalk_App SHALL apply it, and SHALL recompute the Shift_Check within the next rendered frame.
5. IF the person enters a value that is not valid under criterion 4 (for example a negative number, text, an empty field, `NaN`, or a Min_Run_Length of 1 or 2.5), THEN THE Moodwalk_App SHALL keep the previous Board_Settings and SHALL show one English message at that field that names the allowed values.
6. THE Moodwalk_App SHALL validate the Board_Settings with one schema in `apps/moodwalk/` that returns every Validation_Error with a Field_Path and an English message, and SHALL return a result for every input value without throwing an exception.
7. WHEN two calls receive deeply equal Board_Settings, THE schema SHALL return deeply equal results.

### Requirement 9: Shift check and fog (R-APP2-09)

**User Story:** As a creator, I want the board to warn me with fog where the mood brightens suddenly or stays the same for too long, so that I can fix the flow before building it.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL decide every Mood_Flag from the Series_Results of the series functions of the Rule_Engine of `core-rules` (R-RULES-10, R-RULES-11) and the Series_Settings built from the Board_Settings, with no AI and no code that reads the Zone_Values by another rule (intent.md ch. 0 rule 5). Combining the Zone Identifiers of the Series_Results with set operations and the Zone `order` to form the Run_Intersections and the Same_Mood_Runs (R-APP2-09.3) reads no Zone_Value and is allowed by this criterion.
2. WHEN a Step_Change of the Brightness_Attribute Zone_Series, computed over the Valued_Route_Zones in ascending Zone `order` (R-APP2-07.2), is greater than the Shift_Threshold (direction `up`), THE Shift_Check SHALL mark the later Route_Zone of that Step_Change as `sudden-brightening`, unless the Zone is in the Intentional_Shift_Marks (R-APP2-10).
3. WHEN a Route_Zone lies in a Same_Mood_Run, THE Shift_Check SHALL mark that Route_Zone as `same-mood-too-long`. The Same_Mood_Runs are computed pair by pair: for each Brightness Long_Run and each Color_Temperature Long_Run, their Run_Intersection counts only if it holds at least Min_Run_Length Route_Zones. A Route_Zone that lies in a Long_Run of both attributes but only in Run_Intersections shorter than Min_Run_Length gets no `same-mood-too-long` Mood_Flag, and a Route_Zone that lies in a Long_Run of only one of the two attributes gets none either (Q5, decided). Example 1: a Brightness Long_Run [A, B, C] and a Color_Temperature Long_Run [C, D, E] give the Run_Intersection [C]; with a Min_Run_Length of 2 or more, no Route_Zone is flagged. Example 2: Route_Zones X, A, B, C, D, Y in ascending `order`, a Brightness Long_Run [A, B, C, D], and Color_Temperature Long_Runs [X, A, B] and [C, D, Y] give the Run_Intersections [A, B] and [C, D]; with a Min_Run_Length of 3, no Route_Zone is flagged, although A, B, C, and D each lie in a Long_Run of both attributes.
4. THE Moodwalk_App SHALL build the Mood_Effects with the `buildEffects` function of `core-rules` and the Effect_Rules of a Rule_Definition in `apps/moodwalk/rules/`: one Effect_Request with a Zone target for each Mood_Flag, with the Effect_Kind of the Mood_Effect_Kinds that names that kind of flag, and no other Effect_Request. For `same-mood-too-long`, THE Moodwalk_App SHALL build the Judgement_Results itself: one Series_Result under one attribute name (the Same_Mood_Attribute, fixed in design.md) whose `longRuns` holds the Same_Mood_Runs, which `judgementResultsSchema` of `core/model/rule-schema.ts` accepts. The Same_Mood_Attribute SHALL differ from the Brightness_Attribute and from the Color_Temperature_Attribute. In that Series_Result, `shifts` and `changes` SHALL be empty lists, and `series` and `unresolved` SHALL hold only what `seriesResultSchema` requires (empty lists). The Effect_Rule with the `longRuns` source for `same-mood-too-long` SHALL refer only to the Same_Mood_Attribute, and the Rule_Definition SHALL hold no `longRuns` Effect_Rule for the Brightness_Attribute or the Color_Temperature_Attribute. For `sudden-brightening`, THE Moodwalk_App SHALL pass the Series_Result of the Brightness_Attribute with its `shifts`, and the Effect_Rule with the `shifts` source SHALL refer only to the Brightness_Attribute.
5. WHEN the Mood_Effects change, THE Moodwalk_App SHALL give them to the Core_View with the `setEffects` function, and THE Core_View SHALL draw them as fog with the Effect_Style of the Theme (R-VIEW-10).
6. WHEN the Board has no Mood_Flag, THE Moodwalk_App SHALL give the Core_View an empty list of Effect_Requests, and SHALL show a short English message in the Curve_Panel that says no shift or long run was found.
7. THE Curve_Panel SHALL mark each Mood_Flag on the Route_Zone it names with the kind of the flag, and SHALL show an English message for each flag that says which setting made it appear (for example the Shift_Threshold or the Min_Run_Length).
8. THE Shift_Check SHALL return deeply equal Mood_Flags and Mood_Effects for deeply equal Scenarios, Board_Settings, and Intentional_Shift_Marks, and SHALL leave its arguments unchanged.
9. WHEN the Shift_Threshold is raised and everything else is equal, THE Shift_Check SHALL mark no Route_Zone as `sudden-brightening` that it did not mark before.
10. WHEN the Min_Run_Length is raised and everything else is equal, THE Shift_Check SHALL mark no Route_Zone as `same-mood-too-long` that it did not mark before.
11. WHEN the Run_Tolerance is lowered and everything else is equal, THE Shift_Check SHALL mark no Route_Zone as `same-mood-too-long` that it did not mark before.
12. IF the Rule_Engine returns a Rule_Failure when it computes the Shift_Check, THEN THE Moodwalk_App SHALL give the Core_View an empty list of Effect_Requests, SHALL keep the Board, and SHALL show one English message that holds the Field_Path and message of each Validation_Error.
13. THE Moodwalk_App SHALL let the Walkthrough show the fog, and WHILE the Walk_State is `playing`, THE Moodwalk_App SHALL keep the Mood_Effects as they are.

### Requirement 10: Intentional shifts (R-APP2-10)

**User Story:** As a creator, I want to mark a sudden change as intended, so that the check does not warn me about changes I chose on purpose.

#### Acceptance Criteria

1. WHEN a Route_Zone has a `sudden-brightening` Mood_Flag, THE Moodwalk_App SHALL show a control in the Route_Controls to mark the arrival at that Route_Zone as intentional.
2. WHEN the person marks a Route_Zone as intentional, THE Moodwalk_App SHALL add its Zone Identifier to the Intentional_Shift_Marks and SHALL recompute the Shift_Check within the next rendered frame, and THE Shift_Check SHALL give the list to the Rule_Engine as Intentional_Marks.
3. WHEN a Route_Zone is in the Intentional_Shift_Marks, THE Moodwalk_App SHALL show a control in the Route_Controls to remove the mark, whether or not the Route_Zone would have a `sudden-brightening` Mood_Flag without the mark, and WHEN the person activates that control, THE Moodwalk_App SHALL remove the Zone Identifier from the Intentional_Shift_Marks and SHALL recompute the Shift_Check.
4. WHEN a Route_Zone is in the Intentional_Shift_Marks, THE Shift_Check SHALL leave that Route_Zone out of the Mood_Flags of kind `sudden-brightening`, and SHALL change no Mood_Flag of kind `same-mood-too-long` and no Zone_Value. The Shift_Check SHALL read whether a Step_Change is marked from the `intentional` field of the `shifts` of the Brightness Series_Result, independent of any earlier Mood_Flag.
5. WHEN a Route_Zone is removed from the Board, THE Moodwalk_App SHALL remove its Zone Identifier from the Intentional_Shift_Marks.
6. FOR ALL Boards, adding a Zone Identifier to the Intentional_Shift_Marks SHALL add no Mood_Flag and no Effect_Request (P-APP2-7).

### Requirement 11: Viewpoints (R-APP2-11)

**User Story:** As a creator, I want to switch between a view of the whole route from above and a visitor's view, so that I can edit the layout and then check how it feels.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL give the Core_View exactly two ViewPresets, the Overview_Preset and the Visitor_Preset, with Camera_Poses and Visibility_Filters fixed in design.md, and each with a Localized_Text `label`.
2. THE Overview_Preset SHALL show every Route_Zone, every Image_Node, and the fog of every Mood_Effect, with a Camera_Pose from above that has the whole route inside the view.
3. THE Visitor_Preset SHALL place the camera just before the Entrance: outside the Entrance footprint, on the route axis, at the Eye_Height above the `elevation` of the Entrance, looking along the route toward the Exit, and SHALL show every Route_Zone and every Image_Node. The distance between the camera and the Entrance footprint is fixed in design.md (D1, decided).
4. WHEN the person selects a viewpoint button, THE Moodwalk_App SHALL set that ViewPreset as the Active_Preset with the `setPreset` function of the Core_View.
5. WHEN the set of Route_Zones changes and the Core_View restarts (R-APP2-03.9), THE Moodwalk_App SHALL start it with the ViewPreset that was active before the restart.

### Requirement 12: Walkthrough playback at visitor eye level (R-APP2-12)

**User Story:** As a creator, I want to press one button and see the camera walk the route at a visitor's eye level, so that I feel how the mood changes in the order a visitor meets it.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL offer one "Start walkthrough" control that starts a Walkthrough with one person action (intent.md 5.7).
2. WHEN the person activates "Start walkthrough" and the Board has at least 2 Route_Zones that each have a Zone_Footprint, THE Moodwalk_App SHALL call the `startWalk` function of the Core_View with the `id` of the Camera_Path of the Route_Layout, a Walk_Duration that is a Positive_Number fixed in design.md as a function of the number of Route_Zones, and a Linked_Timeline built by the Moodwalk_App that meets the Link_Conditions (R-VIEW-17.11).
3. THE Moodwalk_App SHALL build the Linked_Timeline with one Timeline_Step per Route_Zone, in ascending Zone `order`, where the `targets` of Step `i` hold exactly the Zone of the `i`-th Route_Zone.
4. WHILE the Walk_State is `playing`, THE Core_View SHALL keep the camera at the Eye_Height above the `elevation` of the Route_Zones along the route, and THE Moodwalk_App SHALL not change the Eye_Height.
5. WHILE the Walk_State is `playing`, THE Curve_Panel SHALL show a marker at the Route_Zone of the current Timeline_Cursor `position` and SHALL move it from the Entrance to the Exit as the Timeline_Callback reports new positions.
6. WHEN the Walk_State becomes `finished`, THE Curve_Panel SHALL keep the marker at the Exit until the person starts the Walkthrough again, stops it, or selects a viewpoint.
7. THE Moodwalk_App SHALL offer pause, resume, and stop controls whose effects are those of R-VIEW-17.6, and SHALL enable each control only in the Walk_States in which it has an effect.
8. WHILE the Walk_State is `playing` or `paused`, THE Moodwalk_App SHALL disable the controls that change the Scenario (file picker, drop, zone controls, remove image, undo, redo) and SHALL show that the Board cannot be edited during a Walkthrough.
9. IF the Board has fewer than 2 Route_Zones, or a Route_Zone has no Zone_Footprint, THEN THE Moodwalk_App SHALL disable "Start walkthrough" and SHALL show one English message that names the reason.
10. IF the Core_View passes a Validation_Error for the Walkthrough start to the Edit_Callback, THEN THE Moodwalk_App SHALL show one English message that holds the Field_Path and message, and SHALL leave the Board unchanged.
11. WHEN the Walkthrough starts, THE Moodwalk_App SHALL leave the Active_Preset unchanged, and WHEN the Walkthrough is stopped, THE Core_View SHALL set the camera to the Camera_Pose of the Active_Preset (R-VIEW-17.6).
12. WHEN two calls build the Camera_Path and the Linked_Timeline for deeply equal Scenarios, THE Moodwalk_App SHALL return deeply equal values, and FOR ALL Boards with at least 2 Route_Zones the Linked_Timeline SHALL meet every Link_Condition (P-APP2-11).

### Requirement 13: Demo board "School festival haunted house plan" (R-APP2-13)

**User Story:** As a judge, I want the public page to show a finished sample board that I can walk through with one action, so that I can feel the value in 60 seconds.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL bundle one Board, the Demo_Board, whose Scenario `title` is the Localized_Text `{ en: "School festival haunted house plan", ja }`.
2. THE Demo_Board SHALL hold at least 5 Route_Zones from the Entrance to the Exit, each with a Localized_Text `label`, and at least 8 Image_Nodes, with at least one Image_Node in every Route_Zone.
3. THE Demo_Board SHALL follow the mood flow "a quiet entrance, a moment of relief midway, the scariest right before the exit" (intent.md 5.6): the Brightness of the Zone_Series SHALL rise at one midway Route_Zone, and the last Route_Zone before the Exit SHALL have the lowest Brightness of the board. This flow is an example for the demo, not a research claim (S-APP2-7).
4. WHEN the Moodwalk_App computes the Shift_Check on the Demo_Board with the default Board_Settings, THE Shift_Check SHALL mark at least one Route_Zone as `sudden-brightening` and at least one Route_Zone as `same-mood-too-long`, so that the fog is visible in the first view.
5. THE Demo_Board SHALL store, for each Image_Node, Mood_Values that equal the output of the Mood_Analyzer for the Analysis_Pixel_Data of its Sample_Image (R-APP2-16.4), within an absolute tolerance of 1e-9, and an example test SHALL check this under Vitest in Node with no browser decoding and no new dependency. The test SHALL obtain the Analysis_Pixel_Data either from pixel data fixed in the test or the repository, or from Sample_Images that are made within the Analysis_Size from such pixel data; the exact method is decided in design.md (Q11).
6. THE Moodwalk_App SHALL bundle the Sample_Images in `apps/moodwalk/` and SHALL serve them from the origin of the Public_URL, and every Sample_Image SHALL be fictional or made by the developer, and SHALL not be generated by AI (S-APP2-5).
7. WHEN the person opens the Public_URL, THE Moodwalk_App SHALL show the Demo_Board and the "Start walkthrough" control (R-APP2-12.1) in the first screen, so that one action starts the Walkthrough.
8. THE Demo_Board Scenario and Sample_Images SHALL together be small enough that the Moodwalk page shows the Demo_Board within 5 seconds on the Reference_Machine over a typical broadband connection, and the exact budget in bytes is fixed in design.md.

### Requirement 14: Boundary, determinism, and sensors (R-APP2-14)

**User Story:** As the developer, I want all Moodwalk logic kept in the app and every result repeatable, so that the core stays generic and the PBT can run without rendering.

#### Acceptance Criteria

1. THE Moodwalk_App SHALL import from `core/` only symbols that non-test source files of `core/model/` and `core/view/` export, and SHALL import nothing from `core/view/demo/`.
2. THE Moodwalk_App SHALL keep the Mood_Analyzer, the Route_Layout, the Shift_Check, the Board_Settings schema, and the Linked_Timeline builder in files that import no three.js, React, React Three Fiber, or drei package, so that they run under Vitest in a Node environment.
3. THE Repository SHALL contain no App_Specific_Name of Moodwalk in any file under `core/` (structure.md, R-VIEW-01.6), and this spec SHALL change no file under `core/`.
4. THE Moodwalk_App SHALL make every judgement (Mood_Values, Mood_Curve, Mood_Flags, Mood_Effects, Route_Layout, Linked_Timeline) a pure function of its arguments, so that deeply equal arguments give deeply equal results (intent.md ch. 0 rule 5).
5. THE Moodwalk_App SHALL store its Rule_Definition, its Theme, and its Scenario_Files under `apps/moodwalk/rules/`, `apps/moodwalk/theme/`, and `apps/moodwalk/scenarios/`, and each SHALL pass its loader or the Schema_Sensor in an example test.
6. THE Moodwalk_App SHALL pass the type-check and the Lint_Sensor with no error (tech.md "Sensors and checks"), and no change of this spec SHALL be accepted when a sensor fails.
7. THE Moodwalk_App SHALL contain no key, token, or personal data in any file.

### Requirement 15: Errors, limits, and speed (R-APP2-15)

**User Story:** As a creator, I want clear English messages and a board that stays fast, so that mistakes do not break my work.

#### Acceptance Criteria

1. IF any function of the Moodwalk_App throws an exception while it handles a person action, THEN THE Moodwalk_App SHALL leave the Board as it was before the action and SHALL show one English message that says the action failed.
2. THE Moodwalk_App SHALL show each error message in one place next to the Route_Controls, and SHALL show the message of the latest error only.
3. WHILE the Board holds 50 Image_Nodes, THE Moodwalk_App SHALL finish the computation of the Mood_Curve, the Shift_Check, and the Mood_Effects after one Edit_Command within 100 ms on the Reference_Machine. Because the Mood_Analyzer reads only Analysis_Pixel_Data (R-APP2-16), the analysis time of one Image_File does not grow with the pixel count of the original image. A human checks this at the verification gate.
4. WHILE the Board holds 50 Image_Nodes, THE Core_View SHALL keep drawing at 60 frames per second or more on the Reference_Machine, as R-VIEW-16 requires. A human checks this at the verification gate.
5. WHEN a person loads several Image_Files in one action, THE Moodwalk_App SHALL add the accepted ones in the order the browser lists them, one `addNode` Edit_Command each, and SHALL give no half-added Image_Node for a file that fails. WHILE these Image_Files are being added, the Moodwalk_App is in Image_Adding and the Edit_Mode is `view` (R-APP2-05.8).
6. WHEN no Scenario in the History (`past`, `present`, or `future`) holds an Image_Node whose Front_Face `image` is the Image_Reference of an Image_Store entry, THE Moodwalk_App SHALL remove that entry and release its browser resources (such as an object URL), and WHILE any Scenario in the History holds such an Image_Node, THE Moodwalk_App SHALL keep the entry.

### Requirement 16: Fixed analysis size (R-APP2-16)

**User Story:** As a creator, I want large photos to be analyzed as fast as small ones, so that adding an image does not freeze the board.

#### Acceptance Criteria

1. WHEN the Moodwalk_App reads the pixels of a decoded Image_File for the Mood_Analyzer, THE Moodwalk_App SHALL first scale the image down so that its width and its height are each at most the Analysis_Size, keeping the aspect ratio, and SHALL pass the resulting Analysis_Pixel_Data to the Mood_Analyzer.
2. WHEN a decoded image already fits inside the Analysis_Size, THE Moodwalk_App SHALL pass its pixels without enlarging the image.
3. THE Moodwalk_App SHALL use the same Analysis_Size and the same scaling method for every Image_File and every Sample_Image, so that the number of pixels the Mood_Analyzer reads is at most Analysis_Size × Analysis_Size, whatever the pixel count of the original image. THE Mood_Analyzer SHALL take already-decoded Analysis_Pixel_Data as its only input, and the decoding and scaling of an image SHALL live in a separate browser-only part of the Moodwalk_App, so that the Mood_Analyzer runs under Vitest in a Node environment with no browser decoding.
4. THE Moodwalk_App SHALL compute the Mood_Values stored in the Demo_Board (R-APP2-13.5) from the Analysis_Pixel_Data of each Sample_Image. The Analysis_Pixel_Data of each Sample_Image SHALL be fixed as data in the test or the repository, or each Sample_Image SHALL be made within the Analysis_Size from such pixel data in a lossless format such as PNG (so that R-APP2-16.2 applies and no scaling changes it), so that the example test of R-APP2-13.5 reads the same Analysis_Pixel_Data in Node without decoding the image and without a new dependency. The exact method is decided in design.md (Q11).

## PBT properties

These properties come from intent.md 10.6 and from the properties already decided in tech.md. The core properties are covered by `core-graph` (P-GRAPH-1, P-GRAPH-3, P-GRAPH-4) and `core-rules` (P-RULES-1 to P-RULES-3). This spec adds App-level properties over the Mood_Analyzer, the Route_Layout, the Mood_Curve, the Shift_Check, and the Linked_Timeline builder, all testable without rendering. Each property runs at least 100 generated cases with fast-check, and each test name contains its property ID (as in R-FND-10.5).

Generators produce: Pixel_Data of random width and height from 1 to min(64, Analysis_Size) per side, random channel values, and random alpha values with at least one non-zero alpha; for the Analysis_Failure part of P-APP2-1, also Pixel_Data with a width or height of 0 (zero pixels) and Pixel_Data whose alpha values are all 0, each side from 0 to min(64, Analysis_Size); Boards with 2 to 12 Route_Zones with random distinct `order` values, 0 to 50 Image_Nodes with random `zone`, `position`, `rotation`, `scale`, and Mood_Values inside their ranges; random Board_Settings inside the allowed ranges; random Intentional_Shift_Marks. Board generators SHALL also produce Route_Zones with no Image_Node, so that "no data" Route_Zones appear between Valued_Route_Zones; the properties compute Step_Changes and Long_Runs over the Valued_Route_Zones only, in ascending `order`, skipping "no data" Route_Zones (R-APP2-07.2).

The intent.md 10.6 property "removing edges never increases the set of reachable nodes" does not apply to this App, because the Moodwalk_App creates no Edge (R-APP2-02.2). It stays covered for the core by P-RULES-2 of `core-rules`.

- **P-APP2-1 (analyzer is total, in range, and deterministic).** FOR ALL Pixel_Data with at least one pixel of alpha greater than 0, the Mood_Analyzer SHALL return Mood_Values with Brightness in [0, 1] and Color_Temperature inside the Color_Temperature_Range, both finite; two calls on deep copies SHALL return deeply equal results; FOR ALL Pixel_Data without such a pixel it SHALL return an Analysis_Failure. (R-APP2-06.2 to R-APP2-06.4)
- **P-APP2-2 (brightness is monotone).** FOR ALL Pixel_Data and every way of raising or keeping the red, green, and blue values of pixels with the alpha values unchanged, the Brightness SHALL not decrease. (R-APP2-06.5)
- **P-APP2-3 (red is not cooler than blue).** FOR ALL Pixel_Data in which every pixel has red not less than blue, the Color_Temperature of the Pixel_Data SHALL be not lower than the Color_Temperature of the same Pixel_Data with red and blue swapped. (R-APP2-06.6)
- **P-APP2-4 (curve, flags, and effects are deterministic).** FOR ALL Boards, computing the Mood_Curve, the Mood_Flags, and the Mood_Effects twice on deep copies SHALL give deeply equal results and SHALL leave every argument unchanged. (R-APP2-07.8, R-APP2-09.8, R-APP2-14.4; builds on P-RULES-1)
- **P-APP2-5 (transforms and node order do not change the curve).** FOR ALL Boards, changing `position` inside a Zone, `rotation`, or `scale` of any Image_Node SHALL leave the Mood_Curve, the Mood_Flags, and the Mood_Effects deeply equal; putting the `nodes` list in another order SHALL change no Zone_Value by more than 1e-9 × (1 + the absolute value); and every Zone_Value SHALL lie inside its attribute range within 1e-9. (R-APP2-05.5, R-APP2-07.6 to R-APP2-07.8)
- **P-APP2-6 (thresholds are monotone).** FOR ALL Boards, raising the Shift_Threshold SHALL never add a `sudden-brightening` Route_Zone; raising the Min_Run_Length or lowering the Run_Tolerance SHALL never add a `same-mood-too-long` Route_Zone. This holds for the pairwise Same_Mood_Runs: a larger Min_Run_Length drops Long_Runs and Run_Intersections and changes no remaining one, and a smaller Run_Tolerance only splits each Long_Run into parts inside it, so each new Run_Intersection lies inside an earlier Run_Intersection that is at least as long. (R-APP2-09.9 to R-APP2-09.11)
- **P-APP2-7 (marks only remove warnings, and every effect has a flag).** FOR ALL Boards and Intentional_Shift_Marks, adding a Zone Identifier SHALL add no Mood_Flag and no Effect_Request and SHALL change no `same-mood-too-long` Mood_Flag; every Effect_Request of the Mood_Effects SHALL target a Route_Zone with exactly one matching Mood_Flag; and every `sudden-brightening` Route_Zone SHALL be the later Zone of a Step_Change greater than the Shift_Threshold, and the `same-mood-too-long` Route_Zones SHALL be exactly the union of the Same_Mood_Runs, checked against a reference that intersects every Brightness Long_Run with every Color_Temperature Long_Run and keeps the Run_Intersections of at least Min_Run_Length Route_Zones; every kept Run_Intersection SHALL be a consecutive part of the Valued_Route_Zones in ascending `order`; and a Route_Zone that lies in Long_Runs of both attributes only through Run_Intersections shorter than Min_Run_Length SHALL get no flag (R-APP2-09.3, Example 2 as a fixed example test). (R-APP2-09.2 to R-APP2-09.4, R-APP2-10.4, R-APP2-10.6)
- **P-APP2-8 (depth is order).** FOR ALL sets of Zones, in any list order, the Route_Layout SHALL return footprints whose center along the route axis is strictly increasing with the Zone `order`, with no two footprints overlapping; and calling `buildZoneWaypoints(scenario, footprints, height)` (`core/view/helpers/camera-path.ts`, which imports no three.js) with the Scenario, the Route_Layout footprints, and the Eye_Height as `height` SHALL return `ok: true` with one Waypoint per Zone, in ascending `order`, where every Waypoint has a `target` that differs from its `position` (R-VIEW-09.5), the `position.x` and `position.z` of every Waypoint equal the `x` and `z` (the center) of the Zone_Footprint of its Zone, and the `position.y` of every Waypoint equals the `elevation` of its Zone plus the Eye_Height. (R-APP2-03.2 to R-APP2-03.5)
- **P-APP2-9 (save then load leaves the board unchanged).** FOR ALL Boards, the Scenario_Saver then the Scenario_Loader SHALL return a Scenario deeply equal to the saved one, every `zone` of every Image_Node SHALL name a Zone of the Scenario, and the Scenario SHALL hold no Edge; the Demo_Board SHALL pass the same round trip. (R-APP2-02.5, R-APP2-02.6; builds on P-GRAPH-1 and P-GRAPH-3)
- **P-APP2-10 (adding an image is one undoable step).** FOR ALL Boards with fewer than 50 Image_Nodes and every accepted Image_Node, the add command through the History_Functions followed by undo SHALL return a `present` Scenario deeply equal to the one before. (R-APP2-04.2, R-APP2-05.7)
- **P-APP2-11 (walkthrough link holds).** FOR ALL Boards with at least 2 Route_Zones, the Linked_Timeline built by the Moodwalk_App SHALL meet every Link_Condition: it passes the Timeline schema, it has as many Timeline_Steps as Waypoints, and Step `i` targets exactly the `i`-th Zone in ascending `order`. (R-APP2-12.2, R-APP2-12.3, R-APP2-12.12)
- **P-APP2-12 (settings schema is total).** FOR ALL values of any shape, the Board_Settings schema SHALL return either valid Board_Settings or a non-empty list of Validation_Errors, without throwing, and two calls on deeply equal values SHALL return deeply equal results. (R-APP2-08.6, R-APP2-08.7)

Example tests cover: the bundled Demo_Board (R-APP2-13.2 to R-APP2-13.5, including at least one `sudden-brightening` and one `same-mood-too-long` flag with the default Board_Settings); the Image_Limits (R-APP2-04.3 to R-APP2-04.5, with a recording stub of the decoder); the removal of a Route_Zone that holds an Image_Node (R-APP2-03.8); the disabled "Start walkthrough" with fewer than 2 Route_Zones (R-APP2-12.9); the `Analysis_Failure` message path (R-APP2-04.4); and the order of Core_View calls on a zone change (R-APP2-03.9, tested with a recording stub of the Core_View handle). The 3D behaviour, the walkthrough feel, the 60-second path on the Public_URL, and the speed (R-APP2-01, R-APP2-12, R-APP2-13.7, R-APP2-15.3, R-APP2-15.4) are checked by a human on the Public_URL at the verification gate.

## Safety

Follows `safety.md` (intent.md ch. 9). The `reviewer` agent checks every rule here before plan approval and before the verification gate.

- **S-APP2-1 (no AI).** THE Moodwalk_App SHALL use no AI to read, generate, edit, or classify images. Brightness and Color_Temperature are computed by the deterministic Mood_Analyzer only. The AI_Adapter swap point is not called in this spec (R-APP2-06.9).
- **S-APP2-2 (no AI image generation).** THE Moodwalk_App SHALL offer no function that generates an image (safety.md "Moodwalk"), and SHALL bundle no AI-generated image.
- **S-APP2-3 (images stay on the device).** THE Moodwalk_App SHALL read pixels only from Image_Files that the person chose or dropped, SHALL fetch no URL for pixels, and SHALL send no image data to any server (R-APP2-04.8, R-APP2-04.9).
- **S-APP2-4 (no personal data, no login).** THE Moodwalk_App SHALL collect no personal information, SHALL require no login, SHALL ask for no name or account, and SHALL read no metadata of an Image_File (such as location or camera data) beyond the Pixel_Data. WHERE persistent storage is later added (Should, out of scope here), it SHALL stay in the browser of the person.
- **S-APP2-5 (fictional material).** Every Sample_Image and every text of the Demo_Board SHALL be fictional or made by the developer (safety.md "Users and data"). The Demo_Board SHALL name no real person, place, or brand.
- **S-APP2-6 (static site).** THE Moodwalk_App SHALL run as a static site with no backend and SHALL make no network request to another origin (R-APP2-01.2).
- **S-APP2-7 (claims and sources).** This spec makes no competitor comparison and no expected-value claim. IF a claim of either kind is added to the UI or the README later, THEN THE claim SHALL name its source (safety.md "Claims").
- **S-APP2-8 (OWASP).** Moodwalk maps no feature to OWASP items. IF any document of this App later does, it SHALL name the version and source as in intent.md 4.9.

## Out of scope

Items outside the Moodwalk Must of intent.md ch. 7, with the intent.md place that lists them:

- Intent nodes: text Nodes that explain why an image was chosen, linked to images (Should, ch. 7; intent.md 5.4).
- Source records: the back of an image Node with a source URL and notes (Should, ch. 7; the front/back display is also a core Should item).
- JSON export of a Board as a file (Should, ch. 7; intent.md 5.5). The Scenario_Saver is used in tests only.
- AI estimate of tension, and a hand-corrected tension value (Could, ch. 7; intent.md 5.5). No tension attribute is built.
- Share links (Could, ch. 7).
- Glow and other effects than fog (core Should).
- A JA/EN switch UI (Should, ch. 7). Texts stay stored as `{ en, ja }`, and the UI shows `en` (R-APP2-01.5).
- `new-app-template` (Should): a spec and README section, not part of this spec.
- Reading pixels from a URL, loading images from a server, and any image generation by AI (never in scope; see S-APP2-1 to S-APP2-3).
- Real-time collaboration, accounts, comments, and cloud storage (not in intent.md).
- Physics, free-form surfaces, and VR (core out of scope, intent.md 3.3).
- Multi-select, align, and keyboard operation (core Should).
- Persistent storage of a Board in IndexedDB, with save, restore, and a reset-to-demo control (Should; intent.md 5.5; Q1, decided). The Board stays in memory for the session, and the Demo_Board is shown on every load (R-APP2-01.7).

## Open questions

### Core changes needed

**None required.** Every requirement of this document uses only existing public interfaces: `startCoreView` and its handle (`setHistory`, `setPreset`, `setEffects`, `execute`, `startWalk`, `stopWalk`, `undo`, `redo`, `stop`), `loadViewSettings`, `loadTheme`, the Scenario I/O, the History_Functions and Edit_Commands, `checkSeriesList`/`checkSeries`, `buildEffects` with `judgementResultsSchema` (`core/model/rule-schema.ts`; the App passes its own Series_Result with `longRuns` for `same-mood-too-long`, R-APP2-09.4), `timelineFromZones`, and `buildZoneWaypoints` (`core/view/helpers/camera-path.ts`, used in P-APP2-8). Two optional core changes were considered and **not taken** (human approval, 2026-11-25). They are kept here as a record:

- **C1. A function that replaces the View_Settings of a running Core_View.** Why: R-APP2-03.9 restarts the Core_View when a Route_Zone is added or removed, because Zone_Footprints are part of the View_Settings given at start. A restart resets the camera and the Selection. Which requirement depends on it: R-APP2-03.9 and R-APP2-11.5 (they work without it by restarting).
- **C2. A drag that also updates the `zone` of the dragged Node when it ends inside another footprint, as one Edit_Command.** Why: R-APP2-05.3 needs a second `updateNode` Edit_Command after the drag, so one drag into another Zone takes two undo steps. Which requirement depends on it: R-APP2-05.3 (works without it, with two undo steps; Q2, decided).

### Decided

- **Q1 Persistent storage and JSON export:** IndexedDB storage and JSON export are Should and out of scope for this spec; the Board stays in memory and the Demo_Board is shown on every load (R-APP2-01.7). Human approval, 2026-11-25.
- **Q2 Undo steps for a drag into another Zone:** option (a), a drag into another Zone takes two undo steps (R-APP2-05.3); core change C2 is not taken. Human approval, 2026-11-25.
- **Q3 Adding and removing Route_Zones:** option (a), the person adds and removes Route_Zones, and the Core_View restarts with new View_Settings (R-APP2-03.6 to R-APP2-03.9); core change C1 is not taken. Human approval, 2026-11-25.
- **Q4 Demo_Board as a requirement:** R-APP2-13 stays a requirement, following intent.md 5.7 and 10.6. Human approval, 2026-11-25.
- **Q5 What "the same mood" means:** a Route_Zone is flagged `same-mood-too-long` only when it lies in a Same_Mood_Run: the Run_Intersection of one Brightness Long_Run with one Color_Temperature Long_Run, taken pair by pair, that holds at least Min_Run_Length Route_Zones (R-APP2-09.3). Each Run_Intersection is a consecutive part of the Valued_Route_Zones because both Long_Runs are. The App builds these runs itself from Zone Identifiers and passes them to `buildEffects` as `longRuns` (R-APP2-09.4). Human approval, 2026-11-25.
- **Fallback (intent.md ch. 7):** IF the brightness-only fallback is applied, THEN `same-mood-too-long` is judged on the Brightness Long_Runs only.
- **Q6 Image_Limits:** PNG, JPEG, and WebP; at most 10 MB (10,485,760 bytes) per Image_File; at most 50 Image_Nodes per Board (R-APP2-04.3). Human approval, 2026-11-25.
- **Q8 Intentional marks:** R-APP2-10 stays in the Must scope of this spec. Human approval, 2026-11-25.
- **D1 Visitor_Preset camera place:** the Visitor_Preset camera is at the Eye_Height just before the Entrance, outside the Entrance footprint, on the route axis, looking along the route; it is not on the Entrance footprint (R-APP2-11.3, Glossary "Visitor_Preset"). The exact distance is decided in design.md. Human approval at the design gate, 2026-11-25.
- **D2 Edit_Mode while images are added:** the Edit_Mode is `edit` only WHILE the Walk_State is not `playing` and not `paused` and no Image_File is being added; during Image_Adding the Edit_Mode is `view` (R-APP2-05.1, R-APP2-05.8, R-APP2-15.5, Glossary "Image_Adding"). Human approval at the design gate, 2026-11-25.

### Left to design.md

- **Q7 Color temperature definition.** intent.md 5.5 says "color temperature" without a unit. This document asks only for a bounded Finite_Number where larger is warmer. design.md must decide the formula, the Color_Temperature_Range, how alpha affects the result, and whether Kelvin is used.
- **Q9 Image facing and the route axis.** A Node panel faces the positive `z` direction at rotation (0, 0, 0) (R-VIEW-04.1), and the Walkthrough moves along the Zone centers. design.md must choose the route axis and the panel placement so that a visitor sees the images while walking, and decide whether images turn toward the route with `rotation` (visual only).
- **Q10 Analysis_Size.** R-APP2-16 asks the App to scale every image down to a fixed Analysis_Size before the Mood_Analyzer reads it. design.md must fix the Analysis_Size (largest width and height in pixels) and the scaling method.
- **Q11 Sample-image check in Node.** Tests run under Vitest in Node, with no browser decoding and no new dependency (R-APP2-13.5, R-APP2-16.3, R-APP2-16.4). design.md must decide how the example test gets the Analysis_Pixel_Data of each Sample_Image: pixel data fixed in the test or the repository, or Sample_Images made within the Analysis_Size from such pixel data in a lossless format, and how the test confirms that the bundled file and the fixed pixel data match.

### 決定が必要な日本語の項目（steering より、Moodwalk に関わるもの）

- **日英切り替えUIの実装方式**（tech.md の未決）：文言は `{ en, ja }` の構造で持つことだけが決まっています。切り替えUIは Should で、この spec の対象外です。Must では `en` を表示します（R-APP2-01.5）。
- **おばけやステップの英語名**（product.md の未決）：Moodwalk には関係しません。Moodwalk の画面上の英語名（Entrance、Exit、Overview、Visitor、sudden brightening、same mood too long）は仮の名前です。このままでよいか、design.md で決めてください。
- **難易度の段階**（product.md の未決）：Moodwalk には関係しません。
- **lint の設定と Node.js の版**（tech.md の未決）：`repo-foundation` で決定済みのため、この spec では扱いません。
- **MCP と Kiro power**（tech.md の未決）：この spec の対象外です。Three.js 系の資料を参照するときは、`submission-pack` で記録します。
