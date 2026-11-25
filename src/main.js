import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles.css';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

import {
  state, subscribe, initState, change, select, selected, addElement, replaceProject, deleteSelected,
  duplicateSelected, undo, redo, canUndo, canRedo, cloneCurrent,
} from './state.js';
import { computeTopper, fitTotalWidth } from './geometry/pipeline.js';
import { buildSTLFiles } from './geometry/mesh.js';
import { defaultText, defaultOrnament, exportBaseName } from './geometry/project.js';
import { TEMPLATES, buildTemplate, defaultProject } from './geometry/templates.js';
import * as clip from './geometry/clip.js';
import { fonts, loadFont, restoreCustomFonts, exportCustomFonts, importCustomFonts } from './fonts/loader.js';
import { h, download, pickFile, popover, menuContent, toast } from './ui/util.js';
import { icon } from './ui/icons.js';
import { View2D } from './ui/view2d.js';
import { View3D } from './ui/view3d.js';
import { createLeftPanel, createRightPanel } from './ui/panels.js';
import { openGallery, openTemplates } from './ui/pickers.js';

initState();

// ---------- estructura ----------
const app = document.getElementById('app');
const btn = (label, ic, onClick, cls = 'btn') =>
  h('button', { type: 'button', class: cls, onClick, 'aria-label': label || undefined }, ic ? h('span', { html: ic }) : null, label ? h('span', { class: 'btn-label' }, label) : null);

