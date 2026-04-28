'use strict';

// ── Module refs ───────────────────────────────────────────────────────────────
let mulberry32, CARD_DEFS, CARD_COSTS, SYNERGIES, CLASS_SYNERGIES, STAR_MULT;
let Run, POLICIES, BASE_INCOME, INTEREST_PER, HEAD_JUDGES, CHAPTER_LABELS, ROUND_TARGETS, CURATOR_SELECTIONS;
let ITEM_DEFS, attachItem, detachItem;
let AUGMENT_DEFS;
let LEVEL_WEIGHTS;
let effectiveSpeciesCounts, effectiveClassCounts;
let RANKING;
let ACHIEVEMENTS_LIST, evaluateAchievements, isUnlocked, addUnlock;
const DEV_MODE = typeof window !== 'undefined' && /[?&]dev=1\b/.test(window.location.search || '');

const CLASS_GLYPHS = { Shy: '◌', Livid: '◆', Giddy: '◈', Sullen: '▪', Pompous: '▲' };

// ── State ─────────────────────────────────────────────────────────────────────
const S = {
  run:            null,
  human:          null,
  // phases: 'augment' | 'shapeshifter' | 'item' | 'shop' | 'scoring' | 'over'
  phase:          'shop',
  result:         null,
  sellMode:       false,
  augmentOffer:   null,  // current 3-id augment offer being displayed
  itemOffer:      null,  // current 3-id item offer being displayed
  curatorOffer:   null,  // curator's selection after a critique round
  attachItem:     null,  // itemId currently in attach mode
  archetypeOrder: [],    // ordered archetype names; most recently triggered first
};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('acb-ready', () => {
  ({ mulberry32 }                                  = window.ACB.utils);
  ({ CARD_DEFS, CARD_COSTS, SYNERGIES, CLASS_SYNERGIES, STAR_MULT } = window.ACB.cards);
  ({ Run, BASE_INCOME, INTEREST_PER, HEAD_JUDGES, CHAPTER_LABELS, ROUND_TARGETS, CURATOR_SELECTIONS } = window.ACB.game);
  ({ POLICIES }                                    = window.ACB.sim);
  ({ ITEM_DEFS, attachItem, detachItem }           = window.ACB.items);
  ({ AUGMENT_DEFS }                                = window.ACB.augments);
  ({ effectiveSpeciesCounts, effectiveClassCounts } = window.ACB.board);
  ({ LEVEL_WEIGHTS }                               = window.ACB.shop);
  RANKING = window.ACB.ranking;
  ({ ACHIEVEMENTS: ACHIEVEMENTS_LIST, evaluateAchievements, isUnlocked, addUnlock } = window.ACB.achievements);

  qs('#btn-ready').onclick    = onReady;
  qs('#btn-continue').onclick = onContinue;
  qs('#btn-reroll').onclick   = onReroll;
  qs('#btn-lock').onclick     = onLock;
  qs('#btn-plinth').onclick   = onAddPlinth;
  qs('#btn-mute').onclick     = () => {
    const m = Sound.toggleMute();
    qs('#btn-mute').textContent = m ? '♪ off' : '♪ on';
  };
  qs('#btn-plinth').addEventListener('mouseenter', () => clampTooltipH(qs('#btn-plinth'), 210));
  qs('#btn-sell').onclick     = onToggleSell;

  newGame();
  renderDifficultyPicker(qs('#difficulty-selector'));

  qs('#btn-start').onclick = () => {
    Sound.play('roundStart');
    qs('#btn-start').disabled = true;
    qs('#loading').classList.add('hidden');
    showRulesModal();
  };
  qs('#btn-collection').onclick = showCollectionModal;
});

// ── Rules modal ───────────────────────────────────────────────────────────────
function showRulesModal() {
  const overlay = document.createElement('div');
  overlay.id = 'rules-overlay';
  overlay.innerHTML = `
    <div id="rules-box">
      <div id="rules-header">
        <h2>How to Play</h2>
        <p class="rules-subtitle">The galaxy's most discerning judges are watching. Don't embarrass yourself.</p>
      </div>
      <ul class="rules-list">
        <li><strong>Buy</strong> specimens from the market · place them in your <strong>Exhibit</strong> · hit <strong>Ready</strong></li>
        <li><strong>Each round</strong> your exhibit is judged against a target score — miss it and lose a Seal</li>
        <li>Lose all 3 Seals and your run ends · Beat a <strong>Critique</strong> round by 25%+ to restore one</li>
        <li><strong>3 copies</strong> of the same specimen auto-combine into a higher ★ version</li>
        <li>Match <strong class="c-species">Species</strong> or <strong class="c-class">Class</strong> across exhibits for synergy bonuses</li>
        <li>Save gold to earn <strong>interest</strong> · upgrade your exhibit for more slots and rarer specimens</li>
        <li>Every few rounds pick a permanent <strong class="c-aug">Augment</strong> or an <strong class="c-item">Item</strong> to attach to a specimen</li>
      </ul>
      <div class="rules-footer">
        <button id="rules-dismiss" class="btn-primary">Play</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#rules-dismiss').onclick = () => {
    Sound.play('roundStart');
    overlay.remove();
    qs('#app').classList.remove('hidden');
  };
}

// ── Difficulty picker ─────────────────────────────────────────────────────────
function renderDifficultyPicker(containerEl) {
  if (!containerEl || !RANKING) return;
  const state = RANKING.loadTierState();
  containerEl.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'diff-row';
  for (const tier of RANKING.TIERS) {
    const unlocked = state.unlocked.includes(tier.id);
    const active   = state.active === tier.id;
    const btn = document.createElement('button');
    btn.className = 'diff-btn' + (active ? ' active' : '') + (unlocked ? '' : ' locked');
    const multLabel = tier.mult !== 1.0 ? ` ×${tier.mult}` : '';
    btn.textContent = (unlocked ? '' : '🔒 ') + tier.label + multLabel;
    if (unlocked && !active) {
      btn.onclick = () => {
        RANKING.setActiveTier(tier.id);
        // Refresh all open pickers and the HUD label.
        const splash = qs('#difficulty-selector');
        if (splash) renderDifficultyPicker(splash);
        const modal  = qs('#modal-diff-picker');
        if (modal)  renderDifficultyPicker(modal);
        updateHUDDifficulty();
      };
    } else if (!unlocked) {
      const prev = RANKING.TIERS[RANKING.TIERS.findIndex(t => t.id === tier.id) - 1];
      btn.title    = `Complete ${prev ? prev.label : 'previous tier'} to unlock`;
      btn.disabled = true;
    }
    row.appendChild(btn);
  }
  containerEl.appendChild(row);
}

function updateHUDDifficulty() {
  const el = qs('#hud-difficulty');
  if (!el || !RANKING) return;
  const tier = RANKING.getActiveTier();
  el.textContent = tier.label;
  el.className = 'stat-dim hud-diff' +
    (tier.id === 'elite'      ? ' diff-elite'      :
     tier.id === 'discerning' ? ' diff-discerning' : '');
}

// ── New game ──────────────────────────────────────────────────────────────────
function newGame() {
  const tier = RANKING ? RANKING.getActiveTier() : { mult: 1.0 };
  const rng  = mulberry32(Date.now() | 0);
  S.run      = new Run(rng, tier.mult);
  S.human    = S.run.player;
  S.human.isHuman = true;
  S.human.name    = 'You';
  S.phase          = 'shop';
  S.sellMode       = false;
  S.itemOffer      = null;
  S.curatorOffer   = null;
  S.attachItem     = null;
  S.archetypeOrder = [];
  // Re-wire continue button (game-over handler overrides it).
  qs('#btn-continue').onclick = onContinue;
  startRound();
}

// ── Round flow ────────────────────────────────────────────────────────────────

function showAttentionToast(msg) {
  Sound.play('augmentPing');
  const el = document.createElement('div');
  el.className = 'attention-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function showChapterReveal(chapter, judge) {
  const label = CHAPTER_LABELS[chapter - 1] || `Chapter ${chapter}`;
  const el = document.createElement('div');
  el.className = 'chapter-reveal';
  el.innerHTML = `
    <div class="chapter-reveal-label">Chapter ${chapter}</div>
    <div class="chapter-reveal-chapter">${label}</div>
    <div class="chapter-reveal-judge">${judge.name}</div>
    <div class="chapter-reveal-pref">${judge.preference}</div>
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 420);
  }, 2200);
}

