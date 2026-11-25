// Plantillas de proyecto. Sin DOM.
import { defaultText, defaultOrnament, normalizeProject } from './project.js';

const T = (o) => defaultText(o);
const O = (o) => defaultOrnament(o);

export const TEMPLATES = [
  {
    id: 'cumple',
    name: 'Feliz Cumpleaños',
    build: (name = 'Ana') => ({
      name: 'cumpleanos',
      elements: [
        T({ content: name, fontId: 'montserrat', height: 22, spacing: 1, x: 0, y: 24 }),
        T({ content: 'Feliz Cumpleaños', fontId: 'great-vibes', height: 16, x: 0, y: 8 }),
      ],
      settings: {},
    }),
  },
  {
    id: 'mrmrs',
    name: 'Mr & Mrs',
    build: () => ({
      name: 'mr-mrs',
      elements: [
        T({ content: 'Mr', fontId: 'dancing-script', height: 22, x: -40, y: 0 }),
        O({ ornamentId: 'p:anillos', width: 26, x: 0, y: -1.5 }),
        O({ ornamentId: 'p:corazon', width: 9, x: 0, y: 10.5 }),
        T({ content: 'Mrs', fontId: 'dancing-script', height: 22, x: 42, y: 0 }),
      ],
      settings: {},
    }),
  },
  {
    id: 'baby',
    name: 'Baby Shower',
    build: () => ({
      name: 'baby-shower',
      elements: [
        T({ content: 'Baby Shower', fontId: 'pacifico', height: 15, x: 0, y: 0 }),
        O({ ornamentId: 'p:luna', width: 17, x: -44, y: 14 }),
        O({ ornamentId: 'p:nube', width: 22, x: -2, y: 11 }),
        O({ ornamentId: 'p:estrella', width: 11, x: 44, y: 14 }),
      ],
      settings: {},
    }),
  },
  {
    id: 'xv',
    name: 'XV Años',
    build: () => ({
      name: 'xv-anos',
      elements: [
        O({ ornamentId: 'ph:crown', width: 22, x: 0, y: 25 }),
        T({ content: 'XV', fontId: 'montserrat', height: 22, spacing: 2, x: 0, y: 7 }),
        T({ content: 'Años', fontId: 'great-vibes', height: 16, x: 0, y: -9 }),
      ],
      settings: {},
    }),
  },
  {
    id: 'felicidades',
    name: 'Felicidades',
    build: () => ({
      name: 'felicidades',
      elements: [
        T({ content: 'Felicidades', fontId: 'allura', height: 18, x: 8, y: 0 }),
        O({ ornamentId: 'p:birrete', width: 26, x: -50, y: 2 }),
      ],
      settings: {},
    }),
  },
];

export function buildTemplate(id, name) {
  const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
  return normalizeProject(t.build(name));
}

export function defaultProject() {
  return buildTemplate('cumple', 'Ana');
}
