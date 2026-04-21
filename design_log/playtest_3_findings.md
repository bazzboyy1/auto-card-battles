# Playtest 3 — Findings & Phase 10 Plan

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
