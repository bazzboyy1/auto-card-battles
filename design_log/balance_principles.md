# Balance & Design Philosophy

**Written:** 2026-04-28  
**Status:** Living document — update when a decision forces a revision.

Read this before designing new cards, synergies, augments, items, or achievements. These principles were derived from our own balance history and game-design theory. Act on them consistently rather than re-deriving them each time.

---

## The core goal: meaningful choice, not numerical equality

Every build path should feel like a real option. Players should be choosing between paths that have different characters, not just picking the objectively correct one. This does not mean all paths must have equal survival rates — it means no path should feel pointless or unwinnable.

---

## The three balance models (and which one we use)

**Intransitive (rock-paper-scissors):** Build A counters B, B counters C, C counters A. No dominant strategy. Requires player-vs-player interaction to work — you adapt to what others are doing. *Not achievable in our single-player roguelike structure.*

**Viable diversity:** Every build has a reasonable floor and a meaningful ceiling. Spread between best and worst is narrow enough that execution matters more than path. *This is our target.*

**Meta hierarchy:** Some builds are strictly better; skilled players converge on them. Kills replayability fast. *What we are trying to avoid.*

---

## Numeric targets (Standard difficulty, greedy baseline ~55–57%)

| State | Survival target | Notes |
|---|---|---|
| Any viable build | ≥ 45% | Below this, players feel punished for a reasonable choice |
| Greedy (diverse) | ~55–57% | Calibration anchor |
| Focused stack (species or class) | ~60–67% | 5–10pp above greedy — rewarding but not dominant |
| Exploit ceiling | ≤ ~70% | Flagged at >8pp above greedy; investigated, not auto-nerfed |
| Forced-optimal exploit | ≤ ~75% | Only acceptable if it requires specific augment+item alignment |

These are survival-rate targets from the `node run.js balance` harness (n=300, seed=42).

---

## Dead-ends vs. commitment paths

**Dead-ends are bad.** A dead-end is a build that loses in expectation regardless of execution. It wastes design space and punishes players for experimenting. A build surviving at 37% when greedy is at 57% is a dead-end.

**Commitment paths are fine — and intentional.** A commitment path is a build that looks weak until its enabling conditions are met, at which point it pays off meaningfully. The distinction is legibility: the player must be able to see why the path works and how to unlock it.

The locked card system is the primary tool for this. A weak species or class on base cards is acceptable if locked content visibly completes the build (e.g. Crystalline at 41% becomes viable once Prismora/Zorbrath are unlocked — players can see both in the Collection modal).

---

## Species synergies

- Single-species stacks should be **viable but not dominant**. A dedicated Abyssal collector should beat a greedy generalist when everything goes right, but not in expectation across many runs.
- Species synergy thresholds are calibrated so that a 2+2+2 diverse board competes with a 6-of-one board. Mono-stack is not strictly optimal.
- Each species should have a distinct character expressed through its passive cards, not just different numbers on the same axis. (Abyssal = high-commitment mult; Sporal = aura engine; Crystalline = large-group flat scaling; etc.)

---

## Class synergies

Class values are deliberately calibrated at **~50% of species equivalents** because 3–4 class synergies activate simultaneously on most boards and compound. A board running 4 class synergies at once gets the sum of all four — if each were species-strength, the combined boost would be overwhelming.

- Individual class bonuses should feel modest in isolation.
- The payoff for stacking multiple class synergies is in the compounding, not any single bonus.
- Sullen's ×1.02/×1.05 is intentionally small — it's designed to be the "free" class synergy you pick up while building something else, not a build target on its own.

---

## New content and locked rewards

When designing a new card, augment, item, or judge, identify which underused build path it enables or amplifies. Content that strengthens already-strong paths without enabling weak ones tends to make balance worse, not better.

**Exploit sweep before shipping:** Any new locked content should be stress-tested with `node run.js exploit` (force-unlock + include in pool). Flag anything >8pp above greedy. Adjust or gate more tightly.

---

## Asymmetric balance — what's achievable here

Full asymmetric balance (every build is best-in-class at something different) requires different *dimensions of value*, not just different amounts of score. Our scoring system is one-dimensional, which limits this.

**What asymmetry we do have:**
- **Timeline:** Axis-3 scaling builds peak late; Axis-6 round-timing builds have specific activation windows; flat builds are consistent from the start.
- **Commitment:** Deep species stacks require holding cards and refusing to pivot. Greedy builds adapt. Different costs, same output.
- **Risk profile:** High-ceiling builds likely have higher variance floors. Greedy's consistency is a real advantage.

**What we're missing:** An economic axis that translates gold into a genuinely different *kind* of payoff (not just more score later). Axis-7 cards are currently the weakest axis because gold-to-score conversion is indirect and slow. If this ever gets addressed, economy becomes a third dimension and asymmetric balance becomes more achievable.

**Practical implication:** Design for viable diversity, not asymmetric balance. Don't try to make builds that are "best at different things" — try to make sure no build is clearly best at *the* thing (score) in all situations.
