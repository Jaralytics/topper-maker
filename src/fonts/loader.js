// Carga de fuentes en el navegador: fetch + opentype.parse, FontFace para vista previa,
// y fuentes personalizadas persistidas en IndexedDB (con tolerancia a fallos).
import opentype from 'opentype.js';
import { FONT_CATALOG } from './catalog.js';

export const fonts = Object.create(null); // id -> opentype.Font
const pending = new Map();
const faces = new Set();
export const customFonts = []; // { id, name }

const MAX_FONT_BYTES = 10 * 1024 * 1024;
const base = import.meta.env.BASE_URL || './';

export function fontUrl(entry) {
  return `${base}fonts/${entry.file}`;
}

export function cssFamily(id) {
  return `"tm-${id.replace(/[^a-z0-9-]/gi, '_')}"`;
}

export function loadFont(id) {
  if (fonts[id]) return Promise.resolve(fonts[id]);
  if (pending.has(id)) return pending.get(id);
  const entry = FONT_CATALOG.find((f) => f.id === id);
  if (!entry) return Promise.resolve(null);
  const p = fetch(fontUrl(entry))
    .then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${entry.file}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      fonts[id] = opentype.parse(buf);
      return fonts[id];
    })
    .catch((e) => {
      console.warn(e);
      return null;
    })
    .finally(() => pending.delete(id));
  pending.set(id, p);
  return p;
}

/** Registra la fuente para mostrar su nombre con su propio tipo de letra (FontFace). */
export function registerFace(id) {
  if (faces.has(id) || typeof FontFace === 'undefined') return;
  faces.add(id);
  const entry = FONT_CATALOG.find((f) => f.id === id);
  let face = null;
  if (entry) face = new FontFace(cssFamily(id).replace(/"/g, ''), `url(${fontUrl(entry)})`);
  else if (customData.has(id)) face = new FontFace(cssFamily(id).replace(/"/g, ''), customData.get(id).slice(0));
  if (!face) return;
  face.load().then((f) => document.fonts.add(f)).catch(() => {});
}

// ---- fuentes personalizadas ----
const customData = new Map(); // id -> ArrayBuffer
const DB = 'toppermaker';
const STORE = 'fonts';

function openDb() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function dbPut(rec) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn('No se pudo guardar la fuente en IndexedDB', e);
  }
}

async function dbAll() {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch (e) {
    return [];
  }
}

function addCustom(id, name, buf) {
  const font = opentype.parse(buf.slice(0));
  fonts[id] = font;
  customData.set(id, buf);
  if (!customFonts.some((c) => c.id === id)) customFonts.push({ id, name });
  registerFace(id);
  return font;
}

/** Carga desde IndexedDB las fuentes subidas anteriormente. */
export async function restoreCustomFonts() {
  const all = await dbAll();
  for (const rec of all) {
    try {
      addCustom(rec.id, rec.name, rec.data);
    } catch (e) {
      console.warn('Fuente guardada invalida', rec.name);
    }
  }
}

export async function addCustomFontFile(file) {
  if (file.size > MAX_FONT_BYTES) throw new Error('demasiado grande');
  const buf = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, '');
  const id = `custom:${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${buf.byteLength}`;
  addCustom(id, name, buf); // lanza si no se puede interpretar
  await dbPut({ id, name, data: buf });
  return id;
}

/** Datos para incrustar en el archivo de proyecto. */
export function exportCustomFonts(ids) {
  const out = {};
  for (const id of ids) {
    if (!customData.has(id)) continue;
    const c = customFonts.find((x) => x.id === id);
    const bytes = new Uint8Array(customData.get(id));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out[id] = { name: c ? c.name : id, data: btoa(bin) };
  }
  return out;
}

export async function importCustomFonts(map) {
  for (const [id, rec] of Object.entries(map || {})) {
    if (fonts[id]) continue;
    try {
      if (!rec || typeof rec.data !== 'string' || rec.data.length > MAX_FONT_BYTES * 1.4) throw new Error('demasiado grande');
      const bin = atob(rec.data);
      if (bin.length > MAX_FONT_BYTES) throw new Error('demasiado grande');
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      addCustom(id, rec.name, buf.buffer);
      await dbPut({ id, name: rec.name, data: buf.buffer });
    } catch (e) {
      console.warn('No se pudo importar la fuente', rec.name);
    }
  }
}

export function fontName(id) {
  const f = FONT_CATALOG.find((x) => x.id === id);
  if (f) return f.name;
  const c = customFonts.find((x) => x.id === id);
  return c ? c.name : id;
}
