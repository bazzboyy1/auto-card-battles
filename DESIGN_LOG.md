# Auto-Card Battles — Design Log (Entry Point)

Living index. Detail is split across `design_log/` sub-files to keep this entrypoint small. Load only what the current task requires.

---

## Current state (update this block every pass)

**Phase:** Phase 12-B complete + UX pass 3 (2026-04-21). Phase 13 (bug fixes) not yet started.

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

**Phase 12-B complete (2026-04-21):** Deployed to Netlify for external playtesting.
- Added `netlify.toml` with `[[redirects]]` rewrite: `/ → /web/index.html` (status 200)
- Repo is public on GitHub at `https://github.com/bazzboyy1/auto-card-battles`
- All absolute paths (`/web/style.css`, `/src/*.js`) work correctly from Netlify root

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
- Netlify fix: `Splash.png` was not committed and CSS path was wrong case (`/splash.png` → `/Splash.png`)

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

**Next action:** Playtest 3 or further feedback collection on Netlify.

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

---

## Hard reminders (never lose these)

- **Cards are data, not code.** New cards go in `src/cards.js` data section. Only add new effect logic if the scoring formula can't express it.
- **Headless first, GUI only at escalation milestones.** Runtime self-testing > GUI tinkering.
- **Log is the source of truth.** If memory or chat contradicts the log, trust the log. Update the log before moving on from a pass.
- **Sim-first.** Build batch runner before touching UI. Tune with data, not feel.
- **Don't over-tune early.** Card balance is polish. Get the loop working first.
- **Carry from Flipside:** same phased process — headless → economy tuning → UI → polish.
