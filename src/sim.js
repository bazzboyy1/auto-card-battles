'use strict';

const { CARD_DEFS, CARD_COSTS, STAR_MULT } = require('./cards');
const { Run, ROUND_CAP, ROUND_TARGETS, MAX_INTEREST, INTEREST_PER } = require('./game');
const { attachItem } = require('./items');
const { AUGMENT_DEFS } = require('./augments');
const { mulberry32 } = require('./utils');

// ── Helpers ───────────────────────────────────────────────────────────────────

// When board is full (active+bench = 14 cards) and the player has significant
// overflow gold, sell the lowest-EV bench card. Models the user's late-game
// pattern of selling marginal bench fodder to make room for combine targets
// pulled from rerolls. Only sells if the worst bench card is clearly inferior
// to the active board's median — otherwise the bench is already curated.
// Returns true if a sell happened (caller should retry the buy).
function freeBenchIfStuck(player, bias) {
  if (!player.board.isFull()) return false;
  if (player.gold < INTEREST_CAP_GOLD + 5) return false;
  const benchCards = player.board.bench
    .map(c => ({ card: c, ev: c.baseScore * STAR_MULT[c.stars] }))
    .filter(x => !(x.card.items && x.card.items.length))
    .filter(x => !(bias && bias.species && x.card.species === bias.species && x.card.stars >= 2))
    .sort((a, b) => a.ev - b.ev);
  if (!benchCards.length) return false;
  const worst = benchCards[0];
  const activeMedian = player.board.active.length
    ? [...player.board.active].map(c => c.baseScore * STAR_MULT[c.stars]).sort((a, b) => a - b)[Math.floor(player.board.active.length / 2)]
    : 0;
  if (worst.ev >= activeMedian * 0.7) return false;
  const value = player.sell(worst.card._id);
  return value > 0;
}

// Sort all cards by EV; protect item-bearing cards from bench eviction.
// Carriers get a 500-pt bonus so they always fill active slots before bare units.
function optimizeBoard(player) {
  const all = [...player.board.active, ...player.board.bench];
  all.sort((a, b) => {
    const evA = a.baseScore * STAR_MULT[a.stars] + (a.items && a.items.length ? 500 : 0);
    const evB = b.baseScore * STAR_MULT[b.stars] + (b.items && b.items.length ? 500 : 0);
    return evB - evA;
  });
  player.board.active = [];
  player.board.bench  = [];
  for (const card of all) {
    if (player.board.canAddToActive())    player.board.active.push(card);
    else if (player.board.canAddToBench()) player.board.bench.push(card);
  }
}

// ── Augment AI ────────────────────────────────────────────────────────────────

// Contextual scoring of an augment vs current board state.
// `player._augmentBias` is set per-strategy (warrior-stack / demon-arc) so those
// policies prefer their archetype augments at pick rounds.
function scoreAugment(augId, player) {
  const active = player.board.active;
  const bench  = player.board.bench;
  const bias   = player._augmentBias || [];

  let score;
  switch (augId) {
    case 'HeroicResolve':    score = 10; break;
    case 'IronWill':         score = active.filter(c => c.passive && c.passive.axis === 2).length * 9; break;
    case 'TimeDilation':     score = active.filter(c => c.passive && c.passive.axis === 3).length * 7
                               + active.reduce((s, c) => s + (c.roundsSinceBought || 0), 0); break;
    case 'ExponentialGrowth':score = active.filter(c => c.passive && c.passive.axis === 4).length * 10; break;
    case 'Shapeshifter':     score = 7; break;
    case 'EarlyBird':        score = active.filter(c => c.passive && (c.passive.axis === 6 || c.passive.axis === '6+4')).length * 12; break;
    case 'MidasTouch':       score = active.filter(c => c.passive && c.passive.axis === 7).length * 10 + 5; break;
    case 'HiveMind':         score = bench.length >= 3 ? 16 : 5; break;
    case 'Overflow':         score = active.length >= player.board.maxActive ? 18 : 7; break;
    case 'Tycoon':           score = player.gold >= 30 ? 20 : player.gold >= 20 ? 13 : 5; break;
    case 'Varietal': {
      const uniqueSpecies = new Set(active.map(c => c.species)).size;
      score = uniqueSpecies * 10;
      break;
    }
    case 'CrossTraining': {
      const { SYNERGIES } = require('./cards');
      const specCts = {};
      for (const c of active) specCts[c.species] = (specCts[c.species] || 0) + 1;
      let activeSyn = 0;
      for (const [sp, cnt] of Object.entries(specCts)) {
        if (SYNERGIES[sp] && SYNERGIES[sp].getBonus(cnt)) activeSyn++;
      }
      score = activeSyn * 12;
      break;
    }
    default:                 score = 0;
  }

  // Strategy-specific bias: preferred augments score +30 to override defaults.
  if (bias.includes(augId)) score += 30;
  return score;
}

