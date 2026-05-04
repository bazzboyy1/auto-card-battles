'use strict';

// Phase 27 — Judge Spine.
//
// Tastes are scoring rules; judges express tastes with personality.
// The score function takes the active board, a parallel array of per-card
// baseScores (Stages 0–1 of the legacy pipeline), and a ctx with whatever
// extra runtime data the rule needs (firedPassives, maxActive, round).
//
// Returned value is the round's Appraisal Value (rounded integer).
//
// Tastes are tuned to land in the same magnitude as the existing
// ROUND_TARGETS curve so the curve can be reused as a starting calibration.

function sumBase(baseScores) {
  let s = 0;
  for (let i = 0; i < baseScores.length; i++) s += baseScores[i];
  return s;
}

// Phase 28 — aesthetic tag readout. Cards declare 1–2 tags from
// {Grotesque, Elegant, Bizarre, Restrained, Ostentatious, Quaint}.
// Phase 31-B.3 — items with axis '5-tag' also grant tags (Aesthetic
// items: Velvet Drape, Gilded Frame, etc.); cardHasTag OR-checks both.
const { cardHasGrantedTag } = require('./items');

function cardHasTag(card, tag) {
  if (!card || !tag) return false;
  if (Array.isArray(card.tags) && card.tags.includes(tag)) return true;
  return cardHasGrantedTag(card, tag);
}

