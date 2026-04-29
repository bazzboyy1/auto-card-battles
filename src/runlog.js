'use strict';

// Run telemetry logger. Browser-only side-effect — no-op in Node.js (sim).
//
// Captures every meaningful player decision plus per-round snapshots so we
// can analyse skilled human play vs. the sim AI. Output is a JSON blob
// downloadable from the HUD or game-over modal.
//
// Schema (top-level):
//   meta:    { version, seed, startedAt, endedAt, durationMs, difficulty, finalResult, ua }
//   rounds:  [{ round, chapter, judge, target, events:[...], readyState, result }]
//
// Event payloads are flat objects with a `t` (type) field and `ts` (ms since
// game start). Schema is intentionally tolerant — missing fields just mean
// the event didn't carry that data.

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

class RunLog {
  constructor() {
    this.reset();
  }

  reset() {
    this.meta = {
      version:     null,
      seed:        null,
      startedAt:   null,
      endedAt:     null,
      durationMs:  null,
      difficulty:  null,
      finalResult: null,
      ua:          IS_BROWSER ? (navigator.userAgent || null) : null,
    };
    this.rounds       = [];
    this._current     = null;     // round-in-progress entry
    this._startMs     = 0;
  }

  startGame({ version, seed, difficulty }) {
    this.reset();
    this._startMs       = Date.now();
    this.meta.version   = version || null;
    this.meta.seed      = (seed === 0 || seed) ? seed : null;
    this.meta.startedAt = new Date(this._startMs).toISOString();
    this.meta.difficulty = difficulty || null;
  }

  // Begin a new round entry. Subsequent log() calls attach to this round.
  startRound({ round, chapter, judge, target }) {
    this._flushCurrent(); // safety: if previous round wasn't closed
    this._current = {
      round:      round,
      chapter:    chapter,
      judge:      judge ? {
        id:              judge.id,
        name:            judge.name,
        preference:      judge.preference,
        qualifyingHint:  judge.qualifyingHint,
        isNeutral:       !!judge.isNeutral,
      } : null,
      target:     target || null,
      events:     [],
      readyState: null,
      result:     null,
    };
  }

  // Log an event into the current round. Silently no-ops if no round open
  // (e.g. events fired between rounds — we attach them to the next round
  // when it opens, but for simplicity we drop them here).
  log(event) {
    if (!this._current) return;
    const ts = Date.now() - this._startMs;
    this._current.events.push({ ts, ...event });
  }

  setReadyState(snapshot) {
    if (!this._current) return;
    this._current.readyState = snapshot;
  }

  // Close the current round with its battle result, push to rounds[].
  setRoundResult(result) {
    if (!this._current) return;
    this._current.result = result;
    this.rounds.push(this._current);
    this._current = null;
  }

  _flushCurrent() {
    if (this._current) {
      this.rounds.push(this._current);
      this._current = null;
    }
  }

  endGame(finalResult) {
    this._flushCurrent();
    const now = Date.now();
    this.meta.endedAt   = new Date(now).toISOString();
    this.meta.durationMs = now - this._startMs;
    this.meta.finalResult = finalResult || null;
  }

  toJSON() {
    return {
      meta:   this.meta,
      rounds: this.rounds,
    };
  }

  // Trigger a browser file download. No-op outside a browser.
  download(filename) {
    if (!IS_BROWSER) return false;
    try {
      const blob = new Blob([JSON.stringify(this.toJSON(), null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename || this._defaultFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      console.error('RunLog.download failed:', e);
      return false;
    }
  }

  _defaultFilename() {
    const d = new Date(this._startMs || Date.now());
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const v = this.meta.version ? `-v${this.meta.version}` : '';
    return `runlog${v}-${stamp}.json`;
  }
}

// Snapshot helpers — keep these in the module so app.js stays slim.
// Build a serializable representation of a card (no functions, no DOM refs).
function snapshotCard(card, scoreInfo) {
  if (!card) return null;
  const out = {
    id:                  card._id || null,
    name:                card.name,
    stars:               card.stars,
    species:             card.species,
    class:               card.class,
    tier:                card.tier,
    baseScore:           card.baseScore,
    roundsSinceBought:   card.roundsSinceBought || 0,
    items:               (card.items || []).map(e => e.id),
  };
  if (card.shapeshifterSpecies) out.shapeshifterSpecies = card.shapeshifterSpecies;
  if (scoreInfo && typeof scoreInfo.final === 'number') {
    out.scoreFinal = Math.round(scoreInfo.final);
    if (scoreInfo.lines) out.scoreLines = scoreInfo.lines.map(l => ({ ...l }));
  }
  return out;
}

// Snapshot the player's full board + augments + items + synergies at a moment.
// `breakdown` is the calcScoreBreakdown result for the player's board (optional).
// `speciesCounts` and `classCounts` are objects { Species: count }.
function snapshotBoard(player, run, breakdown, speciesCounts, classCounts) {
  const perCardMap = new Map();
  if (breakdown && breakdown.perCard) {
    for (const e of breakdown.perCard) perCardMap.set(e.card._id, e);
  }
  return {
    gold:        player.gold,
    level:       player.level,
    streak:      player.streak,
    wins:        player.wins,
    losses:      player.losses,
    active:      player.board.active.map(c => snapshotCard(c, perCardMap.get(c._id))),
    bench:       player.board.bench.map(c => snapshotCard(c, perCardMap.get(c._id))),
    activeMax:   player.board.maxActive,
    augments:    (run.augments || []).slice(),
    itemBag:     (player.itemBag  || []).slice(),
    synergies:   {
      species: speciesCounts || {},
      class:   classCounts   || {},
    },
    boardScoreTotal: breakdown ? Math.round(breakdown.total) : null,
  };
}

module.exports = {
  RunLog,
  snapshotCard,
  snapshotBoard,
};
