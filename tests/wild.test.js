import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { wildGenome, GENES, CLASSIC_PATTERNS } from '../src/genome.js';
import { createField, seedField, step } from '../src/sim.js';

test('wildGenome is deterministic and in range', () => {
  const a = wildGenome(makeRng('w'));
  const b = wildGenome(makeRng('w'));
  assert.deepEqual(a, b);
  for (const gene of GENES) {
    if (gene.kind === 'num') assert.ok(a[gene.name] >= gene.min && a[gene.name] <= gene.max);
  }
});

test('every classic anchor ignites under every seed kind', () => {
  for (const anchor of CLASSIC_PATTERNS) {
    for (let sk = 0; sk < 4; sk++) {
      const f = createField(40, 40);
      seedField(f, sk, makeRng(`a:${anchor.name}:${sk}`));
      for (let i = 0; i < 1200; i++) step(f, { feed: anchor.feed, kill: anchor.kill, dA: 1, dB: 0.5 });
      let lo = Infinity, hi = -Infinity;
      for (const v of f.b) { if (v < lo) lo = v; if (v > hi) hi = v; }
      assert.ok(hi - lo > 0.2, `${anchor.name}/seed${sk} failed (spread ${(hi - lo).toFixed(3)})`);
    }
  }
});
