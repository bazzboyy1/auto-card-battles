'use strict';

// Phase 6 (2026-04-19) — Augments.
//
// Player picks 1-of-3 at rounds 3, 7, 12. Each augment persists for the rest
// of the run as a global modifier. Storage: run.augments = [] (array of ids),
// shared via reference with player.augments so Player methods can read them.
//
// On-pick augments (Shapeshifter, Overflow) mutate player state immediately;
// their presence in run.augments is metadata only.
//
// Apply points in the pipeline:
//   HeroicResolve  → Stage 0:  +25 base (before star mult), alongside Exhibition Stand
//   IronWill       → Stage 2:  ×2 Axis-2 flat; if Stimulant Pod also present, cap
//                              to one doubling (Iron Will wins, Stimulant Pod no-op)
//   TimeDilation   → Stage 1:  +5 × roundsSinceBought per card, alongside Axis-3
//   ExponentialGrowth → Stage 4b: +0.25 to Axis-4 mult (not Axis-6 or '6+4')
//   EarlyBird      → results:  for Axis-6/'6+4' passives, bypass Bloom Stimulant
//                              wrap and use round+3 (caps Bloom Stimulant's +2)
//   MidasTouch     → runBattle / sell: ×2 tickGold + sellBonus; shop rerollCost→1
//   HiveMind       → effectiveSpeciesCounts: bench cards included in count loop
//   Overflow       → on-pick: player.board.maxActive = min(10, maxActive+1)
//   Tycoon         → earnIncome: interest component ×2
//   Shapeshifter   → on-pick: card.shapeshifterSpecies set; read in board pipeline

const AUGMENT_DEFS = [
  {
    id: 'HeroicResolve', name: 'Prestige Display',
    description: 'All units +25 base score (before star mult, alongside Exhibition Stand)',
    axis: 1,
  },
  {
    id: 'IronWill', name: 'Conditioning Protocol',
    description: 'Conditional (Axis 2) passives doubled. Caps Stimulant Pod — one doubling total.',
    axis: 2,
  },
  {
    id: 'TimeDilation', name: 'Acclimatisation Program',
    description: 'All units gain +5 score per round since bought',
    axis: 3,
  },
  {
    id: 'ExponentialGrowth', name: 'Rapid Development',
    description: 'Multiplicative (Axis 4) passives add +0.25 to their multiplier',
    axis: 4,
  },
  {
    id: 'Shapeshifter', name: 'Species Reclassification',
    description: 'Pick one unit; it permanently gains a chosen species tag',
    axis: 5,
  },
  {
    id: 'EarlyBird', name: 'Early Bloomer',
    description: 'Round-timing (Axis 6) passives activate 3 rounds earlier. Caps Bloom Stimulant (+3 total, not +5).',
    axis: 6,
  },
  {
    id: 'MidasTouch', name: 'Market Savant',
    description: 'Meta-effect (Axis 7) passives doubled; reroll cost −1g',
    axis: 7,
  },
  {
    id: 'HiveMind', name: 'Collective Resonance',
    description: 'Bench units count toward synergy thresholds (bonuses still apply to active units only)',
    axis: '5/8',
  },
  {
    id: 'Overflow', name: 'Extended Enclosure',
    description: '+1 permanent board slot (cap becomes 10)',
    axis: 'structural',
  },
  {
    id: 'Tycoon', name: "Collector's Eye",
    description: 'Interest payout doubled',
    axis: 'economy',
  },
  {
    id: 'Varietal', name: 'Diverse Portfolio',
    description: '+8 flat score per unique species on your board, applied to every active card',
    axis: 'diversity',
  },
  {
    id: 'CrossTraining', name: 'Cross-Pollination',
    description: '+8% global score multiplier per active synergy bonus on your board',
    axis: 'diversity',
  },
];

function getAugment(id) {
  return AUGMENT_DEFS.find(a => a.id === id) || null;
}

// Safe helper: returns true if augments array contains the given id.
function hasAugment(augments, id) {
  return Array.isArray(augments) && augments.includes(id);
}

// Pick up to n items from arr at random without replacement using rng.
function pickN(arr, n, rng) {
  const pool = arr.slice();
  const result = [];
  while (result.length < n && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

module.exports = { AUGMENT_DEFS, getAugment, hasAugment, pickN };
