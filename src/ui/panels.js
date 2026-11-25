// Paneles lateral izquierdo (elementos y propiedades) y derecho (ajustes globales).
import { h, clamp } from './util.js';
import { icon } from './icons.js';
import { state, change, select, selected, duplicateSelected, deleteSelected } from '../state.js';
import { findOrnament } from '../geometry/ornaments.js';
import { fontName } from '../fonts/loader.js';
import { openFontPicker, openGallery, ornamentThumb } from './pickers.js';

let uid = 0;

/** Campo numerico con deslizador opcional. */
function numField({ label, unit = 'mm', min, max, step = 0.1, get, set, key, slider = true, hint }) {
  const id = `f${++uid}`;
  const input = h('input', { id, type: 'number', step, min, max, inputmode: 'decimal' });
  const range = slider ? h('input', { type: 'range', min, max, step, 'aria-label': label }) : null;
  const apply = (raw) => {
    let v = parseFloat(raw);
    if (!Number.isFinite(v)) return;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    set(v, key);
  };
  input.addEventListener('input', () => apply(input.value));
  input.addEventListener('blur', () => sync());
  if (range) range.addEventListener('input', () => apply(range.value));
  const sync = () => {
    const v = get();
    const s = String(Math.round(v * 100) / 100);
    if (document.activeElement !== input) input.value = s;
    if (range) range.value = clamp(v, min ?? v, max ?? v);
  };
  const el = h(
    'div',
    { class: 'field' },
    h('label', { for: id }, label, unit ? h('span', { class: 'unit' }, unit) : null),
    h('div', { class: 'field-controls' }, range, input),
    hint ? h('small', { class: 'hint' }, hint) : null,
  );
  sync();
  return { el, sync };
}

function checkField({ label, get, set }) {
  const id = `f${++uid}`;
  const input = h('input', { id, type: 'checkbox' });
  const onToggle = () => { if (!!get() !== input.checked) set(input.checked); };
  input.addEventListener('change', onToggle);
  input.addEventListener('input', onToggle);
  const sync = () => { input.checked = !!get(); };
  sync();
  return { el: h('div', { class: 'field check' }, input, h('label', { for: id }, label)), sync, input };
}

function section(title, ...children) {
  return h('section', { class: 'section' }, h('h2', {}, title), ...children);
}

