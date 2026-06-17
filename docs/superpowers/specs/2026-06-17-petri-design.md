# Petri — a breedable garden of living patterns

**Date:** 2026-06-17
**Status:** Approved, in build

## Concept

Treat the parameter-space of a reaction-diffusion (Gray-Scott) morphogenesis
simulation as a **genome** that can be bred, collected, and crossed. Each
specimen is a small set of numbers that grows into a unique living pattern on a
canvas in real time. Two specimens can be bred; the offspring genome is a
genetic crossover + mutation of its parents, producing a brand-new pattern.

The metaphor is not decoration: Turing's 1952 reaction-diffusion model is itself
a theory of how biological form arises and varies, so "breeding patterns" is
scientifically apt.

## Goals / non-goals

- **Goal:** a finished, polished, self-contained artifact that runs offline.
- **Goal:** the simulation, genome codec, and breeding logic are correct and
  unit-tested; visuals verified in a real browser.
- **Non-goal:** networking, persistence beyond `localStorage`, accounts, audio.

## Architecture

Single-page app. Pure-logic modules in `src/`, tested headless with Node's
built-in test runner. A build step inlines everything into one shareable
`petri.html`.

| Module | Responsibility | Depends on |
|---|---|---|
| `src/rng.js` | Seedable deterministic PRNG (mulberry32 + string hash) | — |
| `src/sim.js` | Gray-Scott reaction-diffusion step on a grid | — |
| `src/genome.js` | Genome type, seed-string ↔ genome codec, crossover, mutation | `rng` |
| `src/palette.js` | Named color palettes; value → RGB mapping | — |
| `src/garden.js` | Specimen collection + lineage (parents), localStorage persistence | `genome` |
| `src/render.js` | Draw a sim field to a canvas via a palette | `palette` |
| `src/main.js` | Wires UI, animation loop, breeding interactions | all above |

### Genome

```
Genome = {
  feed:    number,   // Gray-Scott feed rate   f  (~0.01..0.09)
  kill:    number,   // Gray-Scott kill rate    k  (~0.04..0.07)
  dA:      number,   // diffusion of A          (~0.8..1.2)
  dB:      number,   // diffusion of B          (~0.3..0.6)
  seedKind:integer,  // initial-seed pattern id (0..N)
  palette: integer,  // palette id
}
```

- **Seed string:** human-shareable code (e.g. `PETRI-3F2A-...`). `decode(str)`
  is deterministic and total; `encode(decode(s)) === canonical(s)`.
- **Crossover:** per-gene pick from parent A or B (uniform), then **mutation**:
  each numeric gene jittered by a small Gaussian within its valid range with
  probability `m`; discrete genes resampled with probability `m`. All driven by
  a seeded RNG so a (parentA, parentB, seed) triple is reproducible.
- **Spawn-from-random:** a fresh specimen is `decode` of a random seed string.

### Simulation (Gray-Scott)

Grid of `{a,b}` cells, toroidal wrap. Per step, for each cell:

```
lapA = convolve(a, kernel);  lapB = convolve(b, kernel)
a' = a + (dA*lapA - a*b*b + feed*(1-a)) * dt
b' = b + (dB*lapB + a*b*b - (kill+feed)*b) * dt
```

kernel = `[[.05,.2,.05],[.2,-1,.2],[.05,.2,.05]]`, dt = 1.0. Values clamped to
[0,1]. Initial state: a=1,b=0 everywhere, then b seeded per `seedKind`.

## Data flow

`seed string → genome → sim params + initial field`; animation loop advances the
sim ~N steps/frame and renders. Breeding two catalog specimens produces a new
genome → new specimen added to the garden with `parents: [idA, idB]`.

## Error handling

- `decode` is total: malformed input falls back to a deterministic genome (never
  throws). Out-of-range genes are clamped on load.
- Sim guards against NaN/Inf (clamp), so no parameter choice can crash the loop.
- `localStorage` access wrapped in try/catch; absence degrades to in-memory only.

## Testing

Headless (`node --test`):
- **rng:** same seed → same sequence; different seeds diverge.
- **genome:** `decode` deterministic & total; round-trip `encode∘decode` stable;
  crossover only yields parent gene values (pre-mutation); mutation bounded in
  range; same (parents, seed) → same child.
- **sim:** uniform field stays uniform & stable; values stay in [0,1]; no NaN
  after many steps; a known (feed,kill) develops nonzero structure from a seed.
- **garden:** add/get/lineage; persistence round-trip via a stubbed storage.

Visual (browser): open `petri.html`, screenshot grown specimens, confirm
distinct pattern classes (spots / stripes / maze / coral) emerge.

## Done criteria

All unit tests green; `petri.html` opens offline; you can spawn random
specimens, watch them grow, breed two, and see a novel offspring grow; catalog
+ lineage persist across reload.
