'use strict';

const { STAR_MULT, SYNERGIES, CLASS_SYNERGIES } = require('./cards');
const { hasItem, giantsBeltMult } = require('./items');
const { hasAugment } = require('./augments');

const MAX_BENCH = 8;
const SPECIES_ALPHA = ['Abyssal', 'Chitinous', 'Crystalline', 'Plasmic', 'Sporal'];

// Effective species counts used for synergy thresholds.
// - Gloopir contributes 2 to Plasmic (vs 1 by default)
// - Krombax contributes 2 to Crystalline
// - Emblem of [Species] items contribute +1 to that species (always active)
// - Geodorb contributes +1 to one species the board already has 3+ of
//   (tie-break: alphabetical Abyssal < Chitinous < Crystalline < Plasmic < Sporal).
// - Spear of Shojin picks one species the board has ≥2 of at random each
//   call; requires ctx.player.rng. If player/rng absent (e.g. UI preview),
//   Spear is a no-op for this call (avoids consuming run rng).
// - Shapeshifter tag: card.shapeshifterSpecies contributes +1 to that species
// - Hive Mind (augment): bench cards are included in the counting loop in
//   addition to active cards. Synergy bonuses in calcScore still only apply
//   to active cards; bench just inflates counts toward thresholds.
// Returns { counts, morphChoices, spearChoices }.
function effectiveSpeciesCounts(boardState, ctx = {}) {
  const augments = ctx.augments || [];
  const hiveMind = hasAugment(augments, 'HiveMind');

  // Which cards to count for synergy thresholds.
  const cardsToCount = hiveMind
    ? [...boardState.active, ...boardState.bench]
    : boardState.active;

  const counts = {};
  const morphs = [];
  const spears = [];

  for (const c of cardsToCount) {
    if (c.name === 'Gloopir') {
      counts.Plasmic = (counts.Plasmic || 0) + 2;
    } else if (c.name === 'Krombax') {
      counts.Crystalline = (counts.Crystalline || 0) + 2;
    } else {
      counts[c.species] = (counts[c.species] || 0) + 1;
    }
    // Shapeshifter permanent extra species tag.
    if (c.shapeshifterSpecies) {
      counts[c.shapeshifterSpecies] = (counts[c.shapeshifterSpecies] || 0) + 1;
    }
    if (c.name === 'Geodorb') morphs.push(c);
    if (c.items && c.items.length) {
      for (const entry of c.items) {
        if (entry.id && entry.id.startsWith('Emblem of ')) {
          const sp = entry.id.slice('Emblem of '.length);
          counts[sp] = (counts[sp] || 0) + 1;
        } else if (entry.id === 'Spear of Shojin') {
          spears.push(c);
        }
      }
    }
  }

  const morphChoices = new Map();
  for (const m of morphs) {
    const chosen = SPECIES_ALPHA.find(s => (counts[s] || 0) >= 3) || null;
    morphChoices.set(m._id, chosen);
    if (chosen) counts[chosen] = (counts[chosen] || 0) + 1;
  }

  const spearChoices = new Map();
  const rng = ctx.player && typeof ctx.player.rng === 'function' ? ctx.player.rng : null;
  for (const s of spears) {
    if (!rng) { spearChoices.set(s._id, null); continue; }
    const cands = SPECIES_ALPHA.filter(sp => (counts[sp] || 0) >= 2);
    if (cands.length === 0) { spearChoices.set(s._id, null); continue; }
    const chosen = cands[Math.floor(rng() * cands.length)] || cands[0];
    spearChoices.set(s._id, chosen);
    counts[chosen] = (counts[chosen] || 0) + 1;
  }

  return { counts, morphChoices, spearChoices };
}

