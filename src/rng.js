// Deterministic, seedable PRNG. Browser + Node, no dependencies.

// xmur3 string hash -> 32-bit unsigned int.
export function hashString(str) {
  const s = String(str);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// mulberry32: fast, well-distributed 32-bit PRNG. Returns a function -> [0,1).
export function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed >>> 0 : hashString(seed)) >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convenience: gaussian-ish sample (sum of uniforms), mean 0, ~unit spread.
export function gaussian(rng) {
  return (rng() + rng() + rng() + rng() - 2) / 1.0;
}
