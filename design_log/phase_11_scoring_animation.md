# Phase 11 — Battle Scoring Animation

**Status:** Complete (2026-04-20)  
**Priority:** Next (before any hover-score-impact features)  
**Goal:** Make the moment of judging feel exciting — player watches their exhibition scored card by card, then the opponent's, then totals compared.

---

## What exists today

- `onReady()` calls `runBattle()` instantly → result modal appears
- Result modal shows: win/loss, scores, opponent board (toggle button), augment badges, history
- Opponent board is a cosmetic snapshot (`generateOpponentSnapshot`) — no real passives/items
- `calcScoreBreakdown()` exists and gives full per-card breakdown for the player

## Design decisions

### Opponent per-card scores are fabricated
`r.opponentScore` comes from the opponent curve (`src/opponents.js`), not a real board. We distribute it across the cosmetic opponent cards proportionally by `baseScore × stars`. The resulting numbers are invented but sum to the real total — the player can't tell, and the fantasy ("watch their collection be judged") is worth it.

**Why not show only the opponent total?** Anticlimactic. The drama comes from watching each alien be appraised in turn.

### Sequence
1. **Player's exhibition scored** — cards light up one by one left-to-right; running player total ticks up
2. **Opponent's exhibition scored** — same animation, running opponent total ticks up
3. **Winner reveal** — totals compared, win/loss highlight + damage text if loss
4. **Continue** → existing (slimmed) result modal (history + augment badges, no matchup section since the animation covered it)

### Skip button
Always visible during the animation. Immediately shows the final state (all cards scored, totals revealed, winner shown). No one should be forced through the full animation on every round by late game.

### Speed
- Each card scores in ~400ms (score ticks up over ~300ms, then 100ms pause before next)
- Running total ticker updates as each card finishes
- Opponent phase starts 600ms after player's last card
- Winner reveal holds for 800ms before "Continue" button appears
- Total runtime ~3–6 seconds depending on board size (skippable at any point)

---

## New phase: `'scoring'`

Added between `'shop'` and `'result'`:

```
shop → [Ready] → scoring → [Continue] → result → [Continue] → shop
```

`S.phase = 'scoring'` triggers `showScoringModal()`.

---

## Implementation plan

### A — Data prep (no UI yet)
- `calcOpponentPerCardScores(opponentBoard, totalScore)` in `web/app.js`
  - Takes cosmetic opponent card array + `r.opponentScore`
  - Returns array of `{ card, score }` proportional to `baseScore × stars`, rounded to integers summing to total
  - Pure function, no side effects

### B — Scoring modal layout
- Full-width modal (centered, not side-panel) — replace `showResultModal` trigger in `onReady`
- Two columns: **Your Exhibition** (left) | **Their Exhibition** (right)
- Each column: card row + running total beneath
- Skip button top-right
- Continue button (hidden until winner revealed)
- Cards shown with species color but scores hidden initially (show `?` or blank)

### C — Animation engine
- `animateScoringSequence(playerEntries, opponentEntries, onDone)` — pure JS, no framework
  - `playerEntries`: array of `{ card, score }` from `calcScoreBreakdown`
  - `opponentEntries`: array from A above
  - Steps through each card with `setTimeout` chain
  - Each step: unhide score on card, tick running total up (via `requestAnimationFrame` counter)
  - On player done → pause → start opponent entries
  - On both done → winner highlight → call `onDone()`
  - `onDone` shows Continue button
- Skip: calls `onDone()` immediately, cancels pending timeouts, snaps all scores to final

### Card punch
When a card is scored, it gets a brief physical "punch" — scale up then snap back — to make each appraisal feel impactful.

- CSS keyframe animation `@keyframes card-punch` on `.scoring-card.scored`:
  ```
  0%   { transform: scale(1); }
  30%  { transform: scale(1.18) translateY(-6px); }
  60%  { transform: scale(0.95); }
  100% { transform: scale(1); }
  ```
  Duration ~280ms, `ease-out`. Class `.scored` is added by the animation engine at the moment the score is revealed.
- The score number itself fades+slides in (`opacity 0→1`, `translateY 4px→0`) over 200ms, slightly offset from the punch peak so both feel distinct.
- Running total ticker starts after the punch peaks (~120ms in), so the number appearing and the total climbing feel causally linked.

### D — Result modal cleanup
- Remove matchup section (scores + win/loss) from `showResultModal` — the scoring animation covers this
- Keep: augment badge row, opponent history, eliminated/survived note, Continue button
- Add a small "Round N — Win/Loss" header so context isn't lost

### E — Wire-up
- `onReady()`: set `S.phase = 'scoring'`, store result in `S.result`, call `render()`
- `render()` case `'scoring'`: call `showScoringModal()`
- `showScoringModal()`: builds layout (B), calls animation engine (C)
- Skip button / Continue button: `S.phase = 'result'`, `render()`

---

## Files affected
- `web/app.js` — new functions: `calcOpponentPerCardScores`, `showScoringModal`, `animateScoringSequence`; modified: `onReady`, `render`, `showResultModal`
- `web/style.css` — scoring modal layout, card score reveal animation, running total ticker, winner highlight

## What NOT to do
- Don't make the opponent board scores "real" by running calcScoreBreakdown on it — it doesn't have passives/items/augments, the numbers would be wrong and confusing
- Don't block on animation — skip must always work
- Don't remove the result modal entirely — history and augment context still live there