// Render the judge panel below the HUD sub-row.
function renderJudgePanel() {
  const panel = qs('#judge-panel');
  if (!panel) return;
  const nextRound = S.run.round + 1;
  if (nextRound > 24) { panel.classList.add('hidden'); return; }

  const chapter = S.run.chapterFor(nextRound);
  const judge   = S.run.currentJudge(nextRound);
  if (!judge) { panel.classList.add('hidden'); return; }

  const chapterLabel = CHAPTER_LABELS[chapter - 1] || `Chapter ${chapter}`;
  const qualifying   = !judge.isNeutral && judge.qualifies(S.human.board, S.run.augments);
  const tEntry       = ROUND_TARGETS && ROUND_TARGETS[nextRound - 1];
  const normalTarget    = tEntry ? tEntry.target : null;
  const preferredTarget = tEntry ? tEntry.preferredTarget : null;
  const isCritiqueNext  = tEntry ? tEntry.isCritique : false;
  const critiqueTag     = isCritiqueNext ? ' <span class="judge-critique-tag">★ Critique</span>' : '';

  let statusHtml;
  if (judge.isNeutral) {
    const tStr = normalTarget !== null ? ` · Target: <strong>${normalTarget}</strong>` : '';
    statusHtml = `<span class="judge-not-qualifying">All equally scored${tStr}</span>`;
  } else if (qualifying) {
    const tStr = preferredTarget !== null ? `<strong>${preferredTarget}</strong>` : '−15%';
    const hint = judge.qualifyingHint ? `${judge.qualifyingHint} → ` : '';
    statusHtml = `<span class="judge-qualifying">✓ ${hint}Target: ${tStr}</span>`;
  } else {
    const tNorm = normalTarget !== null ? `<strong>${normalTarget}</strong>` : '';
    const tPref = preferredTarget !== null ? ` <span class="judge-pref-hint">(${preferredTarget} if met)</span>` : '';
    statusHtml = `<span class="judge-not-qualifying">${judge.qualifyingHint} → ${tNorm}${tPref}</span>`;
  }

  panel.innerHTML = `
    <span class="judge-chapter">Ch.${chapter} · ${chapterLabel}${critiqueTag}</span>
    <span class="judge-divider">|</span>
    <span class="judge-name">${judge.name}</span>
    <span class="judge-pref">"${judge.preference}"</span>
    ${statusHtml}
  `;
  panel.classList.remove('hidden');

  // Keep target visible in the persistent HUD sub-row.
  const targetPreviewEl = qs('#target-preview');
  if (targetPreviewEl && normalTarget !== null) {
    const showTarget = (qualifying && preferredTarget) ? preferredTarget : normalTarget;
    const label = (qualifying && preferredTarget)
      ? `Target: ${showTarget} (preferred)`
      : `Target: ${showTarget}`;
    targetPreviewEl.textContent = label;
    targetPreviewEl.className = qualifying ? 'qualifying' : '';
  } else if (targetPreviewEl) {
    targetPreviewEl.textContent = '';
    targetPreviewEl.className = '';
  }
}

// ── Archetype detection ───────────────────────────────────────────────────────

function detectArchetypes() {
  const board  = S.human.board;
  const active = board.active;
  if (!active.length) return [];

  const { counts: sc } = effectiveSpeciesCounts(board, { augments: S.run.augments, player: S.human });
  const { counts: cc } = effectiveClassCounts(board);

  const found = [];

  if ((sc['Plasmic']     || 0) >= 4) found.push('Plasma Cascade');
  if ((sc['Abyssal']     || 0) >= 4) found.push('Void Assembly');

  const hasSprangus = active.some(c => c.name === 'Sprangus');
  const otherSporal = active.filter(c => c.species === 'Sporal' && c.name !== 'Sprangus').length;
  if (hasSprangus && otherSporal >= 2) found.push('Spore Engine');

  if ((sc['Crystalline'] || 0) >= 4) found.push('Crystal Lattice');
  if ((sc['Chitinous']   || 0) >= 3) found.push('Chitin Wall');

  const activeClassSyns = Object.keys(CLASS_SYNERGIES).filter(
    cls => (cc[cls] || 0) >= CLASS_SYNERGIES[cls].thresholds[0]
  );
  if (activeClassSyns.length >= 3) found.push('Emotional Spectrum');

  const patientCount = active.filter(c => (c.roundsSinceBought || 0) >= 10).length;
  if (patientCount >= 3) found.push('Patient Collection');

  const stars3Count = active.filter(c => c.stars === 3).length;
  if (stars3Count >= 2) found.push('Star Collector');

  return found;
}

function updateArchetypeDisplay() {
  const current = new Set(detectArchetypes());

  // Newly active archetypes prepend so they appear most prominently.
  const retained    = S.archetypeOrder.filter(a => current.has(a));
  const newlyActive = [...current].filter(a => !S.archetypeOrder.includes(a));
  S.archetypeOrder  = [...newlyActive, ...retained];

  const el = qs('#archetype-display');
  if (!el) return;

  if (!S.archetypeOrder.length) {
    el.classList.add('hidden');
    return;
  }

  const [primary, ...others] = S.archetypeOrder;
  el.innerHTML = `
    <span class="archetype-label">Build</span>
    <span class="archetype-primary${newlyActive.includes(primary) ? ' archetype-new' : ''}">${primary}</span>
    ${others.map(a => `<span class="archetype-secondary">${a}</span>`).join('')}
  `;
  el.classList.remove('hidden');
}

