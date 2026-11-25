// Pipeline de geometria: elementos -> union -> base -> ExPolygons -> analisis. Sin DOM.
import * as clip from './clip.js';
import { buildTextContours, missingChars } from './text.js';
import { findOrnament } from './ornaments.js';
import { buildBase } from './base.js';
import { connectSmallIslands, joinNearIslands } from './connect.js';
import { normalizeProject, cloneProject, scaleElements } from './project.js';

const PLA_DENSITY = 1.24; // g/cm3
const FILAMENT_AREA = Math.PI * 0.875 * 0.875; // mm2 (1.75 mm)

const cache = new Map();
const customKeys = new WeakMap();

function customKey(c) {
  if (!c) return '';
  let k = customKeys.get(c);
  if (!k) {
    let h = 5381;
    const s = JSON.stringify(c.contours);
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    k = `${s.length}:${h}:${c.fill || 'nonzero'}`;
    customKeys.set(c, k);
  }
  return k;
}

function transformPts(pts, mirror, rot) {
  const a = (rot * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => {
    if (mirror) x = -x;
    return rot ? [x * c - y * s, x * s + y * c] : [x, y];
  });
}

/** Construye (con cache) los poligonos normalizados de un elemento en coordenadas locales. */
export function buildElement(el, ctx) {
  let key;
  if (el.type === 'text') {
    key = ['t', el.content, el.fontId, +el.height, +el.spacing, +el.curvature, +el.rotation, el.mirror ? 1 : 0].join('|');
  } else {
    key = ['o', el.ornamentId, customKey(el.custom), +el.width, +el.rotation, el.mirror ? 1 : 0].join('|');
  }
  const hit = cache.get(key);
  if (hit && (el.type !== 'text' || hit.fontRef === (Object.prototype.hasOwnProperty.call(ctx.fonts, el.fontId) ? ctx.fonts[el.fontId] : undefined))) return hit;

  let raw = [];
  let fill = 'nonzero';
  let baseline = [];
  let missing = [];
  let fontRef;
  let fontMissing = false;
  if (el.type === 'text') {
    const font = Object.prototype.hasOwnProperty.call(ctx.fonts, el.fontId) ? ctx.fonts[el.fontId] : undefined;
    fontRef = font;
    if (!font) fontMissing = true;
    else {
      const r = buildTextContours(font, el);
      raw = r.contours;
      baseline = r.baseline;
      missing = missingChars(font, el.content || '');
    }
  } else {
    const o = el.custom || findOrnament(el.ornamentId);
    if (o && o.contours.length) {
      const b = clip.bbox(o.contours);
      const side = Math.max(b.w, b.h);
      const k = side > 0 ? Math.max(el.width, 0.1) / side : 1;
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      raw = o.contours.map((c) => c.map(([x, y]) => [(x - cx) * k, (y - cy) * k]));
      fill = o.fill || 'nonzero';
    }
  }
  const mir = !!el.mirror, rot = +el.rotation || 0;
  const polys = clip.normalize(raw.map((c) => transformPts(c, mir, rot)), fill);
  const res = {
    polys,
    baseline: transformPts(baseline, mir, rot),
    missing,
    fontMissing,
    fontRef,
    bbox: clip.bbox(polys),
  };
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, res);
  return res;
}

function processRegion(region, s) {
  let r = s.connectDots ? connectSmallIslands(region, Math.max(s.minWidth, 1.2)) : region;
  if (s.joinNear && s.joinDist > 0) r = joinNearIslands(r, { maxDist: s.joinDist, width: s.bridgeWidth });
  r = clip.closing(r, s.close);
  if (s.reinforce > 0) r = clip.offset(r, s.reinforce);
  return clip.removeSmallHoles(clip.toExPolys(r), s.minHole);
}

function trianglesOf(exs) {
  let t = 0;
  for (const e of exs) {
    let n = e.outer.length;
    for (const h of e.holes) n += h.length;
    t += 2 * (n + 2 * e.holes.length - 2) + 2 * n;
  }
  return t;
}

/**
 * Calcula todo el resultado de un proyecto.
 * ctx = { fonts: { [fontId]: opentype.Font } }
 */
