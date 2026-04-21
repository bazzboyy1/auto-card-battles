# Initial Design Spec — Auto-Card Battles

**Read this cold. Everything needed to start building is here.**

> **2026-04-19:** Phase 6+ superseded by `async_redesign.md` (async model, fixed probs, roguelike runs). Phases 1–5 still accurate.

---

## What to build

An Auto Chess clone where two boards score against each other instead of fighting. 8-player lobby of AI-controlled players (human player UI comes later). Cards have species synergies that boost score. Combine 3 of the same card to upgrade its star level. Standard Dota Auto Chess economy and shop loop.

### Core loop (one round)

```
1. Income phase: each player earns gold (base + interest + streak)
2. Shop phase: 5 cards offered per player (level-weighted tiers)
   - Buy cards (costs gold by tier)
   - Re-roll for 2g
   - Lock shop (free, preserves offers next round)
   - Buy XP: 4g → +4 XP → may level up → more board slots
3. Sell / reposition: move cards between bench and board
4. Auto-combine: any 3 matching cards (same name + same star) → upgrade
5. Battle phase: each player paired randomly, boards compare scores
   - Higher score wins, loser takes HP damage
6. Eliminate players at 0 HP. Last player standing wins.
```

---

## Card definitions

### Species and synergy thresholds

| Species  | Threshold | Bonus |
|----------|-----------|-------|
| Warrior  | 2         | +20 flat score per Warrior on board |
| Warrior  | 4         | +60 flat score per Warrior on board |
| Mage     | 2         | All cards ×1.10 score |
| Mage     | 4         | All cards ×1.25 score |
| Hunter   | 2         | +15 flat score per Hunter on board |
| Hunter   | 3         | +40 flat score per Hunter on board |
| Beast    | 2         | +10 flat score per Beast on board |
| Beast    | 4         | +30 flat score per Beast on board |
| Beast    | 6         | +70 flat score per Beast on board |
| Demon    | 1         | That Demon ×2.0 score |
| Demon    | 2+        | All Demons ×1.5 score (diminishing — run 1 strong Demon) |

### Card list (v1 — 20 cards, 5 species)

| Name            | Species | Tier | Base Score |
|-----------------|---------|------|------------|
| Axe             | Warrior | 1    | 50         |
| Juggernaut      | Warrior | 1    | 55         |
| Dragon Knight   | Warrior | 2    | 80         |
| Sven            | Warrior | 2    | 85         |
| Doom            | Warrior | 3    | 130        |
| Ogre Magi       | Mage    | 1    | 40         |
| Crystal Maiden  | Mage    | 2    | 70         |
| Lina            | Mage    | 2    | 75         |
| Invoker         | Mage    | 3    | 120        |
| Viper           | Hunter  | 1    | 45         |
| Drow Ranger     | Hunter  | 1    | 42         |
| Windranger      | Hunter  | 2    | 78         |
| Sniper          | Hunter  | 3    | 125        |
| Lycan           | Beast   | 1    | 38         |
| Enchantress     | Beast   | 1    | 35         |
| Lone Druid      | Beast   | 2    | 68         |
| Morphling       | Beast   | 3    | 115        |
| Voidwalker      | Demon   | 1    | 60         |
| Shadow Fiend    | Demon   | 2    | 100        |
| Terrorblade     | Demon   | 3    | 170        |

### Star multipliers

| Stars | Score multiplier |
|-------|-----------------|
| 1★    | ×1.0            |
| 2★    | ×2.5            |
| 3★    | ×6.0            |

Upgrading to 2★ requires 3 copies of the same 1★ card. To 3★: 3 copies of 2★ (= 9× 1★ total).

### Card costs and pool sizes

| Tier | Cost | Pool per card |
|------|------|---------------|
| 1    | 3g   | 45 copies     |
| 2    | 4g   | 30 copies     |
| 3    | 5g   | 25 copies     |

Pool is shared across all 8 players. Buying removes from pool. Selling returns copies (1 copy for 1★, 3 for 2★, 9 for 3★).

---

## Economy

| Parameter      | Value                                              |
|----------------|----------------------------------------------------|
| Starting HP    | 100                                                |
| Starting gold  | 0 (earn on first income phase)                     |
| Base income    | 5 gold/round                                       |
| Interest       | +1g per 10g banked, max +5g (at 50g)              |
| Streak bonus   | Abs streak ≥2: +1g, ≥4: +2g, ≥6: +3g             |
| Re-roll cost   | 2g                                                 |
| Buy XP cost    | 4g per purchase = +4 XP                            |
| Max level      | 9 (= 9 board slots)                                |
| Sell value     | tier_cost × 3^(stars−1)  → 1★T1=3g, 2★T1=9g, etc |

### XP to level up (cumulative from level 1)

