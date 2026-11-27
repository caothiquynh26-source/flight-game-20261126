// The HUD and the cockpit instrument panel: altitude, speed, heading, throttle,
// fuel, score, the mission line and warnings — all drawn, nothing loaded.
import { VIEW, COLORS } from './config.js';
import { knots, headingDeg, clamp } from './aircraft.js';
import { missionLine } from './missions.js';

const W = VIEW.width, H = VIEW.height;

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(13,20,28,${alpha})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(234,246,255,0.25)';
  ctx.lineWidth = 1; ctx.stroke();
}

function text(ctx, s, x, y, size = 20, color = COLORS.hud, align = 'left', weight = '600') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** The top HUD bar, drawn in both cameras. */
export function drawHUD(ctx, a, mission, now) {
  panel(ctx, 16, 14, 300, 92);
  text(ctx, 'ALT', 30, 34, 13, COLORS.hudDim);
  text(ctx, `${Math.max(0, Math.round(a.y))} m`, 30, 60, 26, COLORS.hud, 'left', '700');
  text(ctx, 'SPD', 168, 34, 13, COLORS.hudDim);
  text(ctx, `${knots(a.speed)} kt`, 168, 60, 26, COLORS.hud, 'left', '700');
  text(ctx, `HDG ${String(headingDeg(a.heading)).padStart(3, '0')}°`, 30, 90, 15, COLORS.hudDim);

  // Compass tape across the top centre.
  const hdg = headingDeg(a.heading);
  panel(ctx, W / 2 - 190, 14, 380, 34, 0.6);
  ctx.save();
  ctx.beginPath(); ctx.rect(W / 2 - 190, 14, 380, 34); ctx.clip();
  for (let d = -60; d <= 60; d += 5) {
    const deg = ((Math.round(hdg / 5) * 5 + d) % 360 + 360) % 360;
    const x = W / 2 + d * 3.1;
    const major = deg % 30 === 0;
    ctx.strokeStyle = major ? COLORS.hud : COLORS.hudDim;
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, major ? 34 : 28); ctx.stroke();
    // Skip labels hugging the panel edge: they would render half-clipped.
    if (major && x > W / 2 - 172 && x < W / 2 + 172) {
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
      text(ctx, label, x, 42, 12, COLORS.hud, 'center');
    }
  }
  ctx.restore();
  ctx.fillStyle = COLORS.hudWarn;
  ctx.beginPath(); ctx.moveTo(W / 2, 14); ctx.lineTo(W / 2 - 6, 24); ctx.lineTo(W / 2 + 6, 24); ctx.closePath(); ctx.fill();

  // Throttle and fuel, right side.
  panel(ctx, W - 316, 14, 300, 92);
  text(ctx, 'THR', W - 302, 34, 13, COLORS.hudDim);
  bar(ctx, W - 302, 46, 272, 12, a.throttle, COLORS.hudGood);
  text(ctx, `${Math.round(a.throttle * 100)}%`, W - 302, 70, 15, COLORS.hud);
  text(ctx, 'FUEL', W - 180, 70, 13, COLORS.hudDim);
  const fuelFrac = a.fuel / 100;
  bar(ctx, W - 140, 62, 124, 12, fuelFrac, fuelFrac < 0.2 ? COLORS.hudWarn : COLORS.hudGood);
  text(ctx, 'SCORE', W - 302, 96, 13, COLORS.hudDim);
  text(ctx, String(a.score), W - 232, 96, 18, COLORS.hud, 'left', '700');
  text(ctx, `RINGS ${a.ringsHit}/5`, W - 60, 96, 13, COLORS.hudDim, 'right');

  // Mission line, centre.
  panel(ctx, W / 2 - 260, 58, 520, 34, 0.6);
  text(ctx, missionLine(mission), W / 2, 75, 17, COLORS.hud, 'center');

  // Warnings, flashing when they matter.
  const blink = Math.floor(now * 2.5) % 2 === 0;
  if (a.speed < 26 && !a.onGround && blink) warn(ctx, 'STALL — NOSE DOWN, POWER UP');
  else if (a.fuel < 20 && a.fuel > 0 && blink) warn(ctx, 'LOW FUEL — COME HOME');
  else if (a.fuel <= 0) warn(ctx, 'OUT OF FUEL — GLIDE TO THE STRIP');
  if (a.message && a.messageTime > 0) {
    panel(ctx, W / 2 - 320, H - 118, 640, 40, 0.75);
    text(ctx, a.message, W / 2, H - 98, 19, COLORS.hudGood, 'center', '700');
  }
  if (a.camera === 'chase') {
    text(ctx, 'ARROWS / MOUSE fly · SHIFT throttle · B brake · C cockpit · M mute · P pause', W / 2, H - 16, 13, 'rgba(234,246,255,0.75)', 'center', '400');
  }
}

function warn(ctx, s) {
  panel(ctx, W / 2 - 260, 102, 520, 36, 0.8);
  text(ctx, s, W / 2, 120, 18, COLORS.hudWarn, 'center', '700');
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(234,246,255,0.18)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(4, w * clamp(frac, 0, 1)), h, 6); ctx.fill();
}

