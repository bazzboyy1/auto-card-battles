# Playtest 2 — Findings & Phase 9 Plan

**Date:** 2026-04-20
**Context:** Second playtest pass after Phase 8.3 (items + augments + tooltip polish). Feedback collected across 3+ runs, most of them played as Warrior. This file captures findings and the Phase 9 implementation plan.

## Findings summary

| # | Finding | Kind | Bucket |
|---|---|---|---|
| 1 | Item tooltips inconsistent between inventory bag and equipped pips | UX | A |
| 2 | Augment tooltips clip off-screen; text overflows the tooltip box | UX | A |
| 3 | No way to inspect opponent's board after a battle | UX | A |
| 4 | Economy feels loose — player is often very rich, rerolls are cheap | balance | B |
| 5 | Warriors dominate; player chases the same build every run | design / balance | B + C |
| 6 | 3-starring feels too easy with no scarcity mechanic | design / balance | B + C |
| 7 | Fake opponents feel unchallenging; hard to tell if balance is real or AI is weak | design | (deferred) |

Findings 5 and 6 share a root cause: **there is no structural pressure to pivot off a strong build.** The per-player shop has no pool drain (confirmed; async game, real pool drain would require drafting opponents), and there's only one synergy axis (`species`), so mono-Warrior is strictly dominant when Warrior thresholds are strong.

Finding 7 is a symptom of the fake-opponent design (score curves, not drafters). Real drafting AI is out of scope for Phase 9; we accept this limitation and revisit post-Phase 9 if needed.

---

## Design stance — no simulated pool drain

We considered simulating a shared card pool (tracking draws from fake opponents, showing depletion to the player). Rejected because:

- Pool drain's strategic value in real AC is **signal** — you read which cards are contested by observing real opponent decisions. In our game the "opponents" are score curves, so drain from them is noise dressed as signal.
- Adds opaque variance (some runs randomly harder) with no corresponding insight the player can act on.
- Creates fairness perception issues — indistinguishable from "this run was just unlucky."

Instead: solve pivot pressure through **structural design + balance**, not scarcity simulation. Pool drain becomes viable only if we ever build drafting opponents (deferred).

---

## Bucket A — UX fixes (Phase 9.1)

Quick-win polish from playtest feedback. Three independent commits.

### A1. Unified item tooltip
- **Files:** `web/app.js` (item bag rendering + pip rendering), `web/style.css`
- **Current:** items in `renderItemBag()` and as pips on cards have different tooltip treatments (or none). Inconsistent with the augment / card tooltip styling landed in Phase 8.2.
- **Fix:** extract a `makeItemTooltip(itemDef)` helper producing a styled tooltip node (name + axis + description). Reuse for both bag items and equipped pips. Match existing `.card-tooltip` / `.aug-tooltip` styling.
- **Exit:** hover any item in the bag or any pip on a card → same styled tooltip with full description.

### A2. Augment tooltip viewport clamp + text fit
- **Files:** `web/app.js` (augment badge hover handler), `web/style.css` (`.aug-tooltip`)
- **Current:** B1 added styled augment tooltips but didn't clamp to viewport; long descriptions overflow the box and badges near the right edge clip off-screen.
- **Fix:** apply the B2 pattern (measure rect on `mouseenter`, toggle `.tooltip-left` / `.tooltip-right` class when the tooltip would overflow horizontally). Set `.aug-tooltip` to `max-width: 240px` + `word-wrap: break-word` so text wraps rather than spilling.
- **Exit:** hover any augment badge, anywhere on screen → tooltip fully visible, text wraps inside the box.

### A3. Opponent board viewer
- **Files:** `src/game.js` (store opponent snapshot alongside battle result), `web/app.js` (viewer UI in battle result screen)
- **Design note:** fake opponents are score curves, not drafters — they don't have real boards. For this UX we generate a **decorative** snapshot at battle time: pick a plausible species bias, fill 4–6 cards at star levels appropriate for the round, match the opponent's score roughly. This is a cosmetic feature, not a gameplay change.
- **Fix:** at battle resolution, attach a generated `opponentBoard` snapshot to the battle result. Add a "View opponent" toggle on the battle result screen that renders the snapshot using the existing card render pipeline.
- **Exit:** after any battle, player can toggle to see the opponent's board. Shows cards, items, and synergies they allegedly ran.
- **Caveat documented:** tell the player (via a subtle footnote or just design awareness) that opponent boards are representative, not exact — until drafting opponents exist.

