'use strict';

// Balance notes (Phase 5, 2026-04-17):
// - Abyssal base scores reduced to match Plasmics (were highest of any species)
// - Sporal + Crystalline base scores raised so they're competitive individual picks
// - Abyssal synergy changed: no lone-abyssal bonus; requires 2 to activate (high payoff)
//   This kills the "always include 1 Abyssal" reflex and rewards committing to the build
// - Sporal synergy tightened: multipliers boosted slightly to compensate for lower card count
// - Crystalline synergy flat bonuses raised to reward the deep 6-crystalline build
//
// Async redesign, Phase 1 (2026-04-19):
// - `class` stubbed to null on every def; class synergies removed (to be patched as
//   pure data in a later pass per spec).
// - `passive` placeholder on every def; populated in Phase 4.
//
// Phase 4 (2026-04-19):
// - Every card gets a `passive = { description, axis, eval(card, ctx) }`.
// - `ctx = { round, boardState, speciesCounts (effective), self, player }`.
// - `eval` returns one shape interpreted by the pipeline:
//     { flat: N }                  → Axis 2 or 3 (stage 1/2)
//     { mult: X }                  → Axis 4 / 6 / 6+4 (per-card mult)
//     { auraFlat|auraMult, target } → Axis 8 (board-level, target = 'all'|'other'|'self'|'other-<Sp>'|'all-<Sp>')
//     { baseOverride: N }          → Sprangus (stage 0)
//     { tickGold: N }              → Axis 7 (Sporvik, consumed post-battle)
//     { sellBonus: N }             → Axis 7 (Sharzak, consumed on sell)
// Gloopir / Krombax / Geodorb phantom species are resolved inside
// effectiveSpeciesCounts() in board.js, not via `eval`.

const STAR_MULT = [null, 1, 2.5, 6];

