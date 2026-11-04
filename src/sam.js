// Sam (and the interns): model loading, procedural animation, flashlight, and AI state machine
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Actor, loadGLB } from './character.js';
import { aoHide } from './engine.js';
import { resolveCircle, sightBlocked } from './nav.js';
import * as audio from './audio.js';
import { BARKS } from './dialogue.js';

const SAM_HEIGHT = 1.78;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ── model loading: optional Sketchfab static model (public/models/sam.glb) + the converted Aj rigs
export const assets = { custom: null, aj: null };
export async function loadSamModel(base, onProgress) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const url of ['models/sam.glb', 'models/sam/scene.gltf']) {
    try {
      const gltf = await new Promise((res, rej) => loader.load(base + url, res, (e) => e.total && onProgress?.(e.loaded / e.total), rej));
      assets.custom = { scene: gltf.scene, animations: gltf.animations }; break;
    } catch { }
  }
  assets.aj = await loadGLB(base + 'models/aj.glb', onProgress);
  return !!assets.custom;
}
export const hasModel = () => !!assets.custom;
const loaded = null; void loaded;

function normalize(root) {
  root.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(root); const size = b.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(SAM_HEIGHT / size.y); root.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(root); const c = b.getCenter(new THREE.Vector3());
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b.min.y;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m) m.envMapIntensity = 0.9; }); } });
}

function fallbackBody(tint) {
  const g = new THREE.Group(), limbs = {};
  const suit = new THREE.MeshStandardMaterial({ color: tint ? 0x7a3a74 : 0x2a3140, roughness: 0.7 }), skin = new THREE.MeshStandardMaterial({ color: 0xe0b394, roughness: 0.6 }), shirt = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.8 });
  const part = (geo, m, x, y, z, parent = g) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
  part(new THREE.BoxGeometry(0.5, 0.65, 0.27), suit, 0, 1.2, 0); part(new THREE.BoxGeometry(0.16, 0.5, 0.01), shirt, 0, 1.28, 0.14);
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };
  limbs.legL = pivot(-0.13, 0.88); limbs.legR = pivot(0.13, 0.88); limbs.armL = pivot(-0.34, 1.48); limbs.armR = pivot(0.34, 1.48);
  for (const l of [limbs.legL, limbs.legR]) { part(new THREE.BoxGeometry(0.17, 0.82, 0.19), suit, 0, -0.41, 0, l); part(new THREE.BoxGeometry(0.19, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x15171a }), 0, -0.84, 0.05, l); }
  for (const a of [limbs.armL, limbs.armR]) { part(new THREE.BoxGeometry(0.12, 0.6, 0.13), suit, 0, -0.3, 0, a); part(new THREE.SphereGeometry(0.06, 10, 8), skin, 0, -0.64, 0, a); }
  const head = part(new THREE.SphereGeometry(0.15, 24, 18), skin, 0, 1.68, 0); head.scale.set(0.9, 1.1, 1);
  const hair = part(new THREE.SphereGeometry(0.155, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 }), 0, 1.72, 0);
  part(new THREE.BoxGeometry(0.06, 0.06, 0.06), skin, 0, 1.57, 0.02);
  limbs.head = head;
  return { group: g, limbs };
}

// ── volumetric flashlight cone
const CONE_LEN = 12;
function makeConeMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(1, 0.92, 0.7) }, len: { value: CONE_LEN }, power: { value: 1 } },
    vertexShader: `varying float vZ; varying vec3 vN; varying vec3 vV; uniform float len;
      void main(){ vZ = position.z/len; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vZ; varying vec3 vN; varying vec3 vV; uniform vec3 color; uniform float power;
      void main(){ float f = pow(abs(dot(normalize(vN),normalize(vV))),1.5); float a = pow(1.-vZ,1.6)*f*0.2*power; gl_FragColor = vec4(color*a, a); }`,
  });
}

export const STATE = { PATROL: 'patrol', SEARCH: 'search', INVESTIGATE: 'investigate', LOOK: 'look', CHASE: 'chase', STUNNED: 'stunned', GRAB: 'grab' };

