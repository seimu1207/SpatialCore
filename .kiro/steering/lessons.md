---
inclusion: manual
---

# Lessons

Learning loop (intent.md 10.2 ④, ch. 12). Add 1–2 lines a day. When an item repeats, promote it to a steering rule or a sensor, then log the promotion in `docs/decision-log.md`.

Format: `date | type | what happened | fix`
Types: `pbt` (bug found by PBT), `spec` (fixed through a spec), `vibe` (fixed during Vibe work), `prompt` (how an instruction to Kiro was corrected), `behavior` (behavior to make Kiro follow)

## Entries
2026-11-15 | pbt | core-rules 11.4: `seekStep` stopped after a bad cursor and skipped the `position` check (16.9 violation). A P-RULES-12 id-removal test helper also dropped shifts by `from`, though only `to` is a target | Fixed `timeline.ts` to keep checking `position`. Fixed the helper to match on `to` only
2026-11-15 | spec | core-rules: Zod accepts a Condition that contains itself, and `npx eslint` fails on this machine | Run a pre-check (depth 32, size 10,000) before Zod. Run lint with `npm run lint` (jiti), not `npx eslint`
2026-11-16 | behavior | core-view: tasks run in parallel showed transient lint errors from other tasks' unfinished files. The first Scene_Controller also missed R-VIEW-15.7 (an empty click must cancel a pending connection) and it was fixed after the check | Re-run lint after a wave ends before judging a failure. Check every requirement clause, not only the main path
2026-11-16 | spec | core-view: a press on a gizmo handle also started a panel drag | Added a gizmoHot flag in ViewStore so a gizmo press blocks the panel drag
2026-11-23 | spec | app-ghost-mansion: relative imports without the `.ts` extension failed in the app model files | Write every relative import with the `.ts` extension
2026-11-23 | behavior | app-ghost-mansion: `npm run lint` over files that parallel tasks were still writing showed errors that were not real | Judge lint only after the wave ends; re-run it before treating a failure as real
2026-11-23 | pbt | app-ghost-mansion: `structuredClone` of values from `fc.record` failed the equality check because `fc.record` can build objects with a null prototype | Compare through a JSON round trip, or build the generator so it makes plain objects
2026-11-23 | vibe | app-ghost-mansion: a corrupted non-UTF-8 byte in `ui.ts` broke the Vite build while the earlier checks looked fine | Remove the byte and rewrite the line as UTF-8; run `npm run build` after any large file write
2026-11-23 | spec | app-ghost-mansion: the `createHistory` failure branch of the controller cannot be reached through the public API, because the judge functions reject an invalid Scenario first | Accepted gap: the branch stays as a guard and has no test
2026-11-23 | behavior | app-ghost-mansion: a failed sub-agent run was marked completed by the orchestrator | Mark a task completed only after its "Done when" commands exit 0; leave a failed run as not completed
- 2026-11-23 | Vibe | パネルの見た目（暗い配色、2カラム、5段階の表示、大きなボタン、いまの視点の強調）を整えた。3Dの高さを親要素に与え忘れると画面が細い帯になる（core の表示は親の高さに合わせる）ため、ホスト要素には最初から高さを書く | 公開URLでの人の確認で見つかった
- 2026-11-23 | Vibe | 公開URLで「どう進めればよいか分からない」と指摘された。操作を並べるだけでは足りず、常に見える案内役（吹き出し）と「次に押すボタン」の強調が要る。案内の文言は、状態から決まる純関数（coach.ts）にして、描画なしでテストした | 人の確認。Kiroween 2025 の受賞作（SpookBnB の磨りガラスと丸いボタン、InteractionKit の案内キャラ）を参考にした
- 2026-11-27 | spec | app-moodwalk: tasks.md told the human to run `npm run preview`, but the repo has no `preview` or `dev` script | Write `npx vite preview` after `npm run build`; check that a named npm script exists before putting it in a task
- 2026-11-27 | behavior | app-moodwalk: `ReadResult` in model/pixels.ts and a controller path (Image_Store entry when `execute` throws) differed from design.md until the human preview | Compare exported types with design.md when a task ends; test the throw path of every command that touches a store
- 2026-11-27 | vibe | app-moodwalk: zone labels on the floor look mirrored in the 3D view (human screenshot); the label orientation is in core-view | Not fixed; the human decides at the gate whether to change the shared core-view label