// Choose a Shapeshifter target and species for the AI.
// Strategy: look for a species where adding +1 would cross a synergy threshold.
// Fallback: pick highest-base card and tag its own species (harmless no-op).
function pickShapeshifterAI(run) {
  const player = run.player;
  const allCards = player.board.allCards;
  if (!allCards.length) return;

  const { SYNERGIES } = require('./cards');
  const { effectiveSpeciesCounts } = require('./board');
  const { counts } = effectiveSpeciesCounts(player.board, { augments: run.augments });

  for (const [species, syn] of Object.entries(SYNERGIES)) {
    const cur = counts[species] || 0;
    for (const thr of syn.thresholds) {
      if (cur === thr - 1) {
        const candidate = allCards.find(c => c.species !== species && c.shapeshifterSpecies !== species);
        if (candidate) {
          run.applyShapeshifter(candidate.name, species);
          return;
        }
      }
    }
  }

  const best = [...allCards].sort((a, b) => b.baseScore - a.baseScore)[0];
  if (best) run.applyShapeshifter(best.name, best.species);
}

// Pick an item and immediately attach it to the highest-EV unit with a free slot.
// forceItemId injects a specific item into the offer (used by the exploit sweep).
function resolveItemPick(run, forceItemId) {
  const offer = run.pendingItem();
  if (!offer) return;
  let idx = 0;
  if (forceItemId) {
    const fi = offer.indexOf(forceItemId);
    if (fi !== -1) { idx = fi; }
    else { offer[0] = forceItemId; idx = 0; }
  }
  const itemId = run.pickItem(idx);
  if (!itemId) return;
  const all = run.player.board.allCards;
  const target = all
    .filter(c => !c.items || c.items.length < 3)
    .sort((a, b) => b.baseScore * STAR_MULT[b.stars] - a.baseScore * STAR_MULT[a.stars])[0];
  if (target && attachItem(target, itemId)) {
    const idx = run.player.itemBag.indexOf(itemId);
    if (idx !== -1) run.player.itemBag.splice(idx, 1);
  }
}

// Resolve an augment pick for the current pending offer. Returns the picked id.
// `forcePick` = { augmentId, cardName?, species? } from opts.picks, or null.
function resolveAugmentPick(run, forcePick) {
  const offer = run.pendingAugment();
  if (!offer) return null;

  let idx = 0;

  if (forcePick && forcePick.augmentId) {
    const forceId = forcePick.augmentId;
    let fi = offer.indexOf(forceId);
    if (fi === -1) {
      offer[0] = forceId;
      fi = 0;
    }
    idx = fi;
  } else {
    // Pick the highest-scoring augment from the offer.
    let bestScore = -Infinity;
    for (let i = 0; i < offer.length; i++) {
      const s = scoreAugment(offer[i], run.player);
      if (s > bestScore) { bestScore = s; idx = i; }
    }
  }

  const chosen = run.pickAugment(idx);

  if (chosen === 'Shapeshifter') {
    if (forcePick && forcePick.cardName && forcePick.species) {
      run.applyShapeshifter(forcePick.cardName, forcePick.species);
    } else {
      pickShapeshifterAI(run);
    }
  }

  return chosen;
}

// ── Buy scoring ───────────────────────────────────────────────────────────────

