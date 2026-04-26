---
name: resume
description: Use at the start of any new conversation on the Auto-Card-Battles project to pick up where the previous session left off. Triggers on "resume", "continue", "where were we", "what's next", or any first message in a fresh conversation that assumes prior context about this codebase. Loads the design log, surfaces current phase + planned next action, and reports back before doing any other work.
---

# Resume — Auto-Card-Battles

The user is continuing work on this project across conversations. The design log is the source of truth; read it first, then report back in a structured summary so the user can correct course before you do any work.

## Step 1 — Read the entrypoint

Read `DESIGN_LOG.md` (repo root). It holds:
- **Current state** block — which phase, what's shipped, what's next
- **Index** — pointers to `design_log/*.md` sub-files
- **Hard reminders** — must-respect invariants (e.g. "cards are data, not code")

## Step 2 — Read the relevant sub-files

Based on the "Current state" and "Next action" fields in `DESIGN_LOG.md`, load only what the next action needs:

- If next action references a specific plan file (e.g. `playtest_1_findings.md`, `async_redesign_plan.md`), read that file in full.
- If the user's first message asks about history ("why did we do X"), find the matching sub-file in the index and read that.
- If the user says "continue" / "what's next" / "go" with no specifics, read the file the "Next action" points to.
- Do **not** read all sub-files pre-emptively. The entrypoint is designed to keep context small.

## Step 3 — Skim the code surface the next action touches

Only the files explicitly named in the current plan's "Files affected" or equivalent section. Do not enumerate the full codebase.

## Step 4 — Report back to the user

Before doing any work, reply with a compact brief in this shape:

```
**Where we are:** <one line — phase + one-sentence state>

**Last completed:** <what shipped in the previous phase>

**Planned next:** <bucket / sub-phase from the plan file, with 1-2 bullet specifics>

**Open design questions (if any):** <bullet list, or "none">

**Ready to start on <X> — confirm or redirect?**
```

Keep it under ~15 lines. No preamble. No re-stating the project pitch unless the user asks.

## Step 5 — Wait for confirmation

Do not start editing code on the strength of the design log alone. The plan is a plan; the user may have changed their mind, found new bugs, or want to redirect. Get a go-ahead (even a terse one) before touching files.

## Hard rules

- **Design log is source of truth.** If memory or chat feels like it contradicts the log, trust the log.
- **Auto-wrap after every phase — no exceptions.** When a phase commit lands (version bumped, phase step complete), immediately and without being asked: (1) update `DESIGN_LOG.md` "Current state" block, (2) update the relevant memory file(s), (3) confirm "Next action" is set. Do not wait for the user to say "prep for next convo" — just do it.
- **Don't re-open decided questions** listed under "Decisions already made" in `design_log/initial_spec.md` (e.g. no combat, bench doesn't score).
- **Deferred ≠ forgotten.** Items under "Open / deferred" (classes, board positions, real multiplayer) stay deferred until explicitly pulled in.

## What not to do

- Don't summarize the entire codebase. The log handles that.
- Don't re-read files that were already read in this conversation — but on a fresh conversation, always start here.
- Don't write code, tests, or new files during the resume — this skill is read-only until the user confirms direction.
