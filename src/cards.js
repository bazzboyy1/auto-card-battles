'use strict';

const { isUnlocked } = require('./achievements');

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
    flavor: 'Blorpaxes ooze a translucent slime that other Plasmics instinctively bathe in. The cluster effect is, frankly, more impressive than any of them alone.',
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
    flavor: 'Slurvins become visibly furious in the presence of superior specimens. Judges find their seething plasma glow striking. They do not take this well.',
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
    flavor: 'Sporviks continuously weep a glistening amber fluid of significant pharmaceutical value. You pocket the proceeds. Sporviks don\'t notice.',
    passive: {
      description: '+3 gold per round while on board',
      axis: 7,
      eval() { return { tickGold: 3 }; },
    },
  },
  {
    name: 'Skraxle', species: 'Chitinous', class: 'Shy', tier: 1, baseScore: 45,
    flavor: 'Skraxles shed their carapace regularly. Each new shell is more grotesque than the last. Give them time.',
    passive: {
      description: '+10 per round since bought',
      axis: 3,
      eval(card) { return { flat: 10 * (card.roundsSinceBought || 0) }; },
    },
  },
  {
    name: 'Vexborg', species: 'Chitinous', class: 'Giddy', tier: 1, baseScore: 42,
    flavor: 'In the presence of their own kind, Vexborgs enter a frenzied clicking display that gets louder and more elaborate with every additional Chitinous. Earplugs are provided.',
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
    name: 'Krombax', species: 'Crystalline', class: 'Shy', tier: 1, baseScore: 62,
    flavor: 'Krombaxes refract light to project a perfect crystal duplicate of themselves at all times. Judges count both. Krombaxes find this mortifying.',
    passive: {
      description: 'Counts as 2 Crystallines for synergy',
      axis: 5,
      eval() { return {}; },
    },
  },
  {
    name: 'Sharzak', species: 'Crystalline', class: 'Giddy', tier: 1, baseScore: 62,
    flavor: 'Sharzaks continuously shed gem-quality crystal fragments. Whoever buys one always finds a few lodged in their pockets afterwards.',
    passive: {
      description: '+14 per other Giddy specimen on board',
      axis: 2,
      eval(card, ctx) {
        const n = ctx.boardState.active.filter(c => c !== card && c.class === 'Giddy').length;
        return { flat: 14 * n };
      },
    },
  },
  {
    name: 'Vorzak', species: 'Abyssal', class: 'Livid', tier: 1, baseScore: 50,
    flavor: 'Vorzaks are deeply territorial and reach peak menace when they have no competition for the title of most horrifying thing in the room.',
    passive: {
      description: '×1.5 score if only Abyssal on board',
      axis: 4,
      eval(card, ctx) {
        return { mult: (ctx.speciesCounts.Abyssal || 0) === 1 ? 1.5 : 1 };
      },
    },
  },

  {
    name: 'Phlorbex', species: 'Sporal', class: 'Shy', tier: 1, baseScore: 54,
    flavor: 'Phlorbexes shed microscopic spore clouds that cause nearby Sporals to flourish aggressively. Exhibitors report that Phlorbexes seem genuinely embarrassed by the effect.',
    passive: {
      description: 'Other Sporal specimens on board +10 flat score',
      axis: 8,
      eval() { return { auraFlat: 10, target: 'other-Sporal' }; },
    },
  },

  // Tier 2 — cost 4g
  {
    name: 'Gloopir', species: 'Plasmic', class: 'Shy', tier: 2, baseScore: 80,
    flavor: 'Gloopirs are technically two Plasmics that never successfully separated. Both are embarrassed about it. Judges count them as two.',
    passive: {
      description: 'Counts as 2 Plasmics for synergy',
      axis: 5,
      eval() { return {}; },
    },
  },
  {
    name: 'Murborg', species: 'Plasmic', class: 'Giddy', tier: 2, baseScore: 85,
    flavor: 'When Murborgs sense they are the most impressive Plasmic on display, they inflate their plasma sacs to roughly twice their normal size. Nobody asked them to do this.',
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
    flavor: 'Puffzaks constantly shed enhancement spores that cause nearby Sporals to bloom more aggressively. They have absolutely no idea they\'re doing this.',
    passive: {
      description: 'All other Sporals +15% score',
      axis: 8,
      eval() { return { auraMult: 1.15, target: 'other-Sporal' }; },
    },
  },
  {
    name: 'Molborg', species: 'Sporal', class: 'Livid', tier: 2, baseScore: 88,
    flavor: 'Molborgs feed on ambient spore clouds. In a room full of Sporals they gorge themselves to a truly unpleasant size, which judges score very favourably.',
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
    flavor: 'Clattorbs\' exoskeletons need time to dry after transport. Once fully hardened they achieve a glossy sheen that commands serious scores. The wait is non-negotiable.',
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
    flavor: 'Lithvorns\' crystal networks resonate when surrounded by enough of their kind, producing a frequency that makes judges deeply uncomfortable and score them very highly.',
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
    flavor: 'Blinxorps take a while to fully emerge from their transport containers. By round ten, most of the exhibition staff have filed formal complaints.',
    passive: {
      description: '+25 per round since bought (max +300)',
      axis: 3,
      cap: 300,
      eval(card) { return { flat: 25 * (card.roundsSinceBought || 0) }; },
    },
  },

  {
    name: 'Grazwick', species: 'Abyssal', class: 'Sullen', tier: 2, baseScore: 82, locked: true, id: 'grazwick',
    flavor: 'Grazwicks spend the first seven rounds in a state of profound withdrawal. By round eight, something shifts. Judges are advised not to comment on this.',
    passive: {
      description: 'Inactive rounds 1–7. From round 8: ×1.8 score',
      axis: 6,
      eval(card, ctx) {
        if ((ctx.round || 0) < 8) return {};
        return { mult: 1.8 };
      },
    },
  },
  {
    name: 'Morblax', species: 'Chitinous', class: 'Giddy', tier: 2, baseScore: 83, locked: true, id: 'morblax',
    flavor: 'Morblaxes are impossible to calm down when surrounded by emotionally elevated specimens. The clicking gets faster. Nobody is quite sure what it means.',
    passive: {
      description: '+15 per Giddy specimen on board (including self)',
      axis: 2,
      eval(card, ctx) {
        const n = ctx.boardState.active.filter(c => c.class === 'Giddy').length;
        return { flat: 15 * n };
      },
    },
  },
  {
    name: 'Zorbrath', species: 'Crystalline', class: 'Livid', tier: 2, baseScore: 90, locked: true, id: 'zorbrath',
    flavor: 'Zorbrath crystal matrices are uniquely reactive to emotional frequencies. In the presence of both Crystalline resonance and Livid energy they achieve a threat level that judges find extremely compelling.',
    passive: {
      description: '×1.4 score if both Crystalline-2 and Livid-2 synergies are active',
      axis: 4,
      eval(card, ctx) {
        const crystalline = (ctx.speciesCounts || {}).Crystalline || 0;
        const lividCount  = (ctx.classCounts  || {}).Livid      || 0;
        return { mult: (crystalline >= 2 && lividCount >= 2) ? 1.4 : 1 };
      },
    },
  },

  // Tier 3 — cost 5g
  {
    name: 'Fluxnob', species: 'Plasmic', class: 'Pompous', tier: 3, baseScore: 130,
    flavor: 'Fluxnobs emit a plasma pulse that forces nearby Plasmics to sync their oscillation patterns. They consider themselves very important. The other Plasmics resent this but do glow better.',
    passive: {
      description: 'All other Plasmics +20% score',
      axis: 8,
      eval() { return { auraMult: 1.20, target: 'other-Plasmic' }; },
    },
  },
  {
    name: 'Sprangus', species: 'Sporal', class: 'Pompous', tier: 3, baseScore: 132,
    flavor: 'Spranguses release so many enhancement spores that they have nothing left for themselves. They stand on their pedestals looking frankly deflated while everything around them thrives.',
    passive: {
      description: 'All Sporals +30% score. Sprangus\'s own base score becomes 0.',
      axis: 8,
      eval() { return { baseOverride: 0, auraMult: 1.30, target: 'all-Sporal' }; },
    },
  },
  {
    name: 'Scrithnab', species: 'Chitinous', class: 'Sullen', tier: 3, baseScore: 125,
    flavor: 'Scrithnabs moult continuously, each shell more elaborate than the last, until further growth becomes structurally inadvisable.',
    passive: {
      description: '+15 per round since bought (max +300)',
      axis: 3,
      cap: 300,
      eval(card) {
        return { flat: 15 * (card.roundsSinceBought || 0) };
      },
    },
  },
  {
    name: 'Geodorb', species: 'Crystalline', class: 'Pompous', tier: 3, baseScore: 122,
    flavor: 'Geodorbs have no fixed crystal structure. They slowly reconfigure their lattice to match whatever they\'re surrounded by most. They do this in their sleep, which is somehow worse.',
    passive: {
      description: 'Counts as +1 of any one species you have 3+ of (alphabetical tiebreak)',
      axis: 5,
      eval() { return {}; },
    },
  },
  {
    name: 'Squorble', species: 'Abyssal', class: 'Pompous', tier: 3, baseScore: 135,
    flavor: 'Squorbles spend the first nine rounds looking like something that washed up on a beach. Then, without warning, they do something the judges will not describe in their official notes but award maximum marks for.',
    passive: {
      description: 'Rounds 1–9: ×0.5 score. Round 10+: ×2 score.',
      axis: '6+4',
      eval(card, ctx) {
        return { mult: (ctx.round || 0) >= 10 ? 2.0 : 0.5 };
      },
    },
  },

  // --- Phase 24 locked cards (gated by achievements) ---
  {
    id: 'vornix',
    name: 'Vornix', species: 'Abyssal', class: 'Livid', tier: 1, baseScore: 50, locked: true,
    flavor: 'Vornixes establish dominance through sustained atmospheric menace. With four or more Abyssals competing, the hostility reaches measurable levels. Judges wear protective lenses.',
    passive: {
      description: '+24 per other Abyssal on board',
      axis: 2,
      eval(card, ctx) {
        const n = ctx.boardState.active.filter(c => c !== card && c.species === 'Abyssal').length;
        return { flat: 24 * n };
      },
    },
  },
  {
    id: 'zephrix',
    name: 'Zephrix', species: 'Sporal', class: 'Giddy', tier: 2, baseScore: 82, locked: true,
    flavor: 'Zephrixae are natural sycophants who perform best in the presence of perceived wealth. Provide adequate funding and they will put on a show. Do not ask how they know about your finances.',
    passive: {
      description: '+3g per round while on board; +40 flat score if holding 20+ gold at judging',
      axis: 2,
      eval(card, ctx) {
        const gold = ctx.player ? (ctx.player.gold || 0) : 0;
        return { tickGold: 3, flat: gold >= 20 ? 40 : 0 };
      },
    },
  },
  {
    id: 'prismora',
    name: 'Prismora', species: 'Crystalline', class: 'Shy', tier: 3, baseScore: 124, locked: true,
    flavor: 'Prismoras refract light differently depending on how many exceptional specimens share their space. With three or more Tier 3 exhibits present they produce a spectrum that has not yet been formally classified.',
    passive: {
      description: '×(1 + 0.15 per T3 card on board, including self)',
      axis: 4,
      eval(card, ctx) {
        const t3Count = ctx.boardState.active.filter(c => c.tier === 3).length;
        return { mult: 1 + 0.15 * t3Count };
      },
    },
  },
  {
    id: 'klothrix',
    name: 'Klothrix', species: 'Chitinous', class: 'Shy', tier: 3, baseScore: 120, locked: true,
    flavor: 'Klothrixae do not open their outer carapace for judges they have not met. Given sufficient time in the same exhibition, something remarkable is revealed. It takes a while.',
    passive: {
      description: '+30 per round since bought (max +450)',
      axis: 3,
      cap: 450,
      eval(card) { return { flat: 30 * (card.roundsSinceBought || 0) }; },
    },
  },
  {
    id: 'stellorb',
    name: 'Stellorb', species: 'Abyssal', class: 'Pompous', tier: 3, baseScore: 126, locked: true,
    flavor: 'Stellorbs carry themselves with an air of inevitability. In the sixteenth round, surrounded by sufficient Abyssal company, they begin radiating something that fills three pages of the exhibition incident log.',
    passive: {
      description: '×1.5 score if Abyssal-4 synergy active and round 16+',
      axis: '6+4',
      eval(card, ctx) {
        const abyssal = (ctx.speciesCounts || {}).Abyssal || 0;
        return { mult: (abyssal >= 4 && (ctx.round || 0) >= 16) ? 1.5 : 1 };
      },
    },
  },

  // --- Phase 25 locked cards ---
  {
    id: 'vorbex',
    name: 'Vorbex', species: 'Plasmic', class: 'Sullen', tier: 2, baseScore: 84, locked: true,
    flavor: "Vorbexes are essentially very confident plasma. Individually they do little. Surrounded by enough of their kin, something extraordinary — and frankly unsettling — occurs.",
    passive: {
      description: '×1.5 score if Plasmic-4 synergy active',
      axis: 4,
      eval(card, ctx) {
        return { mult: (ctx.speciesCounts.Plasmic || 0) >= 4 ? 1.5 : 1 };
      },
    },
  },
  {
    id: 'omnorb',
    name: 'Omnorb', species: 'Abyssal', class: 'Shy', tier: 3, baseScore: 128, locked: true,
    flavor: 'Omnorbs have adapted to survive in any atmospheric condition. Judges describe their presence as "a reminder that the galaxy does not care about your strategy."',
    passive: {
      description: '×1.8 score if 4+ unique species on active board',
      axis: 4,
      eval(card, ctx) {
        const uniqueSpecies = new Set(ctx.boardState.active.map(c => c.species)).size;
        return { mult: uniqueSpecies >= 4 ? 1.8 : 1 };
      },
    },
  },
];

