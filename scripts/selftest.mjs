// Pruebas del nucleo de geometria en Node: node scripts/selftest.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { FONT_CATALOG } from '../src/fonts/catalog.js';
import { computeTopper, fitTotalWidth } from '../src/geometry/pipeline.js';
import { buildGeometry, buildSTLFiles, triangleCount } from '../src/geometry/mesh.js';
import { buildTemplate, TEMPLATES } from '../src/geometry/templates.js';
import { defaultText, defaultOrnament, normalizeProject, exportBaseName } from '../src/geometry/project.js';
import { allOrnaments } from '../src/geometry/ornaments.js';
import * as clip from '../src/geometry/clip.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(os.tmpdir(), 'toppermaker-selftest');
fs.mkdirSync(outDir, { recursive: true });

const fonts = {};
for (const f of FONT_CATALOG) {
  const buf = fs.readFileSync(path.join(root, 'public', 'fonts', f.file));
  fonts[f.id] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
const ctx = { fonts };

let failures = 0;
let checks = 0;
function check(cond, msg) {
  checks++;
  if (!cond) {
    failures++;
    console.error('  FALLO:', msg);
  }
}

function watertight(geo) {
  const pos = geo.attributes.position;
  const key = (i) => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
  const und = new Map();
  const dir = new Map();
  let vol = 0;
  let nan = false;
  const n = pos.count / 3;
  for (let t = 0; t < n; t++) {
    const ids = [key(t * 3), key(t * 3 + 1), key(t * 3 + 2)];
    for (let k = 0; k < 3; k++) {
      const a = ids[k], b = ids[(k + 1) % 3];
      if (a === b) continue;
      const u = a < b ? `${a}|${b}` : `${b}|${a}`;
      und.set(u, (und.get(u) || 0) + 1);
      dir.set(`${a}|${b}`, (dir.get(`${a}|${b}`) || 0) + 1);
    }
    const v = [0, 1, 2].map((k) => [pos.getX(t * 3 + k), pos.getY(t * 3 + k), pos.getZ(t * 3 + k)]);
    for (const p of v) if (p.some((c) => !Number.isFinite(c))) nan = true;
    const [a, b, c] = v;
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  let badU = 0, badD = 0;
  for (const c of und.values()) if (c !== 2) badU++;
  for (const [k, c] of dir) {
    const [a, b] = k.split('|');
    // la clave contiene comas, pero no "|" asi que el split es seguro
    if (c !== 1 || dir.get(`${b}|${a}`) !== 1) badD++;
  }
  return { badU, badD, vol, nan, tris: n };
}

function runCase(name, project, expect = {}) {
  console.log(`- ${name}`);
  const t0 = Date.now();
  const r = computeTopper(project, ctx);
  check(!r.empty, `${name}: resultado vacio`);
  const nums = [r.size.w, r.size.h, r.size.z, r.volume, r.grams];
  check(nums.every(Number.isFinite), `${name}: NaN en medidas`);
  if (expect.minW) check(r.size.w >= expect.minW && r.size.w <= expect.maxW, `${name}: ancho ${r.size.w.toFixed(1)} fuera de [${expect.minW}, ${expect.maxW}]`);
  if (expect.minH) check(r.size.h >= expect.minH && r.size.h <= expect.maxH, `${name}: alto ${r.size.h.toFixed(1)} fuera de [${expect.minH}, ${expect.maxH}]`);
  if (expect.islands !== undefined) check(r.islands === expect.islands, `${name}: islas ${r.islands} (esperadas ${expect.islands})`);
  const geo = buildGeometry(r);
  check(!!geo, `${name}: sin geometria`);
  const w = watertight(geo);
  check(!w.nan, `${name}: NaN en malla`);
  check(w.tris > 0, `${name}: sin triangulos`);
  check(w.badU === 0, `${name}: ${w.badU} aristas no usadas exactamente 2 veces`);
  check(w.badD === 0, `${name}: ${w.badD} aristas dirigidas inconsistentes`);
  check(w.vol > 0, `${name}: volumen con signo ${w.vol.toFixed(1)} no positivo`);
  check(Math.abs(w.vol - r.volume) / r.volume < 0.01, `${name}: volumen malla ${w.vol.toFixed(1)} vs ${r.volume.toFixed(1)}`);
  for (const mode of ['single', 'layers']) {
    for (const f of buildSTLFiles(r, mode)) {
      const file = path.join(outDir, `${name.replace(/\W+/g, '_')}-${mode}${f.suffix}.stl`);
      fs.writeFileSync(file, f.data);
    }
  }
  if (r.parts.length > 1) {
    for (const p of r.parts) {
      const g = buildGeometry(r, [p.name]);
      const ww = watertight(g);
      check(ww.badU === 0 && ww.badD === 0 && ww.vol > 0, `${name}/${p.name}: capa no estanca`);
    }
  }
  console.log(`  ${r.size.w.toFixed(1)} x ${r.size.h.toFixed(1)} x ${r.size.z.toFixed(1)} mm, islas ${r.islands}, finas ${r.thinCount}, tris ${w.tris} (est. ${r.triangles}), ${r.grams.toFixed(1)} g, ${Date.now() - t0} ms`);
  return r;
}

// 1. plantilla de cumpleanos
const birthday = buildTemplate('cumple', 'Ana');
const rb = runCase('cumpleanos', birthday, { minW: 80, maxW: 240, minH: 70, maxH: 160, islands: 1 });
{
  // el ancho = ancho de elementos + 2*margen de barra + 2*refuerzo
  const s = birthday.settings;
  const expectW = rb.elemBBox.w + 2 * s.bar.margin + 2 * s.reinforce;
  check(Math.abs(rb.size.w - expectW) < 0.3, `cumpleanos: ancho ${rb.size.w.toFixed(2)} vs esperado ${expectW.toFixed(2)}`);
}

// 2. estilo silueta
const sil = buildTemplate('cumple', 'Ana');
sil.settings.style = 'silhouette';
const rs = runCase('silueta', sil, { minW: 80, maxW: 260, minH: 70, maxH: 170, islands: 1 });
check(rs.parts.length === 2 && rs.size.z > 3, 'silueta: dos capas');

// 3. texto curvo
const curved = normalizeProject({
  elements: [
    defaultText({ content: 'Feliz Cumpleaños', fontId: 'dancing-script', height: 14, curvature: 80, y: 0 }),
    defaultText({ content: 'Sonrisa', fontId: 'fredoka', height: 12, curvature: -60, y: -22 }),
  ],
  settings: { stakes: { count: 2 } },
});
const straight = normalizeProject({ elements: [curved.elements[0] && { ...curved.elements[0], curvature: 0 }], settings: {} });
const rc = runCase('curvo', curved, { minW: 60, maxW: 220, minH: 60, maxH: 200 });
const rst = computeTopper(straight, ctx);
check(rc.elements[0].bbox.h > rst.elements[0].bbox.h + 2, 'curvo: el arco deberia ser mas alto que el texto recto');
check(rc.islands >= 1, 'curvo: sin piezas');

// 4. diseno con muchos adornos
const orn = allOrnaments();
const elements = [];
orn.forEach((o, i) => {
  elements.push(defaultOrnament({ ornamentId: o.id, width: 18, x: (i % 6) * 16 - 40, y: Math.floor(i / 6) * -14 + 20, rotation: (i * 17) % 90, mirror: i % 2 === 0 }));
});
elements.push(defaultText({ content: 'Fiesta', fontId: 'bebas-neue', height: 16, x: 0, y: -2 }));
runCase('adornos', normalizeProject({ elements, settings: { stakes: { count: 3 } } }), { minW: 60, maxW: 400 });

// 5. dos fuentes: TrueType y CFF si existe
const byFormat = {};
for (const [id, f] of Object.entries(fonts)) (byFormat[f.outlinesFormat] ||= []).push(id);
console.log('- formatos de contorno:', Object.entries(byFormat).map(([k, v]) => `${k}: ${v.length}`).join(', '));
const ttf = (byFormat.truetype || [])[0];
const cff = (byFormat.cff || [])[0];
check(!!ttf, 'no hay fuente TrueType para probar');
for (const id of [ttf, cff].filter(Boolean)) {
  runCase(`fuente-${id}`, normalizeProject({ elements: [defaultText({ content: 'Hola Mundo & Año ¿Qué?', fontId: id, height: 15 })] }), { minW: 40, maxW: 400 });
}
if (!cff) console.log('  (no hay fuente CFF disponible; se probo solo TrueType)');
// todas las fuentes y caracteres espanoles
for (const f of FONT_CATALOG) {
  const r = computeTopper(normalizeProject({ elements: [defaultText({ content: 'Ñandú ¡Feliz! á é í ó ú ü', fontId: f.id, height: 12 })] }), ctx);
  check(Number.isFinite(r.size.w) && r.size.w > 10, `${f.id}: ancho invalido`);
}

// 6. regresion de orientacion: un adorno sobre un glifo no debe crear huecos
{
  console.log('- regresion de orientacion');
  const flat = { bar: { enabled: false }, stakes: { count: 0 }, reinforce: 0, close: 0, minHole: 0 };
  const base = [defaultText({ content: 'I', fontId: 'montserrat', height: 30, x: 0, y: 0 })];
  const r0 = computeTopper(normalizeProject({ elements: base, settings: flat }), ctx);
  const holes0 = r0.main.reduce((a, e) => a + e.holes.length, 0);
  for (const id of ['ph:crown', 'p:estrella', 'p:corazon', 'ph:star', 'p:flor']) {
    for (const mirror of [false, true]) {
      const els = [...base, defaultOrnament({ ornamentId: id, width: 14, x: 0, y: 4, mirror })];
      const r = computeTopper(normalizeProject({ elements: els, settings: flat }), ctx);
      const holes = r.main.reduce((a, e) => a + e.holes.length, 0);
      const ornAlone = computeTopper(normalizeProject({ elements: [els[1]], settings: flat }), ctx);
      const holesO = ornAlone.main.reduce((a, e) => a + e.holes.length, 0);
      check(holes <= holes0 + holesO, `orientacion: ${id}${mirror ? ' (espejo)' : ''} creo huecos (${holes} > ${holes0 + holesO})`);
      const areaU = r.main.reduce((a, e) => a + clip.exArea(e), 0);
      const a0 = r0.main.reduce((a, e) => a + clip.exArea(e), 0);
      check(areaU >= a0 - 0.01, `orientacion: ${id} resta area`);
    }
  }
  // dos fuentes de orientacion opuesta superpuestas: area de la union >= area de cada una
  const glyphs = [defaultText({ content: 'O', fontId: ttf, height: 30 }), defaultText({ content: 'O', fontId: cff || ttf, height: 30, x: 4 })];
  const rg = computeTopper(normalizeProject({ elements: glyphs, settings: flat }), ctx);
  check(rg.main.length === 1, 'orientacion: dos O superpuestas deben ser una pieza');
}

// 7. todas las plantillas y ajuste de ancho
for (const t of TEMPLATES) {
  const p = buildTemplate(t.id, 'Ana');
  const r = runCase(`plantilla-${t.id}`, p, { minW: 50, maxW: 260 });
  check(r.islands === 1, `plantilla ${t.id}: ${r.islands} islas (se espera 1)`);
  check(r.elements.every((e) => !e.missing.length), `plantilla ${t.id}: caracteres faltantes`);
}
{
  const fitted = fitTotalWidth(birthday, 150, ctx);
  const r = computeTopper(fitted, ctx);
  check(Math.abs(r.size.w - 150) < 0.2, `ajuste de ancho: ${r.size.w.toFixed(2)} != 150`);
  console.log(`- ajuste de ancho a 150 mm -> ${r.size.w.toFixed(2)} mm`);
}
// 8. proyecto malformado no lanza y se normaliza
{
  console.log('- proyecto malformado');
  const evil = {
    name: 42,
    settings: { thickness: 'x', style: 'raro', bar: { height: NaN, enabled: 'si' }, stakes: { count: 99 }, colors: { main: '"><script>' } },
    elements: [
      null, 7, 'x', { type: 'raro' },
      { type: 'text', content: 5, fontId: {}, height: 'abc', x: Infinity, curvature: NaN },
      { type: 'ornament', ornamentId: 3, width: -4, custom: { contours: [[['a', 1], [2, 3], [4, 5]]] } },
      { type: 'ornament', custom: { contours: [[[0, 0], [1, 0], [1, 1]]], name: '"><img onerror=1>' }, width: 1e9 },
      { type: 'ornament', custom: { contours: [new Array(25000).fill([0, 0])] } },
    ],
  };
  let ok = true, np;
  try { np = normalizeProject(evil); computeTopper(np, ctx); } catch (e) { ok = false; console.error(e); }
  check(ok, 'malformado: lanzo una excepcion');
  check(np && np.elements.length === 2, `malformado: elementos validos ${np && np.elements.length} (esperados 2)`);
  check(np.settings.style === 'cutout' && np.settings.stakes.count === 4 && np.settings.thickness === 3, 'malformado: ajustes sin coercion');
  check(/^#[0-9a-f]{6}$/i.test(np.settings.colors.main), 'malformado: color invalido');
  check(np.elements.every((e) => ['x', 'y', 'rotation'].every((k) => Number.isFinite(e[k]))), 'malformado: valores no finitos');
  check(np.elements[1].width <= 600, 'malformado: ancho sin limitar');
  const protoFont = computeTopper(normalizeProject({ elements: [defaultText({ fontId: 'constructor' })] }), ctx);
  check(protoFont.elements[0].fontMissing, 'fontId "constructor" no debe resolver al prototipo');
  const nothrow = normalizeProject(null);
  check(nothrow.elements.length === 0, 'null normaliza a proyecto vacio');
}

// 9. el tamano de un adorno es su lado mayor
{
  console.log('- tamano de adorno alto y estrecho');
  const tall = { ...defaultOrnament({ width: 30 }), ornamentId: null, custom: { name: 't', fill: 'nonzero', contours: [[[-0.05, -0.5], [0.05, -0.5], [0.05, 0.5], [-0.05, 0.5]]] } };
  const flat = { bar: { enabled: false }, stakes: { count: 0 }, reinforce: 0, close: 0 };
  const r = computeTopper(normalizeProject({ elements: [tall], settings: flat }), ctx);
  check(Math.abs(r.elemBBox.h - 30) < 0.01 && r.elemBBox.w < 4, `adorno alto: ${r.elemBBox.w.toFixed(2)} x ${r.elemBBox.h.toFixed(2)}`);
  const heart = computeTopper(normalizeProject({ elements: [defaultOrnament({ ornamentId: 'p:luna', width: 20 })], settings: flat }), ctx);
  check(Math.abs(Math.max(heart.elemBBox.w, heart.elemBBox.h) - 20) < 0.01, 'luna: lado mayor = 20');
}

// 10. curvatura extrema: finita y estanca
for (const R of [20, -20, 1, -3, 5000]) {
  const p = normalizeProject({ elements: [defaultText({ content: 'Feliz Cumpleaños amigos', fontId: 'great-vibes', height: 20, curvature: R })] });
  p.elements[0].curvature = R; // sin el limite de la interfaz
  const r = runCase(`curvatura-extrema-${R}`, p, {});
  check(r.elements[0].bbox.w < 600 && r.elements[0].bbox.h < 600, `curvatura ${R}: tamano desmedido`);
}
// 11. sin barra: estacas ancladas en las letras y puentes entre piezas cercanas
{
  console.log('- sin barra');
  const nb = buildTemplate('cumple', 'Ana');
  nb.settings.bar.enabled = false;
  const r = runCase('sin-barra', nb, { islands: 1 });
  const anchor = nb.settings.stakes.anchor;
  check(r.base.stakes.length === 2, 'sin barra: dos estacas');
  for (const st of r.base.stakes) {
    const top = Math.max(...st.map((q) => q[1]));
    check(Math.abs(top - (r.baselineY + anchor)) < 0.01, `sin barra: tope de estaca ${top.toFixed(3)} vs ${(r.baselineY + anchor).toFixed(3)}`);
  }
  const anchored = JSON.parse(JSON.stringify(nb));
  anchored.settings.stakes.anchor = 6;
  const ra = computeTopper(anchored, ctx);
  check(Math.abs(Math.max(...ra.base.stakes[0].map((q) => q[1])) - (ra.baselineY + 6)) < 0.01, 'sin barra: anclaje configurable');
  const off = JSON.parse(JSON.stringify(nb));
  off.settings.joinNear = false;
  const ro = computeTopper(off, ctx);
  check(ro.islands > 1, `sin unir piezas cercanas deberia haber mas de 1 isla (${ro.islands})`);
  check(/Acerca las letras/.test(ro.warnings.join(' ')), 'sin barra: texto de advertencia');
  const short = JSON.parse(JSON.stringify(nb));
  short.settings.joinDist = 0.1;
  check(computeTopper(short, ctx).islands > 1, 'la distancia maxima de puente se respeta');
  // separacion de estacas (con barra y sin barra)
  const sp = buildTemplate('cumple', 'Ana');
  const w0 = computeTopper(sp, ctx).base.stakes.map((s2) => (s2[0][0] + s2[s2.length - 1][0]) / 2);
  sp.settings.stakes.spread = 80;
  const w1 = computeTopper(sp, ctx).base.stakes.map((s2) => (s2[0][0] + s2[s2.length - 1][0]) / 2);
  check(w1[1] - w1[0] > w0[1] - w0[0] + 5, 'separacion de estacas amplia la distancia');
}

check(exportBaseName(birthday) === 'topper-ana', `nombre de archivo: ${exportBaseName(birthday)}`);

console.log(`\n${checks - failures}/${checks} comprobaciones correctas. STL en ${outDir}`);
process.exit(failures ? 1 : 0);
