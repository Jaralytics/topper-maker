// Parser puro de atributos "d" de SVG (M L H V C S Q T A Z, absolutos y relativos).
// parsePath devuelve subtrazados aplanados [{ pts, closed }] en coordenadas SVG (y hacia abajo).
import { flattenCubic, flattenQuad } from './flatten.js';

function tokenize(d) {
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
  const toks = [];
  let m;
  while ((m = re.exec(d))) toks.push(m[1] ? m[1] : parseFloat(m[2]));
  return toks;
}

function arcTo(out, x1, y1, rx, ry, phiDeg, fa, fs, x2, y2, tol) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) {
    out.push([x2, y2]);
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s;
    ry *= s;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
  if (fa === fs) co = -co;
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2;
  const cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI;
  else if (fs && dth < 0) dth += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2)));
  const step = dth / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (x, y) => [cp * rx * x - sp * ry * y + cx, sp * rx * x + cp * ry * y + cy];
  let a0 = th1;
  let p0 = [x1, y1];
  for (let i = 0; i < segs; i++) {
    const a1 = a0 + step;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const q1 = pt(c0 - k * s0, s0 + k * c0);
    const q2 = pt(c1 + k * s1, s1 - k * c1);
    const p3 = i === segs - 1 ? [x2, y2] : pt(c1, s1);
    flattenCubic(out, p0, q1, q2, p3, tol);
    p0 = p3;
    a0 = a1;
  }
}

export function parsePath(d, tol = 0.05) {
  const t = tokenize(d);
  const subs = [];
  let i = 0;
  let cur = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  let lastCtrl = null;
  const num = () => t[i++];
  const start = (px, py) => {
    cur = { pts: [[px, py]], closed: false };
    subs.push(cur);
  };
  let cmd = '';
  while (i < t.length) {
    if (typeof t[i] === 'string') cmd = t[i++];
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    else if (cmd === '') { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      if (cur) cur.closed = true;
      x = sx;
      y = sy;
      cur = null;
      lastCtrl = null;
      continue;
    }
    if (!cur && C !== 'M') start(x, y);
    if (C === 'M') {
      let nx = num(), ny = num();
      if (rel) { nx += x; ny += y; }
      x = sx = nx;
      y = sy = ny;
      start(x, y);
      lastCtrl = null;
    } else if (C === 'L') {
      let nx = num(), ny = num();
      if (rel) { nx += x; ny += y; }
      x = nx;
      y = ny;
      cur.pts.push([x, y]);
      lastCtrl = null;
    } else if (C === 'H') {
      let nx = num();
      if (rel) nx += x;
      x = nx;
      cur.pts.push([x, y]);
      lastCtrl = null;
    } else if (C === 'V') {
      let ny = num();
      if (rel) ny += y;
      y = ny;
      cur.pts.push([x, y]);
      lastCtrl = null;
    } else if (C === 'C' || C === 'S') {
      let x1, y1;
      if (C === 'C') {
        x1 = num(); y1 = num();
        if (rel) { x1 += x; y1 += y; }
      } else if (lastCtrl && lastCtrl.type === 'C') {
        x1 = 2 * x - lastCtrl.x;
        y1 = 2 * y - lastCtrl.y;
      } else { x1 = x; y1 = y; }
      let x2 = num(), y2 = num(), nx = num(), ny = num();
      if (rel) { x2 += x; y2 += y; nx += x; ny += y; }
      flattenCubic(cur.pts, [x, y], [x1, y1], [x2, y2], [nx, ny], tol);
      lastCtrl = { type: 'C', x: x2, y: y2 };
      x = nx;
      y = ny;
    } else if (C === 'Q' || C === 'T') {
      let x1, y1;
      if (C === 'Q') {
        x1 = num(); y1 = num();
        if (rel) { x1 += x; y1 += y; }
      } else if (lastCtrl && lastCtrl.type === 'Q') {
        x1 = 2 * x - lastCtrl.x;
        y1 = 2 * y - lastCtrl.y;
      } else { x1 = x; y1 = y; }
      let nx = num(), ny = num();
      if (rel) { nx += x; ny += y; }
      flattenQuad(cur.pts, [x, y], [x1, y1], [nx, ny], tol);
      lastCtrl = { type: 'Q', x: x1, y: y1 };
      x = nx;
      y = ny;
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num();
      const fa = num() ? 1 : 0, fs = num() ? 1 : 0;
      let nx = num(), ny = num();
      if (rel) { nx += x; ny += y; }
      arcTo(cur.pts, x, y, rx, ry, rot, fa, fs, nx, ny, tol);
      x = nx;
      y = ny;
      lastCtrl = null;
    } else {
      i++;
    }
  }
  return subs;
}

/** Subtrazados -> poligonos con y hacia arriba (se invierte el eje y de SVG). */
export function pathToPolygons(d, tol = 0.05) {
  const out = [];
  for (const s of parsePath(d, tol)) {
    let pts = s.pts.map(([px, py]) => [px, -py]);
    if (pts.length > 1) {
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) pts = pts.slice(0, -1);
    }
    if (pts.length >= 3) out.push(pts);
  }
  return out;
}
