'use strict';

const { Board, effectiveClassCounts } = require('./board');
const { Shop }  = require('./shop');
const { CARD_COSTS, CARD_DEFS, createCard, CLASS_SYNERGIES } = require('./cards');
const { attachItem, ITEM_DEFS } = require('./items');
const { AUGMENT_DEFS, pickN } = require('./augments');

const STARTING_GOLD  = 9;
const STARTING_LEVEL = 3;
const STARTING_SLOTS = 3;
const BASE_INCOME    = 5;
const MAX_INTEREST   = 5;
const INTEREST_PER   = 5;
const MAX_LEVEL      = 9;
const ROUND_CAP      = 24;
const MAX_BOARD      = 10;
const STARTING_LIVES = 3;

const PLINTH_COST = { 3: 8, 4: 8, 5: 12, 6: 20, 7: 24, 8: 28 };

// Six judges — one drawn per chapter per run (no repeats).
// preferredTarget on ROUND_TARGETS applies when the board meets a judge's qualifying condition.
const HEAD_JUDGES = [
  {
    id: 'vlorb',
    name: 'Judge Vlorb',
    preference: 'Fascinated by Void specimens',
    qualifyingHint: '2+ Abyssal active',
    qualifies: (board) => board.active.filter(c => c.species === 'Abyssal').length >= 2,
  },
  {
    id: 'praxis',
    name: 'Curator Praxis',
    preference: 'Values long-term commitment',
    qualifyingHint: '3+ cards held 8+ rounds',
    qualifies: (board) => board.active.filter(c => (c.roundsSinceBought || 0) >= 8).length >= 3,
  },
  {
    id: 'shen_nax',
    name: 'Critic Shen-Nax',
    preference: 'Demands only the finest specimens',
    qualifyingHint: '2+ T3 cards active',
    qualifies: (board) => board.active.filter(c => c.tier === 3).length >= 2,
  },
  {
    id: 'yorzal',
    name: 'Judge Yorzal',
    preference: 'Expects emotional coherence',
    qualifyingHint: '2+ class synergies active',
    qualifies: (board) => {
      const { counts } = effectiveClassCounts(board);
      return Object.keys(counts).filter(cls => {
        const syn = CLASS_SYNERGIES[cls];
        return syn && syn.getBonus(counts[cls]);
      }).length >= 2;
    },
  },
  {
    id: 'collective',
    name: 'The Collective',
    preference: 'Rewards breadth of collection',
    qualifyingHint: '4+ distinct species active',
    qualifies: (board) => new Set(board.active.map(c => c.species)).size >= 4,
  },
  {
    id: 'assembly',
    name: 'The Assembly',
    preference: 'Pure exhibition merit',
    qualifyingHint: null,  // no preference bonus — target is always base
    isNeutral: true,
    qualifies: () => false,
  },
];

// Curated gift for each judge's critique round.
// 'item' → item pushed to player.itemBag; 'augment' → applied immediately;
// 'augment-pick' → 3-choice free augment offer (The Assembly only).
// The Assembly's Shapeshifter is filtered out of its pool to avoid nested sub-picks.
const CURATOR_SELECTIONS = {
  vlorb:      { type: 'item',         id: 'Emblem of Abyssal' },    // Taxonomy Badge: Abyssal
  praxis:     { type: 'item',         id: "Guinsoo's Rageblade" },   // Acclimatisation Log
  shen_nax:   { type: 'item',         id: "Giant's Belt" },          // Rarity Certificate
  yorzal:     { type: 'augment',      id: 'CrossTraining' },         // Cross-Pollination
  collective: { type: 'augment',      id: 'Varietal' },              // Diverse Portfolio
  assembly:   { type: 'augment-pick' },                              // free 3-choice pick
};

