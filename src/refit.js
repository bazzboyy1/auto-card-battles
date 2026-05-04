'use strict';

// Phase 31-B.2 — Exhibition Refit.
//
// Between-chapter gold sink. After scoring at R8/R16/R23, the player gets a
// Refit modal offering paid actions:
//   peek     — reveal next chapter's judge taste rule + hint (10g)
//   swap     — draft 1 of 3 candidates from a Refit Pool, dismiss one current
//              card; new card joins active (or bench if active is full)
//   promote  — upgrade a 1*->2* (25g) or 2*->3* (60g) card directly. Cap 1
//              promotion per Refit so it doesn't trivialize the finale.
//
// Costs are flat (not chapter-scaled): purchasing power scales naturally
// because gold pool grows. Greedy AI gold profile (n=300 v0.50, seed=1):
//   after R8:  median 9g, p25 2g    -> R8 Refit is mostly skip-or-peek
//   after R16: median 82g, p25 56g  -> meaningful sink
//   after R23: median 177g, p25 149g -> splurge before finale
//
// Refit Pool draws 3 candidates weighted toward the *next* judge's taste:
// 60% biased pool / 40% open. Tier weighting by chapter (R8->T1 mostly,
// R16->T1/T2 mix, R23->T2/T3 mix). Locked cards excluded.

const { CARD_DEFS, createCard, getAvailableCards } = require('./cards');
const { getJudge } = require('./judges');
const { attachItem } = require('./items');

const REFIT_COSTS = {
  peek:        10,
  swap:        20,
  promoteT1T2: 25,
  promoteT2T3: 60,
};

// Which tags to favor for each taste. Tag-tastes get tag bias; others uniform.
const TASTE_TAG_BIAS = {
  spectacle:    ['Ostentatious'],
  restraint:    ['Restrained', 'Quaint'],
  eccentricity: ['Bizarre'],
  grotesquerie: ['Grotesque', 'Bizarre'],
  refinement:   ['Elegant', 'Restrained'],
  architecture: ['Restrained', 'Quaint'],
  ostentation:  ['Ostentatious'],
  // diversity / narrative / harmony fall through to uniform draw.
};

const REFIT_ROUNDS = [8, 16, 23];   // chapter ends; R24 has no Refit (run is over)

// Returns the chapter index that just finished (1, 2, or 3) for a given
// chapter-end round. R8 -> 1, R16 -> 2, R23 -> 3.
function chapterEnded(round) {
  if (round === 8)  return 1;
  if (round === 16) return 2;
  if (round === 23) return 3;
  return null;
}

// Tier weights per chapter-end (next chapter). After R8 the next chapter is
// chapter 2 (R9-16), still mostly T1 with some T2 emerging. After R16 we open
// up T2 heavily. After R23 it's the finale; players want T2/T3 candidates.
function tierWeights(chapterEndedNum) {
  if (chapterEndedNum === 1) return { 1: 0.70, 2: 0.30, 3: 0.00 };
  if (chapterEndedNum === 2) return { 1: 0.30, 2: 0.55, 3: 0.15 };
  if (chapterEndedNum === 3) return { 1: 0.10, 2: 0.50, 3: 0.40 };
  return { 1: 0.50, 2: 0.40, 3: 0.10 };
}

// Pick a weighted candidate from a list of {def, weight}.
function pickWeighted(items, rng) {
  if (!items.length) return null;
  let total = 0;
  for (const it of items) total += it.weight;
  if (total <= 0) return items[Math.floor(rng() * items.length)].def;
  let r = rng() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.def;
  }
  return items[items.length - 1].def;
}

