import { SFX_FILES, MUSIC_FILES } from './audio-manifest.js';
// Procedural audio: ambience, adaptive tension music, heartbeat, SFX, optional speech synthesis.
let ctx = null, master = null, amb = null, mus = null, voiceOn = true;
let tension = 0, beatT = 0, noteT = 0, started = false;
let sfxBus = null, musicBus = null, musicOn = true;
const sfxBufs = {}, musicBufs = {}, layers = {}; let musicState = null, fileMusic = false, loaded = false, mix = 0; const listener = { x: 0, z: 0, fx: 0, fz: -1 };
const MINOR = [0, 3, 7, 10, 12, 15];

export function init() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    // server-room hum: two detuned saws through a low-pass + filtered noise
    const hum = ctx.createGain(); hum.gain.value = 0.05; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    for (const f of [55, 55.4, 110.3]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    lp.connect(hum).connect(master); amb = hum;
    const nlen = ctx.sampleRate * 2, nb = ctx.createBuffer(1, nlen, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < nlen; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.4;
    const ng = ctx.createGain(); ng.gain.value = 0.012; ns.connect(nf).connect(ng).connect(master); ns.start();
    mus = ctx.createGain(); mus.gain.value = 0.0; mus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master); musicBus = ctx.createGain(); musicBus.gain.value = 0.8; musicBus.connect(master); loadFiles();
  }
  ctx.resume(); started = true;
}
export function setVoice(v) { voiceOn = v; if (!v) stopSpeech(); }
export function isVoice() { return voiceOn; }
export function getCtx() { return ctx; }

function env(g, t0, a, d, peak) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
export function blip(freq, dur = 0.12, type = 'sine', vol = 0.1, slide = 0, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  env(g, t, 0.005, dur, vol); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
let nbuf = null;
function noiseBuf() { if (nbuf) return nbuf; const len = 0.25 * ctx.sampleRate; nbuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); return nbuf; }
export function thud(vol = 0.2, freq = 260) {
  if (!ctx || vol < 0.01) return; const s = ctx.createBufferSource(); s.buffer = noiseBuf(); s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = ctx.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(master); s.start();
}
export function clatter(vol = 0.3) { for (let i = 0; i < 4; i++) { thud(vol * (1 - i * 0.2), 2400 + Math.random() * 2000); blip(1500 + Math.random() * 900, 0.06, 'triangle', vol * 0.2, -600, i * 0.05); } }
export function stinger() { blip(180, 0.6, 'sawtooth', 0.12, 120); blip(190, 0.6, 'sawtooth', 0.1, -80, 0.02); }
export function stealSfx() { blip(300, 0.45, 'sawtooth', 0.12, -220); blip(110, 0.5, 'square', 0.08, -50, 0.1); }
export function ok() { blip(520, 0.12, 'triangle', 0.08, 300); blip(780, 0.16, 'triangle', 0.08, 300, 0.1); }
export function stash() { blip(660, 0.1, 'square', 0.05, 240); }
export function unstash() { blip(480, 0.08, 'triangle', 0.06, -140); }
export function win() { [0, 4, 7, 12].forEach((n, i) => blip(261 * Math.pow(2, n / 12), 0.35, 'triangle', 0.1, 0, i * 0.12)); }
export function lose() { [0, -3, -7, -12].forEach((n, i) => blip(220 * Math.pow(2, n / 12), 0.5, 'sawtooth', 0.09, 0, i * 0.18)); }
export function ui() { blip(900, 0.04, 'square', 0.04); }

