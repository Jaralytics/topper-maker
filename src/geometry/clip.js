// Envoltorio de Clipper (escala x1000). Una "region" es un arreglo de poligonos en mm,
// cada poligono un arreglo de [x, y]. La orientacion codifica huecos (relleno nonzero).
import ClipperLib from 'clipper-lib';

export let SCALE = 1000;
let ARC_TOL = 20; // 0.02 mm en unidades escaladas

/** Ejecuta fn con otra precision (p. ej. para generar adornos en coordenadas unitarias). */
export function withPrecision(scale, arcTol, fn) {
  const s0 = SCALE, a0 = ARC_TOL;
  SCALE = scale;
  ARC_TOL = arcTol;
  try {
    return fn();
  } finally {
    SCALE = s0;
    ARC_TOL = a0;
  }
}

export function toC(paths) {
  const out = [];
  for (const p of paths) {
    if (p.length < 3) continue;
    const q = new Array(p.length);
    for (let i = 0; i < p.length; i++) q[i] = { X: Math.round(p[i][0] * SCALE), Y: Math.round(p[i][1] * SCALE) };
    out.push(q);
  }
  return out;
}

export function fromC(paths) {
  const out = [];
  for (const p of paths) {
    if (p.length < 3) continue;
    out.push(p.map((pt) => [pt.X / SCALE, pt.Y / SCALE]));
  }
  return out;
}

const fillType = (f) => (f === 'evenodd' ? ClipperLib.PolyFillType.pftEvenOdd : ClipperLib.PolyFillType.pftNonZero);

function run(clipType, subj, clip, fill = 'nonzero', clipFill = 'nonzero', tree = false) {
  const c = new ClipperLib.Clipper();
  c.StrictlySimple = true;
  if (subj.length) c.AddPaths(toC(subj), ClipperLib.PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(toC(clip), ClipperLib.PolyType.ptClip, true);
  const sol = tree ? new ClipperLib.PolyTree() : new ClipperLib.Paths();
  c.Execute(clipType, sol, fillType(fill), fillType(clipFill));
  return sol;
}

/** Normaliza (union consigo mismo) usando la regla de relleno indicada. */
export function normalize(paths, fill = 'nonzero') {
  if (!paths.length) return [];
  return fromC(run(ClipperLib.ClipType.ctUnion, paths, null, fill, fill));
}

export function union(...regions) {
  const all = [];
  for (const r of regions) for (const p of r) all.push(p);
  return normalize(all, 'nonzero');
}

export function diff(a, b) {
  if (!a.length) return [];
  if (!b.length) return normalize(a);
  return fromC(run(ClipperLib.ClipType.ctDifference, a, b));
}

export function intersect(a, b) {
  if (!a.length || !b.length) return [];
  return fromC(run(ClipperLib.ClipType.ctIntersection, a, b));
}

export function offset(paths, delta) {
  if (!paths.length) return [];
  if (delta === 0) return normalize(paths);
  const co = new ClipperLib.ClipperOffset(2, ARC_TOL);
  co.AddPaths(toC(paths), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const sol = new ClipperLib.Paths();
  co.Execute(sol, delta * SCALE);
  return fromC(sol);
}

/** Buffer de polilineas abiertas con extremos redondos. */
export function offsetOpen(lines, delta) {
  const co = new ClipperLib.ClipperOffset(2, ARC_TOL);
  const cl = lines.map((l) => l.map((p) => ({ X: Math.round(p[0] * SCALE), Y: Math.round(p[1] * SCALE) })));
  co.AddPaths(cl, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  const sol = new ClipperLib.Paths();
  co.Execute(sol, delta * SCALE);
  return normalize(fromC(sol));
}

/** Cierre morfologico (+g, -g) para fusionar separaciones menores a 2g. */
export function closing(paths, g) {
  if (!(g > 0) || !paths.length) return paths;
  return offset(offset(paths, g), -g);
}

export function opening(paths, r) {
  if (!(r > 0) || !paths.length) return paths;
  return offset(offset(paths, -r), r);
}

/** Region -> ExPolygons [{outer, holes}]. */
export function toExPolys(paths) {
  if (!paths.length) return [];
  const tree = run(ClipperLib.ClipType.ctUnion, paths, null, 'nonzero', 'nonzero', true);
  const res = [];
  const toPts = (n) => n.Contour().map((pt) => [pt.X / SCALE, pt.Y / SCALE]);
  const walk = (node) => {
    const ex = { outer: toPts(node), holes: [] };
    for (const ch of node.Childs()) {
      ex.holes.push(toPts(ch));
      for (const g of ch.Childs()) walk(g);
    }
    res.push(ex);
  };
  for (const n of tree.Childs()) walk(n);
  return res.filter((e) => e.outer.length >= 3);
}

export function exToPaths(exs) {
  const out = [];
  for (const e of exs) {
    out.push(e.outer);
    for (const h of e.holes) out.push(h);
  }
  return out;
}

/** Area con signo en mm2 (positivo = antihorario). */
export function area(path) {
  let a = 0;
  for (let i = 0, n = path.length; i < n; i++) {
    const p = path[i], q = path[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function exArea(ex) {
  let a = Math.abs(area(ex.outer));
  for (const h of ex.holes) a -= Math.abs(area(h));
  return a;
}

export function removeSmallHoles(exs, minArea) {
  if (!(minArea > 0)) return exs;
  return exs.map((e) => ({ outer: e.outer, holes: e.holes.filter((h) => Math.abs(area(h)) >= minArea) }));
}

export function translate(paths, dx, dy) {
  return paths.map((p) => p.map((q) => [q[0] + dx, q[1] + dy]));
}

export function bbox(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (const q of p) {
      if (q[0] < minX) minX = q[0];
      if (q[0] > maxX) maxX = q[0];
      if (q[1] < minY) minY = q[1];
      if (q[1] > maxY) maxY = q[1];
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Subdivide aristas para que ninguna supere maxLen (mm). */
export function resample(path, maxLen) {
  const out = [];
  for (let i = 0, n = path.length; i < n; i++) {
    const a = path[i], b = path[(i + 1) % n];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.ceil(d / maxLen));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return out;
}

/** Ajusta contornos a una caja unitaria (lado mayor = 1) centrada en el origen. */
export function fitUnitBox(contours) {
  const b = bbox(contours);
  if (!b) return { contours: [], aspect: 1 };
  const s = 1 / Math.max(b.w, b.h, 1e-9);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const out = contours.map((c) => c.map(([x, y]) => [round4((x - cx) * s), round4((y - cy) * s)]));
  return { contours: out, aspect: b.h / b.w };
}

const round4 = (v) => Math.round(v * 10000) / 10000;