// Draw 3 candidates for the Refit Pool. 60% are tag-biased toward nextTaste's
// preferred tags (if any); 40% are open. Tier weighting per chapter.
// Excludes any def already on the player's board (active+bench) so we don't
// hand back a duplicate that just merges.
function drawRefitCandidates(run, nextTaste, rng) {
  const ended = chapterEnded(run.round);
  const tWeights = tierWeights(ended);
  const tagBias = TASTE_TAG_BIAS[nextTaste] || [];

  const onBoardNames = new Set();
  for (const c of run.player.board.active)  onBoardNames.add(c.name);
  for (const c of run.player.board.bench)   onBoardNames.add(c.name);

  const pool = getAvailableCards().filter(d => !onBoardNames.has(d.name));
  if (!pool.length) return [];

  // Build two sub-pools: biased (any tag matches) vs. open (no tag match).
  const biased = [];
  const open   = [];
  for (const def of pool) {
    const tw = tWeights[def.tier] || 0;
    if (tw <= 0) continue;
    const matches = tagBias.length > 0 && Array.isArray(def.tags)
      && def.tags.some(t => tagBias.includes(t));
    (matches ? biased : open).push({ def, weight: tw });
  }

  // 60/40 split if biased pool is non-empty; otherwise uniform from open.
  const candidates = [];
  const used = new Set();
  for (let i = 0; i < 3; i++) {
    const useBiased = biased.length > 0 && rng() < 0.60;
    const src = useBiased ? biased : open;
    if (!src.length && (useBiased ? open.length : biased.length)) {
      // Fall back to the other pool if the chosen one is empty.
      const fallback = useBiased ? open : biased;
      const filtered = fallback.filter(it => !used.has(it.def.name));
      if (!filtered.length) break;
      const pick = pickWeighted(filtered, rng);
      if (pick) { candidates.push(pick); used.add(pick.name); }
      continue;
    }
    const filtered = src.filter(it => !used.has(it.def.name));
    if (!filtered.length) {
      // Try the other pool entirely.
      const otherFiltered = (useBiased ? open : biased).filter(it => !used.has(it.def.name));
      if (!otherFiltered.length) break;
      const pick = pickWeighted(otherFiltered, rng);
      if (pick) { candidates.push(pick); used.add(pick.name); }
      continue;
    }
    const pick = pickWeighted(filtered, rng);
    if (pick) { candidates.push(pick); used.add(pick.name); }
  }
  return candidates;
}

// Refit state machine attached to Run. One per Refit; persists until the
// player commits "Continue", then is cleared.
//
//   state = {
//     round, chapterEnded,        // which chapter end fired this Refit
//     peeked: bool,
//     candidates: [def, def, def] — drawn lazily on first 'swap' action
//     promotedThisRefit: bool     — caps to 1 promotion per Refit
//     spentTotal: int             — for telemetry / debug
//   }
class RefitState {
  constructor(run) {
    this.run               = run;
    this.round             = run.round;
    this.chapterEnded      = chapterEnded(run.round);
    this.peeked            = false;
    this.candidates        = null;     // [def, def, def] when swap drawer opened
    this.promotedThisRefit = false;
    this.spentTotal        = 0;
  }

  nextJudge() {
    const nextChapterIdx = (this.chapterEnded || 0); // ended==1 -> next is judges[1] (Ch2)
    const id = this.run.headJudges[nextChapterIdx];
    return id ? getJudge(id) : null;
  }

  // Phase 33-B.3.B: Curator's Stipend modifier adds a flat refitPremium to
  // every refit action so the +6 ✦/chapter benefit comes with friction.
  _premium() {
    const mod = this.run && this.run.modifier;
    return (mod && typeof mod.refitPremium === 'number') ? mod.refitPremium : 0;
  }
  peekCost() { return REFIT_COSTS.peek + this._premium(); }
  swapCost() { return REFIT_COSTS.swap + this._premium(); }
  promoteCost(stars) {
    if (stars === 1) return REFIT_COSTS.promoteT1T2 + this._premium();
    if (stars === 2) return REFIT_COSTS.promoteT2T3 + this._premium();
    return Infinity;
  }

  canAfford(cost) { return this.run.player.gold >= cost; }