// True if `card` should receive a bonus targeted at `species`. Geodorb
// receives bonuses for both its base species (Crystalline) and its phantom species.
// Emblem items tag the card with the emblem's species. Spear of Shojin
// tags the card with its per-round random species (if resolved).
// Shapeshifter permanently tags the card with card.shapeshifterSpecies.
function cardHasSpeciesTag(card, species, morphChoices, spearChoices) {
  if (card.species === species) return true;
  if (card.shapeshifterSpecies === species) return true;
  if (card.name === 'Geodorb' && morphChoices && morphChoices.get(card._id) === species) return true;
  if (spearChoices && spearChoices.get(card._id) === species) return true;
  if (card.items) {
    for (const entry of card.items) {
      if (entry.id === `Emblem of ${species}`) return true;
    }
  }
  return false;
}

// Effective class counts used for class synergy thresholds.
// Crest of [Class] items contribute +1 to that class.
// Shapeshifter does NOT affect class (deferred to playtest 3).
function effectiveClassCounts(boardState) {
  const counts = {};
  for (const c of boardState.active) {
    if (c.class) counts[c.class] = (counts[c.class] || 0) + 1;
    if (c.items) {
      for (const entry of c.items) {
        if (entry.id && entry.id.startsWith('Crest of ')) {
          const cl = entry.id.slice('Crest of '.length);
          counts[cl] = (counts[cl] || 0) + 1;
        }
      }
    }
  }
  return { counts };
}

// True if card should receive a bonus targeted at `className`.
// Crest of [Class] items count as +1 for class synergy targeting.
function cardHasClassTag(card, className) {
  if (card.class === className) return true;
  if (card.items) {
    for (const entry of card.items) {
      if (entry.id === `Crest of ${className}`) return true;
    }
  }
  return false;
}

// Axis-8 aura target resolution. Target strings:
//   'all'         — every active card
//   'other'       — every active card except the source
//   'self'        — only the source
//   'all-<Sp>'    — every card of species Sp (including source)
//   'other-<Sp>'  — every card of species Sp except source
function auraMatches(target, srcIdx, tgtIdx, active) {
  const c = active[tgtIdx];
  if (target === 'all') return true;
  if (target === 'self') return srcIdx === tgtIdx;
  if (target === 'other') return srcIdx !== tgtIdx;
  if (target.startsWith('all-'))   return c.species === target.slice(4);
  if (target.startsWith('other-')) return srcIdx !== tgtIdx && c.species === target.slice(6);
  return false;
}

class Board {
  constructor(maxActive = 1) {
    this.maxActive = maxActive;
    this.active = [];  // cards on board (contribute to score + synergies)
    this.bench  = [];  // cards not fielded (don't score, do contribute to combine checks)
  }

  speciesCounts() {
    const counts = {};
    for (const card of this.active) {
      counts[card.species] = (counts[card.species] || 0) + 1;
    }
    return counts;
  }

