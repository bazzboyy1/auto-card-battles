'use strict';

const { CARD_DEFS, CARD_COSTS, createCard, getAvailableCards } = require('./cards');

// Phase 29: shared persistent shop. 8 slots; 2 rotate per round; no lock.
// The lock mechanic was retired because persistence-by-default replaces it —
// cards already carry over, so a "preserve all 5" toggle has no role.
const SHOP_SIZE        = 8;
const ROTATE_PER_ROUND = 2;
const REROLL_COST      = 2; // default; Midas Touch reduces to 1

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

// Pick a single card name by level-weighted tier, uniform within tier.
// Excludes any name already in `existing` (a Set or array of names).
function drawOne(level, rng, existing = null) {
  const weights = LEVEL_WEIGHTS[Math.min(level, 9)] || LEVEL_WEIGHTS[9];
  const has = existing
    ? (existing instanceof Set ? existing : new Set(existing))
    : new Set();

  const roll = rng();
  let cumulative = 0;
  let tier = 1;
  for (let t = 1; t <= 3; t++) {
    cumulative += weights[t - 1];
    if (roll < cumulative) { tier = t; break; }
  }

  const available = getAvailableCards();
  let candidates = available.filter(d => d.tier === tier && !has.has(d.name));
  if (candidates.length === 0) {
    candidates = available.filter(d => !has.has(d.name));
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)].name;
}

// Draw n distinct card names. Used for the initial shop fill.
function drawOffers(level, rng, n) {
  const offered = new Set();
  const result = [];
  for (let i = 0; i < n; i++) {
    const pick = drawOne(level, rng, offered);
    if (pick === null) { result.push(null); continue; }
    offered.add(pick);
    result.push(pick);
  }
  return result;
}

// Per-player shop. Persistent slots — refresh() rotates ROTATE_PER_ROUND
// of the existing offers, replacing them with fresh draws. Bought slots
// are nulled by buy() and refilled on the next refresh.
class Shop {
  constructor(player) {
    this.player  = player;
    this.offers  = [];   // length SHOP_SIZE; null = bought/empty slot
    this._inited = false;
  }

  rerollCost() {
    const mod = this.player.run && this.player.run.modifier;
    if (mod && mod.rerollFree) return 0;
    const augments = this.player.augments || [];
    const base = this.player.level >= 6 ? 3 : REROLL_COST;
    return augments.includes('MidasTouch') ? base - 1 : base;
  }

  // Phase 31-B.1: Pop-up Salon caps shop size from the modifier.
  size() {
    const mod = this.player.run && this.player.run.modifier;
    if (mod && typeof mod.shopSize === 'number') return mod.shopSize;
    return SHOP_SIZE;
  }

  // Round-start refresh.
  // First call: fills all SHOP_SIZE slots from empty.
  // Subsequent calls: refills any null (bought) slots first, then rotates
  // ROTATE_PER_ROUND of the remaining filled slots out.
  refresh() {
    const sz = this.size();
    if (!this._inited) {
      this.offers  = drawOffers(this.player.level, this.player.rng, sz);
      this._inited = true;
      return;
    }

    // If modifier shrank the shop, drop trailing slots first.
    if (this.offers.length > sz) this.offers.length = sz;
    while (this.offers.length < sz) this.offers.push(null);

    // Refill empty slots first.
    const filled = new Set(this.offers.filter(Boolean));
    for (let i = 0; i < sz; i++) {
      if (!this.offers[i]) {
        const pick = drawOne(this.player.level, this.player.rng, filled);
        if (pick) { this.offers[i] = pick; filled.add(pick); }
      }
    }

    // Rotate ROTATE_PER_ROUND of the remaining (originally filled) slots.
    const rotateCount = Math.min(ROTATE_PER_ROUND, this.offers.filter(Boolean).length);
    const rotateIdxs = [];
    const candidates = [];
    for (let i = 0; i < sz; i++) if (this.offers[i]) candidates.push(i);
    // pick rotateCount distinct indices using player rng
    for (let k = 0; k < rotateCount; k++) {
      if (!candidates.length) break;
      const r = Math.floor(this.player.rng() * candidates.length);
      rotateIdxs.push(candidates.splice(r, 1)[0]);
    }
    // Replace each rotated slot with a fresh non-duplicate draw.
    const present = new Set(this.offers.filter(Boolean));
    for (const idx of rotateIdxs) {
      present.delete(this.offers[idx]);
      const pick = drawOne(this.player.level, this.player.rng, present);
      this.offers[idx] = pick;
      if (pick) present.add(pick);
    }
  }

  // Full reroll (paid). Replaces every slot with a fresh draw.
  reroll() {
    const cost = this.rerollCost();
    if (this.player.gold < cost) return false;
    this.player.gold -= cost;
    this.offers  = drawOffers(this.player.level, this.player.rng, this.size());
    this._inited = true;
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

  // Direct removal — used by the rival's pick. No gold cost; the rival
  // is bookkept as pure market pressure, not a competing economy.
  removeSlot(slotIdx) {
    const name = this.offers[slotIdx];
    if (!name) return null;
    this.offers[slotIdx] = null;
    return name;
  }
}

module.exports = { Shop, drawOffers, drawOne, SHOP_SIZE, REROLL_COST, ROTATE_PER_ROUND, LEVEL_WEIGHTS };
