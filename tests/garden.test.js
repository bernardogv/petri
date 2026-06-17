import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { randomGenome } from '../src/genome.js';
import { createGarden, nameFor } from '../src/garden.js';

const g = (s) => randomGenome(makeRng(s));

// minimal localStorage stub
function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _dump: () => m,
  };
}

test('add returns a specimen with id, code, and generation 0', () => {
  const garden = createGarden(memStore());
  const s = garden.add({ genome: g('a'), name: 'Alpha' });
  assert.ok(s.id);
  assert.match(s.code, /^PETRI-/);
  assert.equal(s.gen, 0);
  assert.deepEqual(s.parents, []);
});

test('ids are unique', () => {
  const garden = createGarden(memStore());
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(garden.add({ genome: g('s' + i) }).id);
  assert.equal(ids.size, 100);
});

test('get and all work', () => {
  const garden = createGarden(memStore());
  const s = garden.add({ genome: g('x') });
  assert.equal(garden.get(s.id).id, s.id);
  assert.equal(garden.all().length, 1);
});

test('a bred child records parents and bumps generation', () => {
  const garden = createGarden(memStore());
  const p1 = garden.add({ genome: g('p1') });
  const p2 = garden.add({ genome: g('p2') });
  const child = garden.add({ genome: g('c'), parents: [p1.id, p2.id] });
  assert.deepEqual(child.parents, [p1.id, p2.id]);
  assert.equal(child.gen, 1);
});

test('lineage returns ancestors nearest-first', () => {
  const garden = createGarden(memStore());
  const a = garden.add({ genome: g('a') });
  const b = garden.add({ genome: g('b') });
  const c = garden.add({ genome: g('c'), parents: [a.id, b.id] });
  const d = garden.add({ genome: g('d'), parents: [c.id, a.id] });
  const anc = garden.lineage(d.id).map((s) => s.id);
  assert.ok(anc.includes(c.id) && anc.includes(a.id) && anc.includes(b.id));
  assert.ok(!anc.includes(d.id), 'lineage should not include self');
});

test('persists to storage and reloads', () => {
  const store = memStore();
  const garden1 = createGarden(store);
  const s = garden1.add({ genome: g('persist'), name: 'Keeper' });
  const garden2 = createGarden(store); // reads existing store on construction
  assert.equal(garden2.all().length, 1);
  assert.equal(garden2.get(s.id).name, 'Keeper');
});

test('nameFor never yields "undefined" (unsigned-shift regression)', () => {
  for (let i = 0; i < 500; i++) {
    const name = nameFor(g('name-' + i), 'salt' + i);
    assert.doesNotMatch(name, /undefined/, `bad name: ${name}`);
    assert.equal(name.split(' ').length, 2);
  }
});

test('survives a broken storage without throwing', () => {
  const broken = {
    getItem: () => { throw new Error('nope'); },
    setItem: () => { throw new Error('nope'); },
  };
  assert.doesNotThrow(() => {
    const garden = createGarden(broken);
    garden.add({ genome: g('y') });
  });
});
