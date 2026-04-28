# Phase 25 — Fill TBD Locked Content (Step 3 of production plan)

**Status:** Ready to implement. Design approved 2026-04-28.  
**Target version:** v0.39  
**Prerequisite:** Read `design_log/balance_principles.md` before touching any numbers.

---

## What this phase adds

9 new achievement + reward slots, bringing the total from 13 to 22. All new content is locked (excluded from sim pools until achievement fires). Adds:
- 2 new cards (Vorbex, Omnorb)
- 4 new augments (grand_specimen, class_harmony, apex_showcase, mastery_protocol)
- 2 new items (veterans_plinth, prestige_circuit)
- 1 new judge (Sormax)

---

## Achievement definitions (9 new entries for `ACHIEVEMENTS` in `src/achievements.js`)

### Species master (1 missing)

```js
{
  id: 'plasmic_master',
  name: 'Plasma Master',
  condition: 'Win 25 rounds with 4+ Plasmic specimens active',
  target: 25,
  conditionMet: (board, cls, spc) => (spc.Plasmic || 0) >= 4,
  reward: { id: 'vorbex', type: 'card', name: 'Vorbex' },
},
```

### Class devotee (1 missing)

```js
{
  id: 'pompous_devotee',
  name: 'Pompous Devotee',
  condition: 'Win 15 rounds with 2+ Pompous specimens active',
  target: 15,
  conditionMet: (board, cls) => (cls.Pompous || 0) >= 2,
  reward: { id: 'grand_specimen', type: 'augment', name: 'Grand Specimen Program' },
},
```

### Archetype achievements (5)

```js
{
  id: 'emotional_virtuoso',
  name: 'Emotional Virtuoso',
  condition: 'Win 25 rounds with 3+ class synergies simultaneously active',
  target: 25,
  conditionMet: (board, cls, spc, ctx) => (ctx.activeClassSynergyCount || 0) >= 3,
  reward: { id: 'class_harmony', type: 'augment', name: 'Class Harmony' },
},
{
  id: 'patient_master',
  name: 'Patient Master',
  condition: 'Win 25 rounds with 4+ cards held 10+ rounds',
  target: 25,
  conditionMet: (board) => board.active.filter(c => (c.roundsSinceBought || 0) >= 10).length >= 4,
  reward: { id: 'veterans_plinth', type: 'item', name: "Veteran's Plinth" },
},
{
  id: 'star_curator',
  name: 'Star Curator',
  condition: 'Win 25 rounds with 3+ active 3★ specimens',
  target: 25,
  conditionMet: (board) => board.active.filter(c => c.stars === 3).length >= 3,
  reward: { id: 'apex_showcase', type: 'augment', name: 'Apex Showcase' },
},
{
  id: 'late_game_collector',
  name: 'Late Game Collector',
  condition: 'Win 20 Chapter 3 rounds (rounds 17–24)',
  target: 20,
  conditionMet: (board, cls, spc, ctx) => (ctx.round || 0) >= 17,
  reward: { id: 'sormax', type: 'judge', name: 'Appraiser Sormax' },
},
```

### Difficulty achievements (3)

```js
{
  id: 'discerning_graduate',
  name: 'Discerning Graduate',
  condition: 'Win 15 rounds on Discerning difficulty or harder',
  target: 15,
  conditionMet: (board, cls, spc, ctx) => (ctx.diffMult || 1) >= 1.12,
  reward: { id: 'prestige_circuit', type: 'item', name: 'Prestige Circuit' },
},
{
  id: 'elite_curator',
  name: 'Elite Curator',
  condition: 'Win 10 rounds on Elite difficulty',
  target: 10,
  conditionMet: (board, cls, spc, ctx) => (ctx.diffMult || 1) >= 1.25,
  reward: { id: 'mastery_protocol', type: 'augment', name: 'Mastery Protocol' },
},
{
  id: 'grand_survivor',
  name: 'Grand Survivor',
  condition: 'Win 5 Grand Finale rounds (Round 24)',
  target: 5,
  conditionMet: (board, cls, spc, ctx) => (ctx.round || 0) === 24,
  reward: { id: 'omnorb', type: 'card', name: 'Omnorb' },
},
```

---

## Infrastructure change: extend `incrementAchievementCounters`

The 4th `ctx` argument must be passed from `game.js`. Update the function signature:

```js
// achievements.js
function incrementAchievementCounters(board, classCounts, passed, ctx = {}) {
  if (!passed) return [];
  // ... rest unchanged, but pass ctx as 4th arg to conditionMet:
  if (!ach.conditionMet(board, classCounts, speciesCounts, ctx)) continue;
```

