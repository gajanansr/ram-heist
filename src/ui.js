// DOM-driven UI: HUD, subtitles, minimap, panels, cutscene runner
import * as audio from './audio.js';
export const $ = (id) => document.getElementById(id);

let subTimer = 0, toastTimer = 0;
export function showHud(on) { $('hud').classList.toggle('on', on); }
export function show(id, on = true) { $(id).classList.toggle('on', on); }

// Generic card. Buttons: first is primary unless {sec:true}.
export function panel({ title, sub = '', body = null, buttons = [] }) {
  $('pTitle').textContent = title; $('pSub').textContent = sub; const pb = $('pBody'); pb.innerHTML = ''; if (body) pb.appendChild(body);
  const bt = $('pBtns'); bt.innerHTML = '';
  for (const b of buttons) { const e = document.createElement('button'); e.textContent = b.label; if (b.sec) e.className = 'sec'; e.onclick = (ev) => { ev.stopPropagation(); audio.sfx('ui_click'); b.fn(); }; bt.appendChild(e); }
  show('title', false); show('panel', true); bt.querySelector('button')?.focus({ preventScroll: true });
}
export const hidePanel = () => show('panel', false);

const WHO = { sam: 'Sam', ravi: 'Ravi, IT desk', agent: 'Agent' };
export function subtitle(who, text, dur = 3.4) {
  const el = $('sub'); el.className = 'on ' + who; el.querySelector('.who').textContent = WHO[who] || who;
  el.querySelector('.t').textContent = text; clearTimeout(subTimer); subTimer = setTimeout(() => el.classList.remove('on'), dur * 1000);
}
export function toast(text, dur = 2.4, kind = '') { const e = $('toast'); e.textContent = text; e.className = 'on ' + kind; clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove('on'), dur * 1000); }

let lastChips = '';
export function hud(d) {
  $('nightName').textContent = `${d.title}: ${d.sub}`;
  if (d.endless) {
    const t = Math.floor(d.time); $('objective').textContent = `Score ${d.score}. Grab new chips from the floor and keep them hidden.`;
    $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; $('clockLbl').textContent = 'survived'; $('tbar').style.width = '100%'; $('clock').classList.remove('low');
  } else {
    $('objective').textContent = `Upload ${d.need} chips to the People's Cluster (${d.uploaded}/${d.need}) before sunrise.`; $('clockLbl').textContent = 'seconds to sunrise';
    $('time').textContent = Math.max(0, Math.ceil(d.time)); $('tbar').style.width = Math.max(0, Math.min(1, d.time / d.timeMax)) * 100 + '%'; $('clock').classList.toggle('low', d.time < 15);
  }
  $('uploaded').textContent = d.uploaded || 0; $('carry').textContent = d.carry; $('hidden').textContent = d.hidden; $('stolen').textContent = d.stolen;
  const up = d.uploaded || 0, ck = `${up}|${d.carry}|${d.hidden}|${d.total}`; if (ck !== lastChips) { lastChips = ck; let h = ''; for (let i = 0; i < d.total; i++) h += `<i class="${i < up ? 'up' : i < up + d.carry ? 'have' : i < up + d.carry + d.hidden ? 'hid' : 'gone'}"></i>`; $('chips').innerHTML = h; }
  const pips = $('pips'); if (pips.childElementCount !== 3) pips.innerHTML = '<i></i><i></i><i></i>'; [...pips.children].forEach((p, i) => p.classList.toggle('on', i < d.strikes));
  $('stBar').style.width = d.stamina * 100 + '%'; $('stBar').style.opacity = d.exhausted ? 0.4 : 1; $('noiseBar').style.width = Math.min(1, d.noise) * 100 + '%';
  $('decoyTxt').innerHTML = `<kbd>G</kbd>Decoys <b>${d.decoys}</b>`; $('decoyTxt').className = d.decoys ? '' : 'off';
  $('trapTxt').innerHTML = `<kbd>T</kbd>Traps <b>${d.traps}</b>`; $('trapTxt').className = d.traps ? '' : 'off';
  $('flashTxt').innerHTML = `<kbd>F</kbd>Flashlight <b>${d.flash ? 'on' : 'off'}</b>`;
  const p = $('prompt'); p.innerHTML = (d.prompt || '').replace(/\[(\w)\]\s*/g, '<kbd>$1</kbd>'); p.classList.toggle('on', !!d.prompt);
  $('aware').style.opacity = d.aware > 0.02 ? 1 : 0; $('awareC').style.strokeDashoffset = 226 * (1 - d.aware);
  const lbl = $('awareLbl'); lbl.style.opacity = d.aware > 0.25 ? 1 : 0; lbl.textContent = d.aware > 0.92 ? 'Spotted!' : 'Sam is noticing you';
  $('alert').style.boxShadow = `inset 0 0 160px 40px rgba(255,40,60,${d.alert * 0.5})`;
  $('lookHint').classList.toggle('off', d.elapsed > 14);
}

