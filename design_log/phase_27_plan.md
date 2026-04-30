# Phase 27+ — "The Living Exhibition" Redesign

## Status
**Specced 2026-04-30. Implementation begins next session via `/resume`.**

This plan supersedes the Phase 26 hidden-rival mechanic (kept in-tree until Phase 29 lands a replacement) and re-frames the long-term direction of the game. It was developed using the `game-design-skills` skill and stress-tested against four reference files (audit at the bottom of this doc).

---

## The Diagnosis (Why This Plan Exists)

Existing design log already establishes the problem: the game is a *score execution game* wearing the skin of a *strategy game*. Once a player identifies a working build, the remaining decisions are execution. The strategic surface area (judges, items, augments, classes, dead species) is reward decoration, not decision space.

Phase 26's market scarcity is a friction patch, not a structural answer. It removes cards without giving the player a *signal* to read or react to. Predicted result: small survival deltas, "ugh I missed it" moments, no change in the underlying execution loop. After 3–4 runs players adapt and the game reverts to the same shape.

**The structural fix:** make the question "what does *this salon want?*" — and answer it differently every run.

---

## Vision in One Sentence

**You are a curator chasing the shifting tastes of a fickle salon.** Each run's judges have different tastes, so the *correct collection is different*. The verb is **curate**, not **stack**.

---

## Core Loop (verb-based, audited against `game-design-methodology.md`)

```
Read judge taste → Hunt cards that match → Compose them on the plinth →
Watch the appraisal land → Transition to next judge → (loop)
```

**Verb:** *curate*. Specifically composed of three sub-verbs: **read**, **hunt**, **arrange**.

Loop requirements check:

| Requirement | How this loop satisfies it |
|---|---|
| Easy to understand | "What does this judge want? Build that." |
| Easy to operate | Drag-to-reorder on the plinth; click-to-buy in shop |
| Enjoyable in isolation | Reordering 5 cards and watching the appraisal recalculate live is the moment-to-moment fun |
| Direct feedback | **CRITICAL:** the appraisal must update *as you reorder*, not only on lock-in |
| Flexible | Different judge slates → different correct compositions |
| Extensible | New tastes, new tags, new run modifiers all plug into the same scoring channel |
| Combinable | Adjacency, pair-combos, and tag-stacking all compose |
| Evolvable | Foundation supports future content without retuning the core |

---

## The Spine: Judge-Driven Runs

### Run structure

- **At run start, the run's full judge slate is revealed.** 3 chapter judges + 1 Grand Finale judge.
- Each chapter is ~6 rounds, scored under that chapter's judge's *taste rule*.
- A judge isn't a small modifier — **the judge IS the scoring rule.** No "base score + judge bonus." Just judge.
- Between chapters: **Exhibition Refit** — a gold-sinked phase to swap/sell cards for the next judge's tastes.

### Tastes — the new mechanical vocabulary

Tastes replace flat species/class %-mults as the *primary* scoring axis. Starting taste pool (12, draw 4 per run):

| Taste | Wants | Hates | Mechanical hook |
|---|---|---|---|
| **Spectacle** | One enormous card | Even spreads | Highest single card ×3, others ×0.5 |
| **Diversity** | Each unique species/class | Mono-stacks | Per-unique-tag multiplier, duplicates score 0 |
| **Restraint** | Small collections | Crowded boards | Empty plinths bonus; ≤3 cards × 1.5 |
| **Eccentricity** | Conditional passives that fired | Clean stat sticks | Flag passives that fired this round; bonus per fire |
| **Narrative** | Old hands | Fresh buys | Bonus scales with rounds-on-board |
| **Grotesquerie** | Grotesque / Bizarre tags | Elegant | Tag-driven mult; favors Abyssal & Sporal |
| **Refinement** | Elegant / Restrained tags | Loud cards | Tag-driven mult; favors Crystalline |
| **Architecture** | Restrained / sturdy | Eccentric | Favors Chitinous |
| **Harmony** | Matching emotion-classes | Mixed moods | Class concentration bonus |
| **Discord** | All-different emotion-classes | Repeats | Anti-class-stack |
| **Ostentation** | High-tier, ostentatious tag | Quaint | Favors 3★ heavily |
| **Sentimentality** | Cards held longest, regardless of stats | Fresh buys | Old card flat bonus, ignores tier |