| Level | Total XP needed |
|-------|-----------------|
| 2     | 2               |
| 3     | 6               |
| 4     | 12              |
| 5     | 20              |
| 6     | 32              |
| 7     | 50              |
| 8     | 74              |
| 9     | 100             |

### Shop tier weights by level

Determines probability of each tier appearing in shop slots:

| Level | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| 1-2   | 100%   | 0%     | 0%     |
| 3     | 75%    | 25%    | 0%     |
| 4     | 60%    | 35%    | 5%     |
| 5     | 50%    | 40%    | 10%    |
| 6     | 40%    | 40%    | 20%    |
| 7     | 25%    | 40%    | 35%    |
| 8     | 15%    | 35%    | 50%    |
| 9     | 5%     | 30%    | 65%    |

---

## Battle and HP damage

- Each round: random pairings among alive players (no self-match). If odd count, one player gets a bye (no HP loss, no win credit).
- **Damage formula:** loser takes `2 + round_number` HP damage.
  - Round 1: −3 HP, Round 10: −12 HP, Round 20: −22 HP
- Tie: first player in pair wins (arbitrary tiebreak — refine later if needed).
- Player eliminated when HP ≤ 0. Last alive wins.
- Round cap: 40 rounds (safety valve). If multiple alive at cap, highest HP wins.

---

## Board / leveling

- Board is a flat array (grid shape is a UI concern, not an engine concern).
- `maxActive = player.level` — player can field up to level units on board.
- Bench: up to 8 cards (not scored, but contribute to combine checks).
- Cards on bench do NOT contribute to synergy counts or score.

---

## Implementation phases

### Phase 1: Headless core loop ✓ (2026-04-17)
**Goal:** `node run.js play` runs a full 8-player lobby to completion in terminal.

Files:
- `src/utils.js` — mulberry32 RNG, shuffle
- `src/cards.js` — card definitions, synergy specs, createCard
- `src/board.js` — Board class, calcScore (base × star mult + species synergies)
- `src/shop.js` — Pool (shared card pool), Shop (per-player offers)
- `src/game.js` — Player, Lobby, round loop
- `src/sim.js` — AI policies (greedy, random) + batch runner
- `run.js` — CLI: `play` (single game) + `sim` (batch)

**Exit criteria:** `node run.js sim 50` completes without errors. Games end by round 30 on average. No single player wins 100% of 50 games.

### Phase 2: Economy tuning ✓ (2026-04-17)

Batch sim confirmed all criteria. Tuning required before passing:
- `BASE_INCOME` 5 → 7 (players were spending to zero every round, no interest ever triggered)
- Interest threshold per-5g (was per-10g — 50g floor was unreachable)
- Demon synergy ×2.0/×1.5 → ×1.5/×1.3 (single-unit ×2 dominated all early boards)
- Greedy AI: level cap 5 → 7, added save-for-interest logic (pause spending when 1–2g from next threshold)

Post-tuning: interest 6–35g/game, streaks 4–34g/game, game length 22 rounds avg, win spread 10–16%.

**Open issue:** Demon appears on 6–7 of 8 boards every game. Mage and Beast barely appear. Flagged for Phase 3 balance pass.

### Phase 3–4: UI + Human Player ✓ (2026-04-17)

Full browser UI shipped. P1 = human, P2–P8 = greedy AI.

Human controls: buy shop cards, reroll (2g), lock shop, buy XP (4g), sell mode, click to move cards between board and bench. Score preview + synergy bar live during shop. Battle results modal with all matchups highlighted. Game-over / Play Again screen.

Server: `node serve.js` → http://localhost:3001

### Phase 5: Balance ✓ (2026-04-17)

Card score rebalance — see `DESIGN_LOG.md` Phase 5 section for full details.
Key change: Demon lone-unit bonus removed; now requires 2+ to activate (×1.8). Mage/Beast scores raised to be competitive individual picks.

### Phase 6 — SUPERSEDED (2026-04-19)
Redirected to async-multiplayer / roguelike-run model. See `async_redesign.md`.

---

## Decisions already made (do not re-open)

- No combat. Boards score, scores compare. Period.
- 8-player lobby (all AI for Phase 1-3).
- Flat array board (grid shape is UI-only).
- Random matchup pairings each round.
- Combine triggers auto after any buy/sell.
- Pool is shared across all players (as in AC).
- Bench cards don't score and don't count toward synergies.

## Open decisions (decide during implementation)

- **Tie-breaking** — first-in-pair wins is a placeholder. Consider score-difference-based HP drain instead.
- **Sell value** — current formula: `tier_cost × 3^(stars−1)`. Verify this is balanced.
- **Bye mechanic** — does a bye round count as a "win" for streak purposes?
- **Win condition** — last player standing or rounds cap + HP compare? (Currently: last standing, cap at 40.)
- **Classes** — second synergy axis (like Mage/Warrior class in AC). Defer to Phase 5.
