// Renders a montage of matured specimens to assets/hero.png — pure Node, no
// dependencies (built-in zlib for PNG compression). Deterministic.
import zlib from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { createField, seedField, step } from '../src/sim.js';
import { sample } from '../src/palette.js';
import { CLASSIC_PATTERNS } from '../src/genome.js';

// --- minimal PNG encoder (RGB, 8-bit) ---------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, color type 2 (RGB)
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy ? rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
             : raw.set(rgb.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- compose the montage -----------------------------------------------------
const TW = 200, TH = 150, GAP = 8, PAD = 12, STEPS = 3200;
const COLS = 4, ROWS = 2;
const W = PAD * 2 + COLS * TW + (COLS - 1) * GAP;
const H = PAD * 2 + ROWS * TH + (ROWS - 1) * GAP;
const BG = [10, 12, 16];

// (anchor index, palette id, seed kind) — all combos chosen to fill the frame
// densely, spanning palettes and morphologies.
const TILES = [
  [0, 1, 1], [1, 4, 1], [5, 2, 1], [7, 3, 1],
  [2, 0, 1], [2, 5, 1], [1, 1, 1], [5, 4, 1],
];

const hero = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) { hero[i * 3] = BG[0]; hero[i * 3 + 1] = BG[1]; hero[i * 3 + 2] = BG[2]; }

TILES.forEach(([ai, pal, sk], idx) => {
  const a = CLASSIC_PATTERNS[ai];
  const f = createField(TW, TH);
  seedField(f, sk);
  for (let s = 0; s < STEPS; s++) step(f, { feed: a.feed, kill: a.kill, dA: 1, dB: 0.5 });
  const col = idx % COLS, row = (idx / COLS) | 0;
  const ox = PAD + col * (TW + GAP), oy = PAD + row * (TH + GAP);
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const c = sample(pal, f.b[y * TW + x]);
      const o = ((oy + y) * W + (ox + x)) * 3;
      hero[o] = c[0]; hero[o + 1] = c[1]; hero[o + 2] = c[2];
    }
  }
  process.stdout.write(`  rendered tile ${idx + 1}/${TILES.length} (${a.name}/${pal})\n`);
});

await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
const png = encodePNG(W, H, hero);
await writeFile(new URL('../assets/hero.png', import.meta.url), png);
console.log(`wrote assets/hero.png — ${W}x${H}, ${(png.length / 1024).toFixed(1)} KB`);
