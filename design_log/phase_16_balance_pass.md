# Phase 16 — Balance Pass (Sim-Driven)

**Date:** 2026-04-24
**Context:** User-reported imbalance concerns: Abyssal too strong, Chitinous too weak, Blinxorp + Growth Serum scales to 10k+ dominating end-game. Built a Monte Carlo balance harness to measure instead of guess. This phase executes the recommended changes.

**Prerequisites:** Read memory — especially `project_balance_principles.md` (asymmetric balance, ease-of-access matters, species/class/unit axes).

---

## What the sim harness is

Headless Monte Carlo at `src/balance.js`, invoked via:

```bash
node run.js balance 500 1    # n=500 seeds per policy, seedStart=1
```

Runs 14 policies (species / class / mixed / targeted max builds) through 30-round runs and reports:
- **peak.p90 / p50 / max** — score ceilings, robust and median
- **survivalRate** — proxy for build consistency
- **winRate** — proxy for dominance

Targeted builds (`blinxorp-max`, `fluxnob-max`, `squorble-max`, `scrithnab-max`) use forced `--grant` (item attached to specific card) + `--pick` (forced augment) to stress-test dominant-build hypotheses.

Full results snapshot preserved at the bottom of this file for reference. Re-run after each change to verify.

---

## Findings (from n=500 sweep, 2026-04-24)

| # | Finding | Evidence | Kind |
|---|---------|----------|------|
| B1 | **Blinxorp + Growth Serum + Acclimatisation Program is a runaway dominant build.** | `blinxorp-max` p50=7372 (2× any other policy), survival 59%, winrate 76%. Peak 23623. | Balance — critical |
| B2 | **Scrithnab's +300 cap works correctly** — same item/augment config tops out at p50=2856. Blinxorp's uncapped design is the outlier, not the norm. | `scrithnab-max` p50=2856 vs `blinxorp-max` p50=7372. | Design pattern |
| B3 | **Abyssal species is dominant** regardless of unit choice. | `abyssal-stack` p50=3635, survival 31.4%, winrate 64.2% — highest of all unforced policies. | Balance — high |
| B4 | **Livid class ≈ Abyssal species** because Blinxorp + Vorzak are both Livid. | `livid-stack` p50=3563, survival 29.2%, winrate 65.3% — within 2% of abyssal-stack on every metric. | Balance — medium |
| B5 | **Plasmic is the weakest species commit**, not Chitinous. User's "Fluxnob-spam dominant" intuition is refuted by data. | `plasmic-stack` p90=4683, survival 6.6% (worse than crystalline-stack on survival). `fluxnob-max` p50=3403 — middling. | Balance — medium (buff) |
| B6 | **Giddy is the weakest class.** | `giddy-stack` p90=4998, p50=2252, survival 8.2%. Weakest class synergy (+14 flat at 3). | Balance — low (buff) |
| B7 | Chitinous is middling, not weakest. Crystalline is weaker at ceiling but has a 6-threshold floor via Geodorb. | `chitinous-stack` p90=7201 vs `crystalline-stack` p90=5824 vs `plasmic-stack` p90=4683. | No change — leave as-is. |

---

## Proposed changes (priority-ordered)

Each change lists: **target file + lines**, **current value**, **proposed value**, **expected effect**, **regression risk**.

### C1 — Cap Blinxorp (Critical)

**File:** `src/cards.js:191` (Blinxorp passive eval)

**Current:**
```javascript
eval(card) { return { flat: 25 * (card.roundsSinceBought || 0) }; }
```

**Proposed:**
```javascript
eval(card) { return { flat: Math.min(500, 25 * (card.roundsSinceBought || 0)) }; }
```

Also update description at line 189: `'+25 per round since bought (max +500)'` — mirrors Scrithnab's pattern.

**Rationale:** Scrithnab caps at +300 after 20 rounds (+15/round × 20). Blinxorp matches with +500 after 20 rounds (+25/round × 20). Beyond round 20 the flat bonus no longer grows, matching the design pattern we already have.

**Expected effect:** `blinxorp-max` p50 drops from 7372 toward 4000–5000. Survival likely drops from 59% to ~35%. Still a strong build — just not runaway.

**Regression risk:** Low. Doesn't affect other units. Doesn't nerf Scrithnab (already capped).

---

### C2 — Fix Growth Serum compounding (Critical)

