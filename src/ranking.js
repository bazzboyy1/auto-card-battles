'use strict';

const TIERS = [
  { name: 'Enthusiast',  mult: 1.00 },
  { name: 'Collector',   mult: 1.20 },
  { name: 'Curator',     mult: 1.45 },
  { name: 'Connoisseur', mult: 1.75 },
  { name: 'Luminary',    mult: 2.10 },
];

const PLACEMENT_RUNS = 3;
const PROMOTE_AT     = 200;
const DEMOTE_LAND    = 100;
const STORAGE_KEY    = 'alien-exhibition-meta';

function tierIndex(name) {
  return TIERS.findIndex(t => t.name === name);
}

function calcRpChange(survived, finalRep) {
  if (!survived) return -40;
  return 30 + Math.round(finalRep * 0.7);
}

function assignPlacementRank(repHistory) {
  const avg = repHistory.reduce((a, b) => a + b, 0) / repHistory.length;
  if (avg >= 85) return 'Luminary';
  if (avg >= 70) return 'Connoisseur';
  if (avg >= 55) return 'Curator';
  if (avg >= 38) return 'Collector';
  return 'Enthusiast';
}

function defaultMeta() {
  return { v: 1, tier: null, rp: 0, placementDone: false, placementRuns: 0, repHistory: [], history: [] };
}

function loadMeta() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) return parsed;
    }
  } catch (_) {}
  return defaultMeta();
}

function saveMeta(meta) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch (_) {}
}

// Record a completed run. Mutates meta in-place and saves. Returns { rpChange, promoted, demoted, newTier }.
function recordRun(meta, survived, finalRep, record) {
  meta.history = [{ finalRep, survived, record, ts: Date.now() }, ...(meta.history || [])].slice(0, 50);

  let rpChange = 0, promoted = false, demoted = false;

  if (!meta.placementDone) {
    meta.placementRuns = (meta.placementRuns || 0) + 1;
    meta.repHistory    = [...(meta.repHistory || []), finalRep];
    if (meta.placementRuns >= PLACEMENT_RUNS) {
      meta.placementDone = true;
      meta.tier          = assignPlacementRank(meta.repHistory);
      meta.rp            = 0;
    }
  } else {
    rpChange = calcRpChange(survived, finalRep);
    meta.rp  = (meta.rp || 0) + rpChange;
    const idx = tierIndex(meta.tier);
    if (meta.rp >= PROMOTE_AT && idx < TIERS.length - 1) {
      meta.rp   = 0;
      meta.tier = TIERS[idx + 1].name;
      promoted  = true;
    } else if (meta.rp < 0 && idx > 0) {
      meta.rp   = DEMOTE_LAND;
      meta.tier = TIERS[idx - 1].name;
      demoted   = true;
    } else {
      if (meta.rp >= PROMOTE_AT) meta.rp = PROMOTE_AT - 1; // cap at top tier
      if (meta.rp < 0)           meta.rp = 0;              // floor at bottom tier
    }
  }

  saveMeta(meta);
  return { rpChange, promoted, demoted, newTier: meta.tier };
}

function getRankMult(meta) {
  if (!meta || !meta.placementDone || !meta.tier) return 1.0;
  const t = TIERS.find(t => t.name === meta.tier);
  return t ? t.mult : 1.0;
}

module.exports = { TIERS, PLACEMENT_RUNS, PROMOTE_AT, DEMOTE_LAND, loadMeta, saveMeta, recordRun, getRankMult, defaultMeta };
