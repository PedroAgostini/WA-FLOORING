/* WA Flooring Specialist: 3D floor designer.
   A sunlit room corner. The visitor picks a pattern, a finish and a sheen,
   drags to look around, and sends that look to the estimate form. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const section = document.querySelector('.designer');
const canvas = section?.querySelector('.designer__canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

const FINISHES = {
  natural: { name: 'Natural Oak', color: '#E3C79C' },
  honey: { name: 'Honey', color: '#C98C55' },
  walnut: { name: 'Walnut', color: '#71462B' },
  driftwood: { name: 'Driftwood', color: '#B5AA9A' },
};
const SHEENS = {
  matte: { name: 'Matte', rough: 0.8, coat: 0 },
  satin: { name: 'Satin', rough: 0.5, coat: 0.35 },
  gloss: { name: 'Gloss', rough: 0.24, coat: 1 },
};
const PATTERNS = { straight: 'Straight', herringbone: 'Herringbone', chevron: 'Chevron' };

// room
const WX = -5;          // left wall inner face (x)
const WZ = -5;          // back wall inner face (z)
const FAR = 9.5;        // floor runs past the camera
const H = 7;            // wall height
const T = 0.12;         // plank thickness
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function woodTexture(aniso) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#F6F0E6';
  g.fillRect(0, 0, c.width, c.height);
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 110; i++) {
    const y0 = r() * c.height, amp = 2 + r() * 8, f = 0.003 + r() * 0.009, ph = r() * 6.28;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 8) {
      const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph) * amp * 0.3;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.strokeStyle = `rgba(${90 + r() * 40 | 0},${58 + r() * 26 | 0},${30 + r() * 18 | 0},${0.05 + r() * 0.18})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.stroke();
  }
  for (let k = 0; k < 2; k++) {
    const x = 200 + r() * 600, y = 50 + r() * 150, rad = 6 + r() * 7;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad * 2.5);
    gr.addColorStop(0, 'rgba(80,46,22,.45)'); gr.addColorStop(1, 'rgba(80,46,22,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * 2.6, rad, 0, 0, 6.29); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/* ---------- pattern builders: each returns [{ geometry, items:[{x,z,ry,sx}] }] ---------- */

function straight() {
  const W = 0.42, items = [];
  for (let z = WZ + W / 2; z < FAR + 1; z += W) {
    let x = WX - rnd() * 2.4;
    while (x < FAR + 1) {
      const len = 1.6 + rnd() * 1.9;
      items.push({ x: x + len / 2, z, ry: 0, sx: len - 0.03 });
      x += len;
    }
  }
  return [{ geometry: new THREE.BoxGeometry(1, T, W * 0.95), items }];
}

function herringbone() {
  const L = 2.0, W = 0.4, items = [];
  const th = Math.PI / 4, c = Math.cos(th), s = Math.sin(th);
  for (let a = -60; a <= 60; a++) {
    for (let b = -14; b <= 14; b++) {
      const ox = a * W + b * L, oz = a * W - b * L;
      const pieces = [
        { lx: ox + L / 2, lz: oz + W / 2, ry: 0 },
        { lx: ox + L + W / 2, lz: oz + W - L + L / 2, ry: Math.PI / 2 },
      ];
      for (const p of pieces) {
        const x = p.lx * c + p.lz * s, z = -p.lx * s + p.lz * c;
        if (x > WX - 1.4 && x < FAR + 1 && z > WZ - 1.4 && z < FAR + 1) items.push({ x, z, ry: p.ry + th, sx: 1 });
      }
    }
  }
  return [{ geometry: new THREE.BoxGeometry(L * 0.985, T, W * 0.94), items }];
}

function chevronGeometry(side, a, h) {
  const g = 0.012;
  const pts = side < 0
    ? [[-a + g, -a + g], [-g, 0], [-g, h - g * 2], [-a + g, h - a - g]]
    : [[g, 0], [a - g, -a + g], [a - g, h - a - g], [g, h - g * 2]];
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const along = side < 0 ? (x + z) / Math.SQRT2 : (x - z) / Math.SQRT2;
    const across = side < 0 ? (z - x) / Math.SQRT2 : (x + z) / Math.SQRT2;
    uv.setXY(i, along * 0.42, across * 1.7);
  }
  geo.computeVertexNormals();
  return geo;
}