Update the call site in `src/game.js` (in `runBattle()`, where `incrementAchievementCounters` is called):

```js
// Compute active class synergy count for emotional_virtuoso
const activeClassSynergyCount = Object.keys(CLASS_SYNERGIES).filter(cls =>
  CLASS_SYNERGIES[cls].getBonus((classCounts[cls] || 0))
).length;

const newlyUnlocked = incrementAchievementCounters(board, classCounts, passed, {
  round: run.round,
  diffMult: run.diffMult || 1,
  activeClassSynergyCount,
});
```

Note: `CLASS_SYNERGIES` is already imported in `game.js`. `classCounts` comes from `effectiveClassCounts(board).counts` — check the existing call pattern in `runBattle()` and reuse.

No circular dependency risk: achievements.js does not import cards.js; the class synergy count is computed in game.js before being passed in.

---

## New content specs

### Cards (add to `src/cards.js` in the Phase 24 locked section)

```js
{
  id: 'vorbex',
  name: 'Vorbex', species: 'Plasmic', class: 'Sullen', tier: 2, baseScore: 84, locked: true,
  flavor: 'Vorbexes are essentially very confident plasma. Individually they do little. Surrounded by enough of their kin, something extraordinary — and frankly unsettling — occurs.',
  passive: {
    description: '×1.5 score if Plasmic-4 synergy active',
    axis: 4,
    eval(card, ctx) {
      return { mult: (ctx.speciesCounts.Plasmic || 0) >= 4 ? 1.5 : 1 };
    },
  },
},
{
  id: 'omnorb',
  name: 'Omnorb', species: 'Abyssal', class: 'Shy', tier: 3, baseScore: 128, locked: true,
  flavor: 'Omnorbs have adapted to survive in any atmospheric condition. Judges describe their presence as "a reminder that the galaxy does not care about your strategy."',
  passive: {
    description: '×1.8 score if 4+ unique species on active board',
    axis: 4,
    eval(card, ctx) {
      const uniqueSpecies = new Set(ctx.boardState.active.map(c => c.species)).size;
      return { mult: uniqueSpecies >= 4 ? 1.8 : 1 };
    },
  },
},
```

Update the class distribution comment in `src/cards.js` to include Vorbex under Sullen and Omnorb under Shy.

### Augments (add to `src/augments.js`)

```js
{
  id: 'grand_specimen', name: 'Grand Specimen Program',
  description: 'All T3 specimens gain +30 base score (before star multiplier)',
  axis: 1,
  locked: true,
},
{
  id: 'class_harmony', name: 'Class Harmony',
  description: '+12% global score multiplier per active class synergy beyond the first',
  axis: 'global',
  locked: true,
},
{
  id: 'apex_showcase', name: 'Apex Showcase',
  description: '3★ specimens score ×1.2 (multiplicative bonus)',
  axis: 4,
  locked: true,
},
{
  id: 'mastery_protocol', name: 'Mastery Protocol',
  description: 'All multiplicative passives (Axis 4, 6, 6+4) gain +0.1 to their multiplier',
  axis: 4,
  locked: true,
},
```

### Items (add to `src/items.js`, alongside prestige_tag and collectors_mark)

```js
{ id: 'veterans_plinth', name: "Veteran's Plinth",
  description: '×1.3 score if this specimen has been held 15+ rounds', axis: 4, locked: true },
{ id: 'prestige_circuit', name: 'Prestige Circuit',
  description: '×1.2 score (no condition required)', axis: 4, locked: true },
```

### Judge (add to `HEAD_JUDGES` in `src/game.js`)

```js
{
  id: 'sormax',
  name: 'Appraiser Sormax',
  preference: 'Rewards long-term dedication to specimens',
  qualifyingHint: '4+ cards held 10+ rounds',
  locked: true,
  qualifies: (board) => board.active.filter(c => (c.roundsSinceBought || 0) >= 10).length >= 4,
},
```

Add to `CURATOR_SELECTIONS`:
```js
sormax: { type: 'item', id: "Guinsoo's Rageblade" },   // Acclimatisation Log
```

---

## Board pipeline hooks (`src/board.js`)

Read board.js before implementing — these are approximate insertion points, verify exact stage structure.

**grand_specimen** — Stage 0 (base score), alongside HeroicResolve:
```js
if (hasAugment(augments, 'grand_specimen') && card.tier === 3) base += 30;
```

**apex_showcase** — Stage 4b (per-card mult), alongside ExponentialGrowth:
```js
if (hasAugment(augments, 'apex_showcase') && card.stars === 3) cardMult *= 1.2;
```

