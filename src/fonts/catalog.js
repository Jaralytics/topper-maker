// Catalogo de fuentes incluidas (Google Fonts, licencia OFL, via @fontsource).
export const FONT_CATALOG = [
  { id: 'great-vibes', name: 'Great Vibes', category: 'Manuscrita', pkg: 'great-vibes', weight: 400 },
  { id: 'dancing-script', name: 'Dancing Script', category: 'Manuscrita', pkg: 'dancing-script', weight: 700 },
  { id: 'pacifico', name: 'Pacifico', category: 'Manuscrita', pkg: 'pacifico', weight: 400 },
  { id: 'sacramento', name: 'Sacramento', category: 'Manuscrita', pkg: 'sacramento', weight: 400 },
  { id: 'parisienne', name: 'Parisienne', category: 'Manuscrita', pkg: 'parisienne', weight: 400 },
  { id: 'allura', name: 'Allura', category: 'Manuscrita', pkg: 'allura', weight: 400 },
  { id: 'alex-brush', name: 'Alex Brush', category: 'Manuscrita', pkg: 'alex-brush', weight: 400 },
  { id: 'satisfy', name: 'Satisfy', category: 'Manuscrita', pkg: 'satisfy', weight: 400 },
  { id: 'cookie', name: 'Cookie', category: 'Manuscrita', pkg: 'cookie', weight: 400 },
  { id: 'kaushan-script', name: 'Kaushan Script', category: 'Manuscrita', pkg: 'kaushan-script', weight: 400 },
  { id: 'lobster', name: 'Lobster', category: 'Manuscrita', pkg: 'lobster', weight: 400 },
  { id: 'yellowtail', name: 'Yellowtail', category: 'Manuscrita', pkg: 'yellowtail', weight: 400 },
  { id: 'montserrat', name: 'Montserrat Extra Bold', category: 'Sans', pkg: 'montserrat', weight: 800 },
  { id: 'bebas-neue', name: 'Bebas Neue', category: 'Sans', pkg: 'bebas-neue', weight: 400 },
  { id: 'fredoka', name: 'Fredoka', category: 'Sans', pkg: 'fredoka', weight: 600 },
  { id: 'playfair-display', name: 'Playfair Display', category: 'Serif', pkg: 'playfair-display', weight: 700 },
  { id: 'abril-fatface', name: 'Abril Fatface', category: 'Serif', pkg: 'abril-fatface', weight: 400 },
  { id: 'cinzel', name: 'Cinzel', category: 'Serif', pkg: 'cinzel', weight: 700 },
  { id: 'luckiest-guy', name: 'Luckiest Guy', category: 'Decorativa', pkg: 'luckiest-guy', weight: 400 },
  { id: 'righteous', name: 'Righteous', category: 'Decorativa', pkg: 'righteous', weight: 400 },
].map((f) => ({ ...f, file: `${f.id}.woff` }));

export const FONT_CATEGORIES = ['Manuscrita', 'Decorativa', 'Serif', 'Sans'];
export const DEFAULT_SCRIPT_FONT = 'great-vibes';
export const DEFAULT_BOLD_FONT = 'montserrat';
