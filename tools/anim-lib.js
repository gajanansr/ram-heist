// Rig-agnostic procedural animation for humanoid skeletons (any naming via a finder; T-pose or A-pose rest).
import * as THREE from 'three';
const D = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
export const NAMES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];

// find(name) -> Object3D for a canonical bone name. heightM = character height in metres (for hip bob scaling).
export function buildRig(root, find, heightM = 1.78) {
  root.updateMatrixWorld(true);
  const rig = { bones: {}, sL: 1, unit: heightM / 186, log: {} };
  for (const n of NAMES) {
    const b = find(n); if (!b) throw new Error('missing bone ' + n);
    const wq = new THREE.Quaternion(); b.getWorldQuaternion(wq);
    rig.bones[n] = { b, restLocal: b.quaternion.clone(), restWorld: wq, restWorldInv: wq.clone().invert(), restPos: b.position.clone() };
  }
  const P = (n) => rig.bones[n].b.getWorldPosition(new THREE.Vector3());
  rig.sL = P('LeftArm').x > P('RightArm').x ? 1 : -1;
  // how far the arms already hang down from horizontal at rest (0 = T-pose), in degrees
  rig.armBase = {};
  for (const sd of ['Left', 'Right']) { const a = P(sd + 'Arm'), f = P(sd + 'ForeArm'); rig.armBase[sd] = Math.atan2(a.y - f.y, Math.abs(f.x - a.x)) / D; }
  const hips = rig.bones.Hips.b, par = hips.parent, pq = new THREE.Quaternion(), ps = new THREE.Vector3(); par.getWorldQuaternion(pq); par.getWorldScale(ps);
  rig.hipsParentInv = pq.clone().invert(); rig.hipsParentScale = ps.x || 1;
  rig.log = { leftSign: rig.sL, armBase: rig.armBase, parentScale: rig.hipsParentScale };
  return rig;
}
const qa = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);
function applyPose(rig, pose) {
  const out = {};
  for (const n of NAMES) {
    const r = rig.bones[n]; const list = pose[n];
    if (!list || !list.length) { out[n] = r.restLocal.clone(); continue; }
    const dw = new THREE.Quaternion(); for (const [ax, an] of list) dw.premultiply(qa(ax, an));
    out[n] = r.restLocal.clone().multiply(r.restWorldInv.clone().multiply(dw).multiply(r.restWorld));
  }
  return out;
}
function body(rig, p) {
  const pose = {}; const add = (n, ax, ang) => { if (!ang) return; (pose[n] ||= []).push([ax, ang * D]); }; const g = (k) => p[k] || 0;
  for (const [side, tf, kn] of [['Left', g('thighL'), g('kneeL')], ['Right', g('thighR'), g('kneeR')]]) { add(side + 'UpLeg', X, -tf); add(side + 'Leg', X, kn); add(side + 'Foot', X, tf - kn + g('footPitch')); }
  for (const [side, sg, af, el, spread] of [['Left', -rig.sL, g('armL'), g('elbowL'), g('spreadL')], ['Right', rig.sL, g('armR'), g('elbowR'), g('spreadR')]]) {
    add(side + 'Arm', Z, sg * (72 - spread - rig.armBase[side])); add(side + 'Arm', X, -af); add(side + 'ForeArm', X, -el);
  }
  add('Spine', X, g('lean') * 0.4); add('Spine1', X, g('lean') * 0.35); add('Spine2', X, g('lean') * 0.25);
  add('Spine', Y, g('twist') * 0.4); add('Spine1', Y, g('twist') * 0.3); add('Spine2', Y, g('twist') * 0.3);
  add('Spine1', Z, g('sway')); add('Hips', Y, g('hipsTwist')); add('Hips', Z, g('hipsRoll'));
  add('Neck', Y, g('headYaw') * 0.4); add('Head', Y, g('headYaw') * 0.6); add('Neck', X, g('headPitch') * 0.4 - g('lean') * 0.3); add('Head', X, g('headPitch') * 0.6 - g('lean') * 0.25);
  return { pose, hipsDy: g('hipsDy'), hipsDx: g('hipsDx') };
}
const s = Math.sin, c = Math.cos, TAU = Math.PI * 2;
const smooth = (x) => x * x * (3 - 2 * x), clamp01 = (x) => Math.min(1, Math.max(0, x));

