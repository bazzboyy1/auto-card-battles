'use strict';

// Phase 29 — Visible Rival. Phase 33-B.3.A — threat layer.
// A scripted AI exhibitor with a public board. Picks from the same shared
// shop as the player, AFTER the player commits each round. The rival doesn't
// score and never competes on appraisal — they are pure market pressure.
// Their board exists so the player can predict their next pick.
//
// Threat model (Phase 33-B.3.A): aggressiveness ∈ [-0.20, +0.50]. Applied
// as a score-bias when the candidate's species matches the player's
// dominant species. The Phase 29 ≤10% Buster-principle cap was reversed —
// playtest read the rival as no-pressure precisely because the bias was
// sub-perception. Threat is now overt and scales with player margin.

const { CARD_DEFS, CARD_COSTS } = require('./cards');

const PERSONALITIES = {
  hoarder: {
    id: 'hoarder',
    name: 'The Hoarder',
    glyph: '💰',
    flavor: 'Saves gold for completed sets — picks rarely, then commits.',
    tell: 'Will sit on gold; pounces when you both want the same 2★.',
  },
  magpie: {
    id: 'magpie',
    name: 'The Magpie',
    glyph: '✨',
    flavor: 'Always grabs the rarest specimen, regardless of fit.',
    tell: 'Eats the highest-tier card on the shelf every round.',
  },
  specialist: {
    id: 'specialist',
    name: 'The Specialist',
    glyph: '🔬',
    flavor: 'Locks onto one species and hunts only that.',
    tell: 'Their first pick decides their species. After that, ignore the rest.',
  },
  mimic: {
    id: 'mimic',
    name: 'The Mimic',
    glyph: '🪞',
    flavor: 'Copies whatever species you bought most last round.',
    tell: 'Want to outpace them? Diversify — they only chase your majority.',
  },
};

const STARTING_GOLD = 5;
const ROUND_INCOME  = 5;
// Aggro buckets — overt, not sub-perception. The rival's HUD pill labels
// each bucket so the player can read the threat at a glance.
const AGGRO_DISTRACTED = -0.20; // chapter-end recovery: 2+ losses
const AGGRO_WATCHING   = 0.00;  // baseline
const AGGRO_HUNTING    = 0.25;  // 1+ strong rounds (>140% target) accumulating
const AGGRO_PEAK       = 0.50;  // sustained dominance — rival actively contests
// Per-round bump applied after a passing round; capped by AGGRO_PEAK.
const AGGRO_BUMP_STRONG  = 0.10;  // scoreOverTarget >= 0.40
const AGGRO_BUMP_PASS    = 0.04;  // scoreOverTarget >= 0.10
const AGGRO_DECAY_FAIL   = 0.15;  // failed round — pulls aggro down toward distracted

// Back-compat aliases — DESIGN_LOG and tests reference these names.
const AGGRO_HIGH = AGGRO_HUNTING;
const AGGRO_LOW  = AGGRO_DISTRACTED;

class Rival {
  constructor(personalityId, rng) {
    const p = PERSONALITIES[personalityId];
    if (!p) throw new Error('Unknown rival personality: ' + personalityId);
    this.personality        = p;
    this.rng                = rng;
    this.gold               = STARTING_GOLD;
    this.board              = [];   // array of { name, tier, species, class }
    this.specializedSpecies = null; // first-pick lock for Specialist
    this.aggressiveness     = 0;    // updated at chapter end
    this.lastChapter        = 0;    // last chapter we evaluated DDA for
  }

  earnIncome() { this.gold += ROUND_INCOME; }