const CARD_DEFS = [
  // Tier 1 — cost 3g
  {
    name: 'Blorpax', species: 'Plasmic', class: 'Sullen', tier: 1, baseScore: 50,
    passive: {
      description: '+20 per other Plasmic on board',
      axis: 2,
      eval(card, ctx) {
        const n = ctx.boardState.active.filter(c => c !== card && c.species === 'Plasmic').length;
        return { flat: 20 * n };
      },
    },
  },
  {
    name: 'Slurvin', species: 'Plasmic', class: 'Livid', tier: 1, baseScore: 55,
    passive: {
      description: '+25% score per 2★+ unit on board (self counts)',
      axis: 4,
      eval(card, ctx) {
        const n = ctx.boardState.active.filter(c => c.stars >= 2).length;
        return { mult: 1 + 0.25 * n };
      },
    },
  },
  {
    name: 'Sporvik', species: 'Sporal', class: 'Sullen', tier: 1, baseScore: 52,
    passive: {
      description: '+3 gold per round while on board',
      axis: 7,
      eval() { return { tickGold: 3 }; },
    },
  },
  {
    name: 'Skraxle', species: 'Chitinous', class: 'Shy', tier: 1, baseScore: 45,
    passive: {
      description: '+10 per round since bought',
      axis: 3,
      eval(card) { return { flat: 10 * (card.roundsSinceBought || 0) }; },
    },
  },
  {
    name: 'Vexborg', species: 'Chitinous', class: 'Giddy', tier: 1, baseScore: 42,
    passive: {
      description: '+18 per other Chitinous on board',
      axis: 2,
      eval(card, ctx) {
        const n = ctx.boardState.active.filter(c => c !== card && c.species === 'Chitinous').length;
        return { flat: 18 * n };
      },
    },
  },
  {
    name: 'Krombax', species: 'Crystalline', class: 'Shy', tier: 1, baseScore: 48,
    passive: {
      description: 'Counts as 2 Crystallines for synergy',
      axis: 5,
      eval() { return {}; },
    },
  },
  {
    name: 'Sharzak', species: 'Crystalline', class: 'Giddy', tier: 1, baseScore: 44,
    passive: {
      description: 'Selling returns +3g',
      axis: 7,
      eval() { return { sellBonus: 3 }; },
    },
  },
  {
    name: 'Vorzak', species: 'Abyssal', class: 'Livid', tier: 1, baseScore: 50,
    passive: {
      description: '×1.5 score if only Abyssal on board',
      axis: 4,
      eval(card, ctx) {
        return { mult: (ctx.speciesCounts.Abyssal || 0) === 1 ? 1.5 : 1 };
      },
    },
  },

  // Tier 2 — cost 4g
  {
    name: 'Gloopir', species: 'Plasmic', class: 'Shy', tier: 2, baseScore: 80,
    passive: {
      description: 'Counts as 2 Plasmics for synergy',
      axis: 5,
      eval() { return {}; },
    },
  },
  {
    name: 'Murborg', species: 'Plasmic', class: 'Giddy', tier: 2, baseScore: 85,
    passive: {
      description: '+80 if highest-scoring Plasmic on board',
      axis: 2,
      eval(card, ctx) {
        const plasmics = ctx.boardState.active.filter(c => c.species === 'Plasmic');
        const scoreOf = c => Math.round(c.baseScore * STAR_MULT[c.stars]);
        const myScore = scoreOf(card);
        const maxScore = Math.max(...plasmics.map(scoreOf));
        return { flat: myScore >= maxScore ? 80 : 0 };
      },
    },
  },
  {
    name: 'Puffzak', species: 'Sporal', class: 'Shy', tier: 2, baseScore: 82,
    passive: {
      description: 'All other Sporals +15% score',
      axis: 8,
      eval() { return { auraMult: 1.15, target: 'other-Sporal' }; },
    },
  },
  {
    name: 'Molborg', species: 'Sporal', class: 'Livid', tier: 2, baseScore: 88,
    passive: {
      description: '×1.5 score while Sporal synergy (2+) is active',
      axis: 4,
      eval(card, ctx) {
        return { mult: (ctx.speciesCounts.Sporal || 0) >= 2 ? 1.5 : 1 };
      },
    },
  },
  {
    name: 'Clattorb', species: 'Chitinous', class: 'Giddy', tier: 2, baseScore: 78,
    passive: {
      description: 'Inactive rounds 1–5. +50% score from round 6+',
      axis: 6,
      eval(card, ctx) {
        if ((ctx.round || 0) < 6) return {};
        return { mult: 1.5 };
      },
    },
  },
  {
    name: 'Lithvorn', species: 'Crystalline', class: 'Sullen', tier: 2, baseScore: 76,
    passive: {
      description: '×1.5 score if 4+ Crystallines on board',
      axis: 4,
      eval(card, ctx) {
        return { mult: (ctx.speciesCounts.Crystalline || 0) >= 4 ? 1.5 : 1 };
      },
    },
  },
  {
    name: 'Blinxorp', species: 'Abyssal', class: 'Livid', tier: 2, baseScore: 82,
    passive: {
      description: '+25 per round since bought',
      axis: 3,
      eval(card) { return { flat: 25 * (card.roundsSinceBought || 0) }; },
    },
  },

  // Tier 3 — cost 5g
  {
    name: 'Fluxnob', species: 'Plasmic', class: 'Pompous', tier: 3, baseScore: 130,
    passive: {
      description: 'All other Plasmics +20% score',
      axis: 8,
      eval() { return { auraMult: 1.20, target: 'other-Plasmic' }; },
    },
  },
  {
    name: 'Sprangus', species: 'Sporal', class: 'Pompous', tier: 3, baseScore: 132,
    passive: {
      description: 'All Sporals +30% score. Sprangus\'s own base score becomes 0.',
      axis: 8,
      eval() { return { baseOverride: 0, auraMult: 1.30, target: 'all-Sporal' }; },
    },
  },
  {
    name: 'Scrithnab', species: 'Chitinous', class: 'Sullen', tier: 3, baseScore: 125,
    passive: {
      description: '+15 per round since bought (max +300)',
      axis: 3,
      eval(card) {
        return { flat: Math.min(300, 15 * (card.roundsSinceBought || 0)) };
      },
    },
  },
  {
    name: 'Geodorb', species: 'Crystalline', class: 'Pompous', tier: 3, baseScore: 122,
    passive: {
      description: 'Counts as +1 of any one species you have 3+ of (alphabetical tiebreak)',
      axis: 5,
      eval() { return {}; },
    },
  },
  {
    name: 'Squorble', species: 'Abyssal', class: 'Pompous', tier: 3, baseScore: 135,
    passive: {
      description: 'Rounds 1–9: ×0.5 score. Round 10+: ×2 score.',
      axis: '6+4',
      eval(card, ctx) {
        return { mult: (ctx.round || 0) >= 10 ? 2.0 : 0.5 };
      },
    },
  },
];

