// The collection: specimens, their lineage, and persistence.
import { encode, clampGenome } from './genome.js';

const KEY = 'petri.garden.v1';

export function createGarden(storage) {
  const safe = wrapStorage(storage);
  let seq = 0;
  let specimens = []; // { id, name, code, genome, parents:[id], gen }
  const byId = new Map();

  function index() {
    byId.clear();
    for (const s of specimens) byId.set(s.id, s);
  }

  function load() {
    const raw = safe.get(KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.specimens)) {
        specimens = data.specimens;
        seq = Number(data.seq) || specimens.length;
        index();
      }
    } catch { /* corrupt store: start fresh */ }
  }

  function save() {
    safe.set(KEY, JSON.stringify({ seq, specimens }));
  }

  function add({ genome, name, parents = [] }) {
    const g = clampGenome(genome);
    const id = 's' + (++seq);
    const parentGens = parents
      .map((pid) => byId.get(pid))
      .filter(Boolean)
      .map((p) => p.gen);
    const gen = parentGens.length ? Math.max(...parentGens) + 1 : 0;
    const specimen = {
      id,
      name: name || nameFor(g, id),
      code: encode(g),
      genome: g,
      parents: parents.slice(),
      gen,
    };
    specimens.push(specimen);
    byId.set(id, specimen);
    save();
    return specimen;
  }

  function remove(id) {
    specimens = specimens.filter((s) => s.id !== id);
    index();
    save();
  }

  function lineage(id) {
    const out = [];
    const seen = new Set([id]);
    let frontier = (byId.get(id)?.parents || []).slice();
    while (frontier.length) {
      const next = [];
      for (const pid of frontier) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        const p = byId.get(pid);
        if (p) {
          out.push(p);
          next.push(...p.parents);
        }
      }
      frontier = next;
    }
    return out; // nearest ancestors first
  }

  load();

  return {
    add,
    remove,
    get: (id) => byId.get(id),
    all: () => specimens.slice(),
    lineage,
    save,
  };
}

function wrapStorage(storage) {
  return {
    get(k) { try { return storage ? storage.getItem(k) : null; } catch { return null; } },
    set(k, v) { try { if (storage) storage.setItem(k, v); } catch { /* ignore */ } },
  };
}

// Whimsical deterministic name from the genome's code.
const ADJ = ['Coral', 'Velvet', 'Pulsing', 'Quiet', 'Fractured', 'Golden',
  'Drifting', 'Mottled', 'Lucent', 'Tangled', 'Spiral', 'Hollow'];
const NOUN = ['Reef', 'Bloom', 'Lattice', 'Maze', 'Spore', 'Vein',
  'Polyp', 'Cluster', 'Drift', 'Mesh', 'Frond', 'Pith'];

export function nameFor(genome, salt = '') {
  const code = encode(genome) + salt;
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return ADJ[h % ADJ.length] + ' ' + NOUN[(h >>> 8) % NOUN.length];
}