  // Scoring pipeline (async redesign spec + Phase 6 augments):
  //   Stage 0:  base × star; Claymore +40, HeroicResolve +25 (both pre-star)
  //   Stage 1:  Axis 3 flat scaling + Guinsoo's Rageblade + TimeDilation;
  //             Prestige Tag (+12/class syn); Collector's Mark (+8/combined card)
  //   Stage 2:  Axis 2 flat conditional; IronWill ×2 (capped by Warmog's)
  //   Stage 3:  synergy flats (effective counts, with HiveMind bench included)
  //   Stage 4a: synergy mults; CrossTraining global mult; Curator's Eye (+5%/3★)
  //   Stage 4b: Axis 4/6/'6+4' per-card mults + Giant's Belt; ExponentialGrowth +0.25;
  //             Deep Roots (×1.15 for cards held 10+ rounds)
  //   Stage 5:  Axis 8 board-level auras + Zeke's Herald
  // EarlyBird: for Axis-6/'6+4' passives, bypass Last Whisper wrap and use
  //   round+3 in the passive eval (evaluated in the results map below).
  //
  // Returns { total, perCard: [{ card, rawBase, final, lines: [{label,add?,mult?}] }] }.
  // calcScore() is a thin wrapper that returns total only.
  calcScoreBreakdown(ctx = {}) {
    if (this.active.length === 0) return { total: 0, perCard: [] };

    const round    = ctx.round    || 0;
    const player   = ctx.player   || null;
    const augments = ctx.augments || (player && player.augments) || [];
    const hasAug   = id => hasAugment(augments, id);

    const { counts: speciesCounts, morphChoices, spearChoices } =
      effectiveSpeciesCounts(this, { ...ctx, augments });
    const { counts: classCounts } = effectiveClassCounts(this);

    // Precomputed board-state values used by new augments and items.
    const tripleStarActive  = this.active.filter(c => c.stars === 3).length;
    const combinedActive    = this.active.filter(c => c.stars > 1).length;
    const activeClassSynCount = Object.keys(classCounts).filter(cls => {
      const syn = CLASS_SYNERGIES[cls];
      return syn && syn.getBonus(classCounts[cls]);
    }).length;

    const hasEarlyBird = hasAug('EarlyBird');

    const results = this.active.map(card => {
      if (!card.passive || typeof card.passive.eval !== 'function') return {};
      const ax = card.passive.axis;
      let evalFn    = card.passive.eval;
      let evalRound = round;
      if (hasEarlyBird && (ax === 6 || ax === '6+4')) {
        const origP = card._originalPassive || card.passive;
        evalFn    = origP.eval;
        evalRound = round + 3;
      }
      const selfCtx = { round: evalRound, boardState: this, speciesCounts, classCounts, self: card, player, augments };
      try { return evalFn(card, selfCtx) || {}; } catch (_) { return {}; }
    });

    const scores    = new Array(this.active.length).fill(0);
    const cardMults = new Array(this.active.length).fill(1.0);
    const lines     = this.active.map(() => []);

    // Stage 0
    for (let i = 0; i < this.active.length; i++) {
      const c = this.active[i];
      if (results[i].baseOverride !== undefined) {
        scores[i] = results[i].baseOverride;
        lines[i].push({ label: 'Invoker base', add: scores[i] });
      } else {
        let base = c.baseScore;
        const extras = [];
        if (hasItem(c, 'Claymore'))  { base += 40; extras.push('+Claymore'); }
        if (hasAug('HeroicResolve')) { base += 25; extras.push('+Heroic'); }
        if (hasAug('grand_specimen') && c.tier === 3) { base += 30; extras.push('+GrandSpec'); }
        scores[i] = Math.round(base * STAR_MULT[c.stars]);
        const starLabel = c.stars === 2 ? '2★' : c.stars === 3 ? '3★' : '1★';
        const extStr = extras.length ? ` (${extras.join(', ')})` : '';
        lines[i].push({ label: `base ${c.baseScore}${extStr} × ${starLabel}`, add: scores[i] });
      }
    }

    // Stage 1 — Axis 3 + Guinsoo's Rageblade + Time Dilation
    for (let i = 0; i < this.active.length; i++) {
      const card = this.active[i];
      if (card.passive && card.passive.axis === 3 && typeof results[i].flat === 'number' && results[i].flat !== 0) {
        let v = results[i].flat;
        // Apply passive cap after item wrapping (prevents Growth Serum from doubling the cap).
        const origPassive = card._originalPassive || card.passive;
        if (typeof origPassive.cap === 'number') v = Math.min(origPassive.cap, v);
        scores[i] += v;
        lines[i].push({ label: card.passive.description || 'passive', add: v });
      }
      if (hasItem(card, "Guinsoo's Rageblade") && card.roundsSinceBought) {
        const v = 18 * card.roundsSinceBought;
        scores[i] += v;
        lines[i].push({ label: "Guinsoo's Rageblade", add: v });
      }
      if (hasAug('TimeDilation') && card.roundsSinceBought) {
        const v = 4 * card.roundsSinceBought;
        scores[i] += v;
        lines[i].push({ label: 'Time Dilation', add: v });
      }
      if (hasItem(card, 'prestige_tag') && activeClassSynCount > 0) {
        const v = 12 * activeClassSynCount;
        scores[i] += v;
        lines[i].push({ label: `Prestige Tag (${activeClassSynCount} class syn)`, add: v });
      }
      if (hasItem(card, 'collectors_mark') && combinedActive > 0) {
        const v = 8 * combinedActive;
        scores[i] += v;
        lines[i].push({ label: `Collector's Mark (${combinedActive} combined)`, add: v });
      }
    }

    // Stage 2 — Axis 2 flat conditional; IronWill doubles (not if Warmog's already doubled)
    for (let i = 0; i < this.active.length; i++) {
      const card = this.active[i];
      if (card.passive && card.passive.axis === 2 && typeof results[i].flat === 'number' && results[i].flat !== 0) {
        let flat = results[i].flat;
        if (hasAug('IronWill') && !hasItem(card, "Warmog's Armor")) flat *= 2;
        scores[i] += flat;
        lines[i].push({ label: card.passive.description || 'passive', add: flat });
      }
    }

    // Stage 3 — synergy flats
    for (const [species, count] of Object.entries(speciesCounts)) {
      const syn = SYNERGIES[species];
      if (!syn) continue;
      const bonus = syn.getBonus(count);
      if (!bonus || bonus.target !== 'species' || bonus.type !== 'flat') continue;
      for (let i = 0; i < this.active.length; i++) {
        if (cardHasSpeciesTag(this.active[i], species, morphChoices, spearChoices)) {
          scores[i] += bonus.value;
          lines[i].push({ label: `${species}-${count} synergy`, add: bonus.value });
        }
      }
    }

    // Varietal: +8 flat per unique active species, applied to every card
    if (hasAug('Varietal')) {
      const uniqueSpecies = Object.keys(speciesCounts).filter(s => speciesCounts[s] >= 1).length;
      if (uniqueSpecies > 0) {
        const bonus = 8 * uniqueSpecies;
        for (let i = 0; i < this.active.length; i++) {
          scores[i] += bonus;
          lines[i].push({ label: `Varietal (${uniqueSpecies} species)`, add: bonus });
        }
      }
    }

    // Stage 3b — class synergy flats
    for (const [cls, count] of Object.entries(classCounts)) {
      const syn = CLASS_SYNERGIES[cls];
      if (!syn) continue;
      const bonus = syn.getBonus(count);
      if (!bonus || bonus.target !== 'class' || bonus.type !== 'flat') continue;
      for (let i = 0; i < this.active.length; i++) {
        if (cardHasClassTag(this.active[i], cls)) {
          scores[i] += bonus.value;
          lines[i].push({ label: `${cls}-${count} class`, add: bonus.value });
        }
      }
    }

    // Stage 4a — synergy mults (species-targeted and global)
    let globalMult = 1.0;
    for (const [species, count] of Object.entries(speciesCounts)) {
      const syn = SYNERGIES[species];
      if (!syn) continue;
      const bonus = syn.getBonus(count);
      if (!bonus) continue;
      if (bonus.target === 'species' && bonus.type === 'mult') {
        for (let i = 0; i < this.active.length; i++) {
          if (cardHasSpeciesTag(this.active[i], species, morphChoices, spearChoices)) {
            cardMults[i] *= bonus.value;
            lines[i].push({ label: `${species}-${count} synergy`, mult: bonus.value });
          }
        }
      } else if (bonus.target === 'all' && bonus.type === 'mult') {
        globalMult *= bonus.value;
      }
    }

    // Stage 4a-class — class synergy mults (class-targeted and global)
    for (const [cls, count] of Object.entries(classCounts)) {
      const syn = CLASS_SYNERGIES[cls];
      if (!syn) continue;
      const bonus = syn.getBonus(count);
      if (!bonus) continue;
      if (bonus.target === 'class' && bonus.type === 'mult') {
        for (let i = 0; i < this.active.length; i++) {
          if (cardHasClassTag(this.active[i], cls)) {
            cardMults[i] *= bonus.value;
            lines[i].push({ label: `${cls}-${count} class`, mult: bonus.value });
          }
        }
      } else if (bonus.target === 'all' && bonus.type === 'mult') {
        globalMult *= bonus.value;
      }
    }

    // Cross-Training: +6% global mult per active synergy (species or class)
    if (hasAug('CrossTraining')) {
      let activeSynCount = 0;
      for (const [species, count] of Object.entries(speciesCounts)) {
        const syn = SYNERGIES[species];
        if (syn && syn.getBonus(count)) activeSynCount++;
      }
      for (const [cls, count] of Object.entries(classCounts)) {
        const syn = CLASS_SYNERGIES[cls];
        if (syn && syn.getBonus(count)) activeSynCount++;
      }
      if (activeSynCount > 0) globalMult *= (1 + 0.05 * activeSynCount);
    }

    // Curator's Eye: +5% global mult per 3★ active specimen
    if (hasAug('curators_eye') && tripleStarActive > 0) {
      globalMult *= (1 + 0.05 * tripleStarActive);
    }

    // Stage 4b — Axis 4/6/'6+4' per-card mults + Giant's Belt
    for (let i = 0; i < this.active.length; i++) {
      const card = this.active[i];
      if (card.passive) {
        const ax = card.passive.axis;
        if (typeof results[i].mult === 'number' && (ax === 4 || ax === 6 || ax === '6+4')) {
          let mult = results[i].mult;
          if (ax === 4 && hasAug('ExponentialGrowth')) mult += 0.25;
          if (hasAug('mastery_protocol') && (ax === 4 || ax === 6 || ax === '6+4')) mult += 0.1;
          cardMults[i] *= mult;
          lines[i].push({ label: card.passive.description || 'passive', mult });
        }
      }
      if (hasItem(card, "Giant's Belt")) {
        const mult = giantsBeltMult(card.stars);
        cardMults[i] *= mult;
        lines[i].push({ label: "Giant's Belt", mult });
      }
      if (hasAug('deep_roots') && (card.roundsSinceBought || 0) >= 10) {
        cardMults[i] *= 1.15;
        lines[i].push({ label: 'Deep Roots', mult: 1.15 });
      }
      if (hasAug('apex_showcase') && card.stars === 3) {
        cardMults[i] *= 1.2;
        lines[i].push({ label: 'Apex Showcase', mult: 1.2 });
      }
      if (hasItem(card, 'veterans_plinth') && (card.roundsSinceBought || 0) >= 15) {
        cardMults[i] *= 1.3;
        lines[i].push({ label: "Veteran's Plinth", mult: 1.3 });
      }
      if (hasItem(card, 'prestige_circuit')) {
        cardMults[i] *= 1.2;
        lines[i].push({ label: 'Prestige Circuit', mult: 1.2 });
      }
    }

    // Class Harmony: +12% global mult per active class synergy beyond the first
    if (hasAug('class_harmony')) {
      const activeSynCount = Object.keys(CLASS_SYNERGIES).filter(cls =>
        CLASS_SYNERGIES[cls].getBonus(classCounts[cls] || 0)
      ).length;
      if (activeSynCount > 1) globalMult *= 1 + (activeSynCount - 1) * 0.12;
    }

    // Stage 5 — Axis 8 auras + Zeke's Herald
    for (let i = 0; i < this.active.length; i++) {
      const card = this.active[i];
      const r    = results[i];
      if (card.passive && card.passive.axis === 8 && r && r.target) {
        for (let j = 0; j < this.active.length; j++) {
          if (!auraMatches(r.target, i, j, this.active)) continue;
          if (typeof r.auraMult === 'number') {
            cardMults[j] *= r.auraMult;
            lines[j].push({ label: `${card.name} aura`, mult: r.auraMult });
          }
          if (typeof r.auraFlat === 'number') {
            scores[j] += r.auraFlat;
            lines[j].push({ label: `${card.name} aura`, add: r.auraFlat });
          }
        }
      }
      if (hasItem(card, "Zeke's Herald")) {
        for (let j = 0; j < this.active.length; j++) {
          if (j !== i) {
            cardMults[j] *= 1.12;
            lines[j].push({ label: "Zeke's Herald", mult: 1.12 });
          }
        }
      }
    }

    // Global mult lines (Mage synergy etc.)
    if (globalMult !== 1.0) {
      for (let i = 0; i < this.active.length; i++) {
        lines[i].push({ label: 'global synergy', mult: globalMult });
      }
    }

    let total = 0;
    const perCard = this.active.map((card, i) => {
      const final = Math.round(scores[i] * cardMults[i] * globalMult);
      total += final;
      return { card, rawBase: card.baseScore, final, lines: lines[i] };
    });

    return { total, perCard };
  }

