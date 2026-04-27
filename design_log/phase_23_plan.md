# Phase 23 — Unlock System

## Why this change

After clearing Elite difficulty there is no compelling reason to replay. All content is available from run 1, so there is nothing to discover or work toward. The meta-game Motivation gap is the root cause — not content volume.

This phase builds an **unlock system** that gates a small batch of new content behind run achievements. Each achievement describes a build strategy the player may not have tried, so unlocking feels like discovery rather than grinding. New content added here becomes a template for Phase 24 (card expansion), which will add more pieces to the unlock pool.

**Design principle:** all existing content stays available from run 1. Nothing is taken away. Only new content is gated.

---

## New content (locked by default)

Five pieces shipped in this phase. All are unreachable until their achievement fires.

### New augments

**"Deep Roots"** — `id: deep_roots`  
*"Specimens held for 10+ rounds score +15% of their current flat score as a bonus."*  
- Axis: per-card mult applied at Stage 4 when `card.roundsSinceBought >= 10`  
- Rewards the Patient Collection archetype (already detected in `detectArchetypes()`)  
- Distinct from Acclimatisation Log (flat accumulation vs % bonus for long-timers only)

**"Curator's Eye"** — `id: curators_eye`  
*"Each 3★ specimen on your active board grants +5% to all scores."*  
- Axis: global mult += 0.05 per 3★ active card at Stage 4  
- Rewards Star Collector archetype  
- Complements Rarity Certificate (item, raises base score for T2/T3 cards) without duplicating it

### New judge

**Vrethix** — `id: vrethix`  
*"Prefers exhibitions demonstrating emotional range."*  
- Preference condition: 3+ class synergies active simultaneously → preferred target (−15%)  
- Chapter assignment: eligible for any chapter (no Ch1 restriction needed — 3 class synergies is achievable early)  
- Curator's Selection gift: Cross-Pollination augment (already exists, fits the preference)  
- Implementation note: qualify check uses `effectiveClassCounts` same as Yorzal

### New items

**"Prestige Tag"** — `id: prestige_tag`  
*"+12 flat per active class synergy threshold on equipped specimen."*  
- Axis: Stage 1 flat — counts `effectiveClassCounts` thresholds met (each bracket = +12)  
- Rewards class-heavy builds; parallels Bloom Stimulant (which rewards species synergies with mult)  
- Max value: +60 flat (5 class thresholds) — reasonable ceiling

**"Collector's Mark"** — `id: collectors_mark`  
*"+8 flat per combined (2★ or 3★) specimen active on the board."*  
- Axis: Stage 1 flat — counts `board.activeCards.filter(c => c.stars > 1).length * 8`  
- Rewards combining; distinct from Rarity Certificate (which raises base score for T-tier, not star level)  
- Max value at 7 active: +56 flat

---

## Achievement definitions

Five achievements, one unlock each. Conditions evaluate at run-end from `run.stats` (see Technical Spec).

| ID | Name | Condition | Unlock |
|----|------|-----------|--------|
| `emotional_range` | Emotional Range | 3+ class synergies active simultaneously (any round) | Judge Vrethix |
| `patient_collector` | Patient Collector | Reach Round 16 with 3+ cards held 10+ rounds uninterrupted | Deep Roots augment |
| `star_collector` | Star Collector | Have 2+ 3★ cards active simultaneously (any round) | Curator's Eye augment |
| `crystal_formation` | Crystal Formation | Activate Crystalline-4 synergy and survive to Round 12 | Prestige Tag item |
| `well_rounded` | Well Rounded | Have all 5 species represented on active board simultaneously (any round) | Collector's Mark item |

**Achievement design rationale:**
- `emotional_range` — teaches class-focused builds; accessible after 1–2 runs of awareness
- `patient_collector` — teaches holding cards vs churning; counters "always sell" habit
- `star_collector` — teaches committing to combines; 2× 3★ requires planning
- `crystal_formation` — specifically encourages the Crystalline dead path, reinforcing the Phase 22 buff
- `well_rounded` — teaches species diversity; Collective Resonance preference already nudges this

All achievable on Standard difficulty.

---

## Technical spec

### `run.stats` (new field on `Run`)

Track achievement-relevant counters during play. Updated in `runBattle()` after `calcScoreBreakdown()` — board state is available there.

```javascript
// Initial value in Run constructor:
this.stats = {
  maxClassSynergiesActive: 0,   // peak simultaneous class synergy thresholds hit
  maxCrystallineActive: 0,      // peak crystalline card count on active board
  allSpeciesRepresented: false, // ever had all 5 species active simultaneously
  maxTripleStarsActive: 0,      // peak count of 3★ cards on active board
  // longTermCards derived at check-time from final board + battleHistory
};
```

Update each field in `runBattle()`:
```javascript
const classCount = Object.values(effectiveClassCounts(board)).filter(c => c >= minThreshold).length;
run.stats.maxClassSynergiesActive = Math.max(run.stats.maxClassSynergiesActive, classCount);
// ...etc
```

