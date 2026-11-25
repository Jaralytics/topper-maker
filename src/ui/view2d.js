// Lienzo 2D (SVG): cuadricula, contorno final, seleccion, arrastre, escala, zoom y paneo.
import { state, change, select } from '../state.js';
import * as clip from '../geometry/clip.js';
import { clamp } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

function pathD(paths) {
  let d = '';
  for (const p of paths) {
    if (p.length < 3) continue;
    d += `M${p[0][0].toFixed(3)} ${p[0][1].toFixed(3)}`;
    for (let i = 1; i < p.length; i++) d += `L${p[i][0].toFixed(3)} ${p[i][1].toFixed(3)}`;
    d += 'Z';
  }
  return d;
}

const exD = (exs) => pathD(clip.exToPaths(exs));

export class View2D {
  constructor(container) {
    this.container = container;
    this.k = 4;
    this.tx = 0;
    this.ty = 0;
    this.result = null;
    this.dragging = false;
    this.spaceDown = false;
    this.snapGuide = false;
    this.onDragEnd = () => {};
    this.fitted = false;
    this.build();
    this.ro = new ResizeObserver(() => {
      if (!this.fitted && this.result && !this.result.empty && this.container.clientWidth > 0) this.fit();
      else this.updateView();
    });
    this.ro.observe(container);
  }

