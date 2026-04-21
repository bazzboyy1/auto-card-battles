# Async Redesign — Implementation Plan

**Companion to:** `design_log/async_redesign.md` (the spec)
**Baseline:** current `src/*.js` is the pre-redesign state (8-player lobby, shared pool, class synergies present).

Each phase leaves the game in a runnable state. Do phases one at a time; stop for review between them.

## Global constraints (all phases)

- **Class tags stay stubbed** — `class: null` on every card; no class-synergy engine code.
- **Item acquisition UX is deferred** — prototype uses a debug-grant command (CLI flag + `?dev=1` browser panel).
- **Real multiplayer is deferred** — use the fake opponent generator.
- **Tuning preserved unless spec explicitly changes it:**
  - Keep: XP curve, tier weights by level, interest (+1/5g cap +5), streak bonuses, damage `2 + round`, shop size 5, reroll 2g (pre-Midas), bench 8, combine 3→upgrade, star multipliers, sell formula.
  - Change (per spec): starting level 1→3, starting gold 0→9, starting slots 1→3, round cap 40→30, pool shared→fixed per-player probs, lobby→single-player run vs fake opponents.

---

## Phase 1 — Scoring pipeline refactor + class stub

Shape code for passives without adding them yet. Game still runs as the 8-player lobby.

- `src/cards.js`: set `class: null` on every def; delete `CLASS_SYNERGIES` + its export; add `passive: null` placeholder on each def. Leave `SYNERGIES` and tuning untouched.
- `src/board.js`: `calcScore(ctx = {})` — restructure pipeline to spec order (base → flat scaling Axis 3 → flat conditional Axis 2 → synergy flats → mults Axis 4 → board-level Axis 8). Only synergy branches fire for now. Drop class-synergy code from `calcScore`, `activeSynergies`, `synergyLine`.
- `web/app.js`: remove class rows from the synergy bar.

**Exit:** `node run.js sim 50` and browser play both work. Species-synergy scores match previous runs; class-synergy contribution is gone (expected, acceptable).

---

## Phase 2 — Per-player shop draw (remove shared `Pool`)

Replace shared-pool inventory with per-player weighted draw using fixed probabilities. Still 8-player lobby.

- `src/shop.js`: delete `Pool` inventory tracking. Keep `LEVEL_WEIGHTS`. New `drawOffers(level, rng, n)` returns card names by tier weight then uniform within tier; no inventory, no depletion. `Shop.refresh/reroll/buy` use it; `sell` no longer returns copies.
- `src/game.js`: `Player` no longer takes a pool; `sell()` signature drops the pool arg.
- `src/sim.js`, `web/app.js`: remove `new Pool(rng)` construction; update call sites.

**Exit:** 8-player lobby still plays out; sim winrate spread remains sane. Selling a 3★ does not replenish anyone's shop (intended).

---

## Phase 3 — `Lobby` → `Run` + fake opponent generator

Single-player roguelike shell. Starting level 3, 9 gold, 3 slots, 100 HP, round cap 30.

- **NEW** `src/opponents.js`: `generateOpponent(round, rng)` → `{ name, calcScore() }`. Round-scaled score curve fit to expected greedy-AI score at round N (calibrate from a sim) ±20% noise. Short fixed name list. No card list — opaque score.
- `src/game.js`: replace `Lobby` with `Run` — single `Player`, round counter, opponent history. `runBattle()` draws one opponent, compares scores, applies `2 + round` damage. `isOver()` = HP ≤ 0 or round > 30. Final score = HP + tiebreak on rounds survived.
- `src/sim.js`: `runGame(seed, policy)` instantiates `Run`; `batchSim` reports `{avgRoundsSurvived, winRate, avgFinalHp}`.
- `run.js`: adjust printed stats.
- `web/app.js`: rebuild to single-player — one player panel, one opponent reveal per battle, no lobby standings. Game-over screen shows rounds survived + final HP.

**Exit:** `node run.js play` completes a run; browser plays a single-player run vs fake opponents round by round.

---

## Phase 4 — Card passives (all 20)

Implement every passive from the spec table with correct axis handling.

