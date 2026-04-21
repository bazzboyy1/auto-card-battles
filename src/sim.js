'use strict';

const { CARD_DEFS, CARD_COSTS, STAR_MULT } = require('./cards');
const { Run, ROUND_CAP } = require('./game');
const { attachItem } = require('./items');
const { AUGMENT_DEFS } = require('./augments');
const { mulberry32 } = require('./utils');

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Pick the first offered item and immediately attach it to the highest-EV unit
// with a free item slot. Item stays in the bag if no unit has room.
function resolveItemPick(run) {
  const offer = run.pendingItem();
  if (!offer) return;
  const itemId = run.pickItem(0);
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

  // Strategy bias: plasmic-stack → Plasmic species + Axis-2; abyssal-arc → Abyssal + Axis-4.
  // wide → bonus for new species, penalty for over-stacking one species.
  if (bias) {
    if (bias.species && def.species === bias.species)                        score += 20;
    if (bias.axis    && def.passive && def.passive.axis === bias.axis)       score += 15;
    if (bias.wide) {
      const uniqueSpecies = new Set(player.board.allCards.map(c => c.species));
      if (!uniqueSpecies.has(def.species)) score += 18;
      if (sameSpecies >= 3) score -= 12;
    }
  }

  return score;
}

// Attempt to buy the best available card from the current shop.
// Returns true if a purchase was made (so callers can loop until dry).
function buyBestCard(player, round, bias) {
  if (player.board.isFull()) return false;
  let bestSlot = -1, bestScore = -Infinity;
  for (let i = 0; i < player.shop.offers.length; i++) {
    const name = player.shop.offers[i];
    if (!name) continue;
    const def = CARD_DEFS.find(d => d.name === name);
    if (!def || player.gold < CARD_COSTS[def.tier]) continue;
    const s = scoreBuyCandidate(def, player, round, bias);
    if (s > bestScore) { bestScore = s; bestSlot = i; }
  }
  if (bestSlot < 0) return false;
  const card = player.shop.buy(bestSlot);
  if (!card) return false;
  player.board.addCard(card);
  player.runCombines();
  return true;
}

// ── AI Policies ───────────────────────────────────────────────────────────────

// Shared economy + buy core used by all strategy variants.
// `bias = { species?, axis? }` steers card scoring for proto-strategies; null = greedy.
function greedyCore(player, round, bias) {
  const augments  = player.augments || [];
  const hasTycoon = augments.includes('Tycoon');
  const hasMidas  = augments.includes('MidasTouch');

  const INTEREST_PER = 5;
  const rerollCost   = player.shop.rerollCost();

  // Interest saving: Tycoon doubles interest, so its thresholds are doubly valuable.
  // With Tycoon active, start saving earlier and for a wider gap.
  const nextThreshold  = (Math.floor(player.gold / INTEREST_PER) + 1) * INTEREST_PER;
  const gapToThreshold = nextThreshold - player.gold;
  const saveMinGold    = hasTycoon ? 6 : 8;
  const saveGap        = hasTycoon ? 3 : 2;
  const saveForInterest = player.gold >= saveMinGold && gapToThreshold <= saveGap;

  // Plinth investment: cap at level 7 (tier-3 unlock). Skip if saving for interest.
  if (!saveForInterest) {
    while (player.level < 7 && player.gold >= player.plinthCost() + 4) {
      if (!player.addPlinth()) break;
    }
  }

  if (saveForInterest) {
    optimizeBoard(player);
    return;
  }

  // Buy everything we can from the current shop.
  while (buyBestCard(player, round, bias)) { /* continue */ }

  // Reroll: MidasTouch drops reroll cost to 1g, making more rerolls per round viable.
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
    player.shop.reroll();
    rerolls++;
    while (buyBestCard(player, round, bias)) { /* continue */ }
  }

  optimizeBoard(player);
}

// Greedy-synergy: context-aware scoring of passives, items, and augments.
// Reuses greedyCore with no archetype bias.
function greedyPolicy(player, round = 1) {
  greedyCore(player, round, null);
}

// Plasmic Stack: prioritises Plasmic species and Axis-2 conditional passives.
// IronWill / HeroicResolve are preferred at augment picks via _augmentBias.
function warriorStackPolicy(player, round = 1) {
  greedyCore(player, round, { species: 'Plasmic', axis: 2 });
}

// Abyssal Arc: prioritises Abyssal species and Axis-4 multiplicative passives.
// ExponentialGrowth / EarlyBird / Overflow are preferred at augment picks.
function demonArcPolicy(player, round = 1) {
  greedyCore(player, round, { species: 'Abyssal', axis: 4 });
}

// Wide: prefers cards that add new species over copies of existing ones.
// Benefits from Varietal and Cross-Training augments.
function widePolicy(player, round = 1) {
  greedyCore(player, round, { wide: true });
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
  greedy:          greedyPolicy,
  random:          randomPolicy,
  'warrior-stack': warriorStackPolicy,
  'demon-arc':     demonArcPolicy,
  wide:            widePolicy,
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
  const run    = new Run(rng);
  const policy = POLICIES[policyName] || POLICIES.greedy;
  const pending = opts.grants ? opts.grants.slice() : null;
  const picks   = opts.picks  || {};

  // Wire strategy-specific augment bias so scoreAugment can read it.
  if (policyName === 'warrior-stack') run.player._augmentBias = ['IronWill', 'HeroicResolve'];
  if (policyName === 'demon-arc')     run.player._augmentBias = ['ExponentialGrowth', 'EarlyBird', 'Overflow'];

  while (!run.isOver()) {
    // Augment + item picks happen BEFORE earnIncome so Midas/Tycoon apply this round.
    const nextRound = run.round + 1;
    if (run.pendingAugment()) {
      resolveAugmentPick(run, picks[nextRound] || null);
    }
    if (run.pendingItem()) {
      resolveItemPick(run);
    }

    run.player.earnIncome();
    run.player.shop.refresh();
    policy(run.player, nextRound);
    if (pending && pending.length) applyGrants(run.player, pending);
    run.runBattle();
  }

  const p = run.player;
  return {
    seed,
    rounds:          run.round,
    roundsSurvived:  run.round,
    hp:              p.hp,
    survived:        p.hp > 0,
    wins:            p.wins,
    losses:          p.losses,
    level:           p.level,
    augments:        run.augments.slice(),
    opponentHistory: run.opponentHistory,
  };
}

function batchSim(n, policyName = 'greedy', seedStart = 1) {
  const results = [];
  for (let i = 0; i < n; i++) results.push(runGame(seedStart + i, policyName));

  const totalRounds = results.reduce((s, r) => s + r.rounds, 0);
  const totalWins   = results.reduce((s, r) => s + r.wins,   0);
  const avgRoundsSurvived = totalRounds / n;
  const avgFinalHp        = results.reduce((s, r) => s + r.hp, 0) / n;
  const winRate = totalRounds > 0 ? totalWins / totalRounds : 0;

  return { n, avgRoundsSurvived, winRate, avgFinalHp, results };
}

module.exports = { runGame, batchSim, POLICIES, ROUND_CAP };
