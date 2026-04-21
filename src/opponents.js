'use strict';

// Phase 3: fake opponents for the single-player run. No real card list —
// just a name + an opaque score calibrated to an expected greedy-AI curve
// ± uniform noise. Score curve will likely retune once passives (Phase 4),
// items (Phase 5) and augments (Phase 6) land.

const OPPONENT_NAMES = [
  'Stonefang', 'Red Witch', 'Ironhand', 'The Nameless',
  'Grimshaw', 'Vex the Gilded', 'Mordred', 'Silversmith',
  'Ashbringer', 'The Owl', 'Gravewalker', 'Kestrel',
];

// Expected greedy-AI score at round N. Retuned for Phase 6 (augments).
// Three augments (rounds 3/7/12) significantly boost mid-to-late scores.
// Curve scales ~1.1× at r10, ~1.2× at r15, ~1.3× at r20, ~1.5× at r30
// vs the Phase-5 baseline, targeting a 45–70% per-battle win rate. ±20% noise.
function expectedScoreAtRound(round) {
  if (round <= 1)  return 165;
  if (round <= 5)  return 165 + 80  * (round - 1);    // 165 → 485  (unchanged)
  if (round <= 10) return 485 + 230 * (round - 5);    // 485 → 1635 (×1.10 @ r10)
  if (round <= 15) return 1635 + 173 * (round - 10);  // 1635 → 2500 (×1.20 @ r15)
  if (round <= 20) return 2500 + 100 * (round - 15);  // 2500 → 3000 (×1.30 @ r20)
  return 3000 + 84 * (round - 20);                    // 3000 → 3840 @ r30 (×1.50)
}

function generateOpponent(round, rng) {
  const base  = expectedScoreAtRound(round);
  const noise = 1 + (rng() * 0.4 - 0.2); // ±20% uniform
  const score = Math.max(0, Math.round(base * noise));
  const name  = OPPONENT_NAMES[Math.floor(rng() * OPPONENT_NAMES.length)];
  return {
    name,
    calcScore() { return score; },
  };
}

module.exports = { generateOpponent, expectedScoreAtRound, OPPONENT_NAMES };