**File:** `src/items.js` — look for the Axis-3 wrapper (`rewrapPassive` around line 82–94 per the architecture map; verify before editing)

**Current behavior:** Growth Serum (`Recurve Bow`) wraps the card's Axis-3 `eval` with a ×2 modifier. This also doubles the **Acclimatisation Program** augment's +5/round contribution when computed through the same card (if the pipeline adds them together before the wrap applies).

**Investigation step (do first):** Trace exactly how Growth Serum interacts with the augment's global +5/round flat. Read `src/board.js` stage 1 (lines 176+) to confirm whether the augment's flat is applied **per card through the card's eval**, or **as a separate pipeline addition**. Fix scope depends on which.

**Hypothesis A** (pipeline addition is separate): No fix needed at item level; compounding is just ×2 applied to native eval only, and the augment adds flat after. Then the issue is just Blinxorp's uncapped scaling (C1 alone may suffice).

**Hypothesis B** (pipeline addition flows through eval): Growth Serum doubles both native + augment per-round flat. Fix by making the wrapper double only the card-definition's native output, not augment contributions.

**Proposed fix (if Hypothesis B):** Cap Growth Serum's contribution to the card's native Axis-3 only. Move the augment's +5/round flat to a separate pipeline stage that isn't subject to item multipliers.

**Expected effect:** `blinxorp-max` p50 drops further (synergistic with C1). Should bring `blinxorp-max` in line with `abyssal-stack` + 20–30% ceiling bonus, which is the correct reward for the focused build.

**Regression risk:** Medium. Touches item/augment interaction. Verify with `node run.js play <seed> abyssal-stack --grant "Blinxorp:Recurve Bow" --pick "3:TimeDilation"` before and after.

---

### C3 — Abyssal synergy: trim the 2-card bonus

**File:** `src/cards.js:283–290` (SYNERGIES.Abyssal)

**Current:**
```javascript
Abyssal: {
  thresholds: [2, 4],
  getBonus(count) {
    if (count >= 4) return { target: 'species', type: 'mult', value: 1.90 };
    if (count >= 2) return { target: 'species', type: 'mult', value: 1.60 };
    return null;
  },
},
```

**Proposed:**
```javascript
Abyssal: {
  thresholds: [2, 4],
  getBonus(count) {
    if (count >= 4) return { target: 'species', type: 'mult', value: 1.90 };
    if (count >= 2) return { target: 'species', type: 'mult', value: 1.40 };
    return null;
  },
},
```

**Rationale:** ×1.60 at just 2 Abyssal cards makes "always include 2 Abyssals" reflexively correct. ×1.40 makes the 2-card version still worthwhile but not reflexive; ×1.90 at full commit keeps the ceiling.

**Expected effect:** `abyssal-stack` survival drops from 31.4% toward ~20–25%. p50 drops ~300. Keeps peak similar because peak runs are 4-Abyssal.

**Regression risk:** Low. Doesn't affect non-Abyssal. Commit-build still strong.

---

### C4 — Livid class: trim the 4-card bonus

**File:** `src/cards.js:308–315` (CLASS_SYNERGIES.Livid)

**Current:**
```javascript
Livid: {
  thresholds: [2, 4],
  getBonus(count) {
    if (count >= 4) return { target: 'class', type: 'mult', value: 1.28 };
    if (count >= 2) return { target: 'class', type: 'mult', value: 1.12 };
    return null;
  },
},
```

**Proposed:**
```javascript
Livid: {
  thresholds: [2, 4],
  getBonus(count) {
    if (count >= 4) return { target: 'class', type: 'mult', value: 1.20 };
    if (count >= 2) return { target: 'class', type: 'mult', value: 1.10 };
    return null;
  },
},
```

**Rationale:** Livid is the hidden twin of Abyssal because Blinxorp + Vorzak are both Livid. Trim to match Pompous (×1.30 at 4) being slightly stronger than Livid. Also gentle 2-threshold trim.

**Expected effect:** `livid-stack` p50 drops ~150–200. `abyssal-stack` also slightly softer (Vorzak/Blinxorp lose some class bonus).

**Regression risk:** Low. Class synergy is ~50% the weight of species anyway.

---

### C5 — Plasmic buff (species floor raise)

**File:** `src/cards.js:249–257` (SYNERGIES.Plasmic) OR `src/cards.js:202` (Fluxnob aura)

