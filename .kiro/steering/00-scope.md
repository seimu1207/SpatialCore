# 00-scope — Top constraints

Source of truth: `docs/intent.md` ch. 0. This is the only place these constraints are written; other steering files refer here. All steering files apply together; none overrides this one. Each rule names the check that verifies it.

## Delivery
- Always submit something that works by the deadline. Keeping the project submittable at any moment beats adding features. (check: deploy on every push, ch. 10.2 ④)
- Ask the user when information is missing.

## Size and cost
- One developer. Do not create more specs, agents, or hooks than one person can manage. (check: counts in intent.md 10.3–10.6)
- Start with the simplest implementation. Avoid wasted tokens and cost. (check: tests and PBT run only on task completion)

## Runtime
- Works end to end with no AI and no backend. Runs as a static site in the browser; judges need no API key and no install. (check: verification gate on the public URL)
- Rules decide, AI only explains. Game results, attack success, and mood-shift detection are decided deterministically by the rule engine. (check: PBT "same input → same result")

## Architecture boundary
- `core/` knows nothing about specific apps. Apps differ only by scenario JSON, rule definitions, and theme. (check: reviewer agent; details in structure.md)

## Safety
- Never build anything that violates the safety rules (`safety.md`, intent.md ch. 9). (check: reviewer agent)

## Process and gates
- Do not skip phases or gates. Go Envision → Plan → Build.
- Get human approval for requirements → design → tasks. (check: plan approval)
- At the end of each Unit, tests and sensors pass, then a human checks behavior on the public URL and approves. (check: verification gate, logged in `docs/decision-log.md`)
