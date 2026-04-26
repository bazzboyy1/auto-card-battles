'use strict';

// Balance harness. Runs each policy N times with consecutive seeds, extracts
// the per-round player score from opponentHistory, and reports score ceilings,
// medians, and survival rates. Used to surface dead paths and dominant builds.

const { runGame, POLICIES } = require('./sim');
const { AUGMENT_DEFS }     = require('./augments');
const { ITEM_DEFS }        = require('./items');

// Summary stats for a sorted-ascending array of numbers.
function dist(sorted) {
  const n = sorted.length;
  if (!n) return { n: 0, min: 0, p10: 0, p50: 0, p90: 0, max: 0, mean: 0 };
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const pick = q => sorted[Math.min(n - 1, Math.max(0, Math.floor(q * n)))];
  return {
    n,
    min:  sorted[0],
    p10:  pick(0.10),
    p50:  pick(0.50),
    p90:  pick(0.90),
    max:  sorted[n - 1],
    mean,
  };
}

// Extract score summary per seed: final-round score, peak score across the run,
// and survival flag. Games that die early have very few rounds.
function summariseRun(result) {
  const hist = result.battleHistory || [];
  let peak = 0, final = 0;
  for (const h of hist) {
    if (h.playerScore > peak) peak = h.playerScore;
    final = h.playerScore;
  }
  return {
    seed:            result.seed,
    finalScore:      final,
    peakScore:       peak,
    roundsSurvived:  result.roundsSurvived,
    survived:        result.survived,
    wins:            result.wins,
    losses:          result.losses,
  };
}

// Run n seeds for a given policy and return { policy, peakDist, finalDist,
// survivalRate, winRate, sample:[...per-run summaries] }.
function analysePolicy(policyName, n, seedStart = 1, opts = {}) {
  const runs = [];
  for (let i = 0; i < n; i++) {
    const r = runGame(seedStart + i, policyName, opts);
    runs.push(summariseRun(r));
  }

  const finalSorted = runs.map(r => r.finalScore).sort((a, b) => a - b);
  const peakSorted  = runs.map(r => r.peakScore).sort((a, b) => a - b);
  const roundsSorted = runs.map(r => r.roundsSurvived).sort((a, b) => a - b);

  const survivors = runs.filter(r => r.survived).length;
  const totalRounds = runs.reduce((s, r) => s + r.roundsSurvived, 0);
  const totalWins   = runs.reduce((s, r) => s + r.wins, 0);

  return {
    policy:        policyName,
    n,
    finalDist:     dist(finalSorted),
    peakDist:      dist(peakSorted),
    roundsDist:    dist(roundsSorted),
    survivalRate:  survivors / n,
    winRate:       totalRounds > 0 ? totalWins / totalRounds : 0,
    sample:        runs,
  };
}

// Run all policies listed (default: all) and return an array of analyses.
function sweep(n = 500, policies = null, seedStart = 1) {
  const names = policies || Object.keys(POLICIES);
  return names.map(p => analysePolicy(p, n, seedStart));
}

// Targeted max-unit builds. Each combines a base policy with forced grants
// (specific item on specific card) and forced augment picks. Used to measure
// the ceiling of specific "dominant build" hypotheses the user has raised.
const BUILDS = [
  {
    name:   'blinxorp-max',
    policy: 'abyssal-stack',
    opts: {
      grants: [['Blinxorp', 'Recurve Bow']],              // Growth Serum: ×2 Axis-3
      picks:  { 3: { augmentId: 'TimeDilation' } },       // Acclimatisation Program: +5/round global
    },
  },
  {
    name:   'fluxnob-max',
    policy: 'plasmic-stack',
    opts: {
      grants: [['Fluxnob', "Zeke's Herald"]],             // Pheromone Diffuser: +15% aura to others
      picks:  { 3: { augmentId: 'CrossTraining' } },      // +8% global mult per active synergy
    },
  },
  {
    name:   'squorble-max',
    policy: 'abyssal-stack',
    opts: {
      grants: [['Squorble', "Giant's Belt"]],             // Rarity Certificate: ×1.2–2.0 mult
      picks:  { 3: { augmentId: 'EarlyBird' } },          // Round-timing passive activates 3 rounds early
    },
  },
  {
    name:   'scrithnab-max',
    policy: 'chitinous-stack',
    opts: {
      grants: [['Scrithnab', 'Recurve Bow']],             // Growth Serum on capped Axis-3 hero
      picks:  { 3: { augmentId: 'TimeDilation' } },
    },
  },
  {
    name:   'economy-max',
    policy: 'economy-stack',
    opts: {
      picks:    { 3: { augmentId: 'Tycoon' }, 12: { augmentId: 'MidasTouch' } },
      forceItem: 'Hextech Gunblade',  // Market Tag: +2g/round per unit; MidasTouch doubles to +4g
    },
  },
];

