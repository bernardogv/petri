// Inlines the ES modules + index.html into a single self-contained petri.html
// that runs offline by double-click (no server, no dependencies).
import { readFile, writeFile } from 'node:fs/promises';

const ORDER = ['rng', 'palette', 'sim', 'genome', 'garden', 'render', 'main'];
const SRC = new URL('./src/', import.meta.url);

function stripModule(code) {
  const shims = [];
  const out = [];
  for (const line of code.split('\n')) {
    const imp = line.match(/^\s*import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];?\s*$/);
    if (imp) {
      // turn `A as B` specifiers into `const B = A;` shims (co-located scope)
      for (const spec of imp[1].split(',')) {
        const m = spec.trim().match(/^(\w+)\s+as\s+(\w+)$/);
        if (m) shims.push(`const ${m[2]} = ${m[1]};`);
      }
      continue; // drop the import line
    }
    if (/^\s*import\s+['"][^'"]+['"];?\s*$/.test(line)) continue; // side-effect import
    out.push(line.replace(/^(\s*)export\s+/, '$1')); // drop `export ` keyword
  }
  return { shims, body: out.join('\n') };
}

const parts = [];
for (const name of ORDER) {
  const code = await readFile(new URL(`${name}.js`, SRC), 'utf8');
  const { shims, body } = stripModule(code);
  parts.push(`// ===== ${name}.js =====`);
  if (shims.length) parts.push(shims.join('\n'));
  parts.push(body);
}
const bundle = parts.join('\n\n');

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const inlined = html.replace(
  /<script type="module" src="\.\/src\/main\.js"><\/script>/,
  `<script type="module">\n${bundle}\n</script>`
);

await writeFile(new URL('./petri.html', import.meta.url), inlined);
console.log(`built petri.html (${(inlined.length / 1024).toFixed(1)} KB)`);