// Check for pending picks before income + shop. Both augment and item picks
// happen BEFORE earnIncome so Tycoon/Midas effects apply this round.
function showGrandFinaleReveal() {
  Sound.play('grandFinale');
  const el = document.createElement('div');
  el.className = 'chapter-reveal grand-finale-reveal';
  el.innerHTML = `
    <div class="chapter-reveal-label">Round 24</div>
    <div class="chapter-reveal-chapter">Grand Finale</div>
    <div class="chapter-reveal-pref">All judges present · Final score</div>
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 420);
  }, 2200);
}

function startRound() {
  const nextRound = S.run.round + 1;
  if (nextRound === 1 || nextRound === 9 || nextRound === 17) {
    const chapter = S.run.chapterFor(nextRound);
    const judge   = S.run.currentJudge(nextRound);
    if (judge) setTimeout(() => showChapterReveal(chapter, judge), 150);
  }
  if (nextRound === 24) {
    setTimeout(() => showGrandFinaleReveal(), 150);
  }

  const augOffer = S.run.pendingAugment();
  if (augOffer) {
    S.phase = 'augment';
    S.augmentOffer = augOffer;
    render();
    return;
  }
  const itemOffer = S.run.pendingItem();
  if (itemOffer) {
    S.phase = 'item';
    S.itemOffer = itemOffer;
    render();
    return;
  }
  finishRoundSetup();
}

// Called after augment pick (or immediately if no pick pending).
function finishRoundSetup() {
  S.human.earnIncome();
  if (S.human.gold > S.run.stats.peakGold) S.run.stats.peakGold = S.human.gold;
  S.human.shop.refresh();
  S.phase    = 'shop';
  S.sellMode = false;
  render();
}

function onReady() {
  Sound.play('roundStart');
  S.result = S.run.runBattle();
  S.phase  = 'scoring';
  render();
}

function onContinue() {
  if (S.run.isOver()) {
    S.phase = 'over';
    render();
    return;
  }
  const curatorOffer = S.run.pendingCurator();
  if (curatorOffer) {
    S.phase = 'curator';
    S.curatorOffer = curatorOffer;
    render();
    return;
  }
  startRound();
}

function onPickCurator(idx) {
  const result = S.run.pickCurator(idx);
  if (!result) return;
  S.phase = 'shop';
  S.curatorOffer = null;
  if (result.type === 'augment') {
    Sound.play('pickAugment');
    finishRoundSetup();
    requestAnimationFrame(() => flashAugmentEffect(result.id));
  } else {
    Sound.play('pickItem');
    finishRoundSetup();
  }
}

// Augment pick: user clicked card at index idx.
function onPickAugment(idx) {
  Sound.play('pickAugment');
  const scoresBefore = captureScores();
  const tiersBefore  = captureSynergyTiers();
  const chosenId = S.run.pickAugment(idx);
  if (!chosenId) return;
  if (chosenId === 'Shapeshifter') {
    S.phase = 'shapeshifter';
    render();
    return;
  }
  finishRoundSetup();
  requestAnimationFrame(() => {
    flashAugmentEffect(chosenId);
    animatePlanningDeltas(scoresBefore);
    animateSynergyChanges(tiersBefore);
  });
}

// Item pick: user chose card at index idx.
function onPickItem(idx) {
  Sound.play('pickItem');
  S.run.pickItem(idx);
  S.phase = 'shop';
  S.itemOffer = null;
  finishRoundSetup();
}

// Shapeshifter sub-pick resolved.
function onPickShapeshifter(cardId, species) {
  const card = S.human.board.allCards.find(c => c._id === cardId);
  if (card && species) {
    S.run.applyShapeshifter(card.name, species);
  }
  finishRoundSetup();
}

// Returns ids of cards produced by a combine (new _id, stars > 1).
function runCombinesWithEffect() {
  const before = new Set(S.human.board.allCards.map(c => c._id));
  S.human.runCombines();
  return S.human.board.allCards
    .filter(c => !before.has(c._id) && c.stars > 1)
    .map(c => c._id);
}

function animateRankUps(ids) {
  for (const id of ids) {
    const card = S.human.board.allCards.find(c => c._id === id);
    Sound.play(card && card.stars >= 3 ? 'combine3' : 'combine');
    const el = document.querySelector(`[data-card-id="${id}"]`);
    if (el) el.classList.add('throbbing');
  }
}

// ── Planning-phase bonus animations ──────────────────────────────────────────

// Augments that have a scoring effect on active cards (excludes pure economy/structural).
const AUGMENT_AFFECTS_CARDS = new Set([
  'HeroicResolve', 'IronWill', 'TimeDilation', 'ExponentialGrowth',
  'EarlyBird', 'MidasTouch', 'HiveMind', 'Varietal', 'CrossTraining',
]);

function captureScores() {
  const bd = S.human.board.calcScoreBreakdown({ round: S.run.round + 1, augments: S.run.augments });
  const map = new Map();
  for (const e of bd.perCard) map.set(e.card._id, e.final);
  return map;
}

function captureSynergyTiers() {
  const { counts: sc } = effectiveSpeciesCounts(S.human.board, { augments: S.run.augments, player: S.human });
  const { counts: cc } = effectiveClassCounts(S.human.board);
  const tiers = {};
  for (const key of Object.keys(SYNERGIES)) {
    tiers['s_' + key] = SYNERGIES[key].thresholds.filter(t => (sc[key] || 0) >= t).length;
  }
  for (const key of Object.keys(CLASS_SYNERGIES)) {
    tiers['c_' + key] = CLASS_SYNERGIES[key].thresholds.filter(t => (cc[key] || 0) >= t).length;
  }
  return tiers;
}

function floatDelta(cardEl, delta) {
  const d = document.createElement('div');
  d.className = 'plan-delta ' + (delta > 0 ? 'plan-delta-pos' : 'plan-delta-neg');
  d.textContent = (delta > 0 ? '+' : '') + Math.round(delta);
  cardEl.appendChild(d);
  d.addEventListener('animationend', () => d.remove(), { once: true });
}

function animatePlanningDeltas(before) {
  if (!before || !before.size) return;
  const bd = S.human.board.calcScoreBreakdown({ round: S.run.round + 1, augments: S.run.augments });
  for (const e of bd.perCard) {
    const prev = before.get(e.card._id);
    if (prev === undefined) continue;
    const delta = e.final - prev;
    if (Math.abs(delta) < 1) continue;
    const el = document.querySelector(`[data-card-id="${e.card._id}"]`);
    if (!el) continue;
    floatDelta(el, delta);
    const flashClass = delta > 0 ? 'card-bonus-flash' : 'card-loss-flash';
    el.classList.add(flashClass);
    setTimeout(() => el.classList.remove(flashClass), 700);
  }
}

function animateSynergyChanges(tiersBefore) {
  if (!tiersBefore) return;
  const { counts: sc } = effectiveSpeciesCounts(S.human.board, { augments: S.run.augments, player: S.human });
  const { counts: cc } = effectiveClassCounts(S.human.board);
  const check = (key, count, syn, prefix) => {
    const after  = syn.thresholds.filter(t => count >= t).length;
    const before = tiersBefore[prefix + key] || 0;
    if (after > before) {
      const badge = document.querySelector(`.syn-badge[data-synergy-key="${key}"]`);
      if (badge) {
        badge.classList.add('syn-pulse');
        setTimeout(() => badge.classList.remove('syn-pulse'), 700);
      }
    }
  };
  for (const key of Object.keys(SYNERGIES)) check(key, sc[key] || 0, SYNERGIES[key], 's_');
  for (const key of Object.keys(CLASS_SYNERGIES)) check(key, cc[key] || 0, CLASS_SYNERGIES[key], 'c_');
}

// Pulses the augment badge then sweeps a green flash across all active cards.
function flashAugmentEffect(augId) {
  const badgeEl = document.querySelector(`.augment-badge[data-aug-id="${augId}"]`);
  if (badgeEl) {
    badgeEl.classList.add('augment-badge-pulse');
    setTimeout(() => badgeEl.classList.remove('augment-badge-pulse'), 900);
  }
  if (!AUGMENT_AFFECTS_CARDS.has(augId)) return;
  const cardEls = document.querySelectorAll('#active-slots .card');
  let delay = 80;
  for (const el of cardEls) {
    setTimeout(() => {
      el.classList.add('card-bonus-flash');
      setTimeout(() => el.classList.remove('card-bonus-flash'), 700);
    }, delay);
    delay += 60;
  }
}

// ── Human shop actions ────────────────────────────────────────────────────────
function onBuyShop(slotIdx) {
  if (S.sellMode) return;
  if (S.human.board.isFull()) return;
  const scoresBefore = captureScores();
  const tiersBefore  = captureSynergyTiers();
  const card = S.human.shop.buy(slotIdx);
  if (!card) return;
  Sound.play('buy');
  S.human.board.addCard(card);
  const upgraded = runCombinesWithEffect();
  render();
  animateRankUps(upgraded);
  requestAnimationFrame(() => {
    animatePlanningDeltas(scoresBefore);
    animateSynergyChanges(tiersBefore);
  });
}

function onReroll() {
  Sound.play('reroll');
  S.human.shop.reroll();
  render();
}

function onLock() {
  if (S.human.shop.locked) S.human.shop.unlock();
  else { Sound.play('lockMarket'); S.human.shop.lock(); }
  render();
}

function onAddPlinth() {
  Sound.play('plinth');
  const prevMax = S.human.board.maxActive;
  S.human.addPlinth();
  render();
  const activeEl = qs('#active-slots');
  const newSlot = activeEl.children[prevMax];
  if (newSlot) {
    newSlot.classList.add('slot-flash');
    newSlot.addEventListener('animationend', () => newSlot.classList.remove('slot-flash'), { once: true });
  }
}

function onToggleSell() {
  Sound.play('uiClick');
  S.sellMode = !S.sellMode;
  render();
}

function onCardClick(cardId) {
  if (S.attachItem) {
    const card = S.human.board.allCards.find(c => c._id === cardId);
    if (card && (card.items || []).length < 3) {
      const scoresBefore = captureScores();
      const idx = S.human.itemBag.indexOf(S.attachItem);
      if (idx !== -1 && attachItem(card, S.attachItem)) {
        S.human.itemBag.splice(idx, 1);
        Sound.play('equipItem');
      }
      S.attachItem = null;
      render();
      requestAnimationFrame(() => animatePlanningDeltas(scoresBefore));
      return;
    }
    S.attachItem = null;
    render();
    return;
  }
  const scoresBefore = captureScores();
  const tiersBefore  = captureSynergyTiers();
  let upgraded = [];
  if (S.sellMode) {
    Sound.play('sell');
    S.human.sell(cardId);
    S.human.runCombines();
  } else {
    if (!S.human.board.moveToActive(cardId)) {
      Sound.play('cardBench');
      S.human.board.moveToBench(cardId);
    } else {
      Sound.play('cardActive');
    }
    upgraded = runCombinesWithEffect();
  }
  render();
  animateRankUps(upgraded);
  requestAnimationFrame(() => {
    animatePlanningDeltas(scoresBefore);
    animateSynergyChanges(tiersBefore);
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  updateHUD();

  if (S.phase === 'augment') {
    qs('#modal').classList.add('hidden');
    qs('#shop-section').classList.remove('hidden');
    renderBoard();
    renderSynergyBar();
    renderAugmentBadges();
    renderItemBag();
    renderAugmentOffer();
    renderJudgePanel();
  } else if (S.phase === 'shapeshifter') {
    qs('#shop-section').classList.add('hidden');
    showShapeshifterModal();
  } else if (S.phase === 'item') {
    qs('#modal').classList.add('hidden');
    qs('#shop-section').classList.remove('hidden');
    renderBoard();
    renderSynergyBar();
    renderAugmentBadges();
    renderItemBag();
    renderItemOffer();
    renderJudgePanel();
  } else if (S.phase === 'curator') {
    qs('#modal').classList.add('hidden');
    qs('#shop-section').classList.remove('hidden');
    renderBoard();
    renderSynergyBar();
    renderAugmentBadges();
    renderItemBag();
    renderCuratorOffer();
    renderJudgePanel();
  } else if (S.phase === 'shop') {
    qs('#modal').classList.add('hidden');
    qs('#shop-section').classList.remove('hidden');
    qs('#shop-section .area-label').textContent = 'Specimen Market';
    qs('#shop-section-desc').textContent = 'Hover specimens to see their abilities';
    qs('#shop-cards').className = 'card-row';
    qs('#shop-controls').classList.remove('hidden');
    renderBoard();
    renderShopOffers();
    renderSynergyBar();
    renderAugmentBadges();
    renderItemBag();
    renderIncomePreview();
    renderDevPanel();
    updateShopControls();
    renderJudgePanel();
  } else if (S.phase === 'scoring') {
    qs('#shop-section').classList.add('hidden');
    showScoringModal();
  } else if (S.phase === 'over') {
    qs('#shop-section').classList.add('hidden');
    showGameOverModal();
  }
}

function updateHUD() {
  const h = S.human;
  // During pre-round phases show the upcoming round number.
  const inPreRound = ['augment', 'shapeshifter', 'item', 'curator', 'shop'].includes(S.phase);
  const round = S.run.round + (inPreRound ? 1 : 0);
  qs('#hud-round').textContent = `Round ${round} / 24`;
  qs('#hud-phase').textContent = S.phase === 'shop' ? 'Market'
    : S.phase === 'augment' || S.phase === 'shapeshifter' ? 'Augment'
    : S.phase === 'item' ? 'Item Pick'
    : S.phase === 'curator' ? "Curator's Gift"
    : S.phase === 'scoring' ? 'Judging'
    : 'Battle';
  qs('#hud-phase').className   = 'phase-tag' + (!inPreRound ? ' battle' : '');

  const livesEl = qs('#hud-lives');
  if (livesEl) {
    const tip = livesEl.querySelector('.hud-tip');
    livesEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const seal = document.createElement('span');
      seal.className = 'life-seal ' + (i < S.run.lives ? 'filled' : 'empty');
      seal.textContent = '◆';
      livesEl.appendChild(seal);
    }
    if (tip) livesEl.appendChild(tip);
  }

  const goldEl  = qs('#hud-gold');
  const goldTip = goldEl.querySelector('.hud-tip');
  goldEl.textContent = h.gold + 'g';
  if (goldTip) goldEl.appendChild(goldTip);

  const levelEl  = qs('#hud-level');
  const levelTip = levelEl.querySelector('.hud-tip');
  levelEl.textContent = `Exhibit Lvl ${h.level}`;
  if (levelTip) levelEl.appendChild(levelTip);

  qs('#hud-record').textContent  = `${h.wins}W ${h.losses}L`;
  const streak = h.streak;
  const sEl    = qs('#hud-streak');
  if (streak > 1)      { sEl.textContent = `🔥 ${streak} win streak`; sEl.style.color = '#3fb950'; }
  else if (streak < -1){ sEl.textContent = `❄ ${Math.abs(streak)} loss streak`; sEl.style.color = '#f85149'; }
  else                  { sEl.textContent = ''; }

  updateHUDDifficulty();
}

function renderBoard() {
  const board = S.human.board;
  qs('#board-size-label').textContent = `${board.active.length} / ${board.maxActive}`;
  qs('#bench-size-label').textContent = `${board.bench.length} / 8`;

  const previewRound = S.run.round + 1;
  // Preview does not pass player — avoids consuming run rng via Spear of Shojin.
  const breakdown = board.calcScoreBreakdown({ round: previewRound, augments: S.run.augments });
  const bdMap = new Map(breakdown.perCard.map(e => [e.card._id, e]));

  const activeEl = qs('#active-slots');
  activeEl.innerHTML = '';
  for (let i = 0; i < board.maxActive; i++) {
    const card = board.active[i];
    if (card) activeEl.appendChild(makeCard(card, 'board', null, bdMap.get(card._id)));
    else      activeEl.appendChild(makeEmptySlot());
  }

  const benchEl = qs('#bench-slots');
  benchEl.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const card = board.bench[i];
    if (card) benchEl.appendChild(makeCard(card, 'bench'));
    else      benchEl.appendChild(makeEmptySlot());
  }

  updateArchetypeDisplay();
}

function renderShopOffers() {
  const shopEl = qs('#shop-cards');
  shopEl.innerHTML = '';
  const offers = S.human.shop.offers;
  const owned = S.human.board.allCards;
  for (let i = 0; i < 5; i++) {
    const name = offers[i];
    if (!name) { shopEl.appendChild(makeEmptySlot()); continue; }
    const def  = CARD_DEFS.find(d => d.name === name);
    if (!def)  { shopEl.appendChild(makeEmptySlot()); continue; }
    const cost = CARD_COSTS[def.tier];
    const el   = makeCard({ ...def, stars: 1, _id: -1 }, 'shop', cost);
    if (S.human.gold < cost || S.human.board.isFull()) el.classList.add('unaffordable');

    // Owned-copy counter: teaches the "3-of-a-kind upgrades" rule implicitly.
    const ownedCopies = owned.filter(c => c.name === name && c.stars === 1).length;
    if (ownedCopies > 0) {
      const badge = document.createElement('div');
      const willUpgrade = ownedCopies >= 2;
      badge.className = 'own-counter' + (willUpgrade ? ' will-upgrade' : '');
      badge.textContent = willUpgrade ? `★ Upgrade! (you have ${ownedCopies})` : `You own ×${ownedCopies}`;
      el.appendChild(badge);
    }

    el.onclick = () => onBuyShop(i);
    shopEl.appendChild(el);
  }
  qs('#shop-lock-tag').classList.toggle('hidden', !S.human.shop.locked);
}

function renderSynergyBar() {
  const bar = qs('#synergy-bar');
  bar.innerHTML = '';

  function makeBadges(counts, synMap, rowClass) {
    const isClass = rowClass === 'syn-row-class';
    const row = document.createElement('div');
    row.className = `syn-row ${rowClass}`;
    for (const key of Object.keys(synMap)) {
      const syn = synMap[key];
      const count = counts[key] || 0;
      const bonus = syn.getBonus(count);
      const nextT = syn.thresholds.find(t => t > count);
      const badge = document.createElement('span');
      const inactive = count === 0;
      badge.className = 'syn-badge'
        + (bonus ? ' active' : '')
        + (isClass ? ' class-syn' : '')
        + (inactive ? ' inactive' : '');
      badge.dataset.synergyKey = key;
      const glyph = isClass ? (CLASS_GLYPHS[key] || '') : '';
      let text = `${glyph}${key} ${count}`;
      if (bonus) text += ' ✓';
      if (nextT) text += ` <span class="syn-next">→${nextT}</span>`;
      badge.innerHTML = text;

      // Hover tooltip showing all thresholds for this synergy
      const tt = document.createElement('span');
      tt.className = 'syn-badge-tooltip';
      let ttHtml = `<div class="syn-tt-head">${key}</div>`;
      for (const t of syn.thresholds) {
        const b = syn.getBonus(t);
        const active = count >= t;
        ttHtml += `<div class="syn-tt-row${active ? ' syn-tt-active' : ''}"><span class="syn-tt-t">${t}</span><span class="syn-tt-b">${bonusText(b, key)}</span></div>`;
      }
      tt.innerHTML = ttHtml;
      badge.appendChild(tt);
      badge.addEventListener('mouseenter', () => clampTooltipH(badge, 220));

      row.appendChild(badge);
    }
    return row;
  }

  const { counts: specCounts } = effectiveSpeciesCounts(S.human.board, { augments: S.run.augments, player: S.human });
  bar.appendChild(makeBadges(specCounts, SYNERGIES, 'syn-row-species'));

  const { counts: clsCounts } = effectiveClassCounts(S.human.board);
  bar.appendChild(makeBadges(clsCounts, CLASS_SYNERGIES, 'syn-row-class'));
}

// Augment badge panel — inserted after income-preview; shows picked augments.
function renderAugmentBadges() {
  let el = qs('#augment-badges');
  if (!el) {
    el = document.createElement('div');
    el.id = 'augment-badges';
    const anchor = qs('#synergy-bar');
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
  }

  el.innerHTML = '';
  const augments = S.run.augments;
  if (!augments.length) return;

  const label = document.createElement('div');
  label.className = 'augment-badges-label';
  label.textContent = 'Augments';
  el.appendChild(label);

  const row = document.createElement('div');
  row.className = 'augment-badges-row';
  for (const id of augments) {
    const aug = AUGMENT_DEFS.find(a => a.id === id);
    if (!aug) continue;
    const badge = document.createElement('span');
    badge.className = 'augment-badge';
    badge.dataset.augId = id;
    badge.textContent = aug.name;
    const tt = document.createElement('span');
    tt.className = 'aug-tooltip';
    tt.textContent = aug.description;
    badge.appendChild(tt);
    badge.addEventListener('mouseenter', () => clampTooltipH(badge, 240));
    row.appendChild(badge);
  }
  el.appendChild(row);
}

function renderDevPanel() {
  let panel = qs('#dev-panel');
  if (!DEV_MODE) {
    if (panel) panel.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'dev-panel';
    const synBar = qs('#synergy-bar');
    synBar.parentNode.insertBefore(panel, synBar.nextSibling);
  }
  const active = S.human.board.active;
  let cardOpts = active.map(c => `<option value="${c._id}">${c.name} ${'★'.repeat(c.stars)}</option>`).join('');
  if (!cardOpts) cardOpts = '<option value="">(no active cards)</option>';
  const itemOpts = ITEM_DEFS.map(it => `<option value="${it.id}">${it.name}</option>`).join('');

  // Augment controls for dev panel.
  const augOpts = AUGMENT_DEFS.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  panel.innerHTML = `
    <span class="dev-label">DEV</span>
    <select id="dev-card">${cardOpts}</select>
    <select id="dev-item">${itemOpts}</select>
    <button id="dev-attach" class="btn-secondary">Attach Item</button>
    <select id="dev-aug">${augOpts}</select>
    <button id="dev-aug-add" class="btn-secondary">Add Aug</button>
    <span class="dev-hint">click a filled pip to detach</span>
  `;
  qs('#dev-attach').onclick = () => {
    const cardId = parseInt(qs('#dev-card').value);
    const itemId = qs('#dev-item').value;
    if (!cardId || !itemId) return;
    const card = S.human.board.active.find(c => c._id === cardId);
    if (!card) return;
    attachItem(card, itemId);
    render();
  };
  qs('#dev-aug-add').onclick = () => {
    const augId = qs('#dev-aug').value;
    if (!augId) return;
    if (!S.run.augments.includes(augId)) S.run.augments.push(augId);
    render();
  };
}

function renderIncomePreview() {
  const bd    = S.human.incomeBreakdown ? S.human.incomeBreakdown() : null;
  let total, parts, interestCapped;
  if (bd) {
    total = bd.total;
    // Interest is capped when raw base interest (gold / INTEREST_PER) >= 5.
    interestCapped = Math.floor(S.human.gold / INTEREST_PER) >= 5;
    parts = [`Base ${bd.base}g`];
    if (bd.interest > 0) {
      const capMark = interestCapped ? ' <span class="income-cap">✓ max</span>' : '';
      parts.push(`Interest +${bd.interest}g${bd.tycoon ? ' (×2)' : ''}${capMark}`);
    }
    if (bd.streak > 0) parts.push(`Streak +${bd.streak}g`);
  } else {
    const interest    = Math.min(5, Math.floor(S.human.gold / INTEREST_PER));
    const streakBonus = S.human._streakBonus ? S.human._streakBonus() : 0;
    interestCapped    = interest >= 5;
    total             = BASE_INCOME + interest + streakBonus;
    parts = [`Base ${BASE_INCOME}g`];
    if (interest > 0) {
      const capMark = interestCapped ? ' <span class="income-cap">✓ max</span>' : '';
      parts.push(`Interest +${interest}g${capMark}`);
    }
    if (streakBonus > 0) parts.push(`Streak +${streakBonus}g`);
  }
  qs('#income-preview').innerHTML = `Next income: ${total}g  (${parts.join(' · ')})`;
}

function updateShopControls() {
  const cost = S.human.shop.rerollCost ? S.human.shop.rerollCost() : 2;
  qs('#btn-reroll').textContent  = `Re-roll (${cost}g)`;
  qs('#btn-reroll').disabled     = S.human.gold < cost;
  qs('#btn-lock').textContent    = S.human.shop.locked ? 'Unlock Market' : 'Lock Market';
  const plinthBtn = qs('#btn-plinth');
  const exhibitTip = qs('#exhibit-info-tooltip');
  if (S.human.level >= 9) {
    plinthBtn.textContent = 'Exhibit Maxed';
    plinthBtn.disabled    = true;
  } else {
    const pCost = S.human.plinthCost();
    plinthBtn.textContent = `Upgrade Exhibit (${pCost}g)`;
    plinthBtn.disabled    = S.human.gold < pCost;
  }
  if (exhibitTip) {
    plinthBtn.appendChild(exhibitTip);
    exhibitTip.innerHTML = buildExhibitInfoTooltip(S.human.level);
  }
  qs('#btn-sell').classList.toggle('active', S.sellMode);
  qs('#btn-sell').textContent    = S.sellMode ? 'Selling (click card)' : 'Sell Card';
  const hasExhibits = S.human.board.active.length > 0;
  qs('#btn-ready').disabled  = !hasExhibits;
  qs('#btn-ready').title     = hasExhibits ? '' : 'Place at least one specimen in your Exhibits first';
}

// ── Augment / item offer (rendered into shop-section bottom bar) ──────────────
function renderAugmentOffer() {
  qs('#shop-section .area-label').textContent = 'Choose an Augment';
  qs('#shop-section-desc').textContent = 'Pick one — applies to your entire exhibit for the rest of the run';
  qs('#shop-controls').classList.add('hidden');
  const el = qs('#shop-cards');
  el.className = 'augment-offer';
  el.innerHTML = '';
  for (let i = 0; i < S.augmentOffer.length; i++) {
    const aug = AUGMENT_DEFS.find(a => a.id === S.augmentOffer[i]);
    if (!aug) continue;
    const card = document.createElement('div');
    card.className = 'augment-card';
    card.tabIndex = 0;
    card.innerHTML = `<div class="aug-name">${aug.name}</div><div class="aug-desc">${aug.description}</div>`;
    const pick = () => onPickAugment(i);
    card.onclick = pick;
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') pick(); };
    el.appendChild(card);
  }
}

function renderItemOffer() {
  qs('#shop-section .area-label').textContent = 'Choose an Item';
  qs('#shop-section-desc').textContent = 'Pick one to add to your inventory — attach it to a unit in the shop phase';
  qs('#shop-controls').classList.add('hidden');
  const el = qs('#shop-cards');
  el.className = 'augment-offer';
  el.innerHTML = '';
  for (let i = 0; i < S.itemOffer.length; i++) {
    const item = ITEM_DEFS.find(it => it.id === S.itemOffer[i]);
    if (!item) continue;
    const card = document.createElement('div');
    card.className = 'augment-card';
    card.tabIndex = 0;
    card.innerHTML = `<div class="item-name">${item.name}</div><div class="aug-desc">${item.description}</div>`;
    const pick = () => onPickItem(i);
    card.onclick = pick;
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') pick(); };
    el.appendChild(card);
  }
}

function renderCuratorOffer() {
  const offer  = S.curatorOffer;
  const last   = S.run.battleHistory[S.run.battleHistory.length - 1];
  const judge  = last ? HEAD_JUDGES.find(j => j.id === last.judgeId) : null;
  const judgeName = judge ? judge.name : 'The Judges';

  qs('#shop-section .area-label').textContent = "Curator's Selection";
  qs('#shop-section-desc').textContent = `A gift from ${judgeName} at the end of their chapter`;
  qs('#shop-controls').classList.add('hidden');

  const el = qs('#shop-cards');
  el.className = 'augment-offer';
  el.innerHTML = '';

  if (!offer) return;

  if (offer.type === 'augment-pick') {
    // The Assembly — free 3-choice augment pick.
    for (let i = 0; i < offer.offers.length; i++) {
      const aug = AUGMENT_DEFS.find(a => a.id === offer.offers[i]);
      if (!aug) continue;
      const card = document.createElement('div');
      card.className = 'augment-card';
      card.tabIndex = 0;
      card.innerHTML = `<div class="aug-name">${aug.name}</div><div class="aug-desc">${aug.description}</div>`;
      const pick = () => onPickCurator(i);
      card.onclick = pick;
      card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') pick(); };
      el.appendChild(card);
    }
  } else {
    // Single gift — show as a centred card with an Accept button.
    let displayName, displayDesc, nameClass;
    if (offer.type === 'item') {
      const item = ITEM_DEFS.find(it => it.id === offer.id);
      displayName = item ? item.name : offer.id;
      displayDesc = item ? item.description : '';
      nameClass = 'item-name';
    } else {
      const aug = AUGMENT_DEFS.find(a => a.id === offer.id);
      displayName = aug ? aug.name : offer.id;
      displayDesc = aug ? aug.description : '';
      nameClass = 'aug-name';
    }
    const card = document.createElement('div');
    card.className = 'augment-card curator-gift-card';
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="curator-gift-label">Judge's Gift — Free</div>
      <div class="${nameClass}">${displayName}</div>
      <div class="aug-desc">${displayDesc}</div>
      <div class="curator-gift-hint">Click to accept</div>
    `;
    card.onclick = () => onPickCurator(0);
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') onPickCurator(0); };
    el.appendChild(card);
  }
}

