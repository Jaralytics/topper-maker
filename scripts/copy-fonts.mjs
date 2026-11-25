// Copia los .woff (subset latin) y licencias desde node_modules/@fontsource a public/fonts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_CATALOG } from '../src/fonts/catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'fonts');
const lic = path.join(out, 'LICENSES');
fs.mkdirSync(lic, { recursive: true });
const ok = [];
for (const f of FONT_CATALOG) {
  const dir = path.join(root, 'node_modules', '@fontsource', f.pkg);
  const src = path.join(dir, 'files', `${f.pkg}-latin-${f.weight}-normal.woff`);
  if (!fs.existsSync(src)) { console.warn('OMITIDA (no existe):', f.id); continue; }
  fs.copyFileSync(src, path.join(out, f.file));
  const l = path.join(dir, 'LICENSE');
  if (fs.existsSync(l)) fs.copyFileSync(l, path.join(lic, `${f.id}-LICENSE.txt`));
  ok.push(f.id);
}
console.log(`${ok.length}/${FONT_CATALOG.length} fuentes copiadas`);
