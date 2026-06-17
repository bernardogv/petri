import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import {
  GENES, randomGenome, clampGenome, encode, decode, breed,
} from '../src/genome.js';

const inRange = (g) => {
  for (const gene of GENES) {
    const v = g[gene.name];
    if (gene.kind === 'disc') {
      assert.ok(Number.isInteger(v) && v >= 0 && v < gene.count,
        `${gene.name}=${v} out of [0,${gene.count})`);
    } else {
      assert.ok(v >= gene.min && v <= gene.max,
        `${gene.name}=${v} out of [${gene.min},${gene.max}]`);
    }
  }
};

test('randomGenome is in range and deterministic per rng seed', () => {
  const g1 = randomGenome(makeRng('seed-1'));
  const g2 = randomGenome(makeRng('seed-1'));
  assert.deepEqual(g1, g2);
  inRange(g1);
});

test('encode produces a PETRI- code; decode round-trips canonically', () => {
  const g = randomGenome(makeRng('rt'));
  const code = encode(g);
  assert.match(code, /^PETRI-/);
  const back = decode(code);
  // re-encoding the decoded genome must give the same canonical code
  assert.equal(encode(back), code);
});

test('decode is total: garbage input still yields a valid in-range genome', () => {
  for (const junk of ['', '!!!', 'hello world', 'PETRI-zzzzzzzz', '12345']) {
    const g = decode(junk);
    assert.doesNotThrow(() => inRange(g));
  }
});

test('decode is deterministic for the same input', () => {
  assert.deepEqual(decode('hello'), decode('hello'));
});

test('crossover with no mutation only yields parent gene values', () => {
  const a = randomGenome(makeRng('parentA'));
  const b = randomGenome(makeRng('parentB'));
  const child = breed(a, b, 'cross-1', 0);
  for (const gene of GENES) {
    const v = child[gene.name];
    assert.ok(v === a[gene.name] || v === b[gene.name],
      `${gene.name}=${v} is from neither parent`);
  }
});

test('breeding is deterministic for the same (parents, seed)', () => {
  const a = randomGenome(makeRng('pa'));
  const b = randomGenome(makeRng('pb'));
  assert.deepEqual(breed(a, b, 's', 0.3), breed(a, b, 's', 0.3));
});

test('mutation keeps all genes in range', () => {
  const a = randomGenome(makeRng('m-a'));
  const b = randomGenome(makeRng('m-b'));
  for (let i = 0; i < 50; i++) {
    inRange(breed(a, b, 'mut-' + i, 1.0)); // max mutation every time
  }
});

test('clampGenome pulls out-of-range values back in range', () => {
  const wild = { feed: 999, kill: -5, dA: 99, dB: -1, seedKind: 77, palette: -3 };
  inRange(clampGenome(wild));
});
