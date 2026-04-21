# Playtest 1 — Findings & Phase 8 Plan

**Date:** 2026-04-19
**Context:** First playtest pass (see `DESIGN_LOG.md` → "Next action"). Three runs played; feedback collected. This file captures findings + the implementation plan to address them.

## Findings summary

| # | Finding | Kind | Bucket |
|---|---|---|---|
| 1 | `class` field gone, only species visible | design clarification | — |
| 2 | No way to acquire items in normal play | open design | C |
| 3 | Augment description invisible after pick | UX | B |
| 4 | Card tooltip clips off-screen on top-row cards | UX | B |
| 5 | Buying a card with no board/bench space silently destroys it | **bug** | A |
| 6 | Shapeshifter species tag lost when the unit is upgraded | **bug** | A |
| 7 | Card score display doesn't reflect active buffs | UX | B |
| 8 | Dragon Knight shows as 1 Warrior in synergy bar (scores as 2) | **bug** | A |
| 9 | Morphling's phantom species doesn't show in synergy bar | **bug** | A (same root cause as 8) |

Findings 1 and 2 are already documented as "Open / deferred" in `async_redesign.md`. 1 is an explicit spec decision. 2 is an open design question we now have to answer.

---

## Bucket A — Bugs (Phase 8.1)

Game-logic bugs. Fix first; none are blocking but all are silently wrong.

### A1. Shop buy with no space destroys card
- **File:** `web/app.js` → `onBuyShop(slotIdx)` (line ~119)
- **Current behavior:** `Shop.buy()` deducts gold and clears the offer slot; `board.addCard()` throws "No space"; the `try/catch` swallows it; the card is gone.
- **Fix:** guard in `onBuyShop` *before* calling `shop.buy()` — if `board.isFull()`, return early. The `unaffordable` CSS class is already applied for this case; the click handler just needs to honor it.
- **Exit:** click a shop card with full board/bench → no gold deducted, no shop slot cleared, no card.

### A2. Shapeshifter tag lost on combine
- **File:** `src/game.js` → `Player._combine(name, stars)` (line ~129)
- **Current behavior:** the method removes the 3 source cards, then tries to `find` one on the board to read `shapeshifterSpecies` — but they're already gone. The comment even admits this is a lost edge case.
- **Fix:** collect `shapeshifterSpecies` (and any other run-persistent tags) from the source cards during removal, before they're spliced out. Transfer to the upgraded card alongside items.
- **Exit:** Shapeshifter a 1★ Axe to Demon → buy two more Axes → auto-combines to 2★ → the 2★ still has `shapeshifterSpecies: 'Demon'`.

### A3. Synergy bar uses raw species count
- **File:** `web/app.js` → `renderSynergyBar()` (line ~263)
- **Current behavior:** calls `board.speciesCounts()` which counts `card.species` verbatim. Dragon Knight counts as 1 Warrior, Morphling's phantom doesn't appear, Emblem items don't appear, Shapeshifter tags don't appear. `calcScore` uses `effectiveSpeciesCounts` correctly, so the battle math is right — only the display is wrong.
- **Fix:** call `effectiveSpeciesCounts(board, { augments, player })` (same call signature the scoring path uses). Show the effective count; optionally annotate the row with a small note when phantom species are contributing (so the player understands *why* DK reads as 2 Warriors).
- **Exit:** place only Dragon Knight on the board → synergy bar reads "Warrior 2 ✓ →4". Place Morphling + 3 Mages → synergy bar reads "Mage 4 ✓".

Bucket A lands as a single commit. No design changes.

---

## Bucket B — Playtest UX (Phase 8.2)

Polish items the first playtest surfaced. Not bugs, but hurt readability enough to confuse the player.

### B1. Augment tooltip parity
- **Current:** `renderAugmentBadges()` uses the native HTML `title` attribute. Works on desktop but styled inconsistently and not visible in the augment-pick modal.
- **Fix:** give the `.augment-badge` and `.augment-card` elements a hover tooltip styled like `.card-tooltip`. Reuse the same CSS pattern (`position: absolute; opacity 0 → 1 on hover`). In the pick modal, the description is already on the card face; this is mainly for the in-round badge row.
- **Exit:** hover an augment badge in the shop HUD → styled tooltip appears with full description.

### B2. Card tooltip viewport clamping
- **File:** `web/style.css` → `.card-tooltip` + the `:first-child` / `:last-child` hack (line ~113).
- **Current:** tooltip is absolutely positioned `bottom: calc(100% + 7px)` and `left: 50%`. Works fine on bench cards but clips off the top of the viewport for active-board cards (top row). The first/last-child fix only handles horizontal clipping.
- **Fix:** small JS shim — on `mouseenter` of a card, measure the card's bounding rect and toggle a `.tooltip-below` class on cards too close to the viewport top; CSS for `.tooltip-below .card-tooltip` flips `bottom: calc(100% + 7px)` to `top: calc(100% + 7px)`. Horizontal clamp: measure and set an inline `transform` / `left` override if tooltip would overflow left/right.
- Cheaper alternative considered: always place tooltip below. Rejected — feels weird for cards already near bottom of viewport.
- **Exit:** hover any card anywhere on the board → tooltip always fully visible.

### B3. Score breakdown visibility
- **Current:** card face displays `baseScore × STAR_MULT[stars]` only. Passives, synergies, items, augments invisible. Player cannot tell if a build is working.
- **Fix (two layers):**
  1. **Live effective score on the card face.** Pre-compute each card's contribution once per render by calling `calcScore` with a single-card-isolated pass, or by exposing a per-card breakdown from the pipeline. Display as primary number; keep raw base-score as a smaller secondary number underneath (e.g. `280` big, `(base 130)` small).
  2. **Breakdown in the card tooltip.** Extend `makeSynergyTooltip` with a "Score breakdown" section listing each bonus line that fired for this card: base, star mult, passive (Axis 3 / 2 / 4 / 6), synergy flats, synergy mults, aura mults, item adds, augment adds. Same pipeline as `calcScore`, but emit per-card traces instead of folding them into a total.
