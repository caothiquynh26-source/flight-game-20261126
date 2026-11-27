// The scene renderer: sky, a projected heightfield valley, the home runway, target
// rings, clouds and the aircraft — all drawn in code on one canvas, no images.
import { VIEW, WORLD, COLORS } from './config.js';
import { heightAt, terrainColor, riverX, hazeFactor, onRunway } from './terrain.js';
import { fbm } from './random.js';
import { SEED } from './config.js';

const W = VIEW.width, H = VIEW.height;
const FOCAL = (H / 2) / Math.tan(VIEW.fov / 2);

// Precomputed terrain grid: heights at every grid point, colours per cell.
const CELL = WORLD.cell;
const COLS = Math.round((WORLD.maxX - WORLD.minX) / CELL);
const ROWS = Math.round((WORLD.maxZ - WORLD.minZ) / CELL);
const heights = new Float32Array((ROWS + 1) * (COLS + 1));
const cellColors = new Array(ROWS * COLS);
for (let r = 0; r <= ROWS; r += 1) {
  for (let c = 0; c <= COLS; c += 1) {
    const x = WORLD.minX + c * CELL, z = WORLD.minZ + r * CELL;
    heights[r * (COLS + 1) + c] = heightAt(x, z);
  }
}
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    const x = WORLD.minX + (c + 0.5) * CELL, z = WORLD.minZ + (r + 0.5) * CELL;
    cellColors[r * COLS + c] = parseColor(terrainColor(x, z, heights[r * (COLS + 1) + c]));
  }
}

