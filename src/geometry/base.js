// Barra base y estacas. Todo en mm, y hacia arriba. Sin DOM.
import * as clip from './clip.js';
import { roundedRect } from './flatten.js';

export const STAKE_FRACTIONS = {
  1: [0.5],
  2: [0.25, 0.75],
  3: [0.2, 0.5, 0.8],
  4: [0.15, 0.38, 0.62, 0.85],
};

/** Fracciones de las estacas; spread=50 reproduce la tabla original. */
export function stakeFractions(n, spread = 50) {
  const k = (spread || 50) / 50;
  return STAKE_FRACTIONS[n].map((f) => 0.5 + (f - 0.5) * k);
}

const STEP = 0.25;

/**
 * Elige el centro x de cada estaca sobre la tinta del renglon mas bajo.
 * ink: region de los elementos. Devuelve arreglo de x.
 */
function anchorStakes(ink, span, baselineY, depth, w, fractions) {
  const targets = fractions.map((f) => span.minX + (span.maxX - span.minX) * f);
  const band = clip.intersect(ink, [[
    [span.minX - w, baselineY], [span.maxX + w, baselineY], [span.maxX + w, baselineY + depth], [span.minX - w, baselineY + depth],
  ]]);
  if (!band.length) return targets;
  // aristas de la banda (sin horizontales)
  const edges = [];
  for (const p of band) {
    for (let i = 0, n = p.length; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      if (a[0] !== b[0]) edges.push(a[0] < b[0] ? [a, b] : [b, a]);
    }
  }
  const memo = new Map();
  const cov = (ix) => {
    let c = memo.get(ix);
    if (c !== undefined) return c;
    const x = ix * STEP;
    const ys = [];
    for (const [a, b] of edges) {
      if (x >= a[0] && x < b[0]) ys.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
    ys.sort((u, v) => u - v);
    c = 0;
    for (let i = 0; i + 1 < ys.length; i += 2) c += Math.min(ys[i + 1], baselineY + depth) - Math.max(ys[i], baselineY);
    c = Math.max(0, c) / depth;
    memo.set(ix, c);
    return c;
  };
  const gap = fractions.length > 1 ? (span.maxX - span.minX) * (fractions[1] - fractions[0]) : (span.maxX - span.minX) / 2;
  const radius = Math.max(gap / 2, 1);
  const half = Math.round(w / 2 / STEP);
  return targets.map((t) => {
    let best = null;
    const c0 = Math.round(t / STEP);
    const rs = Math.round(radius / STEP);
    for (let d = -rs; d <= rs; d += 2) {
      const ix = c0 + d;
      let sum = 0, min = 1;
      for (let j = -half; j <= half; j++) {
        const c = cov(ix + j);
        sum += c;
        if (c < min) min = c;
      }
      const mean = sum / (2 * half + 1);
      const score = mean + 2 * min - (0.3 * Math.abs(d * STEP)) / radius;
      if (mean > 0.02 && (!best || score > best.score)) best = { score, x: ix * STEP };
    }
    return best ? best.x : t;
  });
}

/**
 * bbox: caja de la union de elementos. baselineY: linea base mas baja de los textos
 * (o minY si no hay texto). opts: { ink, lineSpan } para el anclaje sin barra.
 * Devuelve regiones { bar, stakes, barBox, stakeTop }.
 */
export function buildBase(bbox, baselineY, s, opts = {}) {
  const bar = [];
  const stakes = [];
  let barBox = null;
  let spanMin = bbox.minX, spanMax = bbox.maxX;
  let stakeTop = baselineY + 1;
  if (s.bar.enabled) {
    const top = baselineY + 1.5 + (s.bar.offset || 0);
    const bottom = top - s.bar.height;
    spanMin = bbox.minX - s.bar.margin;
    spanMax = bbox.maxX + s.bar.margin;
    bar.push(roundedRect(spanMin, bottom, spanMax, top, s.bar.radius));
    barBox = { minX: spanMin, maxX: spanMax, minY: bottom, maxY: top };
    stakeTop = bottom + 1;
  } else {
    stakeTop = baselineY + (s.stakes.anchor || 3);
    if (opts.lineSpan) {
      spanMin = opts.lineSpan.minX;
      spanMax = opts.lineSpan.maxX;
    }
  }
  const n = Math.max(0, Math.min(4, Math.round(s.stakes.count)));
  if (n > 0) {
    const w = s.stakes.width;
    const len = Math.max(s.stakes.length, 1);
    const tip = Math.min(Math.max(s.stakes.tip, 0), len);
    const fr = stakeFractions(n, s.stakes.spread);
    let xs;
    if (!s.bar.enabled && opts.ink && opts.ink.length) {
      xs = anchorStakes(opts.ink, { minX: spanMin, maxX: spanMax }, baselineY, stakeTop - baselineY, w, fr);
    } else {
      xs = fr.map((f) => {
        let cx = spanMin + (spanMax - spanMin) * f;
        if (spanMax - spanMin > w) cx = Math.min(Math.max(cx, spanMin + w / 2), spanMax - w / 2);
        return cx;
      });
    }
    for (const cx of xs) {
      const bodyBottom = stakeTop - (len - tip);
      const pts = [
        [cx - w / 2, stakeTop],
        [cx - w / 2, bodyBottom],
      ];
      if (tip > 0) pts.push([cx, stakeTop - len]);
      pts.push([cx + w / 2, bodyBottom], [cx + w / 2, stakeTop]);
      stakes.push(pts);
    }
  }
  return { bar, stakes, barBox, stakeTop };
}
