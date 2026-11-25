// Iconos SVG en linea (trazos simples). Sin fuentes de iconos.
const S = (body, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icon = {
  logo: S('<path d="M4 8h16M12 8v13M8 21h8"/><path d="M7 8c0-3 2-5 5-5s5 2 5 5"/>', 22),
  file: S('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
  templates: S('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
  open: S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  save: S('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
  undo: S('<path d="M9 7 4 12l5 5"/><path d="M4 12h10a5 5 0 0 1 0 10h-2" transform="translate(0 -5)"/>'),
  redo: S('<path d="m15 7 5 5-5 5"/><path d="M20 12H10a5 5 0 0 0 0 10h2" transform="translate(0 -5)"/>'),
  download: S('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
  chevron: S('<path d="m6 9 6 6 6-6"/>', 14),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  text: S('<path d="M5 6V5h14v1M12 5v14M9 19h6"/>'),
  ornament: S('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>'),
  import: S('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v6h14v-6"/>'),
  copy: S('<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2"/>', 16),
  trash: S('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>', 16),
  fit: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  grid: S('<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>'),
  cube: S('<path d="m12 3 8 4.500v9L12 21l-8-4.500v-9z"/><path d="m4 7.500 8 4.500 8-4.500M12 12v9"/>'),
  warn: S('<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17.500v.01"/>', 16),
  close: S('<path d="M6 6l12 12M18 6 6 18"/>', 16),
  upload: S('<path d="M12 16V5M8 9l4-4 4 4M5 19h14"/>', 16),
};