**Option A — synergy buff:**
```javascript
Plasmic: {
  thresholds: [2, 4],
  getBonus(count) {
    if (count >= 4) return { target: 'species', type: 'flat', value: 58 };  // was 48
    if (count >= 2) return { target: 'species', type: 'flat', value: 32 };  // was 26
    return null;
  },
},
```

**Option B — Fluxnob aura buff:** change line 202 from `auraMult: 1.20` to `auraMult: 1.30`, and update description line 200.

**Recommended:** Try Option A first (affects all Plasmic builds, not just Fluxnob-centered ones). Measure; if plasmic-stack p90 rises to ~6000 without pushing past sporal/chitinous, stop. Else add Option B.

**Rationale:** `plasmic-stack` is currently the weakest species on every metric. 5 Plasmic cards means the 4-threshold synergy is actually achievable, so the flat buff lands frequently.

**Expected effect:** `plasmic-stack` p90 rises from 4683 → ~5800–6200, survival from 6.6% → ~12–15%.

**Regression risk:** Low–medium. Could push Plasmic past middling; re-measure to confirm it's not the new dominant.

---

### C6 — Giddy buff (class floor raise)

**File:** `src/cards.js:316–323` (CLASS_SYNERGIES.Giddy)

**Current:**
```javascript
Giddy: {
  thresholds: [2, 3],
  getBonus(count) {
    if (count >= 3) return { target: 'class', type: 'flat', value: 14 };
    if (count >= 2) return { target: 'class', type: 'flat', value: 6 };
    return null;
  },
},
```

**Proposed:**
```javascript
Giddy: {
  thresholds: [2, 3],
  getBonus(count) {
    if (count >= 3) return { target: 'class', type: 'flat', value: 22 };  // was 14
    if (count >= 2) return { target: 'class', type: 'flat', value: 10 };  // was 6
    return null;
  },
},
```

**Rationale:** Giddy is the weakest class by every metric. Current values are lowest of any class; bumping matches Shy's curve (+8/+16).

**Expected effect:** `giddy-stack` p90 rises ~500–1000.

**Regression risk:** Low. Class synergies are small; Giddy is currently barely relevant.

---

## Task breakdown

| # | Task | Files | Effort | Sim verify |
|---|------|-------|--------|------------|
| T1 | Baseline run: `node run.js balance 500 1` — snapshot current state as regression baseline | n/a | None | — |
| T2 | C1: Blinxorp cap | `src/cards.js` | Trivial | Re-run; `blinxorp-max` p50 should drop toward 4000–5000 |
| T3 | C2: Investigate Growth Serum × augment compounding; fix if Hypothesis B | `src/items.js`, `src/board.js` | Low–Med | Re-run `blinxorp-max`; should drop further |
| T4 | C3: Abyssal synergy trim | `src/cards.js` | Trivial | Re-run; `abyssal-stack` survival → ~20–25% |
| T5 | C4: Livid class trim | `src/cards.js` | Trivial | Re-run; `livid-stack` p50 → ~3400 |
| T6 | C5: Plasmic synergy buff | `src/cards.js` | Trivial | Re-run; `plasmic-stack` p90 → ~6000 |
| T7 | C6: Giddy class buff | `src/cards.js` | Trivial | Re-run; `giddy-stack` p90 → ~5500 |
| T8 | Bump version in `index.html` (per `feedback_version_bump.md` memory) | `index.html` | Trivial | — |
| T9 | Manual playtest: play a browser run, confirm no unit is egregiously strong/weak. Play Blinxorp build specifically. | `index.html` via preview_* tools | Med | See "Manual verification" below |
| T10 | Commit: `Phase 16: Sim-driven balance pass (v0.18)` | — | Trivial | — |

**Dependency order:** T1 → T2–T7 can be done in any order but verify after each. T8 before commit. T9 is optional but recommended.

---

## Regression guardrails

After each change (T2–T7), re-run `node run.js balance 500 1`. Acceptance criteria:

1. **No policy survival > 40%** (prior dominance cap).
2. **No policy p50 > 4500** without a targeted build triggering it (a species policy reaching 4500+ p50 means a dominant path exists).
3. **Every species-stack policy p90 ≥ 5500** (no dead paths — every species should have some ceiling).
4. **blinxorp-max p50 ≤ 5000** after C1+C2 land.

If any check fails, note which and stop to debate before continuing. Prefer revert-and-retune over piling on more changes.

---

## Manual verification (T9)

