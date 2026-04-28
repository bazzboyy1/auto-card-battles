'use strict';

// Cumulative cross-run achievement system (v0.38).
//
// Each achievement has a target: the number of PASSED rounds where its
// condition was active at judging. Counters persist across runs in localStorage.
// In Node.js (sim/balance harness) localStorage is absent — all writes are
// no-ops and locked content stays excluded from sim pools (isUnlocked → false).
//
// Storage:
//   'alien-exhibition-unlocks'  → JSON array of reward IDs
//   'alien-exhibition-counters' → JSON object { achievementId: count }

const UNLOCKS_KEY  = 'alien-exhibition-unlocks';
const COUNTERS_KEY = 'alien-exhibition-counters';

function _store() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

// ── Unlock persistence ────────────────────────────────────────────────────────

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

// ── Counter persistence ───────────────────────────────────────────────────────

function getCounters() {
  const s = _store();
  if (!s) return {};
  try { return JSON.parse(s.getItem(COUNTERS_KEY) || '{}'); } catch (e) { return {}; }
}

function getCounter(id) {
  return getCounters()[id] || 0;
}

function _setCounters(obj) {
  const s = _store();
  if (!s) return;
  s.setItem(COUNTERS_KEY, JSON.stringify(obj));
}

// ── Achievement definitions ───────────────────────────────────────────────────
//
// conditionMet(board, classCounts, speciesCounts, ctx) — evaluated at judging time
// on each PASSED round. board.active is the live scored board. classCounts and
// speciesCounts are pre-computed counts from effectiveClassCounts / active cards.
// ctx = { round, diffMult, activeClassSynergyCount } — supplied by game.js.
//
// target — number of qualifying passing rounds needed to unlock the reward.