Bucket A is ~3 commits, one per item. Lands first as quick wins.

---

## Bucket B — Economy + synergy balance (Phase 9.2)

Data tuning only — no new systems. Goal: make chasing mono-builds expensive and make wide builds viable.

### B1. Economy tightening
- **Files:** `src/game.js` (`Player.earnIncome`, interest cap constants), `src/shop.js` (reroll cost)
- **Current (confirm by reading):** interest appears uncapped or capped loosely; reroll is flat 2g. Player can accumulate 50g+ and reroll many times per round.
- **Fix:** lower interest cap (e.g., max 5g interest per round → caps capital incentive at ~50g). Consider scaling reroll cost with player level (2g → 3g at L6+).
- **Validation:** `node run.js sim 200` across several parameter combinations. Target: player average late-round gold reserves drop ~30–40%; winrate remains in 45–70% band.
- **Exit:** sim shows 3-starring still possible but more costly; winrate preserved.

### B2. Synergy threshold rebalancing
- **Files:** `src/cards.js` (species synergy data) or `src/board.js` (wherever `SPECIES_SYNERGIES` lives)
- **Current:** Warrior-2 and similar low-threshold synergies appear strong enough that going mono-Warrior-4/6 is better than 2+2+2 diverse builds.
- **Fix:** flatten the early-threshold payoff; boost late-threshold payoff; adjust so that a 2+2+2 synergy board competes with a 6-of-one board.
- **Validation:** `node run.js sim 200` — compare `warrior-stack` policy vs `greedy` vs (new) `wide` policy. Target: `warrior-stack` winrate ≤ `greedy` winrate.
- **Exit:** sim shows mono-build is no longer strictly optimal; diverse builds score competitively.

### B3. Diversity-rewarding augments
- **File:** `src/augments.js`
- **Fix:** add two augments:
  - **Varietal** — +X flat score per unique species on your board.
  - **Cross-Training** — +Y% multiplier per active synergy threshold (species or class, once C lands).
- **Validation:** sim batch with these augments in rotation; confirm wide policies improve with their presence.
- **Exit:** both augments appear in augment-pick pool, apply correctly, show in tooltips, contribute to score breakdown.

Bucket B is ~3 commits, data-only. Each one validated with a sim batch before moving on.

---

## Bucket C — Classes (Phase 9.3)

The structural fix for pivot pressure. Adds a second synergy dimension so "going wide" gets structurally rewarded.

### Design decisions (resolved)

- **Taxonomy:** borrowed from AC tradition — **Knight, Assassin, Hunter, Priest, Berserker** (5 classes to match 5 species). Labels are placeholder-quality; rename freely later.
- **Per-card tagging:** each of the 21 cards gets exactly one class. Assignments TBD during implementation; aim for each class to include cards from multiple species so class synergies naturally force multi-species boards.
- **Class emblems:** yes, each class gets an emblem item (same pattern as species emblems). Adds parity and gives items another lever.
- **Shapeshifter + class interaction:** deferred — balance question. For Phase 9.3, Shapeshifter only modifies species, not class. Revisit in playtest 3.

### C1. Data layer
- **File:** `src/cards.js`
- Add `class` field to each card (one of the 5).
- Add `CLASS_SYNERGIES` constant mirroring `SPECIES_SYNERGIES` — thresholds, flat/mult values.
- Add 5 new emblem items to `src/items.js` (one per class).

### C2. Scoring
- **File:** `src/board.js`
- Add `effectiveClassCounts(board, ctx)` mirroring `effectiveSpeciesCounts`. HiveMind / Shapeshifter do *not* affect class (for now); class emblems *do*.
- Add class synergy stages to `calcScoreBreakdown` pipeline. Position: right after species synergy stages, before item/augment stages.
- `calcScore` stays a thin wrapper.