/** The six-pack instrument panel across the bottom of the cockpit view. */
export function drawInstruments(ctx, a) {
  const y = H - 168, h = 168;
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(0, y, W, 4);
  const cx = [150, 330, 510, 690, 870, 1050];
  gaugeAttitude(ctx, cx[0], y + 84, 62, a);
  gaugeAirspeed(ctx, cx[1], y + 84, 62, a);
  gaugeAltimeter(ctx, cx[2], y + 84, 62, a);
  gaugeCompass(ctx, cx[3], y + 84, 62, a);
  gaugeFuel(ctx, cx[4], y + 84, 62, a);
  gaugeThrottle(ctx, cx[5], y + 84, 62, a);
  text(ctx, 'ATTITUDE', cx[0], y + 152, 12, COLORS.hudDim, 'center', '400');
  text(ctx, 'AIRSPEED', cx[1], y + 152, 12, COLORS.hudDim, 'center', '400');
  text(ctx, 'ALTIMETER', cx[2], y + 152, 12, COLORS.hudDim, 'center', '400');
  text(ctx, 'COMPASS', cx[3], y + 152, 12, COLORS.hudDim, 'center', '400');
  text(ctx, 'FUEL', cx[4], y + 152, 12, COLORS.hudDim, 'center', '400');
  text(ctx, 'THROTTLE', cx[5], y + 152, 12, COLORS.hudDim, 'center', '400');
}

function gaugeFace(ctx, x, y, r) {
  ctx.fillStyle = COLORS.gaugeFace;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLORS.gaugeTick;
  ctx.lineWidth = 2; ctx.stroke();
}

function gaugeAttitude(ctx, x, y, r, a) {
  gaugeFace(ctx, x, y, r);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-a.roll);
  ctx.translate(0, a.pitch * r * 1.4);
  ctx.fillStyle = '#3f7fc4'; ctx.fillRect(-r, -r, r * 2, r);
  ctx.fillStyle = '#7a5a34'; ctx.fillRect(-r, 0, r * 2, r);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 22, y); ctx.stroke();
}

function gaugeAirspeed(ctx, x, y, r, a) {
  gaugeFace(ctx, x, y, r);
  ticks(ctx, x, y, r, 0, 200, 20);
  needle(ctx, x, y, r, (knots(a.speed) / 200) * 270 - 135);
  text(ctx, `${knots(a.speed)}`, x, y + 8, 20, COLORS.hud, 'center', '700');
  text(ctx, 'KT', x, y + 30, 11, COLORS.hudDim, 'center', '400');
}

function gaugeAltimeter(ctx, x, y, r, a) {
  gaugeFace(ctx, x, y, r);
  ticks(ctx, x, y, r, 0, 1000, 100);
  needle(ctx, x, y, r, ((a.y % 1000) / 1000) * 360 - 90);
  text(ctx, `${Math.max(0, Math.round(a.y))}`, x, y + 8, 18, COLORS.hud, 'center', '700');
  text(ctx, 'M', x, y + 30, 11, COLORS.hudDim, 'center', '400');
}

function gaugeCompass(ctx, x, y, r, a) {
  gaugeFace(ctx, x, y, r);
  const hdg = headingDeg(a.heading);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.clip();
  for (let d = 0; d < 360; d += 10) {
    const ang = ((d - hdg) * Math.PI) / 180;
    const x1 = x + Math.sin(ang) * (r - 14), y1 = y - Math.cos(ang) * (r - 14);
    const x2 = x + Math.sin(ang) * (r - 4), y2 = y - Math.cos(ang) * (r - 4);
    ctx.strokeStyle = d % 90 === 0 ? COLORS.hud : COLORS.hudDim;
    ctx.lineWidth = d % 90 === 0 ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (d % 90 === 0) {
      const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : 'W';
      text(ctx, label, x + Math.sin(ang) * (r - 26), y - Math.cos(ang) * (r - 26) + 4, 13, COLORS.hud, 'center', '700');
    }
  }
  ctx.restore();
  ctx.fillStyle = COLORS.hudWarn;
  ctx.beginPath(); ctx.moveTo(x, y - r + 2); ctx.lineTo(x - 6, y - r + 14); ctx.lineTo(x + 6, y - r + 14); ctx.closePath(); ctx.fill();
}

function gaugeFuel(ctx, x, y, r, a) {
  gaugeFace(ctx, x, y, r);
  ticks(ctx, x, y, r, 0, 100, 25);
  needle(ctx, x, y, r, (a.fuel / 100) * 270 - 135);
  text(ctx, a.fuel < 20 ? 'LOW' : `${Math.round(a.fuel)}%`, x, y + 8, 16, a.fuel < 20 ? COLORS.hudWarn : COLORS.hud, 'center', '700');
}

function gaugeThrottle(ctx, x, y, r, a) {
  gaugeFace(ctx, x, y, r);
  ticks(ctx, x, y, r, 0, 100, 25);
  needle(ctx, x, y, r, a.throttle * 270 - 135);
  text(ctx, `${Math.round(a.throttle * 100)}%`, x, y + 8, 16, COLORS.hud, 'center', '700');
}

function ticks(ctx, x, y, r, min, max, step) {
  for (let v = min; v <= max; v += step) {
    const ang = ((v - min) / (max - min)) * 270 * Math.PI / 180 - (135 * Math.PI) / 180 - Math.PI / 2;
    const x1 = x + Math.cos(ang) * (r - 10), y1 = y + Math.sin(ang) * (r - 10);
    const x2 = x + Math.cos(ang) * (r - 3), y2 = y + Math.sin(ang) * (r - 3);
    ctx.strokeStyle = COLORS.gaugeTick; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
}

function needle(ctx, x, y, r, deg) {
  const ang = (deg * Math.PI) / 180 - Math.PI / 2;
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * (r - 14), y + Math.sin(ang) * (r - 14)); ctx.stroke();
  ctx.fillStyle = COLORS.hud;
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
}
