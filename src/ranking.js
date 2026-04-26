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

module.exports = { calcRating, loadBest, saveBest, recordRun, STORAGE_KEY };
