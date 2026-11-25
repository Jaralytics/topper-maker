// Modelo de proyecto: valores por defecto, normalizacion y utilidades. Sin DOM.

let counter = 0;
export function newId() {
  counter++;
  return `e${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 5)}`;
}

export const DEFAULT_SETTINGS = {
  thickness: 3,
  style: 'cutout', // 'cutout' | 'silhouette'
  silhouette: { margin: 3, baseHeight: 2, reliefHeight: 1.2 },
  bar: { enabled: true, height: 4, radius: 1.5, margin: 2, offset: 0 },
  stakes: { count: 2, length: 60, width: 6, tip: 12, spread: 50, anchor: 3 },
  reinforce: 0.35,
  close: 0.4,
  minHole: 0.8,
  minWidth: 1.0,
  connectDots: true,
  joinNear: true,
  joinDist: 2.5,
  bridgeWidth: 1.6,
  showThin: true,
  colors: { main: '#e8a0b4', relief: '#ffffff', background: '#f1f3f5' },
};

export function defaultText(over = {}) {
  return {
    id: newId(),
    type: 'text',
    x: 0, y: 0, rotation: 0, mirror: false,
    content: 'Texto',
    fontId: 'great-vibes',
    height: 14,
    spacing: 0,
    curvature: 0,
    ...over,
  };
}

export function defaultOrnament(over = {}) {
  return {
    id: newId(),
    type: 'ornament',
    x: 0, y: 0, rotation: 0, mirror: false,
    ornamentId: 'p:corazon',
    custom: null, // { name, contours, fill }
    width: 20,
    ...over,
  };
}

const RANGES = {
  thickness: [0.8, 12],
  'silhouette.margin': [0.5, 15],
  'silhouette.baseHeight': [0.6, 10],
  'silhouette.reliefHeight': [0.2, 10],
  'bar.height': [1, 20],
  'bar.radius': [0, 10],
  'bar.margin': [0, 20],
  'bar.offset': [-15, 15],
  'stakes.count': [0, 4],
  'stakes.length': [10, 150],
  'stakes.width': [2, 20],
  'stakes.tip': [0, 40],
  'stakes.spread': [20, 90],
  'stakes.anchor': [1, 10],
  joinDist: [0, 8],
  bridgeWidth: [0.4, 6],
  reinforce: [0, 2],
  close: [0, 3],
  minHole: [0, 10],
  minWidth: [0, 4],
};

const num = (v, def, min, max) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

function normalizeSettings(raw, def = DEFAULT_SETTINGS, prefix = '') {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const k of Object.keys(def)) {
    const d = def[k];
    const path = prefix + k;
    const v = src[k];
    if (d && typeof d === 'object') out[k] = normalizeSettings(v, d, `${path}.`);
    else if (typeof d === 'boolean') out[k] = typeof v === 'boolean' ? v : d;
    else if (typeof d === 'number') {
      const [a, b] = RANGES[path] || [-1e6, 1e6];
      out[k] = num(v, d, a, b);
    } else if (path === 'style') out[k] = v === 'silhouette' || v === 'cutout' ? v : d;
    else if (prefix === 'colors.') out[k] = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d;
    else out[k] = typeof v === 'string' ? v : d;
  }
  return out;
}

export const MAX_CUSTOM_POINTS = 20000;

/** Valida contornos personalizados; devuelve null si no son validos. */
export function sanitizeCustom(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.contours)) return null;
  let total = 0;
  const contours = [];
  for (const ring of c.contours) {
    if (!Array.isArray(ring)) return null;
    total += ring.length;
    if (total > MAX_CUSTOM_POINTS) return null;
    const r = [];
    for (const pt of ring) {
      if (!Array.isArray(pt) || pt.length < 2) return null;
      const x = pt[0], y = pt[1];
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      r.push([x, y]);
    }
    if (r.length >= 3) contours.push(r);
  }
  if (!contours.length) return null;
  return {
    name: typeof c.name === 'string' ? c.name.slice(0, 80) : 'SVG importado',
    contours,
    fill: c.fill === 'evenodd' ? 'evenodd' : 'nonzero',
  };
}

function normalizeElement(e) {
  if (!e || typeof e !== 'object') return null;
  const str = (v, d) => (typeof v === 'string' ? v : d);
  const common = {
    id: typeof e.id === 'string' && e.id ? e.id.slice(0, 60) : newId(),
    x: num(e.x, 0, -1000, 1000),
    y: num(e.y, 0, -1000, 1000),
    rotation: num(e.rotation, 0, -360, 360),
    mirror: e.mirror === true,
  };
  if (e.type === 'text') {
    const b = defaultText();
    return {
      ...common,
      type: 'text',
      content: str(e.content, b.content).slice(0, 200),
      fontId: str(e.fontId, b.fontId).slice(0, 120),
      height: num(e.height, b.height, 1, 400),
      spacing: num(e.spacing, 0, -20, 50),
      curvature: num(e.curvature, 0, -2000, 2000),
    };
  }
  if (e.type === 'ornament') {
    const b = defaultOrnament();
    let custom = null;
    if (e.custom !== null && e.custom !== undefined) {
      custom = sanitizeCustom(e.custom);
      if (!custom) return null;
    }
    return {
      ...common,
      type: 'ornament',
      ornamentId: custom ? null : str(e.ornamentId, b.ornamentId).slice(0, 80),
      custom,
      width: num(e.width, b.width, 0.1, 600),
    };
  }
  return null;
}

/** Valida y completa un proyecto cargado (JSON). Nunca lanza. */
export function normalizeProject(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(r.elements) ? r.elements : [];
  const elements = [];
  const seen = new Set();
  for (const e of list.slice(0, 200)) {
    const n = normalizeElement(e);
    if (!n) continue;
    if (seen.has(n.id)) n.id = newId();
    seen.add(n.id);
    elements.push(n);
  }
  return {
    version: 1,
    name: typeof r.name === 'string' && r.name ? r.name.slice(0, 80) : 'topper',
    elements,
    settings: normalizeSettings(r.settings),
  };
}

export function cloneProject(p) {
  return JSON.parse(JSON.stringify(p));
}

/** Escala posiciones y tamanos de todos los elementos por el factor f. */
export function scaleElements(project, f) {
  for (const e of project.elements) {
    e.x *= f;
    e.y *= f;
    if (e.type === 'text') {
      e.height *= f;
      e.spacing *= f;
      e.curvature *= f;
    } else {
      e.width *= f;
    }
  }
}

export function slugify(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'topper'
  );
}

export function exportBaseName(project) {
  const t = project.elements.find((e) => e.type === 'text' && e.content && e.content.trim());
  return `topper-${slugify(t ? t.content : project.name)}`;
}
