import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { createField, seedField, step } from '../src/sim.js';

const range = (arr) => {
  let lo = Infinity, hi = -Infinity;
  for (const v of arr) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { lo, hi };
};

test('uniform field (a=1,b=0) stays uniform and stable', () => {
  const f = createField(16, 16); // defaults to a=1, b=0
  for (let i = 0; i < 50; i++) step(f, { feed: 0.0367, kill: 0.0649, dA: 1, dB: 0.5 });
  const ra = range(f.a), rb = range(f.b);
  assert.ok(Math.abs(ra.hi - 1) < 1e-6 && Math.abs(ra.lo - 1) < 1e-6, 'a drifted');
  assert.ok(rb.hi < 1e-6, 'b grew from nothing');
});

test('values stay within [0,1] after seeding and many steps', () => {
  const f = createField(32, 32);
  seedField(f, 0, makeRng('seed'));
  for (let i = 0; i < 300; i++) step(f, { feed: 0.0545, kill: 0.062, dA: 1, dB: 0.5 });
  const ra = range(f.a), rb = range(f.b);
  assert.ok(ra.lo >= -1e-6 && ra.hi <= 1 + 1e-6, `a in ${JSON.stringify(ra)}`);
  assert.ok(rb.lo >= -1e-6 && rb.hi <= 1 + 1e-6, `b in ${JSON.stringify(rb)}`);
});

test('no NaN/Inf after a long run', () => {
  const f = createField(24, 24);
  seedField(f, 1, makeRng('nan'));
  for (let i = 0; i < 500; i++) step(f, { feed: 0.03, kill: 0.06, dA: 1, dB: 0.5 });
  for (const v of f.b) assert.ok(Number.isFinite(v), 'non-finite value');
});

test('structure emerges from a seed (viable params)', () => {
  const f = createField(48, 48);
  seedField(f, 2, makeRng('coral'));
  for (let i = 0; i < 1500; i++) step(f, { feed: 0.0545, kill: 0.062, dA: 1, dB: 0.5 });
  const rb = range(f.b);
  assert.ok(rb.hi - rb.lo > 0.1, `expected structure, got spread ${rb.hi - rb.lo}`);
});

test('seeding is deterministic for the same rng seed', () => {
  const f1 = createField(16, 16); seedField(f1, 2, makeRng('det'));
  const f2 = createField(16, 16); seedField(f2, 2, makeRng('det'));
  assert.deepEqual(Array.from(f1.b), Array.from(f2.b));
});
