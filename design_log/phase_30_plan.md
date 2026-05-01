# Phase 30 — Plinth Composition

## Status
**Specced 2026-05-01. Implementation begins next session.**

Detailed spec for the fourth phase of the "Living Exhibition" redesign. Builds on
Phase 27 (judge spine) and Phase 28 (aesthetic tags). Audited against
`hicks-law-decision-optimization.md`, `synergy-thematic-design.md`, and
`game-design-methodology.md`.

---

## Diagnosis (Why This Phase Exists)

The Phase 27 vision named **curate** as the core verb, decomposed as
*read → hunt → arrange*. Phases 27–29 shipped the read (judges, slate reveal)
and the hunt (visible rival on a shared shop). The **arrange** sub-verb is
absent: the plinth is still a list. Order doesn't matter. Position doesn't
matter. The drag handle exists for moving cards from bench to active, not for
composition.

**Symptom:** the player buys a card, drops it on the plinth, and the moment of
"where does this go?" never happens. The promised crafting/combo dimension
(`synergy-thematic-design.md` 1+1>2) isn't reachable from the current data
model.

**Structural fix:** make the plinth a *composition*, not a list, by giving it
two new properties — adjacency and capacity.

> *Plan-file callback (phase_27_plan.md §"Curation as a Verb"):*
> *"Currently the plinth is a list. Make it a composition."*

---

## Goal

After Phase 30, every card placement on the plinth answers a real question:
**which two cards should sit next to each other, and why?**

Concretely:

1. Active board capped at 5. Smaller surface, denser decisions.
2. Adjacency effects on a subset of cards. Position changes score.
3. 6 explicit pair-combo cards. Putting cards X and Y next to each other yields
   a labeled bonus.
4. Live appraisal recalc: as the player drags a card to a new slot, the
   round-target preview updates in real time. This is the direct-feedback hook
   the core loop requires (`game-design-methodology.md` Phase 2).
5. Convert the 7 surviving legacy %-mult passives into adjacency-aware effects
   so they fire under judge mode again instead of being inert.

**Non-goals.** No new species, no new tastes, no judge personality work, no
economy changes. All deferred to Phase 31/32. This phase only changes how the
plinth scores and how the player composes it.

---

## Spec

### 1. Plinth cap: maxActive = 5

- `MAX_BOARD` in [src/game.js](src/game.js) is currently 10. Lower to 5.
- Plinth-upgrade unlocks (`AddPlinth`, level-driven `maxActive` bumps) cap at 5
  instead of 10. Player still pays the same gold to grow from 1→5 — the
  *progression* shape is unchanged, only the ceiling moves.
- Hick's Law check (n ≤ 5): a 5-slot board is in the optimum 3–6 band. The
  decision "where to slot this card" stays single-screen, no scrolling, no
  pagination.
- **Save-state migration:** any in-flight run with `maxActive > 5` truncates
  active down to the highest-scoring 5; the rest are sent to bench.
  Acceptable because the redesign is breaking compatibility anyway and
  unfinished runs aren't a contract.

### 2. Adjacency effects (new scoring stage)

Adjacency runs as **Stage 2.5** in `calcScoreBreakdown` and in
`calcBaseBreakdown` (judge mode), between the existing Stage 2 conditional
flats and Stage 3 species-synergy flats. New shape on the passive object:

```js
passive: {
  description: '+15 per adjacent off-species neighbor',
  axis: 'adjacency',
  evalAdjacent(self, leftNeighbor, rightNeighbor, ctx) {
    let bonus = 0;
    if (leftNeighbor  && leftNeighbor.species  !== self.species) bonus += 15;
    if (rightNeighbor && rightNeighbor.species !== self.species) bonus += 15;
    return { flat: bonus, label: 'cosmopolitan' };
  },
}
```

Constraints:
- Adjacency **only reads immediate left/right neighbors** on the active row.
  Slot index 0's left neighbor is `null`; slot 4's right neighbor is `null`.
  No wrap-around. Keeps the mental model: "edges score less."
- Adjacency bonuses are **flat additions to the card's own score** (Stage 2.5),
  not multipliers and not aura-style flats applied to others. Multipliers were
  the Phase 28 deprecation; we don't reintroduce them.
- Adjacency fires `firedPassives[i] = true` so the Eccentricity taste reads it.

### 3. Pair-combo cards (6)

Pair-combos are a stricter, named version of adjacency: a *specific* pair of
cards, when adjacent, yields a labeled bonus visible on both cards. These are
the 1+1>2 hooks (`synergy-thematic-design.md`).

