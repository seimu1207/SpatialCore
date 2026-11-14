# Product

Source of truth: `docs/intent.md` (chapters 2–7). If this file and intent.md disagree, intent.md wins. Do not add features or policies that are not in intent.md.

Constraints: follow `00-scope.md` (intent.md ch. 0). They are not repeated here.

## Concept

- Working title: **Haunted Graph Kit**.
- Core loop of the engine: **Place → Connect → Judge → Explain → Replay**.
- A general engine for placing, transforming, and connecting text and images as 3D nodes is the shared core. Two very different apps are built on it.
- Message for judges: the same mechanisms (placement, transform, connection, viewpoint, rules) mean **safety** in one app and **expression** in the other.

| | App 1 | App 2 |
|---|---|---|
| Name | **Ghost Mansion** (スマホ屋敷のおばけ退治) | **Moodwalk** |
| Users | Junior high and high school students | Creators who design how a mood changes in sequence |
| Nature | Play to learn (game with right answers) | Make to communicate (tool without right answers) |
| Main node type | Text and icons | Images |
| How the core is used | **To protect** (see weak spots from the ghost's view) | **To communicate** (see the experience from the visitor's view) |

## Shared core (intent.md ch. 3)

Modules: `Node` (type, position, rotation, scale, content, metadata, numeric attributes as `Record<string, number>`, front/back), `Edge` (direction, type, label; each edge type can pass or stop automatic propagation, set in the rule definitions), `Zone` (divides space, gives order or hierarchy; can have height differences and walls that occlude), level-of-detail on zoom, `ViewPreset` (camera position, visibility filter, path movement), `RuleEngine` (condition checks, path search, numeric aggregation; same input always gives same output), visual effects (fog is Must and shared by both apps; glow is Should), `Timeline` (ordered playback), `AIAdapter` (swap point for AI; must always have a no-AI implementation), Scenario I/O (save, load, schema validation; text stored as `{ en, ja }`), Theme (swappable Halloween look).

App-specific data analysis (for example, computing brightness from image pixels) lives in `apps/`. The core receives numeric attributes and only judges shifts and runs from them.

3D interaction scope (intent.md 3.3):
- Policy: keep the freedom of interaction; protect its quality (clear, undoable, light).
- Must: drag on the zone plane with snapping, gizmo rotation (3 axes) and scaling, connect by clicking two nodes in turn (edges follow automatically), undo/redo, switching view presets, walkthrough.
- Should: multi-select, align, keyboard operation.
- Out of scope: physics, free-form surfaces, VR.
- Rotation has no meaning in the rules of either app (visual only).
- A spike of at most 1 day on 11/13–14 checks: gizmo and camera controls do not conflict, snapping, edge following, 60 fps with 50 images. Operations that fail go to fallbacks and are recorded in `docs/decision-log.md`.

## App 1: Ghost Mansion (`apps/ghost-mansion/`)

Goals:
- Students learn how attackers think and where they aim, not only how to use systems and AI safely, and learn to respond when something goes wrong.
- Students learn by fixing a risky mansion (building from a blank board is a post-clear Could item).
- Technical terms are not taught first. They unlock in a "field guide" after the experience.

Basic loop "A Day of the Robot": Sample → Prepare → Ghost Night → Fix It → Look Back.

The first screen is a **risky preset mansion: maximum convenience, but too many keys given to the robot**. The student fixes it, like a refactoring puzzle. One full loop takes 60–90 seconds, so a judge can feel the value in 60 seconds.

| Step | What the student does | What they learn |
|---|---|---|
| Sample | Play the ghost against a "careless sample mansion" and watch the attack preconditions get met one by one | Conditions for an attack |
| Prepare | In their own (preset) mansion, change the keys given to the robot (plain key / bell key / cut the line). Use the ghost-view "weak-spot scanner" to see what is visible from outside. Zoom into letters and pages the robot will read | Their belongings and connections; what attackers can see |
| Ghost Night | Timeline playback as an intrusion simulation. The robot does fixed jobs in order. If it follows a hidden command **placed by the game**, damage spreads along plain keys and stops at bell keys | Permission size vs. damage; the effect of human checks |
| Fix It | Only if damage occurred. On the same 3D graph and Timeline: stop the robot, cut a key line, connect a consultation line to an adult or friend node | The order of actions when in trouble |
| Look Back | See in the replay where damage could have been stopped, check the 2-axis score, prepare again and retry | Balance of convenience and safety |

