import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { renderer, scene, camera, render, fxPass, setQuality, quality, aoHide, bloom } from './engine.js';
import { buildWorld } from './world.js';
import { NavGrid } from './nav.js';
import { Player } from './player.js';
import { Sam, loadSamModel, setFlip, hasModel, assets } from './sam.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import { whoFor, textFor } from './voice.js';
import { NIGHTS, UPGRADES, ENDLESS, defaultSave, loadSave, writeSave, loadBest, saveBest } from './data.js';
import { inject, track } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { INTROS, ENDING, TIPS, NIGHT_TIPS, FAIL_LINES } from './dialogue.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
setFlip(params.has('flip'));
const $ = ui.$;
// Vercel Web Analytics + Speed Insights (skipped in ?debug test mode). Custom events show up in the Analytics dashboard.
if (!DEBUG) { try { inject(); injectSpeedInsights(); } catch { } }
const trk = (name, props) => { if (DEBUG) return; try { track(name, props); } catch { } };
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t) % 60).padStart(2, '0')}`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ───────────────────────── setup ─────────────────────────
const controls = new PointerLockControls(camera, document.body);
const world = buildWorld(scene); world.renderer = renderer;
world.obstacles.push({ x: -12.4, z: -8.3, hx: 0.9, hz: 0.45, solid: true, block: false }); // the People's Cluster console
const nav = new NavGrid(world.bounds, world.obstacles, 0.5, 0.5);
const player = new Player(controls, world, scene);
player.onStep = () => { if (player.hiddenIn) return; audio.sfx(player.crouching ? 'footstep_crouch' : player.sprinting ? 'footstep_run' : 'footstep_walk', { vol: player.crouching ? 0.45 : player.sprinting ? 0.9 : 0.7 }); };
player.nav = nav;
const HIDEABLE = new Set(['Locker', 'Couch', 'Desk', 'Crate', 'Supply Cabinet', 'Fridge']);

// RAM stick viewmodel
function makeRam() {
  const g = new THREE.Group(), mat = (c, r, m, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.133, 0.031, 0.004), mat(0x0f6b3a, 0.35, 0.2, { emissive: 0x03351a, emissiveIntensity: 0.25 })));
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.005), mat(0x111111, 0.4, 0.3)); c.position.set(-0.05 + i * 0.0145, 0.003, 0.004); g.add(c); }
  const pins = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.004, 0.0045), mat(0xd9b24a, 0.25, 1)); pins.position.y = -0.0145; g.add(pins);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.133, 0.002, 0.0046), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1, 0.6).multiplyScalar(1.3) })); glow.position.y = 0.0165; g.add(glow);
  return g;
}
const handRam = makeRam(); handRam.visible = false;
const viewRam = makeRam(); viewRam.scale.setScalar(1.25); viewRam.position.set(0.3, -0.24, -0.6); viewRam.rotation.set(0.2, -0.5, 0.15); camera.add(viewRam); aoHide.push(viewRam);

// ───────────────────────── visible chips: spot markers, holographic stash, carry indicator ─────────────────────────
const texCache = new Map();
function markerTex(kind, n = 0) {
  const key = kind + n; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const chip = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); g.fillStyle = '#05140c'; for (let i = 0; i < 5; i++) g.fillRect(x + 6 + i * (w - 12) / 5, y + 6, (w - 12) / 5 - 4, h - 20); g.fillStyle = '#ffd24d'; for (let i = 0; i < 9; i++) g.fillRect(x + 4 + i * (w - 8) / 9, y + h - 8, (w - 8) / 9 - 2, 8); };
  if (kind === 'hide') { g.fillStyle = 'rgba(8,20,14,.75)'; g.beginPath(); g.roundRect(30, 14, 196, 100, 18); g.fill(); g.strokeStyle = '#39ff9c'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#39ff9c'; g.font = 'bold 34px monospace'; g.fillText('HIDE HERE', 128, 46); g.font = '26px monospace'; g.fillText('▼  press E', 128, 86); }
  else if (kind === 'stash') { g.fillStyle = 'rgba(8,20,14,.75)'; g.beginPath(); g.roundRect(40, 14, 176, 100, 18); g.fill(); g.strokeStyle = '#39ff9c'; g.lineWidth = 4; g.stroke(); chip(58, 34, 96, 56, '#0f8a4a'); g.fillStyle = '#d8ffea'; g.font = 'bold 44px monospace'; g.fillText('×' + n, 188, 64); }
  else if (kind === 'cluster') { g.fillStyle = 'rgba(40,30,4,.85)'; g.beginPath(); g.roundRect(14, 10, 228, 108, 18); g.fill(); g.strokeStyle = '#ffd24d'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#ffd24d'; g.font = 'bold 22px monospace'; g.fillText("PEOPLE'S CLUSTER", 128, 42); g.fillStyle = '#fff3c4'; g.font = 'bold 34px monospace'; g.fillText(n, 128, 86); }
  else if (kind === 'power') { g.fillStyle = 'rgba(4,24,34,.85)'; g.beginPath(); g.roundRect(30, 14, 196, 100, 18); g.fill(); g.strokeStyle = n ? '#62c8ff' : '#556'; g.lineWidth = 4; g.stroke(); g.fillStyle = n ? '#9fdcff' : '#778'; g.font = 'bold 34px monospace'; g.fillText(n ? 'CUT POWER' : 'RECHARGING', 128, 46); g.font = '24px monospace'; g.fillText(n ? 'press E' : 'wait...', 128, 86); }
  else if (kind === 'pickup') { g.fillStyle = 'rgba(40,30,4,.8)'; g.beginPath(); g.roundRect(40, 14, 176, 100, 18); g.fill(); g.strokeStyle = '#ffd24d'; g.lineWidth = 4; g.stroke(); chip(58, 34, 96, 56, '#0f8a4a'); g.fillStyle = '#ffe9a0'; g.font = 'bold 40px monospace'; g.fillText('+1', 188, 64); }
  else if (kind === 'carry') { g.fillStyle = 'rgba(8,20,30,.7)'; g.beginPath(); g.roundRect(60, 24, 136, 80, 16); g.fill(); g.strokeStyle = '#6fd3ff'; g.lineWidth = 3; g.stroke(); chip(72, 40, 60, 40, '#0f8a4a'); g.fillStyle = '#d8f4ff'; g.font = 'bold 36px monospace'; g.fillText('×' + n, 164, 62); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
function holoRam() {
  const g = makeRam(); g.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 0.9), transparent: true, opacity: 0.85, depthTest: false }); }); g.scale.setScalar(5.5); g.renderOrder = 19; return g;
}
const markers = world.spots.map((sp) => {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('hide'), transparent: true, depthTest: false, depthWrite: false })); spr.renderOrder = 20; spr.scale.set(1.5, 0.75, 1); spr.position.set(sp.pos.x, 2.55, sp.pos.z); scene.add(spr);
  const holo = new THREE.Group(); holo.position.set(sp.pos.x, 2.0, sp.pos.z); scene.add(holo); const chips = [];
  for (let i = 0; i < 5; i++) { const h = holoRam(); h.position.x = (i - 2) * 0.0; h.visible = false; holo.add(h); chips.push(h); }
  aoHide.push(spr, holo); return { sp, spr, holo, chips, key: '' };
});
const carrySpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('carry', 0), transparent: true, depthTest: false, depthWrite: false })); carrySpr.renderOrder = 20; carrySpr.scale.set(1.0, 0.5, 1); scene.add(carrySpr); aoHide.push(carrySpr); carrySpr.visible = false;
function updateMarkers(t, nearest, show) {
  for (const m of markers) {
    const st = m.sp.stash, full = st >= m.sp.cap; m.spr.visible = show;
    const key = st > 0 ? 'stash' + st : (G.carry > 0 && !full ? 'hide' : 'none');
    if (key !== m.key) { m.key = key; if (key.startsWith('stash')) m.spr.material.map = markerTex('stash', st); else if (key === 'hide') m.spr.material.map = markerTex('hide'); m.spr.material.needsUpdate = true; }
    m.spr.visible = show && key !== 'none';
    const near = m.sp === nearest, pulse = 1 + Math.sin(t * 3 + m.sp.pos.x) * 0.05, cap = Math.min(1, camera.position.distanceTo(m.spr.position) / 6.5); m.spr.scale.set((near ? 1.9 : 1.35) * pulse * cap, (near ? 0.95 : 0.68) * pulse * cap, 1); m.spr.material.opacity = near ? 1 : 0.8;
    m.chips.forEach((c, i) => { c.visible = show && i < st; if (c.visible) { const sp = (i - (st - 1) / 2) * 0.55; c.position.set(sp, Math.sin(t * 2 + i) * 0.06, 0); c.rotation.y = t * 1.4 + i; } });
  }
  carrySpr.visible = show && G.carry > 0 && !player.firstPerson; if (carrySpr.visible) { carrySpr.position.set(player.pos.x, 2.35 + Math.sin(t * 2) * 0.04, player.pos.z); if (carrySpr.userData.n !== G.carry) { carrySpr.userData.n = G.carry; carrySpr.material.map = markerTex('carry', G.carry); carrySpr.material.needsUpdate = true; } }
}

// ───────────────────────── game state ─────────────────────────
const G = { mode: 'boot', night: 0, time: 0, total: 6, carry: 6, stolen: 0, strikes: 0, decoys: 0, shake: 0, caught: 0, alert: 0, tips: [], save: loadSave() || defaultSave(), hasSave: !!loadSave() };
const up = () => G.save.up;
const lvl = (id) => up()[id] || 0;
const fakePlayer = { pos: new THREE.Vector3(400, 0, 400), crouching: false, sprinting: false, flashOn: false, noise: 0 };
let elapsed = 0;

const ctx = {
  scene, world, nav, player: fakePlayer, rangeMul: 1, difficulty: 1,
  bark(sam, text) { ui.subtitle(sam.who, text, 3 + text.length / 28); if (sam.o.voice || sam.who === 'intern') audio.speak(sam.who, text); },
  onSteal(sam, n, spot) {
    if (G.mode !== 'play') return; G.stolen += n; G.shake = 0.8; audio.sfx('chip_stolen', { pos: sam.pos }); ui.toast(`${sam.name} took ${n} chip${n > 1 ? 's' : ''} from the ${spot.name}`, 2.8, 'bad');
  },
  onCatch(sam) { startGrab(sam, 'caught'); },
  onFound(sam, spot) { startGrab(sam, 'found', spot); },
  onSpotted() { G.shake = Math.max(G.shake, 0.3); raviSay('ravi_4'); },
};
let sams = [];

// ───────────────────────── gameplay actions ─────────────────────────
function nearestSpot() {
  let best = null, bd = 2.4; const p = player.pos;
  for (const s of world.spots) { const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z); if (d < bd) { bd = d; best = s; } }
  return best;
}
function interact() {
  if (G.mode !== 'play' || player.hiddenIn) return;
  const br = nearBreaker(); if (br) { useBreaker(br); return; }
  if (!G.endless && player.pos.distanceTo(cluster.pos) < 2.3) return; // hold E to upload instead
  const s = nearestSpot(); if (!s) return;
  if (G.carry > 0 && s.stash < s.cap) { player.doInteract();
    s.stash++; G.carry--; audio.sfx('chip_stash'); player.noise = Math.max(player.noise, 0.45 * player.noiseMul);
    const l = new THREE.PointLight(0x39ff9c, 18, 4, 2); l.position.set(s.pos.x, 1, s.pos.z); scene.add(l); setTimeout(() => scene.remove(l), 150);
    for (const sm of sams) sm.hear(new THREE.Vector3(player.pos.x, 0, player.pos.z), 4.5 * player.noiseMul);
  } else if (s.stash > 0) { player.doInteract(); s.stash--; G.carry++; audio.sfx('chip_take'); }
}
function toggleHide() {
  if (player.hiddenIn) { player.exitHide(); audio.sfx('hide_out'); return; }
  const s = nearestSpot(); if (!s || !HIDEABLE.has(s.name)) { ui.toast('Stand next to a locker, desk, crate, couch, cabinet or fridge to hide', 2.2); return; }
  player.enterHide(s); audio.sfx('hide_in'); for (const sm of sams) { sm.onPlayerHid(s); sm.hear(new THREE.Vector3(s.pos.x, 0, s.pos.z), 3.5 * player.noiseMul); }
  ui.toast(`You are hiding in the ${s.name}. Press H to come out.`, 2.6);
}
const projectiles = [];
function throwDecoy() {
  if (G.mode !== 'play' || G.decoys <= 0 || player.busy || player.hiddenIn) return; G.decoys--;
  const aim = new THREE.Vector3(); camera.getWorldDirection(aim); const target = camera.position.clone().addScaledVector(aim, 22);
  player.doThrow(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.4 })); m.castShadow = true;
    const from = new THREE.Vector3(); if (player.hand && !player.firstPerson) player.hand.getWorldPosition(from); else from.copy(player.eye); m.position.copy(from); scene.add(m);
    const v = target.sub(from).normalize().multiplyScalar(11).add(new THREE.Vector3(0, 2.4, 0));
    projectiles.push({ m, v, life: 4 }); audio.sfx('decoy_throw');
  });
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 14; p.life -= dt;
    let hit = p.m.position.y < 0.06;
    if (!hit) for (const o of world.obstacles) if (o.block !== false && Math.abs(p.m.position.x - o.x) < o.hx && Math.abs(p.m.position.z - o.z) < o.hz && p.m.position.y < 2.6) { hit = true; break; }
    if (Math.abs(p.m.position.x) > world.HX || Math.abs(p.m.position.z) > world.HZ) hit = true;
    if (hit || p.life <= 0) {
      audio.sfx('decoy_land', { pos: p.m.position });
      const at = new THREE.Vector3(p.m.position.x, 0, p.m.position.z);
      let heard = false; for (const s of sams) { s.hearCD = 0; if (s.hear(at, 20)) { heard = true; s.say('decoy', true); } } if (heard) setTimeout(() => raviSay('ravi_2'), 2200);
      scene.remove(p.m); projectiles.splice(i, 1);
    }
  }
}
addEventListener('mousedown', () => { if (G.grab) mash(); });
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (G.grab) { if (e.code === 'KeyE' || e.code === 'Space') mash(); return; }
  if (e.code === 'KeyE') interact(); else if (e.code === 'KeyG') throwDecoy();
  else if (e.code === 'KeyF' && G.mode === 'play' && !player.hiddenIn) player.setFlash(!player.flashOn);
  else if (e.code === 'KeyH' && G.mode === 'play') toggleHide();
  else if (e.code === 'KeyT') placeTrap();
});

// ───────────────────────── fight back: People's Cluster, slip traps, breaker boxes ─────────────────────────
const cluster = { pos: new THREE.Vector3(-12.4, 0, -8.3), prog: 0, lastKey: '', screenKey: '' };
{
  const grp = new THREE.Group(); grp.position.copy(cluster.pos); scene.add(grp); cluster.grp = grp;
  const mk = (w, h, d, c, x, y, z, em) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.6, emissive: em || 0, emissiveIntensity: em ? 0.8 : 0 })); m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m; };
  mk(1.8, 0.9, 0.9, 0x1a2a26, 0, 0.45, 0); mk(1.7, 0.08, 0.8, 0x2f4a42, 0, 0.94, 0); mk(0.9, 1.0, 0.12, 0x0d1512, 0, 1.45, -0.28);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 140; cluster.cv = cv; cluster.tex = new THREE.CanvasTexture(cv); cluster.tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.9), new THREE.MeshBasicMaterial({ map: cluster.tex, color: new THREE.Color(1.5, 1.5, 1.5) })); scr.position.set(0, 1.45, -0.21); scr.rotation.y = Math.PI; grp.add(scr);
  const lt = new THREE.PointLight(0xffd24d, 12, 6, 2); lt.position.set(0, 1.6, 0.5); grp.add(lt);
  cluster.spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('cluster', '0/0'), transparent: true, depthTest: false, depthWrite: false })); cluster.spr.renderOrder = 20; cluster.spr.scale.set(2.0, 1.0, 1); cluster.spr.position.set(0, 2.9, 0); grp.add(cluster.spr); aoHide.push(cluster.spr);
}
function drawCluster(up, need, prog) {
  const g = cluster.cv.getContext('2d'); g.fillStyle = '#071410'; g.fillRect(0, 0, 256, 140); g.fillStyle = '#ffd24d'; g.font = 'bold 20px monospace'; g.fillText("PEOPLE'S CLUSTER", 14, 28); g.fillStyle = '#9db4a8'; g.font = '15px monospace'; g.fillText(need ? 'free community AI' : 'standby', 14, 50);
  g.strokeStyle = '#2f5a4a'; g.strokeRect(14, 70, 228, 22); g.fillStyle = '#39ff9c'; const f = need ? Math.min(1, (up + prog) / need) : 0; g.fillRect(16, 72, 224 * f, 18);
  g.fillStyle = '#eef0e6'; g.font = 'bold 24px monospace'; g.fillText(need ? `${up} / ${need} chips` : '', 14, 124); cluster.tex.needsUpdate = true;
}
const traps = [];
function clearTraps() { for (const t of traps) scene.remove(t.mesh); traps.length = 0; }
function placeTrap() {
  if (G.mode !== 'play' || G.traps <= 0 || player.hiddenIn || player.busy) return; G.traps--;
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing), x = player.pos.x + fx * 0.9, z = player.pos.z + fz * 0.9;
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.6, 28), new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.92 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z); scene.add(m);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 12), new THREE.MeshStandardMaterial({ color: 0xf3f3f3 })); cup.position.set(0.35, 0.06, 0.1); cup.rotation.z = Math.PI / 2; m.add(cup); cup.rotation.x = Math.PI / 2;
  traps.push({ mesh: m, pos: new THREE.Vector3(x, 0, z), t: 0 }); audio.sfx('trap_place'); ui.toast('Coffee spilled. Lure Sam over it.', 1.8);
}
function updateTraps(dt) {
  for (let i = traps.length - 1; i >= 0; i--) {
    const t = traps[i]; t.t += dt; t.mesh.material.opacity = t.t < 1 ? 0.3 + t.t * 0.6 : 0.92; if (t.t < 1) continue;
    for (const sm of sams) {
      if (!sm.active || sm.state === 'stunned' || Math.hypot(sm.pos.x - t.pos.x, sm.pos.z - t.pos.z) > 0.85) continue;
      sm.slip(); scene.remove(t.mesh); traps.splice(i, 1); G.shake = 0.4; ui.toast('Sam slipped on the coffee!', 2.4); setTimeout(() => raviSay('ravi_trap'), 1400); if (G.endless) G.score += 40; break;
    }
  }
}
const breakers = [{ pos: new THREE.Vector3(13.75, 0, 8.2), ry: -Math.PI / 2 }, { pos: new THREE.Vector3(-13.75, 0, 5.5), ry: Math.PI / 2 }].map((b) => {
  const g = new THREE.Group(); g.position.copy(b.pos); g.rotation.y = b.ry; scene.add(g);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.18), new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.4, metalness: 0.7 })); box.position.set(0, 1.5, 0); g.add(box);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.1), new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff2a10, emissiveIntensity: 0.7 })); lever.position.set(0, 1.5, 0.12); g.add(lever);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('power', 1), transparent: true, depthTest: false, depthWrite: false })); spr.renderOrder = 20; spr.scale.set(1.5, 0.75, 1); spr.position.set(0, 2.5, 0.2); g.add(spr); aoHide.push(spr);
  return { ...b, g, spr, ready: true };
});
function nearBreaker() { for (const b of breakers) if (Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z) < 1.9) return b; return null; }
function useBreaker(b) {
  if (G.cfg.blackout) { ui.toast('The power is already out tonight.', 1.8); return; }
  if (G.breakerCD > 0) { ui.toast(`Breaker recharging (${Math.ceil(G.breakerCD)}s)`, 1.4); return; }
  G.outage = 10; G.breakerCD = 28; world.setBlackout(true); audio.sfx('breaker_pull', { pos: b.pos }); G.shake = 0.3;
  ui.toast('Power cut! Sam can barely see. Lights back in 10s.', 2.8); for (const sm of sams) { sm.hearCD = 0; if (sm.hear(b.pos.clone(), 26)) sm.say('breaker', true); } setTimeout(() => raviSay('ravi_breaker'), 1200);
}
function updateGadgets(dt, t) {
  if (G.outage > 0) { G.outage -= dt; if (G.outage <= 0) { world.setBlackout(!!G.cfg.blackout); audio.sfx('power_back'); ui.toast('Power is back on.', 1.6); } }
  G.breakerCD = Math.max(0, G.breakerCD - dt);
  for (const b of breakers) { const rdy = !G.cfg.blackout && G.breakerCD <= 0, show = !G.endless || true; if (rdy !== b.ready) { b.ready = rdy; b.spr.material.map = markerTex('power', rdy ? 1 : 0); b.spr.material.needsUpdate = true; } b.spr.visible = true; void show; }
  // People's Cluster: hold E near the terminal to upload a chip (campaign only)
  cluster.grp.visible = !G.endless;
  if (!G.endless) {
    const near = player.pos.distanceTo(cluster.pos) < 2.3 && !player.hiddenIn, held = player.keys.KeyE;
    if (near && held && G.carry > 0) {
      cluster.prog += dt / 2.2; cluster.tickT = (cluster.tickT || 0) - dt; if (cluster.tickT <= 0) { cluster.tickT = 0.45; audio.sfx('upload_tick', { pos: cluster.pos }); } player.noise = Math.max(player.noise, 0.45 * player.noiseMul);
      if (cluster.prog >= 1) { cluster.prog = 0; G.carry--; G.uploaded++; audio.sfx('upload_done'); ui.toast(`Chip uploaded (${G.uploaded}/${G.cfg.need})`, 2.2); for (const sm of sams) { if (sm.hear(new THREE.Vector3(cluster.pos.x, 0, cluster.pos.z + 1), 7.5)) sm.say('cluster', true); } if (G.uploaded === 1) raviSay('ravi_upload_1'); else if (G.uploaded === G.cfg.need - 1) raviSay('ravi_upload_last'); }
    } else cluster.prog = Math.max(0, cluster.prog - dt * 1.5);
    const key = `${G.uploaded}/${G.cfg.need}`; if (key !== cluster.lastKey) { cluster.lastKey = key; cluster.spr.material.map = markerTex('cluster', key); cluster.spr.material.needsUpdate = true; }
    const sk = `${G.uploaded}|${Math.round(cluster.prog * 20)}`; if (sk !== cluster.screenKey) { cluster.screenKey = sk; drawCluster(G.uploaded, G.cfg.need, cluster.prog); }
    cluster.spr.scale.setScalar(Math.min(1, camera.position.distanceTo(cluster.pos) / 6)); cluster.spr.scale.set(2.0 * Math.min(1, camera.position.distanceTo(cluster.pos) / 6.5), 1.0 * Math.min(1, camera.position.distanceTo(cluster.pos) / 6.5), 1);
  }
  updateTraps(dt);
}

// ───────────────────────── caught: Sam hangs Aj upside down by the ankle; mash E to break free ─────────────────────────
const _tmpV = new THREE.Vector3(), grabLight = new THREE.PointLight(0xffe2b0, 0, 9, 2), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
scene.add(grabLight);
function startGrab(sam, kind, spot) {
  if (G.mode !== 'play' || G.grab) return;
  G.grab = { sam, kind, spot, t: 0, prog: 0, maxT: 4.8, hand: new THREE.Vector3(), wasFP: player.firstPerson };
  sam.state = 'grab'; sam.path = []; sam.aware = 0; player.exitHide(); player.hiddenIn = null; player.vel.set(0, 0); player.setFlash(false); player.setFirstPerson(false);
  if (player.actor) player.actor.setVisible(true); G.shake = 1; G.caught = 1; audio.sfx('caught_hit'); ui.struggle(0);
  ui.toast(kind === 'found' ? `${sam.name} found you in the ${spot.name}!` : `${sam.name} caught you!`, 2.4, 'bad');
}
function mash() { if (!G.grab) return; G.grab.prog = Math.min(1.05, G.grab.prog + 0.13); G.shake = Math.max(G.shake, 0.35); audio.sfx('footstep_run', { vol: 0.4 }); }
function updateGrab(dt, t) {
  const gr = G.grab, sam = gr.sam; gr.t += dt; gr.prog = Math.max(0, gr.prog - dt * 0.24);
  const hand = sam.handWorld(gr.hand), a = player.actor;
  if (a) {
    a.once = null; a.play('stun', 2.3, 0.1); a.update(dt);
    // Aj hangs by the ankle, swinging side to side (never through Sam), with a little wobble in the other direction
    const swing = Math.sin(t * 7.2) * 0.42 * (1 - 0.35 * Math.min(1, gr.prog)), wob = Math.sin(t * 4.3 + 1) * 0.1;
    _qa.setFromAxisAngle(AY, sam.yaw + Math.PI); _qb.setFromAxisAngle(AX, Math.PI + wob); _qc.setFromAxisAngle(AZ, swing);
    a.root.quaternion.copy(_qa).multiply(_qc).multiply(_qb); a.root.position.set(hand.x, hand.y + 0.1, hand.z); a.root.position.addScaledVector(_tmpV.set(Math.sin(sam.yaw), 0, Math.cos(sam.yaw)), 0.08);
    player.rim.position.set(hand.x + 0.6, 3.1, hand.z + 0.6);
  }
  // camera circles the two of them
  const cx = (sam.pos.x + hand.x) / 2, cz = (sam.pos.z + hand.z) / 2, ang = -sam.yaw + Math.sin(t * 0.6) * 0.9, shk = G.shake; // side-on to Sam, slowly sweeping, so Aj hanging from his hand stays in view
  camera.position.set(cx + Math.cos(ang) * 3.4 + (Math.random() - 0.5) * shk * 0.05, 1.35 + Math.sin(t * 0.8) * 0.12, cz + Math.sin(ang) * 3.4); camera.lookAt(hand.x * 0.6 + cx * 0.4, 1.05, hand.z * 0.6 + cz * 0.4); camera.fov += (52 - camera.fov) * 0.1; camera.updateProjectionMatrix();
  grabLight.intensity = 5; grabLight.position.set(cx - Math.sin(sam.yaw) * 0.6, 3.4, cz - Math.cos(sam.yaw) * 0.6);
  ui.struggle(gr.prog);
  if (gr.prog >= 1) finishGrab(true); else if (gr.t >= gr.maxT) finishGrab(false);
}
function finishGrab(success) {
  const gr = G.grab; G.grab = null; ui.struggle(null); grabLight.intensity = 0; const sam = gr.sam; G.strikes++;
  const out = nav.point(sam.pos.x + Math.sin(sam.yaw) * 1.5, sam.pos.z + Math.cos(sam.yaw) * 1.5); player.pos.set(out.x, 0, out.z); player.vel.set(0, 0);
  if (player.actor) { player.actor.root.quaternion.identity(); player.actor.root.rotation.set(0, player.facing, 0); player.actor.once = null; player.actor.play('idle', 1, 0.1); }
  player.setFirstPerson(gr.wasFP);
  if (success) { sam.state = 'stunned'; sam.stunT = 2.4; sam.say('slip', true); G.shake = 0.6; ui.toast('You broke free!', 2.4); audio.sfx('upload_done'); }
  else {
    sam.state = 'stunned'; sam.stunT = 2; audio.sfx('chip_stolen'); const away = new THREE.Vector3(player.pos.x - sam.pos.x, 0, player.pos.z - sam.pos.z).normalize(); player.vel.set(away.x * 8, away.z * 8);
    if (G.carry > 0) { G.carry--; G.stolen++; ui.toast(`${sam.name} took a chip and tossed you aside`, 3, 'bad'); } else ui.toast(`${sam.name} tossed you aside`, 2.6, 'bad');
  }
  setTimeout(() => raviSay('ravi_caught'), 900);
}

// ───────────────────────── Ravi's recorded reactions (each plays once per night) ─────────────────────────
function raviSay(id) {
  if (G.raviSaid.has(id)) return; G.raviSaid.add(id); const text = textFor(id);
  ui.subtitle(whoFor(id), text, Math.max(3.2, text.length / 13)); audio.speakId(id, false);
}

// ───────────────────────── endless mode: floor pickups, scoring, ramp ─────────────────────────
const pickups = [];
function clearPickups() { for (const p of pickups) { scene.remove(p.grp); const i = aoHide.indexOf(p.spr); if (i >= 0) aoHide.splice(i, 1); } pickups.length = 0; }
function spawnPickup() {
  for (let tries = 0; tries < 20; tries++) {
    const pt = nav.point((Math.random() * 2 - 1) * (world.HX - 2), (Math.random() * 2 - 1) * (world.HZ - 2));
    if (pt.distanceTo(player.pos) < 5 || sams.some((sm) => sm.pos.distanceTo(pt) < 4)) continue;
    const grp = new THREE.Group(); grp.position.set(pt.x, 0, pt.z); const r = makeRam(); r.scale.setScalar(6); r.position.y = 0.55; grp.add(r);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('pickup'), transparent: true, depthTest: false, depthWrite: false })); spr.renderOrder = 20; spr.scale.set(1.3, 0.65, 1); spr.position.y = 1.7; grp.add(spr); aoHide.push(spr);
    const l = new THREE.PointLight(0x39ff9c, 10, 4, 2); l.position.y = 0.6; grp.add(l); scene.add(grp); pickups.push({ grp, spr, r, pos: pt.clone() }); return;
  }
}
function updateEndless(dt, t) {
  const hiddenN = world.stashTotal(); G.score += dt * (2 + hiddenN);
  // Sam gets faster, sharper and hears better the longer you last
  for (const sm of sams) { sm.baseSpeed = Math.min(3.0, 1.5 + G.time * 0.006); sm.baseRange = Math.min(16, 12 + G.time * 0.02); }
  G.nextPickup -= dt; if (G.nextPickup <= 0) { G.nextPickup = 11; if (pickups.length < 3) spawnPickup(); }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.r.rotation.y = t * 1.6; p.r.position.y = 0.55 + Math.sin(t * 2.4 + i) * 0.08; p.spr.scale.setScalar(1); p.spr.scale.set(1.3, 0.65, 1);
    if (!player.hiddenIn && Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 0.9) {
      scene.remove(p.grp); pickups.splice(i, 1); G.carry++; G.total++; G.collected++; G.score += 25; audio.sfx('chip_pickup'); ui.toast('+1 chip. Find it a hiding spot.', 1.8);
      for (const sm of sams) sm.hear(new THREE.Vector3(player.pos.x, 0, player.pos.z), 5 * player.noiseMul);
    }
  }
}
async function beginEndless() {
  G.mode = 'cut'; ui.showHud(false); audio.init();
  const b = document.createElement('div'); b.className = 'story';
  b.innerHTML = `<h4>How it works</h4><ol><li>You start with 3 chips. New ones appear on the floor every few seconds, so go grab them.</li><li>Hide chips with <kbd>E</kbd>, or hide yourself with <kbd>H</kbd>. Hidden chips earn extra score every second.</li><li>Sam gets faster, sharper and hears better the longer you last.</li><li>The run ends when you are caught three times or lose your last chip. Beat your best and share it.</li></ol>`;
  ui.panel({ title: 'Endless mode', sub: 'Last chip standing. How long can you keep RAM away from Sam?', body: b, buttons: [{ label: 'Start run', fn: () => { startNight('endless'); lockPointer(); } }, { label: 'Back', sec: true, fn: toTitle }] });
}
function endEndless(why) {
  if (G.mode !== 'play') return; G.mode = 'result'; controls.unlock(); ui.showHud(false); audio.stopSpeech(); audio.music('menu'); audio.sfx('lose_sting'); player.setFlash(false); player.exitHide(); clearPickups();
  const score = Math.floor(G.score), time = G.time, best = loadBest(), isBest = score > best.score; if (isBest) saveBest({ score, time });
  trk('endless_over', { seconds: Math.floor(time), score, collected: G.collected });
  const body = document.createElement('div');
  body.innerHTML = `<div class="credits">${isBest ? 'New best score' : 'Run over'}</div><div class="stat"><div><b>${fmt(time)}</b>survived</div><div><b>${score}</b>score</div><div><b>${G.collected}</b>chips collected</div><div><b>${Math.max(best.score, score)}</b>best score</div></div>`;
  const text = `I lasted ${fmt(time)} (score ${score}) in RAM Heist Endless, hiding RAM from Sam. Beat me: ${location.origin}`;
  ui.panel({ title: 'Sam wins this one', sub: why, body, buttons: [{ label: 'Play again', fn: () => { startNight('endless'); lockPointer(); } }, { label: 'Share my score', sec: true, fn: async () => { try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); const b = [...document.querySelectorAll('#pBtns button')].find((x) => /Share|Copied/.test(x.textContent)); if (b) b.textContent = 'Copied to clipboard'; } } catch { } trk('share_score', { score }); } }, { label: 'Main menu', sec: true, fn: toTitle }] });
}

// ───────────────────────── 15-second intro: keynote -> hackerspace -> title ─────────────────────────
let introCam = null, introSam = null, introChip = null;
function holoRam2() { const g = makeRam(); g.scale.setScalar(2.6); g.position.set(0.5, 1.15, 6.05); g.rotation.set(0.3, -0.6, 0.2); const l = new THREE.PointLight(0x39ff9c, 12, 4, 2); l.position.set(0, 0.1, 0.1); g.add(l); return g; }
const sm01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function introShot(from, to, look, dur, fov = 42) { introCam = { t: 0, dur, from: new THREE.Vector3(...from), to: new THREE.Vector3(...to), look: new THREE.Vector3(...look), fov }; }
function introFrame(dt) {
  viewRam.visible = false;
  if (introSam?.actor) { const talking = introSam.speechFx(dt); introSam.actor.play(talking ? introSam.gestureClip(dt) : 'idle', 1, 0.35); introSam.actor.update(dt); } if (player.actor) player.actor.update(dt);
  if (introChip) { introChip.rotation.y += dt * 0.9; introChip.position.y = 1.2 + Math.sin(performance.now() / 500) * 0.04; }
  if (!introCam) return; introCam.t += dt; const k = sm01(introCam.t / introCam.dur);
  camera.position.lerpVectors(introCam.from, introCam.to, k); camera.lookAt(introCam.look); camera.fov += (introCam.fov - camera.fov) * 0.1; camera.updateProjectionMatrix();
}
async function playIntro() {
  audio.music('intro'); G.mode = 'intro'; ui.showHud(false); ui.show('title', false); ui.hidePanel(); clearSams(); clearPickups();
  const intro = $('intro'), slide = $('slide'), sub = $('introSub'), title = $('introTitle'); intro.classList.add('on'); intro.style.setProperty('--fade', 1);
  const subText = (who, text) => { sub.className = 'on ' + who; sub.querySelector('.who').textContent = who === 'ravi' ? 'Ravi, IT desk' : 'Sam'; sub.querySelector('.t').textContent = text; };
  const hideSub = () => sub.classList.remove('on');
  // set the stage: dark room, Sam in a key light in front of the server racks
  world.introDim = true; world.setBlackout(true); world.setFlicker(false); const STAGE = new THREE.Vector3(3.5, 0, -6.8);
  introSam = new Sam({ name: 'Sam', speed: 0, range: 0, voice: false }, ctx, 0); introSam.root.position.copy(STAGE); introSam.root.rotation.y = 0; introSam.spot.intensity = 0; introSam.cone.visible = false; introSam.glow.intensity = 0; introSam.actor?.play('idle');
  const key = new THREE.SpotLight(0xfff0d0, 70, 22, 0.5, 0.8, 2); key.position.set(STAGE.x + 1.2, 5, STAGE.z + 4.5); key.target.position.set(STAGE.x, 1.4, STAGE.z); scene.add(key, key.target);
  const rim = new THREE.PointLight(0x5ab4ff, 5, 9, 2); bloom.strength = 0.12; renderer.toneMappingExposure = 0.9; rim.position.set(STAGE.x - 1.5, 2.4, STAGE.z - 1.6); scene.add(rim);
  player.reset({ x: 0, z: 6.5 }); player.hiddenIn = null; if (player.actor) { player.actor.setVisible(true); player.actor.root.position.set(0, 0, 6.5); player.actor.root.rotation.y = Math.PI; player.actor.play('idle'); } G.carry = 6; handRam.visible = true; viewRam.visible = false;
  let skipped = false, skipRes; const skipP = new Promise((r) => (skipRes = r)); const doSkip = () => { if (skipped) return; skipped = true; audio.stopSpeech(); skipRes(); };
  $('introSkip').onclick = doSkip; const onKey = (e) => { if (e.code === 'Escape' || e.code === 'Space') doSkip(); }; addEventListener('keydown', onKey);
  const say = async (id, who) => { if (skipped) return; subText(who, textFor(id)); await Promise.race([audio.speakAsync(id, 2500), skipP]); hideSub(); };
  const wait = (ms) => Promise.race([new Promise((r) => setTimeout(r, ms)), skipP]);
  try {
    // shot A: black -> Sam, applause
    introShot([4.1, 1.55, -3.6], [3.7, 1.6, -4.7], [3.5, 1.55, STAGE.z], 4.2); audio.sfx('applause'); await wait(200); intro.style.setProperty('--fade', 0); await wait(500); await say('sam_intro_1', 'sam');
    // shot B: the slide
    if (!skipped) { introShot([6.2, 1.7, -4.4], [5.3, 1.6, -5.4], [3.7, 1.4, STAGE.z], 8.2, 40); slide.classList.add('on'); await wait(250); await say('sam_intro_2', 'sam'); slide.classList.remove('on'); }
    // shot C: Aj in the dark, chip in hand, Ravi whispers
    if (!skipped) { intro.style.setProperty('--fade', 1); await wait(350); introSam.root.visible = false; introChip = holoRam2(); scene.add(introChip); key.target.position.set(0.2, 1.3, 6.5); key.position.set(2.2, 4.2, 3.4); rim.position.set(-1.4, 2.2, 7.6); introShot([1.5, 1.55, 4.2], [1.0, 1.5, 4.8], [0.2, 1.25, 6.3], 4.4, 42); intro.style.setProperty('--fade', 0); await wait(350); player.actor?.playOnce('interact', () => player.actor.play('idle'), 0.55); await say('ravi_intro_1', 'ravi'); }
    // shot D: back to Sam, one last line
    if (!skipped) { intro.style.setProperty('--fade', 1); await wait(300); if (introChip) { scene.remove(introChip); introChip = null; } introSam.root.visible = true; key.target.position.set(STAGE.x, 1.5, STAGE.z); key.position.set(STAGE.x + 1.2, 5, STAGE.z + 4.5); rim.position.set(STAGE.x - 1.5, 2.4, STAGE.z - 1.6); introShot([3.7, 1.64, -5.2], [3.55, 1.64, -5.6], [3.5, 1.62, STAGE.z], 3.6, 34); intro.style.setProperty('--fade', 0); await wait(300); await say('sam_intro_3', 'sam'); }
    // title slam
    if (!skipped) { intro.style.setProperty('--fade', 1); await wait(350); title.classList.add('on'); audio.sfx('title_slam'); await wait(1900); }
  } finally {
    removeEventListener('keydown', onKey); audio.stopSpeech(); title.classList.remove('on'); slide.classList.remove('on'); hideSub(); intro.classList.remove('on'); intro.style.setProperty('--fade', 0);
    if (introChip) { scene.remove(introChip); introChip = null; } world.introDim = false; scene.remove(key, key.target, rim); setQuality(quality.level); introSam?.dispose(); introSam = null; introCam = null; handRam.visible = false; camera.fov = 62; camera.updateProjectionMatrix();
  }
}

// ───────────────────────── night lifecycle ─────────────────────────
function clearSams() { for (const s of sams) s.dispose(); sams = []; }
function spawnSams(cfgs) {
  clearSams(); const starts = [new THREE.Vector3(-12, 0, 7), new THREE.Vector3(12, 0, -7)];
  sams = cfgs.map((c, i) => { const s = new Sam(c, ctx, i); s.teleport(starts[i % 2]); return s; });
}
function startNight(idx) {
  const N = idx === 'endless' ? ENDLESS : NIGHTS[idx]; G.cfg = N; G.endless = idx === 'endless'; G.raviSaid = new Set(); G.uploaded = 0; G.traps = 2 + lvl('traps'); G.outage = 0; G.breakerCD = 0; cluster.prog = 0; cluster.lastKey = ''; cluster.screenKey = ''; clearTraps(); G.night = idx; G.score = 0; G.collected = 0; G.nextPickup = 6; clearPickups(); trk('night_start', { night: String(idx) });
  G.time = N.time; G.total = N.sticks; G.carry = N.sticks; G.stolen = 0; G.strikes = 0; G.shake = 0; G.caught = 0;
  G.decoys = (N.decoys || 0) + 2 * lvl('decoys'); G.tips = [...(idx === 0 || G.endless ? TIPS : []), ...(NIGHT_TIPS[idx] || [])].filter((t) => !(G.endless && /People/.test(t.text))).map((t) => ({ ...t, at: (G.endless ? 110 : N.time) - t.t })).sort((a, b) => a.at - b.at);
  world.resetSpots(lvl('pockets')); world.setBlackout(!!N.blackout); world.setFlicker(!!N.flicker); world.alert = 0;
  player.hiddenIn = null; player.reset({ x: 0, z: 6.5 }); player.staminaMax = 1 + 0.3 * lvl('lungs'); player.noiseMul = 1 - 0.25 * lvl('soles'); elapsed = 0; G.grace = N.grace || 10; G.graceMax = G.grace;
  ctx.player = player; ctx.rangeMul = 1 - 0.12 * lvl('foil'); ctx.difficulty = G.endless ? 1.6 : 1 + idx * 0.35;
  spawnSams(N.sams); sams.forEach((sm) => sm.setActive(false)); projectiles.splice(0).forEach((p) => scene.remove(p.m));
  audio.music('stealth'); G.mode = 'play'; ui.showHud(true); ui.show('title', false); ui.hidePanel(); if (player.actor) player.actor.setVisible(!player.firstPerson);
}
async function beginNight(idx) {
  G.mode = 'cut'; ui.showHud(false); audio.init();
  if (idx === 0) { await playIntro(); await briefing(true); }
  else await ui.cutscene(INTROS[idx], { title: `NIGHT ${idx + 1}`, subtitle: NIGHTS[idx].sub.toUpperCase() });
  startNight(idx); lockPointer();
}
function briefing(start = false) {
  return new Promise((resolve) => {
    const b = document.createElement('div'); b.className = 'story';
    b.innerHTML = `<h4>The story</h4><p>You are Aj, an ordinary person with a bag of RAM chips. Sam has announced that RAM belongs in datacenters for AI, not in the hands of regular people, and his crew is raiding the hackerspace server room to collect every chip. Ravi from IT guides you by walkie-talkie.</p>
      <h4>Your goal</h4><p>Build the People's Cluster. Carry chips to the glowing terminal in the north-west corner and hold <kbd>E</kbd> to upload them. Upload enough before sunrise and the night is won. Sam steals any chip he finds, so hide them while you move around.</p>
      <h4>How to play</h4><ol>
      <li>Walk (<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys) to a green <b>HIDE HERE</b> marker and press <kbd>E</kbd> to hide a chip. A hologram shows where yours are. Only you can see it.</li>
      <li>Click the game once to capture the mouse, then move it to look around. Press <kbd>Esc</kbd> to release it.</li>
      <li>You can hide too. Stand next to a locker, desk, crate, couch, cabinet or fridge and press <kbd>H</kbd>. Sam can't see you inside, but if he watches you duck in, or searches that spot, he finds you.</li>
      <li>Stay out of Sam's flashlight. The ring in the middle of the screen fills when he notices you. The minimap shows him when he is close.</li>
      <li><kbd>Shift</kbd> sprint (loud) <kbd>C</kbd> crouch (quiet) <kbd>G</kbd> throw a decoy to lure him away <kbd>F</kbd> flashlight.</li>
      <li>Fight back: <kbd>T</kbd> drops a coffee spill, and Sam slips for 5 seconds. Pull a breaker (<kbd>E</kbd> at a blue box) to cut the power. Sam can barely see and goes to check it.</li>
      <li>Lose too many chips, get caught three times, or miss sunrise and the night is lost.</li></ol>`;
    ui.panel({ title: start ? 'Mission briefing' : 'Story and how to play', sub: '', body: b, buttons: [{ label: start ? 'Start Night 1' : 'Back', fn: () => { if (!start) { ui.hidePanel(); ui.show('title', true); } resolve(); } }] });
  });
}
$('bStory').onclick = () => { briefing(false); };
function lockPointer() {
  if (DEBUG) return; try { controls.lock(); } catch { }
  setTimeout(() => { if (G.mode === 'play' && !controls.isLocked && !$('panel').classList.contains('on')) ui.panel({ title: 'Click to play', sub: 'The browser needs one click to capture the mouse. Then move the mouse to look around.', buttons: [{ label: 'Play', fn: () => controls.lock() }] }); }, 600);
}
document.addEventListener('mousedown', (e) => { if (G.mode === 'play' && !controls.isLocked && !DEBUG && !$('panel').classList.contains('on') && e.target.tagName === 'CANVAS') { try { controls.lock(); } catch { } } });

function endNight(win, why = '') {
  if (G.mode !== 'play') return; G.mode = 'result'; controls.unlock(); ui.showHud(false); audio.stopSpeech(); player.setFlash(false);
  const left = G.carry + world.stashTotal() + G.uploaded;
  if (win) {
    trk('night_complete', { night: G.night + 1, strikes: G.strikes }); audio.music('menu'); audio.sfx('win_sting'); setTimeout(() => audio.speakId('ravi_win', true), 900); const gain = 60 * left + 100 + 40 * (3 - G.strikes) + Math.floor(Math.max(0, G.time) * 2);
    G.save.credits += gain; G.save.night = Math.max(G.save.night, G.night + 1); writeSave(G.save); G.hasSave = true;
    const body = document.createElement('div'); body.innerHTML = `<div class="credits">+${gain} credits</div><div class="stat"><div><b>${left}/${G.total}</b>chips saved</div><div><b>${G.strikes}/3</b>times caught</div><div><b>${G.stolen}</b>chips stolen</div></div>`;
    const last = G.night >= NIGHTS.length - 1;
    ui.panel({ title: "People's Cluster online", sub: textFor('ravi_win'), body, buttons: last ? [{ label: 'Finish', fn: finishGame }] : [{ label: `Start Night ${G.night + 2}`, fn: () => beginNight(G.night + 1) }, { label: 'Upgrade shop', sec: true, fn: () => shop() }] });
  } else {
    trk('night_failed', { night: G.night + 1 }); audio.music('menu'); audio.sfx('lose_sting'); setTimeout(() => audio.speakId('ravi_lose', true), 900); const body = document.createElement('div'); body.innerHTML = `<div class="stat"><div><b>${G.uploaded}/${G.cfg.need}</b>uploaded</div><div><b>${G.carry + world.stashTotal() + G.uploaded}/${G.total}</b>chips left</div><div><b>${G.cfg.need}</b>needed</div><div><b>${G.strikes}/3</b>times caught</div></div>`;
    ui.panel({ title: 'Night lost', sub: why + ' ' + textFor('ravi_lose'), body, buttons: [{ label: 'Retry night', fn: () => { startNight(G.night); lockPointer(); } }, { label: 'Upgrade shop', sec: true, fn: () => shop(true) }, { label: 'Main menu', sec: true, fn: toTitle }] });
  }
}
async function finishGame() {
  G.mode = 'cut'; audio.music('ending'); await ui.cutscene(ENDING, { title: 'THE END', subtitle: 'RAM HEIST' }); toTitle();
}
function shop(fromFail = false) {
  const body = document.createElement('div'); const cr = document.createElement('div'); cr.className = 'credits'; body.appendChild(cr);
  const grid = document.createElement('div'); grid.className = 'grid'; body.appendChild(grid);
  const draw = () => {
    cr.textContent = `${G.save.credits} credits`; grid.innerHTML = '';
    for (const u of UPGRADES) {
      const l = lvl(u.id), cost = u.cost * (l + 1), card = document.createElement('div'); card.className = 'upg';
      card.innerHTML = `<h3>${u.name}</h3><div class="lv">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div><p>${u.desc}</p>`;
      const b = document.createElement('button'); b.textContent = l >= u.max ? 'Maxed out' : `Buy for ${cost}`; b.disabled = l >= u.max || G.save.credits < cost; if (b.disabled) b.className = 'sec';
      b.onclick = () => { G.save.credits -= cost; up()[u.id] = l + 1; writeSave(G.save); audio.sfx('ui_confirm'); draw(); }; card.appendChild(b); grid.appendChild(card);
    }
  }; draw();
  ui.panel({ title: 'Upgrade shop', sub: 'Ravi sells these out of the vending machine. Upgrades last for the whole campaign.', body, buttons: [{ label: fromFail ? 'Retry night' : `Start Night ${G.night + 2}`, fn: () => (fromFail ? (startNight(G.night), lockPointer()) : beginNight(G.night + 1)) }] });
}
function updateBest() { const b = loadBest(); $('bestLine').textContent = b.score ? `Endless best: ${fmt(b.time)}, score ${b.score}` : ''; }
function toTitle() {
  updateBest();
  G.mode = 'menu'; audio.music('menu'); if (player.actor) player.actor.setVisible(false); ui.showHud(false); ui.hidePanel(); ui.show('title', true); $('bCont').disabled = !G.hasSave; clearSams(); setupMenuSam(); audio.stopSpeech();
}
function setupMenuSam() { ctx.player = fakePlayer; spawnSams([{ name: 'Sam', speed: 1.7, range: 0, voice: false }]); world.setBlackout(false); world.setFlicker(false); world.alert = 0; for (const s of world.spots) s.stash = 0; }

controls.addEventListener('lock', () => { ui.hidePanel(); });
controls.addEventListener('unlock', () => {
  if (G.mode === 'play') { const b = document.createElement('div'); b.className = 'story'; b.innerHTML = '<ol><li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys move, <kbd>Mouse</kbd> looks around, <kbd>Esc</kbd> releases it</li><li><kbd>E</kbd> hide a chip (hold at the cluster to upload), <kbd>H</kbd> hide yourself, <kbd>G</kbd> decoy, <kbd>T</kbd> coffee trap</li><li><kbd>Shift</kbd> sprint, <kbd>C</kbd> crouch, <kbd>F</kbd> flashlight, <kbd>Tab</kbd> first-person</li></ol>'; ui.panel({ title: 'Paused', sub: '', body: b, buttons: [{ label: 'Resume', fn: () => { controls.lock(); } }, { label: 'Quit to main menu', sec: true, fn: toTitle }] }); }
});
document.addEventListener('pointerlockerror', () => { if (G.mode === 'play') ui.panel({ title: 'Click to continue', sub: 'The browser needs a click to capture the mouse.', buttons: [{ label: 'Continue', fn: () => controls.lock() }] }); });

// ───────────────────────── title screen ─────────────────────────
$('bNew').onclick = () => { audio.init(); trk('game_start', { mode: 'campaign' }); G.save = defaultSave(); writeSave(G.save); G.hasSave = true; beginNight(0); };
$('bCont').onclick = () => { audio.init(); G.save = loadSave() || defaultSave(); beginNight(Math.min(G.save.night, NIGHTS.length - 1)); };
$('bEndless').onclick = () => { audio.init(); trk('game_start', { mode: 'endless' }); beginEndless(); };
$('bVoice').onclick = () => { audio.init(); const v = !audio.isVoice(); audio.setVoice(v); $('bVoice').textContent = `Voice: ${v ? 'On' : 'Off'}`; };
$('bQual').onclick = () => { const h = quality.level === 'high' ? 'low' : 'high'; setQuality(h); $('bQual').textContent = `Graphics: ${h === 'high' ? 'High' : 'Low'}`; };
addEventListener('keydown', (e) => { if (e.code === 'KeyV') $('bVoice').click(); else if (e.code === 'KeyM') $('bMusic').click(); });
const firstGesture = () => { audio.init(); if (G.mode === 'menu') audio.music('menu'); removeEventListener('pointerdown', firstGesture); removeEventListener('keydown', firstGesture); };
addEventListener('pointerdown', firstGesture); addEventListener('keydown', firstGesture);
$('bMusic').onclick = () => { audio.init(); const on = !audio.isMusicOn(); audio.setMusicOn(on); $('bMusic').textContent = `Music: ${on ? 'On' : 'Off'}`; };

// ───────────────────────── main loop ─────────────────────────
const _dir = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt, now / 1000);
}
function step(dt, t, draw = true) {
  fxPass.uniforms.time.value = t % 100; world.update(t, dt); audio.tick(dt); { camera.getWorldDirection(_dir); audio.setListener(camera.position.x, camera.position.z, _dir.x, _dir.z); }
  const live = G.mode === 'play' && (controls.isLocked || DEBUG);

  if (live && G.grab) {
    updateGrab(dt, t); for (const s of sams) s.update(dt, t); audio.setTension(1); world.alert += (1 - world.alert) * Math.min(1, dt * 3); G.shake = Math.max(0, G.shake - dt * 1.2);
    fxPass.uniforms.alert.value = world.alert; fxPass.uniforms.caught.value = Math.max(G.caught, 0.4); updateMarkers(t, null, false);
  } else if (live) {
    player.update(dt); elapsed += dt;
    if (G.grace > 0) { const prev = Math.ceil(G.grace); G.grace -= dt; if (Math.ceil(G.grace) !== prev && G.grace > 0) ui.toast(`Sam arrives in ${Math.ceil(G.grace)}. Find a hiding spot.`, 1.4); if (G.grace <= 0) { sams.forEach((sm) => sm.setActive(true)); ui.toast('Sam is here. Stay out of the light.', 2.6, 'bad'); audio.stinger(); } }
    for (const s of sams) s.update(dt, t);
    // continuous footstep noise reaches Sam
    if (player.noise > 0.3 && !player.hiddenIn) for (const s of sams) s.hear(new THREE.Vector3(player.pos.x, 0, player.pos.z), player.noise * 12 * ((G.cfg.ears || 1) + (G.endless ? G.time * 0.004 : 0)));
    updateGadgets(dt, t); updateProjectiles(dt); if (G.grace <= 0) G.time += G.endless ? dt : -dt;
    if (G.endless && G.grace <= 0) updateEndless(dt, t);
    while (G.tips.length && elapsed >= G.tips[0].at) { const tip = G.tips.shift(); ui.subtitle(tip.who, tip.text, 6.5); audio.speak(tip.who, tip.text); }
    let chase = 0, aware = 0; for (const s of sams) { if (s.state === 'chase') chase = 1; aware = Math.max(aware, s.aware); }
    audio.setTension(Math.max(chase, aware * 0.8)); world.alert += ((chase ? 1 : 0) - world.alert) * Math.min(1, dt * 3);
    G.shake = Math.max(0, G.shake - dt * 1.5); G.caught = Math.max(0, G.caught - dt * 0.7);
    if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.05; camera.position.y += (Math.random() - 0.5) * G.shake * 0.05; }
    fxPass.uniforms.alert.value = world.alert; fxPass.uniforms.caught.value = G.caught;
    viewRam.visible = G.carry > 0 && player.firstPerson; handRam.visible = G.carry > 0 && !player.firstPerson;

    if (G.night === 0 && !G.endless && elapsed > 1.2) raviSay('ravi_alt_1');
    if (world.stashTotal() >= 3) raviSay('ravi_3');
    if (player.hiddenIn && sams.some((sm) => sm.active && sm.state !== 'stunned' && sm.pos.distanceTo(player.pos) < 4.5)) raviSay('ravi_1');
    player.live = true; document.body.classList.toggle('hiding', !!player.hiddenIn); const s = nearestSpot(); updateMarkers(t, s, true); let prompt = '';
    if (player.hiddenIn) prompt = '[H] Come out of the ' + player.hiddenIn.name;
    else if (s) { const chipP = G.carry > 0 && s.stash < s.cap ? `[E] Hide a chip (${s.stash}/${s.cap})` : s.stash > 0 ? '[E] Take a chip back' : ''; const selfP = HIDEABLE.has(s.name) ? '[H] Hide yourself' : ''; prompt = [chipP, selfP].filter(Boolean).join('   ') || `The ${s.name} is full`; }
    for (const sp of world.spots) { const near = sp === s; sp.ring.material.opacity += ((near ? 0.85 : 0) - sp.ring.material.opacity) * Math.min(1, dt * 10); }
    const N = G.cfg, hidden = world.stashTotal();
    ui.hud({ uploaded: G.uploaded, traps: G.traps, endless: G.endless, score: Math.floor(G.score), timeMax: N.time, elapsed, title: N.title, sub: N.sub, need: N.need, total: G.total, time: G.time, carry: G.carry, hidden, stolen: G.stolen, strikes: G.strikes, stamina: player.stamina, exhausted: player.exhausted, noise: player.noise, decoys: G.decoys, flash: player.flashOn, prompt, aware, alert: world.alert });
    ui.minimap({ world, sams, player, marks: [...(G.endless ? [] : [{ x: cluster.pos.x, z: cluster.pos.z, c: '#ffd24d' }]), ...breakers.map((b) => ({ x: b.pos.x, z: b.pos.z, c: '#62c8ff' })), ...traps.map((t) => ({ x: t.pos.x, z: t.pos.z, c: '#c47a3a' }))], pickups: pickups.map((p) => p.pos), yaw: player.facing + Math.PI });
    const left = G.carry + hidden + G.uploaded;
    if (G.endless) { if (G.strikes >= 3) endEndless('Caught three times.'); else if (left <= 0) endEndless('Sam took your last chip.'); }
    else if (G.strikes >= 3) endNight(false, 'Caught three times. Sam took everything he could carry.');
    else if (left < N.need) endNight(false, `Only ${left} stick${left === 1 ? '' : 's'} left. You needed ${N.need}.`);
    else if (G.uploaded >= N.need) endNight(true);
    else if (G.time <= 0) endNight(false, "Sunrise came before the People's Cluster was ready.");
  } else if (G.mode === 'intro') { player.live = false; updateMarkers(t, null, false); introFrame(dt);
  } else if (G.mode === 'menu' || G.mode === 'boot') {
    player.live = false; updateMarkers(t, null, false);
    camera.position.set(Math.sin(t * 0.12) * 8, 2.4 + Math.sin(t * 0.2) * 0.3, 7 + Math.cos(t * 0.12) * 1.5); camera.lookAt(0, 1.2, -2); viewRam.visible = false; handRam.visible = false;
    for (const s of sams) s.update(dt, t);
  } else { player.live = false; updateMarkers(t, null, false); fxPass.uniforms.alert.value *= 0.9; }
  if (draw) render(dt);
}

// ───────────────────────── boot ─────────────────────────
(async () => {
  $('title').classList.remove('on');
  const FOOT = 'Parody game. All dialogue is fictional. Not affiliated with any real person or company.';
  await loadSamModel(import.meta.env.BASE_URL, (p) => { $('foot').textContent = `loading characters ${Math.round(p * 100)}%`; });
  $('foot').textContent = FOOT;
  player.attachModel(assets.aj); if (player.actor && player.hand) { handRam.scale.setScalar(0.9 / player.actor.k); handRam.position.set(0, 7, 2); handRam.rotation.set(0, 0, Math.PI / 2); player.hand.add(handRam); }
  G.mode = 'menu'; updateBest(); setupMenuSam(); if (player.actor) player.actor.setVisible(false); $('bCont').disabled = !G.hasSave; ui.show('title', true);
  if (DEBUG) { ui.show('title', false); startNight(Math.min(parseInt(params.get('night') || '0', 10), 4)); }
  requestAnimationFrame(frame);
})();
if (DEBUG) window.__g = { renderer, fxPass, scene, audio, cluster, traps, breakers, placeTrap, useBreaker, playIntro, pickups, spawnPickup, endEndless, step, G, ctx, world, player, camera, get sams() { return sams; }, startNight, endNight, nav, hasModel };
