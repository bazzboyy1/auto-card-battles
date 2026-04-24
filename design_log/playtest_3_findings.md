# Playtest 3 — Findings & Phase 15 Plan

**Date:** 2026-04-24
**Context:** External playtesting (5 testers: Damo, Elric, James, Jen, Kai, Will) via GitHub Pages / Netlify after all UX passes (Phase 10–14), scoring animation (Phase 11), and ranking-meta prep.

---

## Findings

**Build performance:** All 4 testers who finished completed all 30 rounds. Nobody lost a run. Difficulty is too easy — opponents plateau while player scores compound multiplicatively.

| Tester | Record | Final Rep | Level |
|--------|--------|-----------|-------|
| Jen | 30W 0L | 100 | Lvl 6 |
| Will | 29W 1L | 94 | Lvl 7 |
| Elric | 27W 3L | 77 | Lvl 7 |
| James | 26W 4L | 62 | Lvl 8 |

**Score gap at R30:** Players hitting 7,000–9,000; opponents capping ~3,840. ~2× gap.

| # | Finding | Kind | Priority |
|---|---------|------|----------|
| F1 | Game universally too easy — all finishers won, 2 with near-perfect records | Balance | High |
| F2 | Rep never goes up on wins — winning feels like doing nothing | UX/Feel | High |
| F3 | Tier (T1/T2/T3) vs Stars confusion — players didn't understand the difference | UX | High |
| F4 | Tooltip overload on mobile — James skipped all tooltips, wall of text | UX | High |
| F5 | "Upgrade Exhibit" button location unintuitive — Will suggested inline with slots | UX | Medium |
| F6 | Species vs Class distinction unclear — James couldn't tell what they each did | UX | Medium |
| F7 | Passives feel ignorable — Will and James both didn't engage with them | Design | Medium |
| F8 | No pivot pressure / strategic monotony — still showing despite Phase 9 class axis | Design | Medium |
| F9 | Card names too similar / hard to distinguish (dyslexia concern from Kai) | UX | Low |
| F10 | "Balatro endless mode" independently suggested by Will and Kai | Design | Deferred |

---

## Design decisions

**F2 — Rep gain on win: rejected.**
Adding +rep for wins would inflate the 100-point scale and make the metric less meaningful. The tension already exists (you can lose rep); wins should feel like "holding your position" in a competitive exhibition.

**F4/F5 — Mobile tooltip / Upgrade Exhibit placement: deferred.**
Mobile tooltip condensing is a meaningful effort for limited playtest signal. Upgrade Exhibit inline placement doesn't fit the mechanic (it upgrades the shop pool, not just adds a slot visually).

**F10 — Endless mode:** Deferred. Worth investigating after ranking meta ships — if ranked players consistently win, the endless concept becomes the structural fix.

---

## Phase 15 Plan

| # | Item | Addresses | Effort |
|---|------|-----------|--------|
| A1 | Raise opponent curve ~40% from R5 onward | F1 | Low |
| A3 | Add `title` tooltip on card-tier div clarifying T1/T2/T3 vs ★ | F3 | Low |
| R1 | New `src/ranking.js` — 5 tiers, placement (3 runs), RP system, localStorage | Meta | Medium |
| R2 | Wire rank into `Run.rankMult` → `generateOpponent` | Meta | Low |
| R3 | HUD rank display (Calibration N/3 or Tier + RP bar) | Meta | Low |
| R4 | Run-complete rank section (RP change, promotion/demotion messaging) | Meta | Low |

**Rank tiers:** Enthusiast (1.0×) → Collector (1.2×) → Curator (1.45×) → Connoisseur (1.75×) → Luminary (2.1×)
**Placement:** 3 runs at base difficulty, rank assigned from avg final Rep.
**RP per run:** Win = 30 + round(finalRep × 0.7); Loss = −40. Promote at 200 RP, demote below 0 (land at 100).

# Pre-Playtest 3 plan (Phase 10) — kept for reference

**Date:** 2026-04-20
**Context:** Third playtest pass after Phase 9 (class synergy axis, economy tightening, diversity augments) and full theme rename (alien scientific names, species/class/item/augment rename).

State going in:
- 20 alien cards, 5 species (Plasmic/Sporal/Chitinous/Crystalline/Abyssal), 5 classes (Shy/Livid/Giddy/Sullen/Pompous)
- Dual synergy axes (species + class) — classes added in Phase 9.3
- 9 accessories + 5 Taxonomy Badges + 5 Mood Tags; 12 Collector Upgrades
- Sim baseline: greedy=70.4%, wide=69.2%, warrior-stack=63.5%
- Open item: Shapeshifter (Species Reclassification) + class interaction untested

---

## Findings (4 games)

| # | Finding | Kind |
|---|---|---|
| F1 | Synergy bonus text "+26/card" doesn't communicate which cards contribute — confusing | UX |
| F2 | "Board" / "Bench" labels are generic, carry no thematic weight | UX |
| F3 | "HP" label is combat framing, doesn't fit exhibition theme | Theme |
| F4 | Hovering bench/shop cards gives no score-impact info | UX |
| F5 | Hovering class/emotion badge shows nothing — can't see thresholds without hunting individual cards | UX |
| F6 | Hard to tell units apart post-rename; names alone don't distinguish them visually | UX |
| F7 | Card layout inconsistent — species+class wraps on some cards (Chitinous Giddy), shifting score position | Bug |
| F8 | Axis labels on augments/items ("Axis 2-flat") are noisy implementation detail | UX |
| F9 | Can't inspect heroes during item/augment pick — modal occludes the whole board | UX |

---

## Design decisions

**F4 — hover score-impact: dropped (not deferred)**
Decided not to build marginal-EV hover numbers. Showing "+85 if you buy this" converts the game from "understand synergies → make the pick" into "hover → take the highest number". The satisfaction of seeing a synergy click into place is more valuable than removing the deduction step. Making synergy information clearer (F1, F5, F6, F7) serves the same information need without short-circuiting play.

**F3 — HP → Reputation**
HP in auto-chess represents your standing in the competition — it erodes when your collection underperforms. Renamed display label to **Reputation** / **Rep**. Mechanic unchanged (still 100 starting, damage = 2 + round). All field names and game logic kept as `hp` internally.

---

## Phase 10 Plan

| # | Item | Addresses | Effort |
|---|------|-----------|--------|
| P1 | Card layout fix: `min-height` on labels row so score stays pinned | F7 | Low |
| P2 | Remove axis labels from augment/item pick modal and tooltips | F8 | Low |
| P3+P5 | Synergy wording: "+26 per Plasmic alien"; syn-bar badge hover tooltips | F1, F5 | Low |
| P4 | Relabel: Board → Exhibition Floor, Bench → Holding Pen, HP → Rep | F2, F3 | Low |
| P6 | Board visible during augment/item modals (side-panel layout) | F9 | Medium |
| P7 | Class glyph system: unique unicode symbol per class on card face + badges | F6 | Medium |