const ACHIEVEMENTS = [
  // Species devotee — 15 passing rounds with species-2+ active
  {
    id: 'abyssal_devotee',
    name: 'Void Devotee',
    condition: 'Win 15 rounds with 2+ Abyssal specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (spc.Abyssal || 0) >= 2,
    reward: { id: 'vornix', type: 'card', name: 'Vornix' },
  },
  {
    id: 'sporal_devotee',
    name: 'Spore Devotee',
    condition: 'Win 15 rounds with 2+ Sporal specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (spc.Sporal || 0) >= 2,
    reward: { id: 'zephrix', type: 'card', name: 'Zephrix' },
  },
  {
    id: 'chitinous_devotee',
    name: 'Chitin Devotee',
    condition: 'Win 15 rounds with 2+ Chitinous specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (spc.Chitinous || 0) >= 2,
    reward: { id: 'morblax', type: 'card', name: 'Morblax' },
  },
  {
    id: 'crystalline_devotee',
    name: 'Crystal Devotee',
    condition: 'Win 15 rounds with 2+ Crystalline specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (spc.Crystalline || 0) >= 2,
    reward: { id: 'zorbrath', type: 'card', name: 'Zorbrath' },
  },
  {
    id: 'plasmic_devotee',
    name: 'Plasma Devotee',
    condition: 'Win 15 rounds with 2+ Plasmic specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (spc.Plasmic || 0) >= 2,
    reward: { id: 'prestige_tag', type: 'item', name: 'Prestige Tag' },
  },

  // Species master — 25 passing rounds with higher threshold
  {
    id: 'abyssal_master',
    name: 'Void Master',
    condition: 'Win 25 rounds with 4+ Abyssal specimens active',
    target: 25,
    conditionMet: (board, cls, spc) => (spc.Abyssal || 0) >= 4,
    reward: { id: 'stellorb', type: 'card', name: 'Stellorb' },
  },
  {
    id: 'crystalline_master',
    name: 'Crystal Master',
    condition: 'Win 25 rounds with 4+ Crystalline specimens active',
    target: 25,
    conditionMet: (board, cls, spc) => (spc.Crystalline || 0) >= 4,
    reward: { id: 'prismora', type: 'card', name: 'Prismora' },
  },
  {
    id: 'sporal_master',
    name: 'Spore Master',
    condition: 'Win 25 rounds with 4+ Sporal specimens active',
    target: 25,
    conditionMet: (board, cls, spc) => (spc.Sporal || 0) >= 4,
    reward: { id: 'curators_eye', type: 'augment', name: "Curator's Eye" },
  },
  {
    id: 'chitinous_master',
    name: 'Chitin Master',
    condition: 'Win 25 rounds with 3+ Chitinous specimens active',
    target: 25,
    conditionMet: (board, cls, spc) => (spc.Chitinous || 0) >= 3,
    reward: { id: 'collectors_mark', type: 'item', name: "Collector's Mark" },
  },

  // Class devotee — 15 passing rounds with class-2+ active
  {
    id: 'livid_devotee',
    name: 'Livid Devotee',
    condition: 'Win 15 rounds with 2+ Livid specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (cls.Livid || 0) >= 2,
    reward: { id: 'grazwick', type: 'card', name: 'Grazwick' },
  },
  {
    id: 'giddy_devotee',
    name: 'Giddy Devotee',
    condition: 'Win 15 rounds with 2+ Giddy specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (cls.Giddy || 0) >= 2,
    reward: { id: 'deep_roots', type: 'augment', name: 'Deep Roots' },
  },
  {
    id: 'shy_devotee',
    name: 'Shy Devotee',
    condition: 'Win 15 rounds with 2+ Shy specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (cls.Shy || 0) >= 2,
    reward: { id: 'klothrix', type: 'card', name: 'Klothrix' },
  },
  {
    id: 'sullen_devotee',
    name: 'Sullen Devotee',
    condition: 'Win 15 rounds with 2+ Sullen specimens active',
    target: 15,
    conditionMet: (board, cls, spc) => (cls.Sullen || 0) >= 2,
    reward: { id: 'vrethix', type: 'judge', name: 'Appraiser Vrethix' },
  },

  // Phase 25 additions —————————————————————————————————————————————————————

  // Species master (1 missing)
  {
    id: 'plasmic_master',
    name: 'Plasma Master',
    condition: 'Win 25 rounds with 4+ Plasmic specimens active',
    target: 25,
    conditionMet: (board, cls, spc) => (spc.Plasmic || 0) >= 4,
    reward: { id: 'vorbex', type: 'card', name: 'Vorbex' },
  },

  // Class devotee (1 missing)
  {
    id: 'pompous_devotee',
    name: 'Pompous Devotee',
    condition: 'Win 15 rounds with 2+ Pompous specimens active',
    target: 15,
    conditionMet: (board, cls) => (cls.Pompous || 0) >= 2,
    reward: { id: 'grand_specimen', type: 'augment', name: 'Grand Specimen Program' },
  },

  // Archetype achievements
  {
    id: 'emotional_virtuoso',
    name: 'Emotional Virtuoso',
    condition: 'Win 25 rounds with 3+ class synergies simultaneously active',
    target: 25,
    conditionMet: (board, cls, spc, ctx) => (ctx.activeClassSynergyCount || 0) >= 3,
    reward: { id: 'class_harmony', type: 'augment', name: 'Class Harmony' },
  },
  {
    id: 'patient_master',
    name: 'Patient Master',
    condition: 'Win 25 rounds with 4+ cards held 10+ rounds',
    target: 25,
    conditionMet: (board) => board.active.filter(c => (c.roundsSinceBought || 0) >= 10).length >= 4,
    reward: { id: 'veterans_plinth', type: 'item', name: "Veteran's Plinth" },
  },
  {
    id: 'star_curator',
    name: 'Star Curator',
    condition: 'Win 25 rounds with 3+ active 3★ specimens',
    target: 25,
    conditionMet: (board) => board.active.filter(c => c.stars === 3).length >= 3,
    reward: { id: 'apex_showcase', type: 'augment', name: 'Apex Showcase' },
  },
  {
    id: 'late_game_collector',
    name: 'Late Game Collector',
    condition: 'Win 20 Chapter 3 rounds (rounds 17–24)',
    target: 20,
    conditionMet: (board, cls, spc, ctx) => (ctx.round || 0) >= 17,
    reward: { id: 'sormax', type: 'judge', name: 'Appraiser Sormax' },
  },

  // Difficulty achievements
  {
    id: 'discerning_graduate',
    name: 'Discerning Graduate',
    condition: 'Win 15 rounds on Discerning difficulty or harder',
    target: 15,
    conditionMet: (board, cls, spc, ctx) => (ctx.diffMult || 1) >= 1.12,
    reward: { id: 'prestige_circuit', type: 'item', name: 'Prestige Circuit' },
  },
  {
    id: 'elite_curator',
    name: 'Elite Curator',
    condition: 'Win 10 rounds on Elite difficulty',
    target: 10,
    conditionMet: (board, cls, spc, ctx) => (ctx.diffMult || 1) >= 1.25,
    reward: { id: 'mastery_protocol', type: 'augment', name: 'Mastery Protocol' },
  },
  {
    id: 'grand_survivor',
    name: 'Grand Survivor',
    condition: 'Win 5 Grand Finale rounds (Round 24)',
    target: 5,
    conditionMet: (board, cls, spc, ctx) => (ctx.round || 0) === 24,
    reward: { id: 'omnorb', type: 'card', name: 'Omnorb' },
  },
];

// Increment achievement counters for one round.
// Called from runBattle() after each round resolves. Only increments on passed rounds.
// Returns array of achievement objects newly unlocked by this call.
// In Node.js (no localStorage), always returns [] — no side effects.
function incrementAchievementCounters(board, classCounts, passed, ctx = {}) {
  if (!passed) return [];
  const s = _store();
  if (!s) return [];

  // Build species counts from active board
  const speciesCounts = {};
  for (const c of board.active) {
    speciesCounts[c.species] = (speciesCounts[c.species] || 0) + 1;
  }

  const counters        = getCounters();
  const alreadyUnlocked = getUnlocks();
  const newlyUnlocked   = [];

  for (const ach of ACHIEVEMENTS) {
    if (alreadyUnlocked.includes(ach.reward.id)) continue;
    if (!ach.conditionMet(board, classCounts, speciesCounts, ctx)) continue;
    counters[ach.id] = (counters[ach.id] || 0) + 1;
    if (counters[ach.id] >= ach.target) {
      newlyUnlocked.push(ach);
      alreadyUnlocked.push(ach.reward.id); // prevent double-fire within same call
    }
  }

  _setCounters(counters);
  for (const ach of newlyUnlocked) addUnlock(ach.reward.id);
  return newlyUnlocked;
}

module.exports = { ACHIEVEMENTS, getUnlocks, addUnlock, isUnlocked, getCounter, incrementAchievementCounters };
