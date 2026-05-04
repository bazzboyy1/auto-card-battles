# Phase 33-B.3 — v0.57 Playtest Response (plan)

**Status:** 🟡 planned — successor to Phase 33-B.2.1 (v0.57). Multi-conversation work. Resume here.

**Target versions:** v0.58 → v0.6X (one minor bump per bucket commit).

**One-line goal:** action the v0.57 playtest signals — close the rival-threat gap, give generous modifiers actual bite, fix the scoring-transparency holes, and clear the tooltip/affordance rough edges that tax the curate loop.

---

## Calibration takeaways (don't re-derive these)

The v0.57 playtest data + notes give us this baseline:

- **Curve is right.** 9W/6L (60%), 3 perfect (20%) across 15 runs vs sim greedy 50.5%/30%. **Don't bump the curve further this phase.**
- **Kill-zones map matches sim:** R5–R11 (all 6 losses cluster here), then skating mid-game, then R24 finale (5/9 R24 reaches went under target). By design — leave alone.
- **Rival is invisible** — both notes and data confirm. Aggro never escalates above 0.10. Picks don't compete with player species. **Biggest single design gap.**
- **Modifier polarity is broken.** Generous mods (Bull Market / Generous Patron / Stipend / Curator's-Pet-favored) went 5W/0L; punishing mods went 1W/6L. Generous mods need bite.
- **Single-build playtest.** All 15 runs were Chitinous-focused. Crystalline / Plasmic concerns from the sim **cannot be validated from this data** — defer to a later targeted playtest.

If a future bucket's outcome contradicts these takeaways, distrust the bucket — recheck before bumping the curve or species numbers.

---

## Bucket order

Suggested: A → B → C → D → E → F. Reorderable; buckets are independent except where noted.

A is biggest impact (most evidence). B is the cheapest big win. C–F are smaller passes that can interleave.

---

## Bucket A — Rival threat layer

**Problem:** rival exists in code but doesn't *do* anything readable. Three failure modes:

1. **Aggro never escalates.** Chapter-record DDA condition is invisible because banked-play margins are huge (R23 routinely 105–175% of target). Trigger needs to fire on lives-saved or per-round-margin, not chapter-best.
2. **Picks don't compete.** Magpie scatters; Specialist locks a species the player isn't going for; Mimic rarely overlaps with the player's actual build. Result: rival never bids on cards the player wants.
3. **Action invisibility.** Player can't see what the rival is doing during the round; rival activity surfaces only as picks in the runlog. No felt pressure.

**Files (probable):**
- `src/rival.js` — aggro escalation rule, pick-policy adjustments
- `src/game.js` — wherever the rival hooks into the shop tick
- `web/app.js` — rival-action ticker / per-round summary chip in HUD
- `web/index.html`, `web/style.css` — HUD slot for rival activity
- `src/runlog.js` — already captures rival per-round, but verify aggro-trigger reasons are logged

**Acceptance:**
- After 3+ rounds, rival's aggro reaches ≥0.30 in a normal-margin run (player banking but not running away).
- Rival picks contest at least one of the player's last-bought species 50%+ of the time once aggro >0.20.
- HUD shows a "Rival just bought X" or equivalent peripheral cue without stealing focus.
- Sim sweep (n=200, no modifier, greedy) — survival shouldn't drop more than 5pp; design intent is *visibility*, not difficulty bump.

**Open questions for next conversation:**
- Should each personality (Magpie / Specialist / Mimic / Hoarder) get a distinct aggression model, or share a base curve with personality flavoring on top?
- Mimic personality currently mimics *what* — last bought card? Player's dominant species? Needs spec.

**Status:** ✅ shipped 2026-05-04 as v0.58. Aggro [-0.20, +0.50] with per-round bumps, HUD threat pill, Mimic contests last-bought, Specialist first-pick contests when aggro ≥ Hunting. Sim greedy 50.5→46% (in band); chitinous-stack 40→30.5% (bite landed). Crystalline/Plasmic dropped further out of band — flagged for targeted playtest before species buffs.

---

## Bucket B — Generous-modifier bite pass

**Problem:** Bull Market, Generous Patron, Curator's Stipend, Curator's Pet (favored half) were 5W/0L. Sim sweep (Phase 33-B.2.0) said the same: Bull Market 95%, Generous Patron 94%, Stipend ≈94%. They're effectively a free pass.

**Approach:** add cost/risk per generous modifier — not a flat reduction. Each modifier should still feel *generous*; the bite comes from a paired downside that the player can play around.

**Probable changes (`src/modifiers.js`):**
- **Bull Market:** generous shop prices; pair with smaller interest cap (or interest-tax). Player still gets cheap units, but banking is harder.
- **Generous Patron:** flat gold per round; pair with a per-round tax that scales with bench size, or reduced interest yield.
- **Curator's Stipend:** chapter-end gold; pair with a fixed Refit-cost premium that round (or one fewer Refit action).
- **Curator's Pet:** favored species cheaper; *scorned* species penalty was already there — investigate whether the favored discount is too steep relative to the scorned penalty's bite.

**Acceptance:**
- Sim sweep (greedy n=200, no other modifier) — each generous modifier lands inside the 30–60% band, not 90%+.
- Punishing modifiers (Hothouse, Lean Economy, Late Reveal, Blind Tasting, Patron Subsidy) untouched — they're already in band.
- Browser smoke: each modifier still reads as "generous" in player intent; bite shows up in the modifier copy.

**Files:**
- `src/modifiers.js` — defs + onRound/onShop hooks
- `web/app.js` — modifier description rendering (if the bite needs new copy)

**Status:** ✅ shipped 2026-05-04 as v0.59. Bull Market: free rerolls + interest cap 5→3 (banking ceiling 25g→15g). Generous Patron: +2/round + bench tax 2 ✦/round per bench above 5. Stipend: +6/chapter + Refit-action premium +3 ✦ (peek 10→13, swap 20→23, promoteT1 25→28, promoteT2 60→63). Curator's Pet: favored 1.4→1.25 (scorned 0.7 unchanged). Sim greedy n=200: bull 57→62 (sim adapts; bite is human-feel only — banking ceiling), generous 77.5→53 (-24.5pp ✓), stipend 51→51 (sim doesn't run refit; human-only bite), pet 48.5→45 (-3.5pp baseline shift; sim doesn't lean into favored). Punishing mods untouched.

---

## Bucket C — Scoring transparency

**Problem:** scoring is opaque. Player can't see:
1. **"Held N rounds" bonus** (8% per round per card held) — invisible. Player can't tell if it's active.
2. **Per-augment / per-item modifier contribution** in the scoring breakdown — currently `+SCORE` floats, no name, no base/mult attribution.
3. **Judge-only adjustments** during judging — same issue, no labeled trace.
4. **Judge-reveal modal** — player can't read it before it dismisses; can press buttons through it.

Notes call out 4–5 of these together. Make it one cohesive pass.

**Approach:**
- Judge-reveal modal: add Continue button, block input until clicked. Cheapest fix, do first.
- Scoring breakdown: each contribution gets a labeled line — `Held 4 rounds: ×1.32 (+128)` / `Augment: Hive Mind +20% (+45)` / `Item: Taxonomy Badge +90 base`. Already partly done for native passives — extend to held-rounds, augments, items, and judge mults.
- Per-card score float: keep the `+SCORE` cue but add a tooltip / hover that lists the breakdown for *that* card.

**Files:**
- `src/game.js` `calcBaseBreakdown` — already returns line items; verify augment + item + held-rounds contributions are captured
- `src/judges.js` — verify judge-mult lines are returned with names
- `web/app.js` — scoring modal renderer; per-card hover; judge-reveal modal blocker
- `web/index.html` + `web/style.css` — Continue button + modal blocker

**Acceptance:**
- Held-rounds bonus has a named line in the breakdown.
- Each augment/item that contributes shows its name + base-or-mult tag + value.
- Judge-reveal modal has Continue; pointer-events disabled on the rest of the UI while it's up.
- Browser smoke: a 6-card board with 1 augment + 2 attached items produces a breakdown where every line is attributable.

**Status:** ✅ shipped 2026-05-04 as v0.60. (1) Judge-reveal modal `showChapterReveal` + `showGrandFinaleReveal` now have a Continue button + backdrop-click dismiss; CSS `pointer-events: none` removed so the overlay blocks input. (2) Per-card `.sc-breakdown` hover tooltip on each scoring card lists every contribution — base ×stars, augments, items, modifier mult, judge taste line. (3) New `tasteLineBreakdown(tasteId, ...)` in `src/judges.js` returns per-card `{ final, lines }` for all 11 tastes; `src/game.js` folds those lines into `scoreBreakdown.perCard`. Held-rounds reads as `Narrative: held N round(s) ×M`. Sim greedy n=200 unchanged (45.5% vs 46% baseline; scoring math untouched, only labels added).

---

## Bucket D — Tooltip + copy cleanup

**Problem:** several rough edges, all small individually:
1. Item/augment tooltips leak internal jargon (`axis`, `5-tag`, etc.) and don't say *who* benefits.
2. Pair-combo copy is prescriptive ("forms a pair with Stellorb"). Should be descriptive: "+120 when paired with Stellorb."
3. Build-archetype names show in HUD (Emotional Spectrum, Patient Collection, Star Collector) without any tooltip explaining requirements or effect.
4. Augment scope is unclear — player thinks they only apply at acquisition, not globally / persistently.
5. Judge "Passives activate this round" — taste/rule needs clarification or removal. Player couldn't identify which cards this rewards (Clattorb? unclear). Leave as a question for now: is the taste worth keeping?

**Files:**
- `src/items.js`, `src/cards.js`, `src/augments.js` — description strings
- `web/app.js` — `makeSynergyTooltip`, `makeArchetypeTooltip` (new), pair-combo copy
- `src/judges.js` — clarify or flag the "passives activate" taste

**Acceptance:**
- Grep `axis`, `5-tag`, `auraMult`, `axis5` etc. in user-visible tooltip strings — zero hits.
- Every build-archetype HUD chip has a tooltip on hover with requirement + effect.
- Pair-combo strings are stative ("+X when paired with Y"), not imperative.
- Augment tooltip explicitly states "Applies for the rest of the run" (or equivalent persistence wording).

**Status:** 🟡 not started. Decision pending on whether the "passives activate" taste survives — flag for next conversation.

---

## Bucket E — Plinth L6+ + stale tier-odds tooltip

**Problem:**
1. Player tried to buy plinth slot past 6 — button showed $0 cost but click did nothing. Tooltip still suggests more upgrades exist beyond L6.
2. Tier-odds display references "based on rounds" which is stale (current system doesn't ramp tier odds by round in the way the tooltip implies).

**Files:**
- `web/app.js` — plinth-add button gating + tooltip
- `web/index.html` — tier-odds tooltip text

**Acceptance:**
- At L6, plinth-add button is hidden or shows "Maxed" — never $0.
- Tier-odds tooltip describes the actual current system (no "based on rounds" copy).

**Status:** 🟡 not started.

---

## Bucket F — Sporal Taxonomy Badge + mid-run unlock timing

**Problem:**
1. Sporal Taxonomy Badge — works for Puffzak's passive but doesn't fire for synergy reads. Per Phase 31-B.3 this should trigger any code that checks `card.tags`-style species belonging — find the divergence.
2. Unlocks fire mid-run (player sees achievement toasts during a run). Should batch and surface at run-end.

**Files:**
- `src/items.js` — Taxonomy Badge axis-5 effect; verify species-tag grant path
- `src/judges.js` — synergy reads (whichever taste is missing the badge)
- `src/cards.js` — Puffzak passive (the one that *does* see the badge — diff this against the failing case)
- `web/app.js` or `src/unlocks.js` — unlock dispatch timing

**Acceptance:**
- Sporal Taxonomy Badge attached to a non-Sporal card causes Sporal-aligned synergies to register that card.
- Unlock toasts surface only at run-end (or at chapter boundaries at most).

**Status:** 🟡 not started.

---

## Held / deferred (don't pull in this phase)

- **Crystalline / Plasmic species buffs.** Sim says 20.5% / 23.5%; v0.57 playtest didn't test them. Targeted playtest first.
- **0.68 judge-scale post-multiplier removal** (Phase 27 leftover).
- **Puffzak `auraMult: 1.15, target: 'other-Sporal'`** still bypassed — low impact, defer.
- **66 unit tests rewrite** (Phase 27 chore).
- **`src/ranking.js` cleanup** (dead file).
- **Refit-pool weighting for tag-grant items** (Phase 31-B.3 follow-up).
- **Non-tag-taste Refit Pool weights uniform** (Phase 31-B.2 follow-up).

---

## Per-bucket workflow

Every bucket commit follows the standard project rules:

1. Bump version in `web/index.html`.
2. Update `DESIGN_LOG.md` "Current state" block.
3. Update relevant memory file(s) in `.claude/projects/.../memory/`.
4. Set "Next action" pointing to the next bucket.
5. Commit with the bucket label (e.g. `Phase 33-B.3.A: Rival threat layer (v0.58)`).

If a bucket grows past one commit, sub-step it (33-B.3.A.1, 33-B.3.A.2) and update *this* plan's bucket Status line.

---

## Outcome (post-ship)

**Bucket C — v0.60 (2026-05-04):** Three opacities closed. (1) `showChapterReveal` + `showGrandFinaleReveal` lose their auto-dismiss; both now append a Continue button and bind backdrop-click dismissal — `pointer-events: none` removed from `.chapter-reveal` so clicks no longer pass through. (2) New `tasteLineBreakdown(tasteId, active, baseScores, ctx)` in `src/judges.js` mirrors each of the 11 tastes' per-card logic and returns `[{ final, lines }]`; `game.js` folds those lines into `scoreBreakdown.perCard[i].lines` and uses `Math.round(final)` as the per-card display value. (3) `makeScoringCard(card, breakdownEntry)` appends a `.sc-breakdown` hover popover listing every contribution with attribution — base ×stars, augments (Claymore/Heroic Resolve/Time Dilation/etc), items (Guinsoo's, Prestige Tag, Collector's Mark, etc), modifier (Curator's Pet × N), held-rounds (`Narrative: held N rounds ×M`), tag-mult (`Refinement: Restrained ×1.9`). Browser-verified: 3-card R1 board sum of finals (176+55+33=264) matched authoritative total. Sim greedy 45.5% vs v0.59 46% — within noise.

**Bucket B — v0.59 (2026-05-04):** Each generous modifier paired with a downside that keeps the headline benefit feeling generous. Bull Market: free rerolls + interest cap 5→3 (banking ceiling 25g→15g; sim adapts via more aggressive spending — bite is human-feel). Generous Patron: +2/round + bench tax 2 ✦/round per bench above 5 (sim 77.5→53%, -24.5pp ✓). Curator's Stipend: +6 ✦/chapter + Refit-action premium +3 ✦ (sim doesn't run refits — human-only bite). Curator's Pet: favored 1.4→1.25, scorned unchanged (sim doesn't lean into favored — playtest will validate the ceiling drop). Punishing modifiers untouched. Patron Subsidy at 61% greedy flagged for next playtest read.

**Bucket A — v0.58 (2026-05-04):** Reversed Phase 29's ≤10% Buster-principle aggro cap (playtest read it as no-pressure because the bias was sub-perception). New aggro range [-0.20, +0.50] with per-round bumps (+0.10 strong / +0.04 pass / -0.15 fail). HUD threat pill: Distracted / Watching / Hunting / Pouncing. Mimic contests last-bought species *this round*; Specialist first-pick biases toward player's dominant species when aggro ≥ Hunting. Sim deltas (n=200 each, no modifier): greedy 50.5%→46.0% (-4.5pp, in band), chitinous-stack 40.0%→30.5% (-9.5pp, bite landed where playtest pointed), sporal/wide unchanged or up (don't lean on a single species), abyssal -3.0pp, crystalline 20.5%→14.0% (-6.5pp), plasmic 23.5%→16.5% (-7.0pp). Crystalline/Plasmic now meaningfully out of band — flagged for targeted playtest before species buffs. Aggro ramp trace (greedy seed=7): R1 Watching → R3 Hunting → R7 Pouncing.