**mastery_protocol** — Stage 4b (per-card mult), alongside ExponentialGrowth:
```js
if (hasAugment(augments, 'mastery_protocol') &&
    ['4', '6', '6+4'].includes(String(passive.axis))) {
  multBonus += 0.1;  // added to the same multBonus that ExponentialGrowth uses
}
```

**class_harmony** — Stage 4b (global mult), after per-card loop:
```js
if (hasAugment(augments, 'class_harmony')) {
  const activeSynCount = Object.keys(CLASS_SYNERGIES).filter(cls =>
    CLASS_SYNERGIES[cls].getBonus(effectiveClassCounts(board).counts[cls] || 0)
  ).length;
  globalMult *= 1 + Math.max(0, activeSynCount - 1) * 0.12;
}
```
Note: board.js already imports `CLASS_SYNERGIES` and `effectiveClassCounts` — check the import list.

**veterans_plinth** — Stage 4 (per-card item check), alongside Rarity Certificate:
```js
if (hasItem(card, 'veterans_plinth') && (card.roundsSinceBought || 0) >= 15) cardMult *= 1.3;
```

**prestige_circuit** — Stage 4 (per-card item check):
```js
if (hasItem(card, 'prestige_circuit')) cardMult *= 1.2;
```

---

## Unit tests (`src/test_achievements.js`)

Add tests for each new `conditionMet`. Minimum coverage:
- plasmic_master: spc.Plasmic = 3 (false), 4 (true)
- pompous_devotee: cls.Pompous = 1 (false), 2 (true)
- emotional_virtuoso: activeClassSynergyCount = 2 (false), 3 (true)
- patient_master: 3 cards with roundsSinceBought ≥ 10 (false), 4 (true)
- star_curator: 2 stars=3 active (false), 3 (true)
- late_game_collector: round 16 (false), 17 (true)
- discerning_graduate: diffMult 1.0 (false), 1.12 (true), 1.25 (true)
- elite_curator: diffMult 1.12 (false), 1.25 (true)
- grand_survivor: round 23 (false), 24 (true)

---

## Balance checks (post-implementation)

All new content is locked by default — sim baseline is unaffected. After implementation:

1. Run `node run.js balance 300 42` — confirm greedy survival unchanged.
2. Force-unlock all new content, re-run exploit sweep (`node run.js exploit 200 42`).
3. **Watch especially:**
   - `class_harmony` with 4–5 class synergies active — could approach exploit threshold
   - `prestige_circuit` (unconditional ×1.2) — first unconditional mult item, check stacking
   - `mastery_protocol` on Axis-6 cards (Clattorb ×1.5→×1.6, Grazwick ×1.8→×1.9, Squorble ×2.0→×2.1)
   - `omnorb` — check whether it turbocharges The Collective path past the ceiling
4. If any reward exceeds +8pp above greedy: reduce the magnitude, not the unlock condition.

---

## Files affected

| File | Change |
|---|---|
| `src/achievements.js` | 9 new entries; `incrementAchievementCounters` adds `ctx = {}` 4th arg; pass `ctx` to `conditionMet` |
| `src/cards.js` | Vorbex (T2 locked), Omnorb (T3 locked); update class distribution comment |
| `src/augments.js` | grand_specimen, class_harmony, apex_showcase, mastery_protocol (all locked) |
| `src/items.js` | veterans_plinth, prestige_circuit (both locked) |
| `src/game.js` | sormax in HEAD_JUDGES + CURATOR_SELECTIONS; update `incrementAchievementCounters` call with ctx |
| `src/board.js` | Pipeline hooks for all 4 new augments + 2 new items |
| `src/test_achievements.js` | 9 new test cases (min 2 each = 18 new assertions) |
| `web/index.html` | Version bump to v0.39 |

No changes needed to `web/app.js` or `web/style.css` — the achievement UI (collection modal, game-over unlock section) already handles arbitrary reward types (card/augment/item/judge).

---

## Implementation order

1. `src/achievements.js` — add 9 entries + ctx arg (infrastructure first, no content yet)
2. `src/game.js` — update call site with ctx computation
3. `src/test_achievements.js` — add new tests, run all 47+18 = ~65 expected passing
4. `src/cards.js` — Vorbex + Omnorb
5. `src/augments.js` — 4 new augments
6. `src/items.js` — 2 new items
7. `src/game.js` — Sormax judge
8. `src/board.js` — pipeline hooks for all new augments + items
9. Balance check: `node run.js balance 300 42` (baseline unchanged), then force-unlock + exploit sweep
10. Version bump + commit
