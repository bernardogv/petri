// Petri — wires the garden, breeding, and live animation to the DOM.
import { makeRng } from './rng.js';
import { wildGenome, decode, breed } from './genome.js';
import { createField, seedField, step as simStep } from './sim.js';
import { createGarden, nameFor } from './garden.js';
import { makeDishRenderer } from './render.js';
import { PALETTES } from './palette.js';

const MAIN_W = 220, MAIN_H = 150;   // main-stage grid
const THUMB = 96;                   // thumbnail grid (square)
const MAIN_STEPS = 12, THUMB_STEPS = 5;

const $ = (id) => document.getElementById(id);

// ---- Dish: a single growing specimen ----------------------------------------
function makeDish(genome, w, h) {
  const field = createField(w, h);
  seedField(field, genome.seedKind);
  const renderer = makeDishRenderer(field);
  return {
    genome,
    field,
    age: 0,
    step(n) {
      const { feed, kill, dA, dB } = genome;
      for (let i = 0; i < n; i++) simStep(field, { feed, kill, dA, dB });
      this.age += n;
    },
    draw(ctx) { renderer(ctx, genome.palette); },
    reseed() { seedField(field, genome.seedKind); this.age = 0; },
    perturb(gx, gy, r = Math.max(3, (w / 30) | 0)) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue;
          const px = ((gx + x) % w + w) % w, py = ((gy + y) % h + h) % h;
          field.b[py * w + px] = 1;
        }
      }
    },
  };
}

// ---- App state --------------------------------------------------------------
const garden = createGarden(typeof localStorage !== 'undefined' ? localStorage : null);
const thumbs = new Map();   // id -> { dish, canvas, ctx, card }
const breedPair = [];       // up to 2 specimen ids
let mainDish = null;
let selectedId = null;

const stage = $('stage');
const stageCtx = stage.getContext('2d');

// ---- Selection / main stage -------------------------------------------------
function select(id) {
  const spec = garden.get(id);
  if (!spec) return;
  selectedId = id;
  mainDish = makeDish(spec.genome, MAIN_W, MAIN_H);
  renderInfo(spec);
  for (const [tid, t] of thumbs) t.card.classList.toggle('viewing', tid === id);
}

function renderInfo(spec) {
  $('spec-name').textContent = spec.name;
  $('spec-code').textContent = spec.code;
  const pal = PALETTES[spec.genome.palette % PALETTES.length].name;
  $('spec-meta').innerHTML =
    `<span>gen ${spec.gen}</span><span>palette ${pal}</span>` +
    `<span>feed ${spec.genome.feed.toFixed(3)}</span><span>kill ${spec.genome.kill.toFixed(3)}</span>`;
  const anc = garden.lineage(spec.id);
  const tray = $('lineage');
  if (!anc.length) {
    tray.innerHTML = '<span class="muted">wild specimen — no ancestors</span>';
  } else {
    tray.innerHTML = anc.slice(0, 8)
      .map((a) => `<button class="chip" data-goto="${a.id}">${a.name} · g${a.gen}</button>`)
      .join('');
  }
}

// ---- Catalog ----------------------------------------------------------------
function buildCard(spec) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = spec.id;
  const canvas = document.createElement('canvas');
  canvas.className = 'thumb';
  canvas.width = THUMB; canvas.height = THUMB;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML = `<span class="cname">${spec.name}</span><span class="badge">g${spec.gen}</span>`;
  const breedBtn = document.createElement('button');
  breedBtn.className = 'breed-toggle';
  breedBtn.title = 'add to breeding pair';
  breedBtn.textContent = '+';
  breedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleBreed(spec.id); });
  card.append(canvas, meta, breedBtn);
  card.addEventListener('click', () => select(spec.id));

  const dish = makeDish(spec.genome, THUMB, THUMB);
  const ctx = canvas.getContext('2d');
  thumbs.set(spec.id, { dish, canvas, ctx, card });
  $('catalog').prepend(card);
}

function addSpecimen(opts) {
  const spec = garden.add(opts);
  buildCard(spec);
  return spec;
}

function removeSpecimen(id) {
  const t = thumbs.get(id);
  if (t) t.card.remove();
  thumbs.delete(id);
  const bi = breedPair.indexOf(id);
  if (bi >= 0) breedPair.splice(bi, 1);
  garden.remove(id);
  if (selectedId === id) {
    const next = garden.all()[garden.all().length - 1];
    if (next) select(next.id); else { mainDish = null; clearInfo(); }
  }
  refreshBreedUI();
}

function clearInfo() {
  $('spec-name').textContent = '—';
  $('spec-code').textContent = '';
  $('spec-meta').innerHTML = '';
  $('lineage').innerHTML = '';
}

// ---- Breeding ---------------------------------------------------------------
function toggleBreed(id) {
  const i = breedPair.indexOf(id);
  if (i >= 0) breedPair.splice(i, 1);
  else { breedPair.push(id); if (breedPair.length > 2) breedPair.shift(); }
  refreshBreedUI();
}

