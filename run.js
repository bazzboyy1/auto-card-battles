'use strict';

const { runGame, batchSim } = require('./src/sim');
const { sweep, sweepBuilds, analysePolicy, topSeeds, formatSweep } = require('./src/balance');
const { pad } = require('./src/utils');

const rawArgs = process.argv.slice(2);

// ── Flag extraction (anywhere in argv) ───────────────────────────────────────

// --grant "Card:Item,Card:Item"
let grantsArg = null;
// --pick  "3:AugmentId,7:AugmentId:CardName:Species,12:AugmentId"
let pickArg   = null;

const args = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--grant') { grantsArg = rawArgs[++i] || ''; }
  else if (rawArgs[i] === '--pick') { pickArg = rawArgs[++i] || ''; }
  else args.push(rawArgs[i]);
}

// Parse grants: "Axe:Claymore,Viper:Recurve Bow" → [[cardName, itemId], ...]
const grants = grantsArg
  ? grantsArg.split(',').map(s => s.split(':').map(t => t.trim())).filter(p => p.length === 2 && p[0] && p[1])
  : null;

// Parse picks: "3:IronWill,7:Overflow,12:Shapeshifter:Viper:Warrior"
// Each token: "<round>:<augmentId>[:<cardName>:<species>]"
// Grammar: round integer, augmentId CamelCase (no spaces), optional cardName + species.
const picks = {};
if (pickArg) {
  for (const token of pickArg.split(',')) {
    const parts = token.trim().split(':');
    const round = parseInt(parts[0]);
    if (!round || parts.length < 2) continue;
    const augmentId = parts[1].trim();
    if (!augmentId) continue;
    picks[round] = { augmentId };
    if (parts.length >= 4) {
      picks[round].cardName = parts[2].trim();
      picks[round].species  = parts[3].trim();
    }
  }
}

const cmd  = args[0] || 'play';

if (cmd === 'play') {
  const seed   = parseInt(args[1]) || 1;
  const policy = args[2] || 'greedy';
  const hasOpts = grants || Object.keys(picks).length;
  console.log(`\n=== Auto-Card Battles — seed=${seed}  policy=${policy}${grants ? `  grants=${grants.length}` : ''}${Object.keys(picks).length ? `  picks=${JSON.stringify(picks)}` : ''} ===\n`);

  const r = runGame(seed, policy, { ...(grants ? { grants } : {}), picks });

  const hist   = r.battleHistory || [];
  const livesEnd = hist.length ? hist[hist.length - 1].livesAfter : 3;
  const status = r.survived ? 'SURVIVED' : 'eliminated';
  console.log(`Rounds survived: ${r.roundsSurvived}`);
  console.log(`Lives remaining: ${livesEnd}  (${status})`);
  console.log(`Record:          ${r.wins}W ${r.losses}L`);
  console.log(`Final level:     ${r.level}`);
  if (r.augments.length) {
    console.log(`Augments:        ${r.augments.join(', ')}`);
  }
  console.log();

  console.log('Battle history:');
  console.log(`${'Rnd'.padStart(3)}  ${'Score'.padStart(6)}  ${'Target'.padStart(7)}  ${'W/L'.padStart(3)}  ${'Lives'.padStart(5)}  ${'Judge'.padEnd(14)}`);
  console.log('─'.repeat(55));
  for (const h of hist) {
    const pref = h.qualified ? `✓` : ' ';
    console.log(
      `${String(h.round).padStart(3)}  ${String(h.playerScore).padStart(6)}  ${String(h.target).padStart(7)}  ${(h.passed ? 'W' : 'L').padStart(3)}  ${String(h.livesAfter).padStart(5)}  ${pref}${(h.judgeId || '').padEnd(13)}`
    );
  }
  console.log();

} else if (cmd === 'sim') {
  const n      = parseInt(args[1]) || 50;
  const policy = args[2] || 'greedy';
  const seed   = parseInt(args[3]) || 1;
  console.log(`\n=== Batch sim — n=${n}  policy=${policy}  seed=${seed} ===\n`);

  const r = batchSim(n, policy, seed);
  console.log(`Avg rounds survived: ${r.avgRoundsSurvived.toFixed(1)}`);
  console.log(`Per-round pass rate: ${(r.winRate * 100).toFixed(1)}%`);
  const survivors = r.results.filter(x => x.survived).length;
  console.log(`Run survival rate:   ${(survivors / n * 100).toFixed(1)}%  (${survivors}/${n})`);
  const livesLost = r.results.map(x => {
    const h = x.battleHistory || [];
    return 3 - (h.length ? h[h.length - 1].livesAfter : 3);
  });
  const avgLost = livesLost.reduce((s, v) => s + v, 0) / n;
  console.log(`Avg lives lost:      ${avgLost.toFixed(2)}\n`);

  // Lives remaining distribution (final)
  console.log('Lives remaining at run end:');
  for (let lives = 3; lives >= 0; lives--) {
    const count = livesLost.filter(v => 3 - v === lives).length;
    console.log(`  ${lives} lives: ${pad(count, 3)} runs  (${(count / n * 100).toFixed(1)}%)`);
  }
  console.log();

} else if (cmd === 'balance') {
  // node run.js balance [n] [seed]  — sweep all policies + targeted builds
  const n    = parseInt(args[1]) || 300;
  const seed = parseInt(args[2]) || 1;
  console.log(`\n=== Balance sweep — n=${n}/policy  seedStart=${seed} ===\n`);

  const policyAnalyses = sweep(n, null, seed);
  const buildAnalyses  = sweepBuilds(n, seed);

  console.log('── Policies (no forced grants/picks) ──');
  console.log(formatSweep(policyAnalyses));
  console.log();
  console.log('── Targeted builds (forced grants + augment picks) ──');
  console.log(formatSweep(buildAnalyses));
  console.log();

  // Show top-3 peak seeds per analysis to help trace dominant builds.
  for (const a of [...policyAnalyses, ...buildAnalyses]) {
    const top = topSeeds(a, 3);
    console.log(`${a.policy}: top 3 peak seeds  →  ` +
      top.map(t => `${t.seed}:${t.peakScore}`).join('  '));
  }
  console.log();

} else {
  console.log('Usage:');
  console.log('  node run.js play    [seed] [policy] [--grant "Card:Item,..."] [--pick "R:AugId,..."]');
  console.log('  node run.js sim     [n] [policy] [seed]');
  console.log('  node run.js balance [n] [seed]           — sweep all policies + targeted builds');
  console.log('  policies: greedy | random | wide');
  console.log('            plasmic-stack | sporal-stack | chitinous-stack | crystalline-stack | abyssal-stack');
  console.log('            shy-stack | livid-stack | giddy-stack | sullen-stack | pompous-stack');
  console.log('            abyssal-sporal');
  console.log('');
  console.log('--pick format: "3:IronWill,7:Overflow,12:Shapeshifter:Viper:Warrior"');
  console.log('  Shapeshifter: append :CardName:Species for sub-pick');
}
