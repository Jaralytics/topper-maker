// Utilidades de DOM y descargas.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function download(name, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => {
      resolve(input.files[0] || null);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function debounce(fn, ms) {
  let t;
  const d = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.cancel = () => clearTimeout(t);
  return d;
}

/** Popover simple anclado a un boton. build() devuelve el contenido (Node). */
export function popover(anchor, build, { align = 'left', cls = '' } = {}) {
  closePopovers();
  const pop = h('div', { class: `popover ${cls}`, role: 'menu' });
  pop.append(build(closePopovers));
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  let left = align === 'right' ? r.right - pw : r.left;
  left = clamp(left, 8, window.innerWidth - pw - 8);
  pop.style.left = `${left}px`;
  let top = r.bottom + 6;
  if (top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 6);
  pop.style.top = `${top}px`;
  anchor.setAttribute('aria-expanded', 'true');
  const onDown = (e) => {
    if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopovers();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      closePopovers();
      anchor.focus();
    }
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
  });
  pop._cleanup = () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    anchor.setAttribute('aria-expanded', 'false');
  };
  const first = pop.querySelector('button, input');
  if (first) first.focus({ preventScroll: true });
  return pop;
}

export function closePopovers() {
  document.querySelectorAll('.popover').forEach((p) => {
    if (p._cleanup) p._cleanup();
    p.remove();
  });
}

/** Menu de acciones: items = [{label, onClick, disabled, hint}] */
export function menuContent(items) {
  const box = h('div', { class: 'menu' });
  return (close) => {
    box.replaceChildren();
    for (const it of items) {
      if (it.separator) {
        box.append(h('hr'));
        continue;
      }
      box.append(
        h(
          'button',
          {
            class: 'menu-item',
            type: 'button',
            role: 'menuitem',
            disabled: it.disabled,
            onClick: () => {
              close();
              it.onClick();
            },
          },
          h('span', {}, it.label),
          it.hint ? h('small', {}, it.hint) : null,
        ),
      );
    }
    return box;
  };
}

export function toast(msg, ms = 3200) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = h('div', { id: 'toasts', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const t = h('div', { class: 'toast' }, msg);
  host.append(t);
  setTimeout(() => t.remove(), ms);
}
