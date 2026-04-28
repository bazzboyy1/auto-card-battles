'use strict';

// Phase 23 — Unlock system.
//
// Achievements fire at run-end and gate new content (augments, items, judges).
// All existing content is always available from run 1; only new content is locked.
//
// Storage: localStorage key 'alien-exhibition-unlocks' → JSON array of reward IDs.
// In Node.js (sim/balance harness) localStorage is absent, so isUnlocked() always
// returns false — locked content is excluded from pools, giving a clean baseline.

const UNLOCKS_KEY = 'alien-exhibition-unlocks';

function _store() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

function getUnlocks() {
  const s = _store();
  if (!s) return [];
  try { return JSON.parse(s.getItem(UNLOCKS_KEY) || '[]'); } catch (e) { return []; }
}

function addUnlock(rewardId) {
  const s = _store();
  if (!s) return;
  const current = getUnlocks();
  if (!current.includes(rewardId)) {
    current.push(rewardId);
    s.setItem(UNLOCKS_KEY, JSON.stringify(current));
  }
}

function isUnlocked(rewardId) {
  return getUnlocks().includes(rewardId);
}

// Five achievements. check(run) is evaluated at run-end against run.stats
// and the final board state.
const ACHIEVEMENTS = [
  {
    id: 'emotional_range',
    name: 'Emotional Range',
    condition: '3+ class synergies active simultaneously during any round',
    reward: { id: 'vrethix', type: 'judge', name: 'Judge Vrethix' },
    check: (run) => run.stats.maxClassSynergiesActive >= 3,
  },
  {
    id: 'patient_collector',
    name: 'Patient Collector',
    condition: 'Reach Round 16 with 3+ specimens held for 10+ rounds uninterrupted',
    reward: { id: 'deep_roots', type: 'augment', name: 'Deep Roots' },
    check: (run) =>
      run.round >= 16 &&
      run.player.board.active.filter(c => (c.roundsSinceBought || 0) >= 10).length >= 3,
  },
  {
    id: 'star_collector',
    name: 'Star Collector',
    condition: '2+ 3★ specimens active simultaneously during any round',
    reward: { id: 'curators_eye', type: 'augment', name: "Curator's Eye" },
    check: (run) => run.stats.maxTripleStarsActive >= 2,
  },
  {
    id: 'crystal_formation',
    name: 'Crystal Formation',
    condition: 'Activate Crystalline-4 synergy and survive to Round 12',
    reward: { id: 'prestige_tag', type: 'item', name: 'Prestige Tag' },
    check: (run) => run.stats.maxCrystallineActive >= 4 && run.round >= 12,
  },
  {
    id: 'well_rounded',
    name: 'Well Rounded',
    condition: 'Have all 5 species represented on your active board simultaneously',
    reward: { id: 'collectors_mark', type: 'item', name: "Collector's Mark" },
    check: (run) => run.stats.allSpeciesRepresented,
  },

  // Phase 24 achievements — unlock new cards
  {
    id: 'abyssal_patience',
    name: 'Abyssal Patience',
    condition: 'Activate Abyssal-2 synergy and survive to Round 8',
    reward: { id: 'grazwick', type: 'card', name: 'Grazwick' },
    check: (run) => run.stats.maxAbyssalActive >= 2 && run.round >= 8,
  },
  {
    id: 'giddy_horde',
    name: 'Giddy Horde',
    condition: 'Have 4+ Giddy specimens active simultaneously during any round',
    reward: { id: 'morblax', type: 'card', name: 'Morblax' },
    check: (run) => run.stats.maxGiddyActive >= 4,
  },
  {
    id: 'dual_synergist',
    name: 'Dual Synergist',
    condition: 'Have both Crystalline-2 and Livid-2 synergies active simultaneously',
    reward: { id: 'zorbrath', type: 'card', name: 'Zorbrath' },
    check: (run) => run.stats.dualSynergyAchieved,
  },
  {
    id: 'void_commander',
    name: 'Void Commander',
    condition: 'Have 4+ Abyssal specimens active simultaneously during any round',
    reward: { id: 'vornix', type: 'card', name: 'Vornix' },
    check: (run) => run.stats.maxAbyssalActive >= 4,
  },
  {
    id: 'gold_rush',
    name: 'Gold Rush',
    condition: 'Hold 25+ gold at any point during a run',
    reward: { id: 'zephrix', type: 'card', name: 'Zephrix' },
    check: (run) => run.stats.peakGold >= 25,
  },
  {
    id: 'tier_collector',
    name: 'Tier Collector',
    condition: 'Have 3+ Tier 3 specimens active simultaneously during any round',
    reward: { id: 'prismora', type: 'card', name: 'Prismora' },
    check: (run) => run.stats.maxT3Active >= 3,
  },
  {
    id: 'deep_patience',
    name: 'Deep Patience',
    condition: 'Have 5+ specimens held for 10+ rounds simultaneously',
    reward: { id: 'klothrix', type: 'card', name: 'Klothrix' },
    check: (run) => run.stats.maxLongTermCards >= 5,
  },
  {
    id: 'grand_finale',
    name: 'Grand Finale',
    condition: 'Survive all 24 rounds with at least 1 Seal remaining',
    reward: { id: 'stellorb', type: 'card', name: 'Stellorb' },
    check: (run) => run.round >= 24 && run.lives >= 1,
  },
];

// Returns achievement objects whose condition is newly met (not already unlocked).
// Call after a run completes. Caller is responsible for persisting via addUnlock().
function evaluateAchievements(run) {
  const already = getUnlocks();
  return ACHIEVEMENTS.filter(a => {
    if (already.includes(a.reward.id)) return false;
    try { return a.check(run); } catch (e) { return false; }
  });
}

module.exports = { ACHIEVEMENTS, evaluateAchievements, getUnlocks, addUnlock, isUnlocked };