  // Pay for the peek; reveals taste rule client-side. Returns true on success.
  payPeek() {
    if (this.peeked) return false;
    const cost = this.peekCost();
    if (!this.canAfford(cost)) return false;
    this.run.player.gold -= cost;
    this.spentTotal      += cost;
    this.peeked           = true;
    return true;
  }

  // Open the swap drawer: pay nothing yet, draw 3 candidates lazily.
  openSwapDrawer() {
    if (!this.candidates) {
      const j = this.nextJudge();
      const taste = j ? j.taste : null;
      this.candidates = drawRefitCandidates(this.run, taste, this.run.rng);
    }
    return this.candidates;
  }

  // Commit a swap. candidateIdx: which Refit Pool card to acquire.
  // dismissCardId: which player card to dismiss (sells at standard sell value).
  // Returns { acquired, dismissed, refund } on success or null on failure.
  commitSwap(candidateIdx, dismissCardId) {
    const cost = this.swapCost();
    if (!this.canAfford(cost)) return null;
    if (!this.candidates || candidateIdx < 0 || candidateIdx >= this.candidates.length) return null;
    const def = this.candidates[candidateIdx];
    if (!def) return null;

    // Capture the dismissed card's name before sell removes it from the board.
    const board = this.run.player.board;
    const dismissedCard = board.active.find(c => c._id === dismissCardId)
                       || board.bench.find(c => c._id === dismissCardId);
    const dismissedName = dismissedCard ? dismissedCard.name : null;

    // Sell the dismissed card via existing Player.sell (returns refund + bags items).
    const refund = this.run.player.sell(dismissCardId);
    if (refund <= 0) return null;

    // Pay swap cost.
    this.run.player.gold -= cost;
    this.spentTotal      += cost;

    // Acquire new card; place into active if there's room, else bench.
    const card = createCard(def.name, 1);
    if (board.canAddToActive())      board.active.push(card);
    else if (board.canAddToBench())  board.bench.push(card);
    else                              board.bench.push(card); // shouldn't happen, but soft-land

    // Consume the candidate so it can't be re-bought this Refit.
    this.candidates[candidateIdx] = null;

    return { acquired: def.name, dismissed: dismissedName, refund };
  }

  // Promote a card by 1 star. Caller passes cardId; we look it up on the
  // player's board (active or bench). Caps at 1 promotion per Refit.
  commitPromote(cardId) {
    if (this.promotedThisRefit) return null;
    const board = this.run.player.board;
    const card = board.active.find(c => c._id === cardId)
              || board.bench.find(c => c._id === cardId);
    if (!card) return null;
    if (card.stars >= 3) return null;
    const cost = this.promoteCost(card.stars);
    if (!this.canAfford(cost)) return null;

    // Build the upgraded card; transfer items + roundsSinceBought.
    const upgraded = createCard(card.name, card.stars + 1);
    upgraded.roundsSinceBought = card.roundsSinceBought || 0;
    if (card.shapeshifterSpecies) upgraded.shapeshifterSpecies = card.shapeshifterSpecies;
    const itemIds = (card.items || []).map(e => e.id);

    // Replace the original in-place to preserve slot order.
    let placed = false;
    for (const arr of [board.active, board.bench]) {
      const idx = arr.indexOf(card);
      if (idx !== -1) { arr[idx] = upgraded; placed = true; break; }
    }
    if (!placed) board.bench.push(upgraded);
    for (const itemId of itemIds.slice(0, 3)) attachItem(upgraded, itemId);

    this.run.player.gold -= cost;
    this.spentTotal      += cost;
    this.promotedThisRefit = true;
    return { upgraded: upgraded.name, fromStars: card.stars, toStars: upgraded.stars };
  }
}

module.exports = {
  REFIT_COSTS,
  REFIT_ROUNDS,
  TASTE_TAG_BIAS,
  chapterEnded,
  tierWeights,
  drawRefitCandidates,
  RefitState,
};