- **Implementation note:** add a `calcScoreBreakdown(ctx)` method to `Board` that returns `{ total, perCard: [{ card, base, stages: [{label, value}], final }] }`. `calcScore` can then just sum. Tooltip and card face both read from the breakdown struct; no duplicate pipelines.
- **Exit:** Axe + 1 other Warrior on board → card face shows 70 not 50; tooltip shows `base 50 · +20 Axe passive (Warrior count)`. Add 2 more Warriors → card face updates to reflect +22 Warrior-2 synergy flat.

Bucket B lands as ~2-3 commits (one per item).

---

## Bucket C — Item acquisition (Phase 8.3)

The "open item" from `async_redesign.md`. Playtest confirmed: items being dev-only is the single biggest "is this broken?" moment for a new player.

### Decision (to confirm before implementation)

**Round-reward model**, modeled on augments:

- Items are awarded at three fixed milestone rounds, offset from augment picks. Proposed: **rounds 5, 10, 15**. (Augment picks are at 3, 7, 12; item picks fill the gaps without clustering.)
- At each item round, before `earnIncome()`, the game offers 3 random items from `ITEM_DEFS`. Player picks one → stored in a new player inventory (`player.itemBag: string[]`).
- Separate from the offer: player can attach any item from `player.itemBag` onto any unit on their board/bench via a click-to-attach UI. Detach returns to bag (free during shop phase).
- No gold cost. Item is a reward, not a purchase — matches augments and keeps shop gold decisions uncluttered.

**Rejected alternatives:**
- Augment-slot items — burns an augment choice on one item. Augments are strategic pivots, items are equipment; different weights.
- Carousel — needs spatial positioning and draft timing. Out of scope (same reason Axis 6 auras are deferred).
- Gold shop — adds a new sink competing with XP/reroll; muddies the already-tight economy.

**Why 3 picks at 5/10/15:** roughly one item pick per ~5 rounds matches the pace of a 30-round run and gives each unit up to 3 slots worth of meaningful progression. Tuneable.

### Implementation

- **`src/game.js`:**
  - Add `player.itemBag = []` (array of item ids).
  - Add `run.itemPickRounds = [5, 10, 15]` and `run.itemOffers = {}` + `run._itemsPicked` mirror of the augment flow.
  - `Run.pendingItem()` — returns 3-id offer (random from `ITEM_DEFS`, no duplicates within the offer, picks already chosen *do not* exclude future offers — items are reusable categories).
  - `Run.pickItem(idx)` — appends to `player.itemBag`, marks round as picked.
  - `startRound()` in the browser: check `pendingItem()` *after* `pendingAugment()` returns null. Show item-pick modal; on pick, return to shop flow.
- **`src/items.js`:** no change (defs already exist).
- **`web/app.js`:**
  - New phase `'item'` alongside `'augment'` / `'shapeshifter'`.
  - `showItemModal()` — mirrors augment modal; 3 cards showing item name + axis + description.
  - New panel in shop HUD: **inventory bag** — shows unequipped items. Click an item → enters "attach mode"; click a unit → attaches. Click the item again to cancel.
  - Replace the dev-only pip detach with a universal detach-during-shop path (click pip on your own unit to return item to bag). Keep `?dev=1` grant panel for testing.
- **Dev mode:** unchanged; dev grant still works for balance testing.
- **Sim / AI:** `sim.js` greedy policy picks first item and attaches to highest-scoring unit. Good enough for Phase 8; polish in a later pass.

### Open sub-questions

- Can items be swapped between units mid-run? **Yes** — detaching returns to bag, attach to another. Free action during shop.
- Does the item offer get rerolled? **No** — one chance, matches augments. Keeps decision weight.
- Is Emblem-of-Species more common than plain items? **No** — uniform random from all 14 items (10 base + 4 species emblems, since Warrior emblem is redundant with 5 species)... actually all 5 emblems are defined. Uniform over all 14.

**Exit:** start a new run → hit round 5 → pick modal appears offering 3 items → pick one → it's in the inventory bag → click bag item then click a board unit → pip shows item; battle math reflects it.

Bucket C is the largest; lands as 2 commits (engine + UI).

---

## Sequencing

1. **Phase 8.1 (A)** — bugs. One commit. Run the sim afterward to confirm score math unchanged for non-bug paths.
2. **Phase 8.2 (B)** — UX. ~3 commits. B3 depends on the `calcScoreBreakdown` helper, so land that first.
3. **Phase 8.3 (C)** — item acquisition. 2 commits. Depends on bucket A (shop buy guard informs the attach-mode guard pattern).

Each phase leaves the game in a runnable state. After Phase 8.3, re-run `node run.js sim 200` to confirm winrate hasn't drifted outside 45–70%, then a second playtest pass. Log findings in `playtest_2_findings.md`.

## Deferred (confirmed still deferred)

- **Classes.** `async_redesign.md` has them flagged as "patch as pure data." We will do this in a later phase (Phase 9?) after playtest 2. Not blocking.
- **Board positions / Axis 6 auras.** Out of scope.
- **Real multiplayer, leaderboards.** Post-prototype.

## Log update

When Phase 8 completes, update `DESIGN_LOG.md` → "Current state" → set Phase to 8, move "Real item acquisition mechanic" from Open items to done, and keep class / board-positions / leaderboard where they are.