// 0..1; drives heartbeat and the music layer
export function setTension(t) { tension += (t - tension) * 0.08; }
export function tick(dt) {
  if (!ctx || !started) return;
  tickMusic(dt); if (mus) mus.gain.value += ((fileMusic ? 0 : 0.05 + tension * 0.16) - mus.gain.value) * Math.min(1, dt * 2);
  // heartbeat
  if (tension > 0.25) {
    beatT -= dt; const rate = 0.95 - tension * 0.45;
    if (beatT <= 0) { beatT = rate; blip(58, 0.18, 'sine', 0.35 * tension); blip(52, 0.2, 'sine', 0.3 * tension, 0, 0.17); }
  }
  // sparse minor arpeggio, faster & brighter with tension
  noteT -= dt;
  if (noteT <= 0) {
    noteT = 0.5 - tension * 0.28; const n = MINOR[Math.floor(Math.random() * MINOR.length)] - 12 + (tension > 0.6 ? 12 : 0);
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 110 * Math.pow(2, n / 12);
    env(g, t, 0.02, 0.5, 0.5); o.connect(g).connect(mus); o.start(t); o.stop(t + 0.7);
  }
}

// ── sound effects and music from files (public/sfx, public/music); synthesized fallbacks cover anything not recorded yet
const BASE = import.meta.env.BASE_URL;
function decode(url) { return fetch(url).then((r) => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then((b) => ctx.decodeAudioData(b)); }
function loadFiles() {
  if (loaded) return; loaded = true;
  for (const [id, files] of Object.entries(SFX_FILES)) { sfxBufs[id] = []; for (const f of files) decode(BASE + 'sfx/' + f).then((b) => sfxBufs[id].push(b)).catch(() => { }); }
  for (const [id, f] of Object.entries(MUSIC_FILES)) decode(BASE + 'music/' + f).then((b) => { musicBufs[id] = b; applyMusic(); }).catch(() => { });
}
export function setListener(x, z, fx, fz) { listener.x = x; listener.z = z; const l = Math.hypot(fx, fz) || 1; listener.fx = fx / l; listener.fz = fz / l; }
const FALLBACK = {
  footstep_walk: () => thud(0.1, 300), footstep_run: () => thud(0.17, 380), footstep_crouch: () => thud(0.04, 220), sam_step: (o) => thud(Math.min(0.55, 2.4 / (o.d + 1.5)), 240),
  chip_stash: () => stash(), chip_take: () => unstash(), chip_pickup: () => ok(), upload_tick: () => blip(880, 0.05, 'square', 0.03), upload_done: () => ok(), chip_stolen: () => stealSfx(), caught_hit: () => stealSfx(),
  hide_in: () => stash(), hide_out: () => unstash(), decoy_throw: () => blip(260, 0.1, 'triangle', 0.05, -80), decoy_land: (o) => clatter(Math.min(0.5, 4 / (o.d + 2))), trap_place: () => blip(210, 0.12, 'triangle', 0.05, -60), trap_slip: () => thud(0.6, 500),
  breaker_pull: () => stealSfx(), power_back: () => blip(120, 0.5, 'sawtooth', 0.05, 200), spotted_sting: () => stinger(), ui_click: () => ui(), ui_confirm: () => ok(), applause: () => applause(3.6), title_slam: () => titleSlam(), win_sting: () => win(), lose_sting: () => lose(),
};
const lastVariant = {};
export function sfx(id, o = {}) {
  if (!ctx || !started) return;
  let d = 0, pan = 0; const vol = o.vol ?? 1;
  if (o.pos) { const dx = o.pos.x - listener.x, dz = o.pos.z - listener.z; d = Math.hypot(dx, dz); if (d > 0.01) pan = Math.max(-0.85, Math.min(0.85, ((dx / d) * -listener.fz + (dz / d) * listener.fx) * 0.85)); }
  const g = vol / (1 + d * 0.22); if (g < 0.02) return;
  const bufs = sfxBufs[id];
  if (bufs && bufs.length) {
    let i = Math.floor(Math.random() * bufs.length); if (bufs.length > 1 && i === lastVariant[id]) i = (i + 1) % bufs.length; lastVariant[id] = i;
    const src = ctx.createBufferSource(); src.buffer = bufs[i]; src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * (o.vary ?? 0.06)); const gn = ctx.createGain(); gn.gain.value = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; src.connect(gn).connect(p).connect(sfxBus); } else src.connect(gn).connect(sfxBus); src.start(); return;
  }
  FALLBACK[id]?.({ ...o, d, g });
}
const XF = (b) => Math.min(2.5, b.duration * 0.15);
const MUSIC_STATES = { menu: ['music_menu'], intro: ['music_intro'], stealth: ['music_stealth'], ending: ['music_ending'] };
function addVoice(l, at, first) {
  const b = l.buf, x = XF(b), src = ctx.createBufferSource(); src.buffer = b; const vg = ctx.createGain();
  vg.gain.setValueAtTime(first ? 1 : 0, at); if (!first) vg.gain.linearRampToValueAtTime(1, at + x); vg.gain.setValueAtTime(1, at + b.duration - x); vg.gain.linearRampToValueAtTime(0, at + b.duration);
  src.connect(vg).connect(l.gain); src.start(at); l.nextAt = at + b.duration - x;
}
function applyMusic() {
  if (!ctx || !musicBus) return; const want = new Set(MUSIC_STATES[musicState] || []);
  for (const id of Object.keys(layers)) if (!want.has(id)) layers[id].target = 0;
  for (const id of want) {
    if (!musicBufs[id]) continue;
    if (!layers[id]) { const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(musicBus); layers[id] = { id, buf: musicBufs[id], gain, target: 1, nextAt: 0 }; addVoice(layers[id], ctx.currentTime + 0.05, true); } else layers[id].target = 1;
  }
}
// state: 'menu' | 'intro' | 'stealth' | 'ending' | null. In 'stealth' the chase layer swells with tension.
export function music(state) { musicState = state; applyMusic(); }
export function setMusicOn(on) { musicOn = on; }
export function isMusicOn() { return musicOn; }
function tickMusic(dt) {
  if (!musicBus) return; const duck = speaking ? 0.5 : 1; musicBus.gain.value += ((musicOn ? 0.8 * duck : 0) - musicBus.gain.value) * Math.min(1, dt * 4);
  mix += (Math.min(1, Math.max(0, (tension - 0.35) / 0.5)) - mix) * Math.min(1, dt * 1.5); let any = false;
  // the chase track starts from its beginning whenever danger rises, and is released once things calm down
  if (musicState === 'stealth' && musicBufs.music_chase && ctx) {
    const c = layers.music_chase;
    if (!c && mix > 0.08) { const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(musicBus); layers.music_chase = { id: 'music_chase', buf: musicBufs.music_chase, gain, target: 1, nextAt: 0 }; addVoice(layers.music_chase, ctx.currentTime + 0.05, true); }
    else if (c && c.target > 0 && mix < 0.02) c.target = 0;
  }
  for (const id of Object.keys(layers)) {
    const l = layers[id]; let tgt = l.target; if (musicState === 'stealth' && tgt > 0) tgt = id === 'music_chase' ? mix : (layers.music_chase ? 1 - 0.6 * mix : 1);
    l.gain.gain.value += (tgt - l.gain.gain.value) * Math.min(1, dt * 1.6);
    if (l.target > 0) any = true; if (l.target > 0 && ctx.currentTime + 1.5 > l.nextAt) addVoice(l, l.nextAt, false);
    if (l.target === 0 && l.gain.gain.value < 0.01) { l.gain.disconnect(); delete layers[id]; }
  }
  fileMusic = any;
}

