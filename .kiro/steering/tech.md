# Tech

Source of truth: `docs/intent.md` (chapter 8, plus technical points from chapters 3, 5, 10). If this file and intent.md disagree, intent.md wins. Do not add tools or dependencies that are not listed here without asking.

Constraints: follow `00-scope.md` (intent.md ch. 0). They are not repeated here.

## Runtime model

- **No backend.** The product is a **static site**. No server, database, login, or server-side API.
- **No AI required.** Every feature in Must and Should works without AI. `AIAdapter` exists only as a swap point and must always ship a no-AI implementation. Real AI integration is Could.
- No API keys and no install for judges: open the URL in a desktop browser.
- The robot in Ghost Mansion runs on rules, never on a real LLM.
- Target environment: desktop browsers.

## Stack

- Language: TypeScript (`strict`).
- Build: Vite.
- 3D: React Three Fiber + drei (decided; drei provides gizmos, camera controls, and text in 3D).
- Tests: Vitest + fast-check (property-based testing). Test files sit next to the source (`*.test.ts`).
- Lint: ESLint (typescript-eslint).
- Scenario JSON schema validation: Zod.
- Package manager: npm. Node.js: LTS (the exact version is pinned in `repo-foundation`).
- Build: one Vite project at the repo root (multi-page); `package.json`, `tsconfig`, and Vite config live at the root.
- Hosting: GitHub Pages (static, no backend), deployed with GitHub Actions on every push to `main`.
- Site layout: one site with `/ghost-mansion/` and `/moodwalk/`, and a top page to choose an app.
- MCP: Context7 or similar to look up current Three.js-related docs.

## Technical rules

- `core/model` (Node, Edge, Zone, RuleEngine, Timeline, Scenario I/O) must not depend on three.js. It is the target of PBT and must be testable without rendering.
- `core/view` holds 3D rendering, interaction, viewpoints, and walkthrough.
- `RuleEngine` is deterministic: the same input always gives the same result.
- Edit operations are recorded as commands on `core/model`; the core provides undo/redo.
- Scenario JSON is validated against a schema on load.
- UI text and scenario JSON text are English by default and stored as `{ en, ja }`. A JA/EN switch UI is Should.
- Edge types declare whether automatic propagation passes or stops, in the app's rule definitions. The core stays generic.
- Moodwalk: this computation lives in `apps/moodwalk/`, not in `core/`. The core receives numeric attributes (`Record<string, number>`) and only judges shifts and long runs. Brightness and color temperature are computed from image pixels by rules. Images are loaded by file picker and drag-and-drop; URLs are stored only as source records (avoids CORS limits on reading pixels). Storage: IndexedDB and JSON export.
- No AI image generation in Moodwalk.

## Sensors and checks (intent.md 10.3)

| Sensor | Checks | When |
|---|---|---|
| required-sections | requirements.md and design.md contain required headings (PBT properties, safety, etc.) | On spec save |
| type-check | `tsc --noEmit` | On code save |
| linter | lint | On code save |
| schema | Scenario JSON schema validation | On JSON save |

- Tests and PBT run only on task completion, to save credits.
- Requirement coverage and claim sources are checked by the `reviewer` agent before gates, not by sensors.
- Do not accept changes that fail a sensor, including during Vibe work.

## PBT properties already decided (intent.md 10.6)

- Save → load leaves the content unchanged.
- Every edge points to existing nodes.
- Same input → same result.
- Removing edges never increases the set of reachable nodes.

## Open questions

- lint のルール（ESLint の設定内容）は `repo-foundation` で決めます。
- Node.js の具体的な版は `repo-foundation` で固定します。
- MCP は Context7 に決定ですか、それとも例として挙げただけですか。
- どの Kiro power を試しますか（intent.md 1章では1つ以上）。
- 日英切り替えUI（Should）の実装方式が決まっていません。文言は `{ en, ja }` の構造で持つことだけが決まっています。