const CARD_COSTS  = { 1: 3,  2: 4,  3: 5  };

const SYNERGIES = {
  Plasmic: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'species', type: 'flat', value: 48 };
      if (count >= 2) return { target: 'species', type: 'flat', value: 26 };
      return null;
    },
  },
  Sporal: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'all', type: 'mult', value: 1.27 };
      if (count >= 2) return { target: 'all', type: 'mult', value: 1.17 };
      return null;
    },
  },
  Chitinous: {
    thresholds: [2, 3],
    getBonus(count) {
      if (count >= 3) return { target: 'species', type: 'flat', value: 40 };
      if (count >= 2) return { target: 'species', type: 'flat', value: 22 };
      return null;
    },
  },
  Crystalline: {
    thresholds: [2, 4, 6],
    getBonus(count) {
      if (count >= 6) return { target: 'species', type: 'flat', value: 78 };
      if (count >= 4) return { target: 'species', type: 'flat', value: 42 };
      if (count >= 2) return { target: 'species', type: 'flat', value: 18 };
      return null;
    },
  },
  Abyssal: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'species', type: 'mult', value: 1.90 };
      if (count >= 2) return { target: 'species', type: 'mult', value: 1.60 };
      return null;
    },
  },
};

// 5 classes × 4 cards each. Each class spans 3–4 species to force multi-species boards.
// Shy:     Gloopir(Plasmic), Puffzak(Sporal), Krombax(Crystalline), Skraxle(Chitinous)
// Livid:   Vorzak(Abyssal), Blinxorp(Abyssal), Slurvin(Plasmic), Molborg(Sporal)
// Giddy:   Vexborg(Chitinous), Clattorb(Chitinous), Murborg(Plasmic), Sharzak(Crystalline)
// Sullen:  Sporvik(Sporal), Lithvorn(Crystalline), Blorpax(Plasmic), Scrithnab(Chitinous)
// Pompous: Fluxnob(Plasmic), Sprangus(Sporal), Geodorb(Crystalline), Squorble(Abyssal)
const CLASS_SYNERGIES = {
  Shy: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'class', type: 'flat', value: 16 };
      if (count >= 2) return { target: 'class', type: 'flat', value: 8 };
      return null;
    },
  },
  Livid: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'class', type: 'mult', value: 1.28 };
      if (count >= 2) return { target: 'class', type: 'mult', value: 1.12 };
      return null;
    },
  },
  Giddy: {
    thresholds: [2, 3],
    getBonus(count) {
      if (count >= 3) return { target: 'class', type: 'flat', value: 14 };
      if (count >= 2) return { target: 'class', type: 'flat', value: 6 };
      return null;
    },
  },
  Sullen: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'all', type: 'mult', value: 1.05 };
      if (count >= 2) return { target: 'all', type: 'mult', value: 1.02 };
      return null;
    },
  },
  Pompous: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'class', type: 'mult', value: 1.30 };
      if (count >= 2) return { target: 'class', type: 'mult', value: 1.13 };
      return null;
    },
  },
};

const CLASSES = ['Shy', 'Livid', 'Giddy', 'Sullen', 'Pompous'];

let _nextId = 1;
function createCard(defName, stars = 1) {
  const def = CARD_DEFS.find(d => d.name === defName);
  if (!def) throw new Error(`Unknown card: ${defName}`);
  return { ...def, stars, _id: _nextId++, roundsSinceBought: 0, items: [] };
}

module.exports = { CARD_DEFS, CARD_COSTS, STAR_MULT, SYNERGIES, CLASS_SYNERGIES, CLASSES, createCard };