| # | Pair | Trigger | Bonus | Theme hook |
|---|---|---|---|---|
| 1 | **Vorzak ↔ Slurvin** | Adjacent | +40 to each | "Two Livids escalate; judges score the tension." |
| 2 | **Lithvorn ↔ Geodorb** | Adjacent | +60 to each | Crystalline harmonics — both Crystalline. |
| 3 | **Molborg ↔ Sporvik** | Adjacent | +50 to each | Sporal feeding pair. |
| 4 | **Vexborg ↔ Clattorb** | Adjacent | +50 to each | Chitinous architecture. |
| 5 | **Squorble ↔ Stellorb** | Adjacent (R10+) | +120 to each | Late-game Abyssal coronation. |
| 6 | **Blorpax ↔ Vorbex** | Adjacent | +35 to each | Plasmic feedback loop. |

Why these 7 cards (not 12 unique): each pair re-uses an existing card, including
all 7 legacy %-mult cards from §5 below, so the conversion table in §5 is
covered by the same pair definitions. No new card data — only new passives on
existing entries.

Combo registry lives in `src/combos.js` (new). Each entry:

```js
{ a: 'Vorzak', b: 'Slurvin', bonus: 40, when: () => true, label: 'Twin Fury' }
```

`when(ctx)` lets Squorble↔Stellorb gate to round ≥ 10 without adding
combo-internal logic.

### 4. Live appraisal recalc

The drag-to-reorder UX has to *exist* before live recalc can hook into it. The
current `web/app.js` has no plinth drag listeners; only bench→active "moveToActive".

Implementation order:
1. Add HTML5 drag-and-drop on the active row's `[data-slot-index]` containers.
2. On `dragenter` of a target slot, **temporarily commit a board reorder** in
   memory, run `calcScoreBreakdown` against the upcoming round's judge ctx,
   and update a "live target preview" element in the HUD. Revert on `dragleave`
   if not dropped.
3. Debounce reorder previews to one recalc per animation frame
   (`requestAnimationFrame`) — 5 cards × ≤6 stages is cheap, but a recalc per
   `dragover` event would still spam.
4. On `drop`, the reorder commits permanently and triggers a normal `render()`.

UX safety (`hicks-law-decision-optimization.md` §"Validate Through Testing"):
the live preview must not auto-trigger when the player merely *clicks* a card.
Drag must travel ≥ 8px before preview kicks in, or it'll feel jittery.

### 5. Legacy %-mult passive conversion

These 7 cards ship with %-mult passives that are bypassed under judge mode
(Phase 28 known follow-up). Phase 30 converts each to either an
adjacency-aware effect, a pair-combo participant, or both.

| Card | Old passive (bypassed) | New behavior |
|---|---|---|
| **Vorzak** (Abyssal T1) | ×1.5 if only Abyssal on board | **Pair-combo with Slurvin** (+40 each); else +20 if no other Abyssal adjacent ("solo menace"). Adjacency-aware. |
| **Slurvin** (Plasmic T1) | +25%/2★+ unit | **Pair-combo with Vorzak** (+40 each); else +12 per adjacent unit of any species ("rage feeds on attention"). |
| **Molborg** (Sporal T2) | ×1.5 if Sporal-2 active | **Pair-combo with Sporvik** (+50 each); else +20 if any adjacent Sporal. |
| **Lithvorn** (Crystalline T2) | ×1.5 if 4+ Crystallines | **Pair-combo with Geodorb** (+60 each); else +25 per adjacent Crystalline. |
| **Vorbex** (Plasmic T2, locked) | ×1.5 if Plasmic-4 | **Pair-combo with Blorpax** (+35 each); else +18 if both neighbors are Plasmic. |
| **Squorble** (Abyssal T3) | R1–9 ×0.5, R10+ ×2.0 | R1–9: −30 flat penalty (still discourages early play). R10+: **pair-combo with Stellorb** (+120 each); else +50 if any adjacent Abyssal. |
| **Stellorb** (Abyssal T3, locked) | ×1.5 if Abyssal-4 + R16+ | **Pair-combo with Squorble at R10+** (+120 each, see Squorble). Otherwise +30 per adjacent Abyssal at R16+. |

Key property of the new effects: every conversion uses **flats**, not mults.
Stages 2.5/3 already work with flats. Conversion preserves the *flavor*
("Vorzak is meaner alone", "Lithvorn resonates with crystals nearby") while
fitting the post-Phase-27 scoring spine.

Card descriptions update to match. Flavor strings unchanged.

---

## Calibration

Calibration plan, run after the conversion table is wired:

1. **n=300 greedy survival, seed=1.** Target band 30–45% (per Phase 27/28
   precedent). If the new flats inflate baseline above 45%, scale all
   adjacency/combo flats by 0.8.
2. **Per-pair-combo trigger rate** in greedy logs: each combo should fire in
   ≥ 5% of runs and ≤ 25%. Below 5% means the pair is too rare to teach;
   above 25% means greedy stumbles into it without intent.
