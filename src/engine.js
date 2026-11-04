// Renderer, camera, post-processing pipeline
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070b);
scene.fog = new THREE.FogExp2(0x05090e, 0.032);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 90);
camera.rotation.order = 'YXZ';
scene.add(camera);

export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

export const aoHide = []; // objects hidden while the AO pass renders (volumes, particles, viewmodel)
export const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.blendIntensity = 1.0;
try { gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12 }); } catch { }
{
  const r = gtao.render.bind(gtao);
  gtao.render = (...a) => { for (const o of aoHide) o.visible = false; r(...a); for (const o of aoHide) o.visible = true; };
}
composer.addPass(gtao);

export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.9);
composer.addPass(bloom);

export const fxPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, alert: { value: 0 }, caught: { value: 0 }, grain: { value: 0.03 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float alert; uniform float caught; uniform float grain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv-.5; float d = dot(c,c);
      vec2 off = c*d*(0.012+caught*0.05)*(1.+alert*2.5);
      vec3 col = vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
      col = mix(col, vec3(dot(col, vec3(.3,.59,.11))), caught*0.6);
      col *= 1.0 - smoothstep(0.1,0.6,d)*0.78;
      col += (h(vUv*vec2(1920.,1080.)+time)-.5)*grain;
      col += vec3(1.,.05,.1)*alert*0.14*smoothstep(0.04,0.5,d);
      gl_FragColor = vec4(col,1.);
    }`,
});
composer.addPass(fxPass);
composer.addPass(new OutputPass());

export const quality = { level: 'high' };
export function setQuality(l) {
  quality.level = l; const hi = l === 'high';
  gtao.enabled = hi; bloom.strength = hi ? 0.45 : 0.3;
  renderer.setPixelRatio(hi ? Math.min(devicePixelRatio, 2) : 1);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
export function render(dt) { composer.render(dt); }