function chevron() {
  const a = 0.9, h = 0.58, left = [], right = [];
  for (let xc = WX - a; xc < FAR + 2 * a; xc += 2 * a) {
    for (let s = WZ - 2; s < FAR + 2; s += h) {
      left.push({ x: xc, z: s, ry: 0, sx: 1, y0: 0 });
      right.push({ x: xc, z: s, ry: 0, sx: 1, y0: 0 });
    }
  }
  return [
    { geometry: chevronGeometry(-1, a, h), items: left, base: true },
    { geometry: chevronGeometry(1, a, h), items: right, base: true },
  ];
}

const BUILDERS = { straight, herringbone, chevron };

/* ---------- scene ---------- */

if (section && canvas) {
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { renderer = null; }
  if (!renderer) section.classList.add('no-webgl');
  else build(renderer);
}

function build(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#E4DCD0');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(7.6, 3.7, 7.4);
  const target = new THREE.Vector3(-1.4, 0.75, -1.0);

  const win = { x0: -1.7, x1: 1.9, y0: 0.9, y1: 4.3 };
  const winC = new THREE.Vector3((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, WZ);

  /* ---------- light: soft daylight from the window, gentle sun, warm bounce ---------- */
  const winLight = new THREE.RectAreaLight('#FFF4E4', 9, win.x1 - win.x0, win.y1 - win.y0);
  winLight.position.set(winC.x, winC.y, WZ + 0.06);
  winLight.lookAt(winC.x + 0.4, winC.y - 1.6, WZ + 6);
  scene.add(winLight);

  const sunTarget = new THREE.Vector3(1.0, 0, -0.6);
  const sunDir = winC.clone().sub(sunTarget).normalize();
  const sun = new THREE.DirectionalLight('#FFE6C8', 0.7);
  sun.position.copy(sunTarget).addScaledVector(sunDir, 24);
  sun.target.position.copy(sunTarget);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
  sun.shadow.radius = 16;
  sun.shadow.blurSamples = 24;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const top = new THREE.DirectionalLight('#FFFFFF', 0.6);
  top.position.set(2, 12, 3);
  top.target.position.set(-1, 0, -1);
  top.castShadow = true;
  top.shadow.mapSize.set(2048, 2048);
  Object.assign(top.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 30 });
  top.shadow.radius = 9;
  top.shadow.blurSamples = 24;
  top.shadow.bias = -0.0004;
  top.shadow.normalBias = 0.03;
  scene.add(top, top.target);
  scene.add(new THREE.HemisphereLight('#F6F1EA', '#6E5240', 0.55));
  const fill = new THREE.DirectionalLight('#E2EBF1', 0.3);
  fill.position.set(12, 5, 10);
  scene.add(fill);

  /* ---------- room shell ---------- */
  const wallMat = new THREE.MeshStandardMaterial({ color: '#EBE4D9', roughness: 0.96 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#FAF8F4', roughness: 0.55 });
  const add = (geo, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const box = (w, h, d, x, y, z, mat, cast = true) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast);
  const wt = 0.3, back = WZ - wt / 2, left = WX - wt / 2;
  box(win.x0 - (WX - wt), H, wt, (WX - wt + win.x0) / 2, H / 2, back, wallMat);
  box(FAR - win.x1, H, wt, (win.x1 + FAR) / 2, H / 2, back, wallMat);
  box(win.x1 - win.x0, win.y0, wt, winC.x, win.y0 / 2, back, wallMat);
  box(win.x1 - win.x0, H - win.y1, wt, winC.x, (win.y1 + H) / 2, back, wallMat);
  box(wt, H, FAR - WZ + wt, left, H / 2, (WZ + FAR) / 2 - wt / 2, wallMat);
  const fw = 0.11, fz = WZ - 0.04;
  box(win.x1 - win.x0 + fw * 2, fw, 0.2, winC.x, win.y0 - fw / 2 + 0.02, fz, trimMat);
  box(win.x1 - win.x0 + fw * 2, fw, 0.2, winC.x, win.y1 + fw / 2 - 0.02, fz, trimMat);
  box(fw, win.y1 - win.y0, 0.2, win.x0 - fw / 2 + 0.02, winC.y, fz, trimMat);
  box(fw, win.y1 - win.y0, 0.2, win.x1 + fw / 2 - 0.02, winC.y, fz, trimMat);
  box(0.05, win.y1 - win.y0, 0.08, winC.x, winC.y, fz - 0.05, trimMat);
  for (const k of [1 / 3, 2 / 3]) box(win.x1 - win.x0, 0.05, 0.08, winC.x, win.y0 + (win.y1 - win.y0) * k, fz - 0.05, trimMat);
  box(win.x1 - win.x0 + 0.5, 0.07, 0.3, winC.x, win.y0 - 0.02, WZ + 0.09, trimMat);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(win.x1 - win.x0, win.y1 - win.y0),
    new THREE.MeshBasicMaterial({ color: '#F3F6F4', toneMapped: false }));
  glass.position.set(winC.x, winC.y, WZ - wt + 0.02);
  scene.add(glass);
  box(FAR - WX, 0.36, 0.06, (WX + FAR) / 2, 0.18, WZ + 0.03, trimMat, false);
  box(0.06, 0.36, FAR - WZ, WX + 0.03, 0.18, (WZ + FAR) / 2, trimMat, false);
  box(FAR - WX, 0.06, 0.07, (WX + FAR) / 2, H - 0.03, WZ + 0.035, trimMat, false);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(FAR - WX, FAR - WZ), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((WX + FAR) / 2, H, (WZ + FAR) / 2);
  ceiling.castShadow = true;
  scene.add(ceiling);
  const sub = new THREE.Mesh(new THREE.BoxGeometry(FAR - WX + 2, 0.1, FAR - WZ + 2), new THREE.MeshStandardMaterial({ color: '#3F3227', roughness: 1 }));
  sub.position.set((WX + FAR) / 2, -0.05, (WZ + FAR) / 2);
  sub.receiveShadow = true;
  scene.add(sub);

  // soft contact shading where floor meets walls
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 4; aoCanvas.height = 256;
  const ag = aoCanvas.getContext('2d');
  const grad = ag.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.35, '#555'); grad.addColorStop(1, '#000');
  ag.fillStyle = grad; ag.fillRect(0, 0, 4, 256);
  const aoTex = new THREE.CanvasTexture(aoCanvas);
  const aoMat = new THREE.MeshBasicMaterial({ color: '#2A1B12', alphaMap: aoTex, transparent: true, opacity: 0.42, depthWrite: false });
  const aoFloorBack = new THREE.Mesh(new THREE.PlaneGeometry(FAR - WX, 0.9), aoMat);
  aoFloorBack.rotation.x = -Math.PI / 2;
  aoFloorBack.position.set((WX + FAR) / 2, T + 0.004, WZ + 0.45);
  const aoFloorLeft = new THREE.Mesh(new THREE.PlaneGeometry(FAR - WZ, 0.9), aoMat);
  aoFloorLeft.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  aoFloorLeft.position.set(WX + 0.45, T + 0.004, (WZ + FAR) / 2);
  const aoWallMat = aoMat.clone(); aoWallMat.opacity = 0.16;
  const aoWallBack = new THREE.Mesh(new THREE.PlaneGeometry(FAR - WX, 1.1), aoWallMat);
  aoWallBack.rotation.z = Math.PI;
  aoWallBack.position.set((WX + FAR) / 2, 0.55, WZ + 0.002);
  const aoWallLeft = new THREE.Mesh(new THREE.PlaneGeometry(FAR - WZ, 1.1), aoWallMat);
  aoWallLeft.rotation.set(0, Math.PI / 2, Math.PI);
  aoWallLeft.position.set(WX + 0.002, 0.55, (WZ + FAR) / 2);
  scene.add(aoWallBack, aoWallLeft);

  /* ---------- furniture: linen sofa, walnut table, art, sheer curtains ---------- */
  const fabric = new THREE.MeshStandardMaterial({ color: '#D6CEC1', roughness: 0.97 });
  const metal = new THREE.MeshStandardMaterial({ color: '#1C252C', roughness: 0.45, metalness: 0.6 });
  const walnut = new THREE.MeshStandardMaterial({ color: '#56362A', roughness: 0.4 });
  const ceramic = new THREE.MeshStandardMaterial({ color: '#F1EDE6', roughness: 0.35 });
  const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, r);
  const sz = 0.9, sx = WX + 0.1, leg = 0.12;
  add(rb(1.05, 0.36, 3.5, 0.08), fabric, sx + 0.525, leg + 0.18, sz);
  add(rb(0.3, 0.68, 3.5, 0.1), fabric, sx + 0.15, leg + 0.36 + 0.26, sz);
  for (const s of [-1, 1]) add(rb(1.05, 0.56, 0.26, 0.09), fabric, sx + 0.525, leg + 0.28, sz + s * 1.62);
  for (const s of [-1, 1]) {
    add(rb(0.78, 0.17, 1.47, 0.07), fabric, sx + 0.3 + 0.39, leg + 0.36 + 0.085, sz + s * 0.74);
    const bc = add(rb(0.22, 0.52, 1.44, 0.1), fabric, sx + 0.42, leg + 0.36 + 0.17 + 0.24, sz + s * 0.74);
    bc.rotation.z = -0.12;
  }
  for (const [dx, dz] of [[0.1, -1.68], [0.95, -1.68], [0.1, 1.68], [0.95, 1.68]]) {
    add(new THREE.CylinderGeometry(0.025, 0.02, leg, 12), metal, sx + dx, leg / 2, sz + dz);
  }
  const tx = WX + 2.55, tz = sz;
  add(new THREE.CylinderGeometry(0.66, 0.66, 0.05, 72), walnut, tx, 0.43, tz);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const lg = add(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 10), metal, tx + Math.cos(a) * 0.44, 0.205, tz + Math.sin(a) * 0.44);
    lg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
  }
  const vase = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0.13, 0.08), new THREE.Vector2(0.12, 0.2),
    new THREE.Vector2(0.06, 0.32), new THREE.Vector2(0.05, 0.38), new THREE.Vector2(0.065, 0.42),
  ], 48);
  add(vase, ceramic, tx + 0.18, 0.455, tz - 0.12);
  add(new THREE.BoxGeometry(0.34, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: '#2C4357', roughness: 0.8 }), tx - 0.2, 0.48, tz + 0.12).rotation.y = 0.3;
  add(new THREE.BoxGeometry(0.3, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: '#C9A06F', roughness: 0.8 }), tx - 0.18, 0.525, tz + 0.1).rotation.y = 0.1;

  // framed print on the left wall, in the brand colors
  const art = document.createElement('canvas');
  art.width = 640; art.height = 440;
  const g2 = art.getContext('2d');
  g2.fillStyle = '#F2ECE2'; g2.fillRect(0, 0, 640, 440);
  g2.fillStyle = '#0B2739'; g2.beginPath(); g2.moveTo(80, 440); g2.lineTo(80, 230); g2.arc(250, 230, 170, Math.PI, 0); g2.lineTo(420, 440); g2.fill();
  g2.fillStyle = '#B98353'; g2.beginPath(); g2.arc(470, 150, 70, 0, Math.PI * 2); g2.fill();
  g2.fillStyle = '#734537'; g2.fillRect(330, 300, 230, 140);
  const artTex = new THREE.CanvasTexture(art);
  artTex.colorSpace = THREE.SRGBColorSpace;
  box(0.05, 1.32, 1.86, WX + 0.03, 2.7, sz, new THREE.MeshStandardMaterial({ color: '#20262B', roughness: 0.5 }));
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.17), new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.9 }));
  print.rotation.y = Math.PI / 2;
  print.position.set(WX + 0.057, 2.7, sz);
  scene.add(print);

  // sheer curtains beside the window
  const curtainGeo = new THREE.PlaneGeometry(1.0, H - 0.5, 48, 1);
  const cp = curtainGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * Math.PI * 7) * 0.05);
  curtainGeo.computeVertexNormals();
  const curtainMat = new THREE.MeshStandardMaterial({ color: '#F7F3EC', roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  for (const cx of [win.x0 - 0.5, win.x1 + 0.5]) {
    const c = add(curtainGeo, curtainMat, cx, (H - 0.5) / 2 + 0.02, WZ + 0.2);
    c.castShadow = true;
  }
  box(win.x1 - win.x0 + 2.6, 0.04, 0.04, winC.x, H - 0.45, WZ + 0.2, metal, false);

  // soft contact shadows that ground the furniture on the floor
  const blobTex = (round) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    g.filter = 'blur(16px)';
    g.fillStyle = '#fff';
    if (round) { g.beginPath(); g.arc(128, 128, 84, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.roundRect(34, 34, 188, 188, 26); g.fill(); }
    return new THREE.CanvasTexture(c);
  };
  const contact = (round, w, d, x, z, opacity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
      color: '#1F130B', alphaMap: blobTex(round), transparent: true, opacity, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, T + 0.006, z);
    m.renderOrder = 2;
    scene.add(m);
  };
  contact(false, 2.4, 4.9, sx + 0.72, sz, 0.75);
  contact(false, 0.55, 4.1, sx + 1.08, sz, 0.55);
  contact(true, 2.5, 2.5, tx + 0.05, tz, 0.5);
  for (const [dx, dz] of [[0.1, -1.68], [0.95, -1.68], [0.1, 1.68], [0.95, 1.68]]) contact(true, 0.22, 0.22, sx + dx, sz + dz, 0.7);

  /* ---------- wood ---------- */
  const tex = woodTexture(renderer.capabilities.getMaxAnisotropy());
  const clip = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -WX), new THREE.Plane(new THREE.Vector3(0, 0, 1), -WZ)];
  const makeWood = (edge) => {
    const m = new THREE.MeshPhysicalMaterial({
      map: tex, bumpMap: tex, bumpScale: 0.35,
      color: new THREE.Color(FINISHES.honey.color),
      roughness: SHEENS.satin.rough, clearcoat: SHEENS.satin.coat, clearcoatRoughness: 0.1,
      envMapIntensity: 0.75, clippingPlanes: clip,
    });
    if (edge) m.defines = { WA_EDGE: '' };
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aOff;\nvarying vec2 vEdge;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vEdge = vMapUv;\n  vMapUv += aOff;\n#endif');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vEdge;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          #ifdef WA_EDGE
            float ex = min(vEdge.x, 1.0 - vEdge.x);
            float ey = min(vEdge.y, 1.0 - vEdge.y);
            float bevel = smoothstep(0.0, 0.01, ex) * smoothstep(0.0, 0.07, ey);
            diffuseColor.rgb *= mix(0.6, 1.0, bevel);
          #endif`);
    };
    m.customProgramCacheKey = () => (edge ? 'wa-wood-edge' : 'wa-wood');
    return m;
  };
  const woodMats = [makeWood(true), makeWood(false)];

  const floor = new THREE.Group();
  scene.add(floor);
  let meshes = [];
  let anim = { t: 1 };

  function layFloor(kind) {
    meshes.forEach((m) => { floor.remove(m); m.geometry.dispose(); });
    meshes = [];
    seed = 11;
    const parts = BUILDERS[kind]();
    const corner = new THREE.Vector2(WX, WZ);
    parts.forEach((part) => {
      const n = part.items.length;
      const mesh = new THREE.InstancedMesh(part.geometry, part.base ? woodMats[1] : woodMats[0], n);
      mesh.receiveShadow = true;
      const off = new Float32Array(n * 2);
      const tint = new THREE.Color();
      part.items.forEach((it, i) => {
        off[i * 2] = rnd(); off[i * 2 + 1] = rnd();
        const k = 0.86 + rnd() * 0.2;
        mesh.setColorAt(i, tint.setRGB(k, k * (0.98 + rnd() * 0.03), k * (0.95 + rnd() * 0.05)));
        it.delay = Math.min(1, new THREE.Vector2(it.x, it.z).distanceTo(corner) / 16) * 0.75 + rnd() * 0.05;
      });
      part.geometry.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
      mesh.userData.items = part.items;
      mesh.userData.base = !!part.base;
      floor.add(mesh);
      meshes.push(mesh);
    });
    anim = { t: reduced ? 1 : 0, start: performance.now() };
    placeAll(anim.t);
  }

  const dummy = new THREE.Object3D();
  function placeAll(t) {
    meshes.forEach((mesh) => {
      const items = mesh.userData.items;
      const yBase = mesh.userData.base ? 0 : T / 2;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const k = clamp01((t * 1.45 - it.delay) / 0.45);
        const e = easeOut(k);
        dummy.position.set(it.x, yBase + (1 - e) * 1.4, it.z);
        dummy.rotation.set(0, it.ry, (1 - e) * 0.16);
        const vis = k > 0 ? 1 : 0.0001;
        dummy.scale.set(it.sx * vis, vis, vis);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  /* ---------- controls ---------- */
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  const baseAz = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
  controls.minAzimuthAngle = baseAz - 0.45;
  controls.maxAzimuthAngle = baseAz + 0.38;
  controls.minPolarAngle = 0.95;
  controls.maxPolarAngle = 1.28;
  controls.update();
  if (coarse) {
    controls.enableRotate = false;
    canvas.style.touchAction = 'pan-y';
  }
  let lastTouch = -1e9, swayDir = 1;
  controls.addEventListener('start', () => { lastTouch = performance.now(); section.classList.add('has-dragged'); });
  controls.addEventListener('end', () => { lastTouch = performance.now(); });

  /* ---------- panel ---------- */
  const state = { pattern: 'herringbone', finish: 'honey', sheen: 'satin' };
  const targetColor = new THREE.Color(FINISHES.honey.color);
  const target3 = { rough: SHEENS.satin.rough, coat: SHEENS.satin.coat };
  const finishName = section.querySelector('.js-finish-name');
  const lookEl = section.querySelector('.js-look');
  const lookText = () => `${PATTERNS[state.pattern]}, ${FINISHES[state.finish].name}, ${SHEENS[state.sheen].name}`;
  const syncText = () => {
    finishName.textContent = FINISHES[state.finish].name;
    section.style.setProperty('--wood', FINISHES[state.finish].color);
    if (lookEl) lookEl.textContent = lookText();
  };
  section.querySelectorAll('input[name="pattern"], input[name="finish"], input[name="sheen"]').forEach((inp) => {
    inp.addEventListener('change', () => {
      state[inp.name] = inp.value;
      if (inp.name === 'pattern') layFloor(inp.value);
      if (inp.name === 'finish') targetColor.set(FINISHES[inp.value].color);
      if (inp.name === 'sheen') { target3.rough = SHEENS[inp.value].rough; target3.coat = SHEENS[inp.value].coat; }
      syncText();
      kick();
    });
  });
  syncText();

  section.querySelector('.js-look-cta')?.addEventListener('click', () => {
    const form = document.querySelector('#estimate form');
    if (!form) return;
    const sel = form.elements.service;
    if (sel && 'value' in sel) sel.value = 'Floor Installation';
    const msg = form.elements.message;
    if (msg) {
      const line = `Look I like: ${lookText()}.`;
      msg.value = msg.value.replace(/^Look I like:.*$/m, '').trim();
      msg.value = msg.value ? `${line}\n${msg.value}` : line;
    }
  });

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 50 : 34;
    camera.updateProjectionMatrix();
    kick();
  }
  new ResizeObserver(resize).observe(canvas);

  let visible = false, running = false, started = false, last = performance.now();
  function kick() { if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let busy = false;
    if (anim.t < 1) { anim.t = Math.min(1, (now - anim.start) / 1500); placeAll(anim.t); busy = true; }
    const mat = woodMats[0];
    if (mat.color.getHex() !== targetColor.getHex()) {
      const c = mat.color.clone().lerp(targetColor, Math.min(1, dt * 7));
      if (Math.abs(c.r - targetColor.r) + Math.abs(c.g - targetColor.g) + Math.abs(c.b - targetColor.b) < 0.003) c.copy(targetColor);
      woodMats.forEach((m) => m.color.copy(c));
      busy = true;
    }
    for (const [key, prop] of [['rough', 'roughness'], ['coat', 'clearcoat']]) {
      const d = target3[key] - mat[prop];
      const v = Math.abs(d) > 0.002 ? mat[prop] + d * Math.min(1, dt * 6) : target3[key];
      if (Math.abs(d) > 0.002) busy = true;
      woodMats.forEach((m) => { m[prop] = v; });
    }
    if (!reduced && now - lastTouch > 2600) {
      controls.autoRotate = true;
      const az = controls.getAzimuthalAngle();
      if (az > controls.maxAzimuthAngle - 0.03) swayDir = -1;
      if (az < controls.minAzimuthAngle + 0.03) swayDir = 1;
      controls.autoRotateSpeed = 0.24 * swayDir;
      busy = true;
    } else {
      controls.autoRotate = false;
    }
    if (controls.update()) busy = true;
    if (now - lastTouch < 1200) busy = true;
    renderer.render(scene, camera);
    if (!section.classList.contains('is-ready')) section.classList.add('is-ready');
    if (visible && busy) requestAnimationFrame(frame);
    else running = false;
  }
  controls.addEventListener('change', kick);

  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !started) { started = true; layFloor(state.pattern); }
    kick();
  }, { rootMargin: '150px 0px' }).observe(section);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); section.classList.add('no-webgl'); });
}