Use `preview_start` to launch the dev server and play through one 30-round run as follows:

1. **Commit to Abyssal.** Buy every Blinxorp/Vorzak/Squorble shown. Try to hit 3-star Blinxorp by R20.
2. If offered Growth Serum at R5/R10, attach to Blinxorp.
3. If offered Acclimatisation Program (`TimeDilation`) at R3/R7/R12, pick it.
4. At R30, note final Blinxorp score and total. Should feel strong but not trivially winning.

Expected: Total around 5000–8000 with a focused Blinxorp build, which is still the strongest commit but no longer auto-wins.

---

## Open questions for the user

1. **C5 choice:** Option A (synergy buff) or Option B (Fluxnob aura buff) or both? Default: A first, measure, maybe B after.
2. **C2 depth:** If Hypothesis A (no item/augment compounding), skip C2. If Hypothesis B, how aggressive to separate augment flats from item multipliers?
3. **Should we also add a cap to the Acclimatisation Program augment** (e.g., +5/round per card, max 20 rounds)? Same compounding fix but at the augment level. **Defer for now** — C1+C2 likely sufficient.
4. **Ranking meta impact:** Opponent curve at Luminary tier (2.1×) may be affected by these changes. After all changes land, re-verify that higher-rank players still get appropriately scaled challenge. **Defer to a separate Phase 16.1.**

---

## Reference — n=500 sweep snapshot (2026-04-24, pre-changes)

```
── Policies (no forced grants/picks) ──
Policy                 n    peak.max  peak.p90  peak.p50  final.p50  surv%   win%
----------------------------------------------------------------------------------
greedy                 500     14223      7549      2969       2956   18.4   55.3
random                 500      9074      4215      2173       2172    6.6   37.2
wide                   500     14223      7364      2975       2963   19.6   53.8
plasmic-stack          500     11671      4683      2524       2495    6.6   47.4
sporal-stack           500     14154      7353      3070       3070   18.2   56.4
chitinous-stack        500     11828      7201      2587       2587   14.6   50.3
crystalline-stack      500     13979      5824      2407       2363    9.8   44.1
abyssal-stack          500     14669      8686      3635       3585   31.4   64.2
shy-stack              500     14154      6294      2403       2371   10.2   47.3
livid-stack            500     14223      8567      3563       3549   29.2   65.3
giddy-stack            500     13282      4998      2252       2226    8.2   44.4
sullen-stack           500     11788      6835      2807       2806   13.8   51.0
pompous-stack          500     14047      7565      3005       3005   20.6   56.7
abyssal-sporal         500     14859      8440      3743       3738   33.4   65.4

── Targeted builds (forced grants + augment picks) ──
Policy                 n    peak.max  peak.p90  peak.p50  final.p50  surv%   win%
----------------------------------------------------------------------------------
blinxorp-max           500     23623     11236      7372       7372   59.2   76.0
fluxnob-max            500     15236      7591      3403       3326   22.0   61.4
squorble-max           500     16617      9001      3453       3346   34.6   63.9
scrithnab-max          500     17357      8047      2856       2854   22.4   54.6
```

---

## Infrastructure added this phase (uncommitted, in working tree)

Not part of Phase 16 execution — already built, awaiting commit:

- `src/balance.js` (new) — Monte Carlo harness: `analysePolicy`, `sweep`, `sweepBuilds`, `BUILDS` list, `formatSweep`.
- `src/sim.js` (modified) — 5 species policies (plasmic/sporal/chitinous/crystalline/abyssal-stack), 5 class policies (shy/livid/giddy/sullen/pompous-stack), 1 mix policy (abyssal-sporal), `class` and `mixSpecies` bias support in `scoreBuyCandidate`. Legacy `warrior-stack` and `demon-arc` policies removed (theme violation).
- `run.js` (modified) — `balance` command.

**Suggested T0:** commit this infrastructure separately before starting T1, so any balance-change regressions can be diffed against a clean baseline. Commit message: `Phase 16 prep: sim-driven balance harness + species/class policies`.

---

## Fresh-conversation kickoff

Recommended opening message for a fresh Claude session:

> Execute Phase 16 balance pass from `design_log/phase_16_balance_pass.md`. Start with T1 (baseline sim run) to confirm the numbers still match, then proceed through T2–T10. Ask me about C5 choice and C2 depth before implementing those. Use the regression guardrails after each change.

`/resume` in a fresh session will auto-load this file through the design log.
