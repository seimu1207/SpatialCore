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
