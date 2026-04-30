---
name: Phase 7 completion state
description: Phase 7 (AI policy refresh + cleanup) completed; sim winrate, architecture, and what changed
type: project
---

Phase 7 is complete. All 9 src/ files committed and stable through Phase 6; Phase 7 adds:

**sim.js** — full rewrite of greedy policy:
- `optimizeBoard`: item-carrier protection (500-pt bonus prevents bench eviction)
- `scoreAugment`: fixed bug (`bestScore = score` → `bestScore = s`); added `_augmentBias` support
- `scoreBuyCandidate`: context-aware buy scorer (axis, augments, items, shapeshifter species counts)
- `buyBestCard`: helper, enables clean buy loops
- `greedyCore`: shared economy core (interest-save Tycoon-aware, XP cap L7, Midas 3× rerolls)
- New policies: `warrior-stack` (Warrior+Axis-2 bias, IronWill/HeroicResolve augment pref), `demon-arc` (Demon+Axis-4, ExpGrowth/EarlyBird/Overflow pref)
- `runGame`: passes `nextRound` to policy, wires `_augmentBias` per strategy

**Dead-code removed:**
- `POOL_SIZES` from cards.js (was exported, never imported)
- `shuffle` from utils.js (was exported, never used)

**Sim results (200 seeds, greedy):** 59.8% per-battle winrate — within 45–70% target. No opponent retune needed.

**Why:** Per design_log/async_redesign_plan.md §Phase 7.
**How to apply:** Phase 8 does not exist yet — await direction before starting new work.