3. **Adjacency vs. order check:** simulate the same 5-card board in all 120
   permutations on a single judge. Best-vs-worst score gap ≥ 8% confirms
   "position matters." If the gap is < 5%, adjacency flats are too small.
4. **Hick's Law sanity:** record human reorder time on the new drag UI. If
   median reorder time > 12s on a 5-card board, the live preview isn't doing
   its job.

All four metrics ship in the design log entry for v0.48.

---

## Cuts / explicit non-goals

| Item | Verdict |
|---|---|
| Auras (×% to neighbors) | **No.** Reintroduces mono-stack pressure Phase 28 deprecated. |
| Range > 1 (skip-one neighbor) | **No.** Hick's Law: more positions to evaluate per slot kills the simplicity. |
| Wrap-around adjacency | **No.** Edges *must* score less; that's the composition tension. |
| New cards | **No.** Re-use existing 31 cards. New content is Phase 31+. |
| Drag-reorder bench → bench | **No.** Bench is unordered storage. |
| Drag while in scoring/augment phase | **No.** Only in `S.phase === 'shop'`. |

---

## Risks + open questions

- **R1 — Drag-reorder accessibility:** HTML5 DnD has long-standing usability
  issues (touch, keyboard). v0.48 ships mouse-only; touch/keyboard tracked as
  a follow-up, not a gate.
- **R2 — Live recalc performance under EarlyBird/morph items:** these branch
  inside passive eval and could cost a few ms per card. Should be fine at
  n=5 but worth profiling once and stopping if a single recalc exceeds 4ms.
- **R3 — Pair-combo discoverability:** if the player never reads card text,
  they'll never find these. Mitigation: when a pair becomes adjacent for the
  first time, briefly highlight both cards with the combo name. Defer
  visual polish to Phase 32 if it takes more than ~30 min in v0.48.
- **OQ1 — Squorble's R1–9 −30 penalty:** is this strong enough to keep early
  Squorble buys correctly disincentivized? Greedy sim will tell us; if greedy
  wants Squorble pre-R10 we widen to −50.
- **OQ2 — Should the Eccentricity taste read pair-combo fires the same way it
  reads passive fires?** Default: yes (sets `firedPassives[i] = true` for
  both pair members). Reconsider if Eccentricity inflates above the band.

---

## Files affected

- `src/game.js` — `MAX_BOARD` 10 → 5; level-driven `maxActive` cap.
- `src/board.js` — new Stage 2.5 in both `calcScoreBreakdown` and
  `calcBaseBreakdown`; calls into `combos.js`; reads passive `axis: 'adjacency'`.
- `src/cards.js` — passive rewrites for the 7 listed cards. No card additions.
- `src/combos.js` (new) — pair-combo registry + `findCombosOnBoard(active)` helper.
- `web/app.js` — drag-reorder handlers, live-preview HUD element, debounced
  recalc, drop-commit + render.
- `web/style.css` — slot drop-target highlight, combo-name flash on first
  adjacency, edge-slot dimming hint.
- `web/index.html` — version bump to v0.48; live-preview span in HUD.

Test surface: 66 legacy unit tests are still broken from Phase 27 — Phase 30
adds *new* unit tests for `combos.js` and adjacency math (target: 12 tests),
keeps the broken legacy suite alone. Full rewrite remains a Phase 32 chore.

---

## Reference audit

Files loaded for this spec:

| Reference | Used for | Resulting decision |
|---|---|---|
| `hicks-law-decision-optimization.md` | Plinth cap (5 in 3–6 band); reorder time target (12s median). | maxActive = 5; live preview must short-circuit drag jitter. |
| `synergy-thematic-design.md` | Pair-combos as 1+1>2 hooks; thematic flavor of each pair. | 6 pair-combos, each with a thematic label, all flats. |
| `game-design-methodology.md` | Direct-feedback requirement for the *arrange* sub-verb. | Live appraisal recalc is non-negotiable. |

References to load *during* Phase 30 implementation, not at spec time:

- `reinforcement-feedback-systems.md` — when wiring the combo-trigger flash
  (variable-reward-on-discovery pattern).
- `player-error-handling.md` — when handling drop-on-occupied-slot
  (swap vs. reject).

---

## Phase 30 → Phase 31 handoff

When v0.48 ships:
1. The "coasting loop" critique (DESIGN_LOG.md "v0.43 playtesting findings")
   is *not yet* addressed — that's Phase 31's economy fix.
2. Phase 31 should re-test calibration **after** Phase 30 lands; the new
   adjacency flats may invalidate Phase 28's 26.3% greedy survival baseline.
3. Item rewrites (tag-granters, judge-conditional items per phase_27_plan.md)
   stay deferred to Phase 31.