### C3. UI
- **File:** `web/app.js`
- `renderSynergyBar` shows both species and class rows (two grids or two sections).
- Card face shows both tags (species + class) — compact rendering.
- Card tooltip breakdown includes class synergy lines.

### C4. Sim
- **File:** `src/sim.js`
- Existing `warrior-stack` policy optimizes species only — it will now struggle (intentional).
- Add `wide` policy that optimizes for multi-synergy (prefers units that activate a new synergy threshold over a new copy of an existing one).
- Greedy benefits automatically (it's greedy on final score).
- Re-run 200-game batch on all policies after landing.

Bucket C is ~4 commits (data / scoring / UI / sim). Biggest change; lands last so A/B are proven first.

---

## Bucket D — Conditional (skip by default)

### D1. Contested archetype signal
Only consider if Phases 9.1 + 9.2 + 9.3 don't produce enough pivot pressure (measured via diversity metric — e.g. "% of runs where top-scoring 5 units share a species"). Otherwise skip.

Adds fake "contested meta" signal: when opponent archetypes overlap with player's, apply a small score penalty + UI indicator. Teaches diversity value without real drafting opponents. Skip if not needed.

---

## Metrics to track

After each phase, run `node run.js sim 200` and record:
- Winrate (target: 45–70%)
- Run survival rate (target: not 0% or 100%)
- **Diversity metric (new):** % of surviving runs where the 5 highest-scoring units share a species. Lower is better — indicates diverse builds are viable.
- Per-policy winrate comparison: `greedy` vs `warrior-stack` vs `wide`.

Phase 9.2 and 9.3 each need the diversity metric to *decrease* vs. baseline. If it doesn't, the lever didn't work; revisit before moving on.

---

## Sequencing

1. **Phase 9.1 (A)** — UX fixes. Quick wins, no balance risk. ~3 commits.
2. **Phase 9.2 (B)** — economy + synergy tuning + diversity augments. Data-only, validated per commit with sim batch. ~3 commits.
3. **Phase 9.3 (C)** — classes. Structural, biggest change. ~4 commits.
4. **Phase 9.4 (D)** — only if metrics say we still need it. Default: skip.

After Phase 9.3, run full sim batch, then playtest 3. Log findings in `playtest_3_findings.md`.

## Deferred (confirmed still deferred)

- **Drafting opponents** (real AI that actually builds boards) — would make pool drain and archetype signals meaningful, but huge scope. Revisit post-Phase 9.
- **Shapeshifter + class interaction** — balance question, answer in playtest 3.
- **Board positions / Axis 6 auras** — out of scope.
- **Real multiplayer, leaderboards, persistence** — post-prototype.

## Phase 9 completion status (2026-04-20)

- **Phase 9.1 (A)** ✓ — UX fixes: unified item tooltip, augment viewport clamp, opponent board viewer
- **Phase 9.2 (B)** ✓ — Economy tightening, synergy rebalance, Varietal + CrossTraining augments
- **Phase 9.3 (C)** ✓ — Classes landed. See DESIGN_LOG.md for final sim numbers and class taxonomy.
- **Phase 9.4 (D)** — skipped (diversity metrics acceptable without it)

**Next:** Playtest 3. Log findings in `design_log/playtest_3_findings.md`.

## Class taxonomy (Phase 9.3 final)

| Class | Cards |
|---|---|
| Knight | Dragon Knight (W), Crystal Maiden (M), Lycan (B), Viper (H) |
| Assassin | Voidwalker (D), Shadow Fiend (D), Juggernaut (W), Lina (M) |
| Ranger | Drow Ranger (H), Windranger (H), Sven (W), Enchantress (B) |
| Priest | Ogre Magi (M), Lone Druid (B), Axe (W), Sniper (H) |
| Berserker | Doom (W), Invoker (M), Morphling (B), Terrorblade (D) |

Each class spans 3–4 species; no mono-species build can max a class synergy without branching.

## Calibration note (for future balance work)

Initial class synergy values (before tuning) were ~3× too high — activating 3–4 class synergies simultaneously pushed greedy winrate from 63% to 80%. Final values are intentionally modest (e.g. Priest ×1.02/×1.05 global) because they stack multiplicatively with each other and with species synergies.