const undoBtn = btn('Deshacer', icon.undo, undo, 'btn ghost');
const redoBtn = btn('Rehacer', icon.redo, redo, 'btn ghost');
undoBtn.title = 'Deshacer (Ctrl+Z)';
redoBtn.title = 'Rehacer (Ctrl+Y)';
const exportBtn = h('button', { type: 'button', class: 'btn primary', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, h('span', { html: icon.download }), h('span', { class: 'btn-label' }, 'Exportar STL'), h('span', { html: icon.chevron }));

const header = h(
  'header',
  { class: 'app-header' },
  h('div', { class: 'brand' }, h('span', { class: 'brand-mark', html: icon.logo }), h('span', { class: 'brand-name' }, 'Topper Maker')),
  h(
    'div',
    { class: 'header-actions' },
    btn('Nuevo', icon.file, newProject, 'btn ghost'),
    btn('Plantillas', icon.templates, () => openTemplates(TEMPLATES, (t) => { replaceProject(buildTemplate(t.id, 'Ana')); view2d.fit(); view3d.needsFit = true; }), 'btn ghost'),
    btn('Abrir proyecto', icon.open, openProject, 'btn ghost'),
    btn('Guardar proyecto', icon.save, saveProject, 'btn ghost'),
    h('span', { class: 'sep' }),
    undoBtn,
    redoBtn,
    exportBtn,
  ),
);

const leftRoot = h('aside', { class: 'panel left', 'aria-label': 'Elementos y propiedades' });
const rightRoot = h('aside', { class: 'panel right', 'aria-label': 'Ajustes globales' });

const tab2d = h('button', { type: 'button', role: 'tab', class: 'tab active', 'aria-selected': 'true', id: 'tab-2d' }, h('span', { html: icon.grid }), 'Diseño 2D');
const tab3d = h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': 'false', id: 'tab-3d' }, h('span', { html: icon.cube }), 'Vista 3D');
const fitBtn = btn('', icon.fit, () => (tab === '2d' ? view2d.fit() : view3d.resetView()), 'icon-btn');
fitBtn.title = 'Encuadrar';
fitBtn.setAttribute('aria-label', 'Encuadrar vista');
const warnBox = h('div', { class: 'warn-box', hidden: true, role: 'status' });
const stage2d = h('div', { class: 'stage', id: 'stage-2d', role: 'tabpanel', 'aria-labelledby': 'tab-2d' });
const stage3d = h('div', { class: 'stage', id: 'stage-3d', role: 'tabpanel', 'aria-labelledby': 'tab-3d', hidden: true });
const hint = h('div', { class: 'canvas-hint' }, 'Arrastra para mover. Rueda para zoom. Espacio o botón central para desplazar. Alt desactiva el imán al centro.');
const center = h(
  'main',
  { class: 'center' },
  h('div', { class: 'tabs', role: 'tablist' }, tab2d, tab3d, h('span', { class: 'grow' }), fitBtn),
  h('div', { class: 'stage-wrap' }, stage2d, stage3d, warnBox, hint),
);

const statusEls = {
  size: h('span', { class: 'stat' }),
  islands: h('span', { class: 'stat' }),
  thin: h('span', { class: 'stat' }),
  tris: h('span', { class: 'stat' }),
  pla: h('span', { class: 'stat' }),
};
const status = h('footer', { class: 'status-bar', role: 'status' }, ...Object.values(statusEls));

app.append(header, h('div', { class: 'workspace' }, leftRoot, center, rightRoot), status);

// ---------- vistas y paneles ----------
const view2d = new View2D(stage2d);
const view3d = new View3D(stage3d);
let tab = '2d';
function setTab(t) {
  tab = t;
  const is2d = t === '2d';
  tab2d.classList.toggle('active', is2d);
  tab3d.classList.toggle('active', !is2d);
  tab2d.setAttribute('aria-selected', String(is2d));
  tab3d.setAttribute('aria-selected', String(!is2d));
  stage2d.hidden = !is2d;
  stage3d.hidden = is2d;
  hint.hidden = !is2d;
  view3d.setVisible(!is2d);
  if (is2d) view2d.updateView();
}
tab2d.addEventListener('click', () => setTab('2d'));
tab3d.addEventListener('click', () => setTab('3d'));
view2d.onDragEnd = () => schedule(true);

const left = createLeftPanel(leftRoot, {
  addText: () => addElement(defaultText({ content: 'Texto', fontId: 'dancing-script', height: 14 })),
  addOrnament: () => openGallery((o) => addElement(defaultOrnament({ ornamentId: o.id, width: 24 })), importSVG),
  changeOrnament: () =>
    openGallery(
      (o) => change((p) => { const e = p.elements.find((x) => x.id === state.selectedId); if (e) { e.ornamentId = o.id; e.custom = null; } }),
      importSVG,
    ),
  importSVG,
});
const right = createRightPanel(rightRoot, {
  fitWidth: (target) => {
    if (!(target > 0)) return;
    const fitted = fitTotalWidth(state.project, target, { fonts });
    change((p) => { p.elements = fitted.elements; }, { kind: 'structure' });
    toast(`Ancho ajustado a ${target} mm.`);
  },
});

// ---------- calculo ----------
let result = null;
let scheduled = false;
let needFull = false;
let fellBack = false;
const failed = new Map(); // id -> instante del fallo

function schedule(full = false) {
  if (full) needFull = true;
  if (scheduled) return;
  scheduled = true;
  // rAF no se dispara en pestañas ocultas: respaldo con temporizador
  let done = false;
  const go = () => { if (done) return; done = true; run(); };
  requestAnimationFrame(go);
  setTimeout(go, 60);
}

function run() {
  scheduled = false;
  const skipThin = view2d.dragging && !needFull;
  needFull = false;
  try {
    result = computeTopper(state.project, { fonts }, { skipThin });
  } catch (e) {
    console.error(e);
    if (!result && !fellBack) {
      fellBack = true;
      toast('El diseño guardado no se pudo cargar. Se restauró el diseño por defecto.');
      replaceProject(defaultProject(), { record: false });
      return;
    }
    toast('Ocurrió un error al calcular la geometría.');
    return;
  }
  const need = [...new Set(state.project.elements.filter((e) => e.type === 'text' && !fonts[e.fontId] && !(failed.get(e.fontId) > Date.now() - 10000)).map((e) => e.fontId))];
  if (need.length) {
    Promise.all(need.map((id) => loadFont(id).then((f) => { if (!f) { failed.set(id, Date.now()); setTimeout(() => schedule(true), 10500); } }))).then(() => schedule(true));
  }
  view2d.setResult(result);
  view3d.setResult(result);
  left.setResult(result);
  renderStatus();
}

function renderStatus() {
  const r = result;
  if (!r || r.empty) {
    Object.values(statusEls).forEach((e) => (e.textContent = ''));
    statusEls.size.textContent = 'Sin elementos';
    warnBox.hidden = true;
    return;
  }
  const { w, h: hh, z } = r.size;
  statusEls.size.textContent = `${w.toFixed(1)} x ${hh.toFixed(1)} x ${z.toFixed(1)} mm`;
  statusEls.islands.textContent = `Piezas: ${r.islands}`;
  statusEls.islands.classList.toggle('bad', r.islands > 1);
  statusEls.thin.textContent = `Zonas finas: ${r.thinCount}`;
  statusEls.thin.classList.toggle('bad', r.thinCount > 0 && state.project.settings.showThin);
  statusEls.tris.textContent = `Triángulos: ${r.triangles.toLocaleString('es')}`;
  statusEls.pla.textContent = `PLA: ${r.grams.toFixed(1)} g · ${r.meters.toFixed(1)} m`;
  warnBox.hidden = !r.warnings.length;
  warnBox.replaceChildren(...[...new Set(r.warnings)].map((w2) => h('div', { class: 'warn-line' }, h('span', { html: icon.warn }), h('span', {}, w2))));
}

function refreshHistoryButtons() {
  undoBtn.disabled = !canUndo();
  redoBtn.disabled = !canRedo();
}

subscribe((kind) => {
  if (kind === 'structure') {
    left.rebuild();
  } else left.sync();
  right.sync();
  view3d.setColors(state.project.settings.colors);
  refreshHistoryButtons();
  schedule();
});

// ---------- acciones ----------
function newProject() {
  if (state.project.elements.length && !window.confirm('Se descartará el diseño actual. ¿Continuar?')) return;
  replaceProject({ elements: [], settings: cloneCurrent().settings });
}

function usedCustomFontIds() {
  return [...new Set(state.project.elements.filter((e) => e.type === 'text' && e.fontId.startsWith('custom:')).map((e) => e.fontId))];
}

function saveProject() {
  const data = { ...cloneCurrent(), customFonts: exportCustomFonts(usedCustomFontIds()) };
  download(`${exportBaseName(state.project)}.json`, JSON.stringify(data, null, 1), 'application/json');
}

async function openProject() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (!raw || !Array.isArray(raw.elements)) throw new Error('formato');
    await importCustomFonts(raw.customFonts);
    replaceProject(raw);
    view2d.fit();
    view3d.needsFit = true;
  } catch (e) {
    toast('No se pudo abrir el archivo. Verifica que sea un proyecto de Topper Maker (.json).');
  }
}