**Key property:** for every taste, *some species is best and some species is worst.* No species is universally good. Run-by-run dominance shifts.

---

## Cards Get Tags, Not Stack-Buffs

Every card carries:

- **Species** (existing — Abyssal, Sporal, Crystalline, Chitinous, Plasmic)
- **Emotion class** (existing — Livid, Pompous, Sullen, Shy, Giddy)
- **Tier** (existing — 1/2/3)
- **Aesthetic tags (NEW)** — Grotesque, Elegant, Bizarre, Restrained, Ostentatious, Quaint. Each card has 1–2.

Tag distribution principle: every species has a *home taste* and a *worst taste*. Each emotion class biases toward 1–2 tags. This is what kills dead species — they're not buffed, they're *re-homed*.

| Species | Native tags | Best under | Worst under |
|---|---|---|---|
| Abyssal | Grotesque, Ostentatious | Grotesquerie, Spectacle | Refinement |
| Sporal | Bizarre, Quaint | Eccentricity, Diversity | Refinement |
| Crystalline | Elegant, Ostentatious | Refinement, Ostentation | Grotesquerie |
| Chitinous | Restrained, Architecture | Architecture, Restraint | Spectacle |
| Plasmic | Bizarre, Ostentatious | Eccentricity, Spectacle | Sentimentality |

---

## Curation as a Verb: Plinth Composition

Currently the plinth is a list. Make it a composition.

- **Cap active board at 5 plinths.** Smaller than now (down from 7 max). Every slot matters → Hick's Law: small choice surface, dense decisions.
- **Adjacency effects.** Some cards score higher next to a different species; some pair-cards have explicit combo effects when adjacent.
- **Position matters.** Reordering on the plinth is a real action with a real outcome.
- **Live recalc.** As the player drags a card to a new slot, the Appraisal Value updates in real time. This is the direct-feedback hook the core loop needs.

Synergy/Thematic check: this is the **1+1>2** mechanic — pair-combos are the crafting/combo system the theme has been missing.

---

## The Visible Rival (Replacing Phase 26's Hidden One)

Phase 26 added scarcity but no signal. Cut it. Replace with:

- **One scripted AI exhibitor with a public board.** Visible at all times.
- **Shared shop:** 8 cards, both pick from it. Player picks first, rival picks second. 2 cards refresh per round.
- The rival has a **personality** drawn at run start: *Hoarder* (saves gold), *Magpie* (buys highest tier), *Specialist* (commits to one species), *Mimic* (buys what you bought last). Players learn to read these.
- **Crucially: the rival doesn't compete on score.** They are pure market pressure. Their board exists so you can predict their next pick and decide whether to grab a card now.
- **DDA hook (Buster Principle):** the rival's aggressiveness scales subtly with player performance. Struggling players (3+ chapter losses) get a less-targeted rival. Cruising players (perfect chapters) get a more aggressive rival that mimics their dominant species. Adjustments stay below the perception threshold (≤10% rate change). Audited against `dynamic-difficulty-adjustment.md`.

---

## Run Modifiers (Variance Multiplier)

At run start, draw 1 modifier from a pool of ~12. Examples:

- "Sporal cards halved this run."
- "Class synergies disabled; aesthetic tags doubled."
- "Every 3 rounds the lowest-scoring card is auto-sold."
- "All cards start at 2★."
- "No interest this run."
- "Shop is 3 cards instead of 5."
- "Judge slate is hidden until each chapter starts."
- "Grand Finale judge is randomized at R20."

Some constrain, some open new strategies. They are *random*, not *adaptive* — this is roguelike variance, not DDA. (Earlier draft confused these; reference audit caught it.)

Modifier × judge-slate combination space: ~12 × C(16,4) × 4 personalities ≈ 87,000 distinct run-shapes from a small content pool.

---

## The Economy Fix

Audited against `reinforcement-feedback-systems.md`:

- **Interest cap: max 5 gold/round.** Breaks coasting compounding. The save-vs-spend *decision* survives; the runaway *exploit* dies.
- **Exhibition Refit gold sink between chapters.** Hoarded gold has a *purpose* at chapter boundaries — buy a swap, buy a re-tier, buy a peek at the next judge.
- **Items become judge-aligned.** Items don't give flat % — they grant aesthetic tags, change tag-readings, or unlock during specific tastes. This converts items from *fixed rewards* to *context-variable rewards*, which the principle prefers.
- **Judges remain the variable-reward axis.** Same card scores differently per judge → encourages exploration and pattern-seeking.

---

## Theme Re-Alignment

Currently called "score." It's **Appraisal Value** — the sum of what *this judge* values.

- Failure isn't a loss; the salon **dismisses you**.
- Lives are **Reputation**.
- Judges get faces, names, quotes, attitudes. Players remember "Madame Vex hates symmetry" the way Spire players remember Act 3 Elites.
- **Audit (synergy-thematic-design.md):** confirm art/audio direction also serves curation, not combat. Any aggressive SFX or combat-style UI must be reskinned. Flagged for Phase 32.

---

## What Gets Cut

| System | Verdict | Why | Replacement |
|---|---|---|---|
| Phase 26 hidden rival flags | **Cut** | No signal, no strategy | Visible rival (Phase 29) |
| Flat species/class %-mults as primary scoring | **Cut** | Cause of mono-stack dominance | Judge tastes |
| AccliLog / AccliProg escalating items | **Cut** | Coasting enablers; redundant with capped interest | Tag-granting items |
| Per-round flat target curve recalibration | **Simplified** | Targets become judge-relative | Per-judge thresholds |
| Achievement progress bars | **Keep** | Still motivating | Re-tier rewards toward modifier/judge unlocks |
| Curator's gifts | **Keep, expand** | These are tiny tastes already; promote them | Rolled into judge personalities |
| Cards with universally-good auras (Sporal +10%) | **Rewritten** | Mono-stack enablers | Tag-givers or judge-conditional |
| Dead-species buffs | **Cut** | Buffing won't fix dead paths | Each species gets a tasteful home |

---

## Phased Rollout

Each phase independently shippable. The game must be playable after each.

| Phase | Scope | Validates |
|---|---|---|
| **27 — Judge Spine** | Replace 4-judge slate with full judge-driven scoring. Cut flat target curve. Ship 6 starter tastes. | Does taste-driven scoring create the "different run" feel? |
| **28 — Aesthetic Tags** | Tag every card. Add 4 tag-reading tastes. Retire redundant species %-mults. | Do tags make Chitinous/Crystalline situationally dominant? |
| **29 — Visible Rival** | Replace hidden flags with public-board AI rival. 4 personalities. Shared 8-card shop. Buster-principle aggressiveness. | Does scarcity-with-signal create real shop tension? |
| **30 — Plinth Composition** | Cap board at 5. Add adjacency. Add 6 pair-combo cards. Live appraisal recalc on reorder. | Does positioning become a real decision? |
| **31 — Run Modifiers + Economy** | 12 modifiers (1/run). Interest cap 5/round. Exhibition Refit gold sink. | Does run-to-run variance hold up over 20+ runs? |
| **32 — Theme Pass** | Rename score → Appraisal Value, lives → Reputation. Judge portraits + quotes. Art/audio audit. | Does the narrative weight click? |

---

## Phase 27 Detailed Spec (Implementation Starts Here)

### Goal
Replace the existing scoring pipeline with judge-driven scoring. Ship 6 starter tastes.

### Data structures

