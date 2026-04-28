'use strict';

// Unit tests for achievement conditionMet() functions in achievements.js.
// Run: node src/test_achievements.js

const assert = require('assert');
const { ACHIEVEMENTS } = require('./achievements');

function find(id) { return ACHIEVEMENTS.find(a => a.id === id); }

// Minimal board-like object with active cards.
function board(cards) { return { active: cards }; }

// Card factory: species + class
function card(species, cls) { return { species, class: cls }; }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓  ${name}`); pass++; }
  catch (e) { console.log(`  ✗  ${name}: ${e.message}`); fail++; }
}

// conditionMet(board, classCounts, speciesCounts)
// speciesCounts and classCounts are pre-computed maps — we pass them directly.

function spc(obj) { return obj; }
function cls(obj) { return obj; }

// ----- Species devotee (15-beat, species-2+) -----

for (const [id, sp] of [
  ['abyssal_devotee',    'Abyssal'],
  ['sporal_devotee',     'Sporal'],
  ['chitinous_devotee',  'Chitinous'],
  ['crystalline_devotee','Crystalline'],
  ['plasmic_devotee',    'Plasmic'],
]) {
  const a = find(id);
  console.log(`\n${id}`);
  test(`fires at 2 ${sp}`, () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ [sp]: 2 }))));
  test(`fires above 2 ${sp}`, () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ [sp]: 5 }))));
  test(`does not fire at 1 ${sp}`, () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({ [sp]: 1 }))));
  test(`does not fire at 0`, () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({}))));
}

// ----- Species master (25-beat, higher threshold) -----

{
  const a = find('abyssal_master');
  console.log('\nabyssal_master');
  test('fires at 4 Abyssal', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ Abyssal: 4 }))));
  test('does not fire at 3 Abyssal', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({ Abyssal: 3 }))));
}

{
  const a = find('crystalline_master');
  console.log('\ncrystalline_master');
  test('fires at 4 Crystalline', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ Crystalline: 4 }))));
  test('does not fire at 3 Crystalline', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({ Crystalline: 3 }))));
}

{
  const a = find('sporal_master');
  console.log('\nsporal_master');
  test('fires at 4 Sporal', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ Sporal: 4 }))));
  test('does not fire at 3 Sporal', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({ Sporal: 3 }))));
}

{
  const a = find('chitinous_master');
  console.log('\nchitinous_master (threshold: 3+)');
  test('fires at 3 Chitinous', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ Chitinous: 3 }))));
  test('fires at 4 Chitinous', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ Chitinous: 4 }))));
  test('does not fire at 2 Chitinous', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({ Chitinous: 2 }))));
}

// ----- Class devotee (15-beat, class-2+) -----

for (const [id, cl] of [
  ['livid_devotee',  'Livid'],
  ['giddy_devotee',  'Giddy'],
  ['shy_devotee',    'Shy'],
  ['sullen_devotee', 'Sullen'],
]) {
  const a = find(id);
  console.log(`\n${id}`);
  test(`fires at 2 ${cl}`, () =>
    assert.ok(a.conditionMet(board([]), cls({ [cl]: 2 }), spc({}))));
  test(`fires above 2 ${cl}`, () =>
    assert.ok(a.conditionMet(board([]), cls({ [cl]: 4 }), spc({}))));
  test(`does not fire at 1 ${cl}`, () =>
    assert.ok(!a.conditionMet(board([]), cls({ [cl]: 1 }), spc({}))));
  test(`does not fire at 0`, () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({}))));
}

// ----- Phase 25 additions -----

// plasmic_master
{
  const a = find('plasmic_master');
  console.log('\nplasmic_master');
  test('fires at 4 Plasmic', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({ Plasmic: 4 }))));
  test('does not fire at 3 Plasmic', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({ Plasmic: 3 }))));
}

// pompous_devotee
{
  const a = find('pompous_devotee');
  console.log('\npompous_devotee');
  test('fires at 2 Pompous', () =>
    assert.ok(a.conditionMet(board([]), cls({ Pompous: 2 }), spc({}))));
  test('does not fire at 1 Pompous', () =>
    assert.ok(!a.conditionMet(board([]), cls({ Pompous: 1 }), spc({}))));
}

// emotional_virtuoso (ctx-based)
{
  const a = find('emotional_virtuoso');
  console.log('\nemotional_virtuoso');
  test('fires at activeClassSynergyCount = 3', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({}), { activeClassSynergyCount: 3 })));
  test('does not fire at activeClassSynergyCount = 2', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({}), { activeClassSynergyCount: 2 })));
}

// patient_master (board-based)
{
  const a = find('patient_master');
  function cardWithRounds(n) { return { species: 'Plasmic', class: 'Shy', roundsSinceBought: n }; }
  console.log('\npatient_master');
  test('fires with 4 cards held 10+ rounds', () =>
    assert.ok(a.conditionMet(board([cardWithRounds(10), cardWithRounds(12), cardWithRounds(10), cardWithRounds(15)]), cls({}), spc({}))));
  test('does not fire with 3 cards held 10+ rounds', () =>
    assert.ok(!a.conditionMet(board([cardWithRounds(10), cardWithRounds(12), cardWithRounds(10), cardWithRounds(5)]), cls({}), spc({}))));
}

// star_curator (board-based)
{
  const a = find('star_curator');
  function star(n) { return { species: 'Plasmic', class: 'Shy', stars: n }; }
  console.log('\nstar_curator');
  test('fires with 3 active 3★ specimens', () =>
    assert.ok(a.conditionMet(board([star(3), star(3), star(3)]), cls({}), spc({}))));
  test('does not fire with 2 active 3★ specimens', () =>
    assert.ok(!a.conditionMet(board([star(3), star(3), star(2)]), cls({}), spc({}))));
}

// late_game_collector (ctx.round)
{
  const a = find('late_game_collector');
  console.log('\nlate_game_collector');
  test('fires at round 17', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({}), { round: 17 })));
  test('does not fire at round 16', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({}), { round: 16 })));
}

// discerning_graduate (ctx.diffMult)
{
  const a = find('discerning_graduate');
  console.log('\ndiscerning_graduate');
  test('fires at diffMult 1.12', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({}), { diffMult: 1.12 })));
  test('fires at diffMult 1.25', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({}), { diffMult: 1.25 })));
  test('does not fire at diffMult 1.0', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({}), { diffMult: 1.0 })));
}

// elite_curator (ctx.diffMult)
{
  const a = find('elite_curator');
  console.log('\nelite_curator');
  test('fires at diffMult 1.25', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({}), { diffMult: 1.25 })));
  test('does not fire at diffMult 1.12', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({}), { diffMult: 1.12 })));
}

// grand_survivor (ctx.round)
{
  const a = find('grand_survivor');
  console.log('\ngrand_survivor');
  test('fires at round 24', () =>
    assert.ok(a.conditionMet(board([]), cls({}), spc({}), { round: 24 })));
  test('does not fire at round 23', () =>
    assert.ok(!a.conditionMet(board([]), cls({}), spc({}), { round: 23 })));
}

// ----- Cross-check: class conditions don't fire on species counts -----
{
  console.log('\ncross-checks (class ≠ species)');
  const livid = find('livid_devotee');
  test('livid_devotee does not fire on Livid species count (wrong axis)', () =>
    assert.ok(!livid.conditionMet(board([]), cls({}), spc({ Livid: 5 }))));
  const abyssal = find('abyssal_devotee');
  test('abyssal_devotee does not fire on Abyssal class count (wrong axis)', () =>
    assert.ok(!abyssal.conditionMet(board([]), cls({ Abyssal: 5 }), spc({}))));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
