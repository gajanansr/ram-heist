// The facility: partitioned server room with hiding spots, props, lighting
import * as THREE from 'three';
import { aoHide } from './engine.js';

const rand = (a, b) => a + Math.random() * (b - a);
export const HX = 14, HZ = 10, WALL_H = 4;

const mat = (color, rough = 0.6, metal = 0.1, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildWorld(scene) {
  const W = { HX, HZ, bounds: { hx: HX, hz: HZ }, obstacles: [], spots: [], ledMeshes: [], flickerables: [], beacons: [] };
  const root = new THREE.Group(); scene.add(root);
  const obstacle = (x, z, hx, hz, o = {}) => { const ob = { x, z, hx, hz, solid: true, block: true, ...o }; W.obstacles.push(ob); return ob; };
  const box = (w, h, d, m, x, y, z, parent = root, shadow = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };

  // ── textures
  const floorColor = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#1a2128'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
    g.strokeStyle = '#090d11'; g.lineWidth = 5; g.strokeRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,214,77,.22)'; g.lineWidth = 3; g.setLineDash([22, 18]); g.strokeRect(10, 10, s - 20, s - 20);
  }, [14, 10]);
  const floorRough = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) { const v = Math.floor(rand(40, 200)); g.fillStyle = `rgba(${v},${v},${v},0.22)`; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, rand(5, 55), 0, 7); g.fill(); }
  }, [14, 10], false);
  const wallTex = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#212a32'; g.fillRect(0, 0, s, s); g.strokeStyle = '#11171c'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.stroke(); g.beginPath(); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke(); }
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, [7, 1.2]);
  const aoTex = canvasTex(128, 128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(0,0,0,.8)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, [1, 1], false);
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: 0.85 });
  const contactAO = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.8, d + 0.8), aoMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); root.add(m); aoHide.push(m); };

  // ── shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), mat(0xffffff, 0.9, 0.2, { map: floorColor, roughnessMap: floorRough, envMapIntensity: 1.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), mat(0x0d1216, 0.95, 0)); ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; root.add(ceil);
  const wallMat = mat(0xffffff, 0.85, 0.05, { map: wallTex });
  for (const [x, z, w, ry] of [[0, -HZ, HX * 2, 0], [0, HZ, HX * 2, Math.PI], [-HX, 0, HZ * 2, Math.PI / 2], [HX, 0, HZ * 2, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), wallMat); m.position.set(x, WALL_H / 2, z); m.rotation.y = ry; m.receiveShadow = true; root.add(m);
  }
  // partition walls make corridors + cover
  const part = mat(0xffffff, 0.8, 0.1, { map: wallTex.clone() }); part.map.repeat.set(3, 1.2); part.map.needsUpdate = true;
  for (const [x, z, hz] of [[-5, -4, 6], [5, 4, 6]]) {
    box(0.3, WALL_H, hz * 2, part, x, WALL_H / 2, z); obstacle(x, z, 0.15, hz); contactAO(x, z, 0.3, hz * 2);
    box(0.34, 0.12, hz * 2 + 0.04, mat(0x39ff9c, 0.4, 0.2, { emissive: 0x39ff9c, emissiveIntensity: 0.6 }), x, 0.06, z, root, false); // floor-edge glow strip
  }
  // short half-wall cover pieces
  for (const [x, z, hx, hz] of [[-9.5, 3.5, 0.2, 2.2], [9.5, -4.5, 0.2, 2.2]]) { box(hx * 2, 1.2, hz * 2, mat(0x2b353e, 0.6, 0.3), x, 0.6, z); obstacle(x, z, hx, hz, { block: false }); contactAO(x, z, hx * 2, hz * 2); }

  // ── posters / signage
  function poster(text, sub, x, y, z, ry, w = 1.8, h = 1.1, col = '#39ff9c') {
    const t = canvasTex(256, 160, (g, cw, ch) => {
      g.fillStyle = '#0b1218'; g.fillRect(0, 0, cw, ch); g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(6, 6, cw - 12, ch - 12);
      g.fillStyle = col; g.font = 'bold 26px monospace'; g.textAlign = 'center';
      text.split('\n').forEach((l, i) => g.fillText(l, cw / 2, 56 + i * 30)); g.font = '14px monospace'; g.fillStyle = '#8da3b1'; g.fillText(sub, cw / 2, ch - 22);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.6 }));
    m.position.set(x, y, z); m.rotation.y = ry; root.add(m);
  }
  poster('COMPUTE\nIS ALL\nYOU NEED', 'scaling since 2018', -4.84, 2.2, -2, Math.PI / 2, 2.2, 1.4);
  poster('RAM FOR\nEVERYONE', 'hackerspace rule #1', 4.84, 2.2, 6, -Math.PI / 2, 1.6, 1.0, '#ffd24d');
  poster('NO FOOD\nNEAR SERVERS', 'sam: "nonnegotiable"', -13.9, 2.1, -4, Math.PI / 2, 1.8, 1.1, '#ff4d5e');
  poster('NIGHT\nSHIFT', 'ravi in IT ext. 404', 13.9, 2.3, 4, -Math.PI / 2, 1.6, 1.0, '#6fd3ff');

  // ── ceiling: light panels, pipes, cable trays
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.85, 1).multiplyScalar(1.5) }); W.stripMat = stripMat;
  for (let i = -3; i <= 3; i++) for (const z of [-5, 5]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 4.5), stripMat); s.position.set(i * 4, WALL_H - 0.03, z); root.add(s); W.flickerables.push(s); }
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, HX * 2, 10), mat(0x2a343c, 0.4, 0.8)); p.rotation.z = Math.PI / 2; p.position.set(0, WALL_H - 0.2 - i * 0.02, -8 + i * 5.2); root.add(p); }
  for (let z = -9; z <= 9; z += 6) box(HX * 2, 0.1, 0.5, mat(0x1c242b, 0.5, 0.7), 0, WALL_H - 0.55, z, root, false);

  // ── lighting
  W.hemi = new THREE.HemisphereLight(0x6f8fb0, 0x0a0d12, 0.34); scene.add(W.hemi);
  W.accents = [];
  for (const [x, y, z, c] of [[-10, 2.6, -6, 0x1fe0ff], [10, 2.6, -6, 0xff3df2], [0, 3, 0, 0x4a6bff], [-10, 2.6, 6, 0x39ff9c], [10, 2.6, 6, 0x1fe0ff], [0, 2.6, 8, 0xffa53d]]) {
    const l = new THREE.PointLight(c, 13, 13, 2); l.position.set(x, y, z); scene.add(l); W.accents.push(l);
  }
  for (const [x, z] of [[-13, -9], [13, -9], [13, 9], [-13, 9]]) { // red alarm beacons
    const l = new THREE.PointLight(0xff2030, 0, 16, 2); l.position.set(x, 3.5, z); scene.add(l);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0x300008 })); bulb.position.copy(l.position); root.add(bulb); W.beacons.push({ l, bulb });
  }

  // ── server racks
  function rack(x, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    box(1.5, 2.6, 0.9, mat(0x0d1115, 0.35, 0.8), 0, 1.3, 0, g); box(1.4, 2.4, 0.04, mat(0x05080b, 0.5, 0.4), 0, 1.3, 0.43, g);
    const n = 90, inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), new THREE.MeshBasicMaterial(), n), m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < n; i++) { const r = Math.floor(i / 10), c = i % 10; m4.setPosition(-0.6 + c * 0.14, 0.3 + r * 0.25 + (c % 2) * 0.05, 0.46); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.setHSL(Math.random() > 0.3 ? 0.4 : 0.55, 1, 0.5).multiplyScalar(2)); }
    g.add(inst); W.ledMeshes.push(inst); aoHide.push(inst);
    for (let r = 0; r < 9; r++) box(1.3, 0.02, 0.02, mat(0x1c2630, 0.3, 0.9), 0, 0.22 + r * 0.25, 0.45, g, false);
    const sw = Math.abs(Math.sin(ry)) > 0.5;
    obstacle(x, z, sw ? 0.45 : 0.75, sw ? 0.75 : 0.45); contactAO(x, z, sw ? 0.9 : 1.5, sw ? 1.5 : 0.9);
  }
  for (const x of [-11, -8.5, -2, 0.5, 3, 8.5, 11]) rack(x, -HZ + 0.6);
  rack(HX - 0.6, 5.5, -Math.PI / 2); rack(HX - 0.6, 3.4, -Math.PI / 2); rack(-HX + 0.6, -6, Math.PI / 2);
  // floor cables
  const cableMat = mat(0x07090c, 0.5, 0.3);
  for (const pts of [[[-11, -8.8], [-9, -6.5], [-6.5, -5.5]], [[0.5, -8.7], [1.5, -6], [3.2, -4.4]], [[8.5, -8.8], [7.5, -5.5], [6.2, -2.4]]]) {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.04, z))); const t = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.04, 6), cableMat); t.receiveShadow = true; root.add(t);
  }

  // ── hiding spots
  const ringGeo = new THREE.RingGeometry(0.85, 0.95, 40);
  function spot(name, x, z, build, hx, hz, cap = 2, o = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = o.ry || 0; root.add(g); build(g);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x39ff9c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.03, 0); g.add(ring); aoHide.push(ring);
    if (hx) { obstacle(x, z, hx, hz, { block: !!o.block }); contactAO(x, z, hx * 2, hz * 2); }
    W.spots.push({ name, pos: new THREE.Vector3(x, 0, z), group: g, ring, stash: 0, baseCap: cap, cap, ry: o.ry || 0 });
  }
  const metal = mat(0x56636d, 0.35, 0.85);
  spot('Locker', -13.2, 1, (g) => { g.rotation.y = 0; for (let i = 0; i < 3; i++) { box(0.8, 2.2, 0.8, mat(0x2f5f7a, 0.4, 0.7), 0, 1.1, i * 0.85 - 0.85, g); box(0.04, 0.5, 0.5, metal, 0.42, 1.3, i * 0.85 - 0.85, g); for (let v = 0; v < 4; v++) box(0.02, 0.03, 0.4, mat(0x050607), 0.41, 1.9 + v * 0.06, i * 0.85 - 0.85, g, false); } }, 0.5, 1.4, 3, { block: true });
  spot('Couch', -9, -3.5, (g) => { const fab = mat(0x5b2a3a, 0.95, 0); box(2.6, 0.45, 1.0, fab, 0, 0.3, 0, g); box(2.6, 0.7, 0.25, fab, 0, 0.8, -0.4, g); box(0.25, 0.6, 1.0, fab, -1.3, 0.55, 0, g); box(0.25, 0.6, 1.0, fab, 1.3, 0.55, 0, g); for (const dx of [-0.6, 0.6]) box(1.0, 0.18, 0.8, mat(0x6b3347, 1, 0), dx, 0.6, 0.05, g); }, 1.4, 0.6, 2);
  spot('Plant', -8, 6.5, (g) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.7, 20), mat(0x6b3b2a, 0.8, 0)); pot.position.y = 0.35; pot.castShadow = true; g.add(pot);
    const leaf = mat(0x1f7a3a, 0.7, 0, { side: THREE.DoubleSide });
    for (let i = 0; i < 18; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), leaf); l.scale.set(0.5, 1.8, 0.14); const a = i / 18 * Math.PI * 2; l.position.set(Math.cos(a) * 0.3, 1.15 + (i % 3) * 0.2, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65); l.castShadow = true; g.add(l); }
  }, 0.45, 0.45, 2);
  spot('Trash Bin', -2.5, 3, (g) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.9, 20, 1, true), mat(0x3a4650, 0.4, 0.8, { side: THREE.DoubleSide })); b.position.y = 0.45; b.castShadow = true; g.add(b);
    const bt = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), mat(0x20272d)); bt.rotation.x = -Math.PI / 2; bt.position.y = 0.05; g.add(bt);
    for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat(0xb9b9a8, 1, 0)); p.position.set(rand(-0.15, 0.15), 0.85 + rand(0, 0.08), rand(-0.15, 0.15)); g.add(p); }
  }, 0.4, 0.4, 2);
  spot('Crate', 0, -4, (g) => { box(1.3, 1.0, 1.3, mat(0x8a6a3a, 0.8, 0), 0, 0.5, 0, g); for (const y of [0.1, 0.5, 0.9]) box(1.34, 0.08, 1.34, mat(0x5a4426, 0.8, 0), 0, y, 0, g, false); box(0.3, 0.22, 0.02, mat(0xf2e2b4, 1, 0), 0.4, 0.6, 0.67, g, false); }, 0.7, 0.7, 2);
  spot('Desk', 1.5, 7.5, (g) => {
    box(2.6, 0.08, 1.2, mat(0x7a5b3c, 0.5, 0.05), 0, 0.8, 0, g); box(0.08, 0.8, 1.1, metal, -1.2, 0.4, 0, g); box(0.08, 0.8, 1.1, metal, 1.2, 0.4, 0, g); box(2.4, 0.5, 0.04, metal, 0, 0.45, -0.52, g);
    const scr = canvasTex(128, 80, (c, w, h) => { c.fillStyle = '#021a12'; c.fillRect(0, 0, w, h); c.fillStyle = '#39ff9c'; c.font = '9px monospace'; for (let i = 0; i < 7; i++) c.fillText(`$ alloc ${Math.floor(Math.random() * 999)}GB ok`, 5, 12 + i * 10); });
    box(0.56, 0.36, 0.04, mat(0x080b0e, 0.2, 0.5), 0, 1.12, -0.25, g); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(1.6, 1.6, 1.6) })); p.position.set(0, 1.12, -0.225); g.add(p);
    box(0.4, 0.02, 0.15, mat(0x111418), 0, 0.85, 0.1, g, false); const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), mat(0xeeeeee, 0.4, 0)); mug.position.set(0.9, 0.89, 0.1); g.add(mug);
  }, 1.3, 0.6, 2);
  spot('Vent', HX - 0.9, -2, (g) => { g.rotation.y = -Math.PI / 2; box(1.4, 1.0, 0.14, metal, 0, 0.9, 0.78, g); for (let i = 0; i < 7; i++) box(1.25, 0.04, 0.05, mat(0x0a0d10, 0.5, 0.8), 0, 0.5 + i * 0.12, 0.7, g, false); }, 0, 0, 2);
  spot('Supply Cabinet', 9.5, HZ - 0.5, (g) => { g.rotation.y = Math.PI; box(1.6, 1.8, 0.7, mat(0x3a4650, 0.5, 0.6), 0, 0.9, 0, g); box(0.02, 1.6, 0.02, mat(0x000000), 0, 0.9, 0.36, g, false); box(0.12, 0.3, 0.05, metal, 0.5, 0.95, 0.38, g, false); }, 0.8, 0.4, 3, { block: true });
  spot('Rack Bay', 0.5, -8.3, (g) => { box(1.3, 0.3, 0.05, mat(0x1c2630, 0.3, 0.9), 0, 0.9, 0, g, false); }, 0, 0, 2);
  spot('Water Cooler', 10, 3, (g) => {
    box(0.5, 1.1, 0.5, mat(0xd8dde0, 0.5, 0.2), 0, 0.55, 0, g); const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 16), mat(0x6fb8ff, 0.1, 0, { transparent: true, opacity: 0.55 })); jug.position.y = 1.35; g.add(jug);
  }, 0.3, 0.3, 2);
  spot('Fridge', -12.6, 8, (g) => { g.rotation.y = Math.PI / 2; box(0.9, 1.8, 0.8, mat(0xcfd6db, 0.35, 0.5), 0, 0.9, 0, g); box(0.04, 0.6, 0.04, metal, 0.42, 1.1, 0.3, g, false); }, 0.5, 0.5, 3, { block: true });

  // ── dust motes (volumetric feel)
  const dn = 500, dpos = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { dpos[i * 3] = rand(-HX, HX); dpos[i * 3 + 1] = rand(0.2, WALL_H - 0.2); dpos[i * 3 + 2] = rand(-HZ, HZ); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 0.05, map: canvasTex(32, 32, (g, q) => { const r = g.createRadialGradient(q / 2, q / 2, 0, q / 2, q / 2, q / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, q, q); }), alphaTest: 0.01, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  root.add(dust); aoHide.push(dust);

  // ── state
  W.blackout = false; W.flicker = false; W.alert = 0; W.flickerT = 0; W.lightLevel = 1;
  W.setBlackout = (b) => { W.blackout = b; };
  W.setFlicker = (f) => { W.flicker = f; };
  W.resetSpots = (extraCap = 0) => { for (const s of W.spots) { s.stash = 0; s.cap = s.baseCap + extraCap; } };
  W.stashTotal = () => W.spots.reduce((n, s) => n + s.stash, 0);
  W.update = (t, dt) => {
    // flicker model
    let level = 1;
    if (W.flicker) { W.flickerT -= dt; if (W.flickerT <= 0) { W.flickerT = Math.random() < 0.15 ? rand(0.04, 0.2) : rand(0.5, 3); W._flk = Math.random() < 0.15 ? 1 : 0; } if (W._flk) level = Math.random() > 0.5 ? 0.25 : 1; }
    const target = W.blackout ? 0.0 : level; W.lightLevel += (target - W.lightLevel) * Math.min(1, dt * 12);
    const L = W.lightLevel;
    stripMat.color.setRGB(0.7 * 1.5 * L + 0.01, 0.85 * 1.5 * L + 0.012, 1.5 * L + 0.02);
    W.hemi.intensity = 0.07 + 0.6 * L; W.accents.forEach((l, i) => { l.intensity = 3 + 18 * L * (0.85 + 0.15 * Math.sin(t * 1.3 + i)); });
    scene.fog.density = 0.032 + (W.blackout ? 0.012 : 0); renderer_exposure(W.introDim ? 0.9 : W.blackout ? 1.6 : 1.45);
    // beacons
    for (const [i, b] of W.beacons.entries()) { const on = W.alert > 0.05 ? (0.5 + 0.5 * Math.sin(t * 7 + i * 1.6)) * W.alert : 0; b.l.intensity = 90 * on; b.bulb.material.color.setRGB(0.2 + on * 4, 0.01, 0.02 + on * 0.3); }
    // LEDs
    for (const inst of W.ledMeshes) { for (let k = 0; k < 4; k++) { const i = Math.floor(Math.random() * inst.count); inst.setColorAt(i, _c.setHSL(Math.random() > 0.15 ? 0.38 : 0.02, 1, 0.5).multiplyScalar(Math.random() > 0.3 ? 2.2 : 0.12)); } inst.instanceColor.needsUpdate = true; }
    // dust drift
    const p = dg.attributes.position; for (let i = 0; i < dn; i++) { p.array[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.05; p.array[i * 3 + 1] += Math.sin(t * 0.2 + i * 1.7) * dt * 0.03; } p.needsUpdate = true;
  };
  const _c = new THREE.Color();
  let _renderer = null; function renderer_exposure(v) { if (!_renderer) _renderer = W.renderer; if (_renderer) _renderer.toneMappingExposure += (v - _renderer.toneMappingExposure) * 0.05; }
  W.root = root;
  return W;
}
