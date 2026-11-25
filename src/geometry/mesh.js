// ExPolygons -> geometria three.js -> STL binario. Sin DOM.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export function exToShapes(exs) {
  const shapes = [];
  for (const e of exs) {
    if (e.outer.length < 3) continue;
    const shape = new THREE.Shape(e.outer.map((p) => new THREE.Vector2(p[0], p[1])));
    for (const h of e.holes) {
      if (h.length < 3) continue;
      shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
    }
    shapes.push(shape);
  }
  return shapes;
}

/** Extruye una capa entre z0 y z1. Devuelve null si esta vacia. */
export function extrudePart(part) {
  const shapes = exToShapes(part.ex);
  if (!shapes.length || !(part.z1 > part.z0)) return null;
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: part.z1 - part.z0,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  g.translate(0, 0, part.z0);
  // descarta uv/normal para fusionar con seguridad
  g.deleteAttribute('uv');
  return g;
}

/** Geometria de todas las capas (o de las pedidas por nombre). */
export function buildGeometry(result, names = null) {
  const geos = [];
  for (const p of result.parts) {
    if (names && !names.includes(p.name)) continue;
    const g = extrudePart(p);
    if (g) geos.push(g);
  }
  if (!geos.length) return null;
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  return merged;
}

export function triangleCount(geometry) {
  if (!geometry) return 0;
  return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
}

/** STL binario como Uint8Array. */
export function geometryToSTL(geometry) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  const dv = new STLExporter().parse(mesh, { binary: true });
  return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
}

/** Archivos STL a exportar: [{ suffix, data }]. mode: 'single' | 'layers'. */
export function buildSTLFiles(result, mode = 'single') {
  const files = [];
  if (mode === 'layers' && result.parts.length > 1) {
    for (const p of result.parts) {
      const g = buildGeometry(result, [p.name]);
      if (g) files.push({ suffix: `-${p.name}`, data: geometryToSTL(g) });
    }
  } else {
    const g = buildGeometry(result);
    if (g) files.push({ suffix: '', data: geometryToSTL(g) });
  }
  return files;
}