const CARD_COSTS  = { 1: 3,  2: 4,  3: 5  };

const SYNERGIES = {
  Plasmic: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'species', type: 'flat', value: 58 };
      if (count >= 2) return { target: 'species', type: 'flat', value: 32 };
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
      if (count >= 6) return { target: 'species', type: 'flat', value: 110 };
      if (count >= 4) return { target: 'species', type: 'flat', value: 70 };
      if (count >= 2) return { target: 'species', type: 'flat', value: 28 };
      return null;
    },
  },
  Abyssal: {
    thresholds: [2, 4],
    getBonus(count) {
      if (count >= 4) return { target: 'species', type: 'mult', value: 1.90 };
      if (count >= 2) return { target: 'species', type: 'mult', value: 1.40 };
      return null;
    },
  },
};

// Class distribution (Phase 25). Free cards always in pool; locked cards require achievement unlock.
// Shy:     Gloopir(Plasmic T2), Puffzak(Sporal T2), Krombax(Crystalline T1), Skraxle(Chitinous T1),
//          Phlorbex(Sporal T1), [Prismora(Crystalline T3) locked], [Klothrix(Chitinous T3) locked],
//          [Omnorb(Abyssal T3) locked]
// Livid:   Vorzak(Abyssal T1), Blinxorp(Abyssal T2), Slurvin(Plasmic T1), Molborg(Sporal T2),
//          [Zorbrath(Crystalline T2) locked], [Vornix(Abyssal T1) locked]
// Giddy:   Vexborg(Chitinous T1), Clattorb(Chitinous T2), Murborg(Plasmic T2), Sharzak(Crystalline T1),
//          [Morblax(Chitinous T2) locked], [Zephrix(Sporal T2) locked]
// Sullen:  Sporvik(Sporal T1), Lithvorn(Crystalline T2), Blorpax(Plasmic T1), Scrithnab(Chitinous T3),
//          [Grazwick(Abyssal T2) locked], [Vorbex(Plasmic T2) locked]
// Pompous: Fluxnob(Plasmic T3), Sprangus(Sporal T3), Geodorb(Crystalline T3), Squorble(Abyssal T3),
//          [Stellorb(Abyssal T3) locked]
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
      if (count >= 4) return { target: 'class', type: 'mult', value: 1.16 };
      if (count >= 2) return { target: 'class', type: 'mult', value: 1.08 };
      return null;
    },
  },
  Giddy: {
    thresholds: [2, 3],
    getBonus(count) {
      if (count >= 3) return { target: 'class', type: 'flat', value: 72 };
      if (count >= 2) return { target: 'class', type: 'flat', value: 30 };
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

// Returns the subset of CARD_DEFS available in the current session.
// Locked cards are excluded until their achievement reward id is persisted.
// In Node.js (sim/balance) isUnlocked always returns false — locked cards stay out of pools.
function getAvailableCards() {
  return CARD_DEFS.filter(d => !d.locked || isUnlocked(d.id));
}

module.exports = { CARD_DEFS, CARD_COSTS, STAR_MULT, SYNERGIES, CLASS_SYNERGIES, CLASSES, createCard, getAvailableCards };
