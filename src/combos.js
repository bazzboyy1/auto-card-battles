'use strict';

// Phase 30 — Pair-combos.
// A pair-combo is a labeled flat bonus that fires when two specific named
// cards sit immediately adjacent on the active row. Pair-combos are *flats
// added to each participant's own score*, never multipliers and never auras.
// Multiplicative cross-card effects are the deprecation line from Phase 28
// (judge tastes do all the multiplicative work now).
//
// Each pair fires at most once per round. If two copies of card A sit on
// either side of a single B (A B A), only the leftmost adjacency counts.
// This keeps the math legible: "two cards next to each other = combo."
//
// `when(ctx)` is optional. Used by Squorble<->Stellorb to gate to round 10+.

const COMBOS = [
  {
    a: 'Vorzak', b: 'Slurvin',
    bonus: 40,
    label: 'Twin Fury',
    flavor: 'Vorzak and Slurvin escalate each other into a feedback loop of pure menace.',
  },
  {
    a: 'Lithvorn', b: 'Geodorb',
    bonus: 60,
    label: 'Crystal Resonance',
    flavor: 'Lithvorn and Geodorb harmonize at a frequency that visibly disturbs the judges.',
  },
  {
    a: 'Molborg', b: 'Sporvik',
    bonus: 50,
    label: 'Spore Feast',
    flavor: 'Molborg gorges on the cloud Sporvik perpetually emits.',
  },
  {
    a: 'Vexborg', b: 'Clattorb',
    bonus: 50,
    label: 'Carapace Lattice',
    flavor: 'Vexborg and Clattorb interlock into a structurally impressive arrangement.',
  },
  {
    a: 'Squorble', b: 'Stellorb',
    bonus: 120,
    label: 'Abyssal Coronation',
    flavor: 'Late in the run, Squorble and Stellorb together produce something the judges officially decline to describe.',
    when: (ctx) => (ctx.round || 0) >= 10,
  },
  {
    a: 'Blorpax', b: 'Vorbex',
    bonus: 35,
    label: 'Plasma Loop',
    flavor: 'Blorpax and Vorbex form a self-reinforcing plasma circuit.',
  },
];

// Build a name->index map for the canonical pair lookup.
function pairKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}
const COMBOS_BY_PAIR = new Map();
for (const c of COMBOS) {
  COMBOS_BY_PAIR.set(pairKey(c.a, c.b), c);
}

// Scan an active row and return one entry per fired combo:
//   { combo, leftIdx, rightIdx, bonus }
// Each pair fires at most once even if multiple adjacent occurrences exist.
function findCombosOnBoard(active, ctx = {}) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < active.length - 1; i++) {
    const left  = active[i];
    const right = active[i + 1];
    if (!left || !right) continue;
    const combo = COMBOS_BY_PAIR.get(pairKey(left.name, right.name));
    if (!combo) continue;
    if (seen.has(combo)) continue;
    if (typeof combo.when === 'function' && !combo.when(ctx)) continue;
    seen.add(combo);
    out.push({ combo, leftIdx: i, rightIdx: i + 1, bonus: combo.bonus });
  }
  return out;
}

module.exports = { COMBOS, findCombosOnBoard };