  // Pick from the shop AFTER the player has committed.
  // ctx = {
  //   playerLastSpecies: { Sporal: 2, ... } | null,   // dominant-species snapshot of player board
  //   playerBoughtThisRound: ['Chitinous', 'Sporal']  // species of cards bought this round, in order
  // }
  // Returns the slot indices the rival claimed (so the shop can null them).
  pickFromShop(shop, ctx) {
    const offers = shop.offers || [];
    const ctxLast = (ctx && ctx.playerLastSpecies) || {};
    const dominantSp = Object.keys(ctxLast).sort((a, b) => ctxLast[b] - ctxLast[a])[0] || null;
    // Phase 33-B.3.A: Mimic now reads last-bought species *this round* rather
    // than majority of last round. The old signal was stale — by the time the
    // rival picked, the dominant-species heuristic just retraced what was
    // already on the board.
    const boughtThisRound = (ctx && ctx.playerBoughtThisRound) || [];
    const lastBoughtSp    = boughtThisRound.length
      ? boughtThisRound[boughtThisRound.length - 1]
      : null;

    let candidates = [];
    for (let i = 0; i < offers.length; i++) {
      if (!offers[i]) continue;
      const def = CARD_DEFS.find(d => d.name === offers[i]);
      if (!def) continue;
      const cost = CARD_COSTS[def.tier];
      if (this.gold < cost) continue;
      candidates.push({ idx: i, def, cost });
    }
    if (!candidates.length) return [];

    const personalityId = this.personality.id;

    // Specialist hard-commits: once a species is chosen, off-species cards
    // are filtered out entirely. This is what the plan promised ("commits
    // to one species, ignores the rest") and what makes the rival legible —
    // the player can reliably plan around "they only want Crystalline."
    if (personalityId === 'specialist' && this.specializedSpecies) {
      const onSpecies = candidates.filter(c => c.def.species === this.specializedSpecies);
      if (onSpecies.length) candidates = onSpecies;
      else return [];
    }
    const aggro = this.aggressiveness;

    // Phase 33-B.3.A: Specialist first-pick bias. When aggro >= HUNTING and
    // the player has a clear dominant species, push the Specialist's lock
    // toward contest. Preserves the "lock and ignore" identity but creates
    // friction when the player is winning.
    const specialistContestsPlayer =
      personalityId === 'specialist' &&
      !this.specializedSpecies &&
      aggro >= AGGRO_HUNTING &&
      !!dominantSp;

    const scored = candidates.map(c => {
      const { def } = c;
      let s = 0;

      switch (personalityId) {
        case 'hoarder': {
          const owned = this.board.filter(b => b.name === def.name).length;
          if (owned === 2)      s = 1500 + def.baseScore;        // ★3 imminent
          else if (owned === 1) s = 800  + def.baseScore;        // ★2 imminent
          else if (def.tier >= 2) s = 100 + def.baseScore * 0.4; // unlikely without prior holdings
          else                    s = def.baseScore * 0.2;
          break;
        }
        case 'magpie': {
          s = def.tier * 1000 + def.baseScore;
          break;
        }
        case 'specialist': {
          // Off-species candidates were filtered above. Either we're on a first
          // pick (no specializedSpecies yet) or the candidate is on-species.
          if (!this.specializedSpecies) {
            s = def.baseScore + def.tier * 120; // first-pick: tier-weighted base
            // Phase 33-B.3.A: when the player is winning, bias the lock toward
            // their dominant species so Specialist becomes a real contest.
            if (specialistContestsPlayer && def.species === dominantSp) {
              s += 1500;
            }
          } else {
            s = 1000 + def.baseScore + def.tier * 60;
          }
          break;
        }
        case 'mimic': {
          // Phase 33-B.3.A: prioritize last-bought species *this round*, then
          // fall back to dominant species of player board. Direct shop contest.
          if (lastBoughtSp && def.species === lastBoughtSp) {
            s = 1500 + def.baseScore;
          } else if (dominantSp && def.species === dominantSp) {
            s = 800 + def.baseScore;
          } else {
            s = def.baseScore + def.tier * 80;
          }
          break;
        }
      }

      // Buster-principle aggro bias: if the candidate's species matches the
      // player's dominant species, scale ±10%. Sub-perception by design.
      if (dominantSp && def.species === dominantSp) {
        s *= (1 + aggro);
      }

      // Tiny rng jitter for tie-breaks.
      s += this.rng() * 5;
      return { ...c, s };
    });

    scored.sort((a, b) => b.s - a.s);

    // Pick volume per personality.
    let maxPicks = 1;
    if (personalityId === 'magpie') maxPicks = 2;
    // Specialist: 2 picks once locked, but only 1 on the locking round —
    // otherwise the lock-setting first pick can be followed by an
    // off-species second pick before the filter applies.
    if (personalityId === 'specialist' && this.specializedSpecies) maxPicks = 2;

    const picked = [];
    let goldLeft = this.gold;
    for (const c of scored) {
      if (picked.length >= maxPicks) break;
      if (goldLeft < c.cost) continue;
      // Hoarder: refuse opportunistic buys when not on a 2★/3★ track.
      if (personalityId === 'hoarder') {
        const owned = this.board.filter(b => b.name === c.def.name).length;
        if (owned === 0 && goldLeft < 8) continue;
      }
      picked.push(c);
      goldLeft -= c.cost;
    }

    for (const c of picked) {
      this.gold -= c.cost;
      this.board.push({
        name:    c.def.name,
        tier:    c.def.tier,
        species: c.def.species,
        class:   c.def.class,
      });
      if (personalityId === 'specialist' && !this.specializedSpecies) {
        this.specializedSpecies = c.def.species;
      }
    }

    return picked.map(c => c.idx);
  }