`longTermCards` (for `patient_collector`): at check time, count `board.activeCards` where `card.roundsSinceBought >= 10`. This is already tracked on cards — no new state needed.

### `src/achievements.js` (new file)

```javascript
export const ACHIEVEMENTS = [/* see above table */];
export function evaluateAchievements(run) { /* returns newly-unlocked achievement objects */ }
export function getUnlocks() { /* reads localStorage */ }
export function addUnlock(rewardId) { /* writes localStorage */ }
export function isUnlocked(rewardId) { /* boolean */ }
```

localStorage key: `alien-exhibition-unlocks`  
Format: JSON array of reward IDs, e.g. `["vrethix", "deep_roots"]`

### Pool filtering

Four call sites need filtering. Use the lightest possible touch — just filter the source arrays.

| File | Change |
|------|--------|
| `src/augments.js` | Add `locked: true` to new augments; export `getAvailableAugments()` that filters by `isUnlocked` |
| `src/items.js` | Add `locked: true` to new items; export `getAvailableItems()` that filters by `isUnlocked` |
| `src/game.js` | `_assignJudges()` filters `HEAD_JUDGES` by `isUnlocked` (Vrethix starts filtered) |
| `src/sim.js` | `resolveAugmentPick` / `resolveItemPick` use `getAvailableAugments()` / `getAvailableItems()` |

**Edge case:** offer generation draws n-of-3 from pool. If filtered pool has < 3 entries, offer all available. Guard this in augment/item offer functions — already needed for small early-game pools.

### Achievement evaluation timing

In `src/game.js`, after `recordRun()`:
```javascript
const newUnlocks = evaluateAchievements(run);
newUnlocks.forEach(a => addUnlock(a.reward.id));
// pass newUnlocks to showGameOverModal for display
```

### UI

**Game-over modal** — append an "Unlocked!" section when `newUnlocks.length > 0`. Each entry shows the reward name and a one-line description. Below existing Exhibition Rating block.

**Collection panel** — button on splash screen ("Collection") opens a modal listing:
- Locked achievements: name + condition (no reward spoiler — show "???" until unlocked)
- Unlocked achievements: name + condition + what was unlocked  
- Persistent across sessions via localStorage

---

## Implementation phases

### 23-A — Infrastructure
1. Create `src/achievements.js` with `ACHIEVEMENTS`, `evaluateAchievements()`, `getUnlocks()`, `addUnlock()`, `isUnlocked()`
2. Add `run.stats` to `Run` constructor; update fields in `runBattle()`
3. Wire `evaluateAchievements()` call in `game.js` post-run
4. Add `locked` flag + `getAvailableAugments()` / `getAvailableItems()` to augments.js / items.js
5. Filter judge pool in `_assignJudges()`
6. Smoke test: manually call `addUnlock('deep_roots')` via browser console, verify it appears in augment offers next run

### 23-B — New content
1. Add Deep Roots and Curator's Eye to `src/augments.js` (locked)
2. Add Vrethix to `HEAD_JUDGES` in `src/game.js` (locked)
3. Add Prestige Tag and Collector's Mark to `src/items.js` (locked)
4. Run `node run.js balance 300 42` — verify baseline survival is unchanged (locked content excluded from pool, no net effect on greedy policy)
5. Manually unlock all five, re-run balance — note ceiling shift for new items/augments; flag anything >8pp above baseline per Phase 20-A exploit threshold

### 23-C — Achievement conditions
1. Implement all five `check()` functions in `ACHIEVEMENTS`
2. Unit-test each check manually: set up `run.stats` by hand, verify expected true/false
3. Test `patient_collector` specifically — requires checking `card.roundsSinceBought >= 10` at run end; verify this survives combines (Phase 13 fix carried `roundsSinceBought` correctly)

### 23-D — UI
1. Game-over modal unlock section (only shown when `newUnlocks.length > 0`)
2. Splash "Collection" button + panel modal
3. Version bump to v0.33

---

## Files affected

| File | Change |
|------|--------|
| `src/achievements.js` | NEW |
| `src/augments.js` | `locked` flag on new augments; `getAvailableAugments()` export |
| `src/items.js` | `locked` flag on new items; `getAvailableItems()` export |
| `src/game.js` | `run.stats` tracking; `evaluateAchievements()` call; `_assignJudges()` filter; Vrethix entry |
| `src/sim.js` | Use `getAvailableAugments()` / `getAvailableItems()` in offer resolution |
| `src/balance.js` | Same — use filtered pools |
| `web/app.js` | Game-over unlock section; Collection panel |
| `web/index.html` | Collection button on splash |
| `web/style.css` | Unlock section styling |

---

## Out of scope for Phase 23

- Card unlocks (Phase 24 — card expansion)
- Achievement progress bars / partial-completion tracking mid-run
- Cross-run streak achievements (e.g. "clear critiques 3 runs in a row")
- Any achievement requiring RNG-dependent setups (e.g. "get a specific augment offer") — ruled out by design principle