// ── Item bag panel ────────────────────────────────────────────────────────────
function renderItemBag() {
  let el = qs('#item-bag');
  if (!el) {
    el = document.createElement('div');
    el.id = 'item-bag';
    const anchor = qs('#augment-badges') || qs('#synergy-bar');
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
  }

  el.innerHTML = '';
  const bag = S.human.itemBag;
  if (!bag.length) return;

  const label = document.createElement('div');
  label.className = 'augment-badges-label';
  label.textContent = 'Inventory';
  el.appendChild(label);

  const row = document.createElement('div');
  row.className = 'item-bag-row';
  for (let i = 0; i < bag.length; i++) {
    const item = ITEM_DEFS.find(it => it.id === bag[i]);
    if (!item) continue;
    const isActive = S.attachItem === bag[i];
    const pill = document.createElement('span');
    pill.className = 'item-bag-pill' + (isActive ? ' attaching' : '');
    pill.textContent = item.name;
    pill.appendChild(makeItemTooltip(item));
    pill.addEventListener('mouseenter', () => clampTooltipH(pill, 200));
    const id = bag[i];
    pill.onclick = () => { S.attachItem = S.attachItem === id ? null : id; render(); };
    row.appendChild(pill);
  }
  el.appendChild(row);

  const hint = document.createElement('div');
  hint.className = 'item-bag-hint';
  hint.textContent = S.attachItem
    ? 'Click a unit to attach — click the item again to cancel'
    : 'Click an item then click a unit to attach it';
  el.appendChild(hint);
}

