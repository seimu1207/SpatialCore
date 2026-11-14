# Structure

Source of truth: `docs/intent.md` (chapter 11, plus the core/app boundary in 3.2). If this file and intent.md disagree, intent.md wins. Do not add top-level folders that are not listed here without asking.

Constraints: follow `00-scope.md` (intent.md ch. 0). They are not repeated here.

## Repository layout

```
/.kiro/
  steering/
    00-scope.md      Top constraints (phases and gates, stay submittable)
    product.md
    tech.md
    structure.md
    safety.md
    lessons.md       Learning loop
  specs/
    repo-foundation/ core/
    app-ghost-mansion/ app-moodwalk/ new-app-template/
  hooks/             Call the sensors
  agents/            architect / reviewer
  skills/            unit-approval / submission-pack
/core/               3D node engine (knows no app names)
  model/             Computation (no three.js dependency)
  view/              3D rendering and interaction
/apps/
  ghost-mansion/     App 1 (scenarios/ rules/ theme/)
  moodwalk/          App 2 (scenarios/ rules/ theme/)
  top-page.ts        Top page script (a file, not an app folder)
/scripts/sensors/    Sensor implementations
/.github/workflows/  GitHub Actions (deploy to GitHub Pages)
/docs/
  intent.md          Source of truth
  decision-log.md    Approvals, policy changes, rule promotions
  process.md         Phases and gates (for judges)
  judges-tldr.md     Summary for judges and a 60-second try-it guide
LICENSE
README.md            English
index.html           Top page to choose an app
package.json / tsconfig.json / vite.config.ts / ESLint config   One each at the root
```

- Tests sit next to the source (`*.test.ts`).
- `new-app-template` is a spec and a README section only. Do not create a folder for it under `/apps/`.

- `/.kiro` must stay at the repo root and must never be in `.gitignore` (hackathon rule).
- The two apps live in separate folders under `/apps/` (Skeleton Crew rule).

## Core / app boundary (rules)

- **`core/` must not know any app.** Never write app-specific names in `core/` (for example: ghost, robot, mansion, mood curve, Moodwalk, Ghost Mansion). This applies to code, types, comments, tests, and file names.
- `core/` must not import from `apps/`. Dependencies go one way: `apps/` → `core/`.
- Anything that can be expressed by swapping scenario JSON and rule definitions belongs in the app, not in `core/`.
- App-specific data analysis (for example, image pixel analysis for brightness and color temperature) lives in `apps/`. The core only receives numeric attributes (`Record<string, number>`) and judges from them.
- Edge types that stop or pass automatic propagation are defined in the app's rule definitions. `core/` names no specific edge type.
- Apps give the core only: scenario JSON, rule definitions, theme, and view settings.
- `core/` is one engine with two layers:
  - `core/model`: Node, Edge, Zone, RuleEngine, Timeline, Scenario I/O, undo/redo commands. No three.js dependency. Target of PBT.
  - `core/view`: 3D rendering, interaction, viewpoints, walkthrough, fog.
  - `core/model` must not import from `core/view`.
- A third app must be buildable by swapping JSON and rules only (shown by `new-app-template`, Should).

## Records

- When intent.md changes, add one line to `docs/decision-log.md`: `date | section | decision | reason`.
- Unit approvals are recorded in `docs/decision-log.md` as one line: date / Unit / what was checked / result.