function parseColor(css) {
  if (css.startsWith('#')) {
    const n = parseInt(css.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = css.match(/rgb\((\d+),(\d+),(\d+)\)/);
  return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
}

function hazeColor(rgb, dist) {
  const h = hazeFactor(dist);
  if (h <= 0) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const r = Math.round(rgb[0] + (207 - rgb[0]) * h);
  const g = Math.round(rgb[1] + (230 - rgb[1]) * h);
  const b = Math.round(rgb[2] + (247 - rgb[2]) * h);
  return `rgb(${r},${g},${b})`;
}

// --- 3D helpers -------------------------------------------------------------
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function makeCamera(a) {
  const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
  const F = [Math.sin(a.heading) * cp, sp, Math.cos(a.heading) * cp];
  let C, look;
  if (a.camera === 'cockpit') {
    C = [a.x + F[0] * 1.2, a.y + 1.15, a.z + F[2] * 1.2];
    look = [a.x + F[0] * 120, a.y + F[1] * 120, a.z + F[2] * 120];
  } else {
    C = [a.x - F[0] * 15, a.y - F[1] * 15 + 4.4, a.z - F[2] * 15];
    look = [a.x + F[0] * 32, a.y + F[1] * 32 - 1, a.z + F[2] * 32];
  }
  const fwd = norm(sub(look, C));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const roll = a.camera === 'cockpit' ? a.roll : a.roll * 0.85;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  return {
    C, fwd,
    right: [right[0] * cr + up[0] * sr, right[1] * cr + up[1] * sr, right[2] * cr + up[2] * sr],
    up: [up[0] * cr - right[0] * sr, up[1] * cr - right[1] * sr, up[2] * cr - right[2] * sr],
  };
}

function project(p, cam) {
  const dx = p[0] - cam.C[0], dy = p[1] - cam.C[1], dz = p[2] - cam.C[2];
  const cz = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
  if (cz < 2) return null;
  const cx = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
  const cy = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
  return { x: W / 2 + (cx / cz) * FOCAL, y: H / 2 - (cy / cz) * FOCAL, d: cz };
}

// --- clouds (fixed seeded billboards) ---------------------------------------
const CLOUDS = [];
{
  const rnd = (n) => fbm(n * 13.7, n * 7.1, SEED + 400, 2);
  for (let i = 0; i < 14; i += 1) {
    CLOUDS.push({
      x: -2400 + rnd(i) * 4800,
      y: 300 + rnd(i + 100) * 260,
      z: -300 + rnd(i + 200) * 8600,
      s: 120 + rnd(i + 300) * 130,
    });
  }
}

// --- the frame ---------------------------------------------------------------
export function drawScene(ctx, a, mission) {
  const cam = makeCamera(a);
  drawSky(ctx, a);
  drawTerrain(ctx, cam, a);
  drawRings(ctx, cam, mission);
  drawClouds(ctx, cam);
  if (a.camera === 'cockpit') drawCockpitFrame(ctx, a);
  else drawAircraft(ctx, a);
}

function drawSky(ctx, a) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.55, COLORS.skyMid);
  g.addColorStop(0.78, COLORS.skyLow);
  g.addColorStop(1, COLORS.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Sun, fixed to the north-east so it reads in most headings.
  const sunX = W * 0.78 - a.heading * 60, sunY = H * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, 'rgba(255,243,196,0.95)');
  glow.addColorStop(0.25, 'rgba(255,243,196,0.45)');
  glow.addColorStop(1, 'rgba(255,243,196,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
}

function drawTerrain(ctx, cam, a) {
  // Rows far-to-near along the camera's forward axis (painter's algorithm).
  const rowOrder = [];
  for (let r = 0; r < ROWS; r += 1) {
    const z = WORLD.minZ + (r + 0.5) * CELL;
    const dz = z - cam.C[2];
    rowOrder.push([r, dz * cam.fwd[2] + (WORLD.minX - cam.C[0]) * cam.fwd[0]]);
  }
  rowOrder.sort((p, q) => q[1] - p[1]);
  const rw = WORLD.runway;
  for (const [r] of rowOrder) {
    const z0 = WORLD.minZ + r * CELL, z1 = z0 + CELL;
    const rowDist = Math.abs(z0 - cam.C[2]) + Math.abs(cam.C[0]) * 0.2;
    if (rowDist > 5200) continue;
    for (let c = 0; c < COLS; c += 1) {
      const x0 = WORLD.minX + c * CELL, x1 = x0 + CELL;
      const cx = x0 + CELL / 2, cz = z0 + CELL / 2;
      const dx = cx - cam.C[0], dz = cz - cam.C[2];
      if (dx * dx + dz * dz > 5200 * 5200) continue;
      const p00 = project([x0, heights[r * (COLS + 1) + c], z0], cam);
      const p10 = project([x1, heights[r * (COLS + 1) + c + 1], z0], cam);
      const p11 = project([x1, heights[(r + 1) * (COLS + 1) + c + 1], z1], cam);
      const p01 = project([x0, heights[(r + 1) * (COLS + 1) + c], z1], cam);
      if (!p00 || !p10 || !p11 || !p01) continue;
      const dist = (p00.d + p10.d + p11.d + p01.d) / 4;
      ctx.fillStyle = hazeColor(cellColors[r * COLS + c], dist);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
      ctx.closePath(); ctx.fill();
    }
    // The runway strip, drawn with its own row so nearer ground covers it.
    if (z1 > rw.z0 && z0 < rw.z1) {
      const stripZ0 = Math.max(z0, rw.z0), stripZ1 = Math.min(z1, rw.z1);
      const y = heightAt(0, (stripZ0 + stripZ1) / 2) + 0.7;
      const q = [
        project([rw.x0, y, stripZ0], cam), project([rw.x1, y, stripZ0], cam),
        project([rw.x1, y, stripZ1], cam), project([rw.x0, y, stripZ1], cam),
      ];
      if (q.every(Boolean)) {
        ctx.fillStyle = COLORS.runway;
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[1].x, q[1].y);
        ctx.lineTo(q[2].x, q[2].y); ctx.lineTo(q[3].x, q[3].y);
        ctx.closePath(); ctx.fill();
        // Centreline dashes, one per 50 m.
        if (Math.floor(stripZ0 / 50) % 2 === 0) {
          const d0 = project([-1.2, y + 0.1, stripZ0], cam);
          const d1 = project([1.2, y + 0.1, stripZ0], cam);
          const d2 = project([1.2, y + 0.1, stripZ1], cam);
          const d3 = project([-1.2, y + 0.1, stripZ1], cam);
          if (d0 && d1 && d2 && d3) {
            ctx.fillStyle = COLORS.runwayLine;
            ctx.beginPath();
            ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y);
            ctx.lineTo(d2.x, d2.y); ctx.lineTo(d3.x, d3.y);
            ctx.closePath(); ctx.fill();
          }
        }
      }
    }
  }
}

function drawRings(ctx, cam, mission) {
  for (let i = 0; i < mission.rings.length; i += 1) {
    const ring = mission.rings[i];
    const next = i === mission.ringIndex && mission.leg === 'rings';
    const passed = ring.hit;
    const pts = [];
    let visible = false;
    for (let k = 0; k <= 28; k += 1) {
      const t = (k / 28) * Math.PI * 2;
      const p = project([ring.x + Math.cos(t) * ring.r, ring.y + Math.sin(t) * ring.r, ring.z], cam);
      pts.push(p);
      if (p && p.x > -80 && p.x < W + 80 && p.y > -80 && p.y < H + 80) visible = true;
    }
    if (!visible) continue;
    ctx.beginPath();
    let started = false;
    for (const p of pts) {
      if (!p) continue;
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = passed ? 'rgba(125,255,154,0.10)' : next ? 'rgba(255,122,26,0.12)' : 'rgba(255,122,26,0.06)';
    ctx.fill();
    ctx.lineWidth = next ? 7 : 4;
    ctx.strokeStyle = passed ? '#7dff9a' : COLORS.ring;
    ctx.stroke();
    if (next) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.ringInner;
      ctx.stroke();
    }
  }
}

