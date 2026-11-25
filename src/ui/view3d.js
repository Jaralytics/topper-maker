// Vista 3D con three.js: el topper se muestra de pie (el plano XY ya es vertical, el grosor sale hacia +Z).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildGeometry } from '../geometry/mesh.js';
import { debounce } from './util.js';

export class View3D {
  constructor(container) {
    this.container = container;
    this.visible = false;
    this.dirty = true;
    this.needsFit = true;
    this.result = null;
    this.colors = { main: '#e8a0b4', relief: '#ffffff', background: '#f1f3f5' };

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(this.renderer.domElement);
    this.renderer.domElement.className = 'canvas3d';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 3000);
    this.camera.position.set(60, 40, 260);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bcc4, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(80, 140, 160);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = -150; sc.right = 150; sc.top = 150; sc.bottom = -150; sc.near = 10; sc.far = 600;
    key.shadow.radius = 4;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-120, 40, 80);
    this.scene.add(fill);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.12 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.rebuildSoon = debounce(() => this.rebuild(), 150);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.controls.addEventListener('change', () => this.requestRender());
    this.setColors(this.colors);
  }

  setColors(c) {
    this.colors = { ...this.colors, ...c };
    this.scene.background = new THREE.Color(this.colors.background);
    this.applyMaterialColors();
    this.requestRender();
  }

  applyMaterialColors() {
    this.group.children.forEach((m) => {
      m.material.color.set(m.userData.layer === 'relieve' ? this.colors.relief : this.colors.main);
    });
  }

  setVisible(v) {
    this.visible = v;
    if (v) {
      this.resize();
      if (this.dirty) this.rebuild();
      else this.requestRender();
    }
  }

  setResult(result) {
    this.result = result;
    this.dirty = true;
    if (this.visible) this.rebuildSoon();
  }

  resetView() {
    this.needsFit = true;
    this.rebuild();
  }

  rebuild() {
    if (!this.visible || !this.result) return;
    this.dirty = false;
    for (const m of [...this.group.children]) {
      m.geometry.dispose();
      m.material.dispose();
      this.group.remove(m);
    }
    const r = this.result;
    if (r.empty) {
      this.requestRender();
      return;
    }
    for (const p of r.parts) {
      const g = buildGeometry(r, [p.name]);
      if (!g) continue;
      const color = p.name === 'relieve' ? this.colors.relief : this.colors.main;
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02 }));
      mesh.userData.layer = p.name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    const b = r.bbox;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    this.group.position.set(-cx, -b.minY, -r.size.z / 2);
    this.floor.position.y = -0.05;
    if (this.needsFit) this.fitCamera(b, r.size.z);
    this.requestRender();
  }

  fitCamera(b, z) {
    this.needsFit = false;
    const size = Math.max(b.w, b.h);
    const dist = (size / 2 / Math.tan((this.camera.fov * Math.PI) / 360)) * 1.35 + z;
    const target = new THREE.Vector3(0, b.h / 2, 0);
    this.controls.target.copy(target);
    this.camera.position.set(dist * 0.28, b.h / 2 + dist * 0.18, dist * 0.95);
    this.camera.near = Math.max(0.5, dist / 100);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    if (!this.visible || this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }
}