// Run all BUILDS and return analyses keyed by build name.
function sweepBuilds(n = 500, seedStart = 1) {
  return BUILDS.map(b => {
    const a = analysePolicy(b.policy, n, seedStart, b.opts);
    a.policy = b.name; // override for table readability
    return a;
  });
}

// Top-k seeds by peakScore for a given analysis. Useful for digging into what
// the best runs looked like.
function topSeeds(analysis, k = 5) {
  return [...analysis.sample]
    .sort((a, b) => b.peakScore - a.peakScore)
    .slice(0, k);
}

// Text table formatter for a sweep result.
function formatSweep(analyses) {
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  const lines = [];

  lines.push('Policy                 n    peak.max  peak.p90  peak.p50  final.p50  surv%   win%');
  lines.push('-'.repeat(82));
  for (const a of analyses) {
    const pd = a.peakDist, fd = a.finalDist;
    lines.push(
      pad(a.policy, 22) +
      padL(a.n, 4) + '  ' +
      padL(pd.max.toFixed(0), 8) + '  ' +
      padL(pd.p90.toFixed(0), 8) + '  ' +
      padL(pd.p50.toFixed(0), 8) + '  ' +
      padL(fd.p50.toFixed(0), 9) + '  ' +
      padL((a.survivalRate * 100).toFixed(1), 5) + '  ' +
      padL((a.winRate * 100).toFixed(1), 5)
    );
  }
  return lines.join('\n');
}

// ── Exploit sweeps ────────────────────────────────────────────────────────────

// For each augment: force-pick it at R3 (first augment round), let AI decide R7/R12.
// Measures ceiling of "this augment is always available and always taken."
function sweepAugments(n = 200, seedStart = 1) {
  const baseline = analysePolicy('greedy', n, seedStart);
  const results = AUGMENT_DEFS.map(aug => {
    const a = analysePolicy('greedy', n, seedStart, { picks: { 3: { augmentId: aug.id } } });
    return { name: aug.name, id: aug.id, survivalRate: a.survivalRate, delta: a.survivalRate - baseline.survivalRate };
  });
  results.sort((a, b) => b.delta - a.delta);
  return { baseline: baseline.survivalRate, results };
}

// For each item: force-pick it at every item round (R5, R10, R15).
// Measures ceiling of "player always drafts this item and spreads it across units."
function sweepItems(n = 200, seedStart = 1) {
  const baseline = analysePolicy('greedy', n, seedStart);
  const results = ITEM_DEFS.map(item => {
    const a = analysePolicy('greedy', n, seedStart, { forceItem: item.id });
    return { name: item.name, id: item.id, survivalRate: a.survivalRate, delta: a.survivalRate - baseline.survivalRate };
  });
  results.sort((a, b) => b.delta - a.delta);
  return { baseline: baseline.survivalRate, results };
}

const EXPLOIT_FLAG_PP = 8;

function formatExploitSweep(sweepResult, label) {
  const pad  = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  const lines = [
    `── ${label} (baseline greedy: ${(sweepResult.baseline * 100).toFixed(1)}%) ──`,
    pad('Name', 30) + padL('surv%', 6) + '  ' + padL('delta', 6) + '  note',
    '─'.repeat(50),
  ];
  for (const r of sweepResult.results) {
    const flag = r.delta * 100 >= EXPLOIT_FLAG_PP ? '  ⚠ FLAG' : '';
    lines.push(
      pad(r.name, 30) +
      padL((r.survivalRate * 100).toFixed(1), 6) + '  ' +
      padL((r.delta >= 0 ? '+' : '') + (r.delta * 100).toFixed(1), 6) +
      flag
    );
  }
  return lines.join('\n');
}

module.exports = { analysePolicy, sweep, sweepBuilds, BUILDS, summariseRun, dist, topSeeds, formatSweep, sweepAugments, sweepItems, formatExploitSweep };
