// Conecta islas pequenas (puntos de la i, tildes) con un puente fino hacia la pieza mas cercana. Sin DOM.
import * as clip from './clip.js';

function distPointSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = a[0] + t * dx, qy = a[1] + t * dy;
  return { d: Math.hypot(px - qx, py - qy), q: [qx, qy] };
}

function inside(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

function ringBox(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY };
}

const overlaps = (a, b, m) => a.minX - m <= b.maxX && a.maxX + m >= b.minX && a.minY - m <= b.maxY && a.maxY + m >= b.minY;

/**
 * region: poligonos en mm. Devuelve la region con puentes de ancho `width` entre cada isla
 * de area < maxArea y el anillo mas cercano (a menos de maxDist mm). Una isla dentro de un hueco
 * solo se une a las paredes de ese hueco.
 */
export function connectSmallIslands(region, width, { maxArea = 60, maxDist = 8 } = {}) {
  let cur = region;
  for (let pass = 0; pass < 3; pass++) {
    const islands = clip.toExPolys(cur);
    if (islands.length < 2) break;
    const infos = islands.map((e) => ({
      e,
      area: clip.exArea(e),
      box: ringBox(e.outer),
      holes: e.holes.map((h) => ({ ring: h, box: ringBox(h) })),
    }));
    if (!infos.some((i) => i.area < maxArea)) break;
    const bridges = [];
    for (let i = 0; i < infos.length; i++) {
      const me = infos[i];
      if (me.area >= maxArea) continue;
      const probe = me.e.outer[0];
      // anillos candidatos
      let targets = [];
      let contained = false;
      for (let j = 0; j < infos.length; j++) {
        if (j === i) continue;
        const o = infos[j];
        if (!overlaps(o.box, me.box, 0)) continue;
        for (const h of o.holes) {
          if (overlaps(h.box, me.box, 0) && inside(probe, h.ring)) {
            if (!contained) targets = [];
            contained = true;
            targets.push({ ring: h.ring, box: h.box });
          }
        }
      }
      if (!contained) {
        for (let j = 0; j < infos.length; j++) {
          if (j === i) continue;
          const o = infos[j];
          if (overlaps(o.box, me.box, maxDist)) targets.push({ ring: o.e.outer, box: o.box });
        }
      }
      // aristas cercanas a la isla (poda por caja)
      const edges = [];
      for (const t of targets) {
        if (!overlaps(t.box, me.box, maxDist)) continue;
        const r = t.ring;
        for (let k = 0, n = r.length; k < n; k++) {
          const a = r[k], b = r[(k + 1) % n];
          const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
          const lo2 = Math.min(a[1], b[1]), hi2 = Math.max(a[1], b[1]);
          if (hi < me.box.minX - maxDist || lo > me.box.maxX + maxDist || hi2 < me.box.minY - maxDist || lo2 > me.box.maxY + maxDist) continue;
          edges.push(a, b);
        }
      }
      if (!edges.length) continue;
      const ring = me.e.outer;
      const stride = Math.max(1, Math.floor(ring.length / 120));
      let best = null;
      for (let vi = 0; vi < ring.length; vi += stride) {
        const v = ring[vi];
        for (let k = 0; k < edges.length; k += 2) {
          const r = distPointSeg(v[0], v[1], edges[k], edges[k + 1]);
          if (!best || r.d < best.d) best = { d: r.d, a: v, b: r.q };
        }
      }
      if (best && best.d <= maxDist && best.d > 0) bridges.push([best.a, best.b]);
    }
    if (!bridges.length) break;
    const lines = bridges.map(([a, b]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      const e = 0.3;
      return [[a[0] - (dx / l) * e, a[1] - (dy / l) * e], [b[0] + (dx / l) * e, b[1] + (dy / l) * e]];
    });
    cur = clip.union(cur, clip.offsetOpen(lines, width / 2));
  }
  return cur;
}

/** Distancia minima entre dos anillos y el par de puntos mas cercano (poda por cajas). */
function ringGap(A, boxA, B, boxB, maxDist) {
  let best = null;
  const run = (P, boxP, Q, boxQ) => {
    const edges = [];
    for (let k = 0, n = Q.length; k < n; k++) {
      const a = Q[k], b = Q[(k + 1) % n];
      if (Math.max(a[0], b[0]) < boxP.minX - maxDist || Math.min(a[0], b[0]) > boxP.maxX + maxDist) continue;
      if (Math.max(a[1], b[1]) < boxP.minY - maxDist || Math.min(a[1], b[1]) > boxP.maxY + maxDist) continue;
      edges.push(a, b);
    }
    if (!edges.length) return;
    for (const v of P) {
      if (v[0] < boxQ.minX - maxDist || v[0] > boxQ.maxX + maxDist || v[1] < boxQ.minY - maxDist || v[1] > boxQ.maxY + maxDist) continue;
      for (let k = 0; k < edges.length; k += 2) {
        const r = distPointSeg(v[0], v[1], edges[k], edges[k + 1]);
        if (!best || r.d < best.d) best = { d: r.d, a: v, b: r.q };
      }
    }
  };
  run(A, boxA, B, boxB);
  run(B, boxB, A, boxA);
  return best;
}

/**
 * Une piezas cercanas con el minimo de puentes (arbol de expansion minima). Un puente va por el
 * segmento mas corto entre los bordes, con ancho `width` y extremos redondos. Una isla dentro de un
 * hueco solo se une a la pared de ese hueco. Se repite hasta que no hay cambios.
 */
export function joinNearIslands(region, { maxDist = 2.5, width = 1.6 } = {}) {
  let cur = region;
  for (let pass = 0; pass < 4; pass++) {
    const islands = clip.toExPolys(cur);
    const n = islands.length;
    if (n < 2) break;
    const infos = islands.map((e) => ({ e, box: ringBox(e.outer), holes: e.holes.map((h) => ({ ring: h, box: ringBox(h) })) }));
    const holeOf = (i, j) => {
      // anillo de hueco de j que contiene a i (o null)
      for (const h of infos[j].holes) if (overlaps(h.box, infos[i].box, 0) && inside(infos[i].e.outer[0], h.ring)) return h;
      return null;
    };
    const cand = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ra = { ring: infos[i].e.outer, box: infos[i].box };
        let rb = { ring: infos[j].e.outer, box: infos[j].box };
        const hj = overlaps(infos[j].box, infos[i].box, 0) ? holeOf(i, j) : null;
        const hi = !hj && overlaps(infos[j].box, infos[i].box, 0) ? holeOf(j, i) : null;
        if (hj) rb = hj;
        else if (hi) ra = hi;
        else if (!overlaps(ra.box, rb.box, maxDist)) continue;
        const g = ringGap(ra.ring, ra.box, rb.ring, rb.box, maxDist);
        if (g && g.d <= maxDist && g.d > 0) cand.push({ i, j, ...g });
      }
    }
    if (!cand.length) break;
    cand.sort((a, b) => a.d - b.d);
    const parent = infos.map((_, k) => k);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const lines = [];
    for (const c of cand) {
      const ri = find(c.i), rj = find(c.j);
      if (ri === rj) continue;
      parent[ri] = rj;
      const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1];
      const l = Math.hypot(dx, dy) || 1;
      const e = 0.3;
      lines.push([[c.a[0] - (dx / l) * e, c.a[1] - (dy / l) * e], [c.b[0] + (dx / l) * e, c.b[1] + (dy / l) * e]]);
    }
    if (!lines.length) break;
    cur = clip.union(cur, clip.offsetOpen(lines, width / 2));
  }
  return cur;
}
