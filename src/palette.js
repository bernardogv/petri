// Color palettes mapping a chemical concentration t in [0,1] -> RGB.
// Each palette is a list of [stop, [r,g,b]] control points, interpolated.

export const PALETTES = [
  { name: 'Coral', stops: [[0, [12, 10, 30]], [0.4, [120, 30, 60]], [0.7, [240, 110, 90]], [1, [255, 225, 170]]] },
  { name: 'Abyss', stops: [[0, [2, 6, 18]], [0.5, [10, 60, 110]], [0.8, [40, 170, 200]], [1, [200, 255, 245]]] },
  { name: 'Moss',  stops: [[0, [8, 14, 8]], [0.45, [30, 80, 35]], [0.75, [120, 175, 60]], [1, [240, 245, 190]]] },
  { name: 'Ember', stops: [[0, [10, 4, 4]], [0.4, [90, 15, 10]], [0.7, [220, 90, 20]], [1, [255, 230, 120]]] },
  { name: 'Iris',  stops: [[0, [12, 8, 28]], [0.45, [70, 30, 130]], [0.75, [180, 90, 200]], [1, [250, 220, 255]]] },
  { name: 'Bone',  stops: [[0, [14, 14, 16]], [0.5, [90, 88, 96]], [0.8, [180, 178, 185]], [1, [248, 248, 250]]] },
];

const clampByte = (v) => {
  if (!Number.isFinite(v)) return 0;
  const r = Math.round(v);
  return r < 0 ? 0 : r > 255 ? 255 : r;
};

export function sample(paletteId, t) {
  const p = PALETTES[((paletteId % PALETTES.length) + PALETTES.length) % PALETTES.length];
  let x = Number.isFinite(t) ? t : 0;
  if (x < 0) x = 0; else if (x > 1) x = 1;
  const stops = p.stops;
  for (let i = 1; i < stops.length; i++) {
    const [s0, c0] = stops[i - 1];
    const [s1, c1] = stops[i];
    if (x <= s1) {
      const f = s1 === s0 ? 0 : (x - s0) / (s1 - s0);
      return [
        clampByte(c0[0] + (c1[0] - c0[0]) * f),
        clampByte(c0[1] + (c1[1] - c0[1]) * f),
        clampByte(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  const last = stops[stops.length - 1][1];
  return [clampByte(last[0]), clampByte(last[1]), clampByte(last[2])];
}

// Fill an RGBA ImageData-style buffer from a field's B channel.
export function renderToBuffer(field, paletteId, out) {
  const b = field.b;
  for (let i = 0; i < b.length; i++) {
    const [r, g, bl] = sample(paletteId, b[i]);
    const o = i * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255;
  }
  return out;
}
