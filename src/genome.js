// A specimen's genome: the heritable parameters that grow into a pattern.
import { makeRng, gaussian } from './rng.js';

// Each gene: continuous (min/max/steps) or discrete (count). `steps`/`count`
// define the quantization grid used by the shareable seed-string codec.
export const GENES = [
  { name: 'feed', kind: 'num', min: 0.012, max: 0.090, steps: 64 },
  { name: 'kill', kind: 'num', min: 0.045, max: 0.070, steps: 64 },
  { name: 'dA',   kind: 'num', min: 0.80,  max: 1.20,  steps: 16 },
  { name: 'dB',   kind: 'num', min: 0.30,  max: 0.60,  steps: 16 },
  { name: 'seedKind', kind: 'disc', count: 4 },
  { name: 'palette',  kind: 'disc', count: 6 },
];

const span = (gene) => (gene.kind === 'disc' ? gene.count : gene.steps);

function clampNum(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

export function clampGenome(g) {
  const out = {};
  for (const gene of GENES) {
    if (gene.kind === 'disc') {
      let v = Math.round(Number(g[gene.name]) || 0);
      v = ((v % gene.count) + gene.count) % gene.count; // wrap into [0,count)
      out[gene.name] = v;
    } else {
      out[gene.name] = clampNum(Number(g[gene.name]), gene.min, gene.max);
    }
  }
  return out;
}

export function randomGenome(rng) {
  const g = {};
  for (const gene of GENES) {
    if (gene.kind === 'disc') {
      g[gene.name] = Math.floor(rng() * gene.count);
    } else {
      g[gene.name] = gene.min + rng() * (gene.max - gene.min);
    }
  }
  return g;
}

// Curated, empirically-verified pattern-forming (feed,kill) anchors spanning
// distinct morphologies. Random spawns start near one of these "wild species"
// so the garden is always alive; breeding explores the space between them.
export const CLASSIC_PATTERNS = [
  { name: 'Maze',     feed: 0.030, kill: 0.055 },
  { name: 'Mitosis',  feed: 0.034, kill: 0.059 },
  { name: 'Worms',    feed: 0.042, kill: 0.061 },
  { name: 'Spots',    feed: 0.050, kill: 0.063 },
  { name: 'Holes',    feed: 0.058, kill: 0.065 },
  { name: 'Solitons', feed: 0.062, kill: 0.061 },
  { name: 'Lace',     feed: 0.074, kill: 0.063 },
  { name: 'Chaos',    feed: 0.082, kill: 0.059 },
];

// A fresh, viable specimen: pick a wild anchor, jitter lightly, randomize the
// non-rate genes (diffusion, seed pattern, palette).
export function wildGenome(rng) {
  const anchor = CLASSIC_PATTERNS[Math.floor(rng() * CLASSIC_PATTERNS.length)];
  return clampGenome({
    feed: anchor.feed + (rng() - 0.5) * 0.004,
    kill: anchor.kill + (rng() - 0.5) * 0.003,
    dA: 0.95 + rng() * 0.12,
    dB: 0.46 + rng() * 0.10,
    seedKind: Math.floor(rng() * 4),
    palette: Math.floor(rng() * 6),
  });
}

// --- shareable seed-string codec (mixed-radix over quantized genes) ---

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base32, no I/L/O/U

function geneToIndex(gene, value) {
  if (gene.kind === 'disc') {
    return ((Math.round(value) % gene.count) + gene.count) % gene.count;
  }
  const t = (clampNum(value, gene.min, gene.max) - gene.min) / (gene.max - gene.min);
  return Math.min(gene.steps - 1, Math.round(t * (gene.steps - 1)));
}

function indexToGene(gene, idx) {
  if (gene.kind === 'disc') return ((idx % gene.count) + gene.count) % gene.count;
  return gene.min + (idx / (gene.steps - 1)) * (gene.max - gene.min);
}

function toBase32(n) {
  let s = '';
  let v = BigInt(n);
  if (v === 0n) s = '0';
  const base = BigInt(ALPHABET.length);
  while (v > 0n) {
    s = ALPHABET[Number(v % base)] + s;
    v /= base;
  }
  return s.padStart(6, '0');
}

function group(s) {
  return s.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

export function encode(genome) {
  const g = clampGenome(genome);
  let n = 0n;
  for (const gene of GENES) {
    n = n * BigInt(span(gene)) + BigInt(geneToIndex(gene, g[gene.name]));
  }
  return 'PETRI-' + group(toBase32(n));
}

function decodeCanonical(str) {
  const body = str.slice('PETRI-'.length).replace(/-/g, '').toUpperCase();
  let n = 0n;
  const base = BigInt(ALPHABET.length);
  for (const ch of body) {
    const d = ALPHABET.indexOf(ch);
    if (d < 0) return null;
    n = n * base + BigInt(d);
  }
  const idx = [];
  for (let i = GENES.length - 1; i >= 0; i--) {
    const m = BigInt(span(GENES[i]));
    idx[i] = Number(n % m);
    n /= m;
  }
  const g = {};
  GENES.forEach((gene, i) => { g[gene.name] = indexToGene(gene, idx[i]); });
  return clampGenome(g);
}

// Total: any string maps to a valid genome. Canonical codes decode exactly;
// anything else is hashed into a deterministic random genome.
export function decode(str) {
  const s = String(str).trim();
  if (s.toUpperCase().startsWith('PETRI-')) {
    const g = decodeCanonical(s);
    if (g) return g;
  }
  // Arbitrary text maps to a viable "wild" genome (biased to living patterns),
  // so "grow from any text" always produces something alive.
  return wildGenome(makeRng('fallback:' + s));
}

// --- breeding: per-gene crossover from a parent, then bounded mutation ---

export function breed(parentA, parentB, seedStr, mutationRate = 0.25) {
  const a = clampGenome(parentA);
  const b = clampGenome(parentB);
  const rng = makeRng('breed:' + seedStr);
  const child = {};
  for (const gene of GENES) {
    // crossover: pick this gene from one parent
    let v = (rng() < 0.5 ? a : b)[gene.name];
    // mutation
    if (rng() < mutationRate) {
      if (gene.kind === 'disc') {
        v = Math.floor(rng() * gene.count);
      } else {
        const range = gene.max - gene.min;
        v = clampNum(v + gaussian(rng) * range * 0.25, gene.min, gene.max);
      }
    }
    child[gene.name] = v;
  }
  return child;
}