  calcScore(ctx = {}) {
    return this.calcScoreBreakdown(ctx).total;
  }

  get allCards() { return [...this.active, ...this.bench]; }

  canAddToActive() { return this.active.length < this.maxActive; }
  canAddToBench()  { return this.bench.length < MAX_BENCH; }
  isFull()         { return !this.canAddToActive() && !this.canAddToBench(); }

  addToActive(card) {
    if (!this.canAddToActive()) throw new Error('Active board full');
    this.active.push(card);
  }

  addToBench(card) {
    if (!this.canAddToBench()) throw new Error('Bench full');
    this.bench.push(card);
  }

  addCard(card) {
    if (this.canAddToActive()) { this.active.push(card); return 'active'; }
    if (this.canAddToBench())  { this.bench.push(card);  return 'bench'; }
    throw new Error('No space on board or bench');
  }

  removeById(id) {
    for (const src of [this.active, this.bench]) {
      const idx = src.findIndex(c => c._id === id);
      if (idx !== -1) return src.splice(idx, 1)[0];
    }
    return null;
  }

  // Move bench card to active board. Returns true on success.
  moveToActive(id) {
    const idx = this.bench.findIndex(c => c._id === id);
    if (idx === -1 || !this.canAddToActive()) return false;
    this.active.push(this.bench.splice(idx, 1)[0]);
    return true;
  }