// Score targets for each of the 24 rounds.
// preferredTarget = base × 0.85 (rounded). Applied when board meets current judge's condition.
// The Assembly (isNeutral) never grants the reduction — preferredTarget is unused for them.
const ROUND_TARGETS = [
  { target: 150,  preferredTarget: 128,  isCritique: false },
  { target: 220,  preferredTarget: 187,  isCritique: false },
  { target: 310,  preferredTarget: 264,  isCritique: false },
  { target: 410,  preferredTarget: 349,  isCritique: false },
  { target: 520,  preferredTarget: 442,  isCritique: false },
  { target: 650,  preferredTarget: 553,  isCritique: false },
  { target: 800,  preferredTarget: 680,  isCritique: false },
  { target: 1000, preferredTarget: 850,  isCritique: true  }, // R8  — Critique 1
  { target: 1100, preferredTarget: 935,  isCritique: false },
  { target: 1280, preferredTarget: 1088, isCritique: false },
  { target: 1480, preferredTarget: 1258, isCritique: false },
  { target: 1700, preferredTarget: 1445, isCritique: false },
  { target: 1950, preferredTarget: 1658, isCritique: false },
  { target: 2250, preferredTarget: 1913, isCritique: false },
  { target: 2600, preferredTarget: 2210, isCritique: false },
  { target: 3100, preferredTarget: 2635, isCritique: true  }, // R16 — Critique 2
  { target: 3400, preferredTarget: 2890, isCritique: false },
  { target: 3750, preferredTarget: 3188, isCritique: false },
  { target: 4150, preferredTarget: 3528, isCritique: false },
  { target: 4600, preferredTarget: 3910, isCritique: false },
  { target: 5050, preferredTarget: 4293, isCritique: false },
  { target: 5500, preferredTarget: 4675, isCritique: false },
  { target: 5950, preferredTarget: 5058, isCritique: false },
  { target: 7000, preferredTarget: 5950, isCritique: true  }, // R24 — Grand Finale
];

class Player {
  constructor(id, name, rng) {
    this.id        = id;
    this.name      = name;
    this.gold      = STARTING_GOLD;
    this.level     = STARTING_LEVEL;
    this.streak    = 0;
    this.wins      = 0;
    this.losses    = 0;
    this.isHuman   = false;
    this.rng       = rng;
    this.board     = new Board(STARTING_SLOTS);
    this.shop      = new Shop(this);
    // augments is wired to run.augments by Run constructor (shared reference).
    this.augments  = [];
    this.itemBag   = [];
  }

  // Tycoon doubles the interest component only (not base or streak).
  earnIncome() {
    const interest    = Math.min(MAX_INTEREST, Math.floor(this.gold / INTEREST_PER));
    const streakBonus = this._streakBonus();
    const interestMult = this.augments.includes('Tycoon') ? 2 : 1;
    this.gold += BASE_INCOME + interest * interestMult + streakBonus;
  }

  incomeBreakdown() {
    const interest     = Math.min(MAX_INTEREST, Math.floor(this.gold / INTEREST_PER));
    const streakBonus  = this._streakBonus();
    const interestMult = this.augments.includes('Tycoon') ? 2 : 1;
    const effectiveInterest = interest * interestMult;
    return {
      base:     BASE_INCOME,
      interest: effectiveInterest,
      streak:   streakBonus,
      total:    BASE_INCOME + effectiveInterest + streakBonus,
      tycoon:   interestMult === 2,
    };
  }

  _streakBonus() {
    const abs = Math.abs(this.streak);
    if (abs >= 6) return 3;
    if (abs >= 4) return 2;
    if (abs >= 2) return 1;
    return 0;
  }

  addPlinth() {
    if (this.level >= MAX_LEVEL) return false;
    const cost = PLINTH_COST[this.level];
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.level++;
    this.board.maxActive = this.level;
    return true;
  }

  plinthCost() {
    return this.level >= MAX_LEVEL ? 0 : PLINTH_COST[this.level];
  }

  applyResult(passed) {
    if (passed) {
      this.wins++;
      this.streak = this.streak > 0 ? this.streak + 1 : 1;
    } else {
      this.losses++;
      this.streak = this.streak < 0 ? this.streak - 1 : -1;
    }
  }

  runCombines() {
    let changed = true;
    while (changed) {
      changed = false;
      const groups = {};
      for (const card of this.board.allCards) {
        const key = `${card.name}:${card.stars}`;
        (groups[key] = groups[key] || []).push(card);
      }
      for (const [key, cards] of Object.entries(groups)) {
        if (cards.length >= 3 && cards[0].stars < 3) {
          this._combine(cards[0].name, cards[0].stars);
          changed = true;
          break;
        }
      }
    }
  }

