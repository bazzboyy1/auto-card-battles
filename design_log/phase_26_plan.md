# Phase 26 — Simulated Market Scarcity

## Status
**Specced 2026-04-30. Not yet started.**

---

## Context: v0.43 Playtesting Results

Eight Elite Circuit runs captured on v0.43 (confirmed via `diffMult` fields in runlogs — see telemetry note below).

| Run | Result | Rounds | Peak | Augments |
|-----|--------|--------|------|----------|
| 215603 | Died | 20 | 4988 | Overflow/deep_roots/Tycoon |
| 220237 | Died | 6 | 767 | Tycoon |
| runB (prev) | Survived | 24 | 7948 | Shapeshifter/deep_roots/CrossTraining |
| runC (prev) | Survived | 24 | 7200 | CrossTraining/ExponentialGrowth/MidasTouch |
| 211612 (prev) | Survived | 24 | 7200 | CrossTraining/ExponentialGrowth/MidasTouch |
| 215603 | Died | 20 | 4988 | Overflow/deep_roots/Tycoon |
| 220411 | Survived | 24 | 14881 | TimeDilation/HeroicResolve/Tycoon/CrossTraining |
| 221040 | Survived | 24 | 8820 | Tycoon/apex_showcase/deep_roots/Varietal |

**Graduated R19–R24 mults confirmed working.** R21 (×1.40) is the consistent pressure point — 138–234 margin across Elite runs. R24 (×1.50) produced a genuine failure in one run. The late-game comfort window is closing.

**Telemetry note:** v0.42 runs can be distinguished from v0.43 by `diffMult` in per-round `target` objects. v0.42 = flat 1.25 all rounds. v0.43 = 1.25 R1-R18, then 1.30/1.35/1.40/1.44/1.47/1.50 at R19-R24.

---

## Core Design Diagnosis

**The problem:** The game is a *score execution game* wearing the skin of a *strategy game*.

Once a player identifies a working build, the remaining decisions are execution: buy the pieces, hit the score, collect interest. The strategic layer (species, class, items, augments, economy) exists but isn't *contested*. There's no external disruption to the player's plan.

**Why autochess feels different:** In TFT/Dota Auto Chess, those same layers are present — but they're contested. Someone else might take the card you need. The shared pool means your plan can be disrupted from outside. Losing affects your HP bar every round, creating constant urgency. That "musical chairs" tension is doing enormous work.

Without it, this game has a solo puzzle with legible solutions. Once the solutions are known, the puzzle stops being interesting. The player's description of their own meta-knowledge confirms this:

- Abyssal: "obvious pick if 2 in opening shop"
- Sporal: focused on because of the multiplier
- Slurvin: "seems good most of the time"
- Chitinous/Crystalline: actively avoided
- Interest: "double interest is very good"
- The coasting loop: "I scored 1600 against 900 — I can play 3-4 rounds free and earn interest"

**What's missing isn't more content.** More augment types, more species, more items — none of that fills this void. The void is *scarcity and contest around card acquisition*. The player is never racing for anything.

---

## Proposed Mechanic: Simulated Market Scarcity

Add a competing demand signal to the shop without requiring real opponents.

### How it works

