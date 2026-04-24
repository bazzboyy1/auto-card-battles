'use strict';

const { Board } = require('./board');
const { Shop }  = require('./shop');
const { CARD_COSTS, CARD_DEFS, createCard } = require('./cards');
const { attachItem, ITEM_DEFS } = require('./items');
const { generateOpponent } = require('./opponents');
const { AUGMENT_DEFS, pickN } = require('./augments');

const STARTING_HP    = 100;
const STARTING_GOLD  = 9;
const STARTING_LEVEL = 3;
const STARTING_SLOTS = 3;
const BASE_INCOME  = 5;
const MAX_INTEREST = 5;
const INTEREST_PER = 5;
const MAX_LEVEL    = 9;
const ROUND_CAP    = 30;
const MAX_BOARD    = 10; // Overflow cap

// Gold cost to add a plinth (go from level L → L+1). Preserves the effective
// cost of the old XP curve (LEVEL_XP + 4g/click) so economy pacing is unchanged.
const PLINTH_COST = { 3: 8, 4: 8, 5: 12, 6: 20, 7: 24, 8: 28 };

class Player {
  constructor(id, name, rng) {
    this.id        = id;
    this.name      = name;
    this.hp        = STARTING_HP;
    this.gold      = STARTING_GOLD;
    this.level     = STARTING_LEVEL;
    this.streak    = 0;
    this.wins      = 0;
    this.losses    = 0;
    this.eliminated = false;
    this.isHuman   = false;
    this.rng       = rng;
    this.board     = new Board(STARTING_SLOTS);
    this.shop      = new Shop(this);
    // augments is wired to run.augments by Run constructor (shared reference).
    this.augments  = [];
    this.itemBag   = [];
  }

  get isAlive() { return !this.eliminated && this.hp > 0; }

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

  applyResult(won, round) {
    if (won) {
      this.wins++;
      this.streak = this.streak > 0 ? this.streak + 1 : 1;
    } else {
      this.losses++;
      this.streak = this.streak < 0 ? this.streak - 1 : -1;
      this.hp -= (2 + round);
      if (this.hp <= 0) {
        this.hp = 0;
        this.eliminated = true;
      }
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

// Single-player roguelike run. 30 rounds vs fake opponents; player dies if
// HP hits 0 before round cap.
//
// Augment pick flow:
//   run.augmentPickRounds = [3, 7, 12]
//   Before each round in [3,7,12], pendingAugment() generates a 3-id offer
//   (random from unpicked augments) and returns it. The caller (sim loop or
//   browser) must call pickAugment(idx) before earnIncome + shop phase that
//   round, so Midas/Tycoon effects apply immediately.
class Run {
  constructor(rng) {
    this.rng              = rng;
    this.round            = 0;
    this.player           = new Player(0, 'You', rng);
    this.augments         = [];          // shared array — also set on player
    this.player.augments  = this.augments;
    this.augmentPickRounds = [3, 7, 12];
    this.augmentOffers    = {};          // { [round]: [id, id, id] }
    this._augmentsPicked  = new Set();   // rounds where pick was completed
    this.itemPickRounds  = [5, 10, 15];
    this.itemOffers      = {};
    this._itemsPicked    = new Set();
    this.opponentHistory  = [];
    this.rankMult         = 1.0;
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
    const opp              = generateOpponent(this.round, this.rng, this.rankMult);
    const scoreBreakdown   = this.player.board.calcScoreBreakdown(ctx);
    const playerScore      = scoreBreakdown.total;
    const opponentScore    = opp.calcScore();
    const playerWon        = playerScore >= opponentScore;
    this.player.applyResult(playerWon, this.round);

    // Post-battle passive upkeep:
    // - Tick roundsSinceBought on each active card (bench does not tick).
    // - Collect tickGold from Axis-7 passives (Ogre Magi) + Hextech Gunblade.
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
      opponent: opp.name,
      playerScore,
      opponentScore,
      won: playerWon,
      hpAfter: this.player.hp,
      scoreBreakdown,
    };
    this.opponentHistory.push(entry);
    return entry;
  }

  isOver() {
    return this.player.hp <= 0 || this.round >= ROUND_CAP;
  }

  // Final score = HP; tiebreak implicit on rounds survived (caller handles).
  finalScore() {
    return { hp: this.player.hp, roundsSurvived: this.round };
  }
}

module.exports = {
  Player, Run,
  STARTING_HP, STARTING_GOLD, STARTING_LEVEL, STARTING_SLOTS,
  MAX_LEVEL, PLINTH_COST, BASE_INCOME, INTEREST_PER, ROUND_CAP,
};
