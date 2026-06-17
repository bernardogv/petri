// Canvas rendering for a sim field. Renders at grid resolution into an
// offscreen buffer, then scales up to fill the visible canvas.
import { sample } from './palette.js';

export function makeDishRenderer(field) {
  const off = document.createElement('canvas');
  off.width = field.w;
  off.height = field.h;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const img = octx.createImageData(field.w, field.h);
  const data = img.data;

  return function draw(ctx, paletteId) {
    const b = field.b;
    for (let i = 0; i < b.length; i++) {
      const rgb = sample(paletteId, b[i]);
      const o = i * 4;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, ctx.canvas.width, ctx.canvas.height);
  };
}
