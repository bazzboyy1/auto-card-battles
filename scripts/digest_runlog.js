'use strict';

// Compact runlog digest. Reads a raw RunLog JSON and emits a model-friendly
// Markdown summary on stdout. The verbose offers/scoreLines/bench snapshots
// in the source file balloon to ~9k lines per 24-round run; this digest
// targets ~200 lines while preserving every decision and per-round outcome
// needed for design analysis.
//
// Usage:
//   node scripts/digest_runlog.js path/to/runlog.json
//   node scripts/digest_runlog.js path/to/runlog.json > digest.md

const fs   = require('fs');
const path = require('path');

function fmtPct(n) {
  if (!Number.isFinite(n)) return '?';
  return (n * 100).toFixed(0) + '%';
}

function topCards(active) {
  if (!Array.isArray(active)) return '';
  return active
    .slice()
    .sort((a, b) => (b.scoreFinal || 0) - (a.scoreFinal || 0))
    .slice(0, 3)
    .map(c => `${c.name}${c.stars > 1 ? '★'.repeat(c.stars) : ''}=${c.scoreFinal || 0}`)
    .join(' · ');
}

function speciesMix(active) {
  if (!Array.isArray(active)) return '';
  const cnt = {};
  for (const c of active) if (c && c.species) cnt[c.species] = (cnt[c.species] || 0) + 1;
  return Object.entries(cnt)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${s.slice(0, 3)}:${n}`)
    .join(',');
}

function tagMix(active) {
  if (!Array.isArray(active)) return '';
  const cnt = {};
  for (const c of active) {
    if (!c) continue;
    const tags = (c.tags || []).slice();
    // include item-granted tags (Phase 31-B.3 — "Aesthetic: X" item ids)
    for (const it of c.items || []) {
      const m = /^Aesthetic:\s*(\w+)/.exec(it);
      if (m) tags.push(m[1]);
    }
    for (const t of tags) cnt[t] = (cnt[t] || 0) + 1;
  }
  if (!Object.keys(cnt).length) return '';
  return Object.entries(cnt)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}:${n}`)
    .join(',');
}

function summarizeEvents(events) {
  if (!Array.isArray(events)) return { actions: [], augment: null, item: null, refit: null, rival: null };
  const buys = [];
  const sells = [];
  const rerolls = [];
  const plinths = [];
  const combines = [];
  const moves = [];
  const reorders = [];
  const itemAttaches = [];
  let augment = null;
  let item = null;
  const refitActs = [];
  let rival = null;

  for (const e of events) {
    switch (e.t) {
      case 'buy':           buys.push(e.card); break;
      case 'sell':          sells.push(e.card); break;
      case 'reroll':        rerolls.push(e.cost); break;
      case 'plinth':        plinths.push(`${e.levelFrom}→${e.levelTo}`); break;
      case 'combine':       combines.push(`${e.card}→${e.stars}★`); break;
      case 'move':          moves.push(`${e.card}:${e.from}→${e.to}`); break;
      case 'reorder':       reorders.push(`${e.from}→${e.to}`); break;
      case 'item_attach':   itemAttaches.push(`${e.itemId}→${e.cardName}`); break;
      case 'augment_picked': augment = e.id; break;
      case 'item_picked':   item = e.id; break;
      case 'refit_peek':    refitActs.push('peek'); break;
      case 'refit_swap':    refitActs.push(`swap(+${e.acquired || '?'})`); break;
      case 'refit_promote': refitActs.push(`promote(${e.name}→${e.toStars}★)`); break;
      case 'rival_round':   rival = e; break;
      default: break;
    }
  }

  const actions = [];
  if (buys.length)         actions.push(`buy:[${buys.join(',')}]`);
  if (combines.length)     actions.push(`combine:[${combines.join(',')}]`);
  if (sells.length)        actions.push(`sell:[${sells.join(',')}]`);
  if (rerolls.length)      actions.push(`reroll×${rerolls.length}(${rerolls.reduce((a, b) => a + b, 0)}g)`);
  if (plinths.length)      actions.push(`plinth:${plinths.join(',')}`);
  if (moves.length)        actions.push(`move×${moves.length}`);
  if (reorders.length)     actions.push(`reorder×${reorders.length}`);
  if (itemAttaches.length) actions.push(`attach:[${itemAttaches.join(',')}]`);

  return { actions, augment, item, refit: refitActs, rival };
}

