// The valley: a seeded heightfield with a flat home apron, a winding river, rolling
// fields and mountain ridges east and west. Everything is pure functions of (x, z).
import { SEED, WORLD, COLORS } from './config.js';
import { fbm } from './random.js';

const { runway } = WORLD;

/** The river's centreline x at a given z (a slow meander east of the runway). */
export function riverX(z) {
  return 820 + 300 * Math.sin(z * 0.00045) + 120 * Math.sin(z * 0.0013 + 1.7);
}

/** Ground height in metres at world (x, z). */
export function heightAt(x, z) {
  // Flat home apron around the runway so takeoffs and landings read cleanly.
  const apron = smoothstep(90, 320, Math.max(Math.abs(x), Math.abs(z - 310) * 0.6));
  let h = fbm(x, z, SEED) * 130 - 20;
  // Mountain ridges far east and west, snow-capped at the top.
  const ridge = Math.max(0, (Math.abs(x) - 1700) / 900);
  h += ridge * ridge * 520 * (0.55 + 0.45 * fbm(x * 0.5, z * 0.5, SEED + 77));
  // A river valley carved along the meander, down to the water.
  const river = Math.abs(x - riverX(z));
  h -= 26 * Math.max(0, 1 - river / 160);
  // Gentle rise toward the far north so the horizon has shape.
  h += smoothstep(5000, 9000, z) * 90;
  return h * apron + 2 * (1 - apron);
}

export function smoothstep(a, b, t) {
  const s = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return s * s * (3 - 2 * s);
}

/** True when (x, z) is on the home runway strip. */
export function onRunway(x, z) {
  return x >= runway.x0 && x <= runway.x1 && z >= runway.z0 && z <= runway.z1;
}

/** True when (x, z) is water (the river). */
export function isWater(x, z) {
  return Math.abs(x - riverX(z)) < 26 && heightAt(x, z) < 6;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

/**
 * The colour of one terrain quad, from its centre height and position. Fields patch
 * by a slow hash so the valley reads as farmland; rock and snow take the ridges.
 */
export function terrainColor(x, z, h) {
  if (isWater(x, z)) return COLORS.river;
  if (h > 380) return shade(COLORS.snow, 0.94 + 0.06 * fbm(x, z, SEED + 5, 2));
  if (h > 240) return shade(COLORS.rock, 0.9 + 0.2 * fbm(x, z, SEED + 9, 2));
  if (h > 130) return shade(COLORS.hill, 0.9 + 0.2 * fbm(x, z, SEED + 13, 2));
  const patch = fbm(x * 0.7 + 500, z * 0.7, SEED + 21, 2);
  // Blend smoothly across three greens instead of hard bands: no slabs.
  const t1 = smoothstep(0.25, 0.6, patch);
  const t2 = smoothstep(0.55, 0.9, patch);
  let base = mix(COLORS.fieldA, COLORS.fieldB, t1);
  base = mix(base, COLORS.fieldC, t2);
  return shade(base, 0.95 + 0.08 * fbm(x, z, SEED + 31, 2));
}

function mix(a, b, t) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const r = Math.round(((na >> 16) & 255) + (((nb >> 16) & 255) - ((na >> 16) & 255)) * t);
  const g = Math.round(((na >> 8) & 255) + (((nb >> 8) & 255) - ((na >> 8) & 255)) * t);
  const bl = Math.round((na & 255) + ((nb & 255) - (na & 255)) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

/** A distance haze factor in [0, 1]: 0 near, 1 at the far haze. */
export function hazeFactor(dist) {
  return Math.min(0.85, Math.max(0, (dist - 1400) / 5200));
}
