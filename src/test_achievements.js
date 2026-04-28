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
