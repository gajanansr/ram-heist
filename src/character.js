// Animated character wrapper for the converted Aj GLBs (clips: idle, walk, run, crouchIdle, crouchWalk, search, look, stun, throw, interact)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export function loadGLB(url, onProgress) {
  return new Promise((res) => loader.load(url, res, (e) => e.total && onProgress?.(e.loaded / e.total), () => res(null)));
}

export class Actor {
  constructor(gltf, { height = 1.78, tint = null } = {}) {
    this.root = new THREE.Group(); this.holder = new THREE.Group(); this.root.add(this.holder);
    const model = SkeletonUtils.clone(gltf.scene); this.model = model; this.holder.add(model);
    model.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(model); this.k = height / (b.max.y - b.min.y);
    this.holder.scale.setScalar(this.k); this.holder.position.y = -b.min.y * this.k;
    model.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const ms = [].concat(o.material).map((m) => { const c = m.clone(); c.envMapIntensity = 0.7; if (tint && c.color) c.color.set(tint); return c; }); o.material = Array.isArray(o.material) ? ms : ms[0];
    });
    this.mixer = new THREE.AnimationMixer(model); this.actions = {};
    for (const c of gltf.animations) this.actions[c.name] = this.mixer.clipAction(c);
    this.cur = null; this.once = null; this.curName = ''; this.started = false;
  }
  // looping state animation; ignored while a one-shot is playing
  play(name, ts = 1, fade = 0.25) {
    const a = this.actions[name]; if (!a || this.once) return;
    if (this.cur === a) { a.timeScale = ts; return; }
    if (!this.started) { // very first clip: apply at full weight straight away, so the raw T-pose rest pose is never visible
      this.started = true; a.reset().setEffectiveTimeScale(ts).setEffectiveWeight(1).play(); this.mixer.update(0); this.cur = a; this.curName = name; return;
    }
    a.reset().setEffectiveTimeScale(ts).setEffectiveWeight(1).fadeIn(fade).play(); if (this.cur) this.cur.fadeOut(fade); this.cur = a; this.curName = name;
  }
  playOnce(name, onDone, ts = 1) {
    const a = this.actions[name]; if (!a) return; if (this.once) this.once.fadeOut(0.1); this.started = true;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = ts; a.setEffectiveWeight(1).fadeIn(0.12).play(); if (this.cur) this.cur.fadeOut(0.12);
    this.once = a; this.curName = name;
    const fin = (e) => { if (e.action !== a) return; this.mixer.removeEventListener('finished', fin); a.fadeOut(0.25); this.once = null; this.cur = null; this.curName = ''; onDone?.(); };
    this.mixer.addEventListener('finished', fin);
  }
  update(dt) { this.mixer.update(dt); }
  bone(n) { return this.model.getObjectByName('mixamorig' + n); }
  setVisible(v) { this.root.visible = v; }
}
