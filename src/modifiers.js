'use strict';

// Phase 31-B.1 — Run Modifiers.
//
// One modifier is drawn at run start (Run constructor). It persists for the
// whole run as a roguelike-variance lever: some constrain (Hothouse, Lean
// Economy), some buff (Bull Market, Cheap Plinths), some reshape (Curator's
// Pet, Blind Tasting). They are *random*, not adaptive — the design intent
// is run-to-run distinctness, not difficulty smoothing.
//
// Hook surface (all optional; absence = no-op):
//   init(run)                      — return per-run state stored on run.modifierState
//   noInterest                     — Player.earnIncome skips interest
//   interestCap                    — overrides MAX_INTEREST for this run (Bull Market shrinks to 3)
//   incomePerRound                 — Player.earnIncome adds this each round
//   benchTaxAbove / benchTaxPer    — deducts benchTaxPer ✦ per bench card above benchTaxAbove
//   chapterStipend / chapterStipendRounds — Player.earnIncome adds at listed round-starts
//   refitPremium                   — refit.js peek/swap/promote costs add this many ✦
//   plinthDiscount                 — Player.plinthCost subtracts this (min 1g)
//   rerollFree                     — Shop.rerollCost returns 0
//   shopSize                       — Shop initial fill + refresh respect this
//   cardScoreMult(card, state)     — multiplied into board.calcBaseBreakdown perCard
//   autoSellRounds                 — at end of these rounds, lowest-scoring active sold for 0g
//   redrawFinaleAtRound            — at start of this round, run.headJudges[3] is re-drawn
//   hideSlate                      — web/app.js skips the run-start slate reveal
//   tagAmplify                     — judges.js tag-tastes spread per-card mults: m' = 1 + (m-1)*amp
//
// Calibration target: per-modifier greedy survival should land in ~25–50%
// (band 30–45% with ±5pp tolerance per modifier). Mean across all 12 should
// stay in band — a single high-difficulty modifier is acceptable variance.

const SPECIES = ['Plasmic', 'Sporal', 'Chitinous', 'Crystalline', 'Abyssal'];

const MODIFIERS = [
  {
    id: 'hothouse',
    name: 'Hothouse Anomaly',
    description: 'Sporal specimens score ×0.5 this run.',
    flavor: 'The atmospheric controls are misbehaving. The fungal exhibits suffer.',
    cardScoreMult(card) { return card.species === 'Sporal' ? 0.5 : 1.0; },
  },
  {
    id: 'lean_economy',
    name: 'Lean Economy',
    description: 'No interest income this run.',
    flavor: 'The Salon is auditing endowments. Save who you must, but money no longer breeds money.',
    noInterest: true,
  },
  {
    id: 'popup_salon',
    name: 'Pop-up Salon',
    description: 'The Specimen Market has 4 slots instead of 8.',
    flavor: 'A travelling exhibition: fewer choices, faster decisions.',
    shopSize: 4,
  },
  {
    id: 'brutal_curation',
    name: 'Brutal Curation',
    description: 'After R6, R12, and R18, your lowest-scoring active specimen is dismissed for 0 ✦.',
    flavor: 'The chief curator is a known sadist. Underperformers do not stay long.',
    autoSellRounds: [6, 12, 18],
  },
  {
    id: 'bull_market',
    name: 'Bull Market',
    description: 'Re-rolling the Specimen Market is free. Interest caps at 3 ✦/round (max 15 ✦ banked).',
    flavor: 'Brokers are flooding the market. Browse freely — but money won\'t sit still.',
    rerollFree: true,
    interestCap: 3,
  },
  {
    id: 'cheap_plinths',
    name: 'Patron Subsidy',
    description: 'Exhibit upgrades cost 4 ✦ less (min 1 ✦).',
    flavor: 'A wealthy patron is footing the carpentry bill.',
    plinthDiscount: 4,
  },
  {
    id: 'generous_patron',
    name: 'Generous Patron',
    description: '+2 ✦ each round. The patron deducts 2 ✦/round per bench specimen above 5.',
    flavor: 'A reliable benefactor — and a tidy one. Hoarding the menagerie costs.',
    incomePerRound: 2,
    benchTaxAbove: 5,
    benchTaxPer:   2,
  },
  {
    id: 'patron_stipend',
    name: "Curator's Stipend",
    description: '+6 ✦ at the start of each new chapter (R9, R17, R24). Refit actions cost +3 ✦ each.',
    flavor: 'The Salon top-ups your account between exhibitions — and bills you back through the carpenters.',
    chapterStipend: 6,
    chapterStipendRounds: [9, 17, 24],
    refitPremium: 3,
  },
  {
    id: 'blind_tasting',
    name: 'Blind Tasting',
    description: 'Judges revealed only at the start of each chapter — no advance slate.',
    flavor: 'The roster is sealed. You meet each judge as they take their seat.',
    hideSlate: true,
  },
  {
    id: 'late_reveal',
    name: 'Late Reveal',
    description: 'The Grand Finale judge is re-rolled at R20 — different from the slate.',
    flavor: 'The committee has had a falling-out. Tonight\'s closing critic is anyone\'s guess.',
    redrawFinaleAtRound: 20,
  },
  {
    id: 'tag_amplification',
    name: 'Discerning Eye',
    description: 'Aesthetic-tag judges have amplified preferences (×1.5 spread). Tagged matches and mismatches both hit harder.',
    flavor: 'These judges have spent the offseason refining their tastes. Shameful or sublime — nothing in between.',
    tagAmplify: 1.5,
  },
  {
    id: 'curators_pet',
    name: "Curator's Pet",
    description: 'One species favored ×1.25; another scorned ×0.7 (revealed at run start).',
    flavor: 'The chief curator has feelings. Strong, peculiar feelings.',
    init(run) {
      const pool = SPECIES.slice();
      const fi = Math.floor(run.rng() * pool.length);
      const favored = pool.splice(fi, 1)[0];
      const pi = Math.floor(run.rng() * pool.length);
      const scorned = pool.splice(pi, 1)[0];
      return { favored, scorned };
    },
    cardScoreMult(card, state) {
      if (!state) return 1.0;
      if (card.species === state.favored) return 1.25;
      if (card.species === state.scorned) return 0.7;
      return 1.0;
    },
  },
];

function getAvailableModifiers() {
  return MODIFIERS;
}

function getModifier(id) {
  return MODIFIERS.find(m => m.id === id) || null;
}

// Pick one modifier uniformly at random from the pool. The rng must be the
// run rng so seeds are reproducible.
function pickModifier(rng) {
  const pool = getAvailableModifiers();
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

module.exports = { MODIFIERS, getAvailableModifiers, getModifier, pickModifier };
