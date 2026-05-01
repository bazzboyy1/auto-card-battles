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
// Items/augments may grant tags in later phases via the same shape;
// for now only card.tags is checked.
function cardHasTag(card, tag) {
  if (!card || !tag) return false;
  return Array.isArray(card.tags) && card.tags.includes(tag);
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
};

// Twelve judges expressing the six tastes. Some tastes have multiple judges
// with different flavor; some are flagged 'finale' (eligible for R24 only)
// so the Grand Finale always feels distinct.
const JUDGES = [
  { id: 'vex',        name: 'Madame Vex',        taste: 'spectacle',    chapter: 'any',    flavor: 'One brilliant specimen, or none at all.' },
  { id: 'maelo',      name: 'Critic Mæló',       taste: 'spectacle',    chapter: 'finale', flavor: 'Show me what greatness looks like.' },
  { id: 'thorne',     name: 'Curator Thorne',    taste: 'diversity',    chapter: 'any',    flavor: 'Variety is the soul of the salon.' },
  { id: 'oblix',      name: 'Inspector Oblix',   taste: 'diversity',    chapter: 'any',    flavor: 'Repetition bores. Surprise me.' },
  { id: 'umbra',      name: 'Sister Umbra',      taste: 'restraint',    chapter: 'any',    flavor: 'Empty space is a statement.' },
  { id: 'vell',       name: 'Brother Vell',      taste: 'restraint',    chapter: 'finale', flavor: 'A sparse plinth speaks loudest.' },
  { id: 'quark',      name: 'Cataloguer Quark',  taste: 'eccentricity', chapter: 'any',    flavor: 'I want to see them DO something.' },
  { id: 'flux',       name: 'Engineer Flux',     taste: 'eccentricity', chapter: 'finale', flavor: 'Inert specimens insult me.' },
  { id: 'ronix',      name: 'Archivist Ronix',   taste: 'narrative',    chapter: 'any',    flavor: 'I prefer specimens with history.' },
  { id: 'praxis',     name: 'Curator Praxis',    taste: 'narrative',    chapter: 'any',    flavor: 'Time leaves its mark on the worthy.' },
  { id: 'yorzal',     name: 'Judge Yorzal',      taste: 'harmony',      chapter: 'any',    flavor: 'Emotional coherence — nothing less.' },
  { id: 'symphonia',  name: 'Maestra Symphonia', taste: 'harmony',      chapter: 'finale', flavor: 'A collection sings or it does not.' },
  // Phase 28 — tag-reading judges.
  { id: 'morgath',    name: 'Patron Morgath',    taste: 'grotesquerie', chapter: 'any',    flavor: 'Beauty is for cowards.' },
  { id: 'vlasq',      name: 'Lord Vlasq',        taste: 'grotesquerie', chapter: 'finale', flavor: 'Show me what should not be.' },
  { id: 'sereth',     name: 'Madame Sereth',     taste: 'refinement',   chapter: 'any',    flavor: 'Spare me the spectacle.' },
  { id: 'ostrev',     name: 'Architect Ostrev',  taste: 'architecture', chapter: 'any',    flavor: 'A collection should hold its shape.' },
  { id: 'glamora',    name: 'Baroness Glamora',  taste: 'ostentation',  chapter: 'any',    flavor: 'Modesty is a failure of nerve.' },
  { id: 'rakthar',    name: 'Lord Rakthar',      taste: 'ostentation',  chapter: 'finale', flavor: 'Astonish me — or do not bother.' },
];

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

module.exports = { TASTES, JUDGES, getTaste, getJudge, drawJudgeSlate, cardHasTag };
