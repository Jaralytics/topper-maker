// Adornos: generadores parametricos originales + iconos curados (ornaments-data.js).
// Todos se almacenan como contornos normalizados: lado mayor = 1, centrados en el origen, y hacia arriba.
import * as clip from './clip.js';
import { PHOSPHOR } from './ornaments-data.js';
const { fitUnitBox } = clip;
import { circle, ellipse, roundedRect } from './flatten.js';

function ring(cx, cy, ro, ri, n = 64) {
  return [circle(cx, cy, ro, n), circle(cx, cy, ri, n).reverse()];
}

function rounded(region, r) {
  return clip.offset(clip.offset(region, -r), r);
}

function bezierQuad(p0, p1, p2, n = 12) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return out;
}

const GENERATORS = {
  corazon() {
    const pts = [];
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      pts.push([16 * Math.pow(Math.sin(t), 3), 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
    }
    return [pts];
  },
  estrella() {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 1 : 0.42;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return rounded([pts], 0.025);
  },
  destello() {
    const c = 0.09;
    const pts = [
      ...bezierQuad([0, 1], [c, c], [1, 0]),
      ...bezierQuad([1, 0], [c, -c], [0, -1]),
      ...bezierQuad([0, -1], [-c, -c], [-1, 0]),
      ...bezierQuad([-1, 0], [-c, c], [0, 1]),
    ];
    return rounded([pts], 0.015);
  },
  aro() {
    return ring(0, 0, 1, 0.8);
  },
  anillos() {
    const d = 0.3, rm = 0.55, w = 0.15;
    const A = ring(-d, 0, rm + w / 2, rm - w / 2);
    const B = ring(d, 0, rm + w / 2, rm - w / 2);
    const y = Math.sqrt(rm * rm - d * d);
    const gap = w / 2 + 0.07;
    const a = clip.diff(A, [circle(0, -y, gap, 24)]);
    const b = clip.diff(B, [circle(0, y, gap, 24)]);
    return clip.union(a, b);
  },
  marcoCircular() {
    return ring(0, 0, 1, 0.92, 96);
  },
  marcoOvalado() {
    return [ellipse(0, 0, 1, 0.72, 0, 96), ellipse(0, 0, 0.92, 0.64, 0, 96).reverse()];
  },
  floritura() {
    const spiral = (cx, cy, sign) => {
      const pts = [];
      const N = 90;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const phi = -Math.PI / 2 + s * 4 * Math.PI;
        const r = 0.03 + 0.27 * s;
        pts.push([cx + sign * r * Math.cos(phi), cy + r * Math.sin(phi)]);
      }
      return pts;
    };
    // espiral izquierda (antihoraria) termina en la parte baja yendo a la derecha
    const left = spiral(-0.8, 0.3, 1);
    const right = spiral(0.8, 0.3, -1).reverse();
    const a = left[left.length - 1], b = right[0];
    const mid = [];
    for (let i = 1; i < 20; i++) {
      const t = i / 20;
      mid.push([a[0] + (b[0] - a[0]) * t, a[1] + 0.05 * Math.sin(t * Math.PI * 2)]);
    }
    return clip.offsetOpen([[...left, ...mid, ...right]], 0.022);
  },
  laurel() {
    const stem = [];
    const f = (u) => [u, -0.22 * (1 - u * u)];
    for (let i = 0; i <= 40; i++) stem.push(f(-1 + (i / 40) * 2));
    let region = clip.offsetOpen([stem], 0.014);
    const leaves = [];
    const pairs = 8;
    for (let k = 0; k < pairs; k++) {
      const u = -0.88 + (k / (pairs - 1)) * 1.62;
      const p = f(u);
      const q = f(u + 0.01);
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const len = 0.17 - k * 0.004;
      for (const side of [1, -1]) {
        const la = ang + side * 0.75;
        const cx = p[0] + Math.cos(la) * len * 0.9;
        const cy = p[1] + Math.sin(la) * len * 0.9;
        leaves.push(ellipse(cx, cy, len, len * 0.38, la, 28));
      }
    }
    const tip = f(1);
    leaves.push(ellipse(tip[0] + 0.1, tip[1] + 0.02, 0.17, 0.065, 0.3, 28));
    region = clip.union(region, leaves);
    return region;
  },
  flor() {
    const petals = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      petals.push(circle(0.3 * Math.cos(a), 0.3 * Math.sin(a), 0.22, 36));
    }
    const u = clip.union(petals, [circle(0, 0, 0.18, 32)]);
    return clip.diff(u, [circle(0, 0, 0.09, 24)]);
  },
  luna() {
    return clip.diff([circle(0, 0, 1, 96)], [circle(0.42, 0.1, 0.82, 96)]);
  },
  nube() {
    const circles = [
      circle(-0.5, -0.08, 0.3, 40),
      circle(-0.16, 0.14, 0.38, 40),
      circle(0.3, 0.1, 0.33, 40),
      circle(0.62, -0.1, 0.26, 40),
    ];
    const base = roundedRect(-0.62, -0.36, 0.78, -0.05, 0.15, 8);
    return clip.union(circles, [base]);
  },
  birrete() {
    const board = [[-1, 0.1], [0, 0.5], [1, 0.1], [0, -0.3]];
    const body = [[-0.5, 0], [-0.5, -0.3], [-0.3, -0.42], [0, -0.46], [0.3, -0.42], [0.5, -0.3], [0.5, 0]];
    const cord = clip.offsetOpen([[[0.8, 0.08], [0.8, -0.5]]], 0.022);
    const tassel = [ellipse(0.8, -0.58, 0.05, 0.1, 0, 20)];
    return clip.union([board], [body], cord, tassel);
  },
  divisor() {
    const pts = [];
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push([-1 + 2 * t, 0.1 * Math.sin(t * Math.PI * 5)]);
    }
    return clip.offsetOpen([pts], 0.022);
  },
};

const META = [
  ['corazon', 'Corazón', 'Símbolos'],
  ['estrella', 'Estrella', 'Símbolos'],
  ['destello', 'Destello', 'Símbolos'],
  ['aro', 'Aro', 'Marcos'],
  ['anillos', 'Anillos entrelazados', 'Símbolos'],
  ['marcoCircular', 'Marco circular', 'Marcos'],
  ['marcoOvalado', 'Marco ovalado', 'Marcos'],
  ['floritura', 'Floritura', 'Florituras'],
  ['laurel', 'Rama de laurel', 'Florituras'],
  ['flor', 'Flor', 'Naturaleza'],
  ['luna', 'Luna', 'Naturaleza'],
  ['nube', 'Nube', 'Naturaleza'],
  ['birrete', 'Birrete', 'Celebración'],
  ['divisor', 'Divisor ondulado', 'Florituras'],
];

let cache = null;

/** Lista completa de adornos: {id, name, category, contours, aspect, fill}. */
export function getOrnaments(extra = []) {
  if (!cache) {
    cache = [];
    for (const [key, name, category] of META) {
      const fit = fitUnitBox(clip.withPrecision(200000, 8, () => GENERATORS[key]()));
      cache.push({ id: `p:${key}`, name, category, contours: fit.contours, aspect: fit.aspect, fill: 'nonzero' });
    }
  }
  return [...cache, ...extra];
}

export function allOrnaments() {
  return [...getOrnaments(), ...PHOSPHOR.map((o) => ({ ...o, id: `ph:${o.id}`, fill: o.fill || 'nonzero' }))];
}

export function findOrnament(id) {
  return allOrnaments().find((o) => o.id === id) || null;
}