const TASTES = {
  spectacle: {
    name: 'Spectacle',
    flavor: 'A single triumph dwarfs the rest.',
    hint: 'Top card ×3, others ×0.9',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      let topIdx = 0;
      for (let i = 1; i < baseScores.length; i++) {
        if (baseScores[i] > baseScores[topIdx]) topIdx = i;
      }
      let total = baseScores[topIdx] * 3;
      for (let i = 0; i < baseScores.length; i++) {
        if (i !== topIdx) total += baseScores[i] * 0.9;
      }
      return Math.round(total);
    },
  },

  diversity: {
    name: 'Diversity',
    flavor: 'Variety is the soul of the salon.',
    hint: '+18% per unique species/class on board; duplicates score ×0.6',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const sp = new Set(), cl = new Set();
      for (const c of active) {
        if (c.species) sp.add(c.species);
        if (c.class)   cl.add(c.class);
      }
      const unique = sp.size + cl.size;
      const seenSp = new Set(), seenCl = new Set();
      let weighted = 0;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        const newSp = !seenSp.has(c.species);
        const newCl = c.class && !seenCl.has(c.class);
        const factor = (newSp || newCl) ? 1.0 : 0.6;
        weighted += baseScores[i] * factor;
        if (newSp) seenSp.add(c.species);
        if (newCl) seenCl.add(c.class);
      }
      return Math.round(weighted * (1 + 0.18 * unique));
    },
  },

  restraint: {
    name: 'Restraint',
    flavor: 'Less, but better.',
    hint: '≤3:×2.5 · 4:×1.9 · 5:×1.5 · 6:×1.2 · 7+:×1.0; +60 per empty plinth',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const n = active.length;
      let mult;
      if (n <= 3)       mult = 2.5;
      else if (n === 4) mult = 1.9;
      else if (n === 5) mult = 1.5;
      else if (n === 6) mult = 1.2;
      else              mult = 1.0;
      const sum = sumBase(baseScores);
      const maxActive = ctx.maxActive || n;
      const empty = Math.max(0, maxActive - n);
      return Math.round(sum * mult + empty * 60);
    },
  },

  eccentricity: {
    name: 'Eccentricity',
    flavor: 'Strange devices delight me — show me they DO something.',
    hint: 'Cards whose passive activated this round score ×1.6',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const fired = ctx.firedPassives || new Array(active.length).fill(false);
      let total = 0;
      for (let i = 0; i < baseScores.length; i++) {
        total += baseScores[i] * (fired[i] ? 1.6 : 1.0);
      }
      return Math.round(total);
    },
  },

  narrative: {
    name: 'Narrative',
    flavor: 'I prefer specimens with history.',
    hint: '+8% per round each card has been held (max +160%)',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      let total = 0;
      for (let i = 0; i < active.length; i++) {
        const r = Math.min(20, active[i].roundsSinceBought || 0);
        total += baseScores[i] * (1 + 0.08 * r);
      }
      return Math.round(total);
    },
  },

  harmony: {
    name: 'Harmony',
    flavor: 'A collection sings — or it does not.',
    hint: 'Class concentration: ×1 + 0.45 × (largest class count − 1)',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const counts = {};
      for (const c of active) {
        if (c.class) counts[c.class] = (counts[c.class] || 0) + 1;
      }
      let maxCount = 0;
      for (const k in counts) if (counts[k] > maxCount) maxCount = counts[k];
      const mult = 1 + 0.45 * Math.max(0, maxCount - 1);
      return Math.round(sumBase(baseScores) * mult);
    },
  },

  // Phase 28 — tag-reading tastes. Per-card mults driven by aesthetic tag.
  // Tag scarcity (Restrained/Elegant rarer than Grotesque/Bizarre/Ostentatious)
  // means the harshest tastes — Refinement and Architecture — force genuine
  // re-tooling. By design.

  // Phase 31-B.1: tag-reading tastes consume ctx.tagAmplify (default 1.0).
  // amp = 1.5 spreads each per-card mult away from 1.0 — so 1.85 -> 2.275 and
  // 0.75 -> 0.625. The Discerning Eye modifier sets amp = 1.5.
  grotesquerie: {
    name: 'Grotesquerie',
    flavor: 'Ugliness, but with conviction.',
    hint: 'Grotesque ×1.85 · Bizarre ×1.55 · Elegant ×0.75 · default ×1.4',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const amp = (ctx && typeof ctx.tagAmplify === 'number') ? ctx.tagAmplify : 1.0;
      let total = 0;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        let m = 1.4;
        if (cardHasTag(c, 'Grotesque')) m = Math.max(m, 1.85);
        if (cardHasTag(c, 'Bizarre'))   m = Math.max(m, 1.55);
        if (cardHasTag(c, 'Elegant'))   m = Math.min(m, 0.75);
        const mAmp = 1 + (m - 1) * amp;
        total += baseScores[i] * mAmp;
      }
      return Math.round(total);
    },
  },

  refinement: {
    name: 'Refinement',
    flavor: 'Polish over noise.',
    hint: 'Elegant ×2.2 · Restrained ×1.9 · Grotesque ×0.75 · default ×1.55',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const amp = (ctx && typeof ctx.tagAmplify === 'number') ? ctx.tagAmplify : 1.0;
      let total = 0;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        let m = 1.55;
        if (cardHasTag(c, 'Elegant'))    m = Math.max(m, 2.2);
        if (cardHasTag(c, 'Restrained')) m = Math.max(m, 1.9);
        if (cardHasTag(c, 'Grotesque'))  m = Math.min(m, 0.75);
        const mAmp = 1 + (m - 1) * amp;
        total += baseScores[i] * mAmp;
      }
      return Math.round(total);
    },
  },

  architecture: {
    name: 'Architecture',
    flavor: 'Form follows discipline.',
    hint: 'Restrained ×2.4 · Quaint ×1.7 · Bizarre ×0.85 · default ×1.45',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const amp = (ctx && typeof ctx.tagAmplify === 'number') ? ctx.tagAmplify : 1.0;
      let total = 0;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        let m = 1.45;
        if (cardHasTag(c, 'Restrained')) m = Math.max(m, 2.4);
        if (cardHasTag(c, 'Quaint'))     m = Math.max(m, 1.7);
        if (cardHasTag(c, 'Bizarre'))    m = Math.min(m, 0.85);
        const mAmp = 1 + (m - 1) * amp;
        total += baseScores[i] * mAmp;
      }
      return Math.round(total);
    },
  },

  ostentation: {
    name: 'Ostentation',
    flavor: 'Bigger. Louder. More.',
    hint: 'T1 ×1.05 · T2 ×1.3 · T3 ×1.6; Ostentatious ×1.5 · Quaint ×0.7',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const amp = (ctx && typeof ctx.tagAmplify === 'number') ? ctx.tagAmplify : 1.0;
      let total = 0;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        const tier = c.tier || 1;
        const tierMult = tier === 3 ? 1.6 : tier === 2 ? 1.3 : 1.05;
        let tagMult = 1.2;
        if (cardHasTag(c, 'Ostentatious')) tagMult = Math.max(tagMult, 1.5);
        if (cardHasTag(c, 'Quaint'))       tagMult = Math.min(tagMult, 0.7);
        const tagMultAmp = 1 + (tagMult - 1) * amp;
        total += baseScores[i] * tierMult * tagMultAmp;
      }
      return Math.round(total);
    },
  },

  // Phase 32 — Quaintness. Closes the dead-species gap: Sporal native tags
  // load heavily on Quaint (5/6 cards), but no existing taste rewarded Quaint
  // as a max-mult tag. Quaintness fixes that — Sporal-stack survival rises
  // from 19% to ~30% under random-judge runs without any species/card edits.
  // Mirrors the Refinement shape (max-mult ×2.2 on the home tag, secondary
  // ×1.55 on a complementary tag, hard ×0.7 penalty on the opposite).
  quaintness: {
    name: 'Quaintness',
    flavor: 'It\'s the small charms that linger.',
    hint: 'Quaint ×2.2 · Restrained ×1.55 · Ostentatious ×0.7 · default ×1.4',
    score(active, baseScores, ctx) {
      if (!active.length) return 0;
      const amp = (ctx && typeof ctx.tagAmplify === 'number') ? ctx.tagAmplify : 1.0;
      let total = 0;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        let m = 1.4;
        if (cardHasTag(c, 'Quaint'))       m = Math.max(m, 2.2);
        if (cardHasTag(c, 'Restrained'))   m = Math.max(m, 1.55);
        if (cardHasTag(c, 'Ostentatious')) m = Math.min(m, 0.7);
        const mAmp = 1 + (m - 1) * amp;
        total += baseScores[i] * mAmp;
      }
      return Math.round(total);
    },
  },
};

