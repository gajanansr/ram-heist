// Campaign data, upgrades, save/load

export const NIGHTS = [
  { title: 'Night 1', sub: 'Orientation', time: 110, sticks: 6, need: 3, decoys: 0, grace: 16, ears: 1, sams: [{ name: 'Sam', speed: 1.3, range: 11, voice: true }] },
  { title: 'Night 2', sub: 'Overtime', time: 120, sticks: 6, need: 3, decoys: 3, grace: 10, ears: 1.1, flicker: true, sams: [{ name: 'Sam', speed: 1.5, range: 12, voice: true }] },
  { title: 'Night 3', sub: 'Brownout', time: 130, sticks: 7, need: 4, decoys: 3, grace: 10, ears: 1.2, blackout: true, sams: [{ name: 'Sam', speed: 1.6, range: 13, voice: true }] },
  { title: 'Night 4', sub: 'Keen Ears', time: 130, sticks: 7, need: 4, decoys: 4, grace: 10, ears: 1.7, flicker: true, sams: [{ name: 'Sam', speed: 1.8, range: 13, voice: true }] },
  { title: 'Night 5', sub: 'Compute Day', time: 150, sticks: 8, need: 5, decoys: 4, grace: 10, ears: 1.9, blackout: true, flicker: true, sams: [{ name: 'Sam', speed: 2.0, range: 14, voice: true }] },
];

export const UPGRADES = [
  { id: 'soles', name: 'Quiet Soles', desc: 'Your footsteps and sprinting are 25% quieter per level.', cost: 120, max: 3 },
  { id: 'lungs', name: 'Cardio Plan', desc: '+30% stamina per level.', cost: 100, max: 3 },
  { id: 'pockets', name: 'Hollow Hiding Cases', desc: 'Each hiding spot holds +1 extra stick.', cost: 200, max: 2 },
  { id: 'decoys', name: 'Decoy Pouch', desc: '+2 decoy mugs every night.', cost: 90, max: 3 },
  { id: 'traps', name: 'Coffee Stash', desc: '+1 slip trap every night.', cost: 110, max: 3 },
  { id: 'foil', name: 'Tinfoil Hat', desc: "Shrinks Sam's sight range by 12% per level.", cost: 160, max: 3 },
];

const KEY = 'ramheist.save.v1';
export function defaultSave() { return { night: 0, credits: 0, up: {} }; }
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.night === 'number') return { ...defaultSave(), ...s }; } catch { }
  return null;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { } }

export const ENDLESS = { title: 'Endless', sub: 'Last chip standing', time: 0, sticks: 3, need: 1, decoys: 3, grace: 10, ears: 1.2, sams: [{ name: 'Sam', speed: 1.5, range: 12, voice: true }] };
const BEST = 'ramheist.best.v1';
export function loadBest() { try { return JSON.parse(localStorage.getItem(BEST)) || { score: 0, time: 0 }; } catch { return { score: 0, time: 0 }; } }
export function saveBest(b) { try { localStorage.setItem(BEST, JSON.stringify(b)); } catch { } }