function refreshBreedUI() {
  for (const [tid, t] of thumbs) {
    const idx = breedPair.indexOf(tid);
    t.card.classList.toggle('breeding', idx >= 0);
    t.card.querySelector('.breed-toggle').textContent = idx >= 0 ? (idx + 1) : '+';
  }
  const ready = breedPair.length === 2;
  $('btn-breed').disabled = !ready;
  const names = breedPair.map((id) => garden.get(id)?.name).filter(Boolean);
  $('breed-status').textContent = ready
    ? `${names[0]}  ×  ${names[1]}`
    : `pick ${2 - breedPair.length} more parent${breedPair.length === 1 ? '' : 's'}`;
}

function doBreed() {
  if (breedPair.length !== 2) return;
  const [aId, bId] = breedPair;
  const a = garden.get(aId), b = garden.get(bId);
  const m = Number($('mutation').value);
  // salt by current population so repeated crosses of the same pair vary
  const seed = `${a.code}|${b.code}|${garden.all().length}`;
  const childGenome = breed(a.genome, b.genome, seed, m);
  const child = addSpecimen({
    genome: childGenome,
    name: nameFor(childGenome, seed),
    parents: [aId, bId],
  });
  flash(`bred ${child.name} (gen ${child.gen})`);
  select(child.id);
}

// ---- Actions ----------------------------------------------------------------
let spawnCounter = 0;
function spawnWild() {
  const g = wildGenome(makeRng('wild:' + Date.now() + ':' + (spawnCounter++)));
  const spec = addSpecimen({ genome: g, name: nameFor(g, 'w' + spawnCounter) });
  flash(`spawned ${spec.name}`);
  select(spec.id);
}

function importCode() {
  const raw = $('import-code').value.trim();
  if (!raw) return;
  const g = decode(raw);
  const spec = addSpecimen({ genome: g, name: nameFor(g, raw) });
  $('import-code').value = '';
  flash(`grew ${spec.name} from code`);
  select(spec.id);
}

let flashTimer = null;
function flash(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---- Animation loop ---------------------------------------------------------
function frame() {
  if (mainDish) {
    mainDish.step(MAIN_STEPS);
    mainDish.draw(stageCtx);
  }
  for (const { dish, ctx } of thumbs.values()) {
    dish.step(THUMB_STEPS);
    dish.draw(ctx);
  }
  requestAnimationFrame(frame);
}

// ---- Wiring -----------------------------------------------------------------
function init() {
  stage.width = MAIN_W * 3;
  stage.height = MAIN_H * 3;

  $('btn-spawn').addEventListener('click', spawnWild);
  $('btn-breed').addEventListener('click', doBreed);
  $('btn-import').addEventListener('click', importCode);
  $('import-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') importCode(); });
  $('btn-reseed').addEventListener('click', () => { if (mainDish) { mainDish.reseed(); flash('reseeded'); } });
  $('btn-delete').addEventListener('click', () => { if (selectedId) removeSpecimen(selectedId); });
  $('btn-copy').addEventListener('click', () => {
    const code = $('spec-code').textContent;
    if (code && navigator.clipboard) navigator.clipboard.writeText(code).then(() => flash('code copied'));
  });
  $('lineage').addEventListener('click', (e) => {
    const id = e.target?.dataset?.goto;
    if (id) select(id);
  });
  stage.addEventListener('click', (e) => {
    if (!mainDish) return;
    const rect = stage.getBoundingClientRect();
    const gx = Math.floor((e.clientX - rect.left) / rect.width * MAIN_W);
    const gy = Math.floor((e.clientY - rect.top) / rect.height * MAIN_H);
    mainDish.perturb(gx, gy);
    flash('perturbed');
  });

  // populate from saved garden, or seed a few wild specimens
  const existing = garden.all();
  if (existing.length === 0) {
    for (let i = 0; i < 4; i++) {
      const g = wildGenome(makeRng('starter:' + i));
      addSpecimen({ genome: g, name: nameFor(g, 'start' + i) });
    }
  } else {
    for (const spec of existing) buildCard(spec);
  }
  select(garden.all()[garden.all().length - 1].id);
  refreshBreedUI();
  requestAnimationFrame(frame);

  // Debug handle: lets the sim be advanced synchronously even while the tab is
  // backgrounded (rAF is paused when hidden). Used for headless verification.
  window.__petri = {
    get main() { return mainDish; },
    advanceAll(n = 1000) {
      if (mainDish) mainDish.step(n);
      for (const { dish } of thumbs.values()) dish.step(n);
      if (mainDish) mainDish.draw(stageCtx);
      for (const { dish, ctx } of thumbs.values()) dish.draw(ctx);
      return mainDish ? mainDish.age : 0;
    },
  };
}

document.addEventListener('DOMContentLoaded', init);
