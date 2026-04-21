# Phase 13 — Post-Deploy Playtest Fixes

**Date:** 2026-04-21
**Context:** First external playtest via Netlify deploy. Five issues surfaced.

---

## Findings

| # | Finding | Kind | Decision |
|---|---------|------|----------|
| F1 | Per-card scores in judging animation differ from card-face scores in Exhibits | Bug | Fix |
| F2 | "Sporal ◌SHY" species + class badge crowd onto same line | Bug | Fix |
| F3 | Augment/item pick in RHS panel goes unnoticed — attention stays on board | UX | Fix |
| F4 | Growth Serum applies retroactively (doubling all accumulated rounds on attach) | Design | Keep as-is — user said "felt pretty good", treat as intentional power moment |
| F5 | Combining a unit resets roundsSinceBought to 0 — items like Growth Serum lose all accumulated round bonus | Bug | Fix |

---

## Root cause analysis

### F1 — Score animation vs card-face mismatch

`runBattle()` in `src/game.js` calls `calcScore()` at line 275, THEN increments `roundsSinceBought` for each active card at line 286. The animation (`web/app.js` line 916) re-runs `calcScoreBreakdown()` AFTER `runBattle()` returns — so it uses `roundsSinceBought + 1`. For axis-3 cards (scaling-per-round), this inflates their weights in `allocateByWeight`, shifting the proportional allocation toward those cards and away from non-axis-3 cards. Result: some cards show higher numbers in the animation than in the shop, others lower.

**Fix:** Capture the per-card breakdown snapshot inside `runBattle()` before the `roundsSinceBought` tick, and attach it to the returned result object. Animation uses the stored snapshot instead of recomputing post-battle.

Files: `src/game.js`, `web/app.js`

### F2 — "Sporal ◌SHY" same line

Species and class tags crowd onto one line for cards with longer species names (Sporal, Chitinous). Was noted as F7 in playtest 3 and addressed as P1 in Phase 10 via `min-height` on the labels row, but the fix didn't fully resolve wrapping. Probably needs the species/class badges to sit in a flex column instead of a row, or species on line 1, class on line 2.

Files: `web/style.css`, `web/app.js` (makeCard)

### F3 — Side panel attention

The RHS panel hosts augment and item pick prompts, but player eyes are on the board during/after combat. The transition is silent — no visual draw. Need a brief center-screen interrupt that redirects attention before resolving to the panel.

**Proposed fix:** When entering `'augment'` or `'item'` phase, show a small center-screen toast/banner ("Choose a Collector Upgrade →" or "Item pick ready →") that auto-dismisses after ~1.5s, then the panel remains. This is a lighter touch than a full modal and doesn't block the board view.

Files: `web/app.js`, `web/style.css`

### F5 — Combine resets roundsSinceBought

`_combine()` calls `createCard(name, stars + 1)` which sets `roundsSinceBought: 0`. Items are transferred but accumulated rounds are dropped. With Growth Serum (which doubles axis-3 flat = `10 × roundsSinceBought`), going from 1-star (say 20 rounds) to 2-star resets to 0 rounds — score collapses.

**Fix:** Before splicing source cards, capture `Math.max(...sourcedCards.roundsSinceBought)` and assign it to the upgraded card. The card "remembers" how long the longest-lived copy had been fielded.

Files: `src/game.js`

---

## Phase 13 plan

| # | Task | Files | Effort |
|---|------|-------|--------|
| A1 | Snapshot per-card breakdown in `runBattle()` before roundsSinceBought tick; return in result; use in animation | `src/game.js`, `web/app.js` | Low |
| A2 | Preserve `roundsSinceBought` through `_combine()` | `src/game.js` | Low |
| A3 | Fix species/class tag layout so they never share a line | `web/style.css`, `web/app.js` | Low |
| A4 | Add attention toast when entering augment/item phase | `web/app.js`, `web/style.css` | Low |

### Order

Do A1 and A2 headless (no UI). Run sim to confirm winrates unchanged. Then A3 and A4 in browser.

### Growth Serum retroactivity

Intentional — no change. Document: attaching Growth Serum mid-run to a long-fielded unit is a deliberate catch-up mechanic / high-impact moment. If it becomes too solvable (always save serum for old units), revisit in playtest 4.

---

## Sim target

After A1+A2: re-run 200-game batch, seed=1. Expect greedy ~70%, no more than ±3pp drift (these are bug fixes, not balance changes).
