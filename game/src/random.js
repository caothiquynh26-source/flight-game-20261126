// Deterministic randomness: a seeded PRNG and smooth value noise, so the same seed
// always builds the same valley, the same screenshots and the same game.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function lerp(a, b, t) { return a + (b - a) * t; }

/** Value noise in [0, 1] at (x, z), cell size `cell`. */
export function noise2(x, z, cell, seed) {
  const gx = x / cell, gz = z / cell;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = smooth(gx - ix), fz = smooth(gz - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

/** Fractal noise in [0, 1]: `octaves` of value noise, each half the amplitude. */
export function fbm(x, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, total = 0, cell = 420;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x, z, cell, seed + i * 101) * amp;
    total += amp; amp *= 0.5; cell *= 0.5;
  }
  return sum / total;
}
