// Synthetic sound effects — Web Audio API, no assets required.
const Sound = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function osc(c, freq, type, start, dur, vol) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(start); o.stop(start + dur + 0.02);
  }

  function sweep(c, f0, f1, type, start, dur, vol) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.linearRampToValueAtTime(f1, start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(start); o.stop(start + dur + 0.02);
  }

  const defs = {
    buy() {
      const c = getCtx(), t = c.currentTime;
      sweep(c, 440, 880, 'sine', t, 0.08, 0.12);
    },
    sell() {
      const c = getCtx(), t = c.currentTime;
      sweep(c, 700, 350, 'sine', t, 0.09, 0.10);
    },
    reroll() {
      const c = getCtx(), t = c.currentTime;
      [300, 380, 460].forEach((f, i) => osc(c, f, 'square', t + i * 0.045, 0.035, 0.07));
    },
    combine() {
      const c = getCtx(), t = c.currentTime;
      // ascending arpeggio C4–E4–G4–C5
      [261, 329, 392, 523].forEach((f, i) => osc(c, f, 'sine', t + i * 0.1, 0.18, 0.14));
    },
    cardScore() {
      const c = getCtx(), t = c.currentTime;
      osc(c, 660, 'triangle', t, 0.07, 0.09);
    },
    win() {
      const c = getCtx(), t = c.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => osc(c, f, 'sine', t + i * 0.14, 0.30, 0.13));
      // sustain chord
      [523, 659, 784].forEach(f => osc(c, f, 'sine', t + 0.58, 0.55, 0.055));
    },
    loss() {
      const c = getCtx(), t = c.currentTime;
      // descending minor run
      [440, 392, 330, 262].forEach((f, i) => osc(c, f, 'sine', t + i * 0.19, 0.22, 0.11));
    },
    plinth() {
      const c = getCtx(), t = c.currentTime;
      sweep(c, 110, 40, 'sawtooth', t, 0.14, 0.18);
      osc(c, 1200, 'sine', t + 0.06, 0.28, 0.09);
    },
    augmentPing() {
      const c = getCtx(), t = c.currentTime;
      osc(c, 880, 'sine', t, 0.18, 0.09);
      osc(c, 1174, 'sine', t + 0.18, 0.22, 0.09);
    },
    roundStart() {
      const c = getCtx(), t = c.currentTime;
      sweep(c, 220, 330, 'sine', t, 0.28, 0.12);
      osc(c, 440, 'sine', t + 0.22, 0.22, 0.07);
    },
    // 3-star rank-up — same arpeggio as combine but extended + shimmer tail
    combine3() {
      const c = getCtx(), t = c.currentTime;
      [261, 329, 392, 523, 659].forEach((f, i) => osc(c, f, 'sine', t + i * 0.09, 0.22, 0.15));
      // shimmer: high trill at the peak
      [1046, 1318, 1046].forEach((f, i) => osc(c, f, 'sine', t + 0.40 + i * 0.07, 0.12, 0.09));
      // sustain chord underneath
      [523, 659, 784].forEach(f => osc(c, f, 'sine', t + 0.55, 0.45, 0.05));
    },
    equipItem() {
      const c = getCtx(), t = c.currentTime;
      osc(c, 480, 'triangle', t, 0.06, 0.10);
      osc(c, 720, 'triangle', t + 0.06, 0.09, 0.10);
    },
    unequipItem() {
      const c = getCtx(), t = c.currentTime;
      sweep(c, 600, 280, 'triangle', t, 0.09, 0.09);
    },
    cardActive() {
      const c = getCtx(), t = c.currentTime;
      osc(c, 520, 'sine', t, 0.07, 0.10);
    },
    cardBench() {
      const c = getCtx(), t = c.currentTime;
      osc(c, 280, 'sine', t, 0.07, 0.08);
    },
    oppCardScore() {
      const c = getCtx(), t = c.currentTime;
      osc(c, 380, 'triangle', t, 0.07, 0.07);
    },
    pickAugment() {
      const c = getCtx(), t = c.currentTime;
      // warm gold chord stab
      [392, 494, 587].forEach((f, i) => osc(c, f, 'sine', t + i * 0.04, 0.28, 0.11));
    },
    pickItem() {
      const c = getCtx(), t = c.currentTime;
      sweep(c, 500, 800, 'sine', t, 0.12, 0.11);
      osc(c, 1000, 'sine', t + 0.10, 0.12, 0.07);
    },
    uiClick() {
      const c = getCtx(), t = c.currentTime;
      osc(c, 700, 'triangle', t, 0.025, 0.06);
    },
    gameWin() {
      const c = getCtx(), t = c.currentTime;
      // ascending fanfare + big chord landing
      [392, 494, 587, 784, 988].forEach((f, i) => osc(c, f, 'sine', t + i * 0.13, 0.35, 0.13));
      [523, 659, 784, 1046].forEach(f => osc(c, f, 'sine', t + 0.68, 0.90, 0.07));
      // high shimmer
      [1318, 1568].forEach((f, i) => osc(c, f, 'sine', t + 0.72 + i * 0.12, 0.35, 0.05));
    },
    gameLoss() {
      const c = getCtx(), t = c.currentTime;
      // minor chord stab then slow descend
      [392, 466, 523].forEach(f => osc(c, f, 'sine', t, 0.20, 0.10));
      [330, 294, 247, 220].forEach((f, i) => osc(c, f, 'sine', t + 0.25 + i * 0.22, 0.28, 0.11));
    },
    lockMarket() {
      const c = getCtx(), t = c.currentTime;
      sweep(c, 300, 180, 'sawtooth', t, 0.07, 0.14);
      osc(c, 900, 'triangle', t + 0.05, 0.05, 0.08);
    },
    sealLost() {
      const c = getCtx(), t = c.currentTime;
      // short crack + downward thud — distinct from the gentle 'loss' melody
      osc(c, 90, 'sawtooth', t, 0.04, 0.28);
      sweep(c, 380, 70, 'sawtooth', t + 0.01, 0.15, 0.22);
      osc(c, 220, 'square', t + 0.03, 0.06, 0.14);
    },
    sealRestored() {
      const c = getCtx(), t = c.currentTime;
      // ascending bell-like chord — triumphant but brief
      [784, 988, 1174, 1568].forEach((f, i) => osc(c, f, 'sine', t + i * 0.09, 0.22, 0.13));
      osc(c, 1960, 'sine', t + 0.40, 0.22, 0.08);
    },
    grandFinale() {
      const c = getCtx(), t = c.currentTime;
      // dramatic low build then bright chord
      [196, 247, 294].forEach((f, i) => osc(c, f, 'sawtooth', t + i * 0.09, 0.30, 0.14));
      osc(c, 392, 'sine', t + 0.32, 0.50, 0.12);
      osc(c, 523, 'sine', t + 0.52, 0.38, 0.09);
    },
  };

  return {
    play(name) {
      if (muted) return;
      try { defs[name]?.(); } catch (_) {}
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted },
  };
})();