```js
// src/judges.js — new file
const TASTES = {
  spectacle: {
    name: 'Spectacle',
    flavor: 'A single triumph dwarfs the rest.',
    score: (board, ctx) => {
      const sorted = [...board].sort((a,b) => b.baseScore - a.baseScore);
      return sorted[0].baseScore * 3 + sorted.slice(1).reduce((s,c) => s + c.baseScore * 0.5, 0);
    }
  },
  diversity:    { /* ... */ },
  restraint:    { /* ... */ },
  eccentricity: { /* ... */ },
  narrative:    { /* ... */ },
  harmony:      { /* ... */ },
};

const JUDGES = [
  { id: 'vex',    name: 'Madame Vex',     taste: 'spectacle',   chapter: 'any', flavor: 'One brilliant specimen, or none at all.' },
  { id: 'thorne', name: 'Curator Thorne', taste: 'diversity',   chapter: 'any', flavor: 'Variety is the soul of the salon.' },
  // 10 more, drawing from the 12 tastes; some judges share a taste with different flavor.
];
```

### Run object changes

```js
run.judgeSlate = [judgeId, judgeId, judgeId, judgeId];  // chapters 1-3 + finale
run.currentChapter = 0; // 0..3
run.currentJudge = () => JUDGES[run.judgeSlate[run.currentChapter]];
```

### Scoring pipeline

`board.scoreBoard(run)`:
1. Compute each card's `baseScore` (existing pipeline up through Stage 1; species/class %-mults at stages 4a/4b are *bypassed* in Phase 27 — kept in code, marked deprecated).
2. Pass `board` to `currentJudge().taste.score(board, ctx)`.
3. Return single Appraisal Value.

### Migration / safety

- Keep existing `scoreRound` working under a `useJudgeScoring` flag, default `true` for new runs.
- All existing cards still load and render; their old %-mult passives are ignored at scoring time.
- Existing 66 unit tests will need rewrites — accept this. New tests target taste-rule outputs.
- Sim (`src/sim.js`) needs `runGame` updated to read judge slate and produce per-chapter survival rates instead of per-round.

### Done criteria for Phase 27

- [ ] 6 tastes implemented and unit-tested.
- [ ] Run start UI shows the 4-judge slate with names + flavor + taste hint.
- [ ] Chapter transition modal shows the next judge.
- [ ] Greedy sim survival baseline re-established (target: 30–45% on Standard, similar bands to current).
- [ ] No species/class %-mults applied at scoring time (verified by sim).
- [ ] Browser-verified: a 24-round run completes with judge-driven scoring, scores feel meaningfully different across chapters.

### Out of scope for Phase 27

- Aesthetic tags (Phase 28).
- Visible rival (Phase 29).
- Plinth composition / adjacency (Phase 30).
- Run modifiers / economy fix (Phase 31).
- Theme rename (Phase 32).

---

## Skill Audit Appendix

This plan was developed using `game-design-skills` and stress-tested against four reference files. What each contributed:

| Reference | Contribution to plan |
|---|---|
| `game-design-methodology.md` | Forced explicit verb identification (curate). Drove the "loop requirements" table. Caught missing direct-feedback hook → added live appraisal recalc on reorder. |
| `synergy-thematic-design.md` | Validated theme/mechanic alignment. Drove the rename (Appraisal Value, Reputation). Pair-combo cards = the 1+1>2 mechanic. Flagged art/audio audit for Phase 32. |
| `reinforcement-feedback-systems.md` | Reframed judge-tastes as *context-variable rewards* (stronger pattern than fixed %-mults). Validated Continue model for lives. Confirmed Exhibition Refit as a healthy gold sink. |
| `dynamic-difficulty-adjustment.md` | **Caught a misclassification** — earlier draft called run modifiers "DDA"; they're random variance, not adaptive. Real DDA hook is rival aggressiveness, kept ≤10% perception threshold. |

Other principles applied at top level: 80/20 (judges become the spine because they're the engaging 20%); Hick's Law (board cap 5, judge slate 4, modifier 1); Triangularity (tag system creates genuine alternate paths); Flow (variance on the *novelty* axis, not the difficulty axis).

References *not* yet consulted; load if these phases hit friction:
- `flow-state-design-framework.md` — if difficulty pacing across chapters feels off
- `experience-pacing-structure.md` — if the chapter rhythm needs work
- `visual-player-guidance.md` — Phase 32 art audit
- `hicks-law-decision-optimization.md` — Phase 30 plinth UI
- `player-psychology-decisions.md` — when designing the rival's predictability/legibility