export function computeTopper(projectIn, ctx, opts = {}) {
  const project = normalizeProject(projectIn);
  const s = project.settings;
  const warnings = [];
  const elements = [];
  const world = [];
  let baselineY = Infinity;
  let lowSpan = null;

  for (const el of project.elements) {
    const b = buildElement(el, ctx);
    const polys = clip.translate(b.polys, el.x, el.y);
    world.push(polys);
    let bb = b.bbox ? { ...b.bbox } : null;
    if (bb) {
      bb.minX += el.x; bb.maxX += el.x; bb.minY += el.y; bb.maxY += el.y;
    } else {
      bb = { minX: el.x - 5, maxX: el.x + 5, minY: el.y - 5, maxY: el.y + 5, w: 10, h: 10 };
    }
    elements.push({ id: el.id, bbox: bb, missing: b.missing, fontMissing: b.fontMissing, empty: !b.bbox });
    for (const p of b.baseline) {
      if (p[1] + el.y < baselineY) {
        baselineY = p[1] + el.y;
        lowSpan = b.bbox ? { minX: b.bbox.minX + el.x, maxX: b.bbox.maxX + el.x } : null;
      }
    }
    if (b.missing.length) {
      warnings.push(`El tipo de letra no incluye ${b.missing.length > 1 ? 'los caracteres' : 'el caracter'} ${b.missing.map((c) => `"${c}"`).join(' ')}.`);
    }
  }

  const elemU = clip.union(...world);
  const bbox = clip.bbox(elemU);
  const empty = {
    elements, warnings, empty: true, parts: [], main: [], thin: [], thinCount: 0, islands: 0,
    islandsEx: [], elemBBox: null, bbox: null, size: { w: 0, h: 0, z: 0 },
    volume: 0, grams: 0, meters: 0, triangles: 0, base: { bar: [], stakes: [], barBox: null },
  };
  if (!bbox) return empty;
  if (!isFinite(baselineY)) baselineY = bbox.minY;

  const base = buildBase(bbox, baselineY, s, { ink: elemU, lineSpan: lowSpan || { minX: bbox.minX, maxX: bbox.maxX } });
  const parts = [];
  let main, analysisRegion;
  if (s.style === 'silhouette') {
    const reliefEx = processRegion(elemU, s);
    const reliefR = clip.exToPaths(reliefEx);
    const sil = clip.offset(clip.union(reliefR, base.bar), s.silhouette.margin);
    const fondoEx = processRegion(clip.union(sil, base.stakes), s);
    parts.push({ name: 'fondo', ex: fondoEx, z0: 0, z1: s.silhouette.baseHeight });
    parts.push({
      name: 'relieve', ex: reliefEx,
      z0: s.silhouette.baseHeight, z1: s.silhouette.baseHeight + s.silhouette.reliefHeight,
    });
    main = fondoEx;
    analysisRegion = reliefR;
  } else {
    const ex = processRegion(clip.union(elemU, base.bar, base.stakes), s);
    parts.push({ name: 'pieza', ex, z0: 0, z1: s.thickness });
    main = ex;
    analysisRegion = clip.exToPaths(ex);
  }

  const islands = main.length;
  if (islands > 1) {
    warnings.push(
      s.bar.enabled
        ? `Hay ${islands} piezas separadas. Conecta los elementos entre sí o con la barra, o aumenta "Unir separaciones".`
        : `Hay ${islands} piezas separadas. Acerca las letras (espaciado negativo), sube "Distancia máxima" en Unir piezas cercanas, activa la barra o usa el estilo con silueta de fondo.`,
    );
  }

  // zonas finas
  let thinEx = [];
  if (s.minWidth > 0 && !opts.skipThin) {
    const opened = clip.opening(analysisRegion, s.minWidth / 2);
    let thin = clip.diff(analysisRegion, opened);
    if (base.stakes.length) thin = clip.diff(thin, clip.offset(base.stakes, 0.1));
    thinEx = clip.toExPolys(thin).filter((e) => clip.exArea(e) >= 0.2);
  }

  let volume = 0;
  let triangles = 0;
  let zmax = 0;
  for (const p of parts) {
    for (const e of p.ex) volume += clip.exArea(e) * (p.z1 - p.z0);
    triangles += trianglesOf(p.ex);
    zmax = Math.max(zmax, p.z1);
  }
  const fb = clip.bbox(main.map((e) => e.outer));
  return {
    elements,
    warnings,
    empty: false,
    parts,
    main,
    islands,
    islandsEx: main,
    thin: thinEx,
    thinCount: thinEx.length,
    elemBBox: bbox,
    bbox: fb,
    size: { w: fb.w, h: fb.h, z: zmax },
    volume,
    grams: (volume / 1000) * PLA_DENSITY,
    meters: volume / FILAMENT_AREA / 1000,
    triangles,
    base,
    baselineY,
  };
}

/** Escala los elementos para que el ancho final coincida con el objetivo. Devuelve un proyecto nuevo. */
export function fitTotalWidth(projectIn, target, ctx) {
  const p = cloneProject(normalizeProject(projectIn));
  if (!(target > 0)) return p;
  for (let i = 0; i < 6; i++) {
    const r = computeTopper(p, ctx);
    if (r.empty) break;
    const fixed = r.size.w - r.elemBBox.w;
    const elemTarget = target - fixed;
    if (elemTarget <= 1) break;
    const f = elemTarget / r.elemBBox.w;
    if (Math.abs(r.size.w - target) < 0.02) break;
    scaleElements(p, f);
  }
  return p;
}
