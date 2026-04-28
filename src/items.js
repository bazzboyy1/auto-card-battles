'use strict';

const { isUnlocked } = require('./achievements');

// Phase 5 (2026-04-19) — Items.
//
// 10 items attachable to units; each unit has 3 slots. Permanent per run.
// No acquisition UX; debug-grant only (CLI --grant flag; ?dev=1 web panel).
//
// Two application modes:
//   - Pre-processor items ('3-mod' / '2-mod' / '6-mod'): wrap the card's
//     `passive.eval` at attach time. Original is stashed on the card via
//     `_originalPassive`; on attach/detach we rebuild the wrapped passive
//     from the original, so detach order does not matter.
//   - Direct items (axis 1 / 3 / 4 / 5 / 7 / 8): folded into the pipeline
//     stages in board.js (Claymore, Guinsoo's, Giant's Belt, Emblem, Zeke's
//     Herald). Hextech Gunblade is consumed by Run.runBattle() post-battle.
//     Spear of Shojin is resolved in effectiveSpeciesCounts().

const SPECIES  = ['Plasmic', 'Sporal', 'Chitinous', 'Crystalline', 'Abyssal'];
const CLASSES  = ['Shy', 'Livid', 'Giddy', 'Sullen', 'Pompous'];

const ITEM_DEFS = [
  { id: 'Claymore',            name: 'Exhibition Stand',     description: 'Unit base score +40',                                   axis: 1   },
  { id: 'Recurve Bow',         name: 'Growth Serum',         description: "Unit's scaling-per-round is doubled",                   axis: '3-mod' },
  { id: "Giant's Belt",        name: 'Rarity Certificate',   description: '×2 at 1★, ×1.5 at 2★, ×1.2 at 3★',                      axis: 4   },
  { id: "Warmog's Armor",      name: 'Stimulant Pod',        description: "Unit's conditional passive bonuses are doubled",       axis: '2-mod' },
  { id: "Zeke's Herald",       name: 'Pheromone Diffuser',   description: '+15% score to all other units on board',               axis: 8   },
  { id: 'Hextech Gunblade',    name: 'Market Tag',           description: '+2g per round while fielded',                           axis: 7   },
  { id: 'Last Whisper',        name: 'Bloom Stimulant',      description: "Unit's round-timing passive activates 2 rounds earlier", axis: '6-mod' },
  { id: "Guinsoo's Rageblade", name: 'Acclimatisation Log',  description: '+20 score per round this unit has been on board',       axis: 3   },
  { id: 'Spear of Shojin',     name: 'Camouflage Gland',     description: 'Each round, counts as a random species you have ≥2 of', axis: 5   },
  { id: 'prestige_tag',    name: 'Prestige Tag',      description: '+12 flat per active class synergy on equipped specimen',     axis: 1, locked: true },
  { id: 'collectors_mark', name: "Collector's Mark", description: '+8 flat per combined (2★ or 3★) specimen active on board',   axis: 1, locked: true },
  // Phase 25 locked items
  { id: 'veterans_plinth', name: "Veteran's Plinth",  description: '×1.3 score if this specimen has been held 15+ rounds',       axis: 4, locked: true },
  { id: 'prestige_circuit', name: 'Prestige Circuit', description: '×1.2 score (no condition required)',                         axis: 4, locked: true },
  // Species taxonomy badges — one per species.
  ...SPECIES.map(sp => ({
    id: `Emblem of ${sp}`, name: `Taxonomy Badge: ${sp}`,
    description: `Unit counts as +1 ${sp} for synergy`,
    axis: 5, species: sp,
  })),
  // Class mood tags — one per class.
  ...CLASSES.map(cl => ({
    id: `Crest of ${cl}`, name: `Mood Tag: ${cl}`,
    description: `Unit counts as +1 ${cl} for class synergy`,
    axis: '5-class', class: cl,
  })),
];

// Returns all items available in the current session (locked items excluded
// until their reward id is persisted via addUnlock). In Node.js the filter
// always excludes locked entries, keeping sim pools clean.
function getAvailableItems() {
  return ITEM_DEFS.filter(it => !it.locked || isUnlocked(it.id));
}

function getItem(id) {
  return ITEM_DEFS.find(it => it.id === id) || null;
}

// Giant's Belt per-star multiplier.
function giantsBeltMult(stars) {
  if (stars >= 3) return 1.2;
  if (stars >= 2) return 1.5;
  return 2.0;
}

// Multiplex pre-processor wrappers. `origPassive` is the un-wrapped passive.
function wrapPassive(origPassive, item) {
  if (!origPassive || typeof origPassive.eval !== 'function') return origPassive;
  const innerEval = origPassive.eval;
  const origAxis  = origPassive.axis;
  return {
    description: origPassive.description,
    axis: origAxis,
    eval(card, ctx) {
      let adjustedCtx = ctx;
      if (item.axis === '6-mod') {
        // Last Whisper — round-timing activates 2 rounds earlier.
        adjustedCtx = { ...ctx, round: (ctx.round || 0) + 2 };
      }
      const r = innerEval(card, adjustedCtx) || {};
      if (item.axis === '3-mod' && origAxis === 3 && typeof r.flat === 'number') {
        return { ...r, flat: r.flat * 2 };
      }
      if (item.axis === '2-mod' && origAxis === 2 && typeof r.flat === 'number') {
        return { ...r, flat: r.flat * 2 };
      }
      return r;
    },
  };
}

function rewrapPassive(card) {
  if (!card._originalPassive) return;
  let p = card._originalPassive;
  const entries = (card.items || []);
  for (const entry of entries) {
    const it = getItem(entry.id);
    if (!it) continue;
    if (it.axis === '3-mod' || it.axis === '2-mod' || it.axis === '6-mod') {
      p = wrapPassive(p, it);
    }
  }
  card.passive = p;
}

function attachItem(card, itemId) {
  if (!card) return false;
  const item = getItem(itemId);
  if (!item) return false;
  if (!card.items) card.items = [];
  if (card.items.length >= 3) return false;
  // Stash original the first time any item is attached — pre-processor
  // wrappers always rebuild from the original, so detach order is safe.
  if (card._originalPassive === undefined) card._originalPassive = card.passive;
  card.items.push({ id: itemId });
  rewrapPassive(card);
  return true;
}

function detachItem(card, itemId) {
  if (!card || !card.items) return false;
  const idx = card.items.findIndex(e => e.id === itemId);
  if (idx === -1) return false;
  card.items.splice(idx, 1);
  rewrapPassive(card);
  return true;
}

function hasItem(card, itemId) {
  return !!(card.items && card.items.some(e => e.id === itemId));
}

module.exports = {
  ITEM_DEFS, SPECIES, CLASSES,
  getAvailableItems, getItem, attachItem, detachItem, hasItem, giantsBeltMult,
};
