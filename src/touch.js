// On-screen controls for phones and tablets: floating stick (left), drag-to-look (right), action buttons.
// Buttons fire the same key events as the keyboard, so every game rule works unchanged.
import { IS_TOUCH, view, toLocal } from './device.js';

const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
const NOOP = { sync() {}, setPlaying() {}, releaseAll() {} };

const BUTTONS = [
  { id: 'E', code: 'KeyE', label: 'E', sub: 'USE', cls: 'big', hold: true },
  { id: 'H', code: 'KeyH', label: 'H', sub: 'HIDE' },
  { id: 'G', code: 'KeyG', label: 'G', sub: 'DECOY', badge: 'decoys' },
  { id: 'T', code: 'KeyT', label: 'T', sub: 'TRAP', badge: 'traps' },
];
const SIDE = [
  { id: 'pause', label: 'II', sub: 'PAUSE', act: 'pause' },
  { id: 'run', label: 'RUN', sub: '', act: 'sprint' },
  { id: 'C', code: 'KeyC', label: 'C', sub: 'CROUCH' },
  { id: 'F', code: 'KeyF', label: 'F', sub: 'LIGHT' },
];

export function initTouch({ player, onPause, onGrabTap }) {
  if (!IS_TOUCH) return NOOP;
  const root = document.createElement('div'); root.id = 'touch';
  const btn = (b, cls) => `<div class="tb ${b.cls || ''} ${cls}" data-id="${b.id}" role="button" aria-label="${b.sub || b.label}"><b>${b.label}</b>${b.sub ? `<small>${b.sub}</small>` : ''}${b.badge ? '<em></em>' : ''}</div>`;
  root.innerHTML = `<div id="tPad"></div><div id="tStick"><i></i></div>
    <div id="tSide">${SIDE.map((b) => btn(b, 'side')).join('')}</div>
    <div id="tAct">${BUTTONS.map((b) => btn(b, 'act')).join('')}</div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s), el = (id) => root.querySelector(`[data-id="${id}"]`);
  const stick = $('#tStick'), knob = stick.firstElementChild, pad = $('#tPad');

  // ── floating stick on the left half, look-drag on the right half. Each finger is tracked by its pointerId.
  const R = 52; let sId = null, sx = 0, sy = 0, lId = null, lx = 0, ly = 0, sprintOn = false;
  const setStick = (dx, dy) => {
    const m = Math.hypot(dx, dy), k = m > R ? R / m : 1; dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    let mag = Math.min(1, Math.hypot(dx, dy) / R); mag = mag < 0.14 ? 0 : Math.min(1, (mag - 0.14) / 0.7); // dead zone, then full speed at ~85% push
    const a = Math.atan2(dy, dx); player.move.x = Math.cos(a) * mag; player.move.y = -Math.sin(a) * mag;
  };
  const endStick = () => { sId = null; player.move.x = 0; player.move.y = 0; stick.classList.remove('on'); knob.style.transform = ''; setSprint(false); };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault(); onGrabTap?.();
    try { pad.setPointerCapture(e.pointerId); } catch { }
    const p = toLocal(e.clientX, e.clientY);
    if (p.x < view.w * 0.5) {
      if (sId !== null) return; sId = e.pointerId;
      sx = Math.min(Math.max(p.x, R + 12), view.w * 0.5 - 8); sy = Math.min(Math.max(p.y, R + 70), view.h - R - 12);
      stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on'); setStick(p.x - sx, p.y - sy);
    } else if (lId === null) { lId = e.pointerId; lx = p.x; ly = p.y; }
  });
  pad.addEventListener('pointermove', (e) => {
    const p = toLocal(e.clientX, e.clientY);
    if (e.pointerId === sId) setStick(p.x - sx, p.y - sy);
    else if (e.pointerId === lId) { player.look((p.x - lx) * 0.0052, (p.y - ly) * 0.0042); lx = p.x; ly = p.y; }
  });
  const up = (e) => { if (e.pointerId === sId) endStick(); else if (e.pointerId === lId) lId = null; };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);

  // ── buttons. Hold buttons (E) keep the key down until release. RUN is a latch that clears when the stick is released.
  function setSprint(on) { sprintOn = on; player.keys.ShiftLeft = on; el('run').classList.toggle('lit', on); }
  const down = new Map();
  for (const b of [...BUTTONS, ...SIDE]) {
    const n = el(b.id);
    n.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); onGrabTap?.(); try { n.setPointerCapture(e.pointerId); } catch { }
      n.classList.add('down'); down.set(e.pointerId, b);
      if (b.act === 'pause') onPause(); else if (b.act === 'sprint') setSprint(!sprintOn); else key('keydown', b.code);
    });
    const rel = (e) => { const d = down.get(e.pointerId); if (!d) return; down.delete(e.pointerId); n.classList.remove('down'); if (d.code) key('keyup', d.code); };
    n.addEventListener('pointerup', rel); n.addEventListener('pointercancel', rel);
  }
  // never leave a key or finger stuck (app switch, pause panel, rotate)
  function releaseAll() {
    endStick(); lId = null; for (const [, d] of down) if (d.code) key('keyup', d.code); down.clear(); root.querySelectorAll('.down').forEach((n) => n.classList.remove('down')); player.move.x = player.move.y = 0;
  }
  addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  // block iOS pinch and double-tap zoom
  for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault());
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  let last = '';
  return {
    // mirror game state on the buttons (cheap: only touches the DOM when something changed)
    sync({ crouch, flash, hiding, decoys, traps }) {
      const k = `${crouch}|${flash}|${hiding}|${decoys}|${traps}`; if (k === last) return; last = k;
      el('C').classList.toggle('lit', crouch); el('F').classList.toggle('lit', flash); el('H').classList.toggle('lit', hiding);
      for (const [id, n] of [['G', decoys], ['T', traps]]) { const b = el(id); b.classList.toggle('off', !n); b.querySelector('em').textContent = n; }
    },
    setPlaying(on) { document.body.classList.toggle('playing', on); if (!on) releaseAll(); },
    releaseAll,
  };
}