const CLIPS = {
  idle: { dur: 4.8, loop: true, f: (t, T) => { const p = TAU * t / T, w = s(p); return { thighL: 3 + 2 * w, thighR: 3 - 2 * w, kneeL: 4 + 5 * Math.max(0, w), kneeR: 4 + 5 * Math.max(0, -w), hipsRoll: 2.2 * w, hipsDx: 0.6 * w, hipsTwist: 1.5 * s(2 * p), sway: -2.2 * w, hipsDy: -0.4 + 0.3 * s(2 * p), armL: 5 + 2 * s(p + 1), armR: 3 + 2 * s(p), elbowL: 34 + 4 * s(p + 0.5), elbowR: 40 + 4 * s(p + 2), spreadL: 5, spreadR: 5, lean: 1 + 0.7 * s(2 * p), headYaw: 5 * s(p) + 2 * s(2 * p + 1), headPitch: -1 + 1.5 * s(2 * p), twist: 2 * s(p + 1.5) }; } },
  walk: { dur: 1.1, loop: true, f: (t, T) => { const p = TAU * t / T, A = 26; return {
    thighL: -A * s(p), thighR: A * s(p), kneeL: 6 + 38 * Math.max(0, -c(p)), kneeR: 6 + 38 * Math.max(0, c(p)),
    armL: 36 * s(p), armR: -36 * s(p), elbowL: 22 + 22 * (1 + s(p)) / 2, elbowR: 22 + 22 * (1 - s(p)) / 2, lean: 4, twist: -6 * s(p), hipsTwist: 5 * s(p), hipsDy: 1.7 * c(2 * p) - 0.5, hipsDx: 0.9 * s(p), sway: 1.5 * s(p), spreadL: 5, spreadR: 5, headYaw: 2 * s(p), }; } },
  run: { dur: 0.7, loop: true, f: (t, T) => { const p = TAU * t / T, A = 46; return {
    thighL: -A * s(p) + 6, thighR: A * s(p) + 6, kneeL: 20 + 85 * Math.max(0, -c(p)), kneeR: 20 + 85 * Math.max(0, c(p)),
    armL: 58 * s(p), armR: -58 * s(p), elbowL: 90 + 16 * s(p), elbowR: 90 - 16 * s(p), lean: 13, twist: -10 * s(p), hipsTwist: 8 * s(p), hipsDy: 3.2 * c(2 * p) - 1.5, hipsDx: 1.2 * s(p), sway: 2 * s(p), spreadL: 2, spreadR: 2, headPitch: -5, }; } },
  crouchIdle: { dur: 3.2, loop: true, f: (t, T) => { const p = TAU * t / T; return { thighL: 50, thighR: 50, kneeL: 98, kneeR: 98, lean: 22 + s(p), armL: 18, armR: 18, elbowL: 30, elbowR: 30, hipsDy: -28, headPitch: -12, spreadL: 8, spreadR: 8, footPitch: 0 }; } },
  crouchWalk: { dur: 1.5, loop: true, f: (t, T) => { const p = TAU * t / T, A = 24; return {
    thighL: 50 - A * s(p), thighR: 50 + A * s(p), kneeL: 98 + 14 * Math.max(0, -c(p)), kneeR: 98 + 14 * Math.max(0, c(p)),
    lean: 22, armL: 14 + 18 * s(p), armR: 14 - 18 * s(p), elbowL: 40, elbowR: 40, hipsDy: -28 + 0.8 * c(2 * p), hipsDx: 0.6 * s(p), twist: -4 * s(p), headPitch: -12, spreadL: 8, spreadR: 8, }; } },
  search: { dur: 2.0, loop: true, f: (t, T) => { const p = TAU * t / T; return { lean: 16 + s(p) * 2, armR: 78 + s(p * 2) * 6, elbowR: 38 + 14 * s(p * 2), armL: 10, elbowL: 20, headPitch: 14, headYaw: 18 * s(p), twist: 8 * s(p), thighL: 4, thighR: 4, hipsDy: -0.8, spreadL: 6, spreadR: 6 }; } },
  look: { dur: 3.4, loop: true, f: (t, T) => { const p = TAU * t / T; return { lean: 2, headYaw: 48 * s(p), twist: 14 * s(p), armL: 5, armR: 4, elbowL: 34, elbowR: 38, spreadL: 5, spreadR: 5, thighL: 3, thighR: 3, kneeL: 5, kneeR: 5, hipsDy: -0.4 + s(p * 2) * 0.3 }; } },
  stun: { dur: 0.5, loop: true, f: (t, T) => { const p = TAU * t / T; return { lean: 10 + 3 * s(p * 2), armL: 150, armR: 150, elbowL: 115, elbowR: 115, headYaw: 10 * s(p * 2), headPitch: -8, thighL: -6, thighR: 8, kneeL: 20, kneeR: 12, hipsDy: -3 + s(p * 2) * 0.8, spreadL: -5, spreadR: -5 }; } },
  throw: { dur: 0.85, loop: false, f: (t, T) => { const u = t / T; const wind = smooth(clamp01(u / 0.4)), rel = smooth(clamp01((u - 0.4) / 0.14)), rec = smooth(clamp01((u - 0.6) / 0.4));
    const armR = (-70 * wind + 190 * rel) * (1 - rec) + 5 * rec * 0, elbowR = (90 * wind - 70 * rel) * (1 - rec) + 10 * rec;
    return { armR, elbowR, lean: -6 * wind + 18 * rel * (1 - rec), twist: 14 * wind - 22 * rel * (1 - rec), armL: 18 * wind, elbowL: 30, thighL: 12 * rel * (1 - rec), thighR: -8 * rel * (1 - rec), hipsDy: -1.5 * rel * (1 - rec), spreadL: 6, spreadR: 6 }; } },
  interact: { dur: 0.8, loop: false, f: (t, T) => { const u = t / T, b = Math.sin(Math.PI * clamp01(u)); return { lean: 20 * b, armR: 70 * b, elbowR: 40 * b + 10, armL: 12 * b, elbowL: 25, headPitch: 10 * b, thighL: 14 * b, thighR: 14 * b, kneeL: 30 * b, kneeR: 30 * b, hipsDy: -6 * b, spreadL: 6, spreadR: 6 }; } },
  // speaking gestures: hands and arms move, head nods, small body sway. All loop on integer harmonics.
  // Sam holding someone up by the ankle: arm high, leaning back against the weight, straining
  hold: { dur: 1.2, loop: true, f: (t, T) => { const p = TAU * t / T; return { armR: 98 + 3 * s(3 * p), elbowR: 8 + 5 * s(3 * p), spreadR: 26, armL: 20 + 4 * s(3 * p + 1), elbowL: 40, spreadL: 22, lean: -9 + 1.5 * s(3 * p), twist: 4 * s(p), headPitch: -6 + 2 * s(3 * p), headYaw: 4 * s(p), hipsDy: -2.2 + 0.3 * s(3 * p), thighL: 10, thighR: -8, kneeL: 14, kneeR: 12, sway: 3 + 2 * s(3 * p) }; } },
  talkA: { dur: 3.6, loop: true, f: (t, T) => { const p = TAU * t / T; return { armR: 40 + 14 * s(2 * p), elbowR: 88 + 18 * s(2 * p + 1), spreadR: 8, armL: 14 + 6 * s(p), elbowL: 55 + 8 * s(p + 2), spreadL: 6, lean: 2 + 1.5 * s(p), twist: 5 * s(p), headYaw: 9 * s(p), headPitch: 3 * s(2 * p), hipsDy: 0.3 * s(2 * p), sway: 1.2 * s(p) }; } },
  talkB: { dur: 4.0, loop: true, f: (t, T) => { const p = TAU * t / T; return { armL: 30 + 8 * s(p), armR: 30 + 8 * s(p + 0.7), elbowL: 72 + 12 * s(p + 1), elbowR: 72 + 12 * s(p), spreadL: 26 + 6 * s(p), spreadR: 26 + 6 * s(p + 1), lean: 1, headPitch: -2 + 3 * s(2 * p), headYaw: 5 * s(p), twist: 3 * s(p), hipsDy: 0.25 * s(2 * p) }; } },
  talkC: { dur: 3.2, loop: true, f: (t, T) => { const p = TAU * t / T, k = Math.max(0, s(3 * p)); return { armR: 46 + 20 * k, elbowR: 96 - 26 * k, spreadR: 4, armL: 20, elbowL: 42, spreadL: 6, lean: 3 + 2 * k, headPitch: 2 * s(3 * p), headYaw: 6 * s(p), twist: 4 * s(p), hipsDy: 0.3 * k }; } },
};


