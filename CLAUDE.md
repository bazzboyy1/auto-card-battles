# Auto-Card Battles — Project Instructions

## Phase wrap-up (MANDATORY — no exceptions)

After every phase commit (any commit that bumps the version number or completes a numbered phase sub-step), you MUST do all three of the following before ending your turn — without waiting to be asked:

1. **Update `DESIGN_LOG.md`** — update the "Current state" block: phase, version, what shipped, what's next.
2. **Update memory** — update the relevant memory file(s) in `.claude/projects/…/memory/` to reflect the new phase state.
3. **Set "Next action"** — make sure `DESIGN_LOG.md` has a clear `**Next action:**` line pointing to the next phase step.

This is the single most important rule in this file. The whole point is that the next conversation can `/resume` cold and know exactly where to start.

## Design log is the source of truth

If memory contradicts the log, trust the log. If they conflict, update memory to match the log.

## Hard reminders (don't re-derive these)

- Cards are data, not code. New cards go in `src/cards.js`.
- No combat framing — score = exhibition appraisal.
- Class synergy calibration: values ~50% of species equivalents (3–4 activate simultaneously and compound).
- Version must be bumped in `web/index.html` on every commit.
- `src/opponents.js` and `src/ranking.js` (old RP system) are gone — don't reference them.