// Context-aware purchase score for a card definition given current player state.
// Accounts for: passive axis vs board composition, current augments, items already
// attached to board cards, species counts (including Shapeshifter tags), and any
// strategy bias from the calling policy.
function scoreBuyCandidate(def, player, round, bias) {
  const augments = player.augments || [];
  const active   = player.board.active;
  const allCards = player.board.allCards;

  // Species counts including shapeshifter tags — Shapeshifter-granted species
  // are already reflected so we don't inadvertently under-value synergy progress.
  const specCounts = {};
  for (const c of allCards) {
    specCounts[c.species] = (specCounts[c.species] || 0) + 1;
    if (c.shapeshifterSpecies) {
      specCounts[c.shapeshifterSpecies] = (specCounts[c.shapeshifterSpecies] || 0) + 1;
    }
  }
  const sameSpecies = specCounts[def.species] || 0;
  const sameName    = allCards.filter(c => c.name === def.name).length;

  let score = def.tier * 8 + def.baseScore * 0.1 + sameSpecies * 10 + sameName * 20;

  if (def.passive) {
    const axis = def.passive.axis;

    // Axis 2: conditional flat; more siblings → bigger payoff. IronWill doubles it.
    if (axis === 2) {
      score += sameSpecies * 8;
      if (augments.includes('IronWill')) score += 15;
    }

    // Axis 3: per-round scaling; compounds more when bought early. TimeDilation amplifies.
    if (axis === 3) {
      score += 8 + Math.max(0, (20 - round) * 0.4);
      if (augments.includes('TimeDilation')) score += 10;
    }

    // Axis 4: multiplicative; better on a high-base board. ExponentialGrowth +0.25 to mult.
    if (axis === 4) {
      const avgBase = active.length
        ? active.reduce((s, c) => s + c.baseScore * STAR_MULT[c.stars], 0) / active.length
        : 0;
      score += avgBase * 0.05;
      if (augments.includes('ExponentialGrowth')) score += 15;
    }

    // Axis 6 / '6+4': round-timing passives; weak early unless EarlyBird is active.
    if (axis === 6 || axis === '6+4') {
      if (augments.includes('EarlyBird')) {
        score += 15;
      } else {
        const activatesAt = (axis === '6+4') ? 10 : 6;
        score += round >= activatesAt - 2 ? 12 : -5;
      }
    }

    // Axis 7: economy passives (tickGold, sellBonus). MidasTouch doubles them.
    if (axis === 7) {
      score += 12;
      if (augments.includes('MidasTouch')) score += 10;
    }

    // Axis 8: board-wide auras; more fielded units = more targets.
    if (axis === 8) {
      score += active.length * 4;
    }
  }

  // Item pairing: buying a card whose axis matches an item already on the board
  // is immediately productive — the item and card amplify each other.
  for (const card of allCards) {
    if (!card.items || !card.items.length) continue;
    for (const { id } of card.items) {
      if (id === 'Recurve Bow'         && def.passive && def.passive.axis === 3)                           score += 12;
      if (id === "Warmog's Armor"      && def.passive && def.passive.axis === 2)                           score += 12;
      if (id === 'Last Whisper'        && def.passive && (def.passive.axis === 6 || def.passive.axis === '6+4')) score += 12;
      if (id === "Guinsoo's Rageblade" && def.passive && def.passive.axis === 3)                           score += 10;
    }
  }

  // Augment-specific buy bonuses.
  if (augments.includes('HeroicResolve')) score += 3;         // every unit gains +25 base; quantity matters
  if (augments.includes('HiveMind'))      score += sameSpecies * 5; // bench synergy amplifies species matching

  // Strategy bias:
  //   species     — single-species stacking
  //   axis        — prefer passives of a given axis (combines with species)
  //   cls         — single-class stacking (spans 3–4 species naturally)
  //   mixSpecies  — two-or-more-species commit (prefers any listed species)
  //   wide        — bonus for new species, penalty for over-stacking one species
  if (bias) {
    // Species bias raised from +20 to +60 (Phase 33-B.2): the +20 was being
    // overcome by sameSpecies (×10) on whatever species first established, so
    // chitinous-stack drifted into mixed boards. +60 dominates the species/name
    // terms and keeps the policy committed to its target species.
    if (bias.species && def.species === bias.species)                        score += 60;
    if (bias.axis    && def.passive && def.passive.axis === bias.axis)       score += 15;
    if (bias.cls     && def.class   === bias.cls)                            score += 60;
    if (bias.mixSpecies && bias.mixSpecies.includes(def.species))            score += 40;
    if (bias.wide) {
      const uniqueSpecies = new Set(player.board.allCards.map(c => c.species));
      if (!uniqueSpecies.has(def.species)) score += 18;
      if (sameSpecies >= 3) score -= 12;
    }
    // avoidSpecies: heavy penalty so the AI only buys these if nothing else is on offer.
    // Models the player meta of skipping Chitinous/Crystalline whenever an alternative exists.
    if (bias.avoidSpecies && bias.avoidSpecies.includes(def.species)) score -= 100;
  }

  return score;
}

