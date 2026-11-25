// Construccion de contornos de texto a partir de una fuente opentype.js. Sin DOM.
import { flattenCubic, flattenQuad, FLATNESS } from './flatten.js';
import { resample } from './clip.js';

export function capHeightOf(font) {
  const upm = font.unitsPerEm || 1000;
  const cap = font.tables && font.tables.os2 && font.tables.os2.sCapHeight;
  return cap && cap > 0 ? cap : 0.7 * upm;
}

/** Caracteres de `text` que la fuente no contiene (sin repetir). */
export function missingChars(font, text) {
  const out = [];
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    if (font.charToGlyphIndex(ch) === 0 && !out.includes(ch)) out.push(ch);
  }
  return out;
}

function commandsToContours(cmds) {
  const out = [];
  let cur = null;
  let last = [0, 0];
  for (const c of cmds) {
    if (c.type === 'M') {
      if (cur && cur.length > 2) out.push(cur);
      last = [c.x, -c.y];
      cur = [last];
    } else if (!cur) {
      continue;
    } else if (c.type === 'L') {
      last = [c.x, -c.y];
      cur.push(last);
    } else if (c.type === 'C') {
      const p3 = [c.x, -c.y];
      flattenCubic(cur, last, [c.x1, -c.y1], [c.x2, -c.y2], p3, FLATNESS);
      last = p3;
    } else if (c.type === 'Q') {
      const p2 = [c.x, -c.y];
      flattenQuad(cur, last, [c.x1, -c.y1], p2, FLATNESS);
      last = p2;
    } else if (c.type === 'Z') {
      if (cur.length > 2) out.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length > 2) out.push(cur);
  // quita el punto final duplicado
  return out.map((p) => {
    const a = p[0], b = p[p.length - 1];
    return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 ? p.slice(0, -1) : p;
  });
}

function warp(p, R) {
  const th = p[0] / R;
  const r = R + p[1];
  return [r * Math.sin(th), r * Math.cos(th) - R];
}

/**
 * Devuelve { contours, baseline } en coordenadas locales: el origen es el centro de la altura de
 * mayusculas y el centro horizontal de la tinta. `baseline` son puntos de la linea base.
 */
export function buildTextContours(font, { content, height, spacing = 0, curvature = 0 }) {
  if (!content || !(height > 0)) return { contours: [], baseline: [] };
  const upm = font.unitsPerEm || 1000;
  const size = (height * upm) / capHeightOf(font);
  const scale = size / upm;
  const glyphs = font.stringToGlyphs(content);
  let x = 0;
  let contours = [];
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const path = g.getPath(x, 0, size);
    for (const c of commandsToContours(path.commands)) contours.push(c);
    x += (g.advanceWidth || 0) * scale + spacing;
    const next = glyphs[i + 1];
    if (next) x += font.getKerningValue(g, next) * scale;
  }
  if (!contours.length) return { contours: [], baseline: [] };
  let minX = Infinity, maxX = -Infinity;
  for (const c of contours) for (const p of c) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
  }
  const cx = (minX + maxX) / 2;
  const hw = (maxX - minX) / 2;
  contours = contours.map((c) => c.map((p) => [p[0] - cx, p[1]]));
  let baseline = [];
  for (let i = 0; i <= 24; i++) baseline.push([-hw + (hw * 2 * i) / 24, 0]);
  if (Math.abs(curvature) > 1e-6) {
    let maxY = 0;
    for (const c of contours) for (const q of c) maxY = Math.max(maxY, Math.abs(q[1]));
    // limita el angulo total a ~300 grados y evita |R + y| <= 0
    const minR = Math.max((hw * 2) / 5.236, maxY * 1.1, 1);
    const R = Math.sign(curvature) * Math.max(Math.abs(curvature), minR);
    contours = contours.map((c) => resample(c, 1).map((p) => warp(p, R)));
    baseline = baseline.map((p) => warp(p, R));
  }
  const dy = -height / 2;
  contours = contours.map((c) => c.map((p) => [p[0], p[1] + dy]));
  baseline = baseline.map((p) => [p[0], p[1] + dy]);
  return { contours, baseline };
}
