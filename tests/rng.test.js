import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashString, makeRng } from '../src/rng.js';

test('same seed string -> identical sequence', () => {
  const a = makeRng('petri');
  const b = makeRng('petri');
  const seqA = Array.from({ length: 5 }, () => a());
  const seqB = Array.from({ length: 5 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng('alpha');
  const b = makeRng('beta');
  assert.notEqual(a(), b());
});

test('values are in [0,1)', () => {
  const r = makeRng('range-check');
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('hashString is deterministic and numeric', () => {
  assert.equal(hashString('x'), hashString('x'));
  assert.equal(typeof hashString('x'), 'number');
  assert.notEqual(hashString('x'), hashString('y'));
});

test('makeRng accepts a numeric seed too', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  assert.equal(a(), b());
});