  // Move active card to bench. Returns true on success.
  moveToBench(id) {
    const idx = this.active.findIndex(c => c._id === id);
    if (idx === -1 || !this.canAddToBench()) return false;
    this.bench.push(this.active.splice(idx, 1)[0]);
    return true;
  }

  // Returns [{key, kind, count, bonus, nextThreshold}] for display.
  // Uses effective counts so DK / Lycan / Morphling phantom show up correctly.
  activeSynergies(ctx = {}) {
    const result = [];
    const { counts: speciesCounts } = effectiveSpeciesCounts(this, ctx);
    for (const [species, count] of Object.entries(speciesCounts)) {
      const syn = SYNERGIES[species];
      if (!syn) continue;
      const bonus         = syn.getBonus(count);
      const nextThreshold = syn.thresholds.find(t => t > count) || null;
      result.push({ key: species, kind: 'species', count, bonus, nextThreshold });
    }
    const { counts: classCounts } = effectiveClassCounts(this);
    for (const [cls, count] of Object.entries(classCounts)) {
      const syn = CLASS_SYNERGIES[cls];
      if (!syn) continue;
      const bonus         = syn.getBonus(count);
      const nextThreshold = syn.thresholds.find(t => t > count) || null;
      result.push({ key: cls, kind: 'class', count, bonus, nextThreshold });
    }
    return result;
  }

  synergyLine(ctx = {}) {
    const { counts } = effectiveSpeciesCounts(this, ctx);
    const parts = Object.entries(counts).map(([s, n]) => `${s}×${n}`);
    return parts.join(' ') || 'none';
  }
}

module.exports = { Board, MAX_BENCH, effectiveSpeciesCounts, cardHasSpeciesTag, effectiveClassCounts, cardHasClassTag };