// Twenty judges expressing the eleven tastes. Some tastes have multiple judges
// with different flavor; some are flagged 'finale' (eligible for R24 only)
// so the Grand Finale always feels distinct.
//
// Phase 32 — each judge carries:
//   glyph    — one unicode mark for slate/panel rendering
//   band     — CSS class (one per taste, mapped in style.css)
//   quotes   — { opening, passing, scraping, failing } prose lines
//              opening   shown at chapter reveal
//              passing   score >= 110% of threshold
//              scraping  score 100-110% of threshold
//              failing   score < 100% of threshold
const JUDGES = [
  // — Spectacle —
  { id: 'vex',  name: 'Madame Vex', taste: 'spectacle', chapter: 'any', glyph: '✦', band: 'judge-spectacle',
    flavor: 'One brilliant specimen, or none at all.',
    quotes: {
      opening: 'I expect to be dazzled. Bring me one specimen worth remembering.',
      passing: 'Yes. THAT is what an exhibition should feel like.',
      scraping: 'A glimmer. I will allow it.',
      failing: 'A wasted plinth. A wasted hour. A wasted seal.',
    } },
  { id: 'maelo', name: 'Critic Mæló', taste: 'spectacle', chapter: 'finale', glyph: '☄', band: 'judge-spectacle',
    flavor: 'Show me what greatness looks like.',
    quotes: {
      opening: 'The finale. Either you have a centerpiece, or you have nothing.',
      passing: 'A genuine moment. I will remember this.',
      scraping: 'You scraped through. I scrape my approval.',
      failing: 'No centerpiece. No legacy. Next.',
    } },
  // — Diversity —
  { id: 'thorne', name: 'Curator Thorne', taste: 'diversity', chapter: 'any', glyph: '❀', band: 'judge-diversity',
    flavor: 'Variety is the soul of the salon.',
    quotes: {
      opening: 'A salon needs breadth. Show me you can collect more than one note.',
      passing: 'A garden of unlike things. Refreshing.',
      scraping: 'Some variety, at least. Barely a salon.',
      failing: 'A monoculture. I am unmoved.',
    } },
  { id: 'oblix', name: 'Inspector Oblix', taste: 'diversity', chapter: 'any', glyph: '👁', band: 'judge-diversity',
    flavor: 'Repetition bores. Surprise me.',
    quotes: {
      opening: 'I have already seen one of those. Do not show me three.',
      passing: 'Now THIS is an inventory worth inspecting.',
      scraping: 'Acceptable spread. Just.',
      failing: 'You have shown me the same specimen wearing different hats.',
    } },
  // — Restraint —
  { id: 'umbra', name: 'Sister Umbra', taste: 'restraint', chapter: 'any', glyph: '◌', band: 'judge-restraint',
    flavor: 'Empty space is a statement.',
    quotes: {
      opening: 'Less. Show me less. The eye needs room to breathe.',
      passing: 'A devotional sparseness. The salon is hushed.',
      scraping: 'A little crowded. The discipline is there.',
      failing: 'A jumble. You have mistaken volume for value.',
    } },
  { id: 'vell', name: 'Brother Vell', taste: 'restraint', chapter: 'finale', glyph: '🕯', band: 'judge-restraint',
    flavor: 'A sparse plinth speaks loudest.',
    quotes: {
      opening: 'For the finale: hold something back. Restraint at the climax is the rarest gift.',
      passing: 'You understood the assignment. The empty plinths are the loudest.',
      scraping: 'You hesitated. You should have hesitated more.',
      failing: 'A finale should not be a parade. It should be a vow.',
    } },
  // — Eccentricity —
  { id: 'quark', name: 'Cataloguer Quark', taste: 'eccentricity', chapter: 'any', glyph: '⚙', band: 'judge-eccentricity',
    flavor: 'I want to see them DO something.',
    quotes: {
      opening: 'I am not here to admire taxidermy. I want to see them ACT.',
      passing: 'Every plinth firing. The salon is alive.',
      scraping: 'Some movement. I require more.',
      failing: 'Inert. Inert. Inert. I came here for theatre.',
    } },
  { id: 'flux', name: 'Engineer Flux', taste: 'eccentricity', chapter: 'finale', glyph: '⚡', band: 'judge-eccentricity',
    flavor: 'Inert specimens insult me.',
    quotes: {
      opening: 'A finale of mannequins is a betrayal. Make them move.',
      passing: 'Now THIS is what apparatus is for.',
      scraping: 'A few sparks. I expected fire.',
      failing: 'Dead weights on plinths. Get them out of my sight.',
    } },
  // — Narrative —
  { id: 'ronix', name: 'Archivist Ronix', taste: 'narrative', chapter: 'any', glyph: '📜', band: 'judge-narrative',
    flavor: 'I prefer specimens with history.',
    quotes: {
      opening: 'Every specimen should have a provenance. New acquisitions bore me.',
      passing: 'A rich archive. Every plinth has a story.',
      scraping: 'A little new. A little old. A library half-shelved.',
      failing: 'Just bought, all of it. The salon is not a market.',
    } },
  { id: 'praxis', name: 'Curator Praxis', taste: 'narrative', chapter: 'any', glyph: '⏳', band: 'judge-narrative',
    flavor: 'Time leaves its mark on the worthy.',
    quotes: {
      opening: 'Show me the patina of long custodianship.',
      passing: 'Time has weighed in on every plinth. I approve.',
      scraping: 'Thin in places. The archive lacks depth.',
      failing: 'Fresh from the market. The salon is not a stall.',
    } },
  // — Harmony —
  { id: 'yorzal', name: 'Judge Yorzal', taste: 'harmony', chapter: 'any', glyph: '♪', band: 'judge-harmony',
    flavor: 'Emotional coherence — nothing less.',
    quotes: {
      opening: 'Pick a mood. Commit to it. Anything else is noise.',
      passing: 'A single chord, perfectly held. Bravo.',
      scraping: 'The mood wavers. I can almost hear it.',
      failing: 'Five contradictory feelings, all of them shrill.',
    } },
  { id: 'symphonia', name: 'Maestra Symphonia', taste: 'harmony', chapter: 'finale', glyph: '🎼', band: 'judge-harmony',
    flavor: 'A collection sings or it does not.',
    quotes: {
      opening: 'The finale must be of one voice. Not a chorus — a soloist.',
      passing: 'It SANG. Every plinth in the same key.',
      scraping: 'A few off-notes. The melody survived.',
      failing: 'A din. The finale collapsed into static.',
    } },
  // — Grotesquerie —
  { id: 'morgath', name: 'Patron Morgath', taste: 'grotesquerie', chapter: 'any', glyph: '☠', band: 'judge-grotesquerie',
    flavor: 'Beauty is for cowards.',
    quotes: {
      opening: 'I have no use for the pretty. Bring me what unsettles.',
      passing: 'Magnificently repulsive. I will weep.',
      scraping: 'A faint queasiness. It is something.',
      failing: 'You have brought me decoration. I asked for dread.',
    } },
  { id: 'vlasq', name: 'Lord Vlasq', taste: 'grotesquerie', chapter: 'finale', glyph: '🦴', band: 'judge-grotesquerie',
    flavor: 'Show me what should not be.',
    quotes: {
      opening: 'The finale: an offence to the taxonomies. Make it impossible.',
      passing: 'A masterclass in transgression. I salute it.',
      scraping: 'A small wrongness. Bigger next time.',
      failing: 'Tasteful. The worst possible verdict.',
    } },
  // — Refinement —
  { id: 'sereth', name: 'Madame Sereth', taste: 'refinement', chapter: 'any', glyph: '✧', band: 'judge-refinement',
    flavor: 'Spare me the spectacle.',
    quotes: {
      opening: 'Polish. That is all I want. Polish over noise.',
      passing: 'A polished case from end to end. Civilised.',
      scraping: 'A little gauche in the corners.',
      failing: 'A junk drawer with delusions. Take it away.',
    } },
  // — Architecture —
  { id: 'ostrev', name: 'Architect Ostrev', taste: 'architecture', chapter: 'any', glyph: '▣', band: 'judge-architecture',
    flavor: 'A collection should hold its shape.',
    quotes: {
      opening: 'A collection is a structure. Show me your load-bearing plinths.',
      passing: 'Every element bearing weight. The whole stands.',
      scraping: 'Wobbles, but holds. Reinforce next time.',
      failing: 'A pile. Architecture is the opposite of a pile.',
    } },
  // — Ostentation —
  { id: 'glamora', name: 'Baroness Glamora', taste: 'ostentation', chapter: 'any', glyph: '💎', band: 'judge-ostentation',
    flavor: 'Modesty is a failure of nerve.',
    quotes: {
      opening: 'I want to be EMBARRASSED on your behalf. Go louder.',
      passing: 'Vulgar. Lavish. Magnificent. I am gleaming.',
      scraping: 'A little subdued. Risk something.',
      failing: 'A whisper where I asked for a scream.',
    } },
  { id: 'rakthar', name: 'Lord Rakthar', taste: 'ostentation', chapter: 'finale', glyph: '👑', band: 'judge-ostentation',
    flavor: 'Astonish me — or do not bother.',
    quotes: {
      opening: 'The finale should arrive in gold leaf. Anything less is an apology.',
      passing: 'STAGGERING. I will be telling this story for years.',
      scraping: 'A flicker of grandeur. Insufficient.',
      failing: 'A finale fit for a side hall. I am insulted.',
    } },
  // — Quaintness — (Phase 32)
  { id: 'mossfen', name: 'Auntie Mossfen', taste: 'quaintness', chapter: 'any', glyph: '🌿', band: 'judge-quaintness',
    flavor: 'It\'s the small things that comfort the eye.',
    quotes: {
      opening: 'Don\'t fuss. Show me something cozy. Something with a face.',
      passing: 'Oh, what a dear little salon. I should like to live in it.',
      scraping: 'Sweet enough. A bit fancy in places, dear.',
      failing: 'All glitter, no warmth. I shall have to pass.',
    } },
  { id: 'burrowick', name: 'Dame Burrowick', taste: 'quaintness', chapter: 'finale', glyph: '🪵', band: 'judge-quaintness',
    flavor: 'Greatness need not roar to be felt.',
    quotes: {
      opening: 'The finale: I want to feel a hearth. Something to sit beside.',
      passing: 'A hearth indeed. The whole hall warmed.',
      scraping: 'A small ember. I will take it.',
      failing: 'Cold. Bright, but cold.',
    } },
];