- Attacks come from the game, not from the student. The student plays the ghost only in the Sample step; afterwards the ghost view is a defense tool.
- The sample mansion is the preset mansion definition in a fixed state with all keys given (no separate mansion).
- Building from a blank board is a post-clear item (Could).
- No separate 2D response-card screen is built.
- Floors (Zone) are 4 concentric exposure levels: outside road (anyone) → garden (friends) → inside the house (family) → safe (only me). Floors differ in height and are divided by walls.
- Node size = importance (damage if taken). Zoom reveals hidden text in letters and clues in photo backgrounds. Edges = keys and paths for damage; the same password links rooms with a "chain". Overhead view shows the whole wiring. Ghost view (low viewpoint from the outside road): walls hide the inside, and only nodes in the public zone and lines reaching outside are visible. What is visible is decided by the view preset's filter (zone exposure); walls support it visually. Front/back: flipping a voice node shows it is fake.

AI helper robot:
- More keys → more convenience points (homework and photo sorting finish faster), but more damage if the robot is tricked.
- Keys given to the robot (an Edge type) have three choices:
  - Plain key: runs automatically; high convenience; damage spreads as is when the robot is tricked.
  - Bell key: a human confirms every time (human-in-the-loop); medium convenience; stops the spread of automatic attacks.
  - No line: no added convenience, and everything beyond is safe.
- Score: convenience (jobs finished) and damage shown as a point on 2 axes; stars are looked up from the point's position. The formula is decided in design.md.
- The robot in the game runs on rules. No real LLM.

Ghosts of Stage 2 "The AI Robot Arrives": Hidden-Command Ghost (prompt injection), Key-Thief Ghost (excessive permissions; the spreading damage that results from a hidden command), Eavesdrop Ghost (sensitive information leakage), Mimic Ghost (deepfake / voice clone, shown with text and icons only), Plausible Ghost (hallucination / misinformation; an answer node not linked to a source node gets fog). Terms in parentheses unlock in the field guide. Must ghosts: the Hidden-Command → Key-Thief chain (treated as one chained attack) and the Plausible Ghost (fog). Eavesdrop and Mimic are Should.

Attack cards:
- Attacks are shown only as abstract attack cards (id, name, attacker goal, motives, targets, preconditions, impact, counters). No code, commands, or usable text.
- Each precondition has a display `label` and a machine `check`. The rule engine decides success when the student's graph satisfies all `check`s. The `check` format is fixed in design.md.
- Showing which precondition to break is how students understand why a defense works.

Difficulty: Beginner (grade 7+): 3–4 rooms, 1 ghost (the chained attack), 3 response operations. Intermediate: more rooms, 2 ghosts (chained attack + Plausible Ghost). Advanced (high school): all ghosts, make-your-own-ghost mode (Could).

Stage 1 "First Smartphone" is designed but out of scope for this submission (Could).

## App 2: Moodwalk (`apps/moodwalk/`)

Concept: from a mood board you *look at* to a mood board you *walk through*. In games, film, exhibitions, and events, creators want to convey **how the mood changes as people move through in order**.

Users:
- Solo and small-team game developers designing stages or scenarios
- People shaping images before storyboarding film or manga
- People planning school-festival haunted houses, exhibitions, event spaces

Differentiation:
- AI color/keyword extraction and linking images with lines already exist in other tools. They are **not** differentiators.
- Differentiators: **order (depth)**, **experience (walkthrough)**, **change (mood curve)**, **explained direction (intent nodes)**.
- Competitor features must be re-checked before submission.

Features:
- Depth = route: depth in 3D space is the order of experience; zones from entrance to exit.
- Walkthrough playback: the camera moves along the route at visitor/player eye level.
- Mood curve: brightness and color temperature (and tension) per zone, plotted along the route.
- Shift check: the rule engine detects "sudden brightening" and "same mood for too long" and shows fog. Intentional shifts can be marked.
- Intent nodes: text nodes explaining why an image was chosen, linked to images.
- Source records: the back of an image node holds a source URL and notes. No AI image generation.

