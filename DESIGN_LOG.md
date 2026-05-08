# Auto-Card Battles — Design Log (Entry Point)

Living index. Detail is split across `design_log/` sub-files to keep this entrypoint small. Load only what the current task requires.

---

## Current state (update this block every pass)

**Phase:** Phase 33-B.3.F "Sporal Taxonomy Badge propagation + mid-run unlock deferral" shipped (v0.63, 2026-05-09). Sixth and final bucket of the v0.57 playtest response — Phase 33-B.3 is now feature-complete. Two systemic fixes: (1) species-tag grants (Taxonomy Badges, Geodorb morph, Spear of Shojin, Shapeshifter) now propagate to *all* "is this card species X?" reads — auras (`auraMatches`), Sprangus/Phlorbex/Vexborg/Murborg/Vornix/Blorpax `+N per other <Sp>` filters, Molborg/Lithvorn/Squorble/Stellorb/Vorbex/Vorzak adjacency reads. Previously only Stage 3/4a synergy thresholds + bonuses honored badges; the player saw Sporal-3 synergy mult on a Sporal-Badge Plasmic card but Puffzak's "+15% to other Sporals" ignored it. (2) Achievement unlock writes deferred from mid-round to run-end — newly-unlocked content can no longer appear in shop pools mid-run.

**Direction:** Game is framed as **curation under shifting judge tastes**. Judges are the scoring spine (11 tastes, 20 judges); aesthetic tags drive 5 of the 11 tastes; a visible AI rival competes on a shared 8-slot persistent shop; the plinth is a *composition* (cap 6, adjacency-aware, pair-combos, live recalc on drag); each run draws one of 12 random modifiers; between chapters the player faces a paid Refit modal; items can re-aim wrong-taste cards via aesthetic tag-grants. UI/copy is theme-aligned: Appraisal / Reputation / Lustres ✦ / Open Showing / "the salon dismisses you".

**6-phase rollout:** 27 Judge Spine ✅ → 28 Aesthetic Tags ✅ → 29 Visible Rival ✅ → 30 Plinth Composition ✅ → 31-A Target curve recalibration ✅ → 31-B.1 Run Modifiers ✅ → 31-B.2 Exhibition Refit ✅ → 31-B.3 Tag-granting items ✅ → 32 Theme Pass ✅ → 33-A Sporal completion ✅ → 33-B.0 RunLog refresh + digest tool ✅ → 33-B.1 Tag legibility surface ✅ → 33-B.2.0 Sim overhaul ✅ → 33-B.2.1 Target curve recalibration v2 ✅ → 33-B.3.A Rival threat layer ✅ → 33-B.3.B Generous-modifier bite pass ✅ → 33-B.3.C Scoring transparency ✅ → 33-B.3.D Tooltip + copy cleanup ✅ → 33-B.3.E Plinth L6+ + stale tier-odds tooltip ✅ → **33-B.3.F Sporal Badge propagation + mid-run unlock deferral ✅**. Living Exhibition redesign + v0.57 playtest response complete (all 6 buckets shipped).