function drawClouds(ctx, cam) {
  for (const cl of CLOUDS) {
    const p = project([cl.x, cl.y, cl.z], cam);
    if (!p || p.x < -200 || p.x > W + 200 || p.y < -120 || p.y > H * 0.75) continue;
    const s = (cl.s / p.d) * FOCAL;
    if (s < 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    // One soft puff: tightly overlapping ellipses, never a segmented worm.
    for (const [ox, oy, r] of [[-0.16, 0.06, 0.52], [0, -0.12, 0.60], [0.18, 0.05, 0.50], [0.02, 0.14, 0.52]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * s, p.y + oy * s, r * s, r * s * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The aircraft in chase view: a rear three-quarter drawing, rolled with the plane. */
function drawAircraft(ctx, a) {
  const cx = W / 2, cy = H * 0.60;
  const span = 150;
  ctx.save();
  ctx.translate(cx, cy + a.pitch * 60);
  ctx.rotate(-a.roll * 0.9);
  ctx.scale(1, 1);
  // Wings (far side darker, near side lighter).
  ctx.fillStyle = '#b8c4cc';
  ctx.beginPath();
  ctx.moveTo(-span / 2, -6); ctx.lineTo(-span * 0.32, -26); ctx.lineTo(span * 0.32, -26); ctx.lineTo(span / 2, -6);
  ctx.lineTo(span * 0.30, 6); ctx.lineTo(-span * 0.30, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d7e2e8';
  ctx.beginPath();
  ctx.moveTo(-span * 0.32, -26); ctx.lineTo(0, -34); ctx.lineTo(span * 0.32, -26);
  ctx.lineTo(span * 0.30, 6); ctx.lineTo(-span * 0.30, 6); ctx.closePath(); ctx.fill();
  // Fuselage, tapering away to the nose.
  const body = ctx.createLinearGradient(0, 34, 0, -64);
  body.addColorStop(0, '#e8542f');
  body.addColorStop(1, '#c23d1d');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-13, 36); ctx.lineTo(-9, -52); ctx.quadraticCurveTo(0, -66, 9, -52);
  ctx.lineTo(13, 36); ctx.quadraticCurveTo(0, 44, -13, 36); ctx.closePath(); ctx.fill();
  // Canopy.
  ctx.fillStyle = '#9fd8ef';
  ctx.beginPath();
  ctx.ellipse(0, -34, 7, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-2, -40, 3, 7, 0, 0, Math.PI * 2); ctx.fill();
  // Tail fin and stabilisers.
  ctx.fillStyle = '#8f2f16';
  ctx.beginPath();
  ctx.moveTo(-4, 34); ctx.lineTo(0, 2); ctx.lineTo(4, 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b8c4cc';
  ctx.beginPath();
  ctx.moveTo(-34, 28); ctx.lineTo(0, 16); ctx.lineTo(34, 28); ctx.lineTo(30, 36); ctx.lineTo(-30, 36); ctx.closePath(); ctx.fill();
  // Wingtip navigation lights, lit.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-span / 2 + 4, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2fd94a';
  ctx.beginPath(); ctx.arc(span / 2 - 4, -4, 4, 0, Math.PI * 2); ctx.fill();
  // Propeller blur at the far nose.
  ctx.fillStyle = 'rgba(220,228,235,0.35)';
  ctx.beginPath(); ctx.ellipse(0, -58, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Cockpit view: canopy frame and the nose over the panel (gauges drawn by hud.js). */
function drawCockpitFrame(ctx, a) {
  ctx.fillStyle = '#10161d';
  // Canopy pillars and top frame.
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W * 0.10, 0); ctx.lineTo(W * 0.16, H * 0.30); ctx.lineTo(0, H * 0.34); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W * 0.90, 0); ctx.lineTo(W * 0.84, H * 0.30); ctx.lineTo(W, H * 0.34); ctx.closePath(); ctx.fill();
  ctx.fillRect(0, 0, W, H * 0.045);
  // Nose and spinner, low centre.
  ctx.fillStyle = '#c23d1d';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 46, H * 0.72); ctx.lineTo(W / 2 - 10, H * 0.60);
  ctx.lineTo(W / 2 + 10, H * 0.60); ctx.lineTo(W / 2 + 46, H * 0.72);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath(); ctx.ellipse(W / 2, H * 0.60, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
}