// Phase 33-B.3.C — per-card breakdown surface.
//
// `tasteLineBreakdown(tasteId, active, baseScores, ctx)` returns
//   { perCard: [{ final, lines }], extraLines: { i: [...] } }
// where `final` is the post-taste score for that card (un-rounded) and
// `lines` is an array of { label, mult } / { label, add } entries describing
// the taste's contribution. Consumers append these onto the existing
// per-card lines emitted by Board.calcBaseBreakdown so the scoring modal
// can show a fully-attributed breakdown.
//
// Sum of Math.round(final) may differ from taste.score(...) by 1–3 due to
// taste.score rounding once at the end. The total returned by .score remains
// authoritative for round outcomes.
function tasteLineBreakdown(tasteId, active, baseScores, ctx) {
  const empty = { perCard: active.map(() => ({ final: 0, lines: [] })) };
  if (!active.length) return empty;
  const amp = (ctx && typeof ctx.tagAmplify === 'number') ? ctx.tagAmplify : 1.0;
  const ampSuffix = amp !== 1.0 ? ` ×amp${amp}` : '';
  const taste = TASTES[tasteId];
  const tasteName = taste ? taste.name : tasteId;
  const perCard = active.map(() => ({ final: 0, lines: [] }));

  if (tasteId === 'spectacle') {
    let topIdx = 0;
    for (let i = 1; i < baseScores.length; i++) if (baseScores[i] > baseScores[topIdx]) topIdx = i;
    for (let i = 0; i < active.length; i++) {
      const m = i === topIdx ? 3 : 0.9;
      perCard[i].final = baseScores[i] * m;
      perCard[i].lines.push({ label: i === topIdx ? `${tasteName}: top exhibit` : `${tasteName}: off-piece`, mult: m });
    }
    return { perCard };
  }

  if (tasteId === 'diversity') {
    const sp = new Set(), cl = new Set();
    for (const c of active) { if (c.species) sp.add(c.species); if (c.class) cl.add(c.class); }
    const unique = sp.size + cl.size;
    const globalMult = 1 + 0.18 * unique;
    const seenSp = new Set(), seenCl = new Set();
    for (let i = 0; i < active.length; i++) {
      const c = active[i];
      const newSp = !seenSp.has(c.species);
      const newCl = c.class && !seenCl.has(c.class);
      const factor = (newSp || newCl) ? 1.0 : 0.6;
      perCard[i].final = baseScores[i] * factor * globalMult;
      if (factor !== 1.0) perCard[i].lines.push({ label: `${tasteName}: duplicate`, mult: factor });
      perCard[i].lines.push({ label: `${tasteName}: ${unique} unique`, mult: globalMult });
      if (newSp) seenSp.add(c.species);
      if (newCl) seenCl.add(c.class);
    }
    return { perCard };
  }

  if (tasteId === 'restraint') {
    const n = active.length;
    let mult;
    if (n <= 3)       mult = 2.5;
    else if (n === 4) mult = 1.9;
    else if (n === 5) mult = 1.5;
    else if (n === 6) mult = 1.2;
    else              mult = 1.0;
    const maxActive = (ctx && ctx.maxActive) || n;
    const empty = Math.max(0, maxActive - n);
    const flatTotal = empty * 60;
    const perCardFlat = active.length > 0 ? flatTotal / active.length : 0;
    for (let i = 0; i < active.length; i++) {
      perCard[i].final = baseScores[i] * mult + perCardFlat;
      perCard[i].lines.push({ label: `${tasteName}: ${n} active`, mult });
      if (empty > 0 && i === 0) {
        perCard[0].lines.push({ label: `${tasteName}: ${empty} empty plinth${empty === 1 ? '' : 's'}`, add: flatTotal });
      }
    }
    return { perCard };
  }

  if (tasteId === 'eccentricity') {
    const fired = (ctx && ctx.firedPassives) || new Array(active.length).fill(false);
    for (let i = 0; i < active.length; i++) {
      const m = fired[i] ? 1.6 : 1.0;
      perCard[i].final = baseScores[i] * m;
      if (fired[i]) perCard[i].lines.push({ label: `${tasteName}: passive fired`, mult: 1.6 });
    }
    return { perCard };
  }

  if (tasteId === 'narrative') {
    for (let i = 0; i < active.length; i++) {
      const r = Math.min(20, active[i].roundsSinceBought || 0);
      const m = 1 + 0.08 * r;
      perCard[i].final = baseScores[i] * m;
      if (r > 0) perCard[i].lines.push({ label: `${tasteName}: held ${r} round${r === 1 ? '' : 's'}`, mult: m });
    }
    return { perCard };
  }

  if (tasteId === 'harmony') {
    const counts = {};
    for (const c of active) if (c.class) counts[c.class] = (counts[c.class] || 0) + 1;
    let maxCount = 0;
    for (const k in counts) if (counts[k] > maxCount) maxCount = counts[k];
    const m = 1 + 0.45 * Math.max(0, maxCount - 1);
    for (let i = 0; i < active.length; i++) {
      perCard[i].final = baseScores[i] * m;
      if (m !== 1) perCard[i].lines.push({ label: `${tasteName}: largest class ${maxCount}`, mult: m });
    }
    return { perCard };
  }

  // Tag-mult tastes — each computes a per-card mult and (optionally) amplifies it.
  const tagTasteRules = {
    grotesquerie: { base: 1.4, max: [['Grotesque', 1.85], ['Bizarre', 1.55]],   min: [['Elegant', 0.75]] },
    refinement:   { base: 1.55, max: [['Elegant', 2.2], ['Restrained', 1.9]],   min: [['Grotesque', 0.75]] },
    architecture: { base: 1.45, max: [['Restrained', 2.4], ['Quaint', 1.7]],    min: [['Bizarre', 0.85]] },
    quaintness:   { base: 1.4,  max: [['Quaint', 2.2], ['Restrained', 1.55]],   min: [['Ostentatious', 0.7]] },
  };

  if (tagTasteRules[tasteId]) {
    const rules = tagTasteRules[tasteId];
    for (let i = 0; i < active.length; i++) {
      const c = active[i];
      let m = rules.base;
      let trigger = `default`;
      let triggerM = m;
      for (const [tag, mm] of rules.max) {
        if (cardHasTag(c, tag) && mm > m) { m = mm; trigger = tag; triggerM = mm; }
      }
      for (const [tag, mm] of rules.min) {
        if (cardHasTag(c, tag) && mm < m) { m = mm; trigger = tag; triggerM = mm; }
      }
      const mAmp = 1 + (m - 1) * amp;
      perCard[i].final = baseScores[i] * mAmp;
      perCard[i].lines.push({ label: `${tasteName}: ${trigger}${ampSuffix}`, mult: mAmp });
    }
    return { perCard };
  }

  if (tasteId === 'ostentation') {
    for (let i = 0; i < active.length; i++) {
      const c = active[i];
      const tier = c.tier || 1;
      const tierMult = tier === 3 ? 1.6 : tier === 2 ? 1.3 : 1.05;
      let tagMult = 1.2;
      let trigger = 'default';
      if (cardHasTag(c, 'Ostentatious') && 1.5 > tagMult) { tagMult = 1.5; trigger = 'Ostentatious'; }
      if (cardHasTag(c, 'Quaint') && 0.7 < tagMult)        { tagMult = 0.7; trigger = 'Quaint'; }
      const tagMultAmp = 1 + (tagMult - 1) * amp;
      perCard[i].final = baseScores[i] * tierMult * tagMultAmp;
      perCard[i].lines.push({ label: `${tasteName}: T${tier}`, mult: tierMult });
      perCard[i].lines.push({ label: `${tasteName}: ${trigger}${ampSuffix}`, mult: tagMultAmp });
    }
    return { perCard };
  }

  // Unknown taste — return empty breakdown with each card unchanged.
  for (let i = 0; i < active.length; i++) perCard[i].final = baseScores[i];
  return { perCard };
}