export class Sam {
  constructor(opts, g, idx) {
    this.o = opts; this.g = g; this.idx = idx;
    this.name = opts.name; this.who = 'sam';
    this.baseSpeed = opts.speed; this.baseRange = opts.range; this.half = 0.44;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.root = new THREE.Group(); g.scene.add(this.root);
    this.body = new THREE.Group(); this.root.add(this.body);
    this.state = STATE.PATROL; this.path = []; this.target = null; this.timer = 0; this.aware = 0; this.lostT = 0; this.repathT = 0;
    this.slipT = 0; this.mouth = 0; this.morphMeshes = []; this.gestT = 0; this.gestIdx = 0; this.talking = false; this.walkT = Math.random() * 6; this.stepAcc = 0; this.stepRate = 0; this.mood = 0; this.barkCD = 2 + idx * 1.5; this.hearCD = 0; this.stunT = 0; this.lastSeen = new THREE.Vector3(); this.checked = new Map();
    this.lookT = 0; this.suspect = null; this.moveSpeed = 0; this.limbs = null; this.mixer = null; this.walkAction = null;
    this.buildBody(); this.buildLight(); this.setActive(true);
  }
  buildBody() {
    this.body.clear(); this.limbs = null; this.mixer = null; this.actor = null;
    const animatedCustom = assets.custom && assets.custom.animations?.some((c) => c.name === 'walk');
    if (animatedCustom) { // converted textured Sam with generated clips
      this.actor = new Actor(assets.custom, { height: SAM_HEIGHT }); this.body.add(this.actor.root); this.actor.play('idle');
      this.morphMeshes = []; this.actor.model.traverse((o) => { if (o.morphTargetDictionary && o.morphTargetDictionary.jawOpen !== undefined) this.morphMeshes.push(o); });
    } else if (assets.custom && !animatedCustom) { // static model: procedural bob + sway
      const m = SkeletonUtils.clone(assets.custom.scene); normalize(m); if (g_flip) m.rotation.y = Math.PI; this.body.add(m);
      if (this.o.tint) m.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.lerp(new THREE.Color(this.o.tint), 0.35); } });
      if (assets.custom.animations?.length) { this.mixer = new THREE.AnimationMixer(m); const clip = assets.custom.animations.find((c) => /walk/i.test(c.name)) || assets.custom.animations[0]; this.mixer.clipAction(clip).play(); }
    } else {
      const f = fallbackBody(!!this.o.tint); this.body.add(f.group); this.limbs = f.limbs;
    }
  }
  buildLight() {
    this.lamp = new THREE.Group(); this.lamp.rotation.order = 'YXZ'; this.lamp.position.set(0.28, 1.3, 0.35); this.root.add(this.lamp);
    this.spot = new THREE.SpotLight(this.o.tint ? 0xffb8f4 : 0xfff1d0, 800, 20, this.half, 0.55, 2); this.spot.castShadow = this.idx === 0;
    if (this.spot.castShadow) { this.spot.shadow.mapSize.set(1024, 1024); this.spot.shadow.bias = -0.0004; this.spot.shadow.radius = 4; }
    this.spotTarget = new THREE.Object3D(); this.spotTarget.position.set(0, 0, 6); this.lamp.add(this.spot, this.spotTarget); this.spot.target = this.spotTarget;
    const r = Math.tan(this.half) * CONE_LEN; const geo = new THREE.ConeGeometry(r, CONE_LEN, 48, 1, true); geo.translate(0, -CONE_LEN / 2, 0); geo.rotateX(-Math.PI / 2);
    this.coneMat = makeConeMat(); this.cone = new THREE.Mesh(geo, this.coneMat); this.cone.renderOrder = 5; this.lamp.add(this.cone); aoHide.push(this.cone);
    this.lamp.rotation.x = 0.13;
    this.glow = new THREE.PointLight(this.o.tint ? 0xff9cf0 : 0xffd9a0, 1.2, 3.5, 2); this.glow.position.set(0, 1.5, 0.6); this.root.add(this.glow);
  }
  setActive(a) { this.root.visible = a; this.active = a; }
  teleport(p) { this.suspect = null; this.pos.copy(p); this.root.position.copy(p); this.state = STATE.PATROL; this.path = []; this.target = null; this.aware = 0; this.stunT = 0; this.mood = 0; this.checked.clear(); }
  dispose() { this.g.scene.remove(this.root); const i = aoHide.indexOf(this.cone); if (i >= 0) aoHide.splice(i, 1); this.root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose?.(); }); this.spot.dispose?.(); }

  // world position of Sam's right hand (where he holds Aj)
  handWorld(out) {
    if (this.actor && this.handBone === undefined) { this.handBone = null; this.actor.model.traverse((o) => { if (!this.handBone && o.isBone && /^(mixamorig)?RightHand_?\d*$/.test(o.name)) this.handBone = o; }); }
    if (this.handBone) { this.root.updateMatrixWorld(true); return this.handBone.getWorldPosition(out); }
    return out.set(this.pos.x + Math.sin(this.yaw) * 0.5, 1.7, this.pos.z + Math.cos(this.yaw) * 0.5);
  }
  // a coffee trap: Sam goes down for a few seconds
  slip() { this.state = STATE.STUNNED; this.stunT = 5; this.slipT = 5; this.path = []; this.aware = 0; this.suspect = null; this.say('slip', true); audio.sfx('trap_slip', { pos: this.pos }); }
  // lip sync from the live voice audio, and which talking gesture to use
  speechFx(dt) {
    const v = audio.voiceState(), mine = !!v.id && v.id.startsWith('sam_');
    let target = mine ? Math.min(1, v.amp * 5.5) : 0; if (this.forceMouth !== undefined) target = this.forceMouth;
    this.mouth += (target - this.mouth) * Math.min(1, dt * (target > this.mouth ? 24 : 12));
    const pk = mine ? THREE.MathUtils.clamp((950 - v.centroid) / 700, 0, 1) * 0.8 : 0, sm = mine ? THREE.MathUtils.clamp((v.centroid - 1900) / 1500, 0, 1) * 0.7 : 0;
    for (const m of this.morphMeshes) { m.morphTargetInfluences[0] = this.mouth * (1 - 0.4 * pk); m.morphTargetInfluences[1] = pk * this.mouth; m.morphTargetInfluences[2] = sm * this.mouth; }
    this.talking = mine || this.forceMouth !== undefined; return this.talking;
  }
  gestureClip(dt) { this.gestT -= dt; if (this.gestT <= 0) { this.gestT = 2.6 + Math.random() * 1.4; this.gestIdx = (this.gestIdx + 1 + Math.floor(Math.random() * 2)) % 3; } return ['talkA', 'talkB', 'talkC'][this.gestIdx]; }

  get speed() { return this.baseSpeed * (1 + 0.3 * this.mood); }
  get range() { return this.baseRange * this.g.rangeMul; }

  say(cat, force = false) {
    if (this.barkCD > 0 && !force) return;
    const list = BARKS[cat]; if (!list) return;
    this.barkCD = 6.5; this.g.bark(this, pick(list));
  }

  chooseSpot(near) {
    const spots = this.g.world.spots, now = performance.now() / 1000;
    const w = spots.map((s) => {
      let v = 1 + s.stash * (0.5 + this.g.difficulty * 0.35);
      if (near) v += Math.max(0, 7 - s.pos.distanceTo(near)) * 1.4;
      const c = this.checked.get(s); if (c && now - c < 14) v *= 0.15;
      if (s === this.target) v *= 0.1; return v;
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < spots.length; i++) { r -= w[i]; if (r <= 0) return spots[i]; }
    return spots[0];
  }
  goTo(p) { this.path = this.g.nav.find(this.pos.x, this.pos.z, p.x, p.z); }

  // the player has just ducked into a hiding spot; if Sam was close and watching, he saw where
  onPlayerHid(spot) {
    if (!this.active || this.state === STATE.STUNNED) return;
    const near = this.pos.distanceTo(spot.pos) < 10;
    if (this.state === STATE.CHASE || (this.aware > 0.25 && near)) { this.suspect = spot; this.say('suspect', true); this.state = STATE.INVESTIGATE; this.noisePos = spot.pos.clone(); this.goTo(spot.pos); this.aware = 0; }
  }
  hear(p, radius) {
    if (!this.active || this.hearCD > 0 || this.state === STATE.CHASE || this.state === STATE.STUNNED || this.state === STATE.GRAB) return false;
    if (this.pos.distanceTo(p) > radius) return false;
    this.hearCD = 1.4; this.state = STATE.INVESTIGATE; this.noisePos = p.clone(); this.goTo(p); this.say('hear', true); return true;
  }

  // follow this.path; returns true when the path is finished
  follow(dt, speed) {
    this.moveSpeed = 0; if (!this.path.length) return true;
    const w = this.path[0]; const dx = w.x - this.pos.x, dz = w.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { this.path.shift(); return !this.path.length; }
    this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    const step = Math.min(speed * dt, d); this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
    resolveCircle(this.pos, 0.38, this.g.world.obstacles, this.g.world.bounds); this.moveSpeed = speed; return false;
  }
  faceToward(p, dt, k = 6) { this.yaw += angDiff(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z)) * Math.min(1, dt * k); }

  startChase() {
    this.state = STATE.CHASE; this.lostT = 0; this.repathT = 0; this.say('chase', true); audio.sfx('spotted_sting'); this.g.onSpotted(this);
  }

  update(dt, t) {
    if (!this.active) return;
    const g = this.g, P = g.player, W = g.world;
    this.barkCD -= dt; this.hearCD -= dt; this.mood = Math.min(1, this.mood + dt * 0.004 * g.difficulty);
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), ang = Math.acos(THREE.MathUtils.clamp((fx * dx + fz * dz) / (dist || 1), -1, 1));
    let range = this.range * (P.crouching ? 0.7 : 1) * (P.sprinting ? 1.15 : 1);
    if (W.blackout) range *= P.flashOn ? 1.3 : 0.36; else if (W.lightLevel < 0.5) range *= P.flashOn ? 1.1 : 0.7;
    const clear = !sightBlocked(this.pos.x, this.pos.z, P.pos.x, P.pos.z, W.obstacles);
    const hid = !!P.hiddenIn;
    const seen = !hid && this.state !== STATE.STUNNED && this.state !== STATE.GRAB && clear && dist < range && ang < this.half;
    const prox = !hid && this.state !== STATE.STUNNED && this.state !== STATE.GRAB && clear && dist < 1.8 && !P.crouching;
    if (seen || prox) { if (this.aware === 0) this.say('spot', true); this.aware += dt * (0.32 + (1 - dist / range) * 1.5 + (prox ? 1.2 : 0)); this.lastSeen.copy(P.pos); }
    else this.aware = Math.max(0, this.aware - dt * (hid ? 1.2 : 0.45));
    if (this.aware >= 1 && this.state !== STATE.CHASE && this.state !== STATE.STUNNED && this.state !== STATE.GRAB) this.startChase();
    this.aware = Math.min(1, this.aware);
    this.sees = seen || prox;

    switch (this.state) {
      case STATE.PATROL: {
        if (!this.target || !this.path.length) {
          if (!this.path.length && this.target && this.pos.distanceTo(this.target.pos) < 2.2) { this.state = STATE.SEARCH; this.timer = rand(3, 4.2); this.say('search'); break; }
          this.target = this.chooseSpot(); this.goTo(this.target.pos);
        }
        const done = this.follow(dt, this.speed);
        if (done) { this.state = STATE.SEARCH; this.timer = rand(3, 4.2); this.say('search'); }
        if (Math.random() < dt * 0.05) this.say('patrol');
        break;
      }
      case STATE.SEARCH: {
        this.moveSpeed = 0; if (this.target) this.faceToward(this.target.pos, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          const s = this.target; this.checked.set(s, performance.now() / 1000);
          if (s && P.hiddenIn === s) { g.onFound(this, s); this.aware = 0; this.path = []; this.say('found', true); break; }
          if (s && s.stash > 0) { const n = s.stash; s.stash = 0; g.onSteal(this, n, s); this.say('steal', true); this.mood = Math.min(1, this.mood * 0.6); }
          else { this.say('miss'); this.mood = Math.min(1, this.mood + 0.08); if (this.mood > 0.55) this.say('frustrated'); }
          this.state = STATE.PATROL; this.target = this.chooseSpot(this.noisePos); this.goTo(this.target.pos);
        }
        break;
      }
      case STATE.INVESTIGATE: {
        const done = this.follow(dt, this.speed * 1.3);
        if (done) { this.state = STATE.LOOK; this.lookT = 0; this.timer = 2.4; }
        break;
      }
      case STATE.LOOK: {
        this.moveSpeed = 0; this.lookT += dt; this.yaw += Math.sin(this.lookT * 2.4) * dt * 1.6; this.timer -= dt;
        if (this.timer <= 0) { this.state = STATE.PATROL; if (this.suspect) { this.target = this.suspect; this.suspect = null; } else this.target = this.chooseSpot(this.noisePos || this.pos); this.goTo(this.target.pos); }
        break;
      }
      case STATE.CHASE: {
        this.repathT -= dt; if (this.repathT <= 0) { this.repathT = 0.25; this.goTo(this.sees ? P.pos : this.lastSeen); }
        const done = this.follow(dt, this.speed * 1.45); this.lostT = this.sees ? 0 : this.lostT + dt;
        if (hid && this.sees === false && !this.suspect) { this.suspect = P.hiddenIn; this.say('suspect', true); this.state = STATE.INVESTIGATE; this.noisePos = this.lastSeen.clone(); this.goTo(this.noisePos); this.aware = 0; break; }
        if (dist < 1.15 && clear) { g.onCatch(this); this.aware = 0; this.say('caught', true); this.path = []; }
        else if ((done && !this.sees) || this.lostT > 3.5) { this.say('lost', true); this.state = STATE.INVESTIGATE; this.noisePos = this.lastSeen.clone(); this.goTo(this.noisePos); this.aware = 0; }
        break;
      }
      case STATE.GRAB: { this.moveSpeed = 0; this.faceToward(P.pos, dt, 10); break; }
      case STATE.STUNNED: {
        this.moveSpeed = 0; this.stunT -= dt;
        if (this.stunT <= 0) { this.state = STATE.PATROL; this.target = this.chooseSpot(P.pos.clone().multiplyScalar(-0.5)); this.goTo(this.target.pos); }
        break;
      }
    }

    // ── presentation
    this.root.position.set(this.pos.x, 0, this.pos.z); this.root.rotation.y = this.yaw;
    const moving = this.moveSpeed > 0.1, chase = this.state === STATE.CHASE;
    this.walkT += dt * (moving ? this.moveSpeed * (chase ? 2.0 : 2.7) : 0);
    this.stepAcc += moving ? dt * (this.stepRate || this.moveSpeed / 1.15) : 0;
    if (this.stepAcc >= 1) { this.stepAcc -= 1; audio.sfx('sam_step', { pos: this.pos }); }
    const s = Math.sin(this.walkT);
    if (this.limbs) {
      const amp = moving ? (chase ? 0.95 : 0.65) : 0, L = this.limbs;
      L.legL.rotation.x = s * amp; L.legR.rotation.x = -s * amp; L.armL.rotation.x = -s * amp * 0.9; L.armR.rotation.x = s * amp * 0.9 * (this.state === STATE.SEARCH ? 0.2 : 1);
      if (this.state === STATE.SEARCH) L.armR.rotation.x = -1.2 + Math.sin(t * 6) * 0.3;
    }
    if (this.mixer) { this.mixer.update(dt * (moving ? this.moveSpeed / 2 : 0.0001)); }
    if (this.actor) {
      const st = this.state; let clip = 'idle', ts = 1;
      if (st === STATE.GRAB) clip = 'hold'; else if (st === STATE.STUNNED) clip = 'stun'; else if (st === STATE.SEARCH) clip = 'search'; else if (st === STATE.LOOK) clip = 'look';
      else if (moving) { if (this.moveSpeed > 2.35) { clip = 'run'; ts = THREE.MathUtils.clamp(this.moveSpeed / 3.5, 0.6, 1.4); } else { clip = 'walk'; ts = THREE.MathUtils.clamp(this.moveSpeed / 1.5, 0.6, 1.5); } }
      const talking = this.speechFx(dt); if (clip === 'idle' && talking) clip = this.gestureClip(dt);
      this.actor.play(clip, ts, 0.3); this.actor.update(dt); this.stepRate = clip === 'walk' ? (2 * ts) / 1.1 : clip === 'run' ? (2 * ts) / 0.7 : 0; // foot-falls per second, in sync with the animation
    }
    this.body.position.y = moving && !this.actor ? Math.abs(s) * 0.05 : 0;
    this.body.rotation.z = this.actor ? 0 : this.state === STATE.STUNNED ? Math.sin(t * 40) * 0.05 : moving ? s * 0.04 : 0;
    this.slipT = Math.max(0, this.slipT - dt); const slipping = this.slipT > 0;
    this.body.rotation.x += ((slipping ? -1.45 : this.actor ? 0 : chase ? 0.18 : this.state === STATE.SEARCH ? 0.22 : 0) - this.body.rotation.x) * Math.min(1, dt * (slipping ? 10 : 6)); if (slipping) this.body.position.y = 0.12; this.lamp.rotation.x = slipping ? -0.9 : 0.13;
    // flashlight: gentle sweep, flicker when stunned, red on chase
    const sweep = this.state === STATE.LOOK ? 0 : Math.sin(t * 1.4 + this.idx) * 0.1; this.lamp.rotation.y = sweep;
    const grabbing = this.state === STATE.GRAB; this.cone.visible = !grabbing; const on = this.state === STATE.STUNNED ? (Math.random() > 0.5 ? 1 : 0.15) : grabbing ? 0 : 1; this.glow.intensity = grabbing ? 0 : 1.2; this.spot.intensity = 650 * on; this.coneMat.uniforms.power.value = on;
    const col = chase ? 0xff8f7a : this.o.tint ? 0xffb8f4 : 0xfff1d0; this.spot.color.setHex(col); this.coneMat.uniforms.color.value.setHex(col);
  }
}

let g_flip = false;
export function setFlip(f) { g_flip = f; }
