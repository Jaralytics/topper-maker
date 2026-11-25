// Selector de tipografias (popover) y galeria de adornos (dialogo).
import { h, popover, pickFile, toast } from './util.js';
import { icon } from './icons.js';
import { FONT_CATALOG, FONT_CATEGORIES } from '../fonts/catalog.js';
import { registerFace, cssFamily, customFonts, addCustomFontFile, fontName } from '../fonts/loader.js';
import { allOrnaments } from '../geometry/ornaments.js';

// ---------- tipografias ----------
export function openFontPicker(anchor, currentId, onPick) {
  FONT_CATALOG.forEach((f) => registerFace(f.id));
  customFonts.forEach((f) => registerFace(f.id));
  popover(
    anchor,
    (close) => {
      const box = h('div', { class: 'font-list' });
      const item = (id, name) =>
        h(
          'button',
          {
            type: 'button',
            class: `font-item${id === currentId ? ' active' : ''}`,
            style: { fontFamily: `${cssFamily(id)}, Inter, sans-serif` },
            onClick: () => {
              close();
              onPick(id);
            },
          },
          name,
        );
      for (const cat of FONT_CATEGORIES) {
        const list = FONT_CATALOG.filter((f) => f.category === cat);
        if (!list.length) continue;
        box.append(h('div', { class: 'group-title' }, cat));
        list.forEach((f) => box.append(item(f.id, f.name)));
      }
      if (customFonts.length) {
        box.append(h('div', { class: 'group-title' }, 'Personalizadas'));
        customFonts.forEach((f) => box.append(item(f.id, f.name)));
      }
      const up = h(
        'button',
        {
          type: 'button',
          class: 'btn small upload-font',
          onClick: async () => {
            const file = await pickFile('.ttf,.otf,.woff');
            if (!file) return;
            try {
              const id = await addCustomFontFile(file);
              close();
              onPick(id);
            } catch (e) {
              toast('No se pudo leer la tipografía. Usa un archivo TTF, OTF o WOFF válido.');
            }
          },
        },
        h('span', { html: icon.upload }),
        'Subir tipografía (TTF, OTF, WOFF)',
      );
      return h('div', { class: 'font-picker' }, box, up);
    },
    { cls: 'wide' },
  );
}

export function fontButtonLabel(id) {
  return fontName(id);
}

// ---------- adornos ----------
const thumbCache = new Map();

export function ornamentPathD(o) {
  let d = '';
  for (const c of o.contours) {
    if (!Array.isArray(c) || c.length < 3) continue;
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    d += `M${n(c[0][0])} ${n(c[0][1])}`;
    for (let i = 1; i < c.length; i++) d += `L${n(c[i][0])} ${n(c[i][1])}`;
    d += 'Z';
  }
  return d;
}

const NS = 'http://www.w3.org/2000/svg';

export function ornamentThumb(o, size = 56) {
  const key = o.id;
  let d = key ? thumbCache.get(key) : null;
  if (!d) {
    d = ornamentPathD(o);
    if (key) thumbCache.set(key, d);
  }
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-0.56 -0.56 1.12 1.12');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('transform', 'scale(1 -1)');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', o.fill === 'evenodd' ? 'evenodd' : 'nonzero');
  path.setAttribute('d', d);
  svg.append(path);
  const span = h('span', { class: 'thumb', style: { width: `${size}px`, height: `${size}px` } });
  span.append(svg);
  return span;
}

export function openGallery(onPick, onImport) {
  const dlg = h('dialog', { class: 'dialog gallery', 'aria-label': 'Galería de adornos' });
  const list = allOrnaments();
  const cats = [...new Set(list.map((o) => o.category))];
  const body = h('div', { class: 'gallery-body' });
  for (const cat of cats) {
    body.append(h('h3', { class: 'group-title' }, cat));
    const grid = h('div', { class: 'gallery-grid' });
    for (const o of list.filter((x) => x.category === cat)) {
      grid.append(
        h(
          'button',
          {
            type: 'button',
            class: 'gallery-item',
            title: o.name,
            onClick: () => {
              dlg.close();
              onPick(o);
            },
          },
          ornamentThumb(o, 64),
          h('span', {}, o.name),
        ),
      );
    }
    body.append(grid);
  }
  dlg.append(
    h(
      'header',
      { class: 'dialog-head' },
      h('h2', {}, 'Galería de adornos'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onClick: () => dlg.close() }, h('span', { html: icon.close })),
    ),
    body,
    h(
      'footer',
      { class: 'dialog-foot' },
      h('small', {}, 'Iconos Phosphor (licencia MIT) y formas originales.'),
      h('button', { type: 'button', class: 'btn', onClick: () => { dlg.close(); onImport(); } }, h('span', { html: icon.import }), 'Importar SVG'),
    ),
  );
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  document.body.append(dlg);
  dlg.showModal();
}

export function openTemplates(templates, onPick) {
  const dlg = h('dialog', { class: 'dialog', 'aria-label': 'Plantillas' });
  const grid = h('div', { class: 'template-grid' });
  for (const t of templates) {
    grid.append(
      h(
        'button',
        { type: 'button', class: 'template-card', onClick: () => { dlg.close(); onPick(t); } },
        h('strong', {}, t.name),
        h('small', {}, 'Reemplaza el diseño actual'),
      ),
    );
  }
  dlg.append(
    h('header', { class: 'dialog-head' }, h('h2', {}, 'Plantillas'), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onClick: () => dlg.close() }, h('span', { html: icon.close }))),
    grid,
  );
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  document.body.append(dlg);
  dlg.showModal();
}