export function struggle(p) { const e = $('struggle'); e.classList.toggle('on', p !== null); if (p !== null) $('stgBar').style.width = Math.min(1, p) * 100 + '%'; }

// ── minimap
export function minimap(d) {
  const c = $('mini'), g = c.getContext('2d'), W = c.width, H = c.height, sx = W / (d.world.HX * 2), sz = H / (d.world.HZ * 2);
  const X = (x) => (x + d.world.HX) * sx, Z = (z) => (z + d.world.HZ) * sz;
  g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(4,14,11,.9)'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(140,190,170,.34)'; for (const o of d.world.obstacles) g.fillRect(X(o.x - o.hx), Z(o.z - o.hz), o.hx * 2 * sx, o.hz * 2 * sz);
  for (const s of d.world.spots) { g.fillStyle = s.stash > 0 ? '#39ff9c' : 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(X(s.pos.x), Z(s.pos.z), s.stash > 0 ? 3.6 : 2, 0, 7); g.fill(); }
  for (const mk of d.marks || []) { g.fillStyle = mk.c; g.fillRect(X(mk.x) - 4, Z(mk.z) - 4, 8, 8); }
  g.fillStyle = '#ffd24d'; for (const pk of d.pickups || []) { const x = X(pk.x), z = Z(pk.z); g.beginPath(); g.moveTo(x, z - 5); g.lineTo(x + 4, z); g.lineTo(x, z + 5); g.lineTo(x - 4, z); g.closePath(); g.fill(); }
  for (const sam of d.sams) {
    if (!sam.active) continue; const near = sam.pos.distanceTo(d.player.pos) < 9 || sam.sees; if (!near) continue;
    const col = sam.state === 'chase' ? '#ff5a3c' : sam.o.tint ? '#ff9cf0' : '#f0c04a'; g.fillStyle = col; g.beginPath(); g.arc(X(sam.pos.x), Z(sam.pos.z), 4.2, 0, 7); g.fill();
    g.strokeStyle = col; g.globalAlpha = 0.4; g.lineWidth = 2; g.beginPath(); g.moveTo(X(sam.pos.x), Z(sam.pos.z)); g.lineTo(X(sam.pos.x + Math.sin(sam.yaw) * 4), Z(sam.pos.z + Math.cos(sam.yaw) * 4)); g.stroke(); g.globalAlpha = 1;
  }
  g.save(); g.translate(X(d.player.pos.x), Z(d.player.pos.z)); g.rotate(-d.yaw); g.fillStyle = '#62c8ff'; g.beginPath(); g.moveTo(0, -6.5); g.lineTo(5, 5.5); g.lineTo(-5, 5.5); g.closePath(); g.fill(); g.restore();
}

// ── cutscene runner. lines: [{who,text}]; resolves when finished or skipped
const COLORS = { sam: '#f0c04a', ravi: '#7ee0a8', agent: '#ff9cf0' }, INITIAL = { sam: 'S', ravi: 'R', agent: 'A' };
export function cutscene(lines, { title = '', subtitle: st = '' } = {}) {
  return new Promise((resolve) => {
    const cut = $('cut'), box = $('cutBox'); cut.classList.add('on'); show('panel', false); show('title', false);
    $('cutTitle').innerHTML = title ? `${title}<small>${st}</small>` : '';
    const dots = $('cutDots'); dots.innerHTML = lines.map(() => '<i></i>').join('');
    let i = 0, typing = null, full = '', done = false;
    const finish = () => { if (done) return; done = true; clearInterval(typing); cut.classList.remove('on'); cut.onclick = null; removeEventListener('keydown', key); $('cutSkip').onclick = null; audio.stopSpeech(); resolve(); };
    const next = () => {
      if (typing) { clearInterval(typing); typing = null; box.querySelector('.txt').textContent = full; return; }
      if (i >= lines.length) { finish(); return; }
      const l = lines[i++]; full = l.text; [...dots.children].forEach((d, k) => d.classList.toggle('on', k < i));
      const who = box.querySelector('.who'); who.textContent = WHO[l.who] || l.who; who.style.color = COLORS[l.who] || '#fff';
      const port = $('cutPort'); port.textContent = INITIAL[l.who] || '?'; port.style.background = COLORS[l.who] || '#fff';
      const tx = box.querySelector('.txt'); tx.textContent = ''; let k = 0; audio.speak(l.who, l.text, true);
      typing = setInterval(() => { tx.textContent = full.slice(0, ++k); if (k >= full.length) { clearInterval(typing); typing = null; } }, 30);
    };
    const key = (e) => { if (e.code === 'Space' || e.code === 'Enter') next(); else if (e.code === 'Escape') finish(); };
    cut.onclick = next; $('cutSkip').onclick = (e) => { e.stopPropagation(); finish(); }; addEventListener('keydown', key); next();
  });
}
