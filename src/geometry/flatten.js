// Aplanado de curvas de Bezier con tolerancia en las unidades del contorno.
export const FLATNESS = 0.05;

function mid(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function flattenCubic(out, p0, p1, p2, p3, tol = FLATNESS, depth = 0) {
  const dx = p3[0] - p0[0], dy = p3[1] - p0[1];
  const len = Math.hypot(dx, dy);
  let d1, d2;
  if (len < 1e-12) {
    d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    d2 = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
  } else {
    d1 = Math.abs((p1[0] - p0[0]) * dy - (p1[1] - p0[1]) * dx) / len;
    d2 = Math.abs((p2[0] - p0[0]) * dy - (p2[1] - p0[1]) * dx) / len;
  }
  if (depth > 14 || Math.max(d1, d2) <= tol) {
    out.push(p3);
    return;
  }
  const m01 = mid(p0, p1), m12 = mid(p1, p2), m23 = mid(p2, p3);
  const m012 = mid(m01, m12), m123 = mid(m12, m23);
  const m = mid(m012, m123);
  flattenCubic(out, p0, m01, m012, m, tol, depth + 1);
  flattenCubic(out, m, m123, m23, p3, tol, depth + 1);
}

export function flattenQuad(out, p0, p1, p2, tol = FLATNESS) {
  const c1 = [p0[0] + (2 / 3) * (p1[0] - p0[0]), p0[1] + (2 / 3) * (p1[1] - p0[1])];
  const c2 = [p2[0] + (2 / 3) * (p1[0] - p2[0]), p2[1] + (2 / 3) * (p1[1] - p2[1])];
  flattenCubic(out, p0, c1, c2, p2, tol);
}

/** Circunferencia como poligono antihorario. */
export function circle(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export function ellipse(cx, cy, rx, ry, rot = 0, n = 40) {
  const pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

export function roundedRect(x0, y0, x1, y1, r, seg = 8) {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r < 1e-6) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  return pts;
}
