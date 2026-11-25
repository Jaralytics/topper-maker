// Extrae iconos Phosphor (fill) seleccionados y genera src/geometry/ornaments-data.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToPolygons } from '../src/geometry/svgpath.js';
import * as clip from '../src/geometry/clip.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'node_modules', '@phosphor-icons', 'core', 'assets', 'fill');

const ICONS = [
  ['crown', 'Corona', 'Celebración'],
  ['butterfly', 'Mariposa', 'Naturaleza'],
  ['cake', 'Pastel', 'Celebración'],
  ['gift', 'Regalo', 'Celebración'],
  ['graduation-cap', 'Birrete', 'Celebración'],
  ['baby', 'Bebé', 'Celebración'],
  ['paw-print', 'Huella', 'Naturaleza'],
  ['music-notes', 'Notas musicales', 'Celebración'],
  ['flower-lotus', 'Flor de loto', 'Naturaleza'],
  ['flower-tulip', 'Tulipán', 'Naturaleza'],
  ['confetti', 'Confeti', 'Celebración'],
  ['heart-straight', 'Corazón recto', 'Símbolos'],
  ['balloon', 'Globo', 'Celebración'],
  ['star', 'Estrella sólida', 'Símbolos'],
];

const out = [];
const kept = [];
for (const [name, label, category] of ICONS) {
  const file = path.join(dir, `${name}-fill.svg`);
  if (!fs.existsSync(file)) { console.warn('No existe:', name); continue; }
  const svg = fs.readFileSync(file, 'utf8');
  const ds = [];
  // ignora rect fill="none" y cualquier elemento que no sea <path d>
  const re = /<path\b[^>]*?\sd="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(svg))) {
    if (/fill="none"/.test(m[0])) continue;
    ds.push(m[1]);
  }
  // tolerancia 0.1 en unidades de viewBox 256 (aprox 0.0004 de caja unitaria)
  const polys = ds.flatMap((d) => pathToPolygons(d, 0.1));
  const region = clip.normalize(polys, 'nonzero');
  const islands = clip.toExPolys(region).length;
  if (islands !== 1) { console.warn(`Descartado ${name}: ${islands} islas`); continue; }
  const fit = clip.fitUnitBox(region);
  out.push({ id: name, name: label, category, aspect: Math.round(fit.aspect * 10000) / 10000, contours: fit.contours });
  kept.push(name);
}
const body = `// Generado por scripts/extract-ornaments.mjs desde @phosphor-icons/core (MIT). No editar a mano.\nexport const PHOSPHOR = ${JSON.stringify(out)};\n`;
fs.writeFileSync(path.join(root, 'src', 'geometry', 'ornaments-data.js'), body);
// licencia
const lic = path.join(root, 'node_modules', '@phosphor-icons', 'core', 'LICENSE');
fs.mkdirSync(path.join(root, 'public', 'LICENSES'), { recursive: true });
if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(root, 'public', 'LICENSES', 'phosphor-icons-MIT.txt'));
console.log('Iconos incluidos:', kept.join(', '), `(${(body.length / 1024).toFixed(0)} KB)`);
