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

  const status = r.survived ? 'SURVIVED' : 'eliminated';
  console.log(`Rounds survived: ${r.roundsSurvived}`);
  console.log(`Final HP:        ${r.hp}  (${status})`);
  console.log(`Record:          ${r.wins}W ${r.losses}L`);
  console.log(`Final level:     ${r.level}`);
  if (r.augments.length) {
    console.log(`Augments:        ${r.augments.join(', ')}`);
  }
  console.log();

  console.log('Opponent history:');
  console.log(`${'Rnd'.padStart(3)}  ${'You'.padStart(6)}  ${'Opp'.padStart(6)}  ${'Name'.padEnd(16)} ${'W/L'.padStart(3)} ${'HP'.padStart(4)}`);
  console.log('─'.repeat(50));
  for (const h of r.opponentHistory) {
    console.log(
      `${String(h.round).padStart(3)}  ${String(h.playerScore).padStart(6)}  ${String(h.opponentScore).padStart(6)}  ${h.opponent.padEnd(16)} ${(h.won ? 'W' : 'L').padStart(3)} ${String(h.hpAfter).padStart(4)}`
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
  console.log(`Per-battle winrate:  ${(r.winRate * 100).toFixed(1)}%`);
  console.log(`Avg final HP:        ${r.avgFinalHp.toFixed(1)}`);
  const survivors = r.results.filter(x => x.survived).length;
  console.log(`Run survival rate:   ${(survivors / n * 100).toFixed(1)}%  (${survivors}/${n})\n`);

  // HP distribution (final)
  const buckets = [0, 10, 25, 50, 75, 100];
  console.log('Final HP distribution:');
  for (let i = 0; i < buckets.length - 1; i++) {
    const lo = buckets[i], hi = buckets[i + 1];
    const count = r.results.filter(x => x.hp >= lo && x.hp < hi).length;
    const pct = (count / n * 100).toFixed(1);
    console.log(`  ${String(lo).padStart(3)}–${String(hi - 1).padStart(3)} HP: ${pad(count, 3)} runs  (${pct}%)`);
  }
  const at100 = r.results.filter(x => x.hp === 100).length;
  if (at100 > 0) console.log(`  100    HP: ${pad(at100, 3)} runs  (${(at100 / n * 100).toFixed(1)}%)`);
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
