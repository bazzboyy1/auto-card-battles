'use strict';

// Phase 29 — Visible Rival.
// A scripted AI exhibitor with a public board. Picks from the same shared
// shop as the player, AFTER the player commits each round. The rival doesn't
// score and never competes on appraisal — they are pure market pressure.
// Their board exists so the player can predict their next pick.
//
// Buster-principle DDA: aggressiveness ∈ [-0.10, +0.10]. Applied as a
// score-bias when the candidate's species matches the player's dominant
// species. ≤10% rate change keeps it under the perception threshold.

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
const AGGRO_HIGH    = 0.10;
const AGGRO_LOW     = -0.10;

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
  // ctx = { playerLastSpecies: { Sporal: 2, ... } | null }
  // Returns the slot indices the rival claimed (so the shop can null them).
  pickFromShop(shop, ctx) {
    const offers = shop.offers || [];
    const ctxLast = (ctx && ctx.playerLastSpecies) || {};
    const dominantSp = Object.keys(ctxLast).sort((a, b) => ctxLast[b] - ctxLast[a])[0] || null;

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
          } else {
            s = 1000 + def.baseScore + def.tier * 60;
          }
          break;
        }
        case 'mimic': {
          if (dominantSp && def.species === dominantSp) {
            s = 1000 + def.baseScore;
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

  // Buster-principle DDA. Called at chapter boundaries.
  // chapterRecord: array of { passed, scoreOverTarget } for the chapter's rounds.
  updateAggression(chapterRecord) {
    if (!chapterRecord || !chapterRecord.length) return;
    const losses    = chapterRecord.filter(r => !r.passed).length;
    const blowouts  = chapterRecord.filter(r => r.passed && r.scoreOverTarget >= 0.20).length;
    if (losses >= 2)        this.aggressiveness = AGGRO_LOW;
    else if (blowouts >= 3) this.aggressiveness = AGGRO_HIGH;
    else                    this.aggressiveness = 0;
  }
}

function pickPersonalityId(rng) {
  const ids = Object.keys(PERSONALITIES);
  return ids[Math.floor(rng() * ids.length)];
}

module.exports = { Rival, PERSONALITIES, pickPersonalityId, AGGRO_HIGH, AGGRO_LOW, ROUND_INCOME };
