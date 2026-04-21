'use strict';

// Diagnostic runner: traces one single-player run round-by-round — economy,
// board score, opponent score, HP.

const { CARD_DEFS, CARD_COSTS } = require('./cards');
const { Run } = require('./game');
const { mulberry32 } = require('./utils');
const { POLICIES } = require('./sim');

function diagGame(seed = 1, policyName = 'greedy') {
  const rng    = mulberry32(seed);
  const run    = new Run(rng);
  const policy = POLICIES[policyName] || POLICIES.greedy;
  const p      = run.player;

  const stats = {
    name: p.name,
    baseTotal: 0, interestTotal: 0, streakTotal: 0,
    goldSpentCards: 0, goldSpentXP: 0, goldSpentReroll: 0,
    combinesMade: 0,
    maxStreak: 0,
    roundsAlive: 0,
  };

  const orig = p.earnIncome.bind(p);
  p.earnIncome = function () {
    const interest    = Math.min(5, Math.floor(this.gold / 5));
    const streakBonus = this._streakBonus();
    stats.baseTotal     += 7;
    stats.interestTotal += interest;
    stats.streakTotal   += streakBonus;
    stats.roundsAlive++;
    stats.maxStreak = Math.max(stats.maxStreak, Math.abs(this.streak));
    orig();
  };

  const origBuyXP = p.buyXP.bind(p);
  p.buyXP = function () {
    const result = origBuyXP();
    if (result) stats.goldSpentXP += 4;
    return result;
  };

  const origReroll = p.shop.reroll.bind(p.shop);
  p.shop.reroll = function () {
    const result = origReroll();
    if (result) stats.goldSpentReroll += 2;
    return result;
  };

  const origBuy = p.shop.buy.bind(p.shop);
  p.shop.buy = function (slotIdx) {
    const name = this.offers[slotIdx];
    const def  = name ? CARD_DEFS.find(d => d.name === name) : null;
    const card = origBuy(slotIdx);
    if (card && def) stats.goldSpentCards += CARD_COSTS[def.tier];
    return card;
  };

  const origCombine = p.runCombines.bind(p);
  p.runCombines = function () {
    const before = p.board.allCards.length;
    origCombine();
    const after  = p.board.allCards.length;
    if (after < before) stats.combinesMade += Math.floor((before - after) / 2);
  };

  const roundLog = [];

  while (!run.isOver()) {
    p.earnIncome();
    p.shop.refresh();
    policy(p, run.round + 1);

    const snapshot = {
      level: p.level,
      cards: p.board.active.length,
      gold:  p.gold,
      synergies: p.board.synergyLine(),
      score: p.board.calcScore({ round: run.round + 1, player: p }),
    };

    const result = run.runBattle();
    roundLog.push({ round: run.round, snapshot, result });
  }

  return { stats, roundLog, run };
}

// ── Print report ──────────────────────────────────────────────────────────────

const seed   = parseInt(process.argv[2]) || 1;
const policy = process.argv[3] || 'greedy';

const { stats, roundLog, run } = diagGame(seed, policy);
const p = run.player;

console.log(`\n=== RUN TRACE (seed=${seed}, policy=${policy}) ===\n`);
console.log(`${'Rnd'.padStart(3)} ${'Lv'.padStart(2)} ${'Crd'.padStart(3)} ${'Gld'.padStart(4)} ${'Score'.padStart(6)}  vs  ${'Opp'.padStart(6)}  ${'Name'.padEnd(16)} ${'W/L'.padStart(3)} ${'HP'.padStart(4)}  Synergies`);
console.log('─'.repeat(95));
for (const entry of roundLog) {
  const s = entry.snapshot;
  const r = entry.result;
  const wl = r.won ? 'W' : 'L';
  console.log(
    `${String(entry.round).padStart(3)} ${String(s.level).padStart(2)} ${String(s.cards).padStart(3)} ${String(s.gold).padStart(4)} ${String(s.score).padStart(6)}  vs  ${String(r.opponentScore).padStart(6)}  ${r.opponent.padEnd(16)} ${wl.padStart(3)} ${String(r.hpAfter).padStart(4)}  ${s.synergies}`
  );
}

console.log(`\n=== ECONOMY ===\n`);
console.log(`Base income:    ${stats.baseTotal}g`);
console.log(`Interest:       +${stats.interestTotal}g`);
console.log(`Streak bonus:   +${stats.streakTotal}g`);
console.log(`Spent on cards: ${stats.goldSpentCards}g`);
console.log(`Spent on XP:    ${stats.goldSpentXP}g`);
console.log(`Spent on rerolls: ${stats.goldSpentReroll}g`);
console.log(`Max streak:     ${stats.maxStreak}`);
console.log(`Combines made:  ${stats.combinesMade}`);

console.log(`\n=== OUTCOME ===\n`);
console.log(`Rounds survived: ${run.round}`);
console.log(`Final HP:        ${p.hp}`);
console.log(`Record:          ${p.wins}W ${p.losses}L`);
console.log(`Final level:     ${p.level}`);
console.log(`Status:          ${p.hp > 0 ? 'SURVIVED' : 'eliminated'}\n`);
