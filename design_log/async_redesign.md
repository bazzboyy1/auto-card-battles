# Async Redesign — Implementation Spec

**Date:** 2026-04-19
**Supersedes:** `initial_spec.md` Phase 6+
**Purpose:** Source of truth for the Claude Code implementation session that follows.

## Mode

Async multiplayer (Backpack Battles model). Player submits a board → matched against a randomly selected player's submitted board (frozen DB entry). No live lobby. Roguelike run structure.

**Prototype scope: no real multiplayer infra.** Fake-generate opponent names and round-appropriate boards at battle time. Sufficient for sim + single-player testing.

## Core mechanics — changes from `initial_spec.md`

| Change | From | To |
|---|---|---|
| Card pool | shared across 8 players | fixed per-player probabilities, no shared state |
| Starting level | 1 (→1 slot) | 3 (→3 slots); max stays 9 |
| Starting gold | 0 | 9g |
| Lobby | 8-player, synchronous | roguelike run vs async/fake boards |
| 2nd synergy axis | — | class (stubbed for v1, data-patched later) |
| Items | — | 3 slots/unit, attachable, permanent per run |
| Augments | — | player picks 1 of 3 at milestone rounds |
| Opponent preview | — | none (rejected: async viewer advantage inflates winrate) |
| Score variance | — | none (rejected: stacks RNG on acquisition RNG) |

**Unchanged from `initial_spec.md`:** species synergies + thresholds, XP deltas per level-up (reused starting at level 3→4 = 6 XP), tier weights by level, shop size (5), reroll cost (2g), interest (+1g per 5g banked, cap +5g), streak bonus, damage formula (`2 + round_number`), bench size (8), combine logic (3 matching → upgrade).

## Starting conditions (per player / per run)

| Param | Value |
|---|---|
| Level | 3 |
| Board slots | 3 |
| Gold | 9 |
| HP | 100 |
| Items | none |
| Augments | none (first pick at round 3) |

## Card passives

All 20 cards from `initial_spec.md` retain `name / species / tier / base score`. Each gains one passive below.

Axis tags: **1**=unconditional · **2**=conditional flat · **3**=scaling · **4**=multiplicative · **5**=synergy count · **6**=round timing · **7**=meta · **8**=board-level.

| Card | Species | Tier | Base | Passive | Axis |
|---|---|---|---|---|---|
| Axe | Warrior | 1 | 50 | `+20 per other Warrior on board` | 2 |
| Juggernaut | Warrior | 1 | 55 | `+25% score per 2★+ unit on board (self counts)` | 4 |
| Dragon Knight | Warrior | 2 | 80 | `Counts as 2 Warriors for synergy` | 5 |
| Sven | Warrior | 2 | 85 | `+80 if highest-scoring Warrior on board` | 2 |
| Doom | Warrior | 3 | 130 | `All other Warriors +20% score` | 8 |
| Ogre Magi | Mage | 1 | 40 | `+3 gold per round while on board` | 7 |
| Crystal Maiden | Mage | 2 | 70 | `All other Mages +15% score` | 8 |
| Lina | Mage | 2 | 75 | `×1.5 score while Mage ×1.25 synergy is active` | 4 |
| Invoker | Mage | 3 | 120 | `All Mages +30% score. Invoker's own base score becomes 0.` | 8 |
| Viper | Hunter | 1 | 45 | `+10 per round since bought` | 3 |
| Drow Ranger | Hunter | 1 | 42 | `+18 per other Hunter on board` | 2 |
| Windranger | Hunter | 2 | 78 | `Inactive rounds 1–5. From round 6+: +50% score.` | 6 |
| Sniper | Hunter | 3 | 125 | `+15 per round since bought (max +300)` | 3 |
| Lycan | Beast | 1 | 38 | `Counts as 2 Beasts for synergy` | 5 |
| Enchantress | Beast | 1 | 35 | `Selling returns +3g` | 7 |
| Lone Druid | Beast | 2 | 68 | `×1.5 score if 4+ Beasts on board` | 4 |
| Morphling | Beast | 3 | 115 | `Counts as +1 of any one species you have 3+ of` | 5 |
| Voidwalker | Demon | 1 | 60 | `×1.5 score if only Demon on board` | 4 |
| Shadow Fiend | Demon | 2 | 100 | `+25 per round since bought` | 3 |
| Terrorblade | Demon | 3 | 170 | `Rounds 1–9: ×0.5 score. Round 10+: ×2 score.` | 6+4 |

## Items

Attach to a unit; each unit has 3 slots. Permanent per run.

**Acquisition: not yet decided.** For prototype, start with none + debug-grant via CLI/UI.

| Item | Effect | Axis |
|---|---|---|
| Claymore | Unit's base score `+40` | 1 |
| Recurve Bow | Unit's scaling-per-round is doubled | 3-mod |
| Giant's Belt | `×2` at 1★, `×1.5` at 2★, `×1.2` at 3★ | 4 |
| Emblem of [Species] | Unit counts as `+1` of chosen species for synergy | 5 |
| Warmog's Armor | Unit's conditional passive bonuses are doubled | 2-mod |
| Zeke's Herald | Unit grants `+15% score` to all other units on board | 8 |
| Hextech Gunblade | Unit generates `+2g` per round while fielded | 7 |
| Last Whisper | Unit's round-timing passive activates 2 rounds earlier | 6-mod |
| Guinsoo's Rageblade | `+20 score` per round this unit has been on board (no cap) | 3 |
| Spear of Shojin | At round start, unit randomly counts as one species the player has ≥2 of | 5 |

## Augments

Player picks 1 of 3 at fixed rounds. **Trigger rounds: 3, 7, 12** (starting values, subject to playtest tuning).

