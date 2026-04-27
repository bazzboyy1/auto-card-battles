'use strict';

// Unit tests for achievement check() functions in achievements.js.
// Run: node src/test_achievements.js

const assert = require('assert');
const { ACHIEVEMENTS } = require('./achievements');

function find(id) { return ACHIEVEMENTS.find(a => a.id === id); }

// Minimal run-like object. stats fields not supplied default to zero/false.
function makeRun({ round = 0, stats = {}, activeCards = [] } = {}) {
  return {
    round,
    stats: {
      maxClassSynergiesActive: 0,
      maxCrystallineActive:    0,
      allSpeciesRepresented:   false,
      maxTripleStarsActive:    0,
      ...stats,
    },
    player: { board: { active: activeCards } },
  };
}

function card(roundsSinceBought) { return { roundsSinceBought }; }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓  ${name}`); pass++; }
  catch (e) { console.log(`  ✗  ${name}: ${e.message}`); fail++; }
}

// ----- emotional_range -----
{
  const a = find('emotional_range');
  console.log('\nemotional_range');
  test('fires at exactly 3 class synergies', () =>
    assert.ok(a.check(makeRun({ stats: { maxClassSynergiesActive: 3 } }))));
  test('fires above 3', () =>
    assert.ok(a.check(makeRun({ stats: { maxClassSynergiesActive: 5 } }))));
  test('does not fire at 2', () =>
    assert.ok(!a.check(makeRun({ stats: { maxClassSynergiesActive: 2 } }))));
  test('does not fire at 0', () =>
    assert.ok(!a.check(makeRun({ stats: { maxClassSynergiesActive: 0 } }))));
}

// ----- patient_collector -----
{
  const a = find('patient_collector');
  console.log('\npatient_collector');
  test('fires at round 16 with exactly 3 cards >= 10 rounds', () =>
    assert.ok(a.check(makeRun({
      round: 16,
      activeCards: [card(10), card(10), card(10)],
    }))));
  test('fires above round 16 with 3+ long-held cards', () =>
    assert.ok(a.check(makeRun({
      round: 20,
      activeCards: [card(10), card(14), card(20), card(2)],
    }))));
  test('does not fire at round 15 even with 3 qualifying cards', () =>
    assert.ok(!a.check(makeRun({
      round: 15,
      activeCards: [card(10), card(10), card(10)],
    }))));
  test('does not fire at round 16 with only 2 qualifying cards', () =>
    assert.ok(!a.check(makeRun({
      round: 16,
      activeCards: [card(10), card(10), card(5)],
    }))));
  test('does not fire at round 16 with 0 cards', () =>
    assert.ok(!a.check(makeRun({ round: 16, activeCards: [] }))));
  test('undefined roundsSinceBought is treated as 0 (no false positive)', () =>
    assert.ok(!a.check(makeRun({
      round: 16,
      activeCards: [card(undefined), card(undefined), card(undefined)],
    }))));
  test('roundsSinceBought exactly 10 counts toward threshold', () =>
    assert.ok(a.check(makeRun({
      round: 16,
      activeCards: [card(10), card(10), card(10)],
    }))));
  test('roundsSinceBought 9 does not count', () =>
    assert.ok(!a.check(makeRun({
      round: 16,
      activeCards: [card(9), card(10), card(10)],
    }))));
}

// ----- star_collector -----
{
  const a = find('star_collector');
  console.log('\nstar_collector');
  test('fires when maxTripleStarsActive >= 2', () =>
    assert.ok(a.check(makeRun({ stats: { maxTripleStarsActive: 2 } }))));
  test('fires above 2', () =>
    assert.ok(a.check(makeRun({ stats: { maxTripleStarsActive: 3 } }))));
  test('does not fire at 1', () =>
    assert.ok(!a.check(makeRun({ stats: { maxTripleStarsActive: 1 } }))));
  test('does not fire at 0', () =>
    assert.ok(!a.check(makeRun({ stats: { maxTripleStarsActive: 0 } }))));
}

// ----- crystal_formation -----
{
  const a = find('crystal_formation');
  console.log('\ncrystal_formation');
  test('fires at exactly 4 crystalline and round 12', () =>
    assert.ok(a.check(makeRun({ round: 12, stats: { maxCrystallineActive: 4 } }))));
  test('fires with 6 crystalline at round 24', () =>
    assert.ok(a.check(makeRun({ round: 24, stats: { maxCrystallineActive: 6 } }))));
  test('does not fire with 4 crystalline at round 11', () =>
    assert.ok(!a.check(makeRun({ round: 11, stats: { maxCrystallineActive: 4 } }))));
  test('does not fire with 3 crystalline at round 12', () =>
    assert.ok(!a.check(makeRun({ round: 12, stats: { maxCrystallineActive: 3 } }))));
  test('does not fire with 3 crystalline at round 11', () =>
    assert.ok(!a.check(makeRun({ round: 11, stats: { maxCrystallineActive: 3 } }))));
  test('fires even when player dies on round 12 (round reached = 12)', () =>
    assert.ok(a.check(makeRun({ round: 12, stats: { maxCrystallineActive: 4 } }))));
}

// ----- well_rounded -----
{
  const a = find('well_rounded');
  console.log('\nwell_rounded');
  test('fires when allSpeciesRepresented is true', () =>
    assert.ok(a.check(makeRun({ stats: { allSpeciesRepresented: true } }))));
  test('does not fire when allSpeciesRepresented is false', () =>
    assert.ok(!a.check(makeRun({ stats: { allSpeciesRepresented: false } }))));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