  _combine(name, stars) {
    // Gather items (and shapeshifterSpecies) from the 3 source cards before
    // removing them. Overflow items are dropped.
    const transferred = [];
    let removed = 0;
    let shapeshifterSpecies = null;
    let maxRounds = 0;
    for (const src of [this.board.active, this.board.bench]) {
      for (let i = src.length - 1; i >= 0 && removed < 3; i--) {
        if (src[i].name === name && src[i].stars === stars) {
          const [c] = src.splice(i, 1);
          if (c.items) for (const e of c.items) transferred.push(e.id);
          if (c.shapeshifterSpecies) shapeshifterSpecies = c.shapeshifterSpecies;
          if ((c.roundsSinceBought || 0) > maxRounds) maxRounds = c.roundsSinceBought || 0;
          removed++;
        }
      }
    }
    const upgraded = createCard(name, stars + 1);
    upgraded.roundsSinceBought = maxRounds;
    if (shapeshifterSpecies) upgraded.shapeshifterSpecies = shapeshifterSpecies;
    this.board.addCard(upgraded);
    for (const itemId of transferred.slice(0, 3)) attachItem(upgraded, itemId);
  }

  sell(id) {
    const card = this.board.removeById(id);
    if (!card) return 0;
    for (const item of (card.items || [])) this.itemBag.push(item.id);
    let value = Math.round(CARD_COSTS[card.tier] * Math.pow(3, card.stars - 1));
    if (card.passive && typeof card.passive.eval === 'function') {
      const r = card.passive.eval(card, {
        player: this, boardState: this.board, speciesCounts: {}, self: card, round: 0,
      });
      if (r && typeof r.sellBonus === 'number') {
        // MidasTouch doubles Axis-7 sell bonuses (Enchantress).
        const mult = this.augments.includes('MidasTouch') ? 2 : 1;
        value += r.sellBonus * mult;
      }
    }
    this.gold += value;
    return value;
  }
}

// Single-player roguelike run. 24 rounds; player is eliminated when lives hit 0.
//
// Augment pick flow:
//   run.augmentPickRounds = [3, 7, 12]
//   Before each round in [3,7,12], pendingAugment() generates a 3-id offer
//   (random from unpicked augments) and returns it. The caller (sim loop or
//   browser) must call pickAugment(idx) before earnIncome + shop phase that
//   round, so Midas/Tycoon effects apply immediately.
const CHAPTER_LABELS = ['Opening Exhibition', 'Main Exhibition', 'Grand Exhibition'];

class Run {
  constructor(rng, diffMult = 1.0) {
    this.rng              = rng;
    this.diffMult         = diffMult;
    this.round            = 0;
    this.player           = new Player(0, 'You', rng);
    this.augments         = [];          // shared array — also set on player
    this.player.augments  = this.augments;
    this.augmentPickRounds = [3, 7, 12];
    this.augmentOffers    = {};          // { [round]: [id, id, id] }
    this._augmentsPicked  = new Set();   // rounds where pick was completed
    this.itemPickRounds   = [5, 10, 15];
    this.itemOffers       = {};
    this._itemsPicked     = new Set();
    this.lives            = STARTING_LIVES;
    this.peakScore        = 0;
    this.battleHistory    = [];
    this.headJudges       = this._assignJudges(); // [ch1Id, ch2Id, ch3Id]
    this._curatorsPicked  = new Set();
    this.curatorOffers    = {};
  }

  // Draw 3 judges from the pool without repeats.
  _assignJudges() {
    const pool = HEAD_JUDGES.map(j => j.id);
    const chosen = [];
    while (chosen.length < 3) {
      const idx = Math.floor(this.rng() * pool.length);
      chosen.push(pool.splice(idx, 1)[0]);
    }
    return chosen;
  }

  // Chapter number (1–3) for a given round (1–24).
  chapterFor(round) {
    return Math.min(3, Math.ceil(Math.max(1, round) / 8));
  }

  // Head judge object for a given round (defaults to this.round).
  currentJudge(round) {
    const r = round !== undefined ? round : this.round;
    const chIdx = Math.min(2, Math.floor((Math.max(1, r) - 1) / 8));
    return HEAD_JUDGES.find(j => j.id === this.headJudges[chIdx]) || null;
  }