function getTaste(id)  { return TASTES[id] || null; }
function getJudge(id)  { return JUDGES.find(j => j.id === id) || null; }

// Draw a 4-judge slate (3 chapters + 1 finale) without taste repeats.
// rng() returns [0, 1). Callers pass the run rng so seeds are reproducible.
function drawJudgeSlate(rng) {
  const finalePool = JUDGES.filter(j => j.chapter === 'finale' || j.chapter === 'any');
  const finale = finalePool[Math.floor(rng() * finalePool.length)];

  const usedTastes = new Set([finale.taste]);
  const chapterPool = JUDGES.filter(j =>
    j.chapter === 'any' && j.id !== finale.id && !usedTastes.has(j.taste)
  );
  // Shuffle in place via Fisher-Yates with the provided rng.
  const pool = chapterPool.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const chapters = [];
  for (const j of pool) {
    if (chapters.length >= 3) break;
    if (!usedTastes.has(j.taste)) {
      chapters.push(j);
      usedTastes.add(j.taste);
    }
  }
  // If pool was thin (shouldn't happen with current data), pad with any-chapter judges.
  while (chapters.length < 3) {
    const fallback = JUDGES.find(j =>
      j.chapter !== 'finale' && !chapters.includes(j) && j.id !== finale.id
    );
    if (!fallback) break;
    chapters.push(fallback);
  }

  return [chapters[0].id, chapters[1].id, chapters[2].id, finale.id];
}

module.exports = { TASTES, JUDGES, getTaste, getJudge, drawJudgeSlate, cardHasTag, tasteLineBreakdown };
