'use strict';

// ── Module refs ───────────────────────────────────────────────────────────────
let mulberry32, CARD_DEFS, CARD_COSTS, SYNERGIES, CLASS_SYNERGIES, STAR_MULT;
let Run, POLICIES, BASE_INCOME, INTEREST_PER;
let ITEM_DEFS, attachItem, detachItem;
let AUGMENT_DEFS;
let LEVEL_WEIGHTS;
let effectiveSpeciesCounts, effectiveClassCounts;
const DEV_MODE = typeof window !== 'undefined' && /[?&]dev=1\b/.test(window.location.search || '');

const CLASS_GLYPHS = { Shy: '◌', Livid: '◆', Giddy: '◈', Sullen: '▪', Pompous: '▲' };

// ── State ─────────────────────────────────────────────────────────────────────
const S = {
  run:          null,
  human:        null,
  // phases: 'augment' | 'shapeshifter' | 'item' | 'shop' | 'scoring' | 'over'
  phase:        'shop',
  result:       null,
  sellMode:     false,
  augmentOffer: null,  // current 3-id augment offer being displayed
  itemOffer:    null,  // current 3-id item offer being displayed
  attachItem:   null,  // itemId currently in attach mode
};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('acb-ready', () => {
  ({ mulberry32 }                                  = window.ACB.utils);
  ({ CARD_DEFS, CARD_COSTS, SYNERGIES, CLASS_SYNERGIES, STAR_MULT } = window.ACB.cards);
  ({ Run }                                         = window.ACB.game);
  ({ POLICIES }                                    = window.ACB.sim);
  ({ BASE_INCOME, INTEREST_PER }                   = window.ACB.game);
  ({ ITEM_DEFS, attachItem, detachItem }           = window.ACB.items);
  ({ AUGMENT_DEFS }                                = window.ACB.augments);
  ({ effectiveSpeciesCounts, effectiveClassCounts } = window.ACB.board);
  ({ LEVEL_WEIGHTS }                               = window.ACB.shop);

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

  qs('#btn-start').onclick = () => {
    Sound.play('roundStart');
    qs('#btn-start').disabled = true;
    qs('#loading').classList.add('hidden');
    showRulesModal();
  };
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
        <li><strong>Outscore</strong> your opponent's exhibit to keep your Rep — lose Rep on defeat, hit 0 and it's over</li>
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

// ── New game ──────────────────────────────────────────────────────────────────
function newGame() {
  const rng  = mulberry32(Date.now() | 0);
  S.run      = new Run(rng);
  S.human    = S.run.player;
  S.human.isHuman = true;
  S.human.name    = 'You';
  S.phase      = 'shop';
  S.sellMode   = false;
  S.itemOffer  = null;
  S.attachItem = null;
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

// Check for pending picks before income + shop. Both augment and item picks
// happen BEFORE earnIncome so Tycoon/Midas effects apply this round.
function startRound() {
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
  S.human.shop.refresh();
  S.phase    = 'shop';
  S.sellMode = false;
  render();
}

function onReady() {
  Sound.play('roundStart');
  S.result = S.run.runBattle();
  S.result.opponentBoard = generateOpponentSnapshot(S.result.round, S.result.opponent);
  S.phase  = 'scoring';
  render();
}

// Cosmetic opponent board snapshot — decorative only, uses a separate RNG
// seeded from round + name so it's stable across re-renders of the same result.
function generateOpponentSnapshot(round, opponentName) {
  const SPECIES = ['Plasmic', 'Sporal', 'Chitinous', 'Crystalline', 'Abyssal'];
  let seed = round * 2654435761;
  for (let i = 0; i < opponentName.length; i++) seed ^= opponentName.charCodeAt(i) * 1000003;
  const rng = mulberry32(seed | 0);

  const dominant = SPECIES[Math.floor(rng() * SPECIES.length)];
  const secondary = SPECIES[Math.floor(rng() * SPECIES.length)];
  const size = Math.min(6, 3 + Math.floor(round / 7));
  const avgStars = round <= 5 ? 1 : round <= 12 ? 1.5 : round <= 20 ? 2 : 2.5;

  const domPool = CARD_DEFS.filter(d => d.species === dominant);
  const secPool = CARD_DEFS.filter(d => d.species === secondary && d.species !== dominant);
  const cards = [];
  for (let i = 0; i < size; i++) {
    const useSecondary = secPool.length && i >= Math.ceil(size * 0.6) && rng() > 0.4;
    const pool = useSecondary ? secPool : domPool;
    const def = pool[Math.floor(rng() * pool.length)];
    const stars = Math.min(3, Math.max(1, Math.round(avgStars + (rng() - 0.5))));
    cards.push({ name: def.name, species: def.species, tier: def.tier, baseScore: def.baseScore, stars, _id: -(round * 100 + i + 1), items: [] });
  }
  return { cards, dominantSpecies: dominant };
}

function onContinue() {
  if (S.run.isOver()) {
    S.phase = 'over';
    render();
    return;
  }
  startRound();
}

// Augment pick: user clicked card at index idx.
function onPickAugment(idx) {
  Sound.play('pickAugment');
  const chosenId = S.run.pickAugment(idx);
  if (!chosenId) return;
  if (chosenId === 'Shapeshifter') {
    S.phase = 'shapeshifter';
    render();
    return;
  }
  finishRoundSetup();
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

// ── Human shop actions ────────────────────────────────────────────────────────
function onBuyShop(slotIdx) {
  if (S.sellMode) return;
  if (S.human.board.isFull()) return;
  const card = S.human.shop.buy(slotIdx);
  if (!card) return;
  Sound.play('buy');
  S.human.board.addCard(card);
  const upgraded = runCombinesWithEffect();
  render();
  animateRankUps(upgraded);
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
      const idx = S.human.itemBag.indexOf(S.attachItem);
      if (idx !== -1 && attachItem(card, S.attachItem)) {
        S.human.itemBag.splice(idx, 1);
        Sound.play('equipItem');
      }
    }
    S.attachItem = null;
    render();
    return;
  }
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
  const inPreRound = ['augment', 'shapeshifter', 'item', 'shop'].includes(S.phase);
  const round = S.run.round + (inPreRound ? 1 : 0);
  qs('#hud-round').textContent = `Round ${round} / 30`;
  qs('#hud-phase').textContent = S.phase === 'shop' ? 'Market'
    : S.phase === 'augment' || S.phase === 'shapeshifter' ? 'Augment'
    : S.phase === 'item' ? 'Item Pick'
    : S.phase === 'scoring' ? 'Judging'
    : 'Battle';
  qs('#hud-phase').className   = 'phase-tag' + (!inPreRound ? ' battle' : '');

  const hpEl  = qs('#hud-hp');
  const hpTip = hpEl.querySelector('.hud-tip');
  hpEl.textContent = h.hp + ' Rep';
  hpEl.className   = 'stat-hp hud-stat-tip' + (h.hp <= 30 ? ' low' : h.hp <= 60 ? ' mid' : '');
  if (hpTip) hpEl.appendChild(hpTip);

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
  let total, parts;
  if (bd) {
    total = bd.total;
    parts = [`Base ${bd.base}g`];
    if (bd.interest > 0) parts.push(`Interest +${bd.interest}g${bd.tycoon ? ' (×2)' : ''}`);
    if (bd.streak   > 0) parts.push(`Streak +${bd.streak}g`);
  } else {
    const interest    = Math.min(5, Math.floor(S.human.gold / INTEREST_PER));
    const streakBonus = S.human._streakBonus ? S.human._streakBonus() : 0;
    total             = BASE_INCOME + interest + streakBonus;
    parts = [`Base ${BASE_INCOME}g`];
    if (interest > 0)    parts.push(`Interest +${interest}g`);
    if (streakBonus > 0) parts.push(`Streak +${streakBonus}g`);
  }
  qs('#income-preview').textContent = `Next income: ${total}g  (${parts.join(' · ')})`;
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
  const h       = S.human;
  const survived = h.hp > 0;
  Sound.play(survived ? 'gameWin' : 'gameLoss');
  let html = `<h2>${survived ? '🏆 Run Complete' : 'Run Over'}</h2>`;
  html += `<p style="margin-bottom:14px;color:var(--text-muted)">${
    survived ? 'You survived all 30 rounds.' : `Defeated at round ${S.run.round}.`
  }</p>`;

  html += `<div class="final-stats">
    <div><span class="area-label">Rounds survived</span> <span class="stat-big">${S.run.round}</span></div>
    <div><span class="area-label">Final Rep</span> <span class="stat-big">${h.hp}</span></div>
    <div><span class="area-label">Record</span> <span class="stat-big">${h.wins}W ${h.losses}L</span></div>
    <div><span class="area-label">Level</span> <span class="stat-big">Exhibit Lvl ${h.level}</span></div>
  </div>`;

  if (S.run.augments.length) {
    html += `<div class="area-label" style="margin-top:14px;margin-bottom:6px">Augments</div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:5px">`;
    for (const id of S.run.augments) {
      const aug = AUGMENT_DEFS.find(a => a.id === id);
      if (aug) html += `<span class="augment-badge" title="${aug.description}">${aug.name}</span>`;
    }
    html += `</div>`;
  }

  if (S.run.opponentHistory.length) {
    html += `<div class="area-label" style="margin-top:14px;margin-bottom:4px">Opponents</div>`;
    html += `<div class="opp-history">`;
    for (const hist of S.run.opponentHistory) {
      const mark = hist.won ? '✓' : '✗';
      const cls  = hist.won ? 'winner' : 'loser';
      html += `<div class="history-row">
        <span class="history-rnd">R${hist.round}</span>
        <span class="${cls}">${mark}</span>
        <span class="history-name">${hist.opponent}</span>
        <span class="history-scores">${hist.playerScore} vs ${hist.opponentScore}</span>
      </div>`;
    }
    html += `</div>`;
  }

  qs('#modal-content').innerHTML = html;
  qs('#modal-actions').classList.remove('hidden');
  qs('#btn-continue').textContent = 'Play Again';
  qs('#btn-continue').onclick = () => { newGame(); };
  qs('#modal').classList.remove('side-panel');
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
  const dispScore = bd ? bd.final : baseScore;
  const sellVal  = card.tier ? Math.round(CARD_COSTS[card.tier] * Math.pow(3, card.stars - 1)) : 0;

  el.innerHTML = `
    <div class="card-stars">${stars}</div>
    <div class="card-name">${card.name}</div>
    <div class="card-labels">
      <span class="card-species">${card.species}</span>
      ${card.shapeshifterSpecies ? `<span class="card-species" style="color:#9dcc50">+${card.shapeshifterSpecies}</span>` : ''}
      ${card.class ? `<span class="card-class">${CLASS_GLYPHS[card.class] || ''}${card.class}</span>` : ''}
    </div>
    <div class="card-score">${dispScore}${bd && bd.final !== baseScore ? `<span class="card-base-score">(${baseScore})</span>` : ''}</div>
    <div class="card-tier">T${card.tier}</div>
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
          if (detachItem(card, capturedId)) {
            Sound.play('unequipItem');
            S.human.itemBag.push(capturedId);
          }
          render();
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

// Returns [{card, score}] for opponent's cosmetic board where scores
// are fabricated proportionally from totalScore (real opponent curve value).
function calcOpponentPerCardScores(oppBoard, totalScore) {
  const cards = oppBoard.cards;
  const weights = cards.map(c => c.baseScore * (STAR_MULT[c.stars] || 1));
  return allocateByWeight(cards, weights, totalScore);
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
  const opponentEntries = calcOpponentPerCardScores(r.opponentBoard, r.opponentScore);

  qs('#modal-content').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h2 style="margin:0">Round ${r.round} — Judging</h2>
      <button id="scoring-skip" class="btn-secondary" style="font-size:11px;padding:4px 10px">Skip</button>
    </div>
    <div class="scoring-columns">
      <div class="scoring-col">
        <div class="scoring-col-label">Your Exhibition</div>
        <div class="scoring-cards" id="scoring-player-cards"></div>
        <div class="scoring-total"><span class="scoring-total-label">Total </span><span id="scoring-player-total">0</span></div>
      </div>
      <div class="scoring-col">
        <div class="scoring-col-label">${r.opponent}'s Exhibition</div>
        <div class="scoring-cards" id="scoring-opp-cards"></div>
        <div class="scoring-total"><span class="scoring-total-label">Total </span><span id="scoring-opp-total">0</span></div>
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

  const oppCardsEl = qs('#scoring-opp-cards');
  const oppCardEls = opponentEntries.map(e => {
    const el = makeScoringCard(e.card);
    oppCardsEl.appendChild(el);
    return el;
  });

  const playerTotalEl = qs('#scoring-player-total');
  const oppTotalEl    = qs('#scoring-opp-total');

  const onDone = () => {
    const winnerEl = qs('#scoring-winner');
    if (!winnerEl) return;
    winnerEl.classList.remove('hidden');
    const youWon = r.won;
    Sound.play(youWon ? 'win' : 'loss');
    const damage = 2 + r.round;
    winnerEl.className = 'scoring-winner ' + (youWon ? 'win' : 'loss');
    winnerEl.textContent = youWon
      ? `Victory! Reputation held at ${r.hpAfter}.`
      : `Defeat \u2014 \u2212${damage} Rep \u2192 ${r.hpAfter} Rep`;
    const b = qs('#scoring-continue'); if (b) b.classList.remove('hidden');
  };

  const skip = animateScoringSequence(
    playerEntries.map((e, i) => ({ ...e, el: playerCardEls[i] })),
    opponentEntries.map((e, i) => ({ ...e, el: oppCardEls[i] })),
    playerTotalEl, oppTotalEl, onDone
  );

  qs('#scoring-skip').onclick     = () => { Sound.play('uiClick'); skip(); };
  qs('#scoring-continue').onclick = () => { Sound.play('uiClick'); qs('#modal').classList.remove('scoring'); onContinue(); };
}

// Steps through player cards then opponent cards revealing scores with a
// CSS punch animation. Returns a skip() fn that snaps straight to final state.
function animateScoringSequence(playerEntries, opponentEntries, playerTotalEl, oppTotalEl, onDone) {
  const timeouts = [];
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
      if (t < 1) requestAnimationFrame(frame);
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
    for (const e of playerEntries) {
      e.el.querySelector('.sc-score').textContent = e.score;
      e.el.classList.add('scored');
    }
    for (const e of opponentEntries) {
      e.el.querySelector('.sc-score').textContent = e.score;
      e.el.classList.add('scored');
    }
    playerTotalEl.textContent = playerSum;
    oppTotalEl.textContent    = oppSum;
    onDone();
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────
function qs(sel) { return document.querySelector(sel); }
