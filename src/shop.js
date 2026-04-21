'use strict';

const { CARD_DEFS, CARD_COSTS, createCard } = require('./cards');

const SHOP_SIZE   = 5;
const REROLL_COST = 2; // default; Midas Touch reduces to 1

// Tier probability weights by player level.
// Each entry: [tier1, tier2, tier3] must sum to 1.
const LEVEL_WEIGHTS = {
  1: [1.00, 0.00, 0.00],
  2: [1.00, 0.00, 0.00],
  3: [0.75, 0.25, 0.00],
  4: [0.60, 0.35, 0.05],
  5: [0.50, 0.40, 0.10],
  6: [0.40, 0.40, 0.20],
  7: [0.25, 0.40, 0.35],
  8: [0.15, 0.35, 0.50],
  9: [0.05, 0.30, 0.65],
};

// Per-player weighted shop draw. No shared inventory, no depletion.
// Picks a tier by LEVEL_WEIGHTS, then uniform within tier. No duplicate
// names within a single draw.
function drawOffers(level, rng, n) {
  const weights = LEVEL_WEIGHTS[Math.min(level, 9)] || LEVEL_WEIGHTS[9];
  const offered = new Set();
  const result = [];

  for (let slot = 0; slot < n; slot++) {
    const roll = rng();
    let cumulative = 0;
    let tier = 1;
    for (let t = 1; t <= 3; t++) {
      cumulative += weights[t - 1];
      if (roll < cumulative) { tier = t; break; }
    }

    let candidates = CARD_DEFS.filter(d => d.tier === tier && !offered.has(d.name));
    if (candidates.length === 0) {
      candidates = CARD_DEFS.filter(d => !offered.has(d.name));
    }
    if (candidates.length === 0) { result.push(null); continue; }

    const pick = candidates[Math.floor(rng() * candidates.length)];
    offered.add(pick.name);
    result.push(pick.name);
  }

  return result;
}

// Per-player shop. Holds the current 5 offers and manages lock/reroll.
class Shop {
  constructor(player) {
    this.player = player;
    this.offers = [];   // array of card names or null (bought/empty slot)
    this.locked = false;
  }

  // Base cost scales up at L6+; Midas Touch reduces by 1.
  rerollCost() {
    const augments = this.player.augments || [];
    const base = this.player.level >= 6 ? 3 : REROLL_COST;
    return augments.includes('MidasTouch') ? base - 1 : base;
  }

  refresh() {
    if (this.locked) { this.locked = false; return; }
    this.offers = drawOffers(this.player.level, this.player.rng, SHOP_SIZE);
  }

  lock()   { this.locked = true;  }
  unlock() { this.locked = false; }

  reroll() {
    const cost = this.rerollCost();
    if (this.player.gold < cost) return false;
    this.player.gold -= cost;
    this.offers = drawOffers(this.player.level, this.player.rng, SHOP_SIZE);
    return true;
  }

  // Returns the bought card instance or null on failure.
  buy(slotIdx) {
    const name = this.offers[slotIdx];
    if (!name) return null;
    const def = CARD_DEFS.find(d => d.name === name);
    if (!def) return null;
    const cost = CARD_COSTS[def.tier];
    if (this.player.gold < cost) return null;

    const card = createCard(name);
    if (!card) return null;

    this.player.gold -= cost;
    this.offers[slotIdx] = null;
    return card;
  }
}

module.exports = { Shop, drawOffers, SHOP_SIZE, REROLL_COST, LEVEL_WEIGHTS };