// ── voice: recorded ElevenLabs clips (public/audio/<id>.mp3). Lines with no recording stay subtitle-only.
import { VOICE, DUR, idForText } from './voice.js';
const AUDIO_BASE = import.meta.env.BASE_URL + 'audio/';
let currentVoice = null, speaking = false, currentId = null, analyser = null, tBuf = null, fBuf = null;
function ensureAnalyser() { if (!ctx || analyser) return; analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.35; analyser.connect(master); tBuf = new Uint8Array(analyser.fftSize); fBuf = new Uint8Array(analyser.frequencyBinCount); }
function playClip(id, priority) {
  if (!voiceOn || !VOICE[id] || !(id in DUR)) return null; // lines without a recording stay subtitle-only
  if (currentVoice && !currentVoice.ended && !currentVoice.paused) { if (!priority) return null; currentVoice.pause(); }
  const a = new Audio(AUDIO_BASE + id + '.mp3'); a.volume = 1; currentVoice = a; currentId = id;
  if (ctx) { ensureAnalyser(); try { ctx.createMediaElementSource(a).connect(analyser); } catch { } }
  a.onplay = () => { speaking = true; if (mus) mus.gain.value *= 0.4; };
  a.onended = a.onerror = a.onpause = () => { if (currentVoice === a) { speaking = false; currentId = null; } };
  a.play().catch(() => { speaking = false; });
  return a;
}
// speak by line text (barks, tips) or by explicit id. priority=true interrupts whatever is playing.
export function speak(who, text, priority = false, id = null) { const k = id || idForText(text || ''); if (k) playClip(k, priority); }
export function speakId(id, priority = true) { return playClip(id, priority); }
// resolves when the clip finishes (or after a fallback timeout / when voice is off)
export function speakAsync(id) {
  return new Promise((resolve) => {
    const a = playClip(id, true), len = ((DUR[id] || 2.5) + 0.35) * 1000; let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
    if (a) a.addEventListener('ended', () => setTimeout(fin, 250), { once: true });
    setTimeout(fin, len + 400); // never wait longer than the clip length (covers blocked autoplay and voice-off)
  });
}
// loudness (0..~0.3) and brightness (spectral centroid, Hz) of the voice clip that is playing right now; drives lip sync
export function voiceState() {
  if (!speaking || !analyser || !currentVoice) return { id: null, amp: 0, centroid: 0 };
  analyser.getByteTimeDomainData(tBuf); let sum = 0; for (let i = 0; i < tBuf.length; i++) { const v = (tBuf[i] - 128) / 128; sum += v * v; } const amp = Math.sqrt(sum / tBuf.length);
  analyser.getByteFrequencyData(fBuf); let num = 0, den = 0; for (let i = 2; i < fBuf.length; i++) { num += i * fBuf[i]; den += fBuf[i]; } const centroid = den ? (num / den) * (ctx.sampleRate / analyser.fftSize) : 0;
  return { id: currentId, amp, centroid };
}
export function stopSpeech() { speaking = false; currentId = null; if (currentVoice) { try { currentVoice.pause(); } catch { } currentVoice = null; } }
export function isSpeaking() { return speaking; }
// stage effects for the intro
export function applause(sec = 3) {
  if (!ctx) return; const len = sec * ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate, env = Math.min(1, t / 0.5) * Math.max(0, 1 - Math.max(0, t - (sec - 1.2)) / 1.2); d[i] = (Math.random() * 2 - 1) * env * (0.5 + 0.5 * Math.random() * (Math.sin(t * 23) > 0.2 ? 1 : 0.4)); }
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.5; const g = ctx.createGain(); g.gain.value = 0.35; s.connect(f).connect(g).connect(master); s.start();
}
export function titleSlam() { blip(70, 0.5, 'sine', 0.5, -30); thud(0.5, 600); blip(2200, 0.05, 'square', 0.05); }
// debug helper (used by tests)
export function _debug() { return { started, fileMusic, musicState, layers: Object.fromEntries(Object.entries(layers).map(([k, l]) => [k, +l.gain.gain.value.toFixed(2)])), sfx: Object.fromEntries(Object.entries(sfxBufs).map(([k, v]) => [k, v.length])), music: Object.keys(musicBufs), mix: +mix.toFixed(2) }; }