// Interest cap: at >=25g the player earns max +5g/round (doubled passive income).
// Skilled human play parks at this floor — it's the dominant economic strategy
// observed in playtest runs (v0.56). The sim's old saveForInterest logic only
// guarded the next 5-mark with a 2g gap, missing the 25g floor entirely and
// under-collecting ~80-100g across a 24-round run.
const INTEREST_CAP_GOLD = MAX_INTEREST * INTEREST_PER;

// Decide if the player is "score-behind" — the upcoming round's target is
// not comfortably cleared by the current board. When behind, cap protection
// is bypassed: spending to survive beats banking interest.
function isScoreBehind(player, round, run) {
  if (!run || !ROUND_TARGETS.length) return false;
  const idx = Math.min(round - 1, ROUND_TARGETS.length - 1);
  const entry = ROUND_TARGETS[idx];
  if (!entry) return false;
  const target = Math.round(entry.target * (run.diffMult || 1));
  // Match human "comfortable" threshold: 110% of the target leaves a small
  // cushion for interest banking; below that, spend.
  return boardScore(player, round, run) < target * 1.10;
}

// Attempt to buy the best available card from the current shop.
// Returns true if a purchase was made (so callers can loop until dry).
//
// Interest-cap protection: if buying drops the player below 25g, the buy is
// skipped UNLESS one of the following overrides applies — modelled on observed
// human play:
//   1. Score-behind: must spend to clear upcoming target.
//   2. Strict combine: 3rd copy of an existing 1*/2* card (auto-promotes).
//   3. Active board not yet at minimum baseline (3 cards): need to field
//      something before banking is meaningful.
//   4. T3 anchor: a T3 buy is a long-term anchor; the user explicitly pursues
//      "T3s ASAP".
function buyBestCard(player, round, bias, run) {
  if (player.board.isFull()) return false;
  let bestSlot = -1, bestScore = -Infinity, bestDef = null;
  for (let i = 0; i < player.shop.offers.length; i++) {
    const name = player.shop.offers[i];
    if (!name) continue;
    const def = CARD_DEFS.find(d => d.name === name);
    if (!def || player.gold < CARD_COSTS[def.tier]) continue;
    const s = scoreBuyCandidate(def, player, round, bias);
    if (s > bestScore) { bestScore = s; bestSlot = i; bestDef = def; }
  }
  if (bestSlot < 0 || !bestDef) return false;

  const cost = CARD_COSTS[bestDef.tier];
  const wouldDipBelowCap = player.gold - cost < INTEREST_CAP_GOLD;
  if (wouldDipBelowCap) {
    const sameName = player.board.allCards.filter(c => c.name === bestDef.name).length;
    const isCombine    = sameName >= 2;
    const baselineThin = player.board.active.length < 3;
    const isT3Anchor   = bestDef.tier === 3;
    const scoreBehind  = isScoreBehind(player, round, run);
    if (!isCombine && !baselineThin && !isT3Anchor && !scoreBehind) {
      return false;
    }
  }

  const card = player.shop.buy(bestSlot);
  if (!card) return false;
  player.board.addCard(card);
  player.runCombines();
  return true;
}

// ── AI Policies ───────────────────────────────────────────────────────────────