  build() {
    const s = svg('svg', { class: 'canvas2d', tabindex: '0', role: 'img', 'aria-label': 'Diseño 2D del topper' });
    this.svg = s;
    this.gridPath = svg('path', { class: 'grid-minor', 'vector-effect': 'non-scaling-stroke' });
    this.gridMajor = svg('path', { class: 'grid-major', 'vector-effect': 'non-scaling-stroke' });
    this.axis = svg('path', { class: 'axis', 'vector-effect': 'non-scaling-stroke' });
    this.world = svg('g');
    this.layerBack = svg('path', { class: 'shape-back', 'fill-rule': 'evenodd' });
    this.layerMain = svg('path', { class: 'shape-main', 'fill-rule': 'evenodd' });
    this.layerIslands = svg('path', { class: 'shape-islands', 'fill-rule': 'evenodd' });
    this.layerThin = svg('path', { class: 'shape-thin', 'fill-rule': 'evenodd' });
    this.world.append(this.gridPath, this.gridMajor, this.axis, this.layerBack, this.layerMain, this.layerIslands, this.layerThin);
    this.overlay = svg('g', { class: 'overlay' });
    this.empty = svg('text', { class: 'empty-msg', 'text-anchor': 'middle' });
    this.empty.textContent = 'Agrega un texto o un adorno para empezar';
    s.append(this.world, this.overlay, this.empty);
    this.container.append(s);

    s.addEventListener('pointerdown', (e) => this.onDown(e));
    s.addEventListener('pointermove', (e) => this.onMove(e));
    s.addEventListener('pointerup', (e) => this.onUp(e));
    s.addEventListener('pointercancel', (e) => this.onUp(e));
    s.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    s.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) {
        this.spaceDown = true;
        s.classList.add('pan-ready');
        if (this.container.offsetParent) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        s.classList.remove('pan-ready');
      }
    });
  }

  // ---- coordenadas ----
  toModel(cx, cy) {
    const r = this.svg.getBoundingClientRect();
    return [(cx - r.left - this.tx) / this.k, -(cy - r.top - this.ty) / this.k];
  }
  toScreen(x, y) {
    return [this.tx + x * this.k, this.ty - y * this.k];
  }

  fit() {
    const w = this.container.clientWidth, hgt = this.container.clientHeight;
    if (!w || !hgt) return;
    const b = this.result && !this.result.empty ? this.result.bbox : null;
    if (!b) {
      this.k = 4;
      this.tx = w / 2;
      this.ty = hgt / 2;
    } else {
      const pad = 70;
      this.k = clamp(Math.min((w - pad * 2) / Math.max(b.w, 1), (hgt - pad * 2) / Math.max(b.h, 1)), 0.5, 40);
      this.tx = w / 2 - ((b.minX + b.maxX) / 2) * this.k;
      this.ty = hgt / 2 + ((b.minY + b.maxY) / 2) * this.k;
      this.fitted = true;
    }
    this.updateView();
  }

  // ---- render ----
  setResult(result) {
    const first = !this.result || (this.result.empty && !result.empty);
    this.result = result;
    if (first && !result.empty) this.fit();
    this.renderShapes();
    this.renderOverlay();
  }

  renderShapes() {
    const r = this.result;
    this.empty.style.display = r.empty ? '' : 'none';
    if (r.empty) {
      this.layerBack.setAttribute('d', '');
      this.layerMain.setAttribute('d', '');
      this.layerIslands.setAttribute('d', '');
      this.layerThin.setAttribute('d', '');
      return;
    }
    const sil = r.parts.length > 1;
    this.layerBack.setAttribute('d', sil ? exD(r.parts[0].ex) : '');
    this.layerMain.setAttribute('d', exD(sil ? r.parts[1].ex : r.parts[0].ex));
    if (r.islands > 1) {
      let big = 0;
      let bigA = -1;
      r.islandsEx.forEach((e, i) => {
        const a = clip.exArea(e);
        if (a > bigA) { bigA = a; big = i; }
      });
      this.layerIslands.setAttribute('d', exD(r.islandsEx.filter((_, i) => i !== big)));
    } else this.layerIslands.setAttribute('d', '');
    this.layerThin.setAttribute('d', state.project.settings.showThin ? exD(r.thin) : '');
  }

  updateView() {
    const { k, tx, ty } = this;
    this.world.setAttribute('transform', `matrix(${k} 0 0 ${-k} ${tx} ${ty})`);
    // cuadricula de 10 mm
    const w = this.container.clientWidth, hgt = this.container.clientHeight;
    const step = k >= 2.2 ? 10 : 50;
    const x0 = Math.floor((-tx / k) / step) * step, x1 = Math.ceil(((w - tx) / k) / step) * step;
    const y0 = Math.floor((-(hgt - ty) / k) / step) * step, y1 = Math.ceil((ty / k) / step) * step;
    let minor = '', major = '';
    for (let x = x0; x <= x1; x += step) (x % 50 === 0 ? (major += `M${x} ${y0}V${y1}`) : (minor += `M${x} ${y0}V${y1}`));
    for (let y = y0; y <= y1; y += step) (y % 50 === 0 ? (major += `M${x0} ${y}H${x1}`) : (minor += `M${x0} ${y}H${x1}`));
    this.gridPath.setAttribute('d', minor);
    this.gridMajor.setAttribute('d', major);
    this.axis.setAttribute('d', `M0 ${y0}V${y1}`);
    this.empty.setAttribute('x', w / 2);
    this.empty.setAttribute('y', hgt / 2);
    this.renderOverlay();
  }

  selectedInfo() {
    if (!this.result) return null;
    return this.result.elements.find((e) => e.id === state.selectedId) || null;
  }

  renderOverlay() {
    const o = this.overlay;
    o.replaceChildren();
    const r = this.result;
    if (!r || r.empty) return;
    const lbl = (x, y, text, cls = 'dim-label', anchor = 'middle') => {
      const t = svg('text', { x, y, class: cls, 'text-anchor': anchor });
      t.textContent = text;
      o.append(t);
    };
    // dimensiones totales
    const b = r.bbox;
    const [ax, ay] = this.toScreen(b.minX, b.minY);
    const [bx] = this.toScreen(b.maxX, b.minY);
    const [, cy] = this.toScreen(b.maxX, b.maxY);
    const dy = ay + 18;
    o.append(svg('path', { class: 'dim-line', d: `M${ax} ${dy - 4}V${dy + 4}M${bx} ${dy - 4}V${dy + 4}M${ax} ${dy}H${bx}` }));
    lbl((ax + bx) / 2, dy + 15, `${b.w.toFixed(1)} mm`);
    const dx = bx + 18;
    o.append(svg('path', { class: 'dim-line', d: `M${dx - 4} ${cy}H${dx + 4}M${dx - 4} ${ay}H${dx + 4}M${dx} ${cy}V${ay}` }));
    const t = svg('text', { x: dx + 14, y: (cy + ay) / 2, class: 'dim-label', 'text-anchor': 'middle', transform: `rotate(90 ${dx + 14} ${(cy + ay) / 2})` });
    t.textContent = `${b.h.toFixed(1)} mm`;
    o.append(t);
    // eje de simetria
    if (this.snapGuide) {
      const [gx] = this.toScreen(0, 0);
      o.append(svg('path', { class: 'snap-line', d: `M${gx} 0V${this.container.clientHeight}` }));
    }
    // seleccion
    const sel = this.selectedInfo();
    if (sel && sel.bbox) {
      const pad = 1.5;
      const [x0, y0] = this.toScreen(sel.bbox.minX - pad, sel.bbox.maxY + pad);
      const [x1, y1] = this.toScreen(sel.bbox.maxX + pad, sel.bbox.minY - pad);
      o.append(svg('rect', { class: 'sel-box', x: x0, y: y0, width: x1 - x0, height: y1 - y0 }));
      o.append(svg('rect', { class: 'sel-handle', x: x1 - 6, y: y1 - 6, width: 12, height: 12, rx: 2 }));
      this.handle = { x: x1, y: y1 };
      lbl(x0, y0 - 6, `${sel.bbox.w.toFixed(1)} x ${sel.bbox.h.toFixed(1)} mm`, 'sel-label', 'start');
    } else this.handle = null;
  }

  // ---- interaccion ----
  hit(mx, my) {
    const els = this.result ? this.result.elements : [];
    let best = null, bestA = Infinity;
    for (const e of els) {
      const b = e.bbox;
      if (!b || e.empty) continue;
      if (mx >= b.minX && mx <= b.maxX && my >= b.minY && my <= b.maxY) {
        const a = b.w * b.h;
        if (a < bestA) { bestA = a; best = e; }
      }
    }
    return best;
  }

  onDown(e) {
    this.svg.focus({ preventScroll: true });
    this.svg.setPointerCapture(e.pointerId);
    const rect = this.svg.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const base = { sx: e.clientX, sy: e.clientY, moved: false };
    if (e.button === 1 || this.spaceDown || e.button === 2) {
      this.drag = { ...base, mode: 'pan', tx: this.tx, ty: this.ty };
      this.svg.classList.add('panning');
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    if (this.handle && Math.abs(px - this.handle.x) < 11 && Math.abs(py - this.handle.y) < 11) {
      const sel = state.project.elements.find((x) => x.id === state.selectedId);
      if (sel) {
        const [cx, cy] = this.toScreen(sel.x, sel.y);
        const d0 = Math.hypot(px - cx, py - cy) || 1;
        this.drag = { ...base, mode: 'scale', id: sel.id, d0, cx, cy, start: JSON.parse(JSON.stringify(sel)) };
        this.dragging = true;
        return;
      }
    }
    const [mx, my] = this.toModel(e.clientX, e.clientY);
    const h = this.hit(mx, my);
    if (h) {
      select(h.id);
      const el = state.project.elements.find((x) => x.id === h.id);
      this.drag = { ...base, mode: 'move', id: h.id, ox: el.x, oy: el.y, mx, my };
      this.dragging = true;
    } else {
      this.drag = { ...base, mode: 'pan', tx: this.tx, ty: this.ty, clear: true };
    }
  }

  onMove(e) {
    const d = this.drag;
    if (!d) return;
    const dxs = e.clientX - d.sx, dys = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dxs, dys) < 3) return;
    d.moved = true;
    if (d.mode === 'pan') {
      this.tx = d.tx + dxs;
      this.ty = d.ty + dys;
      this.updateView();
    } else if (d.mode === 'move') {
      const [mx, my] = this.toModel(e.clientX, e.clientY);
      let nx = d.ox + (mx - d.mx);
      const ny = d.oy + (my - d.my);
      this.snapGuide = false;
      if (!e.altKey && Math.abs(nx) < 2) {
        nx = 0;
        this.snapGuide = true;
      }
      change(
        (p) => {
          const el = p.elements.find((x) => x.id === d.id);
          if (el) { el.x = round(nx); el.y = round(ny); }
        },
        { key: `drag-${d.id}` },
      );
    } else if (d.mode === 'scale') {
      const rect = this.svg.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - rect.left - d.cx, e.clientY - rect.top - d.cy);
      const f = clamp(dist / d.d0, 0.1, 10);
      change(
        (p) => {
          const el = p.elements.find((x) => x.id === d.id);
          if (!el) return;
          if (el.type === 'text') {
            const h2 = clamp(d.start.height * f, 3, 120);
            const ff = h2 / d.start.height;
            el.height = round(h2);
            el.spacing = round(d.start.spacing * ff);
            el.curvature = round(d.start.curvature * ff);
          } else el.width = round(clamp(d.start.width * f, 3, 300));
        },
        { key: `scale-${d.id}` },
      );
    }
  }

  onUp(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.svg.classList.remove('panning');
    try { this.svg.releasePointerCapture(e.pointerId); } catch (err) { /* ya liberado */ }
    const wasDragging = this.dragging;
    this.dragging = false;
    this.snapGuide = false;
    if (d.mode === 'pan' && d.clear && !d.moved) select(null);
    if (wasDragging) this.onDragEnd();
    this.renderOverlay();
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.svg.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const [mx, my] = this.toModel(e.clientX, e.clientY);
    this.k = clamp(this.k * Math.exp(-e.deltaY * 0.0015), 0.4, 60);
    this.tx = px - mx * this.k;
    this.ty = py + my * this.k;
    this.updateView();
  }
}

const round = (v) => Math.round(v * 100) / 100;
