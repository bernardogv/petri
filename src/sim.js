// Gray-Scott reaction-diffusion on a toroidal grid.
// Two chemicals A and B; A is fed in, B is removed; B catalyses its own
// production from A. The interplay grows spots, stripes, mazes, coral.

export function createField(w, h) {
  const n = w * h;
  const field = {
    w, h,
    a: new Float32Array(n),
    b: new Float32Array(n),
    _a: new Float32Array(n), // scratch buffers (double-buffering)
    _b: new Float32Array(n),
  };
  field.a.fill(1);
  field.b.fill(0);
  return field;
}

// Initial B distribution. Different "seedKind"s give different starting forms.
// All four are LOCALIZED: a Turing instability needs a spatial gradient to grow
// from. Full-field noise tends to homogenize into a featureless steady state.
export function seedField(field, seedKind) {
  const { w, h, b } = field;
  field.a.fill(1);
  b.fill(0);
  const kind = ((seedKind % 4) + 4) % 4;
  const cx = (w / 2) | 0, cy = (h / 2) | 0;
  const r0 = Math.max(3, (Math.min(w, h) / 8) | 0);
  const blob = (bx, by, r) => {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        b[(((by + y) % h + h) % h) * w + (((bx + x) % w + w) % w)] = 1;
      }
    }
  };
  if (kind === 0) {
    blob(cx, cy, r0); // central disc
  } else if (kind === 1) {
    const o = (w / 4) | 0; // quincunx: center + four satellites
    blob(cx, cy, r0 - 1);
    blob(cx - o, cy - o, 3); blob(cx + o, cy - o, 3);
    blob(cx - o, cy + o, 3); blob(cx + o, cy + o, 3);
  } else if (kind === 2) {
    const R = r0 * 2; // ring / annulus
    for (let y = -R; y <= R; y++) {
      for (let x = -R; x <= R; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > R - 2 && d < R) b[(((cy + y) % h + h) % h) * w + (((cx + x) % w + w) % w)] = 1;
      }
    }
  } else {
    const off = (w / 5) | 0; // dividing pair
    blob(cx - off, cy, r0 - 1);
    blob(cx + off, cy, r0 - 1);
  }
  return field;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);

// One Euler step. Laplacian via the standard 3x3 weighted kernel, wrapped.
export function step(field, params) {
  const { w, h, a, b, _a, _b } = field;
  const feed = params.feed, kill = params.kill;
  const dA = params.dA, dB = params.dB;
  for (let y = 0; y < h; y++) {
    const yu = ((y - 1 + h) % h) * w;
    const yd = ((y + 1) % h) * w;
    const yc = y * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      const c = yc + x;
      // weighted laplacian: center -1, edges .2, corners .05
      const lapA =
        a[yc + xl] * 0.2 + a[yc + xr] * 0.2 + a[yu + x] * 0.2 + a[yd + x] * 0.2 +
        a[yu + xl] * 0.05 + a[yu + xr] * 0.05 + a[yd + xl] * 0.05 + a[yd + xr] * 0.05 -
        a[c];
      const lapB =
        b[yc + xl] * 0.2 + b[yc + xr] * 0.2 + b[yu + x] * 0.2 + b[yd + x] * 0.2 +
        b[yu + xl] * 0.05 + b[yu + xr] * 0.05 + b[yd + xl] * 0.05 + b[yd + xr] * 0.05 -
        b[c];
      const av = a[c], bv = b[c];
      const reaction = av * bv * bv;
      _a[c] = clamp01(av + (dA * lapA - reaction + feed * (1 - av)));
      _b[c] = clamp01(bv + (dB * lapB + reaction - (kill + feed) * bv));
    }
  }
  a.set(_a);
  b.set(_b);
  return field;
}