// Shared economy + buy core used by all strategy variants.
// `bias = { species?, axis? }` steers card scoring for proto-strategies; null = greedy.
function greedyCore(player, round, bias, run) {
  const augments  = player.augments || [];
  const hasMidas  = augments.includes('MidasTouch');
  const rerollCost   = player.shop.rerollCost();

  // Plinth investment: cap at level 7 (tier-3 unlock). Plinths compound shop
  // quality and are part of the human "T3s ASAP" strategy — they bypass
  // interest-cap protection.
  while (player.level < 7 && player.gold >= player.plinthCost() + 4) {
    if (!player.addPlinth()) break;
  }

  // Buy everything we can — buyBestCard internally enforces the 25g interest-cap
  // floor (with combine / T3-anchor / score-behind / thin-baseline overrides).
  while (buyBestCard(player, round, bias, run)) { /* continue */ }

  // Reroll: MidasTouch drops reroll cost to 1g, making more rerolls per round viable.
  // Reroll guard: don't reroll if it would drop us below the interest cap unless
  // we're behind on score (matches user rule: "I wouldn't roll with just >25-30g").
  // No fixed rerolls cap — playtest digests show 9-23 rerolls in late-game banked
  // rounds. The cap-floor / score-behind gate is the natural stop condition.
  // ROLL_HARD_CAP is a sanity bound to prevent infinite loops if shop always
  // re-offers a no-affordable state.
  const ROLL_HARD_CAP = 30;
  let rerolls = 0;
  while (rerolls < ROLL_HARD_CAP) {
    if (player.gold < rerollCost) break;
    // Free a bench slot if stuck — late-game user pattern is to sell low-EV
    // bench cards to make room for combine fodder pulled from rerolls.
    while (freeBenchIfStuck(player, bias)) { /* continue */ }
    const overflow = player.gold - rerollCost - INTEREST_CAP_GOLD;
    const scoreBehind = isScoreBehind(player, round, run);
    const canRollOverflow = overflow >= 0;
    const hasAffordable = player.shop.offers.some(name => {
      if (!name) return false;
      const def = CARD_DEFS.find(d => d.name === name);
      return def && player.gold >= CARD_COSTS[def.tier];
    });
    if (hasAffordable && !canRollOverflow && !scoreBehind) break;
    if (!canRollOverflow && !scoreBehind) break;
    if (player.board.isFull()) break;
    player.shop.reroll();
    rerolls++;
    while (buyBestCard(player, round, bias, run)) { /* continue */ }
  }

  optimizeBoard(player);
}

// Greedy-synergy: context-aware scoring of passives, items, and augments.
// Reuses greedyCore with no archetype bias.
function greedyPolicy(player, round = 1, run = null) {
  greedyCore(player, round, null, run);
}

// Smart greedy: score-aware saving, T3 timing, aggressive rerolling when behind.
// More representative of skilled human play than the base greedy policy.
function smartGreedyPolicy(player, round = 1, run = null) {
  smartGreedyCore(player, round, null, run);
}

// Wide: prefers cards that add new species over copies of existing ones.
// Benefits from Varietal and Cross-Training augments.
function widePolicy(player, round = 1, run = null) {
  greedyCore(player, round, { wide: true }, run);
}

// Species-commitment policies: prioritise one species without axis bias so the
// heuristic picks whichever axis the species's heroes actually use. Used by the
// balance harness to measure per-species ceilings.
function plasmicStackPolicy(player, round = 1, run = null)     { greedyCore(player, round, { species: 'Plasmic' }, run); }
function sporalStackPolicy(player, round = 1, run = null)      { greedyCore(player, round, { species: 'Sporal' }, run); }
function chitinousStackPolicy(player, round = 1, run = null)   { greedyCore(player, round, { species: 'Chitinous' }, run); }
function crystallineStackPolicy(player, round = 1, run = null) { greedyCore(player, round, { species: 'Crystalline' }, run); }
function abyssalStackPolicy(player, round = 1, run = null)     { greedyCore(player, round, { species: 'Abyssal' }, run); }

// Class-commitment policies: prioritise one class (Shy/Livid/Giddy/Sullen/Pompous).
// Since each class spans 3–4 species, class-stacks are naturally multi-species —
// they measure class synergy ceilings independent of species synergies.
function shyStackPolicy(player, round = 1, run = null)     { greedyCore(player, round, { cls: 'Shy' }, run); }
function lividStackPolicy(player, round = 1, run = null)   { greedyCore(player, round, { cls: 'Livid' }, run); }
function giddyStackPolicy(player, round = 1, run = null)   { greedyCore(player, round, { cls: 'Giddy' }, run); }
function sullenStackPolicy(player, round = 1, run = null)  { greedyCore(player, round, { cls: 'Sullen' }, run); }
function pompousStackPolicy(player, round = 1, run = null) { greedyCore(player, round, { cls: 'Pompous' }, run); }

// Two-species mix: test whether multiplicative species stacks compound into
// a dominant build not caught by single-species commits.
function abyssalSporalMixPolicy(player, round = 1, run = null) { greedyCore(player, round, { mixSpecies: ['Abyssal', 'Sporal'] }, run); }