function digestRound(r) {
  const round = r.round;
  const judge = r.judge ? `${r.judge.name}${r.judge.preference ? `[${r.judge.preference}]` : ''}` : '?';
  const tgt   = r.target ? r.target.normal : (r.result && r.result.target);
  const isCrit = r.target && r.target.isCritique;
  const score = r.result ? r.result.playerScore : null;
  const ratio = (score && tgt) ? score / tgt : null;
  const passed = r.result ? (r.result.passed ? '✓' : '✗') : '?';
  const lifeGained = r.result && r.result.lifeGained ? ' +life' : '';
  const ready = r.readyState || {};
  const cards = topCards(ready.active);
  const sp    = speciesMix(ready.active);
  const tg    = tagMix(ready.active);
  const lvl   = ready.level != null ? `L${ready.level}` : '';
  const gold  = ready.gold != null ? `${ready.gold}g` : '';
  const ev    = summarizeEvents(r.events);

  const lines = [];
  const head = `R${String(round).padStart(2)}${isCrit ? '*' : ' '} ${judge} | tgt ${tgt} → ${score} (${fmtPct(ratio)}) ${passed}${lifeGained}`;
  lines.push(head);
  const board = `   board: ${cards} | ${sp}${tg ? ' | tags ' + tg : ''} | ${lvl} ${gold}`;
  lines.push(board);
  if (ev.augment) lines.push(`   augment: ${ev.augment}`);
  if (ev.item)    lines.push(`   item:    ${ev.item}`);
  if (ev.actions.length) lines.push(`   acts:    ${ev.actions.join(' | ')}`);
  if (ev.refit && ev.refit.length) lines.push(`   refit:   ${ev.refit.join(', ')}`);
  if (ev.rival && (ev.rival.picks || []).length) {
    lines.push(`   rival:   picks=[${ev.rival.picks.join(',')}] aggro=${ev.rival.aggro?.toFixed?.(2) ?? '?'} gold=${ev.rival.gold ?? '?'}`);
  }
  return lines.join('\n');
}

function buildDigest(log) {
  const m  = log.meta || {};
  const fr = m.finalResult || {};
  const out = [];

  out.push(`# Runlog digest — v${m.version || '?'} seed=${m.seed} diff=${m.difficulty?.id || '?'}`);
  out.push('');
  out.push('## Meta');
  out.push(`- Started:    ${m.startedAt}`);
  out.push(`- Duration:   ${m.durationMs ? Math.round(m.durationMs / 1000) + 's' : '?'}`);
  out.push(`- Modifier:   ${m.modifier ? `${m.modifier.name} (${m.modifier.id})${m.modifier.state ? ' state=' + JSON.stringify(m.modifier.state) : ''}` : '— (legacy log: not captured)'}`);
  out.push(`- Rival:      ${m.rival ? `${m.rival.name} (${m.rival.personalityId})` : '— (legacy log: not captured)'}`);
  out.push('');
  out.push('## Result');
  out.push(`- Survived:           ${fr.survived ? 'YES' : 'NO'}`);
  out.push(`- Rounds completed:   ${fr.roundsCompleted}`);
  out.push(`- Lives remaining:    ${fr.livesRemaining}`);
  out.push(`- Peak appraisal:     ${fr.peakScore}`);
  out.push(`- Exhibition rating:  ${fr.exhibitionRating}${fr.isNewBest ? ' (NEW BEST)' : ''}`);
  out.push(`- Final level:        ${fr.finalLevel}`);
  out.push(`- Augments taken:     ${(fr.augmentsTaken || []).join(', ') || '—'}`);
  out.push(`- Unlocks this run:   ${(fr.unlocksThisRun || []).join(', ') || '—'}`);
  out.push('');

  // Refit aggregate
  const refitSpend = [];
  for (const r of log.rounds || []) {
    for (const e of r.events || []) {
      if (e.t === 'refit_closed') {
        refitSpend.push(`R${e.round}: ${e.spent}g (${e.peeked ? 'peeked' : 'no peek'}${e.promoted ? ', promoted' : ''})`);
      }
    }
  }
  if (refitSpend.length) {
    out.push('## Refits');
    for (const s of refitSpend) out.push(`- ${s}`);
    out.push('');
  }

  // Per-round timeline
  out.push('## Rounds');
  out.push('```');
  for (const r of log.rounds || []) {
    out.push(digestRound(r));
  }
  out.push('```');

  return out.join('\n');
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/digest_runlog.js path/to/runlog.json');
    process.exit(1);
  }
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const log = JSON.parse(raw);
  const md  = buildDigest(log);
  process.stdout.write(md + '\n');
}

if (require.main === module) main();

module.exports = { buildDigest, digestRound, summarizeEvents };
