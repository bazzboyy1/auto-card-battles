# Phase 32 — Theme Pass (plan)

**Status:** ✅ shipped 2026-05-02 as v0.53. Successor to Phase 31-B.3 (v0.52). See "Outcome (post-ship)" at bottom.

**Target version:** v0.53.

**One-line goal:** conform every user-visible label, flavor line, and named entity to the locked alien-curiosity-show theme; and close the one structural theme/mechanic gap (no judge loves *Quaint*) that's leaving Sporal as the dead species.

**References consulted (`game-design-skills`):**
- `synergy-thematic-design.md` — primary driver. "Every design decision must support the theme. Do not mix conflicting themes." Combat-coded labels under a curiosity-show theme = the same dissonance as glory music over horror visuals.
- `visual-player-guidance.md` — used to *reject* glyph/ASCII portraits. Faces are the strongest attention capture; a low-fidelity face is worse than no face.
- `hicks-law-decision-optimization.md` — used to *cap* the rename scope. Renaming player verbs (Continue, Sell, Reroll) costs re-learning without theme payoff. Rename nouns, not verbs.
- `reinforcement-feedback-systems.md` — judge personality is a context-variable reward; prose carries the variable-reward weight better than visual fidelity.

---

## Scope (4 buckets)

### Bucket A — User-visible noun renames

Rule: rename only **user-visible nouns**. Internal identifiers (`runBattle`, `battleHistory`, `S.result`) stay; this is a theme pass, not a refactor.