// ── Shapeshifter sub-modal ────────────────────────────────────────────────────
function showShapeshifterModal() {
  const allCards = S.human.board.allCards;
  const SPECIES  = ['Plasmic', 'Sporal', 'Chitinous', 'Crystalline', 'Abyssal'];

  let cardOpts = allCards.length
    ? allCards.map(c => `<option value="${c._id}">${c.name} ${'★'.repeat(c.stars)} (${c.species})</option>`).join('')
    : '<option value="">(no cards)</option>';
  const speciesOpts = SPECIES.map(s => `<option value="${s}">${s}</option>`).join('');

  let html = `<h2>Shapeshifter</h2>`;
  html += `<p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Choose a unit and a permanent species tag to grant it.</p>`;
  html += `<div class="ss-picker">
    <select id="ss-card">${cardOpts}</select>
    <select id="ss-species">${speciesOpts}</select>
    <button id="ss-confirm" class="btn-primary">Confirm</button>
  </div>`;

  qs('#modal-content').innerHTML = html;
  qs('#modal-actions').classList.add('hidden');
  qs('#modal').classList.remove('side-panel');
  qs('#modal').classList.remove('hidden');

  qs('#ss-confirm').onclick = () => {
    const raw  = qs('#ss-card').value;
    const cardId  = raw ? parseInt(raw) : 0;
    const species = qs('#ss-species').value;
    onPickShapeshifter(cardId, species);
  };
}