  // Phase 33-B.3.A: per-round aggro update. Called after every battle.
  // The chapter-end variant (updateAggression) still resets on bad chapters,
  // but the per-round bumps let aggro climb during the long mid-game stretch
  // where the chapter-end signal would otherwise just oscillate around 0.
  // record: { passed: bool, scoreOverTarget: number }
  updateAggressionPerRound(record) {
    if (!record) return;
    if (!record.passed) {
      // Failure pulls aggro down — the rival "looks elsewhere."
      this.aggressiveness = Math.max(AGGRO_DISTRACTED, this.aggressiveness - AGGRO_DECAY_FAIL);
      return;
    }
    let bump = 0;
    if (record.scoreOverTarget >= 0.40)      bump = AGGRO_BUMP_STRONG;
    else if (record.scoreOverTarget >= 0.10) bump = AGGRO_BUMP_PASS;
    if (bump > 0) {
      this.aggressiveness = Math.min(AGGRO_PEAK, this.aggressiveness + bump);
    }
  }

  // Chapter-boundary reset. Two losses still hard-resets to distracted (player
  // is struggling — pull rival off them). Otherwise the per-round bumps carry.
  // chapterRecord: array of { passed, scoreOverTarget } for the chapter's rounds.
  updateAggression(chapterRecord) {
    if (!chapterRecord || !chapterRecord.length) return;
    const losses = chapterRecord.filter(r => !r.passed).length;
    if (losses >= 2) this.aggressiveness = AGGRO_DISTRACTED;
  }

  // Bucket the current aggro for HUD display.
  // Returns one of: 'distracted', 'watching', 'hunting', 'pouncing'.
  threatLevel() {
    if (this.aggressiveness <= -0.10)     return 'distracted';
    if (this.aggressiveness >= AGGRO_PEAK - 0.001) return 'pouncing';
    if (this.aggressiveness >= AGGRO_HUNTING - 0.001) return 'hunting';
    return 'watching';
  }
}

function pickPersonalityId(rng) {
  const ids = Object.keys(PERSONALITIES);
  return ids[Math.floor(rng() * ids.length)];
}

module.exports = {
  Rival, PERSONALITIES, pickPersonalityId, ROUND_INCOME,
  AGGRO_DISTRACTED, AGGRO_WATCHING, AGGRO_HUNTING, AGGRO_PEAK,
  AGGRO_HIGH, AGGRO_LOW, // back-compat
};