Mood reading:
- Brightness and color temperature are computed from image colors by rules (no AI). Formulas are decided in design.md. This computation (image loading and pixel analysis) lives in `apps/moodwalk/`. The core receives numeric attributes (`Record<string, number>`) and only judges shifts and long runs.
- Thresholds for shifts and long runs (size of difference, number of zones) are board settings.
- Tension is estimated by AI (Could) and can be corrected by hand.
- Images are loaded by file picker and drag-and-drop. URLs are only used as source records (to avoid CORS limits). Storage: IndexedDB and JSON export.

Expected value (hypothesis, not backed by user research): share a mood flow such as "quiet entrance, a moment of relief midway, scariest right before the exit" before building; notice stretches where scares go on so long that visitors get used to them. A short interview with someone experienced in school-festival planning before submission is desirable.

Demo sample: one board, "School festival haunted house plan". Opening the public URL shows this board, and one action starts the walkthrough (so a judge can feel the value in 60 seconds).

## How the two apps use the core

| Core feature | Ghost Mansion | Moodwalk |
|---|---|---|
| Placement (Zone) | Floor = exposure level (height differences and walls) | Depth = order of experience |
| Transform / zoom | Find hidden text and photo clues | Show the key image large |
| Front / back | Reveal a fake voice | See source and notes |
| Connection | Keys (plain / bell) and damage paths | Intent ↔ image links |
| Viewpoint | Overhead for the whole wiring; ghost view (low, walls occlude) for weak spots visible from outside | Visitor view to see the experience |
| Rules | Does the attack succeed | Is there a mood shift |
| Fog (shared Must) | Answer without a source | Section with a sudden shift |
| Numeric attributes | Convenience points, risk | Brightness, color temperature, tension |

## Scope

| | Core | Ghost Mansion | Moodwalk |
|---|---|---|---|
| **Must** | Node/Edge/Zone, scenario JSON, rule checks (conditions and path search), 3D interaction (above), undo/redo, view switching, zoom detail layers, fog (shared by both apps), Timeline ordered playback, PBT, English UI (English by default; text stored as `{ en, ja }`) | Stage 2 only (A Day of the Robot): risky preset mansion as a refactoring puzzle (one loop in 60–90 s), sample-mansion intro, key types (plain / bell / none), the Hidden-Command → Key-Thief chained attack, Plausible Ghost (fog), weak-spot scanner and intrusion-simulation replay, 3 response operations on the 3D graph, 2-axis score and stars | Zones (route), image placement, mood curve from colors, shift check, walkthrough playback |
| **Should** | Front/back, effects other than fog (glow etc.), new-app-template | Remaining 2 ghosts (Eavesdrop, Mimic), field guide, JA/EN switching UI | Intent nodes, source records, JSON export |
| **Could** | Swap point for real AI | Building from a blank board (after clearing), AI explanations by "Dr. Ghost", versus mode, Stage 1, make-your-own-ghost mode | AI tension estimate, share links |

Do not start Vibe polishing until all Must items are done.

Fallbacks (already decided):
- Ghost Mansion Must not done by 11/23 → narrow to the single "Hidden-Command + key spread" scenario (Plausible Ghost goes back to Should; fog stays a core Must because Moodwalk's shift check uses it). If still late, reduce robot jobs to 3 and let damage spread only 1 step.
- Moodwalk Must not done by 11/27 → mood curve uses brightness only; walkthrough moves in a straight line.
- 3D visual tuning takes more than half a day → freeze the look and move on (time-box Vibe work).

## Open questions

- おばけやステップの英語名は仮の訳です。このままでよいか、別の名前にするかを決めてください。
- 難易度の段階（初級・中級・上級）は Must に含みますか。それとも初級だけを Must にしますか。
- プリセット屋敷と見本屋敷の中身（部屋数、鍵の数、ロボの仕事、大人・友達ノードの置き場所）は design.md で決めますか。
- ⭐の対応表、2軸評価の式、`check` の書式は design.md で決めます。ここでは既定値を置いていません。