function showGameOverModal() {
  const run      = S.run;
  const h        = S.human;
  const survived = run.round >= 24;
  Sound.play(survived ? 'gameWin' : 'gameLoss');

  const ratingRes = RANKING ? RANKING.recordRun(run.round, run.lives, run.peakScore) : null;
  // Try to unlock the next difficulty tier when player clears all 24 rounds.
  const newTierUnlock = (survived && RANKING) ? RANKING.tryUnlockNextTier(RANKING.getActiveTier().id) : null;
  // Evaluate and persist achievement unlocks.
  const newUnlocks = evaluateAchievements ? evaluateAchievements(run) : [];
  newUnlocks.forEach(a => addUnlock(a.reward.id));

  let html = `<h2>${survived ? 'Run Complete' : 'Run Over'}</h2>`;
  html += `<p style="margin-bottom:14px;color:var(--text-muted)">${
    survived ? 'You completed all 24 rounds.' : `Eliminated after round ${run.round}.`
  }</p>`;

  html += `<div class="final-stats">
    <div><span class="area-label">Rounds completed</span> <span class="stat-big">${run.round} / 24</span></div>
    <div><span class="area-label">Seals remaining</span> <span class="stat-big">${run.lives} / 3</span></div>
    <div><span class="area-label">Peak score</span> <span class="stat-big">${run.peakScore}</span></div>
    <div><span class="area-label">Exhibit Level</span> <span class="stat-big">Lvl ${h.level}</span></div>
  </div>`;

  if (ratingRes) {
    html += `<div class="rating-block">`;
    html += `<div class="rating-label">Exhibition Rating</div>`;
    html += `<div class="rating-value">${ratingRes.rating}</div>`;
    if (ratingRes.isNewBest) {
      html += `<div class="rating-new-best">New personal best!</div>`;
    } else {
      html += `<div class="rating-best">Best: ${ratingRes.best}</div>`;
    }
    html += `</div>`;
  }

  if (run.augments.length) {
    html += `<div class="area-label" style="margin-top:14px;margin-bottom:6px">Augments</div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:5px">`;
    for (const id of run.augments) {
      const aug = AUGMENT_DEFS.find(a => a.id === id);
      if (aug) html += `<span class="augment-badge" title="${aug.description}">${aug.name}</span>`;
    }
    html += `</div>`;
  }

  if (run.battleHistory.length) {
    html += `<div class="area-label" style="margin-top:14px;margin-bottom:4px">Round History</div>`;
    html += `<div class="battle-history">`;
    for (const e of run.battleHistory) {
      const passCls  = e.passed ? 'bh-pass' : 'bh-fail';
      const mark     = e.passed ? '✓' : '✗';
      const critique = e.isCritique ? ' ★' : '';
      const prefTag  = e.qualified ? ' <span style="color:#3fb950;font-size:9px">✓pref</span>' : '';
      html += `<div class="bh-row">
        <span class="stat-dim">R${e.round}${critique}</span>
        <span class="${passCls}">${mark}</span>
        <span class="bh-score">${e.playerScore}</span>
        <span class="bh-target">/ ${e.target}${prefTag}</span>
      </div>`;
    }
    html += `</div>`;
  }

  if (newTierUnlock) {
    html += `<div class="tier-unlock-banner">🏆 New difficulty unlocked: <strong>${newTierUnlock.label}</strong></div>`;
  }

  if (newUnlocks.length > 0) {
    html += `<div class="unlock-section">`;
    html += `<div class="unlock-header">✦ New content unlocked</div>`;
    for (const a of newUnlocks) {
      const typeLabel = a.reward.type.charAt(0).toUpperCase() + a.reward.type.slice(1);
      html += `<div class="unlock-entry"><span class="unlock-name">${a.reward.name}</span><span class="unlock-type">${typeLabel}</span></div>`;
    }
    html += `</div>`;
  }

  const doneCount = (ACHIEVEMENTS_LIST || []).filter(a => isUnlocked(a.reward.id)).length;
  const totalCount = (ACHIEVEMENTS_LIST || []).length;
  html += `<div class="ach-progress-row">
    <span><span class="area-label">Achievements</span> <span class="stat-dim">${doneCount} / ${totalCount}</span></span>
    <button class="btn-view-coll" id="btn-view-coll">View Collection →</button>
  </div>`;

  html += `<div class="area-label" style="margin-top:14px;margin-bottom:6px">Next Run Difficulty</div>`;
  html += `<div id="modal-diff-picker"></div>`;

  qs('#modal-content').innerHTML = html;
  renderDifficultyPicker(qs('#modal-diff-picker'));
  const vcBtn = qs('#btn-view-coll');
  if (vcBtn) vcBtn.onclick = showCollectionModal;
  qs('#modal-actions').classList.remove('hidden');
  qs('#btn-continue').textContent = 'Play Again';
  qs('#btn-continue').onclick = () => { newGame(); };
  qs('#modal').classList.remove('side-panel');
  qs('#modal').classList.remove('hidden');
}

// ── Collection modal (splash screen) ─────────────────────────────────────────
function showCollectionModal() {
  let html = `<h2>Collection</h2>`;
  html += `<p style="margin-bottom:14px;color:var(--text-muted);font-size:13px">Complete each achievement once to unlock new content permanently.</p>`;

  for (const a of (ACHIEVEMENTS_LIST || [])) {
    const unlocked = isUnlocked ? isUnlocked(a.reward.id) : false;
    html += `<div class="ach-row ${unlocked ? 'ach-unlocked' : 'ach-locked'}">`;
    html += `<div class="ach-name">${a.name}</div>`;
    html += `<div class="ach-condition">${a.condition}</div>`;
    if (unlocked) {
      const typeLabel = a.reward.type.charAt(0).toUpperCase() + a.reward.type.slice(1);
      html += `<div class="ach-reward">Unlocked: <strong>${a.reward.name}</strong> <span class="ach-type">${typeLabel}</span></div>`;
    } else {
      const typeLabel = a.reward.type.charAt(0).toUpperCase() + a.reward.type.slice(1);
      html += `<div class="ach-reward ach-reward-locked">Unlocks: <strong>${a.reward.name}</strong> <span class="ach-type">${typeLabel}</span></div>`;
    }
    html += `</div>`;
  }

  qs('#modal-content').innerHTML = html;
  qs('#modal-actions').classList.remove('hidden');
  qs('#btn-continue').textContent = 'Close';
  qs('#btn-continue').onclick = () => { qs('#modal').classList.add('hidden'); };
  qs('#modal').classList.remove('side-panel');
  qs('#modal').classList.remove('scoring');
  qs('#modal').classList.remove('hidden');
}

