# Topper Maker

Diseñador local de toppers para pastel imprimibles en 3D. Combina texto en muchas tipografías, adornos, una barra base y estacas, y exporta el resultado como STL. Todo corre en el navegador, sin servicios externos.

Versión en línea: https://jaralytics.github.io/topper-maker/

## Requisitos e instalación

- Node.js 22 o superior

```
npm install
npm run dev
```

Abre la dirección que muestra Vite (normalmente http://localhost:5173). Otros comandos:

- `npm run build`: genera la versión estática en `dist/`.
- `npm run preview`: sirve la versión compilada.
- `npm run test:geometry`: pruebas del núcleo de geometría en Node (mallas estancas, volumen positivo, regresión de orientación). Los STL de prueba se escriben en la carpeta temporal del sistema.
- `npm run fonts`: vuelve a copiar las tipografías desde `@fontsource` a `public/fonts` (ya incluidas).
- `npm run ornaments`: vuelve a generar `src/geometry/ornaments-data.js` desde `@phosphor-icons/core`.

## Funciones

- Texto de una línea con 20 tipografías (manuscritas, decorativas, serif y sans) mostradas en su propio estilo, y subida de tipografías propias (TTF, OTF, WOFF) guardadas en IndexedDB. Aviso si la tipografía no incluye algún carácter.
- Altura de mayúsculas en mm, espaciado de letras con kerning y curvatura continua (arco o sonrisa) que mantiene unidas las letras cursivas.
- Adornos: formas paramétricas originales (corazón, estrella, destello, aros, anillos entrelazados, marcos, floritura, laurel, flor, luna, nube, birrete, divisor) e iconos Phosphor. Además, importación de SVG propio (respeta la regla de relleno).
- Barra base con altura, esquinas, margen y posición ajustables (por defecto queda 1,5 mm sobre la línea base del texto más bajo) y de 0 a 4 estacas con punta.
- Acabado: refuerzo de trazo, unión de separaciones, relleno de huecos pequeños, conexión de puntos y tildes sueltos, y análisis de piezas separadas y zonas más finas que el ancho mínimo.
- Modo sin barra: las estacas se anclan en la base de las letras (anclaje configurable) y las piezas cercanas se unen con puentes finos (distancia y ancho ajustables). La separación entre estacas también es configurable.
- Estilos: recorte de una capa, o silueta de fondo con relieve (exportable por capas para impresión multicolor).
- Ajuste del ancho total, plantillas (Feliz Cumpleaños, Mr & Mrs, Baby Shower, XV Años, Felicidades), deshacer y rehacer, autoguardado local y archivos de proyecto `.json`.
- Vista 2D con cuadrícula de 10 mm, arrastre, escala por la esquina, zoom, desplazamiento y imán al eje central; vista 3D con órbita.

Atajos: Supr elimina, flechas mueven 1 mm (Mayús: 5 mm), Ctrl+Z deshace, Ctrl+Y rehace, Ctrl+S guarda el proyecto.

## Consejos de impresión

- Usa PLA, imprime plano sobre la cama, con relleno al 100 % o al menos 4 perímetros.
- La impresión 3D es porosa: usa filamento apto para alimentos o envuelve las estacas antes de clavarlas en el pastel.
- Si hay trazos finos (zonas marcadas en rojo), aumenta el refuerzo de trazo o el tamaño del texto.

## Licencias

- Tipografías: Google Fonts bajo licencia SIL Open Font License 1.1, obtenidas de los paquetes `@fontsource/*`. Los textos de licencia están en `public/fonts/LICENSES/`.
- Interfaz: Inter (OFL), vía `@fontsource/inter`.
- Iconos de adornos: Phosphor Icons (MIT). Ver `public/LICENSES/phosphor-icons-MIT.txt`.
- Las formas paramétricas son originales de este proyecto.
- Bibliotecas: three, opentype.js y clipper-lib (licencias MIT y Boost).