  // Returns the 3-id offer for the upcoming round if a pick is pending,
  // null otherwise. Generates and caches the offer on first call so the
  // rng is only consumed once per pick round.
  pendingAugment() {
    const nextRound = this.round + 1;
    if (!this.augmentPickRounds.includes(nextRound)) return null;
    if (this._augmentsPicked.has(nextRound)) return null;

    if (!this.augmentOffers[nextRound]) {
      const pool = AUGMENT_DEFS.map(a => a.id).filter(id => !this.augments.includes(id));
      this.augmentOffers[nextRound] = pickN(pool, 3, this.rng);
    }
    return this.augmentOffers[nextRound];
  }

  // Apply the chosen augment (idx into the pending offer). Returns the
  // augment id on success, null on failure. On-pick mutations happen here.
  pickAugment(idx) {
    const nextRound = this.round + 1;
    const offer = this.augmentOffers[nextRound];
    if (!offer || idx < 0 || idx >= offer.length) return null;
    if (this._augmentsPicked.has(nextRound)) return null;

    const chosen = offer[idx];
    this.augments.push(chosen);
    this._augmentsPicked.add(nextRound);

    // On-pick effects.
    if (chosen === 'Overflow') {
      this.player.board.maxActive = Math.min(MAX_BOARD, this.player.board.maxActive + 1);
    }
    // Shapeshifter requires a separate applyShapeshifter() call by the caller.

    return chosen;
  }

  // Apply the Shapeshifter sub-pick: find the card by name and permanently
  // assign shapeshifterSpecies. Safe to call multiple times (last call wins).
  applyShapeshifter(cardName, species) {
    const card = this.player.board.allCards.find(c => c.name === cardName);
    if (!card || !species) return false;
    card.shapeshifterSpecies = species;
    return true;
  }

  // Returns the 3-id item offer for the upcoming round if a pick is pending,
  // null otherwise. Offers are cached so rng is only consumed once per round.
  pendingItem() {
    const nextRound = this.round + 1;
    if (!this.itemPickRounds.includes(nextRound)) return null;
    if (this._itemsPicked.has(nextRound)) return null;
    if (!this.itemOffers[nextRound]) {
      const pool = ITEM_DEFS.map(it => it.id);
      this.itemOffers[nextRound] = pickN(pool, 3, this.rng);
    }
    return this.itemOffers[nextRound];
  }

  // Add the chosen item (idx into the pending offer) to player.itemBag.
  // Returns the item id on success, null on failure.
  pickItem(idx) {
    const nextRound = this.round + 1;
    const offer = this.itemOffers[nextRound];
    if (!offer || idx < 0 || idx >= offer.length) return null;
    if (this._itemsPicked.has(nextRound)) return null;
    const chosen = offer[idx];
    this.player.itemBag.push(chosen);
    this._itemsPicked.add(nextRound);
    return chosen;
  }

  runBattle() {
    this.round++;
    const ctx = {
      round:    this.round,
      player:   this.player,
      augments: this.augments,
    };
    const scoreBreakdown = this.player.board.calcScoreBreakdown(ctx);
    const playerScore    = scoreBreakdown.total;
    const { target: baseNormal, preferredTarget: basePref, isCritique } = ROUND_TARGETS[this.round - 1];
    const normalTarget    = Math.round(baseNormal * this.diffMult);
    const preferredTarget = Math.round(basePref   * this.diffMult);
    const judge     = this.currentJudge(this.round);
    const qualified = judge ? judge.qualifies(this.player.board, this.augments) : false;
    const target    = (qualified && preferredTarget != null) ? preferredTarget : normalTarget;
    const passed    = playerScore >= target;

    if (playerScore > this.peakScore) this.peakScore = playerScore;
    if (!passed) this.lives = Math.max(0, this.lives - 1);

    // Life regain: beat a critique target by 25%+ → restore one seal (max 3).
    let lifeGained = false;
    if (isCritique && passed && playerScore >= Math.round(target * 1.25)) {
      if (this.lives < STARTING_LIVES) {
        this.lives++;
        lifeGained = true;
      }
    }

    this.player.applyResult(passed);

    // Post-battle passive upkeep:
    // - Tick roundsSinceBought on each active card (bench does not tick).
    // - Collect tickGold from Axis-7 passives + Hextech Gunblade.
    // - MidasTouch doubles all Axis-7 gold income.
    const midasMult = this.augments.includes('MidasTouch') ? 2 : 1;
    for (const card of this.player.board.active) {
      card.roundsSinceBought = (card.roundsSinceBought || 0) + 1;
      if (card.passive && typeof card.passive.eval === 'function') {
        const r = card.passive.eval(card, {
          round: this.round, boardState: this.player.board,
          speciesCounts: {}, self: card, player: this.player,
          augments: this.augments,
        });
        if (r && typeof r.tickGold === 'number') {
          this.player.gold += r.tickGold * midasMult;
        }
      }
      if (card.items && card.items.some(e => e.id === 'Hextech Gunblade')) {
        this.player.gold += 2 * midasMult;
      }
    }

    const entry = {
      round: this.round,
      target,
      normalTarget,
      preferredTarget,
      isCritique,
      judgeId: judge ? judge.id : null,
      qualified,
      playerScore,
      passed,
      livesAfter: this.lives,
      lifeGained,
      scoreBreakdown,
    };
    this.battleHistory.push(entry);
    return entry;
  }

