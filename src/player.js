// Third-person controller for Aj (with first-person toggle): acceleration, stamina, crouch, animation, collision-aware camera
import * as THREE from 'three';
import { camera } from './engine.js';
import { resolveCircle, sightBlocked } from './nav.js';
import { Actor } from './character.js';

const WALK = 2.0, SPRINT = 3.6, CROUCH = 1.0;

export class Player {
  constructor(controls, world, scene) {
    this.controls = controls; this.world = world; this.scene = scene;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector2(); this.keys = {};
    this.yaw = 0; this.pitch = 0.18; this.facing = Math.PI; this.dist = 3.4; this.firstPerson = false;
    this.stamina = 1; this.staminaMax = 1; this.exhausted = false; this.crouching = false; this.sprinting = false;
    this.noise = 0; this.noiseMul = 1; this.flashOn = false; this.speedNow = 0; this.stepAcc = 0; this.stepRate = 0; this.onStep = null; this.bobT = 0; this.actor = null; this.busy = 0;
    this.eyeH = 1.6; this.live = false; this.hiddenIn = null; this.nav = null;
    // flashlight rides on the camera so you light what you look at
    this.light = new THREE.SpotLight(0xdfeaff, 0, 24, 0.5, 0.7, 2); camera.add(this.light); this.lightTarget = new THREE.Object3D(); this.lightTarget.position.set(0, 0, -8); camera.add(this.lightTarget); this.light.target = this.lightTarget;
    // soft rim light so you can always see yourself in the dark
    this.rim = new THREE.PointLight(0x7fc8ff, 5, 4.5, 2); scene.add(this.rim);
    addEventListener('keydown', (e) => { this.keys[e.code] = true; if (e.code === 'KeyC' && !e.repeat) this.crouching = !this.crouching; if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) this.setFirstPerson(!this.firstPerson); } });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.drag = false;
    addEventListener('mousedown', (e) => { if (e.button === 0 || e.button === 2) this.drag = true; }); addEventListener('mouseup', () => { this.drag = false; });
    addEventListener('contextmenu', (e) => { if (this.live) e.preventDefault(); });
    addEventListener('mousemove', (e) => { if (!this.live) return; if (!this.controls.isLocked && !this.drag) return; this.yaw -= e.movementX * 0.0022; this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, this.hiddenIn ? -0.35 : -0.5, this.hiddenIn ? 0.45 : 1.1); });
    addEventListener('wheel', (e) => { this.dist = THREE.MathUtils.clamp(this.dist + Math.sign(e.deltaY) * 0.3, 2.0, 5.0); });
  }
  attachModel(gltf) {
    if (!gltf) { this.firstPerson = true; return; }
    this.actor = new Actor(gltf, { height: 1.74 }); this.scene.add(this.actor.root); this.actor.play('idle');
    this.hand = this.actor.bone('RightHand');
  }
  setFirstPerson(f) { this.firstPerson = f || !this.actor; if (this.actor) this.actor.setVisible(!this.firstPerson); }
  setFlash(on) { this.flashOn = on; this.light.intensity = on ? 380 : 0; }
  reset(p) {
    this.pos.set(p.x, 0, p.z); this.vel.set(0, 0); this.yaw = 0; this.pitch = 0.2; this.facing = Math.PI; this.stamina = 1; this.exhausted = false; this.crouching = false; this.noise = 0; this.busy = 0;
    this.setFlash(false); camera.fov = 62; camera.updateProjectionMatrix(); if (this.actor) { this.actor.once = null; this.actor.play('idle'); this.actor.setVisible(!this.firstPerson); }
  }
  // animation one-shots: throw/interact
  doThrow(onRelease) { if (!this.actor) { onRelease(); return; } this.busy = 0.85; this.facing = this.yaw + Math.PI; this.actor.playOnce('throw', null, 1); setTimeout(onRelease, 360); }
  doInteract() { if (this.actor && !this.busy) { this.busy = 0.8; this.actor.playOnce('interact', null, 1); } }
  enterHide(spot) {
    this.hiddenIn = spot; this.vel.set(0, 0); this.pos.set(spot.pos.x, 0, spot.pos.z); this.crouching = false; this.sprinting = false; this.setFlash(false);
    if (this.actor) this.actor.setVisible(false); this.pitch = 0.1; this.camD = undefined;
  }
  exitHide() {
    const spot = this.hiddenIn; if (!spot) return; this.hiddenIn = null;
    if (this.nav) { const out = this.nav.point(spot.pos.x + Math.sin(this.yaw + Math.PI) * 1.2, spot.pos.z + Math.cos(this.yaw + Math.PI) * 1.2); this.pos.set(out.x, 0, out.z); }
    resolveCircle(this.pos, 0.34, this.world.obstacles, this.world.bounds); this.facing = this.yaw + Math.PI;
    if (this.actor) this.actor.setVisible(!this.firstPerson); this.camD = undefined;
  }
  get eye() { return new THREE.Vector3(this.pos.x, this.crouching ? 1.0 : 1.55, this.pos.z); }

  update(dt) {
    const k = this.keys;
    let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    if (this.hiddenIn) { f = 0; r = 0; }
    this.busy = Math.max(0, this.busy - dt);
    const wantSprint = (k.ShiftLeft || k.ShiftRight) && !this.crouching && (f || r) && !this.exhausted && !this.busy;
    this.sprinting = wantSprint && this.stamina > 0;
    const maxSpeed = this.hiddenIn ? 0 : this.busy ? 0.4 : this.crouching ? CROUCH : this.sprinting ? SPRINT : WALK;
    const fwd = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw)), right = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
    const wish = new THREE.Vector2().addScaledVector(fwd, f).addScaledVector(right, r); if (wish.lengthSq() > 0) wish.normalize();
    this.vel.lerp(wish.clone().multiplyScalar(maxSpeed), Math.min(1, dt * (wish.lengthSq() > 0 ? 9 : 10)));
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt; resolveCircle(this.pos, 0.34, this.world.obstacles, this.world.bounds);
    this.speedNow = this.vel.length();
    // character faces where it walks
    if (this.speedNow > 0.25 && !this.busy) { const want = Math.atan2(this.vel.x, this.vel.y); this.facing += Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing)) * Math.min(1, dt * 10); }
    else if (this.busy) this.facing += Math.atan2(Math.sin(this.yaw + Math.PI - this.facing), Math.cos(this.yaw + Math.PI - this.facing)) * Math.min(1, dt * 12);
    // stamina
    if (this.sprinting && this.speedNow > 1) this.stamina -= dt * 0.2 / this.staminaMax; else this.stamina += dt * (this.speedNow < 0.5 ? 0.3 : 0.1);
    this.stamina = THREE.MathUtils.clamp(this.stamina, 0, 1); if (this.stamina <= 0) this.exhausted = true; if (this.exhausted && this.stamina > 0.3) this.exhausted = false;
    // noise (0..1), what Sam can hear
    const base = this.crouching ? 0.05 : this.sprinting ? 1.0 : 0.28; const target = (this.speedNow > 0.4 ? base : 0.02) * this.noiseMul;
    this.noise += (target - this.noise) * Math.min(1, dt * (target > this.noise ? 10 : 3));
    if (this.hiddenIn) this.noise *= 0.9;
    // animation
    if (this.actor && !this.hiddenIn) {
      let clip = this.crouching ? 'crouchIdle' : 'idle', ts = 1;
      if (this.speedNow > 0.3) { if (this.crouching) { clip = 'crouchWalk'; ts = this.speedNow / 0.8; } else if (this.sprinting && this.speedNow > 2.6) { clip = 'run'; ts = this.speedNow / 3.5; } else { clip = 'walk'; ts = this.speedNow / 1.5; } }
      const tsc = THREE.MathUtils.clamp(ts, 0.5, 1.6); this.actor.play(clip, tsc, 0.22);
      const T = { walk: 1.1, run: 0.7, crouchWalk: 1.5 }[clip]; this.stepRate = T ? (2 * tsc) / T : 0; this.actor.update(dt); // two foot-falls per cycle of the clip
      this.actor.root.position.copy(this.pos); this.actor.root.rotation.y = this.facing;
    }
    this.rim.position.set(this.pos.x, 2.2, this.pos.z);
    // footsteps
    if (this.speedNow > 0.3) { this.bobT += dt * this.speedNow * 2.6; this.stepAcc += dt * (this.stepRate || this.speedNow / 1.5); if (this.stepAcc >= 1) { this.stepAcc -= 1; this.onStep?.(this.noise); } } else this.stepAcc = 0;
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const e = this.eye;
    const fovT = (this.sprinting ? 68 : 62) - (this.crouching ? 2 : 0); camera.fov += (fovT - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix();
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.hiddenIn) {
      const sp = this.hiddenIn; camera.position.set(sp.pos.x - Math.sin(this.yaw) * 0.25, 1.15 + Math.sin(performance.now() / 900) * 0.01, sp.pos.z - Math.cos(this.yaw) * 0.25); camera.lookAt(camera.position.clone().add(dir)); return;
    }
    if (this.firstPerson) {
      camera.position.copy(e).y += Math.sin(this.bobT * 2) * 0.012 * Math.min(1, this.speedNow); camera.lookAt(camera.position.clone().add(dir)); return;
    }
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const target = e.clone().add(new THREE.Vector3(0, 0.15, 0)).addScaledVector(right, 0.45);
    // pull the camera in if something solid is between the character and the desired spot
    let d = this.dist, want = target.clone().addScaledVector(dir, -d);
    while (d > 0.6) { want = target.clone().addScaledVector(dir, -d); if (!sightBlocked(target.x, target.z, want.x, want.z, this.world.obstacles) && Math.abs(want.x) < this.world.HX - 0.25 && Math.abs(want.z) < this.world.HZ - 0.25 && want.y > 0.25 && want.y < 3.6) break; d -= 0.2; }
    this.camD = this.camD === undefined ? d : this.camD + (d - this.camD) * Math.min(1, dt * (d < this.camD ? 18 : 4));
    camera.position.copy(target).addScaledVector(dir, -this.camD); camera.lookAt(target.clone().addScaledVector(dir, 6));
  }
}