// ── Card element factory ──────────────────────────────────────────────────────
function buildExhibitInfoTooltip(currentLevel) {
  let html = '<div class="ei-head">Upgrade Exhibit</div>' +
    '<div class="ei-subhead">Adds one display slot · improves shop odds</div>';
  html += '<div class="ei-row ei-hdr"><span>Lvl</span><span>T1</span><span>T2</span><span>T3</span></div>';
  for (let lvl = 3; lvl <= 9; lvl++) {
    const w = LEVEL_WEIGHTS[lvl];
    const cls = lvl === currentLevel ? ' ei-current' : '';
    html += `<div class="ei-row${cls}">` +
      `<span>${lvl}</span>` +
      `<span>${Math.round(w[0] * 100)}%</span>` +
      `<span>${Math.round(w[1] * 100)}%</span>` +
      `<span>${Math.round(w[2] * 100)}%</span>` +
      `</div>`;
  }
  return html;
}

function clampTooltipH(el, tipMaxW) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const half = tipMaxW / 2;
  const snapRight = cx - half < 8;
  el.classList.toggle('tooltip-right', snapRight);
  el.classList.toggle('tooltip-left', !snapRight && cx + half > window.innerWidth - 8);
}

function bonusText(bonus, entityName) {
  if (!bonus) return '';
  const v = bonus.value;
  if (bonus.target === 'all' && bonus.type === 'flat') return `All +${v}`;
  if (bonus.target === 'all' && bonus.type === 'mult') return `All ×${v}`;
  if (bonus.type === 'flat') return `+${v} per ${entityName || 'alien'}`;
  if (bonus.type === 'mult') return `×${v}`;
  return '';
}

function makeSynergyTooltip(card, bd) {
  const species = card.species;
  const el = document.createElement('div');
  el.className = 'card-tooltip';
  let html = '';
  const specSyn = SYNERGIES[species];
  if (specSyn) {
    html += `<div class="tt-head tt-species">${species}</div>`;
    for (const t of specSyn.thresholds) {
      const b = specSyn.getBonus(t);
      html += `<div class="tt-row"><span class="tt-t">${t}</span><span class="tt-b">${bonusText(b, species)}</span></div>`;
    }
  }
  if (card.shapeshifterSpecies) {
    html += `<div class="tt-head tt-species" style="color:#9dcc50">+ ${card.shapeshifterSpecies} (Shapeshifter)</div>`;
  }
  if (card.class) {
    const clsSyn = CLASS_SYNERGIES[card.class];
    if (clsSyn) {
      html += `<div class="tt-head tt-class">${card.class}</div>`;
      for (const t of clsSyn.thresholds) {
        const b = clsSyn.getBonus(t);
        html += `<div class="tt-row"><span class="tt-t">${t}</span><span class="tt-b">${bonusText(b, card.class)}</span></div>`;
      }
    }
  }
  if (card.passive && card.passive.description) {
    html += `<div class="tt-head" style="color:var(--text-muted)">Effect</div><div class="tt-passive">${card.passive.description}</div>`;
  }
  if (card.flavor) {
    html += `<div class="tt-flavor">${card.flavor}</div>`;
  }
  if (bd && bd.lines.length) {
    html += `<div class="tt-head tt-bd">score breakdown</div>`;
    for (const ln of bd.lines) {
      if (ln.add !== undefined) {
        html += `<div class="tt-bd-row"><span class="tt-bd-label">${ln.label}</span><span class="tt-bd-add">+${ln.add}</span></div>`;
      } else if (ln.mult !== undefined) {
        const pct = Math.round((ln.mult - 1) * 100);
        const sign = pct >= 0 ? '+' : '';
        html += `<div class="tt-bd-row"><span class="tt-bd-label">${ln.label}</span><span class="tt-bd-mult">${sign}${pct}%</span></div>`;
      }
    }
    html += `<div class="tt-bd-total">= ${bd.final}</div>`;
  }
  el.innerHTML = html;
  return el;
}

function makeCard(card, context, shopCost, bd) {
  const el = document.createElement('div');
  el.className = `card species-${card.species.toLowerCase()}`;
  el.dataset.cardId = card._id;
  if (context !== 'shop' && context !== 'viewer' && S.attachItem && (card.items || []).length < 3) {
    el.classList.add('attach-target');
  }

  const stars    = '★'.repeat(card.stars) + '☆'.repeat(3 - card.stars);
  const baseScore = Math.round(card.baseScore * STAR_MULT[card.stars]);
  const sellVal  = card.tier ? Math.round(CARD_COSTS[card.tier] * Math.pow(3, card.stars - 1)) : 0;

  let scoreHTML;
  if (bd) {
    const flatTotal = Math.round(bd.lines.reduce((s, l) => l.add != null ? s + l.add : s, 0));
    const multTotal = bd.lines.reduce((p, l) => l.mult != null ? p * l.mult : p, 1.0);
    const multStr = Math.abs(multTotal - 1) > 0.001
      ? `<span class="card-mult">×${+multTotal.toFixed(2)}</span>`
      : '';
    scoreHTML = `${flatTotal}${multStr}`;
  } else {
    scoreHTML = baseScore;
  }

  el.innerHTML = `
    <div class="card-stars">${stars}</div>
    <div class="card-name">${card.name}</div>
    <div class="card-labels">
      <span class="card-species">${card.species}</span>
      ${card.shapeshifterSpecies ? `<span class="card-species" style="color:#9dcc50">+${card.shapeshifterSpecies}</span>` : ''}
      ${card.class ? `<span class="card-class">${CLASS_GLYPHS[card.class] || ''}${card.class}</span>` : ''}
    </div>
    <div class="card-score">${scoreHTML}</div>
    <div class="card-tier" title="Pool rarity — T1/T2/T3 affects shop odds after upgrading your Exhibit. Stars ★ = combine level (1–3).">T${card.tier}</div>
    ${shopCost != null ? `<div class="card-cost">${shopCost}g</div>` : ''}
    ${context !== 'shop' && S.sellMode ? `<div class="card-sell-val">sell ${sellVal}g</div>` : ''}
  `;

  // Item pip row — three slots, shown on board/bench cards (not shop or viewer).
  if (context !== 'shop' && context !== 'viewer') {
    const pipRow = document.createElement('div');
    pipRow.className = 'item-pips';
    const items = card.items || [];
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('span');
      pip.className = 'item-pip';
      if (items[i]) {
        const capturedId = items[i].id;
        pip.classList.add('filled');
        pip.textContent = itemAbbrev(capturedId);
        pip.classList.add('detachable');
        const itemDef = ITEM_DEFS.find(it => it.id === capturedId);
        if (itemDef) pip.appendChild(makeItemTooltip(itemDef));
        pip.onclick = (ev) => {
          ev.stopPropagation();
          const scoresBefore = captureScores();
          if (detachItem(card, capturedId)) {
            Sound.play('unequipItem');
            S.human.itemBag.push(capturedId);
          }
          render();
          requestAnimationFrame(() => animatePlanningDeltas(scoresBefore));
        };
      }
      pipRow.appendChild(pip);
    }
    el.appendChild(pipRow);
  }

  el.appendChild(makeSynergyTooltip(card, bd));

  if (context !== 'shop' && context !== 'viewer') {
    el.onclick = () => onCardClick(card._id);
    if (S.sellMode) el.classList.add('sell-hover');
  }

  el.addEventListener('mouseenter', () => {
    const rect = el.getBoundingClientRect();
    el.classList.toggle('tooltip-below', rect.top < 180);
  });

  return el;
}

