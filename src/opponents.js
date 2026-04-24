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

// Expected score at round N. Retuned post-Playtest 3: mid/late curve raised ~40%
// to close the gap between skilled players and opponents. rankMult applies an
// additional multiplier per ranking tier (1.0 = Enthusiast, up to 2.1 = Luminary).
function expectedScoreAtRound(round, rankMult = 1.0) {
  let base;
  if (round <= 1)  base = 165;
  else if (round <= 5)  base = 165 + 80  * (round - 1);   // 165 → 485
  else if (round <= 10) base = 485 + 340 * (round - 5);   // 485 → 2185 (+34% vs pre-PT3)
  else if (round <= 15) base = 2185 + 260 * (round - 10); // 2185 → 3485 (+39%)
  else if (round <= 20) base = 3485 + 150 * (round - 15); // 3485 → 4235 (+41%)
  else                  base = 4235 + 130 * (round - 20); // 4235 → 5535 (+44%)
  return Math.round(base * rankMult);
}

function generateOpponent(round, rng, rankMult = 1.0) {
  const base  = expectedScoreAtRound(round, rankMult);
  const noise = 1 + (rng() * 0.4 - 0.2); // ±20% uniform
  const score = Math.max(0, Math.round(base * noise));
  const name  = OPPONENT_NAMES[Math.floor(rng() * OPPONENT_NAMES.length)];
  return {
    name,
    calcScore() { return score; },
  };
}

module.exports = { generateOpponent, expectedScoreAtRound, OPPONENT_NAMES };