// ================= panel izquierdo =================
export function createLeftPanel(root, actions) {
  const syncers = [];
  let lastResult = null;
  const listEl = h('ul', { class: 'element-list', role: 'listbox', 'aria-label': 'Elementos' });
  const propsEl = h('div', { class: 'props' });
  const warnEl = h('div', { class: 'inline-warn', hidden: true });

  const elLabel = (e) => {
    if (e.type === 'text') return e.content && e.content.trim() ? e.content : '(texto vacío)';
    if (e.custom) return e.custom.name || 'SVG importado';
    const o = findOrnament(e.ornamentId);
    return o ? o.name : 'Adorno';
  };

  function renderList() {
    listEl.replaceChildren();
    const els = state.project.elements;
    if (!els.length) listEl.append(h('li', { class: 'empty' }, 'Sin elementos todavía.'));
    els.forEach((e) => {
      const row = h(
        'li',
        { class: `element-row${e.id === state.selectedId ? ' selected' : ''}`, 'data-id': e.id },
        h(
          'button',
          {
            type: 'button',
            class: 'element-main',
            role: 'option',
            'aria-selected': e.id === state.selectedId ? 'true' : 'false',
            onClick: () => select(e.id),
          },
          h('span', { class: 'element-icon', html: e.type === 'text' ? icon.text : icon.ornament }),
          h('span', { class: 'element-label' }, elLabel(e)),
        ),
      );
      listEl.append(row);
    });
  }

  function syncList() {
    const rows = listEl.querySelectorAll('.element-row');
    state.project.elements.forEach((e, i) => {
      const lab = rows[i] && rows[i].querySelector('.element-label');
      if (lab) lab.textContent = elLabel(e);
    });
  }

  function renderProps() {
    syncers.length = 0;
    propsEl.replaceChildren();
    const el = selected();
    if (!el) {
      propsEl.append(h('p', { class: 'muted' }, 'Selecciona un elemento para editar sus propiedades.'));
      return;
    }
    const id = el.id;
    const cur = () => state.project.elements.find((x) => x.id === id);
    const setProp = (prop) => (v, key) => change((p) => { const e = p.elements.find((x) => x.id === id); if (e) e[prop] = v; }, { key: `${prop}-${id}` });
    const add = (f) => { syncers.push(f.sync); return f.el; };
    const common = [
      add(numField({ label: 'Posición X', min: -400, max: 400, step: 0.5, get: () => cur().x, set: setProp('x') })),
      add(numField({ label: 'Posición Y', min: -400, max: 400, step: 0.5, get: () => cur().y, set: setProp('y') })),
      add(numField({ label: 'Rotación', unit: 'grados', min: -180, max: 180, step: 1, get: () => cur().rotation, set: setProp('rotation') })),
      add(checkField({ label: 'Reflejar horizontalmente', get: () => cur().mirror, set: (v) => change((p) => { const e = p.elements.find((x) => x.id === id); if (e) e.mirror = v; }) })),
    ];
    if (el.type === 'text') {
      const content = h('input', { type: 'text', class: 'text-input', id: 'text-content', value: el.content, autocomplete: 'off', spellcheck: 'false' });
      content.addEventListener('input', () => change((p) => { const e = p.elements.find((x) => x.id === id); if (e) e.content = content.value; }, { key: `content-${id}` }));
      syncers.push(() => { if (document.activeElement !== content) content.value = cur().content; });
      const fontBtn = h('button', { type: 'button', class: 'font-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
      const syncFont = () => {
        fontBtn.replaceChildren(h('span', { class: 'font-name' }, fontName(cur().fontId)), h('span', { html: icon.chevron }));
      };
      syncers.push(syncFont);
      syncFont();
      fontBtn.addEventListener('click', () =>
        openFontPicker(fontBtn, cur().fontId, (fid) => change((p) => { const e = p.elements.find((x) => x.id === id); if (e) e.fontId = fid; }, { kind: 'values' })),
      );
      const curv = numField({
        label: 'Curvatura (radio)', min: -300, max: 300, step: 5,
        hint: '0 = recto. Positivo: arco; negativo: sonrisa. Radio mínimo 20 mm; si es muy cerrado se limita para no plegar las letras.',
        get: () => cur().curvature,
        set: (v) => {
          if (v !== 0 && Math.abs(v) < 20) v = v > 0 ? 20 : -20;
          setProp('curvature')(v);
        },
      });
      propsEl.append(
        h('h3', {}, 'Texto'),
        h('div', { class: 'field' }, h('label', { for: 'text-content' }, 'Contenido'), content),
        h('div', { class: 'field' }, h('label', {}, 'Tipografía'), fontBtn),
        add(numField({ label: 'Altura de mayúsculas', min: 3, max: 120, step: 0.5, get: () => cur().height, set: setProp('height') })),
        add(numField({ label: 'Espaciado de letras', min: -5, max: 20, step: 0.1, get: () => cur().spacing, set: setProp('spacing') })),
        add(curv),
        ...common,
      );
    } else {
      const thumbHost = h('span', { class: 'thumb-host' });
      const nameEl = h('span', { class: 'orn-name' });
      const syncOrn = () => {
        const e = cur();
        const o = e.custom || findOrnament(e.ornamentId);
        thumbHost.replaceChildren(o ? ornamentThumb({ ...o, id: e.custom ? null : o.id }, 40) : '');
        nameEl.textContent = e.custom ? e.custom.name || 'SVG importado' : o ? o.name : 'Adorno';
      };
      syncers.push(syncOrn);
      syncOrn();
      const pick = h('button', { type: 'button', class: 'font-btn', onClick: () => actions.changeOrnament() }, thumbHost, nameEl, h('span', { html: icon.chevron }));
      propsEl.append(
        h('h3', {}, 'Adorno'),
        h('div', { class: 'field' }, h('label', {}, 'Forma'), pick),
        add(numField({ label: 'Tamaño (lado mayor)', min: 3, max: 300, step: 0.5, get: () => cur().width, set: setProp('width') })),
        ...common,
      );
    }
    syncers.forEach((f) => f());
  }

  const actionsRow = h(
    'div',
    { class: 'add-row' },
    h('button', { type: 'button', class: 'btn', onClick: actions.addText }, h('span', { html: icon.text }), 'Agregar texto'),
    h('button', { type: 'button', class: 'btn', onClick: actions.addOrnament }, h('span', { html: icon.ornament }), 'Agregar adorno'),
    h('button', { type: 'button', class: 'btn', onClick: actions.importSVG }, h('span', { html: icon.import }), 'Importar SVG'),
  );
  const listTools = h(
    'div',
    { class: 'list-tools' },
    h('button', { type: 'button', class: 'btn small', onClick: duplicateSelected, 'data-needs-sel': true }, h('span', { html: icon.copy }), 'Duplicar'),
    h('button', { type: 'button', class: 'btn small danger', onClick: deleteSelected, 'data-needs-sel': true }, h('span', { html: icon.trash }), 'Eliminar'),
  );

  root.append(section('Elementos', actionsRow, listEl, listTools), section('Propiedades', warnEl, propsEl));

  function updateWarn() {
    const info = lastResult && lastResult.elements.find((e) => e.id === state.selectedId);
    const msgs = [];
    if (info && info.missing.length) msgs.push(`La tipografía no incluye: ${info.missing.map((c) => `"${c}"`).join(' ')}`);
    if (info && info.fontMissing) msgs.push('Cargando tipografía...');
    warnEl.hidden = !msgs.length;
    warnEl.replaceChildren(...(msgs.length ? [h('span', { html: icon.warn }), h('span', {}, msgs.join('. '))] : []));
    listTools.querySelectorAll('[data-needs-sel]').forEach((b) => (b.disabled = !state.selectedId));
  }

  return {
    rebuild() { renderList(); renderProps(); updateWarn(); },
    sync() { syncList(); syncers.forEach((f) => f()); updateWarn(); },
    setResult(r) { lastResult = r; updateWarn(); },
  };
}

// ================= panel derecho =================
export function createRightPanel(root, actions) {
  const syncers = [];
  const S = () => state.project.settings;
  const setS = (path) => (v) => change((p) => {
    const parts = path.split('.');
    let o = p.settings;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
  }, { key: `s-${path}` });
  const getS = (path) => () => path.split('.').reduce((o, k) => o[k], S());
  const num = (label, path, opts) => {
    const f = numField({ label, get: getS(path), set: setS(path), ...opts });
    syncers.push(f.sync);
    return f.el;
  };
  const chk = (label, path) => {
    const f = checkField({ label, get: getS(path), set: setS(path) });
    syncers.push(f.sync);
    return f.el;
  };

  // estilo
  const styleSel = h(
    'select',
    { id: 'style-select', 'aria-label': 'Estilo' },
    h('option', { value: 'cutout' }, 'Recorte (una capa)'),
    h('option', { value: 'silhouette' }, 'Con silueta de fondo'),
  );
  styleSel.addEventListener('change', () => setS('style')(styleSel.value));
  styleSel.addEventListener('input', () => setS('style')(styleSel.value));
  const silBox = h(
    'div',
    { class: 'subgroup' },
    num('Margen de silueta', 'silhouette.margin', { min: 0.5, max: 15, step: 0.1 }),
    num('Altura del fondo', 'silhouette.baseHeight', { min: 0.6, max: 10, step: 0.1 }),
    num('Altura del relieve', 'silhouette.reliefHeight', { min: 0.2, max: 10, step: 0.1 }),
  );
  const thickBox = h('div', { class: 'subgroup' }, num('Grosor', 'thickness', { min: 0.8, max: 12, step: 0.1 }));
  syncers.push(() => {
    styleSel.value = S().style;
    silBox.hidden = S().style !== 'silhouette';
    thickBox.hidden = S().style === 'silhouette';
  });

  const barBox = h(
    'div',
    { class: 'subgroup' },
    num('Alto de la barra', 'bar.height', { min: 1, max: 20, step: 0.5 }),
    num('Radio de esquinas', 'bar.radius', { min: 0, max: 10, step: 0.5 }),
    num('Margen lateral', 'bar.margin', { min: 0, max: 20, step: 0.5 }),
    num('Posición vertical (desfase)', 'bar.offset', { min: -15, max: 15, step: 0.5, hint: 'Por defecto la barra queda 1,5 mm sobre la línea base.' }),
  );
  syncers.push(() => { barBox.hidden = !S().bar.enabled; });
  const anchorField = num('Anclaje en letras', 'stakes.anchor', { min: 1, max: 10, step: 0.5, hint: 'Sin barra: la estaca entra esta altura en la base de las letras.' });
  syncers.push(() => { anchorField.hidden = S().bar.enabled; });
  const stakeBox = h(
    'div',
    { class: 'subgroup' },
    num('Largo', 'stakes.length', { min: 10, max: 150, step: 1 }),
    num('Ancho', 'stakes.width', { min: 2, max: 20, step: 0.5 }),
    num('Largo de la punta', 'stakes.tip', { min: 0, max: 40, step: 1 }),
    num('Separación de estacas', 'stakes.spread', { unit: '%', min: 20, max: 90, step: 1, hint: 'Distancia entre las estacas extremas, en % del ancho.' }),
    anchorField,
  );
  syncers.push(() => { stakeBox.hidden = S().stakes.count < 1; });

  const joinBox = h(
    'div',
    { class: 'subgroup' },
    num('Distancia máxima', 'joinDist', { min: 0, max: 8, step: 0.1, hint: 'Se une con un puente si el hueco es menor o igual.' }),
    num('Ancho del puente', 'bridgeWidth', { min: 0.4, max: 6, step: 0.1 }),
  );
  syncers.push(() => { joinBox.hidden = !S().joinNear; });
  const targetInput = h('input', { type: 'number', min: 20, max: 600, step: 1, value: 150, id: 'target-width' });
  const fitBtn = h('button', { type: 'button', class: 'btn', onClick: () => actions.fitWidth(parseFloat(targetInput.value)) }, 'Ajustar');

  const colorInput = (label, key) => {
    const input = h('input', { type: 'color', id: `c-${key}` });
    input.addEventListener('input', () => change((p) => { p.settings.colors[key] = input.value; }, { key: `color-${key}` }));
    syncers.push(() => { input.value = S().colors[key]; });
    return h('div', { class: 'field color-field' }, h('label', { for: `c-${key}` }, label), input);
  };

  root.append(
    section('Estilo y grosor', h('div', { class: 'field' }, h('label', { for: 'style-select' }, 'Estilo'), styleSel), thickBox, silBox),
    section('Barra base', chk('Incluir barra', 'bar.enabled'), barBox),
    section(
      'Estacas',
      num('Cantidad', 'stakes.count', { unit: '', min: 0, max: 4, step: 1 }),
      stakeBox,
    ),
    section(
      'Acabado',
      num('Refuerzo de trazo', 'reinforce', { min: 0, max: 2, step: 0.05, hint: 'Engrosa todos los contornos.' }),
      num('Unir separaciones', 'close', { min: 0, max: 3, step: 0.05, hint: 'Cierra huecos menores a este valor.' }),
      num('Huecos mínimos', 'minHole', { unit: 'mm²', min: 0, max: 10, step: 0.1, hint: 'Se rellenan los huecos más pequeños.' }),
      chk('Conectar puntos y tildes', 'connectDots'),
      chk('Unir piezas cercanas', 'joinNear'),
      joinBox,
    ),
    section(
      'Análisis',
      num('Ancho mínimo imprimible', 'minWidth', { min: 0, max: 4, step: 0.1 }),
      chk('Resaltar zonas finas', 'showThin'),
    ),
    section(
      'Ajustar ancho total',
      h('div', { class: 'field' }, h('label', { for: 'target-width' }, 'Ancho objetivo', h('span', { class: 'unit' }, 'mm')), h('div', { class: 'field-controls' }, targetInput, fitBtn), h('small', { class: 'hint' }, 'Escala proporcionalmente posiciones y tamaños.')),
    ),
    section('Colores de la vista 3D', colorInput('Pieza principal', 'main'), colorInput('Relieve', 'relief'), colorInput('Fondo', 'background')),
    h(
      'section',
      { class: 'section tip' },
      h('h2', {}, 'Consejos de impresión'),
      h('p', {}, 'Imprime en PLA, plano sobre la cama, con relleno al 100 % o al menos 4 perímetros.'),
      h('p', {}, 'La impresión 3D es porosa: usa filamento apto para alimentos o envuelve las estacas antes de clavarlas en el pastel.'),
    ),
  );
  // el selector de cantidad de estacas necesita enteros
  return {
    sync() { syncers.forEach((f) => f()); },
    setTarget(v) { targetInput.value = Math.round(v); },
  };
}
