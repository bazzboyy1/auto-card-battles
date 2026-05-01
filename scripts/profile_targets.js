'use strict';

// One-shot calibration helper. Runs a batch greedy sim and reports:
//   - per-round pass rate
//   - per-round avg score / target / margin (median + p25/p75)
//   - run survival
// Used to recalibrate the per-round target curve in src/game.js.

const { batchSim } = require('../src/sim');

const n     = parseInt(process.argv[2]) || 300;
const seed  = parseInt(process.argv[3]) || 1;
const policy = process.argv[4] || 'greedy';

const r = batchSim(n, policy, seed);

const ROUNDS = 24;
const passByRound = Array(ROUNDS).fill(0);
const playedByRound = Array(ROUNDS).fill(0);
const scoresByRound = Array.from({ length: ROUNDS }, () => []);
const targetsByRound = Array.from({ length: ROUNDS }, () => []);
const ratiosByRound = Array.from({ length: ROUNDS }, () => []);

for (const game of r.results) {
  const hist = game.battleHistory || [];
  for (const h of hist) {
    const i = h.round - 1;
    if (i < 0 || i >= ROUNDS) continue;
    playedByRound[i]++;
    if (h.passed) passByRound[i]++;
    scoresByRound[i].push(h.playerScore);
    targetsByRound[i].push(h.target);
    if (h.target > 0) ratiosByRound[i].push(h.playerScore / h.target);
  }
}

const survivors = r.results.filter(x => x.survived).length;
const med = a => {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const pct = (a, p) => {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

console.log(`\n=== Per-round profile  (n=${n} seed=${seed} policy=${policy}) ===\n`);
console.log(`Run survival: ${(survivors / n * 100).toFixed(1)}%  (${survivors}/${n})`);
console.log(`Per-round pass rate: ${(r.winRate * 100).toFixed(1)}%`);
console.log();
console.log('Rnd  Played  Pass%   AvgTgt    AvgScr  MedScr/Tgt  p25     p75');
console.log('---  ------  -----   ------    ------  ----------  ------  ------');
for (let i = 0; i < ROUNDS; i++) {
  const played = playedByRound[i];
  if (played === 0) {
    console.log(`${String(i + 1).padStart(3)}    0`);
    continue;
  }
  const passPct = (passByRound[i] / played * 100).toFixed(1);
  const avgT = avg(targetsByRound[i]).toFixed(0);
  const avgS = avg(scoresByRound[i]).toFixed(0);
  const ratios = ratiosByRound[i];
  const medR = med(ratios).toFixed(2);
  const p25R = pct(ratios, 0.25).toFixed(2);
  const p75R = pct(ratios, 0.75).toFixed(2);
  console.log(
    `${String(i + 1).padStart(3)}  ${String(played).padStart(6)}  ${passPct.padStart(5)}   ${avgT.padStart(6)}    ${avgS.padStart(6)}     ${medR.padStart(5)}     ${p25R.padStart(5)}   ${p75R.padStart(5)}`
  );
}
console.log();