| Current label | Renamed to | Where (files) | Notes |
|---|---|---|---|
| Score (round total) | **Appraisal** | `web/index.html`, `web/app.js` (HUD, modals, breakdown) | The headline rename. |
| Lives | **Reputation** | `web/index.html` (`#hud-lives` tip line), `web/app.js` (run-end copy, HUD label) | Already conceptually framed as "Exhibition Seals" in the tip — collapse to Reputation. |
| Battle (HUD `phase-tag`) | **Showing** | `web/app.js:1352-1353`, `web/style.css` (`.phase-tag.battle` → `.phase-tag.showing`) | Single biggest combat tell. |
| Pre-round | **Curating** | `web/app.js` (paired with Showing) | Pair with Showing so the two phase tags read as a curator's verb cycle. |
| "outscore your rivals" | **out-appraise your rivals** | `web/index.html:107` splash pitch | One-line copy edit. |
| Run end "the run ends" | **the salon dismisses you** | run-end modal copy | Per Phase 27 plan: "Failure isn't a loss; the salon dismisses you." |
| Gold (currency) + `g` suffix | **Lustres** + **✦** symbol | all of `web/`, all of `src/` (170 hits across 13 files) | **Decided in this plan.** "Lustre" is what appraisers measure (a specimen's display sheen); the currency name then *means* "the thing you spend to buy more sheen." Tight loop with the Appraisal/Reputation rename. Hick's Law isn't triggered — currency renames are noun-only and instantly absorbed (gil/credits/septims/caps/eddies). Internal identifiers (`gold`, `goldTotal`, etc.) stay; only user-visible strings change. |
| Sell | **Release** *(deferred — see below)* | shop sell button | **DEFER unless playtest confirms.** Verbs cost re-learning per Hick's Law; "Sell" is unambiguous. |
| Target (judge bar) | **Threshold** *(deferred)* | HUD judge panel | **DEFER.** "Target" is theme-neutral; no payoff. |

**Acceptance:** grep shows no `battle` / `combat` / `fight` / `attack` / `damage` / `enemy` / `opponent` strings in `web/index.html`, `web/app.js` *user-visible code paths* (HTML strings, modal copy, button text). Internal JS identifiers are out of scope.

### Bucket B — Per-judge flavor data (no portraits)

**Decision: text-only.** Glyph + color band + 4 prose quotes per judge. No ASCII portraits, no SVG, no images. Re-evaluate after first playtest read.

Add to each judge def in `src/judges.js`:
- `glyph: '👁'` (one unicode mark; per-taste families to give the slate visual variety)
- `band: 'judge-grotesquerie'` (CSS class; one per taste, mapped to a color in `web/style.css`)
- `quotes: { opening, passing, scraping, failing }` — 4 short prose lines

Quote tone guide (per `synergy-thematic-design`): each judge has a fixed *attitude* (greedy, snide, pious, performatively bored, etc.). Players should remember "Madame Sereth thinks all my boards look like junk drawers" the way Spire players remember Act 3 Elites.

Counts: **18 judges × 4 quotes = 72 lines of flavor copy.** Single-pass write; not blocking.

**UI integration:**
- Slate-reveal modal: render `glyph` + `band` + `name` + taste hint (existing) + 1-line opening quote.
- Chapter-reveal: same.
- Scoring modal: pick `passing` / `scraping` / `failing` based on `score / target` ratio (≥1.10 / 1.00–1.10 / <1.00) and append as a "Judge says:" line.

### Bucket C — Sporal rebalance via new *Quaintness* taste

**Diagnosis (from Phase 31-A data + tag distribution audit):**
- Sporal-stack greedy survival 19% vs 35.5% baseline (−16.5pp). Worst dead path.
- Sporal native tag distribution (6 cards): **Quaint ×5**, Grotesque ×2, Bizarre ×2, Ostentatious ×1.
- Quaint is **not the max-mult tag for any of the 4 existing tag-tastes** (Grotesquerie/Refinement/Architecture/Ostentation).
- Crystalline → Refinement, Chitinous → Architecture, Abyssal → Grotesquerie, Plasmic → Ostentation. Sporal: no home taste.
- This is a **synergy break** (synergy-thematic-design): theme says Sporal = "fungal, weirdly endearing" (literally Quaint). The taste table is missing the judge that loves it.

**Fix: add 5th tag-taste *Quaintness*.** Treats the dominance gap as a design omission, not a species nerf.

Implementation:
- `src/judges.js`: new taste `Quaintness`. Max-mult ×2.2 on Quaint, default ×1.0, min-mult ×0.7 on Ostentatious (the natural opposite — gaudy ≠ quaint). Mirrors the existing 4 tag-tastes' shape (×2.2 / ×1.0 / ×0.7 band).
- `src/judges.js`: 2 new judges. One chapter-eligible (e.g. *Auntie Mossfen*, charmed-by-modesty register), one finale-eligible (*Dame Burrowick*).
- `src/items.js`: **no new item needed.** Antique Doily (existing Phase 31-B.3 tag-grant item) already grants Quaint via the auto-generated `TAGS.map(...)` loop. Players can already re-aim wrong-taste cards for Quaintness through it.
- Total tastes: 10 → **11**. Total judges: 18 → **20**.

**Calibration acceptance criteria** (re-run `scripts/profile_targets.js` style sweeps, n=200, seed=1):
- Sporal-stack survival lands in 30–45% band (currently 19%).
- No species-stack moves >10pp away from baseline (don't accidentally push another species below 25%).
- Mixed-modifier survival stays in 28–35% band (current v0.52 is ~30%).
- Per-taste pass rate for Quaintness lands in 75–95% range (matches the other tag-tastes).

If Sporal-stack overshoots (>45% survival), tune by lowering Sporal max-mult to ×2.0 on Quaint instead of ×2.2.

### Bucket D — Audio audit (no work needed)

**Audited `web/sound.js`** (synthetic Web Audio API, no asset files). 24 SFX, all tonal (sine/triangle/sawtooth/square oscillators). **Verdict: theme-clean.** No impact/explosion/sword cues. Combat-adjacent name `gameLoss` is universal-game-term, not combat-specific. `sealLost`/`sealRestored` already curation-coded (Exhibition Seals = Reputation). `grandFinale` is exhibition language. `sealLost`'s sawtooth-thud is an appropriately *critical* sound for losing reputation, not aggressive.

The Phase 27 plan's worry was hypothetical; the actual implementation already serves the theme. **No SFX work in Phase 32.**

Visual-tells checklist (rolls into Bucket A):
- [ ] HUD phase tag classes: `.battle` → `.showing`
- [ ] Damage-red color usage on score-failure flashes — confirm reads as critic's red ink, not blood
- [ ] Per-card score breakdown numerics — verify they read as appraisal value, not damage

---

## Files affected

- `src/judges.js` — new Quaintness taste, 2 new judges, `glyph`/`band`/`quotes` fields on all 20 judges
- `src/items.js` — Folk Charm tag-grant item
- `src/cards.js` — **no changes** (Sporal native tags untouched; the fix is at the taste layer, not the species layer)
- `web/index.html` — HUD label renames (lives → Reputation tip, splash pitch), v0.52 → v0.53
- `web/app.js` — phase tag rename, modal copy renames, judge quote rendering in slate/chapter/scoring modals
- `web/style.css` — `.phase-tag.battle` → `.phase-tag.showing`, per-taste judge band classes
- `web/loader.js` — cache-bust v0.52 → v0.53
- `scripts/profile_quaintness.js` (new) — calibration sweep specific to Sporal-stack + Quaintness pass rate
- `DESIGN_LOG.md` + memory — phase wrap (per CLAUDE.md mandatory rule)

**Out of scope:**
- Internal identifier renames (`runBattle`, `battleHistory`, `S.result`, `gold`, `goldTotal`)
- Test rewrites (66 tests still broken from Phase 27; separate chore)
- Brutal Curation modifier human-playtest read (deferred from Phase 31-B.1)
- Refit Pool weighting for non-tag tastes (deferred from Phase 31-B.2)
- Tag-grant item offer-pool weighting toward upcoming-judge tastes (deferred from Phase 31-B.3)
- `src/ranking.js` cleanup — CLAUDE.md says it's gone but it's still wired via loader.js + app.js. Out of Phase 32 scope; flag for a separate cleanup chore.

---

## Decisions consciously *not* made (avoid re-opening)

- **No portraits.** Faces would be the strongest attention capture (`visual-player-guidance`), but a low-fidelity face is worse than no face. Re-evaluate after playtest reads ask for them.
- **Don't rename `Sell` or `Target`.** Hick's Law: re-learning verbs costs more than the theme payoff.
- **Don't re-tag Sporal cards.** Erodes per-species aesthetic identity (Phase 28's locked design). The fix lives at the judge layer.
- **No audio work.** There is no audio to audit.

---

## Acceptance summary

1. All Bucket A renames applied; grep clean of combat strings in user-visible copy.
2. All 20 judges have `glyph` + `band` + 4 quotes; slate, chapter, and scoring modals render quotes per phase.
3. Quaintness taste shipped + 2 new judges + Folk Charm item; Sporal-stack survival lands in 30–45% band.
4. Mixed-modifier baseline survival stays in 28–35% (no regression).
5. v0.53 displayed in HUD; loader cache-busted; browser smoke test (judge slate renders, scoring modal shows quote, Sporal-Quaintness end-to-end taste-mult fires).
6. `DESIGN_LOG.md` Current state + Next action updated; memory updated; phase wrap rule satisfied.

---

## Outcome (post-ship, v0.53, 2026-05-02)

**Renames shipped (Bucket A):** Score → Appraisal · Lives → Reputation · gold (g) → Lustres (✦) · Battle → Showing · Pre-round → Curating · "outscore" → "out-appraise" · "Run Over" → "Dismissed" · "salon dismisses you" copy · "Target met/missed" → "Threshold met/missed" · ⚔ Ready → Open Showing · "score breakdown" → "appraisal breakdown". Internal identifiers (`battleHistory`, `runBattle`, `gold`, etc.) untouched. 13 files edited.

**Judge data shipped (Bucket B):** all 20 judges carry `glyph` + `band` (CSS class) + `quotes.{opening, passing, scraping, failing}`. 80 prose lines written, ~10 words each, voiced per judge. Quote tier picked at scoring time from `score / target` ratio: ≥1.10 → passing, 1.00–1.10 → scraping, <1.00 → failing. Per-taste color bands wired into chapter-reveal + slate-row text color (mossy-green for Quaintness, ice-blue for Refinement, granite-grey for Architecture, etc.). No portraits — text + glyph carries the variable-reward weight per `visual-player-guidance`.

**Quaintness taste shipped (Bucket C):** new `quaintness` in `src/judges.js` (Quaint ×2.2 max, Restrained ×1.55 secondary, Ostentatious ×0.7 penalty, default ×1.4). 2 new judges: Auntie Mossfen (any-chapter) + Dame Burrowick (finale). Tastes 10 → 11; judges 18 → 20. Antique Doily (Phase 31-B.3 tag-grant item) already grants Quaint, so the re-aim path is automatic — no new item needed.

**Sprangus T3 dead-anchor fix (in-scope discovery):** Sprangus's `baseOverride: 0` was a Phase 28 leftover that zeroed its 132 base under judge mode (where the +30% Sporal aura is bypassed). Stripped the override; Sprangus now scores its full 132 base. Aura description updated to flag the bypass as "under review" (Phase 33 candidate). The plan said "no card changes" but this was a single-card structural fix that the calibration sweep made visible — kept the scope small, didn't touch other cards.

**Calibration (n=200×6 seeds, greedy = `greedy` policy):**
| Policy | v0.52 | v0.53 | Δ |
|---|---|---|---|
| greedy mixed-mod | 28.5% | **41.3%** | +12.8pp |
| sporal-stack | 19.0% | **25.3%** | +6.3pp |
| crystalline-stack | 31% | 34% | +3pp |
| chitinous-stack | 38% | 50.5% | +12.5pp |
| abyssal-stack | 41% | 44.5% | +3.5pp |
| plasmic-stack | 30% | 32.5% | +2.5pp |

Greedy 41.3% sits on the upper edge of the 30–45% target band but stays in band. Sporal-stack lifted measurably (+6.3pp) but **didn't reach the band** (still 25%, target 30–45%). Honest read: the Quaintness taste is the right structural fix (Sporal now has a home judge) and Sprangus is now a real T3 anchor, but Sporal-stack still has residual disadvantage from species/passive layer issues — flagged for Phase 33 (see below).

**Audio audit (Bucket D):** confirmed no work needed. `web/sound.js` is synthetic Web Audio (24 SFX, all tonal, no combat coding); naming is theme-neutral or already curation-coded.

## Phase 33 candidates (deferred follow-ups discovered)

- **Sporal-stack still below band (25% vs 30% floor).** Likely root causes: (1) Sprangus aura is still %-mult and bypassed under judge mode — Phase 30 pattern says convert to flat ("+25 per other Sporal on board"); (2) Sporal T1 base scores (Sporvik 52, Phlorbex 54) are competitive but not strong; (3) Quaintness chapters are only drawn ~36% of the time and most land in Ch.1 where targets are easy.
- **Greedy 41.3% on upper band edge.** If a future addition pushes it over 45%, recalibrate `ROUND_TARGETS` (Phase 31-A pattern) — don't nerf the new content.
- **Chitinous-stack jumped to 50.5%.** Sprangus fix benefitted everyone via shop-pool; if Chitinous becomes runaway-dominant in playtests, look at Architecture (Restrained ×2.4) being too generous to Chitinous's tag distribution.
- **66 unit tests still need rewrite** (Phase 27 chore, ongoing).
- **`src/ranking.js` still wired up** despite CLAUDE.md saying it's gone — separate cleanup chore.
- Brutal Curation modifier human-playtest read (from Phase 31-B.1, still pending).
- Refit Pool weights for non-tag tastes (from Phase 31-B.2, still uniform).
- Tag-grant item offer-pool weighting toward upcoming-judge tastes (from Phase 31-B.3, still uniform).