Each round, 1–2 cards in the shop are flagged as **also desired by a rival exhibitor**. If the player passes on them (doesn't buy), those cards are removed from their personal pool for the next 2 rounds (the rival bought them).

The rival's interest rotates — sometimes targeting the species the player is building, sometimes not. It's not perfectly adversarial (that would be frustrating), but it's unpredictable enough to create real buy-or-save decisions.

### What this accomplishes

1. **Breaks the coasting loop.** You can't freely hoard gold for 4 rounds if the cards you need might disappear. The buy-or-save decision becomes: "Is this card worth breaking my interest accumulation?"

2. **Creates shop phase tension.** Currently the shop is a private menu — you see 5 options, buy what you want, nobody competes. Now you're making active "do I grab this now?" decisions instead of always having time.

3. **Fixes the interest-coasting interaction.** Interest rewards holding gold, but when it also removes all decision pressure for 6 rounds at a stretch, it's doing too much work. The rival demand creates a competing incentive.

4. **Fits the theme.** You're at a specimen market. Other exhibitors are here too, buying from the same pool. The rival doesn't need a board or a score — it's just a simulated demand signal.

### Implementation notes

- Flag 1–2 cards at shop generation time with a `rivalClaimed: true` marker
- If a flagged card isn't bought by end of round, mark it unavailable in the player's draw pool for 2 rounds
- The rival's targeting heuristic: 40% chance to target a card matching the player's dominant species, 60% random. (Starting value — needs playtesting.)
- Clear the unavailability flag after 2 rounds automatically
- Show the rival interest visually on the shop card (e.g. a small "👁 Wanted" tag with tooltip: "Another exhibitor is interested — won't be available if you pass")

### What does NOT change

- Scoring system, lives, critique rounds — these are working
- Graduated R19–R24 Elite targets — confirmed correct
- Judge system, augments, items, economy rules
- The interest mechanic itself (it should remain rewarding — just not unconditionally free)

---

## Secondary Issues (Lower Priority)

### 1. Global multiplier card stacking (potential abuse)
Cards that give a flat % bonus to all cards of a species (e.g. "all other Sporals +15%") can be bought as multiple 1★ copies and stacked as passive aura sources. The card's star level becomes irrelevant — you're buying the aura at bulk discount, using a unit slot as an item slot. 

**Validation needed:** Check `src/cards.js` for cards with species-wide aura effects and whether stacking multiple 1★ copies compounds beyond intended values. May need a "one aura per card-name" rule or a per-card-name count cap on the bonus.

### 2. Dead species hypothesis (needs sim validation)
Player actively avoids Chitinous and Crystalline. Before treating these as dead paths, validate via sim:

- Add an `avoid-chitinous` policy to `src/sim.js` (greedy, but scores Chitinous cards as 0 preference)
- Add an `avoid-crystalline` policy similarly
- Compare survival rates vs. greedy baseline
- If ceiling is similar to greedy, it's a player bias / legibility problem (different fix)
- If ceiling is genuinely lower, it's a buff/niche problem

Note: Sim history shows Crystalline was buffed in Phase 22 (crystalline-stack 39.3%→41.7%). Chitinous has Morblax/Klothrix as locked cards. The player may just not have discovered the committed build.

### 3. Murborg's conditional passive
Player reports "passive pretty much never activates." The condition is probably too tight or the competing units in a Plasmic build (Slurvin, Blorpax) always outperform it. Check Murborg's passive condition — if it requires a specific board state that Plasmic builds never achieve while also being competitive, it's a dead card within its own species.

---

## Implementation Order

1. **Validate dead-species hypothesis** via sim (1–2 hours of work, gives data before any changes)
2. **Spec the rival demand targeting heuristic** — how intelligent should it be? Pure random is safe to start with
3. **Implement rival demand in `src/game.js`** — flag cards at shop generation, apply unavailability on skip
4. **Thread through `web/app.js`** — visual indicator on rival-claimed shop cards
5. **Playtest** — does the shop phase feel more contested? Does the coasting loop break?
6. **Tune the targeting rate** — 40/60 is a starting value; adjust based on feel

---

## Open Questions for Next Session

- How intelligent should the rival's targeting be? Matching player species (more targeted frustration) vs. random (fairer, less personal) vs. something the player can learn to predict?
- Should the rival interest be visible immediately when the shop refreshes, or revealed mid-round?
- Does the "2 rounds unavailable" window feel right, or should it be "gone permanently this run" (higher stakes) or "1 round" (lower stakes)?
- Is the right number of rival-flagged cards 1 or 2? 1 feels low-pressure; 2 might feel punishing in a 5-card shop.