| Augment | Effect | Axis |
|---|---|---|
| Heroic Resolve | All units `+25 base score` | 1 |
| Iron Will | Your conditional passives are doubled | 2 |
| Time Dilation | All units gain `+5 score/round since bought` | 3 |
| Exponential Growth | Multiplicative passives add `+25%` to their multiplier | 4 |
| Shapeshifter | Pick one unit: it permanently gains a species tag of your choice | 5 |
| Early Bird | Round-timing passives activate 3 rounds earlier | 6 |
| Midas Touch | Meta-effect passives doubled; reroll cost `−1g` | 7 |
| Hive Mind | Bench units count toward synergy thresholds | 5/8 |
| Overflow | `+1` permanent board slot (cap becomes 10) | structural |
| Tycoon | Interest payout is doubled | economy |

## Evaluation rules (for implementation)

- **"other X"** → count excludes self
- **"on board"** → excludes bench (same for synergy counts by default, except under Hive Mind)
- **"round since bought"** → increments each round the unit remains on board; resets on sell; preserved on bench→board movement (bench rounds do NOT count)
- **Multiplier stacking:** multiplicative (`×1.5 × ×1.25 = ×1.875`)
- **Flat stacking:** additive
- **Evaluation order per unit:** base → flat scaling (`Axis 3`) → flat conditionals (`Axis 2`) → synergy flats → multipliers (`Axis 4`) → board-level auras (`Axis 8`, applied externally). Round-timing (`Axis 6`) and item modifiers are pre-processed: they transform the passive before evaluation.
- **Item + Augment same-axis stacking:** currently multiplicative across sources (e.g. Warmog's + Iron Will on Axe = `×4` conditional). FLAG: almost certainly overtuned; cap to one source on first balance pass.

## Classes (2nd synergy axis)

Decided in principle, not yet designed. **v1 implementation: leave `class` field on each card stubbed (empty string or `null`).** Class tags + class synergies can be patched in as pure data without touching engine logic.

## Open / deferred

- Board positions (needed to unlock Axis 6 aura effects later)
- Class list + per-card class assignment + class synergy thresholds
- Item acquisition mechanic (round reward? augment? carousel?)
- Run end conditions — current assumption: HP-to-zero = run over; round cap TBD (default 30)
- Leaderboard / persistence (post-prototype)
- Real async matchmaking (post-prototype)
- Economy retune post-playtest (contention was an invisible gold sink; removing it = effectively more gold)

## Balance concerns — watch in playtest

- **Iron Will × Warmog's** on Axe-style conditional stackers: mathematically `×4`. Cap to one doubling source.
- **Early Bird × Last Whisper** on Terrorblade: activates round 5 (vs intended 10). Consider making these non-stacking.
- **Tycoon** interest doubling has no cost; may need a drawback.
- **Hive Mind** inverts the "bench doesn't count toward synergies" rule. Not a bug — but it means two different games depending on whether it's picked.
- **Giant's Belt** disincentivizes combining at 1★; could feel anti-fun. Watch.
- **Morphling** wording has edge cases: which species does it pick if tied 3+? Deterministic priority needed (suggest: alphabetical or first-acquired order).

## Proto-strategies (for AI policy targets + validation reference)

10 viable archetypes validated during design:

1. **Warrior Stack** (flex) — Axe/DK/Sven/Doom/Jugg · horizontal synergy + Doom aura
2. **Hunter Late-Scale** (flex) — Viper/Sniper/Shadow Fiend · Guinsoo/Recurve items · long-game
3. **Mage Glass Cannon** (flex) — Invoker/CM/Lina · Mage 4 multipliers
4. **Demon Arc** (flex) — Voidwalker early → Terrorblade late · pivot timing is the skill
5. **Econ Engine** (flex, improved by Midas) — Ogre Magi/Enchantress/Hextech · econ snowball
6. **Beast Flex** (flex) — Lycan/Lone Druid/Morphling · dual-synergy via count-flex
7. **Passive-Stack Warriors** (gated: Iron Will) — Axe/Warmog's · extreme vertical scaling
8. **Terrorblade Rush** (gated: Early Bird) — round-5 activation turns Terrorblade into mid-game bomb
9. **Bench-Wide Synergy** (gated: Hive Mind) — high-threshold synergies via bench counting
10. **2★ Rush** (flex) — Juggernaut-centric · prioritize combining over synergy count

Distribution: 7 flexible, 3 augment-gated. All 5 species represented across peak strategies. All 8 axes exercised.

## Files affected (implementation hand-off)

| File | Change |
|---|---|
| `src/cards.js` | Add `passive` (string + evaluator fn) and `classTag` (stub) per card |
| `src/board.js` | `calcScore` takes context `{round, player, boardState}`; applies passives in defined eval order |
| `src/shop.js` | Remove shared `Pool`. Replace with per-player weighted draw. Keep `Shop` class. |
| `src/game.js` | Replace `Lobby` with `Run` class. Add fake opponent generator. Add augment pick flow at rounds 3/7/12. |
| `src/sim.js` | Update greedy policy to value passives + current items + current augments. Add proto-strategy AI policies if useful. |
| **NEW** `src/items.js` | Item defs, attach/detach, slot management |
| **NEW** `src/augments.js` | Augment defs, pick flow, global-effect application |
| **NEW** `src/opponents.js` | Fake opponent board generator (round-appropriate stats) |

## Run structure (default starting values)

| Param | Value |
|---|---|
| Round cap | 30 |
| Augment picks at rounds | 3, 7, 12 |
| Battle pairing | random frozen submission from same round # (fake-generated in prototype) |
| Run end | HP ≤ 0, or round cap reached (final score = HP + tiebreak) |
