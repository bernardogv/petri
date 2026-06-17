import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, sample } from '../src/palette.js';

test('there are 6 palettes, each with a name', () => {
  assert.equal(PALETTES.length, 6);
  for (const p of PALETTES) assert.equal(typeof p.name, 'string');
});

test('sample returns 3 bytes in [0,255] for any input', () => {
  for (let id = 0; id < PALETTES.length; id++) {
    for (const t of [-1, 0, 0.3, 0.5, 1, 2, NaN]) {
      const [r, g, b] = sample(id, t);
      for (const c of [r, g, b]) {
        assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `bad channel ${c}`);
      }
    }
  }
});

test('sample is deterministic', () => {
  assert.deepEqual(sample(0, 0.42), sample(0, 0.42));
});

test('out-of-range palette id wraps instead of throwing', () => {
  assert.doesNotThrow(() => sample(999, 0.5));
});