- `src/cards.js`: fill in `passive = { description, axis, eval(card, ctx) }` for each def. `ctx` carries `{round, boardState, speciesCounts, classCounts, self}`.
- Per-card state added at buy time: `roundsSinceBought` (ticks on round-end while on `active`; frozen on bench; reset on sell).
- `src/board.js`: pipeline stages now actually fire passives grouped by axis. Multiplicative stacking is multiplicative; flats additive.
- `web/app.js`: live score preview uses the new pipeline; show passive text on card tooltip.

**Decisions:**
- Morphling tie-break: alphabetical species order when ≥2 species are at 3+.

**Exit:** spot-check — Terrorblade ×0.5 rounds 1–9 then ×2 from 10; Sven +80 iff highest-scoring Warrior; Invoker base→0 + Mages +30%; Ogre Magi tick-income observable; Viper/Sniper/Shadow Fiend scale per round since bought.

---

## Phase 5 — Items + debug grant

10 items attachable to units, 3 slots each, permanent per run. No acquisition UX; debug-grant only.

- **NEW** `src/items.js`: item defs. Two application modes:
  - **pre-processor** (Recurve Bow, Warmog's, Last Whisper): mutate the passive evaluator's output before the pipeline.
  - **direct** (Claymore base-bump, Giant's Belt star-scaled mult, Zeke's aura, Hextech tick-gold, Spear of Shojin synergy-phantom, Guinsoo's per-round scaling, Emblem synergy count-add).
- Card state: `items: []` (max 3). `attachItem(cardId, itemId)` / `detachItem`.
- `src/board.js`: items resolve before passive eval for axis modifiers; axis-1/3/4/7/8 items fold into their own stage.
- **Debug grant:**
  - CLI: `node run.js play --grant "Axe:Claymore,Axe:Warmog's"`
  - Browser: `?dev=1` query flag shows a dev panel (pick card + item, attach).
- UI: three slot pips on each active card; click-to-detach in dev mode only.

**Exit:** Claymore → base +40 visible in preview; Recurve Bow on Viper → per-round +10 becomes +20; Zeke's Herald lifts other cards' scores.

---

## Phase 6 — Augments + pick flow

Pick 1-of-3 at rounds 3, 7, 12. Global modifiers apply for rest of run.

- **NEW** `src/augments.js`: 10 augment defs. Storage: `run.augments = []`; board pipeline reads augment flags (`doubleConditional`, `mulBonus: +0.25`, `earlyRoundShift: 3`, `benchCountsForSynergy`, `interestMult: 2`, `extraBoardSlot`).
- `src/game.js`: `Run` exposes `pendingAugment` at round start for rounds 3/7/12; shop phase blocks until `Run.pickAugment(idx)`. Shapeshifter + Overflow apply on pick (mutate player state). Midas `-1g reroll` via `Shop.rerollCost(augments)`.
- Ordering: augment pick happens **before** income/shop that round so spend decisions can react.
- Same-axis item+augment stacking: **cap to one doubling source** (spec flag 'almost certainly overtuned'). Enforce deterministically (e.g. augment wins over item when both double the same axis).
- `src/sim.js` AI: default picks first option; optionally score augments against current archetype.
- UI: modal overlay with 3 cards; shop input disabled until pick. Visible augment list on the player panel.

**Exit:** run through a seed hitting all three picks; Iron Will doubles Axe's conditional; Overflow gives slot 10; Midas knocks reroll to 1g.

---

## Phase 7 — AI policy refresh + cleanup

- `src/sim.js`: greedy policy updated for L3/9g start and to weight passives / current items / current augments. Reuse interest-save and XP-cap logic.
- Optional: 1–2 proto-strategy policies (Warrior Stack, Demon Arc) as validation targets.
- Re-run `node run.js sim 200`. Expect: no 100% winrate vs fake opponents, round-survival distribution reasonable, no crashes.
- Delete dead code (old `Lobby`/`Pool` refs, class-synergy remnants, unused UI paths).

**Exit:** clean sim output; manual playthroughs hit augment picks + item grants without errors.

---

## Open items flagged for later (do NOT block phases)

- Real item acquisition mechanic (round reward? carousel?) — spec open.
- Class list + per-card class tags + class synergy thresholds — spec says patch as pure data.
- Board positions (needed for Axis 6 aura effects eventually) — out of scope.
- Leaderboard / persistence, real async matchmaking — post-prototype.
- Economy retune — post-playtest.
