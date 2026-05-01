'use strict';

// Calibration helper for Phase 31-B.2 (Exhibition Refit).
// For greedy AI runs, capture player.gold at each chapter boundary
// (immediately after R8/R16/R23 scoring, before next-chapter income).
//
// Usage: node scripts/profile_chapter_gold.js [n] [seedStart]
// Default: n=300, seedStart=1.

const { Run, ROUND_CAP } = require('../src/game');
const { POLICIES, resolveAugmentPick, resolveItemPick } = require('../src/sim');
const { mulberry32 } = require('../src/utils');

// Re-implement the sim loop locally so we can snapshot gold mid-run.
// (sim.js doesn't export resolveAugmentPick/resolveItemPick, but we don't
// need archetype policies — greedy doesn't pick augments / items by index.)
function runGameWithGoldSnapshots(seed, policyName = 'greedy') {
  const rng = mulberry32(seed);
  const run = new Run(rng, 1.0);
  const policy = POLICIES[policyName] || POLICIES.greedy;
  const snapshots = { afterR8: null, afterR16: null, afterR23: null, afterFinale: null };

  while (!run.isOver()) {
    const nextRound = run.round + 1;
    if (run.pendingAugment()) resolveAugmentPick(run, null);
    if (run.pendingItem()) resolveItemPick(run, null);

    run.player.earnIncome();
    run.player.shop.refresh();
    policy(run.player, nextRound, run);
    run.runBattle();

    // After scoring: snapshot gold at chapter boundaries.
    const r = run.round;
    if (r === 8 && snapshots.afterR8 === null) snapshots.afterR8 = run.player.gold;
    if (r === 16 && snapshots.afterR16 === null) snapshots.afterR16 = run.player.gold;
    if (r === 23 && snapshots.afterR23 === null) snapshots.afterR23 = run.player.gold;
    if (r === 24 && snapshots.afterFinale === null) snapshots.afterFinale = run.player.gold;
  }

  return {
    seed,
    rounds: run.round,
    survived: run.round >= ROUND_CAP,
    lives: run.lives,
    snapshots,
  };
}

function summarize(label, values) {
  const vs = values.filter(v => v !== null).sort((a, b) => a - b);
  if (!vs.length) return `${label}: no data`;
  const sum = vs.reduce((a, b) => a + b, 0);
  const mean = sum / vs.length;
  const median = vs[Math.floor(vs.length / 2)];
  const p25 = vs[Math.floor(vs.length * 0.25)];
  const p75 = vs[Math.floor(vs.length * 0.75)];
  const min = vs[0];
  const max = vs[vs.length - 1];
  return `${label}: n=${vs.length}  mean=${mean.toFixed(1)}  med=${median}  p25=${p25}  p75=${p75}  min=${min}  max=${max}`;
}

function main() {
  const n = parseInt(process.argv[2] || '300', 10);
  const seedStart = parseInt(process.argv[3] || '1', 10);
  const policy = process.argv[4] || 'greedy';

  const r8 = [], r16 = [], r23 = [], rFinale = [];
  let survived = 0;

  for (let i = 0; i < n; i++) {
    const res = runGameWithGoldSnapshots(seedStart + i, policy);
    if (res.survived) survived++;
    if (res.snapshots.afterR8 !== null) r8.push(res.snapshots.afterR8);
    if (res.snapshots.afterR16 !== null) r16.push(res.snapshots.afterR16);
    if (res.snapshots.afterR23 !== null) r23.push(res.snapshots.afterR23);
    if (res.snapshots.afterFinale !== null) rFinale.push(res.snapshots.afterFinale);
  }

  console.log(`\nPolicy: ${policy} | seedStart=${seedStart} | n=${n}`);
  console.log(`Survived ROUND_CAP: ${survived}/${n} (${(survived * 100 / n).toFixed(1)}%)\n`);
  console.log(summarize('Gold after R8 (Chapter 1 end)  ', r8));
  console.log(summarize('Gold after R16 (Chapter 2 end) ', r16));
  console.log(summarize('Gold after R23 (Chapter 3 end) ', r23));
  console.log(summarize('Gold after R24 (Finale done)   ', rFinale));
}

main();