// Dead-species avoidance: validates the Phase 26 hypothesis that skipping
// Chitinous/Crystalline is at-or-better than the greedy baseline.
function avoidChitinousPolicy(player, round = 1, run = null)   { greedyCore(player, round, { avoidSpecies: ['Chitinous'] }, run); }
function avoidCrystallinePolicy(player, round = 1, run = null) { greedyCore(player, round, { avoidSpecies: ['Crystalline'] }, run); }
function avoidBothPolicy(player, round = 1, run = null)        { greedyCore(player, round, { avoidSpecies: ['Chitinous', 'Crystalline'] }, run); }

// Score of the current board in the context of an upcoming round.
function boardScore(player, round, run) {
  const ctx = { round, player, augments: run ? run.augments : (player.augments || []) };
  return player.board.calcScoreBreakdown(ctx).total;
}

// Smart greedy: extends greedyCore with score-awareness.
// Saves gold (earns interest) when the current board already clears the next critique
// target — the chapter's hard checkpoint. Buying more cards to pad a comfortable margin
// is lower EV than banking the gold. Plinths are still bought regardless (levelling up
// improves shop odds for future rounds). Card-buying resumes when score falls behind.
function smartGreedyCore(player, round, bias, run) {
  const augments  = player.augments || [];
  const hasMidas  = augments.includes('MidasTouch');
  const rerollCost   = player.shop.rerollCost();

  // Comfortable = current score already clears the chapter's final hard check.
  // When comfortable, only plinth investment runs — bank everything else.
  let comfortable = false;
  if (run && ROUND_TARGETS.length) {
    const CRITIQUE_ROUNDS = [8, 16, 24];
    const nextCritique = CRITIQUE_ROUNDS.find(r => r >= round) || 24;
    const cEntry = ROUND_TARGETS[nextCritique - 1];
    if (cEntry) {
      const critiqueTarget = Math.round(cEntry.target * (run.diffMult || 1));
      comfortable = boardScore(player, round, run) >= critiqueTarget;
    }
  }

  // Plinth: always invest when affordable — leveling improves shop quality
  // regardless of current score comfort. Plinths bypass cap protection.
  while (player.level < 7 && player.gold >= player.plinthCost() + 4) {
    if (!player.addPlinth()) break;
  }

  if (comfortable) {
    optimizeBoard(player);
    return;
  }

  while (buyBestCard(player, round, bias, run)) { /* continue */ }

  const rerollGoldFloor = hasMidas ? rerollCost + CARD_COSTS[1] : 6;
  const maxRerolls      = hasMidas ? 3 : 1;
  let   rerolls         = 0;
  while (rerolls < maxRerolls && player.gold >= rerollGoldFloor && !player.board.isFull()) {
    const hasAffordable = player.shop.offers.some(name => {
      if (!name) return false;
      const def = CARD_DEFS.find(d => d.name === name);
      return def && player.gold >= CARD_COSTS[def.tier];
    });
    if (hasAffordable) break;
    if (player.gold < rerollCost) break;
    if (player.gold - rerollCost < INTEREST_CAP_GOLD && !isScoreBehind(player, round, run)) break;
    player.shop.reroll();
    rerolls++;
    while (buyBestCard(player, round, bias, run)) { /* continue */ }
  }

  optimizeBoard(player);
}

// Economy-stack: prioritises Axis-7 gold-generating cards (Sporvik, Sharzak) and biases
// augment scoring heavily toward Tycoon + MidasTouch. Tests the compound ceiling of
// maximum gold snowball — used to detect broken economy interactions in Phase 20-B.
function economyStackPolicy(player, round = 1, run = null) {
  player._augmentBias = ['Tycoon', 'MidasTouch'];
  greedyCore(player, round, { axis: 7 }, run);
}

// Random: buys random affordable cards without strategy. Kept as control baseline.
function randomPolicy(player, _round = 1) {
  while (player.level < 7 && player.gold >= player.plinthCost() + 4) {
    if (!player.addPlinth()) break;
  }

  for (let i = 0; i < player.shop.offers.length; i++) {
    if (player.board.isFull()) break;
    const name = player.shop.offers[i];
    if (!name) continue;
    const def = CARD_DEFS.find(d => d.name === name);
    if (!def || player.gold < CARD_COSTS[def.tier]) continue;
    const card = player.shop.buy(i);
    if (card) {
      player.board.addCard(card);
      player.runCombines();
    }
  }
  optimizeBoard(player);
}

