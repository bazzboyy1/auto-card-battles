'use strict';

const STORAGE_KEY = 'alien-exhibition-best';

// Exhibition Rating = (last round completed × 100) + (lives remaining × 200) + (peak score / 10)
function calcRating({ round, livesRemaining, peakScore }) {
  return (round * 100) + (livesRemaining * 200) + Math.floor(peakScore / 10);
}

function loadBest() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.best === 'number') return parsed;
    }
  } catch (_) {}
  return { best: 0 };
}

function saveBest(data) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

// Record a completed run. Returns { rating, best, isNewBest }.
function recordRun(round, livesRemaining, peakScore) {
  const rating = calcRating({ round, livesRemaining, peakScore });
  const stored = loadBest();
  const isNewBest = rating > (stored.best || 0);
  if (isNewBest) {
    stored.best = rating;
    saveBest(stored);
  }
  return { rating, best: stored.best, isNewBest };
}

// ── Difficulty tiers ──────────────────────────────────────────────────────────

const TIERS = [
  { id: 'standard',   label: 'Standard',         mult: 1.0  },
  { id: 'discerning', label: 'Discerning Judges', mult: 1.25 },
  { id: 'elite',      label: 'Elite Circuit',     mult: 1.5  },
];
const TIER_KEY = 'alien-exhibition-tiers';

function loadTierState() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(TIER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.unlocked)) return parsed;
    }
  } catch (_) {}
  return { unlocked: ['standard'], active: 'standard' };
}

function saveTierState(state) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TIER_KEY, JSON.stringify(state));
  } catch (_) {}
}

function getActiveTier() {
  const state = loadTierState();
  return TIERS.find(t => t.id === state.active) || TIERS[0];
}

// Call when player completes round 24. Returns newly unlocked tier or null.
function tryUnlockNextTier(activeTierId) {
  const state = loadTierState();
  const idx   = TIERS.findIndex(t => t.id === activeTierId);
  const next  = TIERS[idx + 1];
  if (!next || state.unlocked.includes(next.id)) return null;
  state.unlocked.push(next.id);
  saveTierState(state);
  return next;
}

// Returns false if tierId is locked.
function setActiveTier(tierId) {
  const state = loadTierState();
  if (!state.unlocked.includes(tierId)) return false;
  state.active = tierId;
  saveTierState(state);
  return true;
}

module.exports = {
  calcRating, loadBest, saveBest, recordRun, STORAGE_KEY,
  TIERS, TIER_KEY, loadTierState, saveTierState, getActiveTier, tryUnlockNextTier, setActiveTier,
};