  // Returns the curator offer if the most recent battle was a critique round
  // and the pick has not yet been taken. Caches the augment-pick offer so
  // the rng is only consumed once.
  pendingCurator() {
    if (!this.battleHistory.length) return null;
    const last = this.battleHistory[this.battleHistory.length - 1];
    if (!last.isCritique) return null;
    if (this._curatorsPicked.has(last.round)) return null;
    const judge = HEAD_JUDGES.find(j => j.id === last.judgeId);
    if (!judge) return null;
    const sel = CURATOR_SELECTIONS[judge.id];
    if (!sel) return null;
    if (sel.type === 'augment-pick') {
      if (!this.curatorOffers[last.round]) {
        const pool = AUGMENT_DEFS.map(a => a.id)
          .filter(id => !this.augments.includes(id) && id !== 'Shapeshifter');
        this.curatorOffers[last.round] = pickN(pool, Math.min(3, pool.length), this.rng);
      }
      return { ...sel, offers: this.curatorOffers[last.round] };
    }
    return sel;
  }

  // Apply the curator pick. idx is used only for augment-pick (The Assembly).
  // Returns { type, id } on success, null on failure.
  pickCurator(idx) {
    if (!this.battleHistory.length) return null;
    const last = this.battleHistory[this.battleHistory.length - 1];
    if (!last.isCritique) return null;
    if (this._curatorsPicked.has(last.round)) return null;
    const judge = HEAD_JUDGES.find(j => j.id === last.judgeId);
    if (!judge) return null;
    const sel = CURATOR_SELECTIONS[judge.id];
    if (!sel) return null;
    this._curatorsPicked.add(last.round);

    if (sel.type === 'item') {
      this.player.itemBag.push(sel.id);
      return { type: 'item', id: sel.id };
    }
    if (sel.type === 'augment') {
      if (!this.augments.includes(sel.id)) this.augments.push(sel.id);
      return { type: 'augment', id: sel.id };
    }
    if (sel.type === 'augment-pick') {
      const offers = this.curatorOffers[last.round];
      if (!offers || idx < 0 || idx >= offers.length) return null;
      const chosen = offers[idx];
      if (!this.augments.includes(chosen)) this.augments.push(chosen);
      if (chosen === 'Overflow') {
        this.player.board.maxActive = Math.min(MAX_BOARD, this.player.board.maxActive + 1);
      }
      return { type: 'augment', id: chosen };
    }
    return null;
  }

  isOver() {
    return this.lives === 0 || this.round >= ROUND_CAP;
  }

  finalScore() {
    return { round: this.round, livesRemaining: this.lives, peakScore: this.peakScore };
  }
}

module.exports = {
  Player, Run,
  STARTING_GOLD, STARTING_LEVEL, STARTING_SLOTS, STARTING_LIVES,
  MAX_LEVEL, PLINTH_COST, BASE_INCOME, INTEREST_PER, ROUND_CAP,
  ROUND_TARGETS, HEAD_JUDGES, CHAPTER_LABELS, CURATOR_SELECTIONS,
};
