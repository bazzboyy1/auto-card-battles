# Phase 20 — Balance Foundation

## Why this phase

Playtest 3 revealed that the sim's greedy policy tests averages, not ceilings. Broken item/augment combos (e.g. double-interest economy scaling) can exist and be invisible to the harness because no policy specifically exploits them. No balance pass is trustworthy until the sim can detect these.

**Rule: no balance number changes until 20-A and 20-B are done.**

---

## Steps

### 20-A: Sim — augment + item sweep

Add two sweep modes to `src/balance.js`:

**Augment sweep** — for each augment in `AUGMENTS`, run 200 games where that augment is always picked when offered (first pick forced, others random). Report survival delta vs baseline greedy. Flag anything >8pp above baseline.

**Item sweep** — for each item in `ITEMS`, run 200 games where that item is always equipped on the highest-flat card that accepts it. Report survival delta vs baseline greedy. Flag anything >8pp above baseline.

Both sweeps should print a sorted table: `augment/item name | survival% | delta vs greedy`.

Files: `src/balance.js`, `src/sim.js` (may need a force-pick hook).

---

### 20-B: Economy investigation

Add an `economy-stack` policy to `src/sim.js`:
- Always buys Sporvik if available
- Always picks Tycoon (Collector's Eye) or Market Savant augment when offered
- Keeps gold high (doesn't reroll past 4g held)

Run 500 games with this policy. If survival is >10pp above greedy, the economy is broken and needs fixing before any target-curve tuning.

Also: read and confirm how "double interest" actually works in `src/game.js` — is there a gold-doubling path from augment + card combo? Document findings here.

Files: `src/sim.js`, `src/game.js` (read-only investigation).

---

### 20-C: Playtest UX fixes

Two quick fixes from Playtest 3 that don't require sim validation:

1. **Judge panel visibility** — when qualifying, show requirement AND checkmark simultaneously. Currently qualifying replaces the requirement text with "✓ Target: N". Change to show both: "✓ 2+ Abyssal active → 680".

2. **Shen-Nax Chapter 1 exclusion** — Critic Shen-Nax requires 2+ T3 cards active, which is near-impossible in rounds 1–8. Exclude her from the Chapter 1 judge pool (or flag her as Chapter 2/3-only in `HEAD_JUDGES`).

Files: `web/app.js`, `src/game.js`.

---

### 20-D: Balance pass

Informed entirely by 20-A and 20-B results. Do not spec numbers here — let the sweep data drive it.

Known candidates going in:
- Abyssal synergy: sim shows 65.6% vs greedy 54.8% (11pp gap)
- Livid synergy: 71.0% — historically accepted but now flagged
- Crystalline + Giddy: ~36-39% — potential dead paths
- Any item/augment flagged by 20-A sweep
- Economy fix if 20-B confirms it's broken

After fixes: re-run full balance harness (greedy, wide, all stacks, economy-stack). Spec: greedy 55-65% survival on Standard, no single build >15pp above greedy.

Files: `src/cards.js`, `src/board.js`, `src/game.js` (targets), `src/balance.js`.

---

## Files touched (full list)

| File | Step |
|------|------|
| `src/balance.js` | 20-A: sweep harness |
| `src/sim.js` | 20-A: force-pick hook; 20-B: economy-stack policy |
| `src/game.js` | 20-B: read economy; 20-C: Shen-Nax pool; 20-D: targets |
| `web/app.js` | 20-C: judge panel display |
| `src/cards.js` | 20-D: synergy values if needed |
| `src/board.js` | 20-D: synergy values if needed |
