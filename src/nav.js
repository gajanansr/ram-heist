// Collision + grid A* pathfinding + line of sight
import * as THREE from 'three';

// obstacles: {x,z,hx,hz, solid(bool), block(bool: blocks sight)}
export function resolveCircle(p, r, obstacles, bounds) {
  p.x = THREE.MathUtils.clamp(p.x, -bounds.hx + r, bounds.hx - r);
  p.z = THREE.MathUtils.clamp(p.z, -bounds.hz + r, bounds.hz - r);
  for (const o of obstacles) {
    if (!o.solid) continue;
    const cx = THREE.MathUtils.clamp(p.x, o.x - o.hx, o.x + o.hx), cz = THREE.MathUtils.clamp(p.z, o.z - o.hz, o.z + o.hz);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // centre inside the box: push out along the shortest axis
        const px = o.hx - Math.abs(p.x - o.x), pz = o.hz - Math.abs(p.z - o.z);
        if (px < pz) p.x += Math.sign(p.x - o.x || 1) * (px + r); else p.z += Math.sign(p.z - o.z || 1) * (pz + r);
      }
    }
  }
}

// segment vs AABB (slab test) on the XZ plane, only obstacles with block=true
export function sightBlocked(ax, az, bx, bz, obstacles) {
  const dx = bx - ax, dz = bz - az;
  for (const o of obstacles) {
    if (!o.block) continue;
    let t0 = 0, t1 = 1;
    for (const [a, d, lo, hi] of [[ax, dx, o.x - o.hx, o.x + o.hx], [az, dz, o.z - o.hz, o.z + o.hz]]) {
      if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) { t0 = 2; break; } }
      else { let ta = (lo - a) / d, tb = (hi - a) / d; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { t0 = 2; break; } }
    }
    if (t0 <= t1) return true;
  }
  return false;
}

export class NavGrid {
  constructor(bounds, obstacles, cell = 0.5, radius = 0.5) {
    this.cell = cell; this.hx = bounds.hx; this.hz = bounds.hz;
    this.w = Math.ceil((bounds.hx * 2) / cell); this.h = Math.ceil((bounds.hz * 2) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = this.toX(i), z = this.toZ(j); let b = 0;
      if (Math.abs(x) > bounds.hx - radius || Math.abs(z) > bounds.hz - radius) b = 1;
      for (const o of obstacles) { if (o.solid && Math.abs(x - o.x) < o.hx + radius && Math.abs(z - o.z) < o.hz + radius) { b = 1; break; } }
      this.blocked[j * this.w + i] = b;
    }
  }
  toX(i) { return -this.hx + (i + 0.5) * this.cell; }
  toZ(j) { return -this.hz + (j + 0.5) * this.cell; }
  ci(x) { return THREE.MathUtils.clamp(Math.floor((x + this.hx) / this.cell), 0, this.w - 1); }
  cj(z) { return THREE.MathUtils.clamp(Math.floor((z + this.hz) / this.cell), 0, this.h - 1); }
  free(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.blocked[j * this.w + i]; }
  nearestFree(x, z) {
    const i0 = this.ci(x), j0 = this.cj(z); if (this.free(i0, j0)) return [i0, j0];
    for (let r = 1; r < 14; r++) {
      let best = null, bd = 1e9;
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || !this.free(i, j)) continue;
        const d = (i - i0) ** 2 + (j - j0) ** 2; if (d < bd) { bd = d; best = [i, j]; }
      }
      if (best) return best;
    }
    return [i0, j0];
  }
  point(x, z) { const [i, j] = this.nearestFree(x, z); return new THREE.Vector3(this.toX(i), 0, this.toZ(j)); }
  // returns array of Vector3 waypoints (smoothed)
  find(ax, az, bx, bz) {
    const [si, sj] = this.nearestFree(ax, az), [gi, gj] = this.nearestFree(bx, bz);
    const W = this.w, n = W * this.h, g = new Float32Array(n).fill(1e9), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const open = [[0, sj * W + si]]; g[sj * W + si] = 0; const goal = gj * W + gi;
    const hf = (i, j) => Math.hypot(i - gi, j - gj);
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open.splice(bi, 1)[0]; if (closed[cur]) continue; closed[cur] = 1; if (cur === goal) break;
      const ci = cur % W, cj = (cur / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue; // no corner cutting
        const id = nj * W + ni, ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[id]) { g[id] = ng; from[id] = cur; open.push([ng + hf(ni, nj), id]); }
      }
    }
    if (from[goal] < 0 && goal !== sj * W + si) return [new THREE.Vector3(bx, 0, bz)];
    const raw = []; for (let c = goal; c >= 0; c = from[c]) { raw.push(new THREE.Vector3(this.toX(c % W), 0, this.toZ((c / W) | 0))); if (c === sj * W + si) break; }
    raw.reverse();
    // greedy line-of-walk smoothing
    const out = []; let a = 0;
    while (a < raw.length - 1) {
      let b = raw.length - 1; while (b > a + 1 && !this.walkLine(raw[a], raw[b])) b--;
      out.push(raw[b]); a = b;
    }
    return out.length ? out : [raw[raw.length - 1]];
  }
  walkLine(a, b) {
    const steps = Math.ceil(a.distanceTo(b) / (this.cell * 0.5));
    for (let s = 1; s < steps; s++) { const t = s / steps; if (!this.free(this.ci(a.x + (b.x - a.x) * t), this.cj(a.z + (b.z - a.z) * t))) return false; }
    return true;
  }
}
