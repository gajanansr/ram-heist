// Touch-device detection and the game's own view size.
// ?touch=1 / ?touch=0 forces touch mode on or off (handy for testing on a desktop).
//
// The game is landscape-only. On a touch device held upright we turn the whole page 90 degrees with CSS, so it
// plays sideways with no "rotate your phone" wall (iOS cannot lock orientation). If the browser does allow a real
// landscape lock, the device turns and this switches itself off.
const force = new URLSearchParams(location.search).get('touch');
export const IS_TOUCH = force === '1' ? true : force === '0' ? false : matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
const root = document.documentElement;
if (IS_TOUCH) root.classList.add('touch');

// view.w / view.h are the game's width and height, whichever way the device is held
export const view = { w: innerWidth, h: innerHeight, rot: false };

// breakpoints that mirror the CSS media queries (those can't see the rotated size)
const MAX_H = [980, 700, 560, 430, 360], MAX_W = [900];
function measure() {
  const rot = IS_TOUCH && innerHeight > innerWidth;
  view.rot = rot; view.w = rot ? innerHeight : innerWidth; view.h = rot ? innerWidth : innerHeight;
  root.classList.toggle('rot', rot);
  if (rot) { root.style.setProperty('--vw', view.w / 100 + 'px'); root.style.setProperty('--vh', view.h / 100 + 'px'); }
  else { root.style.removeProperty('--vw'); root.style.removeProperty('--vh'); }
  for (const n of MAX_H) root.classList.toggle('mh' + n, view.h <= n);
  for (const n of MAX_W) root.classList.toggle('mw' + n, view.w <= n);
}
// screen pixel (pointer event) -> game pixel
export function toLocal(x, y) { return view.rot ? { x: y, y: innerWidth - x } : { x, y }; }

measure();
const changed = () => { measure(); dispatchEvent(new Event('viewchange')); };
addEventListener('resize', changed);
addEventListener('orientationchange', () => setTimeout(changed, 250)); // iOS reports the new size a moment late
if (IS_TOUCH) { // safety net: some mobile browsers skip or delay resize events after a turn
  setInterval(() => { const rot = innerHeight > innerWidth; if (rot !== view.rot || view.w !== (rot ? innerHeight : innerWidth)) changed(); }, 500);
}