function itemAbbrev(id) {
  if (id.startsWith('Emblem of ')) return 'E' + id.slice(10, 11);
  if (id.startsWith('Crest of '))  return 'C' + id.slice(9, 10);
  // Two-letter abbreviation from initials, handles apostrophes.
  const cleaned = id.replace(/['']/g, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function makeEmptySlot() {
  const el = document.createElement('div');
  el.className = 'card-slot';
  return el;
}

// Distribute `total` across `items` proportionally by `weights` using
// largest-remainder rounding so the integers sum exactly to `total`.
function allocateByWeight(items, weights, total) {
  if (!items.length) return [];
  if (total <= 0) return items.map(c => ({ card: c, score: 0 }));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const even = Math.floor(total / items.length);
    return items.map((c, i) => ({ card: c, score: i === 0 ? total - even * (items.length - 1) : even }));
  }
  const raw     = weights.map(w => (w / sum) * total);
  const floored = raw.map(Math.floor);
  let rem = total - floored.reduce((a, b) => a + b, 0);
  const diffs = raw.map((v, i) => v - floored[i]);
  diffs.map((_, i) => i).sort((a, b) => diffs[b] - diffs[a]).forEach((idx, rank) => {
    if (rank < rem) floored[idx]++;
  });
  return items.map((c, i) => ({ card: c, score: floored[i] }));
}


function makeItemTooltip(item) {
  const tt = document.createElement('span');
  tt.className = 'item-tooltip';
  const name = document.createElement('strong');
  name.className = 'item-tt-name';
  name.textContent = item.name;
  const desc = document.createElement('span');
  desc.textContent = item.description;
  tt.appendChild(name);
  tt.appendChild(desc);
  return tt;
}

// ── Scoring modal (Phase 11) ──────────────────────────────────────────────────

function makeScoringCard(card) {
  const el = document.createElement('div');
  el.className = `scoring-card species-${card.species.toLowerCase()}`;
  const stars = '★'.repeat(card.stars) + '☆'.repeat(3 - card.stars);
  el.innerHTML = `
    <div class="sc-stars">${stars}</div>
    <div class="sc-name">${card.name}</div>
    <div class="sc-species">${card.species}</div>
    <div class="sc-score"></div>
  `;
  return el;
}

function showScoringModal() {
  const r = S.result;

  // Use the snapshot captured in runBattle() before roundsSinceBought was ticked,
  // so animation scores match the card-face scores shown during the shop phase.
  const breakdown = r.scoreBreakdown;
  const playerWeights = breakdown.perCard.map(e => Math.max(1, e.final));
  const playerEntries = allocateByWeight(breakdown.perCard.map(e => e.card), playerWeights, r.playerScore);

  const judge = HEAD_JUDGES.find(j => j.id === r.judgeId);
  const judgeName = judge ? judge.name : 'The Judges';
  const heading = r.isCritique
    ? `Critique Session — ${judgeName}`
    : `Round ${r.round} — ${judgeName}`;
  const preferredNote = (r.qualified && judge && !judge.isNeutral)
    ? `<div style="font-size:11px;color:#3fb950;margin-top:2px">✓ Preferred (−15% applied)</div>`
    : '';
  if (r.isCritique) {
    qs('#modal').classList.add('critique-round');
  } else {
    qs('#modal').classList.remove('critique-round');
  }

  qs('#modal-content').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h2 style="margin:0">${heading}</h2>
      <button id="scoring-skip" class="btn-secondary" style="font-size:11px;padding:4px 10px">Skip</button>
    </div>
    <div class="scoring-columns">
      <div class="scoring-col">
        <div class="scoring-col-label">Your Exhibition</div>
        <div class="scoring-cards" id="scoring-player-cards"></div>
        <div class="scoring-total"><span class="scoring-total-label">Total </span><span id="scoring-player-total">0</span></div>
      </div>
      <div class="scoring-col scoring-col-target">
        <div class="scoring-target-label">Judge's Target</div>
        <div class="scoring-target-number">${r.target}</div>
        ${preferredNote}
      </div>
    </div>
    <div id="scoring-winner" class="hidden"></div>
    <div style="text-align:center;margin-top:12px">
      <button id="scoring-continue" class="btn-primary hidden">Continue \u2192</button>
    </div>
  `;
  qs('#modal-actions').classList.add('hidden');
  qs('#modal').classList.add('scoring');
  qs('#modal').classList.remove('side-panel');
  qs('#modal').classList.remove('hidden');

  const playerCardsEl = qs('#scoring-player-cards');
  const playerCardEls = playerEntries.map(e => {
    const el = makeScoringCard(e.card);
    playerCardsEl.appendChild(el);
    return el;
  });

  const playerTotalEl = qs('#scoring-player-total');

  const onDone = () => {
    const winnerEl = qs('#scoring-winner');
    if (!winnerEl) return;
    winnerEl.classList.remove('hidden');
    const passed = r.passed;
    Sound.play(passed ? 'win' : 'loss');
    winnerEl.className = 'scoring-winner ' + (passed ? 'win' : 'loss');
    if (passed) {
      if (r.lifeGained) {
        Sound.play('sealRestored');
        winnerEl.innerHTML = `Target cleared! ${r.playerScore} \u2265 ${r.target} <span class="scoring-life-regain">\u25c6 Seal restored!</span>`;
      } else {
        winnerEl.textContent = `Target met! ${r.playerScore} \u2265 ${r.target}`;
      }
    } else {
      const sealsLeft = r.livesAfter;
      const sealText  = sealsLeft === 0 ? 'No seals left \u2014 run over' : `${sealsLeft} seal${sealsLeft === 1 ? '' : 's'} remain`;
      winnerEl.textContent = `Target missed \u2014 ${r.playerScore} / ${r.target} \u00b7 Seal lost \u00b7 ${sealText}`;
      Sound.play('sealLost');
    }
    updateHUD();
    // Animate the seal that just changed state.
    const sealsEl = qs('#hud-lives');
    if (sealsEl) {
      if (!passed) {
        // The seal at index r.livesAfter just became empty \u2014 flash it.
        const seals = sealsEl.querySelectorAll('.life-seal');
        const lostSeal = seals[r.livesAfter];
        if (lostSeal) {
          lostSeal.classList.add('seal-shatter');
          setTimeout(() => lostSeal.classList.remove('seal-shatter'), 600);
        }
      }
    }
    const b = qs('#scoring-continue');
    if (b) {
      if (r.lifeGained) {
        setTimeout(() => { if (b.isConnected) b.classList.remove('hidden'); }, 500);
      } else {
        b.classList.remove('hidden');
      }
    }
  };

  const skip = animateScoringSequence(
    playerEntries.map((e, i) => ({ ...e, el: playerCardEls[i] })),
    [],
    playerTotalEl, null, onDone
  );

  qs('#scoring-skip').onclick     = () => { Sound.play('uiClick'); skip(); };
  qs('#scoring-continue').onclick = () => {
    Sound.play('uiClick');
    qs('#modal').classList.remove('scoring');
    qs('#modal').classList.remove('critique-round');
    onContinue();
  };
}

// Steps through player cards then opponent cards revealing scores with a
// CSS punch animation. Returns a skip() fn that snaps straight to final state.
function animateScoringSequence(playerEntries, opponentEntries, playerTotalEl, oppTotalEl, onDone) {
  const timeouts = [], rafs = [];
  let done = false;

  function schedule(fn, delay) {
    timeouts.push(setTimeout(() => { if (!done) fn(); }, delay));
  }

  function tickTotal(el, from, to) {
    if (from === to) { el.textContent = to; return; }
    const duration = 300, start = performance.now();
    (function frame(now) {
      if (done) { el.textContent = to; return; }
      const t = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(from + (to - from) * t);
      if (t < 1) rafs.push(requestAnimationFrame(frame));
    })(performance.now());
  }

  function showDelta(totalEl, score) {
    const d = document.createElement('span');
    d.className = 'score-delta';
    d.textContent = `+${score}`;
    totalEl.parentElement.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }

  let t = 0, playerSum = 0;
  for (const e of playerEntries) {
    const delay = t, prev = playerSum, next = playerSum += e.score;
    schedule(() => {
      e.el.classList.add('punching');
      setTimeout(() => e.el.classList.remove('punching'), 280);
    }, delay);
    schedule(() => {
      Sound.play('cardScore');
      e.el.querySelector('.sc-score').textContent = e.score;
      e.el.classList.add('scored');
      tickTotal(playerTotalEl, prev, next);
      showDelta(playerTotalEl, e.score);
    }, delay + 120);
    t += 400;
  }

  t += 600; // pause between player and opponent phases

  let oppSum = 0;
  for (const e of opponentEntries) {
    const delay = t, prev = oppSum, next = oppSum += e.score;
    schedule(() => {
      e.el.classList.add('punching');
      setTimeout(() => e.el.classList.remove('punching'), 280);
    }, delay);
    schedule(() => {
      Sound.play('oppCardScore');
      e.el.querySelector('.sc-score').textContent = e.score;
      e.el.classList.add('scored');
      tickTotal(oppTotalEl, prev, next);
      showDelta(oppTotalEl, e.score);
    }, delay + 120);
    t += 400;
  }

  schedule(onDone, t + 800);

  return function skip() {
    done = true;
    timeouts.forEach(clearTimeout);
    rafs.forEach(cancelAnimationFrame);
    for (const e of playerEntries) {
      e.el.querySelector('.sc-score').textContent = e.score;
      e.el.classList.add('scored');
    }
    for (const e of opponentEntries) {
      e.el.querySelector('.sc-score').textContent = e.score;
      e.el.classList.add('scored');
    }
    playerTotalEl.textContent = playerSum;
    if (oppTotalEl) oppTotalEl.textContent = oppSum;
    onDone();
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────
function qs(sel) { return document.querySelector(sel); }
