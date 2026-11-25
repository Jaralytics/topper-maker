// Estado de la aplicacion: proyecto, seleccion, deshacer/rehacer, autosave.
import { normalizeProject, cloneProject, newId } from './geometry/project.js';
import { defaultProject } from './geometry/templates.js';
import { toast } from './ui/util.js';

const KEY = 'toppermaker:project';
const listeners = new Set();
const undoStack = [];
const redoStack = [];
let lastKey = null;
let lastTime = 0;
let saveTimer = null;

export const state = {
  project: null,
  selectedId: null,
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** kind: 'values' (cambio de valores) | 'structure' (lista, seleccion, carga). */
function emit(kind) {
  for (const fn of listeners) fn(kind);
  scheduleSave();
}

let saveWarned = false;

export function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!state.project) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state.project));
  } catch (e) {
    if (!saveWarned) {
      saveWarned = true;
      toast('No se pudo guardar el autoguardado (almacenamiento lleno o no disponible). Guarda el proyecto como archivo.');
    }
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && saveTimer) flushSave();
  });
  window.addEventListener('pagehide', () => {
    if (saveTimer) flushSave();
  });
}

export function initState() {
  let p = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = normalizeProject(JSON.parse(raw));
  } catch (e) {
    p = null;
  }
  if (!p || !p.elements.length) p = defaultProject();
  state.project = p;
  state.selectedId = p.elements.length ? p.elements[0].id : null;
}

export function selected() {
  return state.project.elements.find((e) => e.id === state.selectedId) || null;
}

function snapshot() {
  return JSON.stringify(state.project);
}

function pushUndo(key) {
  const now = Date.now();
  if (key && key === lastKey && now - lastTime < 700) {
    lastTime = now;
    return;
  }
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  lastKey = key || null;
  lastTime = now;
}

/** Modifica el proyecto. key agrupa cambios consecutivos (arrastre, deslizadores). */
export function change(mutator, { key = null, kind = 'values' } = {}) {
  pushUndo(key);
  mutator(state.project);
  emit(kind);
}

export function select(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  emit('structure');
}

export function replaceProject(p, { record = true } = {}) {
  if (record) pushUndo(null);
  state.project = normalizeProject(p);
  state.selectedId = state.project.elements.length ? state.project.elements[0].id : null;
  lastKey = null;
  emit('structure');
}

export function addElement(el) {
  change(
    (p) => {
      p.elements.push(el);
      state.selectedId = el.id;
    },
    { kind: 'structure' },
  );
}

export function duplicateSelected() {
  const el = selected();
  if (!el) return;
  const copy = { ...JSON.parse(JSON.stringify(el)), id: newId(), x: el.x + 5, y: el.y - 5 };
  addElement(copy);
}

export function deleteSelected() {
  const el = selected();
  if (!el) return;
  change(
    (p) => {
      const i = p.elements.findIndex((e) => e.id === el.id);
      p.elements.splice(i, 1);
      const next = p.elements[Math.min(i, p.elements.length - 1)];
      state.selectedId = next ? next.id : null;
    },
    { kind: 'structure' },
  );
}

export function canUndo() {
  return undoStack.length > 0;
}
export function canRedo() {
  return redoStack.length > 0;
}

function restore(json) {
  state.project = normalizeProject(JSON.parse(json));
  if (!state.project.elements.some((e) => e.id === state.selectedId)) {
    state.selectedId = state.project.elements.length ? state.project.elements[0].id : null;
  }
  lastKey = null;
  emit('structure');
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

export function cloneCurrent() {
  return cloneProject(state.project);
}