function exportSTL(mode) {
  if (!result || result.empty) {
    toast('No hay nada que exportar todavía.');
    return;
  }
  try {
    const files = buildSTLFiles(result, mode);
    const base = exportBaseName(state.project);
    files.forEach((f) => download(`${base}${f.suffix}.stl`, f.data, 'model/stl'));
    toast(files.length > 1 ? 'Se exportaron los archivos por capas.' : 'STL exportado.');
  } catch (e) {
    console.error(e);
    toast('No se pudo generar el STL.');
  }
}

exportBtn.addEventListener('click', () =>
  popover(
    exportBtn,
    menuContent([
      { label: 'STL (una pieza)', hint: 'Un solo archivo', onClick: () => exportSTL('single') },
      {
        label: 'STL por capas',
        hint: state.project.settings.style === 'silhouette' ? 'Fondo y relieve, para varios colores' : 'Solo con estilo de silueta de fondo',
        disabled: state.project.settings.style !== 'silhouette',
        onClick: () => exportSTL('layers'),
      },
    ]),
    { align: 'right' },
  ),
);

async function importSVG() {
  const file = await pickFile('.svg,image/svg+xml');
  if (!file) return;
  try {
    const text = await file.text();
    const data = new SVGLoader().parse(text);
    const isWhite = (f) => /^(#fff|#ffffff|white|rgb(s*255s*,s*255s*,s*255s*))$/i.test(String(f).trim());
    const cand = [];
    for (const path of data.paths) {
      const st = (path.userData && path.userData.style) || {};
      if (st.fill === 'none') continue;
      if (Number(st.fillOpacity) === 0 || Number(st.opacity) === 0) continue;
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const contours = [];
      for (const sp of path.subPaths) {
        const pts = sp.getPoints(16).map((p) => [p.x, -p.y]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
        if (pts.length > 1) {
          const a = pts[0], b = pts[pts.length - 1];
          if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) pts.pop();
        }
        if (pts.length >= 3) contours.push(pts);
      }
      if (contours.length) cand.push({ contours, rule: st.fillRule === 'evenodd' ? 'evenodd' : 'nonzero', white: isWhite(st.fill), box: clip.bbox(contours) });
    }
    if (!cand.length) throw new Error('vacio');
    const full = clip.bbox(cand.flatMap((p) => p.contours));
    // descarta rectangulos blancos de fondo que cubren casi todo el dibujo
    let perPath = cand.filter((p) => !(p.white && cand.length > 1 && p.box.w >= full.w * 0.95 && p.box.h >= full.h * 0.95));
    if (!perPath.length) perPath = cand;
    const all = clip.bbox(perPath.flatMap((p) => p.contours));
    if (Math.min(all.w, all.h) < 1e-3) {
      toast('El SVG no tiene forma rellena con tamaño suficiente (parece una línea o está vacío).');
      return;
    }
    const k = 200 / Math.max(all.w, all.h);
    const norm = perPath.map((p) => clip.normalize(p.contours.map((c) => c.map(([x, y]) => [(x - all.minX) * k, (y - all.minY) * k])), p.rule));
    const merged = clip.union(...norm);
    if (!merged.length) throw new Error('vacio');
    const fit = clip.fitUnitBox(merged);
    let total = fit.contours.reduce((a, c) => a + c.length, 0);
    if (total > 18000) {
      const st = Math.ceil(total / 18000);
      fit.contours = fit.contours.map((c) => c.filter((_, i) => i % st === 0)).filter((c) => c.length >= 3);
    }
    const name = file.name.replace(/\.svg$/i, '');
    addElement(defaultOrnament({ ornamentId: null, custom: { name, contours: fit.contours, fill: 'nonzero' }, width: 40 }));
    toast('SVG importado.');
  } catch (e) {
    toast('No se pudo leer el SVG. Usa un archivo con formas rellenas (no solo trazos).');
  }
}

// ---------- teclado ----------
window.addEventListener('keydown', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  const typing = /INPUT|TEXTAREA|SELECT/.test(tag) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    if (typing && document.activeElement.type === 'text') return;
    e.preventDefault();
    undo();
  } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    if (typing && document.activeElement.type === 'text') return;
    e.preventDefault();
    redo();
  } else if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveProject();
  } else if (!typing && !mod && selected()) {
    if (e.key === 'Delete' && !/INPUT|TEXTAREA|SELECT/.test(tag)) {
      e.preventDefault();
      deleteSelected();
    } else if (e.key.startsWith('Arrow') && !/BUTTON|INPUT|SELECT|TEXTAREA/.test(tag)) {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
      const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
      const id = state.selectedId;
      change((p) => { const el = p.elements.find((x) => x.id === id); if (el) { el.x += dx; el.y += dy; } }, { key: `nudge-${id}` });
    }
  }
});

// ---------- inicio ----------
left.rebuild();
right.sync();
view3d.setColors(state.project.settings.colors);
refreshHistoryButtons();
restoreCustomFonts().then(() => schedule(true));
schedule(true);
window.__topper = { state, get result() { return result; } };
if (location.hash === '#3d') setTab('3d');