const POLICIES = {
  greedy:              greedyPolicy,
  'smart-greedy':      smartGreedyPolicy,
  random:              randomPolicy,
  wide:                widePolicy,
  'plasmic-stack':     plasmicStackPolicy,
  'sporal-stack':      sporalStackPolicy,
  'chitinous-stack':   chitinousStackPolicy,
  'crystalline-stack': crystallineStackPolicy,
  'abyssal-stack':     abyssalStackPolicy,
  'shy-stack':         shyStackPolicy,
  'livid-stack':       lividStackPolicy,
  'giddy-stack':       giddyStackPolicy,
  'sullen-stack':      sullenStackPolicy,
  'pompous-stack':     pompousStackPolicy,
  'abyssal-sporal':    abyssalSporalMixPolicy,
  'economy-stack':     economyStackPolicy,
  'avoid-chitinous':   avoidChitinousPolicy,
  'avoid-crystalline': avoidCrystallinePolicy,
  'avoid-both':        avoidBothPolicy,
};

// ── Game Runner ───────────────────────────────────────────────────────────────

// Apply debug item grants after the shop phase. Retries each round until the
// target card appears on the board. Each grant fires at most once.
function applyGrants(player, pending) {
  for (let i = pending.length - 1; i >= 0; i--) {
    const [cardName, itemId] = pending[i];
    const card = player.board.allCards.find(c => c.name === cardName);
    if (card && attachItem(card, itemId)) pending.splice(i, 1);
  }
}

// opts.grants  — [[cardName, itemId], ...] pairs for debug item grants
// opts.picks   — { [round]: { augmentId, cardName?, species? } } forced augment picks
function runGame(seed, policyName = 'greedy', opts = {}) {
  const rng    = mulberry32(seed);
  const run    = new Run(rng, opts.diffMult || 1.0);
  // Phase 31-B.1: opts.modifier (id) pins a specific modifier for calibration.
  // opts.noModifier (bool) clears the modifier — used to baseline a "no twist" run.
  if (opts.noModifier) {
    run.modifier = null;
    run.modifierState = {};
  } else if (opts.modifier) {
    const { getModifier } = require('./modifiers');
    const m = getModifier(opts.modifier);
    if (m) {
      run.modifier = m;
      run.modifierState = typeof m.init === 'function' ? m.init(run) : {};
    }
  }
  const policy = POLICIES[policyName] || POLICIES.greedy;
  const pending = opts.grants ? opts.grants.slice() : null;
  const picks   = opts.picks  || {};

  while (!run.isOver()) {
    // Augment + item picks happen BEFORE earnIncome so Midas/Tycoon apply this round.
    const nextRound = run.round + 1;
    if (run.pendingAugment()) {
      resolveAugmentPick(run, picks[nextRound] || null);
    }
    if (run.pendingItem()) {
      resolveItemPick(run, opts.forceItem || null);
    }

    run.player.earnIncome();
    run.player.shop.refresh();
    policy(run.player, nextRound, run);
    if (pending && pending.length) applyGrants(run.player, pending);
    run.runBattle();
  }

  const p = run.player;
  return {
    seed,
    rounds:          run.round,
    roundsSurvived:  run.round,
    livesRemaining:  run.lives,
    survived:        run.round >= ROUND_CAP,
    wins:            p.wins,
    losses:          p.losses,
    level:           p.level,
    augments:        run.augments.slice(),
    battleHistory:   run.battleHistory,
  };
}

function batchSim(n, policyName = 'greedy', seedStart = 1) {
  const results = [];
  for (let i = 0; i < n; i++) results.push(runGame(seedStart + i, policyName));

  const totalRounds = results.reduce((s, r) => s + r.rounds, 0);
  const totalWins   = results.reduce((s, r) => s + r.wins,   0);
  const avgRoundsSurvived = totalRounds / n;
  const winRate = totalRounds > 0 ? totalWins / totalRounds : 0;

  return { n, avgRoundsSurvived, winRate, results };
}

module.exports = { runGame, batchSim, POLICIES, ROUND_CAP, resolveAugmentPick, resolveItemPick };