**Next action:** v0.63 playtest read. With all six buckets of the v0.57-playtest-response phase shipped, the next move is a fresh playtest pass to validate: (1) rival threat layer reads as visible pressure (Bucket A), (2) generous-modifier bites are felt without killing the headline (B), (3) per-card scoring tooltips + held judge-reveal land the transparency goals (C), (4) tooltip + copy clarifications resolve the legibility flags (D), (5) plinth + tier-odds are accurate at the cap (E), (6) Sporal Badge now propagates to auras + card-internal filters (F1) and unlocks no longer leak into shop pools mid-run (F2). Held / deferred (don't pull without playtest signal): Crystalline/Plasmic species buffs (need targeted playtest), 0.68 judge-scale removal, Puffzak T2 aura, 66 unit tests rewrite, `src/ranking.js` cleanup, Refit-pool weighting follow-ups, Patron Subsidy / Cheap Plinths sim 61%, redundant chapter-end `updateAggression` cleanup, Eccentricity taste fate, Mood Tag (Crest of Class) propagation to class filters (mirror of F1 but for class — defer until similar player-facing complaint).

**Skill usage rule:** Continue using `game-design-skills` proactively for design decisions. Reference audit in `phase_27_plan.md` Appendix flags which references to load per phase.

**Phase 33-B.3.E v0.62 (2026-05-08):** Plinth L6+ + stale tier-odds tooltip — fifth bucket of the v0.57 playtest response. Two issues closed at the gating + label layer; no mechanical changes.
- **Diagnosis:** (1) `updateShopControls` in `web/app.js` checked `S.human.level >= 9` to gate the "Maxed" state, but the actual cap is `MAX_BOARD = 6`, not `MAX_LEVEL = 9`. `addPlinth` in `src/game.js` rejects when `level >= MAX_BOARD` (6) — `MAX_LEVEL = 9` is exported but unreachable since `Math.min(MAX_LEVEL, MAX_BOARD) = 6`. At L6 the player saw "Upgrade Exhibit (0 ✦)" with `disabled = gold < 0` = false → enabled, but the click was a no-op because `addPlinth` returned false. (2) `buildExhibitInfoTooltip` looped `lvl = 3; lvl <= 9`, displaying odds rows for L7-9 the player can never reach. The plan called this "based on rounds is stale" — the literal phrase didn't exist in the codebase; the unreachable rows were the actual misleading element.
- **`src/game.js`:** `MAX_BOARD` added to module exports next to `MAX_LEVEL` so the cap can be sourced from one place.
- **`web/app.js` `updateShopControls`:** new gate `if (pCost === 0)` (where `pCost = S.human.plinthCost()`). `plinthCost()` returns 0 when `level >= MAX_LEVEL || level >= MAX_BOARD`, so this is the canonical "can't upgrade" signal. Display: "Exhibit Maxed", `disabled = true`. Else: "Upgrade Exhibit (N ✦)", `disabled = gold < pCost`. Old `level >= 9` branch removed.
- **`web/app.js` module imports:** added `MAX_BOARD, MAX_LEVEL` to the destructured `window.ACB.game` import.
- **`web/app.js` `buildExhibitInfoTooltip`:** loop bound is now `Math.min(MAX_LEVEL || 9, MAX_BOARD || 6)` (= 6), so the table renders rows for L3-L6 only. Subhead refined from "Adds one display slot · improves shop odds" to "Adds one display slot · shifts shop tier odds" (slightly more honest — odds shift in both directions, T1 down + T2/T3 up). The `||` fallbacks defend against any boot order where the consts haven't been wired yet.
- **`web/index.html`:** v0.61 → v0.62, loader cache-bust 0.61 → 0.62.
- **Synthetic plinthCost test (n=6 levels):** L3 cost 8, L4 cost 8, L5 cost 12, L6 cost 0 (canAdd false), L7 cost 0, L8 cost 0. Confirms `plinthCost === 0` at the actual cap.
- **Browser-verified (v0.62):** Page boots clean, version pill `v0.62`, no console errors. At starting L3 the button reads "Upgrade Exhibit (8 ✦)". Live tooltip DOM: 4 rows (L3-L6), L3 carries `.ei-current` class, T1/T2/T3 percentages match `LEVEL_WEIGHTS[3..6]`. Subhead shows "Adds one display slot · shifts shop tier odds". The "Maxed" path was verified in isolation by constructing a `Player` at level 6 and confirming `plinthCost()` returns 0; the `if (pCost === 0)` branch in `updateShopControls` then produces "Exhibit Maxed" with `disabled = true`.
- **Known follow-ups:** none specific to E. Bucket F (Sporal Taxonomy Badge synergy-read divergence + unlock-toast batching) is the only remaining v0.57-playtest-response bucket.

**Phase 33-B.3.F v0.63 (2026-05-09):** Sporal Taxonomy Badge propagation + mid-run unlock deferral — sixth and final bucket of the v0.57 playtest response. Plan disagreed with code reality (plan said "fires for Puffzak / not for synergy reads"; actual code: Stage 3/4a synergy reads via `cardHasSpeciesTag` already honored badges, but axis-8 auras and card-internal `c.species ===` filters did not). Used `game-design-skills` to make the design call: extend badge to all "is this card species X?" reads, leave Diversity/Harmony tastes raw-species (badge text reads "for synergy", not "for tastes"; counting one card as 2 unique species would be a 1-card +18% Diversity exploit).
- **`src/board.js` `auraMatches` extended:** signature `(target, srcIdx, tgtIdx, active, morphChoices, spearChoices)`. `'all-<Sp>'` and `'other-<Sp>'` branches now call `cardHasSpeciesTag(c, sp, morphChoices, spearChoices)` instead of `c.species === sp`. Stage 5 callsite passes `morphChoices/spearChoices` from `effectiveSpeciesCounts`. Affects Phlorbex (`'other-Sporal'`), Puffzak (`'other-Sporal'` ×1.15), Fluxnob (`'other-Plasmic'` ×1.20).
- **`src/board.js` `hasSpeciesTag`/`hasClassTag` closures threaded through eval ctx:** both `calcScoreBreakdown` and `calcBaseBreakdown` build closures `(c, sp) => cardHasSpeciesTag(c, sp, morphChoices, spearChoices)` and pass them on `selfCtx` for `passive.eval` calls + on the `applyAdjacencyStage` ctx for `evalAdjacent` calls.
- **`src/cards.js` species filters refactored (12 sites):** Blorpax/Vexborg/Vornix/Sprangus axis-2 `+N per other <Sp>` filters → `(ctx.hasSpeciesTag || ((c,sp) => c.species === sp))(c, 'X')`. Murborg's "highest Plasmic" check, Vorzak/Molborg/Lithvorn/Squorble/Stellorb/Vorbex adjacency reads — all switched to the same fallback-safe pattern. Fallback covers any callsite that evals a passive without a board ctx (UI previews, sim heuristics, defensive paths).
- **Diversity / Harmony left raw-species (deliberate).** Verified empirically: 4-card board (1 Sporal + 3 Plasmic-with-various-species-badges) returns same diversity score as the same board with no badges (342 vs 342). Badge text says "for synergy" — tastes are a separate scoring spine, and the 1-card +18% diversity exploit is the alternative we're avoiding.
- **`src/achievements.js` `incrementAchievementCounters`:** removed inline `addUnlock(...)` from the achievement-fire branch. Now reads `ctx.sessionUnlocked` array from caller, checks both `persistedUnlocked` (localStorage) and `sessionUnlocked` (in-run dedupe) before firing. Pushes to `sessionUnlocked` on fire so achievements don't re-fire across rounds in the same run. Counter writes still persist mid-run (so progress survives a game-over). Caller is now responsible for calling `addUnlock(id)` for each newly-unlocked reward at run-end.
- **`src/game.js` `Run.runBattle()`:** `_sessionUnlocked` array initialized lazily on the Run instance, passed via ctx to `incrementAchievementCounters`.
- **`web/app.js` `showGameOverModal`:** at the start, before the rating block, iterates `run.newlyUnlocked` and calls `addUnlock(a.reward.id)` for each — flushes deferred unlocks to localStorage exactly once at run-end. `addUnlock` added to the destructured `window.ACB.achievements` import.
- **`web/index.html`:** v0.62 → v0.63, loader cache-bust 0.62 → 0.63.
- **Browser-verified (v0.63):**
  - **Aura propagation:** synthetic 4-card board (Puffzak + Sprangus + Plasmic-Blorpax-with-Sporal-Badge + Plasmic-Slurvin-control) — Sprangus's "+30 per other Sporal" returns 60 (2 other Sporals: Puffzak + badge-bearing Blorpax), Puffzak's ×1.15 aura applies to both Sprangus *and* badge-bearing Blorpax, control Slurvin gets Plasmic-2 synergy + adjacency rage but NO Puffzak aura. `effectiveSpeciesCounts` reports Plasmic=2, Sporal=3 (badge correctly counted).
  - **Diversity unaffected:** boardA (3 Plasmic + 1 Sporal, no badges) and boardB (same shape but each Plasmic carries a different-species badge) both score 342. Badge does not double-count for Diversity ✓.
  - **Unlock deferral:** synthetic counter set to target-1 (sporal_devotee at 14/15), trip on a 2-Sporal board fires the achievement (newAchs returns `['zephrix']`), but localStorage `alien-exhibition-unlocks` remains `[]`. Session array now holds `['zephrix']`; second call on next round with same board returns `[]` (dedup'd via session, no re-fire) ✓.
  - **Sim baseline:** greedy n=200 survival 47.5% (was 46.0% pre-fix, ±2pp seed noise — within band; species-filter rewrite did not shift baseline).
  - Page boots clean (v0.63 pill, no console errors).
- **Note on the "fires for Puffzak / not for synergy reads" wording in the plan:** the plan description had it inverted. Synergy reads (Stage 3 + Stage 4a, via `cardHasSpeciesTag`) already worked. What didn't were auras and card-internal species filters. The fix unifies all paths, so the player no longer needs to know which of three taxonomies the badge reaches.
- **Known follow-ups:** Mood Tag (Crest of Class) does NOT propagate to class filters in card passives (Sharzak `c.class === 'Giddy'`, Morblax `c.class === 'Giddy'`). Same legibility argument applies — but defer until a player-facing complaint surfaces, since Mood Tags are far rarer in the meta than Taxonomy Badges and the playtest didn't flag class. Phase 33-B.3 is now feature-complete.

**Phase 33-B.3.D v0.61 (2026-05-04):** Tooltip + copy cleanup — fourth bucket of the v0.57 playtest response. No mechanical changes; six legibility issues addressed at the description/tooltip layer.
- **`src/cards.js` pair-combo copy stative.** Seven card descriptions rewritten from imperative `Pair with X (+N each)…` to stative `+N each when paired with X. …`. Affected: Slurvin, Vorzak, Molborg, Lithvorn, Squorble (round-gated form preserved: `R1–9: −30 (dormant). R10+: +120 each when paired with Stellorb…`), Stellorb (`R10+: +120 each when paired with Squorble…`), Vorbex.
- **`src/cards.js` Vexborg + Clattorb.** Both cards form a real pair-combo (Carapace Lattice, +50 each) per `src/combos.js` but neither's description ever mentioned it. Added: Vexborg `+18 per other Chitinous on board. +50 each when paired with Clattorb.`, Clattorb `Inactive rounds 1–5. +50% score from round 6+. +50 each when paired with Vexborg.`
- **`web/app.js` archetype tooltips (new).** Added `ARCHETYPE_INFO` map (eight archetypes → trigger requirement) and `makeArchetypeTooltip(name)` factory. `updateArchetypeDisplay` rewritten from `el.innerHTML = ...` template to DOM construction so each chip can `appendChild(tooltip)` with a hover handler that calls existing `clampTooltipH` for viewport snapping. Tooltip body: name (bold purple) → "Triggered: <req>" → italic note clarifying that archetypes label the build pattern, not bonuses (the actual points come from the species/class/star synergies displayed above).
- **`web/style.css` `.archetype-chip` + `.arch-tooltip`.** New `.archetype-chip { position: relative; cursor: default; }` shared by primary + secondary chips so the absolutely-positioned tooltip has a containing block. `.arch-tooltip` extends `.aug-tooltip` but with `top: calc(100% + 6px) !important` and `bottom: auto !important` so it drops below the chip (HUD bar is at the top of the screen, opposite of augment-badge which sits low). Without `!important` the inherited `.aug-tooltip { bottom: calc(100% + 6px) }` combines with my `top` to lock the absolute element's height between top+bottom — collapsing the box to ~16px (verified the bug live in browser before adding `!important`). New `.arch-tt-name/req/note` rules style the three-line body. Mirror `.tooltip-left/right` rules for clamp-flip.
- **`web/app.js` augment-badge persistence wording.** `renderAugmentBadges` now writes `<div class="aug-tt-desc">${aug.description}</div><div class="aug-tt-meta">Applies for the rest of the run.</div>` into the tooltip span (was plain `tt.textContent = aug.description`). New `.aug-tt-desc/.aug-tt-meta` CSS — the meta line gets a separator border, green tint, italic, smaller font.
- **`src/judges.js` Eccentricity hint.** Was `'Cards whose passive activated this round score ×1.6'` (player couldn't tell which cards count — playtest specifically flagged "Clattorb? unclear"). Now `'×1.6 to specimens whose adjacency, pair-combo, round-timing, or aura passive fires this round'` — concrete categories. The taste mechanically rewards: adjacency passives that pay out (Slurvin/Vorzak/Molborg/Lithvorn/Squorble/Stellorb/Vorbex), pair-combo participants, axis-4/6/8 passives whose result is non-trivial (Clattorb at R6+, Squorble at R10+, Stellorb, Sprangus aura, Fluxnob aura). All four categories named in the hint cover the actual triggers.
- **`src/augments.js` Mastery Protocol.** Description was `'All multiplicative passives (Axis 4, 6, 6+4) gain +0.1 to their multiplier'` — `Axis 4, 6, 6+4` is internal taxonomy. Now `'All multiplier passives gain +0.1 to their multiplier'`. Same meaning, no jargon.
- **`web/index.html`:** v0.60 → v0.61, loader cache-bust 0.60 → 0.61.
- **Jargon audit (`axis | 5-tag | auraMult | axis5`):** zero hits across user-visible strings (`src/cards.js`, `src/items.js`, `src/augments.js`, `src/judges.js` — all matches are internal property keys, code comments, or sim heuristics that never surface). Mastery Protocol was the last leak.
- **Browser-verified (v0.61):** Page loads with v0.61 tag and clean console. `ACB.cards.CARD_DEFS` shows new pair-combo descriptions for Slurvin/Stellorb/Vexborg/Clattorb. `ACB.judges.TASTES.eccentricity.hint` returns the new string. `ACB.augments.AUGMENT_DEFS` Mastery Protocol description is jargon-free. Synthesized archetype chip + tooltip in DOM: with `display: block` forced, span > div tooltip box renders 106px tall (3 content lines) with proper padding/border — confirmed `!important` override fixes the top+bottom height-lock that initially collapsed the box to 16px. Augment-badge tooltip with desc + meta lines renders 66px tall, green meta line under separator. No console errors.
- **Open question dispositioned:** the v0.57 playtest left a "does the Eccentricity taste survive?" question on D's docket. Resolution: keep it; the hint was the bug, not the taste. Re-evaluate after v0.61 playtest reads the new wording.
- **Known follow-ups:** archetype tooltips clarify that chips are *labels*, not stand-alone bonuses — but if future playtest still reads them as expected to mean "extra points", we may need to either give them real effects or rename them to something less mechanical-sounding (e.g. "Build pattern" instead of "Build"). Defer until next playtest signals.

**Phase 33-B.3.C v0.60 (2026-05-04):** Scoring transparency — third bucket of the v0.57 playtest response. Three opacities the playtest flagged are now closed.
- **Diagnosis:** (1) `showChapterReveal` in `web/app.js` was a 2.4s auto-fade overlay with `pointer-events: none` — players couldn't read the taste rule before clicking through. (2) The scoring modal showed each card as a single `+SCORE` float; per-card lines were *captured* in `breakdown.perCard[i].lines` (Stage-0/1/2 in `Board.calcBaseBreakdown`) but never *rendered*. (3) The judge taste rule (Narrative held-rounds, Refinement/Quaintness/Architecture/Grotesquerie tag mults, etc.) had zero per-card visibility — `taste.score()` returned only a global total.
- **`src/judges.js` `tasteLineBreakdown(tasteId, active, baseScores, ctx)`:** new sibling helper that mirrors each taste's per-card logic and returns `{ perCard: [{ final, lines }] }`. `final` is the un-rounded post-taste per-card score; `lines` is `[{ label, mult|add }]` describing the taste's contribution to that card. Eleven taste branches handle their per-card rules: Spectacle (top exhibit ×3 / off-piece ×0.9), Diversity (per-card 1.0 / 0.6 + global ×(1+0.18·unique)), Restraint (per-card mult by board size + flat empty-plinth credit on first card), Eccentricity (×1.6 only when fired), Narrative (`Held N round(s) ×1+0.08·N`), Harmony (×1+0.45·(maxClass-1)), Grotesquerie/Refinement/Architecture/Quaintness (max-mult tag / min-mult tag / default), Ostentation (tier mult ×× tag mult, both lines emitted). Sum of `Math.round(final)` may drift from `taste.score(...)` by 1–3 (taste rounds once at the end); the `score` total remains authoritative for round outcomes.
- **`src/game.js` scoreBreakdown reshape:** after `taste.score(...)` produces the authoritative `playerScore`, also calls `tasteLineBreakdown` and folds each card's taste lines onto its existing per-card lines. `final` becomes the rounded per-card taste-adjusted score (was `baseScore` — unchanged for tastes with global mults, more accurate for per-card-mult tastes like Narrative and tag tastes).
- **`web/app.js` `makeScoringCard(card, breakdownEntry)`:** now accepts the breakdown entry and appends a `.sc-breakdown` tooltip listing the header (`${card.name} · ${final}`) and one `.sc-bd-row` per line (label left, `×N` or `+/-N` right). `showScoringModal` builds a `card → breakdownEntry` Map (so allocation reordering can't mis-pair) and threads each entry to its scoring card.
- **`web/app.js` `showChapterReveal` + `showGrandFinaleReveal`:** removed the `setTimeout` auto-fade. Both now append a `<button class="btn-primary chapter-reveal-continue">Continue →</button>` to the overlay markup and bind two dismiss paths — Continue button click, or backdrop click (event target === overlay). Pattern matches `showModifierReveal` / `showRivalReveal` / `showJudgeSlateReveal`.
- **`web/style.css` `.chapter-reveal`:** replaced `pointer-events: none` with `cursor: pointer` so clicks land. New `.chapter-reveal-continue` rule sizes the button. New `.sc-breakdown` + `.sc-bd-header/row/label/val` rules: absolute-positioned popover above each scoring card, `opacity: 0` at rest, `:hover` reveals at `opacity: 1` with 120ms fade. Width 180–260px, dark background, gold-tint header.
- **`web/index.html`:** v0.59 → v0.60, loader cache-bust 0.58 → 0.60.
- **Math sanity sweep (6-card board, n=11 tastes):** drift between `sum(round(perCard.final))` and `taste.score(...)` total: spectacle +1, diversity -1, restraint -1, eccentricity -1, narrative 0, harmony 0, grotesquerie +1, refinement +2, architecture +1, quaintness 0, ostentation 0. All within ±2 of the rounded total — acceptable for display.
- **Sim sanity (greedy n=200 seed=1):** 45.5% survival vs v0.59's 46% — within seed noise. Scoring math untouched; only labels added.
- **Browser-verified (v0.60):** Scoring modal hover on each card shows lines like `base 76 × 1★ +76`, `crystal harmonics +25`, `Curator's Pet × 1.25 +25`, `Quaintness: default ×1.4`. Sum of three card finals (176+55+33 = 264) matched the authoritative scoring total displayed under Auntie Mossfen ("Threshold met! 264 ≥ 84"). Synthesized chapter-reveal had `pointer-events: auto`, `cursor: pointer`, `z-index: 1000`; Continue button click and backdrop click both removed the overlay. No console errors.
- **Known follow-ups:** the Eccentricity hint ("Cards whose passive activated this round score ×1.6") still doesn't tell the player *which* cards' passives count as activating — flag for Bucket D. Per-card hover currently hides during the punch animation (no `pointer-events`); acceptable since the animation is brief, but could be promoted to always-visible in a later pass.

**Phase 33-B.3.B v0.59 (2026-05-04):** Generous-modifier bite pass — second bucket of the v0.57 playtest response. Each of the four generous modifiers paired with a downside that keeps the headline benefit feeling generous while adding bite the player can play around. Sim baseline (post-v0.58 rival nerf, n=200 greedy): Bull Market 57%, Generous Patron 77.5%, Stipend 51%, Curator's Pet 48.5% — only Generous Patron meaningfully out of band, but playtest 5W/0L flagged all four as soft.
- **`src/modifiers.js` four bites:**
  1. **Bull Market** — `interestCap: 3` added (banking ceiling 25g→15g). Free rerolls intact. Description: "Re-rolling the Specimen Market is free. Interest caps at 3 ✦/round (max 15 ✦ banked)."
  2. **Generous Patron** — `benchTaxAbove: 5, benchTaxPer: 2` added. Bench specimens past 5 cost 2 ✦/round each. +2/round income unchanged. Description: "+2 ✦ each round. The patron deducts 2 ✦/round per bench specimen above 5."
  3. **Curator's Stipend** — `refitPremium: 3` added. Every Refit action (peek 10→13, swap 20→23, promoteT1 25→28, promoteT2 60→63) costs +3 ✦. +6/chapter unchanged. Description: "+6 ✦ at the start of each new chapter (R9, R17, R24). Refit actions cost +3 ✦ each."
  4. **Curator's Pet** — favored mult 1.4→1.25; scorned 0.7 unchanged. Reduces the favored ceiling that human players intentionally lean into (the sim doesn't differentially target favored species, so playtest data drove this not sim).
- **`src/game.js` `Player.earnIncome` + `incomeBreakdown`:** new `interestCap` reads override `MAX_INTEREST` per run; new `_benchTax(mod)` method computes `max(0, bench.length - benchTaxAbove) * benchTaxPer` and is subtracted from total income. `incomeBreakdown` now exposes `benchTax` + folds it into `modBonus` so the HUD shows the deduction.
- **`src/refit.js`:** new `RefitState._premium()` reads `mod.refitPremium`; `peekCost / swapCost / promoteCost` add it. Single source of truth for the bump.
- **`src/sim.js`:** new `capFloor(run)` helper replaces every hardcoded `INTEREST_CAP_GOLD` reference (4 sites) — `freeBenchIfStuck`, `buyBestCard`'s `wouldDipBelowCap`, the greedy reroll loop's `overflow` calc, and `smartGreedyCore`'s reroll cap-floor check. Without this the sim under Bull Market would still protect 25g while the actual cap is 15g, distorting the sweep.
- **`web/index.html`:** v0.58 → v0.59, loader cache-bust.
- **Sim sweep (n=200 per cell, post-bites):**
  - greedy: bull 62 / generous 53 / stipend 51 / pet 45 (no-mod baseline 46)
  - chitinous-stack: bull 46 / generous 42 / stipend 37 / pet 32 (no-mod baseline 30.5)
  - wide: bull 72 / generous 56 / stipend 68 / pet 60 (no-mod baseline 64)
- **Bull Market sim quirk:** survival went UP (57→62) under interestCap shrink. Reason: sim's cap-floor protection (don't dip below cap) now allows buying down to 15g instead of 25g — the AI rationally spends more under a worse banking environment, which improves board strength. The bite is *human-feel*: a banking-disciplined player loses 4g/round at the ceiling (10→6 with Tycoon, 5→3 without), ~96g over a 24-round run. Sim adapts; humans who try to bank don't. Acceptable — the modifier still reads "generous" (free rerolls) with a cost (banking ceiling lower).
- **Stipend sim quirk:** survival unchanged (51→51) because sim doesn't run the refit phase. Refit premium is a human-only bite. The headline +18g/run from chapter stipends roughly balances ~9 refit acts × 3 ✦ = 27 ✦ of premium, so net gold is slightly negative — but the friction (can-I-afford-this-action) is the design intent, not net gold change.
- **Curator's Pet sim quirk:** sim doesn't lean into favored species, so 1.4→1.25 only shifts baseline. Real impact is on humans who deliberately commit to favored — their ceiling drops from +40% to +25% headroom. Playtest will validate.
- **Punishing-modifier sanity check (greedy n=200):** Hothouse 20%, Lean Economy 32%, Pop-up Salon 28%, Brutal Curation 44%, Blind Tasting 46%, Late Reveal 45%, Tag Amplification 50% — all untouched and in their existing bands.
- **Browser-verified (v0.59):** All 4 modifier defs expose new fields. Synthetic earnIncome trials: Bull Market at 100g earns +8 ✦ (was +10), interest line shows 3 not 5. Generous Patron with 8 bench earns +1 ✦ (base 5 + flat 2 - benchTax 6); with 4 bench earns +7 ✦ (no tax). Stipend RefitState peek=13/swap=23/promoteT1=28/promoteT2=63; chapter stipend +6 fires correctly at R9 start. Curator's Pet `cardScoreMult` for favored species returns 1.25. No console errors.
- **Known follow-ups:** Patron Subsidy (Cheap Plinths) reads 61% greedy / 73% wide — not in this bucket's scope (plan didn't flag it) but slightly hot; flag for next playtest read. Stipend's wide 68% is over band but human-only refit-premium bite isn't sim-measurable; defer to playtest. The redundant chapter-end `updateAggression` from 33-B.3.A still pending cleanup.

**Phase 33-B.3.A v0.58 (2026-05-04):** Rival threat layer — first bucket of the v0.57 playtest response. Reverses Phase 29's ≤10% Buster-principle aggro cap that the second playtest read as no-pressure.
- **Diagnosis:** Phase 29 designed the rival as *invisible* DDA pressure (`AGGRO_HIGH=0.10`, "sub-perception by design"). Playtest data confirms aggro DID escalate to 0.10 routinely (3 blowouts/chapter in mid-game easily met) — but a 10% score-bias only flips ties, so picks never visibly contested. Both notes ("never feel pressure", "didn't pay attention") and data (rival picks scattered across off-species cards, never overlapping with player's Chitinous build) agreed. The principle was misapplied: ≤10% is the *difficulty* threshold, not the *visibility* threshold.
- **`src/rival.js`:** new aggro range [-0.20, +0.50] with named buckets — `AGGRO_DISTRACTED`, `AGGRO_WATCHING`, `AGGRO_HUNTING (+0.25)`, `AGGRO_PEAK (+0.50)`. New `updateAggressionPerRound({ passed, scoreOverTarget })` — strong rounds (≥+40% over target) bump aggro +0.10; passing rounds (≥+10%) bump +0.04; failures decay 0.15 toward distracted. Old `updateAggression(chapterRecord)` retained but now only triggers the hard reset on ≥2 chapter losses; positive escalation is per-round. New `threatLevel()` returns `'distracted'/'watching'/'hunting'/'pouncing'` for HUD bucketing. Mimic now reads `ctx.playerBoughtThisRound` — last-bought species *this round* (not stale dominant-species majority); falls back to dominant species. Specialist first-pick adds +1500 score to player's dominant species when aggro ≥ Hunting + not yet locked — preserves "lock and ignore" identity but creates contest when player is winning.
- **`src/game.js`:** Run constructor adds `_playerBoughtThisRound = []`. `runBattle()` passes the array via `rivalCtx.playerBoughtThisRound`, then calls `rival.updateAggressionPerRound({ passed, scoreOverTarget })` after the round — *before* the chapter-end reset hook. Array is cleared after rival picks read it.
- **`src/shop.js`:** `Shop.buy()` pushes `card.species` to `this.player.run._playerBoughtThisRound` on successful buy. Wires both UI and sim paths uniformly.
- **`web/app.js`:** `renderRivalPanel()` aggro indicator replaced — was conditional `↑ keen` text on non-zero, now an always-visible threat pill with bucket text and tooltip describing threat level.
- **`web/style.css`:** `.rival-aggro` extended with `.threat-distracted` (blue), `.threat-watching` (gray, neutral), `.threat-hunting` (red-orange), `.threat-pouncing` (gold-glow, peak threat).
- **`web/index.html`:** v0.57 → v0.58, loader cache-bust.
- **Calibration (n=200 per policy, no modifier):**
  - greedy 46.0% (was 50.5%, -4.5pp — in band, lower edge)
  - chitinous-stack 30.5% (was 40.0%, **-9.5pp — bite landed exactly where playtest pointed**)
  - sporal-stack 59.0% (was 58.0%, +1.0pp — Sporal cards cheap, rival contestation absorbs)
  - wide 64.0% (was 60.0%, +4.0pp — wide doesn't lean on a single species)
  - abyssal-stack 40.0% (was 43.0%, -3.0pp)
  - crystalline-stack 14.0% (was 20.5%, -6.5pp — already weakest, now worse; flagged for future targeted playtest)
  - plasmic-stack 16.5% (was 23.5%, -7.0pp — same)
- **Aggro ramp trace (greedy seed=7):** R1 +0.04 (Watching) → R3 +0.24 (Hunting) → R7 +0.50 (Pouncing) → held through R24. Pill flips at the right moments: Watching → Hunting after one strong round; Hunting → Pouncing after sustained dominance.
- **Browser-verified:** v0.58 loads. `ACB.rival` exposes new constants. Threat pill renders all 4 states with distinct colors (Distracted rgb(109,164,214), Watching gray, Hunting red-orange, Pouncing gold-glow). Mimic correctly contests Crystalline Geodorb when player just bought Crystalline; falls back to Sporal Sporvik with no buys this round but Sporal-dominant board.
- **Known follow-ups:** Crystalline 14.0% / Plasmic 16.5% are now meaningfully out of band — but v0.57 playtest didn't test them. Defer to a targeted playtest before adding species buffs (don't pile fixes on top of fixes without a read). The chapter-end `updateAggression` is now redundant for positive escalation; consider folding it into the per-round hook in a future cleanup.

**Phase 33-B.2.1 v0.57 (2026-05-03):** R1–R24 target curve recalibrated against the post-33-B.2.0 sim. Greedy was hitting 89.5% survival on the v0.56 curve; design target band is 30–45%. New scaling: R1–3 ×1.24 (light bump — keep "opening trust" easy), R4–7 ×1.34 (early ramp), R8–24 ×1.40 (the bulk of the bump, where banked-economy ceiling actually compounds).
- **`src/game.js` `ROUND_TARGETS`:** all 24 entries replaced with computed values. Both `target` and `preferredTarget` scaled by the same per-round multiplier so the 0.85 ratio is preserved.
- **`web/index.html`:** v0.56 → v0.57, loader cache-bust.
- **Calibration (n=200 per policy, no modifier):**
  - greedy 50.5% (was 89.5%) · 30% perfect — at upper edge of band, accepted
  - chitinous-stack 40% · 23.5% perfect — squarely in band
  - sporal-stack 58% · 39.5% perfect — slightly above, accepted (Sporal genuinely strong)
  - abyssal-stack 43% · 27.5% perfect — in band
  - crystalline-stack 20.5% · 6.5% perfect — *genuine species weakness now visible*
  - plasmic-stack 23.5% · 9% perfect — *genuine species weakness now visible*
  - wide 60% · 38.5% perfect — slightly above, accepted (skilled-style policy should beat single-species commits)
- **Per-round profile (greedy n=300):** R1–3 97–99% pass (opening trust), R4–7 94–96% (early ramp), R8 critique 86.1% (first real checkpoint), R11–12 80–82% pass (first kill-zone), R17–19 82–83% (second pressure window), R20–23 89–93% (banked gold pays off), R24 finale 65.2% (real boss test). The kill-zones cluster around just-past-critique rounds, where the prior chapter's gold sink (Refit) leaves the player relatively thin before the next ramp.
- **Browser-verified:** v0.57 loads, R1 raw target 124 → displays "Target: 84" (= 124 × 0.68 judge scale). HUD shows `Round 1 / 24` + `⚙ Lean Economy` + `Target: 84`. Console clean. R8/R16/R24 raw targets 1400/3360/5880 → in-game thresholds 952/2284/3998.
- **Note:** Phase 27's `judgeScale = 0.68` post-multiplier is still applied at scoring time (`src/game.js:457`) — both raw curve and judge-scale compound to the gameplay threshold. Sim and game share this code path so calibration sweeps reflect actual gameplay.
- **Known follow-ups:** the 0.68 judge-scale layer should eventually go (Phase 27 leftover; comment says "Phase 31+ replaces this with explicit per-judge thresholds" — never happened). Crystalline + Plasmic buffs are the genuine remaining species imbalance; defer until the second playtest confirms greedy's 50% reading.

**Phase 33-B.2.0 sim overhaul (2026-05-03, no version bump — sim-only):** First human playtest read (9 runs, all v0.56) showed 9/9 wins, 8/9 perfect 3-life, peak appraisals 3969–10165, late-game pass rates routinely 150–300% of target. Player flagged that the sim was capturing none of this: their strategy (park at 25g interest cap, sell low-EV bench cards, reroll 9–23× when banked, commit hard to one species) had no analog in the AI policies. Investigation confirmed: greedy at 36% / chitinous-stack at 48.5% / sporal-stack at 19% were all sim artifacts, not balance facts.
- **`src/sim.js` heuristic rewrite (the user's economy model, codified):**
  1. **25g cap-floor protection in `buyBestCard`** — won't buy if it drops below 25g (= `MAX_INTEREST × INTEREST_PER`, the doubled-passive-income parking spot). Overrides: combine target (3rd copy of existing 1★/2★), T3 anchor, score-behind for upcoming target, thin baseline (active < 3 cards). Replaces the old `saveForInterest` next-5-mark heuristic that missed the actual 25g floor entirely.
  2. **`isScoreBehind(player, round, run)`** — checks current board score vs upcoming target × 1.10 ("comfortable" = 110% of target). The score-behind override bypasses cap protection so the AI spends to survive.
  3. **`freeBenchIfStuck(player, bias)`** — when board is full (active 6 + bench 8 = 14) and gold > 25g, sells the lowest-EV non-item bench card to make room for combine fodder pulled from rerolls. Filters out item-bearing cards and 2★+ on-bias-species cards. Compares vs active median × 0.7 to avoid selling decent fodder. Models the `sell:[…]` actions visible in every late-game digest round.
  4. **Uncapped reroll loop** — old code capped at 1 (or 3 with Midas). New loop is gated by gold-floor (`gold - rerollCost ≥ 25g` or score-behind), bounded by `ROLL_HARD_CAP=30` only as an infinite-loop guard. Matches the 9–23 rerolls/round seen in late-game banked rounds.
  5. **Species/class bias bumped from +20 to +60** — the +20 was being beaten by `sameSpecies × 10` once any species established 2–3 cards, so chitinous-stack drifted into mixed Sporal/Crystalline boards. +60 dominates and keeps the policy committed.
  6. **Bug fix:** card id property is `_id`, not `id`. Old `freeBenchIfStuck` calling `player.sell(worst.card.id)` was a silent no-op that turned the sell loop into an infinite spin. Now uses `_id` and checks the return value.
  7. **`MAX_INTEREST` exported from `src/game.js`** so the cap floor reads from the canonical constant rather than a magic number.
- **Sweep results (n=200 per policy, no modifier):**
  - greedy 89.5% (was 36%) · 84.5% 3-life
  - chitinous-stack 87.5% · 74.5% 3-life — *not the dominant build*
  - sporal-stack 96.5% · 90% 3-life — Sporal isn't weak; Phase 33-A "still below band" was a sim artifact
  - abyssal-stack 84.5% · 78% 3-life
  - crystalline-stack 71.5% · 51% 3-life — genuinely the weakest
  - plasmic-stack 74% · 56.5% 3-life — second-weakest
  - wide 95.5% · 88% 3-life
- **Per-modifier sweep (chitinous-stack, n=100):** Hothouse 68%, Lean Economy 69%, Pop-up Salon 74% — actually-hard modifiers. Bull Market 95%, Cheap Plinths 94%, Generous Patron 94% — too generous, drift into trivial range under banked play. Brutal Curation 85% — confirms playtest finding that auto-sell of lowest doesn't bite skilled play (player just absorbs the loss and the merged top-3 power through).
- **Implications for prior calibration:** every per-policy reading in DESIGN_LOG before this fix was measured against a sim under-banking 80–100g per run. Phase 31-A target curve targets are 30–40% too low. Phase 33-A "Sporal still below band" was wrong (sporal is fine; Sprangus self-flat fix was sufficient). "Chitinous runaway-dominant" reading was wrong (Chitinous is mid-pack; the user's 6/9 mono-Chi finales reflect player convergence under one good seed, not species OP-ness). The actual species spread is now Crystalline/Plasmic 71–74% vs everything else 84–96% — a meaningful gap, but secondary to the curve-pacing fix.
- **Trust the new sim, distrust the old numbers.** When DESIGN_LOG cites a percentage from a sim run before 2026-05-03, treat it as suspect. Re-run via `node -e "..."` against current sim before making decisions on top of it.

**Phase 33-B.1 v0.56 (2026-05-02):** Tag legibility surface — durable visibility for Phase 28 aesthetic tags before the first human playtest read.
- **Diagnosis:** the player couldn't see whether any given card was Grotesque/Elegant/Bizarre/Restrained/Ostentatious/Quaint. With 5 of 11 tastes reading tags, the *curate* loop was reduced to "trust the score number" — players saw mults appear in the breakdown without ever knowing which tag triggered them. Buy decisions in the shop were made blind.
- **Constraint (user-stated):** "the real game isn't going to have cards anyway." Card UI is placeholder; whatever solution I picked had to survive an art pass. Decorating the card face was wrong. The information needs to live in layers that stay readable when cards become 3D figurines, paintings, or whatever the salon shows.
- **Architecture:** three layers, each art-pass-proof.
  1. **Hover tooltip** (durable) — extended `makeSynergyTooltip()` with an "Aesthetic" section listing native tags + item-granted tags. Granted tags get a dashed-border chip so the player remembers detaching the item removes the tag.
  2. **Bottom-edge tag stripe** (peripheral, throwaway-friendly) — 3px colored segment row at the card bottom, one segment per tag. Native = solid; granted = diagonal stripes (matches existing item-pip dashed convention). Cheap to remove when cards go away.
  3. **HUD aggregate pill** (`#hud-tags`) — colored chips showing the active board's tag spread (e.g. `Bizarre·2 · Restrained·1`). At-a-glance "is my board on-taste?" read without inspecting every card. HUD-tier so it survives any visual representation.
- **Tag→color palette (`web/style.css` `.tag-grotesque` / `.tag-elegant` / etc.):** each tag's color is the *home taste's* color band from Phase 32. Grotesque = Grotesquerie green (#6b8f3a). Elegant = Refinement pale-blue (#a8d8f0). Bizarre = Eccentricity cyan (#5fd4f4). Restrained = Architecture cool-gray (#b0b8c2). Ostentatious = Ostentation pink (#f490d8). Quaint = Quaintness sage (#a8c97f). Player builds *one* color map (judge band → tag chip → tag stripe) instead of three separate ones — direct application of `synergy-thematic-design.md`'s "1 + 1 > 2" via consistent color encoding.
- **Hick's Law check:** card was already at 7–8 information layers (over the 3–6 optimum). Did NOT add visible text — only one new visual layer (the 3px stripe is a peripheral cue, not a primary read element). Tooltip is on-demand and doesn't count against the at-rest layer budget. HUD pill replaces zero-visibility with one-glance.
- **Why text chips not glyphs in the tooltip + HUD:** tags are abstract concepts (Quaint vs Restrained — no obvious visual metaphor) and there are only 6 of them. Color-coded text is fast to scan, requires zero icon-learning, and matches the per-taste color bands the player already learns at chapter reveal.
- **`web/app.js`:** `cardHasGrantedTag` + `TAGS` imported from `ACB.items`; `makeSynergyTooltip()` adds the Aesthetic section after Effect; `makeCard()` appends `.card-tag-stripe` with one `.tag-seg` per tag (native-then-granted order); new `renderTagMix()` populates `#hud-tags` from the active board's tags + granted tags, called from `render()`.
- **`web/index.html`:** `#hud-tags` span added to `#hud-sub` row; v0.55 → v0.56, loader cache-bust.
- **`web/style.css`:** `.tag-{name}` palette (6 colors), `.tag-chip` (rounded pill, semi-transparent fill, 1px solid border, dashed border for `.tag-granted`), `.card-tag-stripe` + `.tag-seg` (native solid; granted diagonal-stripe via `repeating-linear-gradient`), `.hud-tags` (inline-flex chip row).
- **Browser-verified (v0.56):** Round 1 fresh game, modifier=Hothouse Anomaly, rival=Specialist. Vexborg shop card has 2-segment stripe (Bizarre cyan + Restrained gray), tooltip shows chips `Bizarre`, `Restrained`. Active board after 3 buys: Vexborg/Blinxorp/Gloopir all have stripes (segCount 2/1/1). HUD pill renders `Bizarre·2 · Restrained·1 · Grotesque·1`. All segment background colors match the palette (Bizarre seg = `rgb(95, 212, 244)` = #5fd4f4 ✓). No console errors.
- **Known follow-ups:** judge-aware highlight (taste-relevant tag glows on board cards) deferred — adds context-switching cost on top of an already-busy card. Re-evaluate after first playtest read on whether the static stripe + HUD aggregate is enough for the player to make tag-aware buy decisions, or whether the active judge needs to be physically pointing at "your good cards."

**Phase 33-B.0 v0.55 (2026-05-02):** RunLog telemetry refresh + digest tool — closes the Phase 27–33 gap in the v0.42 logger before the first human playtest read.
- **Diagnosis:** v0.53 runlog audit found three Phase 27+ features the logger never captured. (1) `S.run.modifier` (Phase 31-B.1) was nowhere in `meta` or events — no record of which of the 12 modifiers rolled. (2) `S.run.rival` (Phase 29) — picks were stored on `run.history[].rivalPicks` but never piped into the runlog; personality, aggro state, and gold all silently lost. (3) `card.tags` (Phase 28) — `snapshotCard()` dropped them, so tag-taste judges' score lines were uninterpretable in the readyState snapshot. File size was the second problem: a single 24-round run was 9,224 lines / 220 KB, near the limit of what one read can ingest.
- **`src/runlog.js`:** `meta.modifier` + `meta.rival` added to `reset()` and accepted by `startGame({ ..., modifier, rival })`. `snapshotCard()` adds `tags: Array.isArray(card.tags) ? card.tags.slice() : []` after `roundsSinceBought`.
- **`web/app.js`:** `newGame()` reads `S.run.modifier` (id/name + `modifierState` for Curator's Pet's randomized favored/scorned) and `S.run.rival` (personality id + name) and passes them to `startGame()`. `onReady()` after `runBattle()` emits a `rival_round` event capturing `picks` (from `S.result.rivalPicks`), `gold`, `aggressiveness`, `specializedSpecies`, and `boardSize`.
- **`scripts/digest_runlog.js` (new):** reads a raw runlog JSON and emits a Markdown digest on stdout. Header: version + seed + difficulty + modifier + rival + final result + augments + unlocks. Refits aggregate. Per-round one-liner: `R<n>* <Judge>[<taste>] | tgt <T> → <S> (<%>) ✓/✗ | top-3 cards | species mix | tags mix | level + gold`, then sub-lines for augment/item picks, action summary (buy/combine/sell/reroll×N/plinth/move×N/reorder×N/attach), refit acts, and rival picks. Verbose offers/scoreLines/bench arrays are dropped.
- **Smoke test on the v0.53 log:** 9,224 lines → 95 lines (97% reduction). Reads as a complete decision narrative — visible at a glance: R17 Auntie Mossfen flip lost a life (Quaintness taste punishing the Sharzak/Vexborg Crystalline+Chitinous stack), R18 mass triple-merge pivot (17 buys, 5 combines, 3 sells, 12 rerolls, 3 sells), R24 finale survived at 149%.
- **`web/index.html`:** v0.54 → v0.55, loader cache-bust.
- **Browser-verified (v0.55):** runLog meta exposes `modifier: { id: 'hothouse', name: 'Hothouse Anomaly', state: {} }` and `rival: { personalityId: 'specialist', name: 'The Specialist' }` from a fresh-page game; `snapshotCard(Sporvik)` returns `tags: ['Quaint']`; `snapKeys` includes `tags`; no console errors.
- **Unblocks:** Phase 33-B.1 — actual playtest read. Workflow is now: play a run → click 📥 to download `runlog-vX.YY-*.json` → `node scripts/digest_runlog.js <path> > digest.md` → hand the digest to me. Raw file kept verbatim for drill-downs.

**Phase 33-A v0.54 (2026-05-02):** Sporal completion pass shipped — Sprangus's bypassed aura converted to a Phase-30-style self-flat.
- **`src/cards.js` Sprangus:** `auraMult: 1.30, target: 'all-Sporal'` (axis 8, bypassed under judge mode) → `axis: 2, eval` returning `{ flat: 30 * n }` where `n` = other Sporals on board. Description now reads "+30 per other Sporal on board". Self-buff (anchor pattern), not aura — fits Blorpax/Vexborg shape and is honoured by `calcBaseBreakdown`'s axis-2 stage. Base 132 unchanged (the Phase 32 dead-anchor restoration).
- **Why self-flat (not auraFlat):** judge-mode `calcBaseBreakdown` only checks `auraFlat` for "fired" status — bonuses themselves are bypassed. An aura conversion would have been silently dead. Self-flat on the T3 anchor is the live pattern, sized to roughly match the old +30% aura's spread (~+150 to a 5-Sporal stack vs old ~+126–180 distributed).
- **Calibration (n=200, no modifier, seed=1):** Sporal-stack 38.0% (was 25.3% post-Phase-32, target band 30–45% ✓). Greedy 48.5% (was 35.7% in Phase 31-A baseline — drift partly from extra `n =` filter call, partly from Sprangus showing up in mixed greedy boards with 2+ Sporals). Other species: chitinous 48.5%, crystalline 38.5%, abyssal 52.0%, plasmic 32.0%.
- **Calibration (mixed-modifier, n=200×6 seeds):** greedy median 45% (was 41.3% in v0.53), range 36–45.5%; sporal-stack median 30.5% (was 25.3%), range 28.5–31.5%. Sporal-stack lower-edge of band, accepted — the 6-card cap and Sporal scarcity in the shop pool make a 5-Sporal-anchor build the natural ceiling. Greedy upper-edge — flagged for playtest.
- **Browser-verified (v0.54):** `ACB.cards.CARD_DEFS` Sprangus has `passive.axis === 2`, description "+30 per other Sporal on board". Built scratch board [Sprangus, Sporvik, Phlorbex, Puffzak, Molborg], `calcBaseBreakdown` returns Sprangus 252 (132 base + 120 flat) with line `+30 per other Sporal on board: +120`. No console errors.
- **Known follow-ups:** Puffzak's `auraMult: 1.15, target: 'other-Sporal'` (T2) is still bypassed but lower-impact; Sprangus alone moved Sporal-stack into band, so Puffzak conversion deferred until playtest reads it as needed. Greedy 45% median + Chitinous 48.5% are the two upper-edge readings to watch in human-playtest data before adding new generosity.

**Phase 32 v0.53 (2026-05-02):** Theme Pass shipped — UI/copy alignment + Quaintness taste (Sporal home judge) + Sprangus T3 dead-anchor fix. Full plan + outcome: `design_log/phase_32_plan.md`.
- **Bucket A — Renames (user-visible only, internal IDs untouched):** Score → Appraisal · Lives → Reputation · gold (g) → **Lustres (✦)** · Battle → Showing · Pre-round → Curating · "outscore" → "out-appraise" · Run Over → Dismissed · ⚔ Ready → Open Showing · "Target met/missed" → "Threshold met/missed" · "score breakdown" → "appraisal breakdown" · "the run ends" → "the salon dismisses you". 6 source files edited. Internal identifiers (`battleHistory`, `runBattle`, `gold`) deliberately unchanged per Hick's Law.
- **Bucket B — Judge data (`src/judges.js`):** all 20 judges carry `glyph` + `band` + `quotes.{opening, passing, scraping, failing}`. 80 prose lines. Quote tier picked at scoring time from `score / target` ratio (≥1.10 / 1.00–1.10 / <1.00). Per-taste color bands wired into chapter-reveal + slate-row text (11 bands). **No portraits** — `visual-player-guidance` says low-fidelity faces are worse than no faces.
- **Bucket C — Quaintness taste (`src/judges.js`):** new `quaintness` (Quaint ×2.2 max, Restrained ×1.55 secondary, Ostentatious ×0.7 penalty, default ×1.4). 2 new judges: Auntie Mossfen (any) + Dame Burrowick (finale). Tastes 10 → 11; judges 18 → 20. Diagnosis: Sporal native tags = Quaint ×5 of 6 cards; Quaint was the max-mult tag for **no existing taste** while every other species had a home taste. Antique Doily (Phase 31-B.3) already grants Quaint, no new item needed.
- **Sprangus T3 fix (`src/cards.js`):** stripped Sprangus's `baseOverride: 0` (Phase 28 leftover that zeroed its 132 base under judge mode where the +30% aura is bypassed). Single-card structural fix the calibration sweep made visible.
- **Bucket D — Audio audit:** no work needed. `web/sound.js` is theme-clean (24 synth SFX, no combat coding).
- **Calibration (n=200×6 seeds):** greedy mixed-mod 41.3% (was 28.5%, in 30–45% band). Sporal-stack 25.3% (was 19%, +6.3pp — measurable but **still below band**, flagged for Phase 33). Crystalline 34%, Chitinous 50.5% (above band, watch playtest), Abyssal 44.5%, Plasmic 32.5%.
- **Browser-verified:** v0.53 loads · 11 tastes · 20 judges with full schema · live R1 with Sister Umbra: HUD shows "Curating" + "17 ✦" + "Open Showing"; scoring modal renders "Threshold met! 275 ≥ 68 · Sister Umbra says: 'A devotional sparseness. The salon is hushed.'"; chapter-reveal for Auntie Mossfen renders 🌿 + mossy-green band.
- **Known follow-ups (Phase 33+):** Sporal-stack still 25%; Chitinous 50.5% may be runaway-dominant; greedy 41.3% on upper edge — don't add new generosity without recalibrating targets.


**Phase 31-B.3 v0.52 (2026-05-02):** Tag-granting items shipped — items become judge-aligned context-variable rewards.
- **Design call:** chose "curated subset" over "convert all" or "every item also grants a tag" (game-design-skills audit). Rationale: preserves Triangularity (flat-buff = predictable safe lane; tag-grant = high-variance lane), respects Hick's Law (single-effect items stay legible), and aligns with `reinforcement-feedback-systems.md` ("combine fixed + variable rewards"). Zero existing items converted; 6 new items added as a third axis-5 sibling alongside Taxonomy Badge (`'5'`) and Mood Tag (`'5-class'`).
- **`src/items.js`:** new `TAGS` array + `TAG_ITEM_NAMES` map. 6 new defs with axis `'5-tag'` and a `tag` field — Bone Reliquary (Grotesque), Crystal Locket (Elegant), Carnival Mask (Bizarre), Velvet Drape (Restrained), Gilded Frame (Ostentatious), Antique Doily (Quaint). New helper `cardHasGrantedTag(card, tag)` walks the card's attached items and returns true if any axis `'5-tag'` item carries the requested tag.
- **`src/judges.js`:** `cardHasTag()` now imports `cardHasGrantedTag` from `./items` and OR-checks both `card.tags` (native, Phase 28) and item-granted tags (Phase 31-B.3). All 4 tag-tastes (Grotesquerie, Refinement, Architecture, Ostentation) automatically pick up the new readout — no taste functions touched.
- **Acquisition path:** new items join the existing `pendingItem()` offer pool via `getAvailableItems()`. Pool grew from 19 → 25 (sim-mode, no locked items) and from 23 → 29 (full pool). Item-pick offers are uniform random over the pool; with 6/25 = 24% per-slot probability of a tag-grant item, 3-pick offers contain at least one ~58% of the time. Decided against weighting offers toward upcoming-judge tastes — keeps the phase tight and lets the player make the judge-aligned read manually.
- **Re-aim verified (Sporvik / Sporal / native Quaint):** under Refinement at base 100, no item → 155; with Crystal Locket attached → 220 (+42%, Elegant 2.2× max-mult fires through item-granted tag). Architecture / Slurvin / no native Restrained: 145 → 240 with Velvet Drape (+66%, Restrained 2.4× max-mult). Both confirm the design intent: a "wrong-taste card" can be re-aimed via item attachment.
- **Native-tag interaction is additive, not overriding:** Vorzak (native Grotesque) + Crystal Locket (Elegant grant) under Refinement still scores at the Grotesque min-mult (0.75) because Refinement applies `Math.min(m, 0.75)` after `Math.max(m, 2.2)`. Intentional — items add a reading, they don't scrub native identity. To re-aim *into* a hard taste, players need a card whose native tags don't carry a min-mult penalty.
- **`web/index.html` + loader cache-bust:** v0.51 → v0.52.
- **Calibration (greedy n=200 seed=1, no modifier):** survival 28.5% (was 30.7% in v0.51); multi-seed (200×6 starts) median ~30%, range 28.5-34.5%. Sits on lower edge of 30-45% target band — drift from v0.51 is consistent with greedy AI occasionally drawing tag-grant items into its 3-item offer and "wasting" a slot (greedy AI doesn't path future-judge alignment). Acceptable: design intent is the human-play upside, not the sim baseline.
- **Browser-verified:** `ACB.items.ITEM_DEFS.filter(i => i.axis === '5-tag')` returns 6 entries with correct id/name/tag fields. `cardHasTag(slurvin, 'Restrained')` returns false; after `attachItem(slurvin, 'Aesthetic: Restrained')`, returns true. End-to-end taste read: Refinement Sporvik 155→220 with Crystal Locket; Ostentation Vorzak 126→158 with Gilded Frame. v0.52 in HUD; no console errors; 66/66 unit tests pass.
- **Known follow-ups (deferred to Phase 32+):** offer-pool weighting to bias tag-grant items toward upcoming-judge tastes (one-line Refit-style change but adds context-variable bias on top of context-variable reward — defer for playtest read first). Sporal species rebalance is the bigger Phase 32 item.

**Phase 31-B.2 v0.51 (2026-05-02):** Exhibition Refit shipped — between-chapter gold sink to break the coasting hoard loop.
- **Calibration basis:** `scripts/profile_chapter_gold.js` (new) snapshots greedy AI gold-on-hand at chapter-end (n=300, seed=1, v0.50 baseline). Median 9g after R8, 82g after R16, 177g after R23. Confirms the diagnosis: interest-capped gold still piles up at R16/R23 with no sink.
- **`src/refit.js` (new):** Three actions — `peek` (10g, reveal next chapter judge's taste rule + hint), `swap` (20g, draft 1 of 3 from a Refit Pool, dismiss one current card at standard sell value), `promote` (25g for 1★→2★, 60g for 2★→3★, hard-capped at 1 per Refit). Refit Pool weighting: 60% biased to next judge's taste tags (`TASTE_TAG_BIAS` for the 7 tag-relevant tastes), 40% open. Tier weighting by chapter: R8→mostly T1, R16→T1/T2 mix, R23→T2/T3 mix. Excludes cards already on the player's board so Refit doesn't just hand back a free merge. `RefitState` class owns the per-Refit state machine (peeked, candidates lazy-drawn on swap-drawer open, promotedThisRefit cap, spentTotal telemetry).
- **`src/game.js`:** `Run` constructor initializes `_refitState = null` + `_refitRoundsResolved` set. `Run.runBattle()` chapter-end branch creates a `RefitState` after R8/R16/R23 scoring (no Refit at R24 — finale ends the run). New public methods `pendingRefit()` (returns the active state or null) and `closeRefit()` (player commits Continue, marks the round resolved). Sim path doesn't consult `pendingRefit()` so greedy AI silently skips — no rng drift, survival 30.7% unchanged from v0.50 baseline.
- **`web/app.js` `showRefitModal(refit, onDone)`:** single-overlay modal with three action cards + in-place subview expansion. Header shows the just-ended chapter label, the next chapter's judge name + flavor (taste rule hidden until paid Peek), and current gold. Subview renders are stateful: Swap shows 3 candidate cards (species-tinted, tags-badged) + a dismiss-target list (active+bench), confirm button enables when both selected. Promote shows eligible cards (1★/2★) with cost. Toast bar surfaces the most recent action result. Continue button always one-click; Skip path is just "click Continue without spending." `onContinue()` checks `pendingRefit()` after the curator branch, calls `showRefitModal` with a callback that runs `closeRefit()` + `startRound()`. Telemetry: `refit_offered` / `refit_peek` / `refit_swap` / `refit_promote` / `refit_closed` events into the runlog.
- **`web/style.css`:** `.refit-overlay` + `.refit-box` modal container; `.refit-actions` grid (3 columns), `.refit-action.disabled` / `.active` states; `.refit-cand` and `.refit-dismiss-card` species-tinted; `.refit-promote-card` grid. `.refit-toast` for action confirmations; sticky `.refit-footer` with Continue button.
- **`web/loader.js` + `web/index.html`:** `refit` module wired between `modifiers` and `game` (game.js requires it). v0.50 → v0.51, loader cache-bust.
- **Browser-verified:** v0.51 loads with `ACB.refit` exposing `{ REFIT_COSTS, REFIT_ROUNDS, TASTE_TAG_BIAS, chapterEnded, tierWeights, drawRefitCandidates, RefitState }`. End-to-end smoke test (forced run.round=8, 200g, board [Vorzak, Slurvin, Sharzak★★]): Peek paid 10g, revealed Architecture taste with hint; Swap drew 3 candidates with 2/3 Architecture-aligned (Vexborg Restrained, Sporvik Quaint, Krombax Elegant open-pool), dismissed Vorzak (+3g sell refund), acquired Sporvik (-20g); Promote upgraded Sharzak 2★→3★ (-60g), promote-cap activated. Final: 200 - 20 + 3 - 60 = 123g ✓; spentTotal=80g ✓.
- **Hick's Law check:** 4 actions visible (Peek/Swap/Promote/Continue) — within the 3–6 optimum band. Single in-place modal (no chained dialogs).
- **66/66 unit tests pass.**
- **Modifier interactions (deferred to playtest):** Blind Tasting + Refit interaction (free Peek?) and Late Reveal + Refit (R20 finale re-roll happens after R16 Refit) flagged in `src/refit.js` comments but not yet special-cased. Re-evaluate after first human run encounters them.
- **Known follow-ups (Phase 31-B.3 + later):** items become tag-granters; Refit Pool weights for non-tag tastes (diversity/narrative/harmony) currently fall through to uniform draw — could be improved with species/class bias. Brutal Curation modifier human-playtest read still pending from B.1. Toast bar overwrites between actions (only shows the most recent) — minor UX, defer.

**Phase 31-B.1 v0.50 (2026-05-01):** Run Modifiers shipped.
- **`src/modifiers.js` (new):** 12 modifiers + `pickModifier(rng)` + `getModifier(id)`. Hook surface (all optional): `cardScoreMult(card, state)`, `noInterest`, `incomePerRound`, `chapterStipend` + `chapterStipendRounds`, `plinthDiscount`, `rerollFree`, `shopSize`, `autoSellRounds`, `redrawFinaleAtRound`, `hideSlate`, `tagAmplify`, `init(run) → state`. `state` lets per-run randomized modifiers (Curator's Pet) lock in their picks at construction.
- **The 12 modifiers:**
  - *Constraints* — Hothouse Anomaly (Sporal ×0.5), Lean Economy (no interest), Pop-up Salon (4-slot shop), Brutal Curation (auto-sell lowest active at R6/12/18).
  - *Buffs* — Bull Market (free reroll), Patron Subsidy (plinth −4g min 1g), Generous Patron (+2g/round), Curator's Stipend (+6g at R9/17/24).
  - *Sideways* — Blind Tasting (slate hidden until each chapter), Late Reveal (finale re-rolled at R20), Discerning Eye (tag-taste mults spread ×1.5), Curator's Pet (random species ×1.4 favored / another ×0.7 scorned).
- **`src/game.js`:** `Run` constructor draws modifier (`this.modifier = pickModifier(this.rng)`) and runs `init()` if defined. Player gets back-ref `this.player.run = this` so `Player.earnIncome` / `Player.plinthCost` can read modifier hooks without prop-drilling. `runBattle()` wires: tagAmplify into taste ctx; finale re-draw at `redrawFinaleAtRound`; modifier+state into board `calcBaseBreakdown` ctx; auto-sell of lowest-scoring active card at `autoSellRounds` (items go to itemBag).
- **`src/board.js` `calcBaseBreakdown`:** applies `modifier.cardScoreMult(card, state)` to per-card scores after passive stages; logs as a per-card line for the breakdown modal.
- **`src/judges.js`:** all 4 tag-reading tastes (Grotesquerie, Refinement, Architecture, Ostentation) consume `ctx.tagAmplify` (default 1.0; Discerning Eye sets 1.5). Spread formula: `m_amp = 1 + (m - 1) * amp` — pulls high mults higher, low mults lower while leaving 1.0 fixed.
- **`src/shop.js`:** new `Shop.size()` reads modifier `shopSize` override (default 8). `refresh()` and `reroll()` call `size()`; `rerollCost()` returns 0 if `modifier.rerollFree`. Initial fill / refill / rotation logic all respect dynamic size.
- **`src/sim.js`:** `runGame(seed, policy, opts)` accepts `opts.modifier` (id) to pin a modifier or `opts.noModifier` to clear. Used for per-modifier calibration sweeps.
- **`web/app.js`:** `showModifierReveal()` modal at run start (Tonight's Twist · name · flavor · description; shows Curator's Pet's favored/scorned reveal). `renderModifierBadge()` persistent HUD pill (`#hud-modifier`). `startRound` reveal sequence at R1 is now: modifier (150ms) → slate or chapter-1 judge if `hideSlate` (1800ms) → rival (3300ms). `MODIFIERS` destructured from `window.ACB.modifiers`.
- **`web/loader.js` + `web/index.html`:** modifiers module wired; v0.49 → v0.50; loader cache-bust; `#hud-modifier` element added to `#hud-sub`.
- **`web/style.css`:** `.modifier-reveal*` modal styles + `.hud-modifier` badge.
- **Calibration (greedy n=200 per modifier, seed=1):** Hothouse 22% · Lean Economy 16.5% · Pop-up Salon 20% · Brutal Curation 41.5% · Bull Market 34% · Patron Subsidy 38.5% · Generous Patron 38% · Curator's Stipend 36.5% · Blind Tasting 34.5% · Late Reveal 34.5% · Discerning Eye 39% · Curator's Pet 38.5%. Mixed-modifier (random draw, n=300 across 5 seedStarts): 30.0–32.0% — sits on lower edge of the 30–45% band, accepted (constraint modifiers are intentionally the hard edge of the variance distribution). No-modifier baseline: 36% (rng drift from Phase 31-A's 35.7% is the one extra `rng()` call worth of drift).
- **Pop-up Salon retuning:** initial spec was 3 slots → calibrated to 13% survival → bumped to 4 slots → 20% survival. Kept as the harshest constraint in the pool.
- **Brutal Curation observation:** sim shows 41.5% (slightly above no-modifier baseline) — greedy AI doesn't mourn losing the lowest-scoring card; the bench refills the slot. For human play (where items are attached and selection is deliberate) the constraint should bite harder; revisit during playtest.
- **Browser-verified:** v0.50 loads with 12 modifiers in `ACB.modifiers`. Live R1 with rolled "Patron Subsidy" — HUD badge `⚙ Patron Subsidy` renders, plinth button reads "Upgrade Exhibit (4g)" (was 8g), modifier reveal modal stacks correctly above slate + rival reveals. Per-card mults verified via eval: Sporvik 52→26 under Hothouse (×0.5 Sporal); Slurvin 67→47 under Curator's Pet with Plasmic-scorned. Income breakdown reflects Lean Economy (interest=0) and Bull Market (rerollCost=0). Pop-up Salon shop fills 4 slots correctly.
- **66/66 unit tests pass.**
- **Known follow-ups:** 31-B.2 (Exhibition Refit) and 31-B.3 (tag-granting items). Brutal Curation needs human-playtest read; sim under-measures its bite.

**Phase 31-A v0.49 (2026-05-01):** Target curve recalibration shipped (Phase 31's hard prerequisite).
- **`src/game.js` `ROUND_TARGETS`:** R1–R9 unchanged (early game already paced). R10–R12 unchanged (cap=6 transition is healthy through R12). R13–R24 cut to match cap=6 score growth: R13 1950→1850 (−5%), R14 2250→2050 (−9%), R15 2600→2250 (−13%), R16 critique 2800→2400 (−14%), R17 3000→2600 (−13%), R18 3200→2800 (−12.5%), R19 3500→3000 (−14%), R20 3850→3300 (−14%), R21 4100→3500 (−15%), R22 4350→3700 (−15%), R23 4650→3900 (−16%), R24 finale 5000→4200 (−16%). New curve grows ~10%/round R8–R12, ~7–8%/round R12–R24, matching observed greedy median score trajectory under cap=6.
- **Diagnosis basis:** Per-round profile (n=300 seed=1) at v0.48 curve showed median Score/Target ratio collapsing from 1.40 at R12 → 1.04 at R19 → 0.87 at R24. R17–R19 were the kill zone (pass rate 56–66%) where players were eliminated *before* adjacency/pair-combos paid off. With cap=6, median greedy boards plateau in score growth ~+150–200 per round late, while old targets grew ~+374/round R14–R16 and ~+442/round R18–R20.
- **Calibration (n=300 seed=1):** greedy survival 35.7% (was 19.7%, target band 30–45% ✓). Per-round pass rate 88.7% (was 85.3%). New kill zone: R17–R19 70%, R23 85%, R24 51% (Grand Finale appropriately the toughest gate). Multi-seed stability: seeds 2/7/42/100/999 → 35.5/36.0/35.5/36.0/42.5% — comfortably in band.
- **Per-taste pass rates (n=500 seed=1):** Diversity 97.9, Narrative 97.0, Harmony 90.2, Grotesquerie 89.6, Spectacle 89.1, Eccentricity 88.8, Architecture 87.2, Ostentation 82.3, Refinement 75.0, Restraint 72.9. Hard tastes still hardest (Refinement and Restraint as designed); spread 73–98% within the engagement band.
- **Build dominance (n=200 seed=1):** greedy 35.5%, smart-greedy 34.0%, wide 37.0%, abyssal-stack 41.0% (+5.5pp), chitinous-stack 38.0% (+2.5pp), crystalline-stack 31.0% (−4.5pp), plasmic-stack 30.0% (−5.5pp), sporal-stack 19.0% (−16.5pp). Sporal underperforming under tag/judge regime — flagged for Phase 32 species/tag rebalance, not blocking. No runaway dominance.
- **`scripts/profile_targets.js` + `scripts/profile_tastes.js` (new):** calibration helpers used to diagnose the kill zone and verify the recalibration. Kept in repo for future curve passes.
- **Browser-verified:** `ACB.game.ROUND_TARGETS` reflects new values; v0.49 displayed in HUD; loader cache-busted.
- **66/66 unit tests pass.**
- **Known follow-ups (Phase 31-B):** modifier deck, interest cap, Exhibition Refit gold sink, tag-granting items.

**Phase 30 v0.48 (2026-05-01):** Plinth Composition shipped.
- **`src/game.js`:** `MAX_BOARD` 10 → 6. Spec originally targeted cap=5 (Hick's Law optimum band 3–6); calibration sweep (cap=5 → 12.3% greedy survival, cap=6 → 19.7%, cap=7 → 31%) showed cap=5 dropped the curve too far below the 30–45% target band the per-round flats were tuned for. Cap=6 keeps the design intent (40% reduction from 10, still in the Hick's optimum band) while leaving Phase 31's target-curve recalibration with a tractable gap to close. `PLINTH_COST` truncated to slots 3–6; `addPlinth()` and `plinthCost()` now gate on the cap.
- **`src/combos.js` (new):** 6 pair-combos. Vorzak↔Slurvin (+40 each, "Twin Fury"), Lithvorn↔Geodorb (+60, "Crystal Resonance"), Molborg↔Sporvik (+50, "Spore Feast"), Vexborg↔Clattorb (+50, "Carapace Lattice"), Squorble↔Stellorb (+120 at R10+, "Abyssal Coronation"), Blorpax↔Vorbex (+35, "Plasma Loop"). Each pair fires at most once per round; bonus is a flat added to *each* participant. Combos are flats only — no mults (the Phase 28 deprecation line).
- **`src/board.js`:** new module-level `applyAdjacencyStage()` runs as Stage 2.5 in both `calcScoreBreakdown` (legacy) and `calcBaseBreakdown` (judge mode). Reads `passive.axis === 'adjacency'` passives via `evalAdjacent(self, leftNeighbor, rightNeighbor, ctx)` (no wrap-around — slot 0's left and slot N's right are null) and pair-combos via `findCombosOnBoard()`. Adjacency + combo fires set `firedPassives[i] = true` so the Eccentricity taste reads them.
- **`src/cards.js`:** the 7 legacy %-mult passives (bypassed since Phase 28) converted to adjacency-axis flats:
  - **Vorzak** (Abyssal T1): solo menace +20 if no adjacent Abyssal.
  - **Slurvin** (Plasmic T1): rage +12 per neighbor (any species).
  - **Molborg** (Sporal T2): spore feast +20 if any adjacent Sporal.
  - **Lithvorn** (Crystalline T2): crystal harmonics +25 per adjacent Crystalline.
  - **Vorbex** (Plasmic T2 locked): plasma confluence +18 if both neighbors Plasmic.
  - **Squorble** (Abyssal T3): −30 R1–9 ("dormant"); R10+ +50 if any adjacent Abyssal ("awakened").
  - **Stellorb** (Abyssal T3 locked): R16+ +30 per adjacent Abyssal ("inevitability"). Pair-combo with Squorble at R10+ is the big payout.
- **`web/app.js` + `style.css`:** drag-and-drop on the active row. Filled slots are `draggable=true`; every slot is a drop target. On `dragover` of a slot, `runPreviewRecalc()` (rAF-debounced) builds a proposed-arrangement scratch board, runs `calcScoreBreakdown`, and writes the projected total to a "Live: N" pill in the HUD-sub bar. On `drop`, `swapActiveSlots()` commits and re-renders. `web/loader.js` registers `combos`; `web/index.html` cache-busts loader to v0.48 and adds the `#live-preview` span.
- **Calibration (n=300 seed=1):** greedy survival 19.7% (below the 30–45% band, accepted; Phase 31 target recalibration is the prerequisite remediation flagged in the next-action). Per-round winRate 85.3%. Permutation-gap test on a 5-card composition (Vorzak/Slurvin/Lithvorn/Geodorb/Sharzak) shows best-vs-worst ordering differs by 60–112% across all 10 tastes — far above the plan's ≥8% "position matters" threshold.
- **Browser-verified:** v0.48 loads with `combos` module + 6 entries. 3-card board [Vorzak, Sharzak, Slurvin] scores 210; dragging Vorzak's slot over slot 1 (proposed [Sharzak, Vorzak, Slurvin]) shows live preview "Live: 297" (Twin Fury combo +40 each = +87); dragging over slot 2 shows "Live: 210" (no combo). Drop commits the reorder. Drop-target outline + `.dragging` opacity render correctly.
- **Known follow-ups (deferred to Phase 31):** target-curve recalibration; live-preview is mouse-only (touch/keyboard a future polish). 66 unit tests still broken from Phase 27 (rewrite remains a Phase 32 chore).

**Phase 29 v0.47 (2026-05-01):** Visible Rival + persistent shared shop shipped.
- **`src/rival.js` (new):** `Rival` class with 4 personalities (Hoarder, Magpie, Specialist, Mimic). `pickFromShop(shop, ctx)` runs after the player's ready commit; returns the slot indices the rival claimed so the shop can null them. `updateAggression(chapterRecord)` applies Buster-principle DDA at chapter boundaries: ≤10% sub-perception score-bias on candidates whose species matches the player's dominant species (`AGGRO_HIGH=+0.10`, `AGGRO_LOW=-0.10`).
- **Specialist hard-commit:** locks species on first pick; off-species candidates filtered thereafter. **Bug fix during Phase 29:** the locking round is capped to 1 pick (otherwise the lock-setting first pick could be followed by an off-species second pick before the filter applied — caught in browser snapshot, fixed at [rival.js:148-154](src/rival.js#L148)).
- **`src/shop.js`:** SHOP_SIZE 5 → 8. Shop is now persistent across rounds; 2 cheapest unbought offers rotate per round (`ROTATE_PER_ROUND=2`). Lock toggle retired — persistence-by-default replaces it. `drawOne()` helper extracted; `drawOffers()` only used for initial fill. Rival cooldown/excludeSet plumbing removed.
- **`src/game.js`:** `Run` owns `this.rival = new Rival(pickPersonalityId(this.rng), this.rng)`. After `runBattle()`'s scoring resolves, the rival earns income (+5g/round, starts at 5) and picks. Per-round `history[].rivalPicks` records the names taken. Chapter-end hook builds a `chapterRecord` (passed + scoreOverTarget per round) and calls `rival.updateAggression()`.
- **`web/app.js` + `style.css` + `loader.js`:** `showRivalReveal()` modal at run start (1.8s after judge slate). `renderRivalPanel()` shows personality nameplate, tell, gold, aggro indicator, and mini-board. Shop renders 8 slots. `rival` module added to ACB bootstrap.
- **Phase 26 plumbing cut:** `rivalCooldowns`/`rivalFlags` removed from shop/game/app. The visible rival on a shared shop is the structurally correct version of "market scarcity."
- **Browser-verified:** R1 Specialist locks Crystalline (Sharzak, 1 pick); R2 picks 1 more Crystalline (Krombax) — only 1 because shop offered no other on-species candidate. Rival panel renders glyph + name + tell + gold + species-tinted card chips. All 4 personalities behaved per spec across smoke tests.
- **Known follow-ups:** Live appraisal-while-reordering and adjacency/pair-combo passives are the Phase 30 deliverables and remain open (the legacy %-mult passives are still bypassed under judge mode).

**Phase 28 v0.46 (2026-05-01):** Aesthetic Tags shipped.
- **`src/cards.js`:** every card def now carries `tags: [...]` with 1–2 of {Grotesque, Elegant, Bizarre, Restrained, Ostentatious, Quaint}. 31 cards tagged. Distribution (full pool incl. locked): Grotesque 11, Bizarre 10, Ostentatious 10, Quaint 7, Elegant 5, Restrained 5. Restrained and Elegant intentionally scarcer — that's what makes Refinement/Architecture genuinely tight tastes.
- **Per-species native tags (mostly):** Abyssal → Grotesque/Ostentatious; Sporal → Quaint/Bizarre; Crystalline → Elegant; Chitinous → Restrained; Plasmic → Bizarre/Ostentatious. Some cards drift (Skraxle is Grotesque per flavor; Lithvorn is Elegant+Bizarre, etc.) so each species has tag breadth.
- **`src/judges.js`:** 4 new tastes added (10 total): Grotesquerie, Refinement, Architecture, Ostentation. Each is a per-card multiplier that reads tags; default mult sits in 1.4–1.55 range so non-tagged cards still score reasonably. Best-tag mults peak at ×2.4 (Architecture/Restrained); worst-tag mults floor at ×0.6 (Refinement/Grotesque). New helper `cardHasTag(card, tag)` lives here. 6 new judges added (18 total): Patron Morgath/Lord Vlasq (grotesquerie), Madame Sereth (refinement), Architect Ostrev (architecture), Baroness Glamora/Lord Rakthar (ostentation). Vlasq + Rakthar are finale-eligible.
- **No UI changes needed:** browser slate-reveal, chapter-reveal, and judge-panel all render via `getTaste(judge.taste)` so new tastes wire up automatically. v0.46 displayed in HUD.
- **Browser-verified:** 10 tastes load in `ACB.judges.TASTES`; 18 judges load; slate-reveal modal renders 4-chapter lineup; judge-panel shows taste hint + target; manual taste-score smoke tests in-browser match Node sim output exactly (Crystalline-heavy board → Refinement 845, Grotesquerie 288). No console errors.
- **Calibration (n=300, seed=1):** greedy survival 26.3% (Phase 27 was 32.3%; band target 30–45%). The drop reflects 3 hard tastes now in the 10-pool (Restraint 65%, Refinement 74%, Architecture 79%) vs. Phase 27's single hard taste. Per-taste pass rates: Diversity 95%, Narrative 95%, Harmony 94%, Ostentation 88%, Eccentricity 87%, Spectacle 85%, Grotesquerie 85%, Architecture 79%, Refinement 74%, Restraint 65%. Accepted slightly below band — hard tastes are by design the engagement driver, and recalibration of the underlying flat target curve is itself a Phase 31 deliverable.
- **Dominance shift validation ✓:** 5-card mono-species boards × all 10 tastes (T1, base scores only). Crystalline-stack scores 845 under Refinement (vs Abyssal 236, Sporal 441 — clear best). Chitinous-stack scores 624 under Architecture (vs Plasmic 502, Crystalline 438 — clear best). Plasmic-stack tops Diversity (832) and Ostentation (768). Phase 28's "different species best per run" promise is real.
- **Known follow-up (deferred to Phase 30/31):** species/class %-mult passives (Vorzak ×1.5, Slurvin +25%/2★+, Molborg, Lithvorn, Vorbex, Squorble, Stellorb, etc.) are still in card data but bypassed at scoring under judge mode. Card descriptions show them; the math doesn't fire. Phase 30 rewrites passives for adjacency/pair-combos and is the natural point to either retire or convert these. Not deceptive enough to block now.
- **66/66 unit tests pass** (tests don't reach taste/judge code).

**Phase 27 v0.45 (2026-04-30):** Judge Spine shipped.
- **`src/judges.js` (new):** 6 tastes (Spectacle, Diversity, Restraint, Eccentricity, Narrative, Harmony) with `score(active, baseScores, ctx)` functions. 12 judges drawing from those tastes; some flagged `chapter:'finale'` for the Grand Finale slot. `drawJudgeSlate(rng)` returns 4 judge IDs (3 unique-taste chapter judges + 1 finale) deterministically per seed.
- **`src/game.js`:** `Run.headJudges` is now a 4-element slate (3 chapters + 1 finale). `Run.useJudgeScoring` flag (default true; toggled off via `LEGACY_SCORING=1` env for ad-hoc Node A/B). `currentJudge(round)` and `chapterFor(round)` now span 4 chapters; R24 is its own Grand Finale chapter. `runBattle()`: when flag is on, calls `board.calcBaseBreakdown(ctx)` (Stages 0–2), then the current judge's taste rule produces the appraisal. Qualify/preferred-target mechanic retired (target = base × diffMult × 0.68 under judge mode). Curator gifts retired pending judge-personality rework — `pendingCurator()` naturally returns null because `CURATOR_SELECTIONS` is empty.
- **`src/board.js`:** new `calcBaseBreakdown(ctx)` runs Stages 0–2 only (per-card flats from base × stars, Axis-3 scaling flats, item flats like Guinsoo's/TimeDilation/Prestige Tag/Collector's Mark, Axis-2 conditional flats with IronWill). Skips species/class synergy stages and all multiplicative stages. Returns `{ perCard, firedPassives }`; `firedPassives` powers the Eccentricity taste.
- **`web/app.js` + `web/style.css`:** `showJudgeSlateReveal()` modal at run start (4-judge lineup with taste names + hints). `renderJudgePanel()` rewritten for taste-driven mode (no more qualifies/preferred display). `showChapterReveal()` extended with taste tag + hint. Grand Finale gets its own judge reveal at R24. Scoring modal heading shows `· Taste`.
- **`web/loader.js`:** `judges` module added to ACB bootstrap.
- **Calibration (n=300, seed=1):** greedy 32.3% survival ✓ (target band 30–45%); per-round pass rate 87.5%; per-taste pass rates: Diversity 94%, Narrative 94%, Harmony 87%, Spectacle 85%, Eccentricity 82%, Restraint 65%. Restraint is the natural counter-weight to greedy's wide buys — by design.
- **Browser-verified:** judge slate reveals at run start, judge panel updates per round, scoring modal shows judge + taste, chapter-2 transition reveal fires at R9. R1 with 2 cards under Narrative judge: 124 raw → 124 final (no rounds-held bonus), passed target 68. R8 critique under Narrative: 663 vs target 680 (close miss, 1 life lost) — healthy critique tension.
- **Known follow-ups:** 66 unit tests need rewrite (accepted per plan). Run modifiers, plinth composition, visible rival, aesthetic tags, theme rename all deferred to Phases 28–32.

**Phase 26 v0.44 (2026-04-30):**
- **`src/shop.js`:** `Shop.rivalFlags[]` parallel to `offers[]`, set per-refresh and per-reroll. `_flagRival()` picks 1 random non-null offer using `player.rng`. `drawOffers()` accepts `excludeSet` of names under cooldown. `buy()` clears the flag on the bought slot.
- **`src/game.js`:** `Player.rivalCooldowns = { cardName: roundsRemaining }`. End of `Run.runBattle()`: tick existing entries down (drop ≤0), then for each rival-flagged-but-unbought offer, set cooldown=2. Yields 2-round exclusion (R+1 and R+2 shops skip the name; R+3 it's back).
- **`web/app.js`:** rival flag renders as `.rival-tag` (👁 Wanted) + `.card.rival-claimed` outline on the shop card. Tooltip explains the consequence.
- **`web/style.css`:** pink outline + corner badge for claimed cards.
- **Sim impact:** greedy n=300 — 30.3% → 30.7% survival, within noise. AI is unaware of flags so it competes as before; mechanic only bites human play that was actively *wanting* a flagged card. This is correct behavior, but means the sim won't reflect the playtest pressure — measure feel via runs, not survival deltas.
- **Dead-species hypothesis confirmed (2026-04-30):** `avoid-chitinous` (28.0%), `avoid-crystalline` (31.0%), `avoid-both` (29.0%) all within ~1pp of greedy baseline (30.3%) at n=300. Skipping those species costs nothing — they really are dead picks under sim heuristics. Phase 26 mechanic doesn't depend on fixing this; rival can claim dead-species cards harmlessly. Buff/redesign deferred.

**v0.43 playtesting findings (2026-04-30):**
- Graduated R19–R24 Elite mults confirmed working: R21 (×1.40) is the consistent pressure point (138–234 margin), R24 (×1.50) caused one genuine failure. The late-game comfort window is closing.
- 8 Elite Circuit runs total: 5 survived, 3 died (R6, R20, R24). Surviving peaks: 7200–14881. Healthy spread.
- HeroicResolve + TimeDilation stacking is a high outlier (14881 peak vs. 7200–8820 for other winning builds) — worth monitoring but not alarming at n=2.
- **Core design diagnosis:** The game is a score execution game wearing the skin of a strategy game. Once a build is identified, the player executes it without contest. The autochess "musical chairs" tension (shared pool scarcity, opposing demand) is absent — this is the primary engagement problem. More content does not fix it.
- **Player meta-knowledge solidified after ~10 runs:** Abyssal and Sporal are dominant; Chitinous/Crystalline avoided (needs sim validation); coasting loop (score well → hoard gold → earn interest → deploy → repeat) runs R4–R18 unchallenged; global multiplier cards can be stacked as 1★ aura sources (potential abuse case).
- **Proposed fix:** Simulated rival demand on shop cards — 1–2 cards per round flagged as also wanted; skipping them makes them unavailable for 2 rounds. Creates buy-or-save tension without real opponents. Full spec in `design_log/phase_26_plan.md`.
- **What stays:** Scoring, lives, graduated Elite targets, judges, augments, items — all working or close.

**Elite target recalibration (2026-04-29):** v0.43.
- **Analysis basis:** 5 Elite Circuit run logs — 3 survived (peak 7180–12741), 2 died (R6, R23). Pattern: early game (R4-R8) is already a genuine danger zone under ×1.25; late game (R19-R24) was trivial after gold dump (~L9 unlock between R14-R19 causes score spike from ~4000 to 8000-12000+).
- **Fix:** Elite tier now uses a per-round `mults` array in `src/ranking.js`. R1-R18 stay at ×1.25 (early kill-zone unchanged). R19→×1.30, R20→×1.35, R21→×1.40, R22→×1.44, R23→×1.47, R24→×1.50.
- **Resulting targets:** R24 goes 6250→7500. E3-style runs (7180 score) must maintain judge qualification at R23-R24 to survive. E1/E5-style builds (11000-12700) remain comfortable but less automatic.
- **Implementation:** `Run` constructor gains optional `diffMults` array; `game.js` `scoreRound` uses `diffMults[round-1]` when present; `app.js` threads `tier.mults` through; runlog `target.diffMult` records the actual per-round multiplier.

**Run telemetry shipped (2026-04-29):** v0.42.
- **`src/runlog.js`** — `RunLog` class with per-round event timeline, board snapshots, JSON download. No-op in Node.js (sim unaffected).
- **Hooks wired in `web/app.js`:** newGame (seed, difficulty), startRound, finishRoundSetup (income + shop_refresh), onBuyShop, onReroll, onLock, onAddPlinth, onCardClick (sell/move/attach), pip click (detach), onPickAugment, onPickItem, onPickCurator, onPickShapeshifter, runCombines (combine detection), onReady (full readyState snapshot + result), showGameOverModal (final stats, calls endGame).
- **UI:** 📥 button in HUD (always visible, mid-run download), prominent "Download Run Log (JSON)" button in game-over modal.
- **Schema captured:** events array per round with ts (ms since game start), readyState (gold, level, full active+bench with per-card final score, augments, item bag, synergies), result (score, target, passed, qualified, livesAfter, lifeGained, judgeId, isCritique).
- **Browser-verified:** Round 1 captures all expected events (income, shop_refresh, buy×2, reroll), readyState (gold=7, 2 active), result (score=120 / target=100, passed). No console errors.

**Design context (2026-04-28 → 2026-04-29):** Player feedback that mono-stack builds (Sporal-9, Plasmic-8) feel too easy to assemble and "destroy" late-round targets. Multiple design discussions converged on: the issue is *pacing*, not *variety* — once a build comes together, skilled play has 7+ comfortable rounds with nothing the game can ask. Sim's greedy baseline (40–42% survival) is well below human top-end. Backpack Battles parallel: pressure comes from external scaling, not gold mechanics. Cross-axis specialists (Quorrath-style cards) and gold sinks were considered but demoted — the primary lever is **target curve recalibration against human top-end data**. Telemetry was shipped first to enable that calibration.

**Decisions made (2026-04-29 design session):**
- **Reject:** speciesless catalyst cards (theme conflict, may amplify mono-stacks rather than constrain them).
- **Reject:** removing interest economy (contradicts balance_principles.md — economy needs to *become* a real dimension, not be removed).
- **Reject:** gold decay (hacky, taxes legitimate save-when-nothing-good strategy).
- **Demote:** cross-axis specialists (Zorbrath-style) — useful texture, not a pacing fix.
- **Promote:** target curve recalibration based on captured human play data (this commit enables it).
- **Defer:** gold sinks (gold-cost augments/items) — design enrichment, not pacing fix; revisit after recalibration lands.

**Known outstanding exploit flags (accepted, not blocking):**
- AccliLog (+32pp): Rate reduction cannot fix this — 3 forced copies compound regardless of per-round value. Needs a per-card total cap (e.g. max +240 over the course of a run). Defer to dedicated pass.
- Taxonomy Badge: Abyssal (+20pp): Abyssal is now ×1.32/×1.80 and abyssal-stack sits at +10pp above greedy (within target). The badge's high delta is an exploit-sweep artifact (forced every item round). Not a live gameplay problem at natural frequencies.
- Cross-Pollination (+13.5pp), AccliProg (+11.5pp): Improved from +17pp and +14pp. Further nerfs risk baseline damage — accept at current values.
- Rarity Certificate (+14.5pp): Not a new problem — item didn't change; delta inflated by 11pp baseline drop after nerfs.

**Balance pass v0.41 (2026-04-28):** Species/class overlap design fix + exploit nerf pass.
- **Design fix:** Blinxorp reclassified Livid → Sullen. Root cause: Vorzak (T1 Abyssal/Livid) + Blinxorp (T2 Abyssal) both being Livid gave free Abyssal-2 + Livid-2 double-mult synergy with no deliberate decision. The fix makes the overlap intentional — you must mix non-Abyssal Livid cards to build Abyssal-Livid.
- **Abyssal synergy nerf:** ×1.40/×1.90 → ×1.32/×1.80. Required because Blinxorp reclassification lowered the greedy baseline (AI no longer gets free Livid-2), widening the abyssal-stack gap to +15pp. Nerf brings abyssal-stack back to +10pp above greedy (within the 5–10pp focused-stack target).
- **Item/augment nerfs:** AccliLog 20→18/round; AccliProg +5→+4/round; Cross-Pollination 6→5%; Pheromone Diffuser +15→+12% aura.
- **Balance (n=100, seed=42):** greedy 30%, abyssal-stack 40% (+10pp ✓), livid-stack 34% (+4pp ✓), wide 33% (+3pp ✓). Ordering preserved.
- **Design principles updated:** `balance_principles.md` — stale greedy baseline corrected (55–57% → 40–42% post-v0.37 recalibration); new rule added for species/class overlap in the free card pool (multiplicative+multiplicative overlaps on T1+T2 free cards are forbidden).
- **66/66 unit tests pass.**

**Hotfix v0.40 (2026-04-28):** Critical crash fixed — shop empty on start and Continue-after-win stuck.
- **Root cause:** `run.stats` was deleted in Phase 25's achievement rework, but `finishRoundSetup()` in `web/app.js` still read `S.run.stats.peakGold`. The crash happened before `shop.refresh()` and `render()`, causing: (1) empty shop on game start, (2) any Continue-after-battle leading to a stuck panel.
- **Fix:** Removed the stale `run.stats.peakGold` line from `finishRoundSetup()` (one line deleted).

**Phase 25 complete (2026-04-28):** 9 new achievement/reward slots shipped (v0.39).
- **22 total achievements** (was 13). New: plasmic_master, pompous_devotee, emotional_virtuoso, patient_master, star_curator, late_game_collector, discerning_graduate, elite_curator, grand_survivor.
- **New content:** Vorbex (Plasmic T2, ×1.5 if Plasmic-4), Omnorb (Abyssal T3, ×1.8 if 4+ unique species); augments: Grand Specimen Program (+30 T3 base), Class Harmony (+12%/class syn beyond first), Apex Showcase (3★ ×1.2), Mastery Protocol (+0.1 to axis-4/6/6+4 mults); items: Veteran's Plinth (×1.3 if held 15+ rounds), Prestige Circuit (×1.2 unconditional); judge: Appraiser Sormax (prefers 4+ cards held 10+).
- **`incrementAchievementCounters` extended:** 4th `ctx` arg `{ round, diffMult, activeClassSynergyCount }` added; computed in game.js before call. All existing achievements unchanged (ctx optional, defaults to `{}`).
- **Pipeline hooks in board.js:** grand_specimen (Stage 0), mastery_protocol + apex_showcase + veterans_plinth + prestige_circuit (Stage 4b), class_harmony (global mult after Stage 4b).
- **Unit tests:** 66/66 passing (was 47).
- **Balance (n=300, seed=42):** greedy 40.7% — within noise of v0.38's 41.0%. Ordering preserved. All new content locked (excluded from sim pools).

**Achievement rework complete (2026-04-28):** Persistent cumulative counters replace single-run binary achievements (v0.38).
- **Old model:** 13 achievements, `check(run)` at run-end, binary unlock. Completable in ~5 runs.
- **New model:** 13 achievements, `conditionMet(board, classCounts, speciesCounts)` per PASSED round, counter in localStorage (`alien-exhibition-counters`). Requires 20–30 runs to complete the full tree.
- **Same 13 rewards** — backward compatible. `alien-exhibition-unlocks` format unchanged; existing unlocked content stays unlocked.
- **Achievements (13):** 5 species devotee (15 beats, species-2+) → locked card; 4 species master (25 beats, higher threshold) → locked card/augment/item; 4 class devotee (15 beats, class-2+) → locked card/augment/judge.
- **Progress bars** in Collection modal ("0 / 15 rounds"); counters visible to player mid-grind.
- **Infrastructure:** `incrementAchievementCounters(board, classCounts, passed)` called from `runBattle()`. Returns newly unlocked achievements → stored in `run.newlyUnlocked` → shown in game-over modal. No-op in Node.js sim.
- **Removed:** `run.stats` tracking block (44 lines) replaced by single `run.newlyUnlocked = []`. `run.stats.peakGold` removed from sim.js too.
- **47 / 47 unit tests pass.** Balance ordering preserved (n=50 smoke test clean).

**Late-game snowball fix complete (2026-04-28):** Removed flat R20/R21/R22 section (v0.37).
- **Root cause:** R20/R21/R22 all at target 3700 while greedy median scores were 3814/3934/4067 — two consecutive free rounds once past R20, skilled players coasted.
- **New R17–R24 curve:** 3000 / 3200 / 3500 / 3850 / 4100 / 4350 / 4650 / 5000. Smooth escalation, no flat sections.
- **R24 Grand Finale:** 4600 → 5000. ~50% pass rate for greedy (coin-flip feel intended).
- **Tier mults recalibrated:** Discerning 1.25 → 1.12, Elite 1.50 → 1.25. Maintains original calibration intent: Discerning ~22.5% greedy survival (was 23%), Elite ~10%.
- **Balance sweep (n=300, seed=1):** greedy 41.0%, livid 51.0%, abyssal 51.7%, blinxorp-max 66.3%. Ordering preserved.
- **Production plan agreed:** 6-step order — (1) snowball fix ✓, (2) achievement rework, (3) fill TBD locked content, (4) full balance pass, (5) new species, (6) balance pass again. Production content targets: ~75 cards, 6-7 species, 6-7 classes, 25-30 augments, 35-40 items, 10-12 judges, 5-6 difficulty tiers, 30-40 achievements.
- **Achievement redesign agreed:** cumulative "beat N rounds with condition active at judging" — 22 achievements specced across species devotee/master, class devotee, build archetypes, and difficulty tiers. Replaces 13 single-run binary achievements.

**Collection UX complete (2026-04-28):** Player-facing unlock discoverability (v0.36).
- **Reward names revealed:** Collection modal now shows locked reward names (was "???") — players know what they're working toward.
- **Achievement summary in game-over modal:** Shows "X / 13 achievements" count + "View Collection →" button after every run.
- **loader.js load order fix:** achievements now loads before cards (cards.js requires it at line 3). Was a silent cold-cache crash bug.
- **Modal z-index raised 50→150:** Collection modal now renders above the splash screen correctly.

**Phase 24 complete (2026-04-27):** Card expansion shipped (v0.35).
- **New free card:** Phlorbex (Sporal/Shy, T1, base 54) — other Sporal specimens +10 flat score (axis 8 aura).
- **8 locked cards** (each gated behind a new achievement):
  - Grazwick (Abyssal/Sullen, T2, 82): inactive rounds 1–7; ×1.8 from round 8 (axis 6).
  - Morblax (Chitinous/Giddy, T2, 83): +15 per Giddy specimen on board incl. self (axis 2).
  - Zorbrath (Crystalline/Livid, T2, 90): ×1.4 if both Crystalline-2 and Livid-2 active (axis 4).
  - Vornix (Abyssal/Livid, T1, 50): +24 per other Abyssal on board (axis 2).
  - Zephrix (Sporal/Giddy, T2, 82): +3g/round; +40 flat if holding 20+ gold at judging (axis 2).
  - Prismora (Crystalline/Shy, T3, 124): ×(1 + 0.15 per T3 card on board incl. self) (axis 4).
  - Klothrix (Chitinous/Shy, T3, 120): +30 per round since bought, max +450 (axis 3).
  - Stellorb (Abyssal/Pompous, T3, 126): ×1.5 if Abyssal-4 active and round 16+ (axis 6+4).
- **8 new achievements** (abyssal_patience, giddy_horde, dual_synergist, void_commander, gold_rush, tier_collector, deep_patience, grand_finale).
- **Infrastructure:** `getAvailableCards()` in cards.js filters CARD_DEFS by `!locked || isUnlocked`; shop.js uses it. `classCounts` added to `selfCtx` in board.js (needed by Zorbrath). Six new `run.stats` fields tracked in game.js; `peakGold` tracked in sim.js and app.js.
- **Balance (n=300, seed=42):** greedy 55.0% ✓ (pool dilution from T1 Phlorbex is minimal; all T2+ conditional cards kept locked to preserve T2 pool size at 7). livid-stack 66.3%, abyssal-stack 65.7%, blinxorp-max 75.3%.
- **Locked card ceiling exploit sweep:** deferred — no `sweepCards` harness yet. Starting values need verification before shipping to players.

**Phase 23-B complete (2026-04-27):** New locked content shipped (v0.33).
- **Deep Roots** augment (`deep_roots`, locked): ×1.15 per-card mult at Stage 4b for cards held 10+ rounds.
- **Curator's Eye** augment (`curators_eye`, locked): +5% global mult per 3★ active specimen (Stage 4a).
- **Appraiser Vrethix** judge (`vrethix`, locked): 3+ class synergies active → preferred target (−15%). Curator gift: Cross-Pollination.
- **Prestige Tag** item (`prestige_tag`, locked): +12 flat per active class synergy on equipped specimen (Stage 1).
- **Collector's Mark** item (`collectors_mark`, locked): +8 flat per combined (2★/3★) active card (Stage 1).
- **Balance verified (n=300/200, seed=42):** Baseline greedy 56.7% — unchanged from Phase 22 (locked content excluded from pools). Exploit ceiling: all four new pieces well below 8pp flag threshold (Deep Roots −7pp, Curator's Eye −23pp, Prestige Tag −16pp, Collector's Mark −18pp). No new exploits.

**Phase 22 complete (2026-04-27):** Balance pass shipped (v0.32).
- **Livid dominance fixed:** Class mult ×1.10/×1.20 → ×1.08/×1.16. livid-stack: 69.3% → 63.3% (-6pp).
- **Giddy dead path fixed:** Class flat +18/+36 → +30/+72. giddy-stack: 37% → 41.7% (+4.7pp).
- **Crystalline dead path improved:** Species flat +18/+42/+78 → +28/+70/+110. crystalline-stack: 39.3% → 41.7% (+2.4pp).
- **Sharzak redesigned:** base 44→62; passive changed from sell bonus (+3g, 0 score) to '+14 per other Giddy specimen on board' (axis 2). Root cause of both dead paths — Sharzak was dead weight in all its builds.
- **Krombax buffed:** base 48→62. Crystalline T1 floor raised.
- **Cross-Pollination augment nerfed:** 8% → 6% per active synergy. Exploit delta: +13.7pp → +11pp.
- **Not changed:** Abyssal (×1.40/×1.90), AccliLog (20/round) — both tanked baseline when nerfed; deferred.
- **Balance sweep (n=300, seed=42):** greedy 56.7%, livid 63.3%, abyssal-sporal 67.7%, abyssal-stack 66.3%, giddy 41.7%, crystalline 41.7%, blinxorp-max 79% (up from 74% — proportional to baseline shift; cap fix still in place).
- **Exploit sweep:** AccliLog +22.3pp (accepted), Cross-Pollination +11pp, Taxonomy Badge: Abyssal +14.7pp.

**Phase 19-F complete (2026-04-26):** Sim calibration — retuned ROUND_TARGETS (v0.26).
- Greedy survival: 18.7% → 54.8% on Standard (spec: ~55-65%). Avg lives lost: 1.64 (spec: 1-3).
- Tier scaling: Discerning ×1.25 → 23.0%, Elite ×1.5 → 5.4% — meaningful progression confirmed.
- Root cause of original failure: R1 target (150) matched the median score — 66% miss rate on Round 1 alone; R16-R24 targets (3100-7000) were 40-82% miss rates.
- New curve: R1=100, R2=135, R3=200, R4-R15 unchanged (R4=400…R15=2600), R16=2800 (Critique 2), R17=3000, R18=3100, R19=3450, R20=3700, R21=3700, R22=3700, R23=3900, R24=4600 (Grand Finale). All preferred targets = base × 0.85.
- Per-round miss rates: R1-R20 averaging 8-17%; R21-R23 effectively 3-7% (judge qualification suppresses late-chapter miss rates — intended reward for committed builds); R24 ~30%.
- Balance sweep (500 seeds): greedy 54.8%, wide 52.8%, abyssal-stack 65.6%, livid-stack 71.0% (strong but historically in range). blinxorp-max 81.8% remains the known Growth Serum cap-bypass ceiling (deferred).
- sim.js: runGame() accepts opts.diffMult (passed to Run constructor).
- run.js: play/sim commands updated to use battleHistory (opponentHistory was removed Phase 19-A). sim shows lives distribution.

**Phase 20-A complete (2026-04-26):** Exploit sweep shipped (v0.27).
- `sweepAugments(n, seed)` in `src/balance.js`: force-picks each augment at R3, AI picks R7+R12. Reports survival delta vs greedy baseline. Flags anything >8pp above baseline.
- `sweepItems(n, seed)`: force-picks each item at every item round (R5/R10/R15 = 3 copies spread across board). Reports survival delta. Same flag threshold.
- `resolveItemPick(run, forceItemId)` in `src/sim.js`: new param injects a specific item into the offer before pick.
- `runGame` passes `opts.forceItem` through to `resolveItemPick`.
- `node run.js exploit [n] [seed]` CLI command prints both sweep tables.
- Smoke test at n=20 flagged: Acclimatisation Log (+40pp), Pheromone Diffuser (+30pp), Rarity Certificate (+20pp), Taxonomy Badge: Abyssal (+15pp), Acclimatisation Program augment (+10pp), Cross-Pollination augment (+10pp). Run at n=200+ for reliable results.

**Phase 20-B complete (2026-04-26):** Economy investigation (v0.27 — no version bump, sim-only).
- `economy-stack` policy added to `src/sim.js`: biases toward Axis-7 cards (Sporvik, Sharzak) + sets `_augmentBias = ['Tycoon', 'MidasTouch']`.
- `economy-max` build added to `BUILDS` in `src/balance.js`: forced Tycoon@R3 + MidasTouch@R12 + Market Tag every item round.
- Result: `economy-stack` 33.7%, `economy-max` 6.3% — both well below greedy 57.3%. **Economy is NOT broken.**
- Root cause of user's "double interest feels strong": Axis-7 cards score nearly nothing (Sporvik baseScore=52, Sharzak=44); gold compounds but you've already lost lives before it helps. The psychological effect of watching gold tick up is real; the actual impact isn't.
- "Double interest" = Tycoon augment doubling the interest component of earnIncome. Correctly modelled in sim. Not a balance problem.
- Full sweep (n=300) key findings: livid-stack 71.0% (+14pp vs greedy), abyssal-sporal 66.7%, abyssal-stack 64.0%, blinxorp-max 79.7% (known ceiling). Dead paths confirmed: crystalline-stack 40.7%, giddy-stack 35.7% (−17–21pp vs greedy).

**Phase 20-C complete (2026-04-26):** Playtest 3 UX fixes (v0.28).
- Judge panel: when qualifying, now shows "✓ 2+ Abyssal active → Target: 680" instead of just "✓ Target: 680" — requirement stays visible alongside the confirmed bonus.
- Shen-Nax excluded from Chapter 1 judge pool: `_assignJudges()` draws Ch1 from a filtered pool (all judges except shen_nax); Ch2/Ch3 draw from full remainder. Shen-Nax's "2+ T3 active" condition is near-impossible in rounds 1–8.

**Phase 20-B addendum (2026-04-26):** Smart-greedy policy shipped (v0.29).
- `smart-greedy` policy added to `src/sim.js`: saves gold when current board score already clears the next chapter critique target (R8/R16/R24). Plinths still bought regardless (levelling improves future shop odds). Card buying resumes when score is below the critique target.
- `boardScore(player, round, run)` helper computes live board score inside the policy.
- `runGame` now passes `run` as third arg to policy (ignored by all existing policies).
- Survival: smart-greedy 54.7% vs greedy 56.7% — 2pp gap is the legitimate cost of conservative saving. Per-round pass rate nearly identical (90.2% vs 90.3%), confirming the policy isn't weaker per round, just slightly more conservative overall.
- T3 early-game penalty tested but removed: a flat -20 penalty caused smart-greedy to skip genuinely good T3 cards, driving survival to 51%. The correct implementation would require synergy-context awareness (only skip T3 if it doesn't complete a threshold) — deferred.
- Extra reroll (+1) tested and removed: added cost without offsetting benefit at current reroll cap (2g per attempt absorbed savings advantage).

**Phase 20-D complete (2026-04-26):** Balance pass shipped (v0.30).
- **Growth Serum cap bypass fixed:** Blinxorp and Scrithnab passives now expose a `cap` property. `board.js` Stage 1 applies the cap *after* item wrapping — Growth Serum doubles the per-round rate but not the ceiling. Blinxorp cap lowered 400→300.
- **Blinxorp-max:** 79.7% → 74.0% (−5.7pp). Remaining ceiling is from forced TimeDilation+abyssal combo; the cap exploit is eliminated.
- **Giddy dead path fixed:** Giddy-3 flat 22→36, Giddy-2 flat 10→18. giddy-stack: 35.0% → 37.0% (above floor).
- **Final balance (n=300, seed=42):** greedy 55.3%, livid-stack 69.3% (within ceiling), giddy 37.0%, crystalline 39.3% (both above floor). Forced-optimal builds: blinxorp-max 74%, fluxnob-max 73% — both require lucky augment+item alignment; all natural policies in range.
- **Cross-Pollination** tested at 7% (too aggressive, dropped greedy 2.6pp and hurt giddy); kept at 8%.
- **Acclimatisation Log** tested at 15/round (also too aggressive, hurt baseline ~5pp for no targeted-build benefit); kept at 20/round.

**Phase 21 complete (2026-04-27):** Polish & Clarity pass shipped (v0.31).
- **A — Rules modal fixed:** Removed stale "opponent/Rep" bullet. Replaced with two correct bullets: "Each round your exhibit is judged against a target score — miss it and lose a Seal" + "Lose all 3 Seals and your run ends · Beat a Critique round by 25%+ to restore one".
- **B — Seal loss/regain feedback:** `sealLost` sound (harsh crack + downward sweep, distinct from `loss` melody) plays on every missed round. `sealRestored` sound (ascending bell chord) plays on life regain. CSS `@keyframes seal-shatter` animates the newly-lost seal diamond (flash gold→red→settle empty). Continue button delayed 500ms on life regain to hold the moment.
- **C — Score target in HUD sub-row:** `#target-preview` span added next to income preview; populated by `renderJudgePanel()`. Shows base target normally; turns green and reads "Target: N (preferred)" when judge preference is met.
- **D — Interest cap signal:** `renderIncomePreview()` now uses `innerHTML`; when raw interest is maxed (gold ≥ 25), adds amber `<span class="income-cap">✓ max</span>` inline with the interest figure.
- **E — Bench affordance hint:** Bench area desc updated to "· Reserve bench — won't score · Click to move to Exhibit".
- **F — Grand Finale overlay:** `showGrandFinaleReveal()` fires at `startRound()` when `nextRound === 24`. Reuses `.chapter-reveal` infrastructure with `.grand-finale-reveal` gold accent. `grandFinale` sound (dramatic low build + bright chord). Overlay reads "Round 24 / Grand Finale / All judges present · Final score".
- **G — Reroll cost on button:** Already implemented (line 927 of app.js). No change needed.

**Phase 23-A complete (2026-04-27):** Unlock system infrastructure (no version bump).
- **`src/achievements.js` created:** `ACHIEVEMENTS` (5 entries), `evaluateAchievements(run)`, `getUnlocks()`, `addUnlock()`, `isUnlocked()`. localStorage-backed; graceful no-op in Node.js so sim pools stay clean.
- **`run.stats` added to `Run`:** `maxClassSynergiesActive`, `maxCrystallineActive`, `allSpeciesRepresented`, `maxTripleStarsActive` — tracked each round in `runBattle()` after `calcScoreBreakdown()`.
- **Filtered pools:** `getAvailableAugments()` / `getAvailableItems()` exported from augments.js / items.js; `pendingAugment()`, `pendingItem()`, `pendingCurator()` all use filtered pools.
- **`_assignJudges()` updated:** filters `HEAD_JUDGES` by `!j.locked || isUnlocked(j.id)` — ready for Vrethix in 23-B.
- **Smoke test (n=50, seed=42):** all policies ran without errors; ordering preserved.

**Phase 23-C/D complete (2026-04-27):** Achievement unit tests + unlock UI shipped (v0.34).
- **23-C:** `src/test_achievements.js` — 24 unit tests across all 5 check() functions. Boundary cases for `patient_collector` (rounds 15/16, card count 2/3, roundsSinceBought 9/10, undefined handling) and `crystal_formation` (count 3/4, round 11/12). All 24 pass.
- **23-D:** Collection panel + unlock section.
  - `web/loader.js`: load `achievements.js` before `augments`/`items` (dependency order — augments requires isUnlocked).
  - `web/app.js`: `evaluateAchievements` + `addUnlock` called in `showGameOverModal`; unlock section rendered when new content fires; `showCollectionModal()` lists all 5 achievements from splash (locked = ???, unlocked = reward name + type badge).
  - `web/index.html`: "Collection" button on splash; v0.34.
  - `web/style.css`: `.unlock-section`, `.ach-row`, `.ach-unlocked`, `.ach-locked`, `.splash-btn-collection` styles.

**Next action:** Phase 24 — card expansion. Add new cards to `src/cards.js` and gate some behind the unlock pool (building on Phase 23 infrastructure). See `design_log/phase_23_plan.md` "Out of scope" section for card unlock notes.

**Phase:** Phase 16 complete (2026-04-25). Sim-driven balance pass shipped (v0.18).

**Local dev fix (2026-04-25):** `serve.js` was rewriting `/` → serves `web/index.html` content while leaving the URL at `/`, so relative paths like `style.css` resolved against root and 404'd (broken since the GitHub Pages path-relativization). Fixed by serving root `index.html` (the meta-refresh page) at `/` — browser then navigates to `/web/index.html` and relative paths resolve. Local dev now matches GitHub Pages flow exactly.

**Phase 16 changes (2026-04-25):**
- C1: Blinxorp cap +400 (was uncapped; saturates at R16). `blinxorp-max` p50 7372→5624 (−24%), survival 59.2%→48.0%.
- C3: Abyssal-2 synergy mult ×1.60→×1.40 (4-count still ×1.90). `abyssal-stack` survival 31.4%→23.2%.
- C4: Livid-4 class mult ×1.28→×1.20, Livid-2 ×1.12→×1.10. `livid-stack` p50 3563→3263.
- C5-A: Plasmic-4 flat 48→58, Plasmic-2 flat 26→32. `plasmic-stack` p50 +40 (ceiling unchanged — hybrid splash runs lost Abyssal kicker, pure-Plasmic commits slightly stronger).
- C6: Giddy-3 flat 14→22, Giddy-2 flat 6→10. Marginal movement — class synergies are half-weight by calibration rule.
- C2 (Growth Serum × Accl. Program compounding): investigated, found non-issue. TimeDilation's +5/round is added as a separate pipeline stage (board.js line 239), not routed through card.passive.eval, so Growth Serum's wrapPassive does not double it. No fix needed.
- Infrastructure: `src/balance.js` (Monte Carlo harness), 10 species/class policies + `abyssal-sporal` mix in `src/sim.js`, `balance` command in `run.js` (committed in 6894096 before balance-pass changes).
- Version bumped to v0.18.
- Guardrail note: strict targets (blinxorp-max p50≤5000, surv≤40%) were not fully hit on C1 alone — original plan assumed C1+C2 both landing. 48% survival remains the gap; blinxorp/next-best ratio closed from 2.03×→1.68× which is the headline movement. Accepted pending playtest.


**GitHub Pages deployment (2026-04-22):**
- Deployed to https://bazzboyy1.github.io/auto-card-battles/
- Root `index.html` redirect added (`meta refresh → web/index.html`) — Pages can't deploy from a subfolder
- Fixed all absolute paths that broke under Pages subdirectory: `web/index.html` asset hrefs, `web/loader.js` src paths, `web/style.css` Splash.png references (all changed from `/…` to relative `../…` or `./…`)
- Bug fix: skip() in judging panel showed wrong totals — stale `requestAnimationFrame` callback fired after skip() set the correct value and overwrote it; fixed by tracking rAF handles in `rafs[]` and calling `rafs.forEach(cancelAnimationFrame)` in skip()
- Augment tooltip descriptions cleaned: "Axis N" parentheticals removed from four augment descriptions (Conditioning Protocol, Rapid Development, Early Bloomer, Market Savant)

**UX pass 3 (2026-04-21):**
- Game renamed: "Exotic Alien Extravaganza" → **Alien Exhibition** (title, browser tab, splash)
- Splash image now bleeds through as subtle board background (88% dark overlay on body)
- Splash/rules buttons renamed to "Play"; splash description updated to mention competing against other collectors' exhibitions
- How to Play popup added between splash and game — 6-bullet summary, shown once per session
- HUD tooltips: Rep, Gold, Exhibit Lvl now show explanatory tooltip on hover (drops below HUD bar)
- Upgrade Exhibit button now hosts the tier odds tooltip directly; standalone ⓘ info button removed
- New exhibit slot flashes yellow when Upgrade Exhibit is clicked
- Ready button disabled (greyed) when Exhibit is empty; native tooltip explains why
- "Effect" section header added above passive description in card tooltip
- Scoring continue button appears immediately when judging resolves (removed 800ms delay)
- Empty card slots more visible: brighter dashed border (#4d5566), opacity 0.65
- "Hover specimens to see their abilities" hint in Specimen Market header
- Area descriptions added: "Active specimens — score each round" / "Reserve bench — won't score"
- "Exhibits" label renamed to "Exhibit" (singular) throughout UI and rules popup
- Bug fix: `updateShopControls` and `updateHUD` used `textContent=` which destroyed child tooltip spans — fixed to save/re-append before overwriting

**UX pass 2 (2026-04-21):**
- Tooltip horizontal clamping: synergy badges, augment badges, item bag pills no longer overflow viewport edges
- Augment/item pick offers moved from side-panel modal into the shop bottom bar; attention toasts removed
- Button renamed: "Add Plinth" → "Upgrade Exhibit"; HUD level renamed "Lv N" → "Exhibit Lvl N"
- Added ⓘ info button next to Upgrade Exhibit showing per-level T1/T2/T3 shop odds table (originally labelled Common/Uncommon/Rare; renamed to match card tier terminology)
- Contextual descriptions added under "Choose an Augment" / "Choose an Item" headers
- Item offer titles now blue (#79c0ff) to distinguish from augment gold
- "Next income" label moved to centred sub-row beneath the top HUD header
- HUD left/right given flex:1 so Rep/Gold/Exhibit Lvl is truly centred
- Version bumped to v0.15

**Theme direction (locked 2026-04-20):** Player is an exotic alien collector competing in a judged exhibition (not combat). Creatures are deliberately ugly/strange aliens, played completely straight for irony. Score = collection appraisal / exhibition ranking. Species = alien biology type. Class = dominant emotion. See `design_log/theme_redesign.md` for full mapping.

**Theme rename pass (2026-04-20):**
- All 20 card names replaced with alien scientific names (Rick & Morty register, 2 syllables, -borg/-ax/-orb/-zak suffixes)
- Species renamed: Warrior→Plasmic, Mage→Sporal, Hunter→Chitinous, Beast→Crystalline, Demon→Abyssal
- Classes renamed: Knight→Shy, Assassin→Livid, Ranger→Giddy, Priest→Sullen, Berserker→Pompous
- Updated: src/cards.js, src/board.js, src/items.js, src/sim.js, web/app.js
- Fixed web/style.css species color classes (were still keyed to old names, cards showed no background color)
- Sim verified post-rename: greedy=71%, plasmic-stack=61% — math intact

**Item & augment rename (2026-04-20):**
- Items renamed: Claymore→Exhibition Stand, Recurve Bow→Growth Serum, Giant's Belt→Rarity Certificate, Warmog's Armor→Stimulant Pod, Zeke's Herald→Pheromone Diffuser, Hextech Gunblade→Market Tag, Last Whisper→Bloom Stimulant, Guinsoo's Rageblade→Acclimatisation Log, Spear of Shojin→Camouflage Gland
- Emblems renamed: `Emblem of [Species]` → `Taxonomy Badge: [Species]`; `Crest of [Class]` → `Mood Tag: [Class]` (ids unchanged)
- Augments renamed: Heroic Resolve→Prestige Display, Iron Will→Conditioning Protocol, Time Dilation→Acclimatisation Program, Exponential Growth→Rapid Development, Shapeshifter→Species Reclassification, Early Bird→Early Bloomer, Midas Touch→Market Savant, Hive Mind→Collective Resonance, Overflow→Extended Enclosure, Tycoon→Collector's Eye, Varietal→Diverse Portfolio, Cross-Training→Cross-Pollination
- Updated: src/items.js, src/augments.js, web/app.js (dev panel item dropdown was using id not name)
- All augment/item ids kept stable — only display names changed

**Concept:** Single-player roguelike Auto Chess. Draft cards, build species synergies, out-score fake opponents over 30 rounds. Cards have passive effects (8 axes), combine 3-of-a-kind to upgrade, equip items, pick augments at rounds 3/7/12. Start at L3 with 9g.

**Working pitch:** *"Auto-Card Battles: draft cards, build synergies, out-score your opponents. No combat — just the board, the math, and the meta."*

**Phase 9.2 sim results (2026-04-20):** 200-game batch, seed=1:

| Policy | Winrate | Avg rounds | Run survival | Target |
|--------|---------|------------|--------------|--------|
| greedy | 63.0% | 20.1 | 23.5% | 45–70% ✓ |
| wide | 62.4% | 20.4 | 24.0% | competitive ✓ |
| warrior-stack | 55.8% | 18.5 | 13.0% | ≤ greedy ✓ |

**Architecture as of Phase 9.2:**
- `src/cards.js` — 20 cards, 5 species, 5 classes, 3 tiers, 8 passive axes; SYNERGIES + CLASS_SYNERGIES
- `src/board.js` — scoring pipeline Stages 0–5 + 3b/4a-class; effectiveClassCounts + cardHasClassTag
- `src/items.js` — 15 items (10 + 5 class Crests); pre-processor wrappers for axis-mod items
- `src/augments.js` — 12 augments (incl. Varietal, CrossTraining), picked 1-of-3 at rounds 3/7/12
- `src/game.js` — `Player` + `Run`; 30-round roguelike vs fake opponents; L3/5g-income start
- `src/opponents.js` — fake opponent score curve tuned to 45–70% player winrate
- `src/sim.js` — `greedy` / `random` / `warrior-stack` / `demon-arc` / `wide` policies; `runGame` / `batchSim`
- `src/shop.js` — per-player weighted draw; reroll cost 2g (3g at L6+); Midas reduces by 1g
- `web/app.js` — browser UI; augment modal + Shapeshifter sub-modal; item bag + attach flow; opponent board viewer; dev panel (?dev=1)

**Run the game:** `node serve.js` → http://localhost:3001

**Phase 8.1 + 8.2 changes (2026-04-19):**
- A1: `onBuyShop` guards `isFull()` before `shop.buy()` — card no longer silently destroyed on full board
- A2: `_combine` captures `shapeshifterSpecies` before splicing source cards — tag survives combine
- A3: `renderSynergyBar` uses `effectiveSpeciesCounts` — Dragon Knight, Morphling, Emblems now display correctly
- B1: Augment badges use `<span class="aug-tooltip">` instead of `title` — styled hover tooltip
- B2: `mouseenter` toggles `.tooltip-below` when card is within 180px of viewport top — no more clipping
- B3: `Board.calcScoreBreakdown()` added; `calcScore` is now a thin wrapper; card faces show effective score + `(base N)` secondary; tooltip shows per-line breakdown
- Sim re-run post-refactor: 60.1% winrate (was 59.8%) — within noise, math intact

**Phase 8.3 changes (2026-04-19):**
- `src/game.js`: `player.itemBag = []`; `Run.itemPickRounds = [5,10,15]`; `Run.pendingItem()` / `pickItem()` — mirrors augment pick flow
- `src/sim.js`: `resolveItemPick()` — greedy picks first offered item, attaches to highest-EV unit with a free slot
- `web/app.js`: `'item'` phase; `showItemModal()` (mirrors augment modal); `renderItemBag()` inventory panel with click-to-attach / click-again-to-cancel; universal pip detach returns to bag; `onCardClick` handles attach mode; `.attach-target` highlight on eligible cards
- `web/style.css`: item bag panel, attach-target card border, detachable pip cursor/hover
- Sim re-run post-phase: 69.1% winrate (was 60.1%) — items boost player, still within 45–70% target

**Playtest 2 complete (2026-04-20).** Feedback collected; full findings + Phase 9 plan in `design_log/playtest_2_findings.md`. Headline: no pivot pressure in current design — Warrior mono-builds dominate, 3-stars too easy, economy loose. Decision: solve structurally (add class tag as second synergy axis) + balance (economy tighten, synergy rebalance, diversity augments). Rejected simulated pool drain — no signal value without drafting opponents.

**Phase 9.1 changes (2026-04-20):**
- A1: `makeItemTooltip(item)` helper — styled tooltip (name + axis + description) shared by bag pills and equipped pips; pips get `position: relative`; removed native `title` attribute fallback
- A2: `renderAugmentBadges` switched to DOM building; `mouseenter` toggles `.tooltip-left` when badge + 240px would overflow right edge; `.aug-tooltip` now `max-width: 240px` + `word-wrap: break-word`
- A3: `generateOpponentSnapshot(round, opponentName)` in `web/app.js` (separate seeded RNG — no effect on gameplay RNG); `onReady()` attaches snapshot to result; toggle button + `.opp-board` section in result modal; `'viewer'` context added to `makeCard` (no pips, no click handlers)

**Phase 9.2 changes (2026-04-20):**
- B1: `BASE_INCOME` 7 → 5; reroll cost scales to 3g at L6+ (2g with MidasTouch). Greedy sim: 63.0% winrate (was 63.0% — within noise; run survival 27% → 23.5%).
- B2: Synergy rebalance — Warrior-4 flat 65→48, Warrior-2 22→26; Hunter-3 45→40, Hunter-2 18→22; Beast-6 85→78, Beast-4 38→42, Beast-2 14→18; Mage-4 ×1.30→×1.27, Mage-2 ×1.14→×1.17; Demon-4 ×2.2→×1.90, Demon-2 ×1.8→×1.60. Greedy: 61.2%, warrior-stack: 53.2%.
- B3: Added `Varietal` augment (+8 flat/card per unique active species) and `CrossTraining` augment (+8% global mult per active synergy). Added `wide` policy to sim. Post-B3: greedy=63.0%, wide=62.4%, warrior-stack=55.8%. Diversity builds now competitive with greedy; mono-Warrior lags 7+ pp behind.

**Phase 9.3 changes (2026-04-20):**
- C1: `class` field added to all 20 cards (5 classes × 4 cards, each class spans 3–4 species). `CLASS_SYNERGIES` + `CLASSES` exported from `src/cards.js`. 5 class emblem items (`Crest of [Class]`, axis `5-class`) added to `src/items.js`.
- C2: `effectiveClassCounts()` + `cardHasClassTag()` in `src/board.js`. Class synergy stages added to `calcScoreBreakdown` pipeline (3b: class flats after species flats; 4a-class: class mults after species mults). `CrossTraining` augment now counts both species and class active synergies. `activeSynergies()` returns both kinds.
- C3: `renderSynergyBar` shows two rows (species gold, class blue). Card face shows `<span class="card-class">`. `makeSynergyTooltip` includes class synergy threshold section. `itemAbbrev` handles `Crest of`.
- C4: Sim-tuned CLASS_SYNERGIES values (initial values ~3× too high; iterated to final). Greedy=70.4%, wide=69.2%, warrior-stack=63.5%. All within/at 45–70% target; ordering correct.

**Phase 9.3 sim results (2026-04-20):** 200-game batch, seed=1:

| Policy | Winrate | Run survival | vs Phase 9.2 |
|--------|---------|--------------|--------------|
| greedy | 70.4% | 36.0% | +7.4pp ✓ |
| wide | 69.2% | 35.0% | +6.8pp ✓ |
| warrior-stack | 63.5% | 23.0% | +7.7pp ✓ |

Class synergy values (final):
- Knight (flat/class): 2→+8, 4→+16
- Assassin (mult/class): 2→×1.12, 4→×1.28
- Ranger (flat/class): 2→+6, 3→+14
- Priest (mult/all): 2→×1.02, 4→×1.05
- Berserker (mult/class): 2→×1.13, 4→×1.30

**Phase 10 complete (2026-04-20):** Card layout fix, axis labels removed, synergy wording + syn-bar tooltips, Exhibition Floor/Holding Pen/Rep relabels, side-panel modal during augment/item picks, class glyphs (◌◆◈▪▲).

**Phase 11 complete (2026-04-20):** Battle scoring animation + rank-up throb. New `'scoring'` phase replaces `'result'` entirely. Flow: shop → Ready → scoring → Continue → shop (or game-over).
- `allocateByWeight` + `calcOpponentPerCardScores`: scores fabricated proportionally, player side normalized to sum to `r.playerScore`
- Two-column judging modal (Your Exhibition | Opponent Exhibition); cards never stretch when columns are unequal height (`align-items: flex-start`)
- `animateScoringSequence`: card punch (scale 1→1.18→0.95→1, 280ms), score fades in at 120ms, `+N` delta floats up from running total (600ms opacity+translate), 600ms inter-phase gap, winner reveal holds 800ms; skip() cancels all timeouts and snaps to final state
- `showResultModal` deleted; `'result'` phase removed
- Rank-up throb: `data-card-id` on all card elements; `runCombinesWithEffect()` detects newly combined cards (new `_id`, `stars > 1`); `animateRankUps()` adds `.throbbing` (double golden pulse glow, 650ms); wired into `onBuyShop` and `onCardClick`
- Files: `web/app.js`, `web/style.css`

**Phase 12-A complete (2026-04-21):** Board total hidden; "Exhibition Floor" renamed to "Exhibits".
- Removed `#score-preview` span from `web/index.html` board section header — players no longer see the running total during shop/prep phase
- Removed `qs('#score-preview').textContent` update line from `web/app.js` `updateHUD()`; `calcScoreBreakdown` + `bdMap` retained (still needed for per-card tooltip breakdowns)
- Renamed area label "Exhibition Floor" → "Exhibits" in `web/index.html`
- Design rationale: aggregate total is now only revealed during the judging animation (first dramatic moment); per-card scores, synergy bars, and tooltip breakdowns remain fully visible so buying decisions are unaffected. Practical opacity: players *can* add up per-card scores but won't casually, so tension is preserved without punishing information hiding.
- Files: `web/index.html`, `web/app.js`

**Phase 12-B complete (2026-04-21):** Repo made public for external playtesting.
- Repo is public on GitHub at `https://github.com/bazzboyy1/auto-card-battles`
- (Historical note: an earlier draft of this entry referenced Netlify; we never actually deployed there. `netlify.toml` is leftover and unused — safe to delete.)

**Post-deploy playtest findings (2026-04-21):** Full analysis in `design_log/phase_13_plan.md`.
- BUG: Animation per-card scores differ from Exhibits card-face scores — root cause: `roundsSinceBought` is incremented after `calcScore()` in `runBattle()`, but animation re-computes breakdown post-increment
- BUG: Species + class tag ("Sporal ◌SHY") crowd onto same line — CSS layout fix needed
- BUG: `_combine()` resets `roundsSinceBought` to 0 — Growth Serum and Acclimatisation Log lose all accumulated rounds on upgrade
- UX: Augment/item pick in RHS panel goes unnoticed — need attention toast
- DESIGN (keep): Growth Serum retroactive application on attach is intentional — high-impact moment, felt good

**Polish pass (2026-04-21):**
- Game renamed to **Exotic Alien Extravaganza** (`<title>` + splash h1)
- Splash screen added: `Splash.png` full-bleed background, gradient overlay, pitch copy, "Enter Exhibition →" button; game initialises on load, reveals on button click
- Pitch copy: *"The finest collectors in the universe display their specimens before the galaxy's most discerning judges. Build your exhibition. Protect your reputation. Try not to embarrass yourself."*
- v0.12 version label added to HUD right (dim, small)
- Flavor text added to all 20 cards (`flavor` field in `src/cards.js`); rendered italic + dimmed in tooltip below passive description (`web/app.js`, `web/style.css`)
- Flavor text written in plural/sub-species register ("Sporviks continuously weep..." not "Sporvik weeps...")
- Deploy fix: `Splash.png` was not committed and CSS path was wrong case (`/splash.png` → `/Splash.png`)

**Phase 13 complete (2026-04-21):** Post-deploy bug fixes.
- A1: `runBattle()` now calls `calcScoreBreakdown(ctx)` before the `roundsSinceBought` tick and stores it as `scoreBreakdown` in the result entry. `showScoringModal()` uses the stored snapshot — animation scores now match card-face scores exactly.
- A2: `_combine()` captures `Math.max(...source.roundsSinceBought)` before splicing source cards and assigns it to the upgraded card — Growth Serum and Acclimatisation Log no longer lose accumulated rounds on upgrade.
- A3: `.card-labels` switched from `flex-wrap: wrap` row to `flex-direction: column` — species and class badges always stack vertically, no crowding even for longest names.
- A4: `showAttentionToast()` added; called when entering `'augment'` or `'item'` phase — center-screen banner ("Choose a Collector Upgrade →" / "Item Pick Ready →") fades in/out over 1.5s.
- Sim re-run post-A1+A2: greedy=73.7%, wide=71.8%, warrior-stack=66.5% (ordering preserved, within noise of ±3pp from 70.4%).

**Phase 14 complete (2026-04-21):** UX discoverability pass — four intuition fixes from post-deploy feedback.
- "Buy XP" replaced with **Add Plinth**: XP accumulation removed; direct slot purchase at tiered cost (8/8/12/20/24/28g L3→L9); button label updates dynamically; tooltip "Larger exhibitions attract rarer specimens" explains pool-tier side-effect. `#hud-xp` span removed.
- **Pip × badge**: filled item pips always show a small red × overlay (0.55 opacity), scales to full on hover — makes unequip affordance discoverable without changing the existing click-to-detach mechanic.
- **Always-visible synergy bar**: all 10 synergy rows (5 species + 5 class) rendered from round 1 at 0.4 opacity when inactive; threshold tooltips accessible immediately via hover. Previously only rows with count > 0 appeared.
- **Owned-copy counter on shop cards**: shows "You own ×N" on cards you already hold; shows pulsing gold "★ Upgrade! (you have 2)" banner when buying would trigger a combine. Teaches the 3-of-a-kind rule implicitly.
- **Sell returns items**: `Player.sell()` now pushes all `card.items` back to `itemBag` before removing the card.
- Files: `src/game.js`, `src/sim.js`, `src/diag.js`, `web/app.js`, `web/index.html`, `web/style.css`

**Polish (2026-04-21, post-UX-pass-2):** "Shop" renamed to "Specimen Market" throughout UI (section label, phase tag, lock button). T1/T2/T3 used in Upgrade Exhibit odds tooltip instead of Com./Unc./Rare.

**Phase 15 complete (2026-04-24):**
- A1: Opponent curve raised ~40% from R5 onward (R30 cap 3840→5535); accepts `rankMult` param
- A3: `title` tooltip on card-tier div clarifies T1/T2/T3 = pool rarity vs ★ = combine level
- R1–R4: `src/ranking.js` — 5 tiers (Enthusiast→Luminary), 3-run placement, RP system (win=30+rep×0.7, loss=−40, promote@200, demote<0 land@100), localStorage persistence under key `alien-exhibition-meta`
- `Run.rankMult` wired into `generateOpponent` — opponent difficulty scales with rank
- HUD shows "Calibration N/3" during placement, then tier name + RP/200 bar
- Run-complete modal shows RP change, promotion/demotion message, progress bar
- Version bumped to v0.17

**Phase 17 complete (2026-04-25):** Planning-phase bonus animations (v0.19).
- Score delta floaters (`+N`/`-N`) appear on board cards whenever a score changes during the shop phase: buy (synergy activates), sell (synergy breaks), bench↔active moves, item attach/detach, augment pick.
- Green (`#7ee787`) for gains, red (`#f85149`) for losses. Floats upward over 750ms and self-removes.
- Card glow flash (green/red ring) accompanies each delta — affected units are visually obvious at a glance.
- Synergy badge gold pulse (`syn-pulse`) fires when a species or class tier threshold is newly crossed.
- Augment badge green pulse (`augment-badge-pulse`) + staggered card sweep (`card-bonus-flash`, 60ms between cards) when an augment is picked — badge lights first, then cards catch the glow left-to-right, creating a clear source→target association.
- `data-synergy-key` added to all synergy badges; `data-aug-id` added to augment badges so animations can target them post-render.
- Economy/structural augments (Overflow, Tycoon, Shapeshifter) excluded from card sweep — no misleading "your scores changed" signal.
- New helpers: `captureScores()`, `captureSynergyTiers()`, `floatDelta()`, `animatePlanningDeltas()`, `animateSynergyChanges()`, `flashAugmentEffect()`.
- Files: `web/app.js`, `web/style.css`, `web/index.html`.

**Phase 18 complete (2026-04-25):** Flat + ×mult display on card face (v0.20).
- Active board cards now show additive flat and multiplicative factor separately (e.g. `76 ×1.02`) instead of the combined final score.
- Mult value styled orange (`#ffa657`) — same colour as mult lines in the existing tooltip breakdown, so the visual language is consistent.
- Cards with no active mult (≤ 1.001) show plain flat only — no ×1.0 clutter.
- Bench and shop cards unchanged: plain base score (no breakdown object passed).
- No changes to `src/board.js` — derived from existing `bd.lines` in `makeCard()` via sum of `add` entries / product of `mult` entries.
- Judging animation unchanged — still shows final allocated per-card scores.
- Files: `web/app.js`, `web/style.css`, `web/index.html`.

**Item & augment audit (2026-04-25):**
- Full audit of all 20 items and 12 augments — every effect verified in the node engine.
- **Fixed (v0.20.1):** Squorble card face showed flat (135) in rounds 1–9 instead of flat + penalty mult (135 ×0.50). Phase 18 display condition `multTotal > 1.001` never fired for mults < 1. Fixed to `Math.abs(multTotal - 1) > 0.001` in `web/app.js makeCard()`.
- **Known issue — Growth Serum breaks Blinxorp/Scrithnab cap:** Blinxorp's "max +400" cap is inside its eval; `wrapPassive` doubles the result *after* the cap, so Growth Serum yields effective max +800. This silently undoes the Phase 16 balance fix. Fix requires deciding whether to clamp the doubled result or restructure the cap out of the eval. **Deferred.**
- **Known edge cases (not bugs, no action yet):**
  - Prestige Display (+25 base) is skipped on Sprangus because `baseOverride: 0` bypasses the Stage 0 item/augment path.
  - Acclimatisation Log bypasses Sprangus's "scores 0" design (Stage 1 adds +20/round after the baseOverride, giving Sprangus real score).
  - Market Savant is economy-only (doubles Sporvik tickGold, Sharzak sellBonus, -1g reroll) — no effect visible in score breakdown tooltip; players may think it's broken.
  - Spear of Shojin species contribution invisible in synergy bar (preview skips player RNG — documented).
  - Items on wrong-axis cards (e.g. Growth Serum on axis-2 card) silently do nothing.

**Phase 19-B complete (2026-04-26):** Judges + chapters shipped (v0.22).
- `HEAD_JUDGES` array (6 judges) in `src/game.js`; `Run._assignJudges()` draws 3 without repeats using run RNG
- `Run.chapterFor(round)` / `Run.currentJudge(round)` helpers; chapter boundaries at R1/R9/R17
- `ROUND_TARGETS` extended with `preferredTarget` (base × 0.85, rounded) per round
- `Run.runBattle()` checks `judge.qualifies(board, augments)` before each battle; uses `preferredTarget` when qualifying
- `effectiveClassCounts` + `CLASS_SYNERGIES` imported into game.js for Yorzal's class-synergy check
- Judge panel rendered below income-preview HUD bar: shows chapter label, judge name, preference text, qualifying status (green "✓ Preferred (−15% target)" vs neutral hint)
- Panel updates live as board changes (called from every render branch)
- Chapter reveal overlay on R1/R9/R17: slides in over 2.2s then fades out
- Scoring modal heading includes judge name ("Round N — Judge Vlorb"); shows green "✓ Preferred (−15% applied)" note when qualifying
- Battle history entry extended: `normalTarget`, `preferredTarget`, `judgeId`, `qualified`
- Game-over round history shows "✓pref" badge on rounds where player qualified
- `HEAD_JUDGES`, `CHAPTER_LABELS` exported from game.js, available via `window.ACB.game`
- Browser-verified: judge panel visible R1, scoring modal shows judge name, no JS errors

**Phase 19-A complete (2026-04-26):** Core swap shipped (v0.21).
- Removed `src/opponents.js` dependency from game.js, sim.js, loader.js
- `ROUND_CAP` 30 → 24; `STARTING_LIVES = 3` added to Run
- `ROUND_TARGETS[24]` array in game.js: each entry `{ target, isCritique }` — critiques at R8/R16/R24
- `Run.runBattle()` now compares playerScore vs target; decrements `run.lives` on miss; tracks `run.peakScore`
- `Player.applyResult(passed)` simplified: no HP damage, still tracks streak/wins/losses (streak drives income bonus)
- `Run.isOver()` → `lives === 0 || round >= 24`
- `src/ranking.js` replaced: Exhibition Rating = (round × 100) + (lives × 200) + (peak/10); localStorage key `alien-exhibition-best`; `recordRun()` returns `{ rating, best, isNewBest }`
- HUD: HP span replaced with 3 seal diamonds (`◆` filled / `◇` empty via CSS); `#hud-rank` removed
- Scoring modal: two-column opponent → single player column + "Judge's Target" number on right; result shows "Target met / Target missed · Seal lost · N seals remain"
- Run-end modal: Exhibition Rating block + Round History table; no RP/placement text
- `src/sim.js`: `battleHistory` replaces `opponentHistory`; `survived = round >= 24`; `livesRemaining` in result
- `src/balance.js`: updated to use `battleHistory`
- Browser-verified: lives decrement correctly, scoring modal shows target, run-end shows rating and history

**Phase 19-C complete (2026-04-26):** Critique rounds shipped (v0.23).
- `CURATOR_SELECTIONS` in `src/game.js`: one themed item/augment per judge (Vlorb→Taxonomy Badge: Abyssal, Praxis→Acclimatisation Log, Shen-Nax→Rarity Certificate, Yorzal→Cross-Pollination augment, Collective→Diverse Portfolio augment, Assembly→3-choice free augment pick)
- Life-regain: beat a critique target by 25%+ while lives < 3 → `run.lives++`, `lifeGained: true` in battle entry
- `Run.pendingCurator()` / `Run.pickCurator(idx)`: checks last battle was a critique, returns cached offer; `_curatorsPicked` prevents double-pick
- Scoring modal: adds `.critique-round` class on `#modal` for gold border/heading; life-regain shows "◆ Seal restored!" badge with pop animation
- `onContinue()` checks `pendingCurator()` before `startRound()` → enters `'curator'` phase
- Curator phase renders in shop-section with `renderCuratorOffer()`: single-gift card for most judges, 3-choice augment-card row for The Assembly; clicking accepts the gift and calls `startRound()` (which fires chapter reveal for R9/R17 after the gift)
- Judge panel visibility fix (from feedback): shows concrete target numbers — "2+ Abyssal active → 800 (680 if met)" when not qualifying, "✓ Target: 680" when qualifying; critique rounds show "★ Critique" tag
- The Assembly neutral text changed from "No bonus" to "All equally scored · Target: N"
- Shapeshifter filtered from Assembly's augment-pick pool to avoid nested sub-picks

**Phase 19-D complete (2026-04-26):** Build archetypes shipped (v0.24).
- `detectArchetypes()` in `web/app.js`: checks live board each render; 8 archetypes — Plasma Cascade (4+ Plasmic), Void Assembly (4+ Abyssal), Spore Engine (Sprangus + 2+ other Sporal), Crystal Lattice (4+ Crystalline), Chitin Wall (3+ Chitinous), Emotional Spectrum (3+ class synergies active), Patient Collection (3+ cards held 10+ rounds), Star Collector (2+ 3★ active)
- `updateArchetypeDisplay()`: tracks `S.archetypeOrder` — newly active archetypes prepend so most-recently-triggered shows prominently; stale ones drop off
- `#archetype-display` strip below judge panel: primary archetype in purple pill badge + `archetype-appear` pop animation when first triggered; secondary archetypes in smaller dimmer pills beside it; hidden when no archetypes active
- Reset on `newGame()`; called from `renderBoard()` so updates on every board change

**Phase 19-E complete (2026-04-26):** Difficulty tiers + meta-progression (v0.25).
- `TIERS` array in `src/ranking.js`: Standard (×1.0), Discerning Judges (×1.25), Elite Circuit (×1.5)
- Tier state persisted in localStorage under `alien-exhibition-tiers`; `getActiveTier`, `tryUnlockNextTier`, `setActiveTier` exported
- `Run` constructor accepts `diffMult`; targets in `runBattle()` scaled via `Math.round(base * diffMult)` — all other systems unchanged
- `renderDifficultyPicker(containerEl)` renders pill buttons into any host; shown on splash (`#difficulty-selector`) and in the game-over modal (`#modal-diff-picker`)
- `newGame()` reads active tier and passes its mult to `new Run(rng, tier.mult)`
- `showGameOverModal()` calls `tryUnlockNextTier` on a 24-round clear; shows green unlock banner + refreshed picker
- HUD right shows `#hud-difficulty` with current tier label (amber for Discerning, red for Elite)
- Locked tiers show 🔒 prefix + disabled button with unlock-hint tooltip
- Browser-verified: selector renders on splash, HUD shows "STANDARD", no JS errors

**Next action:** Phase 19 complete. Decide next: (a) Playtest 3 — ship to external players, collect feedback; (b) Phase 20 balance — address livid-stack dominance (71% vs greedy 55%), crystalline/giddy dead-path risk (36-39%), and Growth Serum cap-bypass on Blinxorp; (c) both in parallel.

**Open items (not yet spec'd):**
- Shapeshifter + class interaction (deferred to playtest 3)
- Drafting opponents (would unlock real pool drain + archetype signals; deferred post-Phase 9)
- Board positions for Axis 6 aura effects
- Leaderboard / persistence / real async matchmaking

---

## How to use this file

- On `/resume`, read **this file only**. Then decide which sub-file(s) to load based on the user's request.
- For "continue / what's next / go": read `design_log/initial_spec.md`. Full design spec + phase plan.
- For "why did we do X": read relevant sub-file (created as phases complete).
- When a pass finishes, append notes to the relevant sub-file and update the "Current state" block above.
- **Before any design work** (new cards, synergies, augments, items, achievements): read `design_log/balance_principles.md`. These are the agreed design principles — act on them without re-deriving them.

---

## Index

- **`design_log/initial_spec.md`** — Full design spec: card list, economy params, synergy system, phase plan. Read this when starting or resuming work.
- **`design_log/async_redesign.md`** — Phase 6+ spec (async/roguelike model, passives, items, augments). Supersedes `initial_spec.md` from Phase 6 onward.
- **`design_log/async_redesign_plan.md`** — Phase-by-phase implementation plan for the async redesign.
- **`design_log/playtest_1_findings.md`** — First playtest feedback + Phase 8 plan (bug fixes, UX polish, item acquisition). Read when starting Phase 8.
- **`design_log/playtest_2_findings.md`** — Second playtest feedback + Phase 9 plan (UX fixes, economy tuning, classes as second synergy axis). Read when starting Phase 9.
- **`design_log/playtest_3_findings.md`** — Third playtest findings + Phase 10 plan. Read when resuming after Playtest 3.
- **`design_log/phase_11_scoring_animation.md`** — Phase 11 spec: battle scoring animation (per-card reveal, running totals, winner reveal). Read before starting Phase 11.
- **`design_log/phase_13_plan.md`** — Phase 13 plan: post-deploy bug fixes (score snapshot, combine roundsSinceBought, species/class layout, side-panel attention toast). Read when starting Phase 13.
- **`design_log/phase_19_plan.md`** — Phase 19 plan: The Exhibition Arc. Full structural redesign — removes fake opponents + RP system, replaces with escalating score targets, lives system, head judges per chapter, build archetypes, Exhibition Rating meta-progression. Read when starting Phase 19.
- **`design_log/phase_21_plan.md`** — Phase 21 plan: Polish & Clarity pass. Prioritised fix list from game-design-framework review (2026-04-27). Includes playtest script.
- **`design_log/phase_23_plan.md`** — Phase 23 plan: Unlock system. Run achievements gate 5 new content pieces (2 augments, 1 judge, 2 items). Full spec: data structures, achievement conditions, pool filtering, UI, implementation phases.
- **`design_log/balance_principles.md`** — Design philosophy: viable diversity target, numeric survival targets, dead-ends vs. commitment paths, species/class synergy calibration rules, asymmetric balance limitations. Read before any design work.
- **`design_log/phase_25_plan.md`** — Phase 25 plan: 9 new achievement/reward slots (plasmic_master, pompous_devotee, emotional_virtuoso, patient_master, star_curator, late_game_collector, discerning_graduate, elite_curator, grand_survivor). Full implementation spec including board.js hooks, ctx arg extension, unit tests, balance checks.
- **`design_log/phase_26_plan.md`** — Phase 26 plan: Simulated Market Scarcity. Core design diagnosis (score execution game, autochess tension void), proposed rival demand mechanic, secondary issues (dead species validation, global multiplier stacking, Murborg passive), implementation order, open questions.

---

## Hard reminders (never lose these)

- **Cards are data, not code.** New cards go in `src/cards.js` data section. Only add new effect logic if the scoring formula can't express it.
- **Headless first, GUI only at escalation milestones.** Runtime self-testing > GUI tinkering.
- **Log is the source of truth.** If memory or chat contradicts the log, trust the log. Update the log before moving on from a pass.
- **Sim-first.** Build batch runner before touching UI. Tune with data, not feel.
- **Don't over-tune early.** Card balance is polish. Get the loop working first.
- **Carry from Flipside:** same phased process — headless → economy tuning → UI → polish.
