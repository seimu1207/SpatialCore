---
name: unit-approval
description: >
  Run one spec or Unit through the approval gates of Haunted Graph Kit: requirements → approve → design → approve
  → tasks → approve → build → verification gate. Use when starting a spec (repo-foundation, core, app-ghost-mansion,
  app-moodwalk, new-app-template), when asking for plan approval, when a Unit is finished, or when recording an
  approval in docs/decision-log.md.
metadata:
  source: docs/intent.md 10.2, 10.5
---

# unit-approval

Process from `docs/intent.md` 10.2. Never skip a step or merge two gates. Stop and wait at every **STOP**.

## 0. Start
- Confirm which spec this is. It must be in intent.md 10.6; do not create a new one.
- Confirm that the earlier gate is recorded in `docs/decision-log.md` (Prep before Unit 1, Unit 1 before Unit 2, and so on). If it is not, stop and tell the human.
- Read `.kiro/steering/lessons.md`.

## 1. Plan (one document at a time)
For each of `requirements.md` → `design.md` → `tasks.md` under `.kiro/specs/<spec>/`:
1. Write it (the `architect` agent, or the main session following the architect's rules).
   - requirements.md: EARS form, IDs like `R-CORE-03`, plus the headings "PBT properties" and "Safety".
   - design.md: the core/app interface, the PBT properties from intent.md 10.6 and how each is checked, plus a "Safety" heading.
   - tasks.md: tasks of a few hours each, each naming its requirement IDs. Order them so the public URL still works after every task.
2. Ask the `reviewer` agent to review that one document.
3. Show the human the document and the reviewer's verdict and findings. **STOP** until the human approves or asks for changes.
4. When approved, add one line to `docs/decision-log.md`:
   `date | <spec> | <document> approved | reviewer: READY/NOT-READY, findings handled`

## 2. Build
- Run the tasks in `tasks.md` in order, one at a time.
- A change that fails a sensor (type-check, lint, schema, required-sections) is not accepted. Fix it before going on.
- Tests and PBT run when a task is completed, not on every save.
- At the end of each day, add 1–2 lines to `lessons.md` (PBT bugs, spec fixes, Vibe fixes).

## 3. Verification gate (end of a Unit)
1. Confirm that every sensor, test, and PBT passes, and report the counts.
2. Confirm the latest build is deployed to the public URL.
3. Ask the `reviewer` agent to review the Unit's code and tests.
4. Give the human a short checklist taken from the spec's completion criteria in intent.md 10.6. Ask them to check it on the public URL. **STOP** until the human approves.
5. When approved, add one line to `docs/decision-log.md`:
   `date | <Unit> | what was checked | result`

## Rules
- If the human corrects you during a gate and the correction should hold next time, ask once: "Record this in lessons.md?"
- If intent.md has to change, do not edit it yourself. Propose the change; the human edits it, and you add the decision-log line.
- Reply to the human in Japanese.