export function makeClips(rig, nameOf = (n) => rig.bones[n].b.name, which = Object.keys(CLIPS)) {
  const FPS = 30, out = [];
  for (const name of which) {
    const def = CLIPS[name], N = Math.round(def.dur * FPS), times = [], quats = {}, hipsPos = [];
    for (const n of NAMES) quats[n] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * def.dur, tt = i === N && def.loop ? 0 : t;
      const p = def.f(tt, def.dur), { pose, hipsDy, hipsDx } = body(rig, p), q = applyPose(rig, pose);
      times.push(t); for (const n of NAMES) quats[n].push(...q[n].toArray());
      // hips translation: character-space cm (Aj scale) -> world metres -> hips parent's local frame
      const w = new THREE.Vector3(hipsDx, hipsDy, 0).multiplyScalar(rig.unit).applyQuaternion(rig.hipsParentInv).divideScalar(rig.hipsParentScale);
      const rp = rig.bones.Hips.restPos; hipsPos.push(rp.x + w.x, rp.y + w.y, rp.z + w.z);
    }
    const tracks = NAMES.map((n) => new THREE.QuaternionKeyframeTrack(`${nameOf(n)}.quaternion`, times, quats[n]));
    tracks.push(new THREE.VectorKeyframeTrack(`${nameOf('Hips')}.position`, times, hipsPos));
    out.push(new THREE.AnimationClip(name, def.dur, tracks));
  }
  return out;
}
