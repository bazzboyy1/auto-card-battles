'use strict';

// Per-taste pass rate diagnostic for the recalibrated curve.
// Walks each game's history and groups (passed, failed) by the active judge's taste.

const { batchSim } = require('../src/sim');
const { JUDGES, TASTES } = require('../src/judges');

const n     = parseInt(process.argv[2]) || 300;
const seed  = parseInt(process.argv[3]) || 1;

const r = batchSim(n, 'greedy', seed);

const judgeById = {};
for (const j of JUDGES) judgeById[j.id] = j;

const stats = {}; // tasteId -> { played, passed }
for (const game of r.results) {
  for (const h of game.battleHistory || []) {
    const j = judgeById[h.judgeId];
    if (!j) continue;
    const t = j.taste;
    if (!stats[t]) stats[t] = { played: 0, passed: 0 };
    stats[t].played++;
    if (h.passed) stats[t].passed++;
  }
}

console.log(`\n=== Per-taste pass rate  (n=${n} seed=${seed}) ===\n`);
console.log('Taste              Played  Pass%');
console.log('-----------------  ------  -----');
const order = Object.keys(stats).sort((a, b) => (stats[b].passed / stats[b].played) - (stats[a].passed / stats[a].played));
for (const t of order) {
  const s = stats[t];
  const pct = (s.passed / s.played * 100).toFixed(1);
  console.log(`${t.padEnd(17)}  ${String(s.played).padStart(6)}  ${pct.padStart(5)}`);
}
console.log();
