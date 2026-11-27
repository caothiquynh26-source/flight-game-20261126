// Meridian Run — wiring: the loop, the screens, the events. Play it with the
// keyboard (arrows/WASD to fly, Shift/Ctrl for throttle) or the mouse (steer
// like a stick, wheel for throttle). C swaps chase/cockpit, P pauses, R restarts.
// ?shot=cover|cockpit|rings|landing stages a screenshot scene instead of playing.
import { VIEW } from './config.js';
import {
  newAircraft, resetAircraft, stepAircraft, say,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_LANDED, SCREEN_CRASHED,
} from './aircraft.js';
import { newMission, stepMission, scoreLanding, LEG_LANDING } from './missions.js';
import { newInput, bindInput, readControls, wasPressed, endTick, resetInput } from './input.js';
import { drawScene } from './render.js';
import { drawHUD, drawInstruments } from './hud.js';
import { unlockAudio, engineSound, ringChime, crashThud, landFanfare, lowFuelBeep, setMuted, isMuted } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

// Surface runtime errors for the screenshot harness (and for debugging).
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const aircraft = newAircraft();
const mission = newMission();
const input = newInput();
bindInput(input, canvas);

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

let best = 0;
try { best = Number(localStorage.getItem('meridian-run-best') || 0) || 0; } catch { best = 0; }

function saveBest() {
  if (aircraft.score > best) {
    best = aircraft.score;
    try { localStorage.setItem('meridian-run-best', String(best)); } catch { /* offline play */ }
  }
}

function startSortie() {
  resetInput(input);
  resetAircraft(aircraft);
  Object.assign(mission, newMission());
  aircraft.screen = SCREEN_PLAY;
  say(aircraft, 'TAKEOFF — full throttle, pull up at 60 kt', 5);
}

function onEvent(ev) {
  if (ev === 'takeoff') say(aircraft, 'AIRBORNE — climb out and find the rings', 3.5);
  else if (ev === 'ring') ringChime(false);
  else if (ev === 'ring-centre') ringChime(true);
  else if (ev === 'out-of-fuel') { say(aircraft, 'OUT OF FUEL — glide to the strip', 4); lowFuelBeep(); }
  else if (ev === 'landed') {
    if (mission.leg === LEG_LANDING) {
      const bonus = scoreLanding(mission, aircraft);
      saveBest();
      landFanfare();
      say(aircraft, `LANDED — sortie complete, +${bonus}`, 6);
    } else {
      say(aircraft, 'TOUCHDOWN — throttle up and go around', 3);
    }
  } else if (ev === 'crashed') { crashThud(); saveBest(); }
}

function draw(now) {
  drawScene(ctx, aircraft, mission);
  if (aircraft.camera === 'cockpit') drawInstruments(ctx, aircraft);
  drawHUD(ctx, aircraft, mission, now / 1000);
  drawScreen(ctx, aircraft, mission);
  if (statusEl) {
    statusEl.textContent = `Altitude ${Math.round(aircraft.y)} metres, speed ${Math.round(aircraft.speed * 1.94)} knots, score ${aircraft.score}. ${aircraft.message || ''}`;
  }
}

function drawScreen(ctx, a, m) {
  if (a.screen === SCREEN_PLAY) return;
  ctx.fillStyle = 'rgba(10,16,24,0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  if (a.screen === SCREEN_TITLE) {
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '700 84px system-ui, sans-serif';
    ctx.fillText('MERIDIAN RUN', VIEW.width / 2, 210);
    ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('One valley. Five rings. One strip of tarmac to come home to.', VIEW.width / 2, 258);
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = '#7dff9a';
    ctx.fillText('Press ENTER to fly', VIEW.width / 2, 330);
    ctx.font = '400 19px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('Arrows or mouse — fly · Shift / Ctrl — throttle · B — brake · C — cockpit · M — mute · P — pause', VIEW.width / 2, 380);
    ctx.fillText('Take off, thread all five rings, then land on the home strip before the fuel runs out.', VIEW.width / 2, 414);
    if (best > 0) {
      ctx.fillStyle = '#ffb347';
      ctx.fillText(`Best sortie: ${best} points`, VIEW.width / 2, 460);
    }
  } else if (a.screen === SCREEN_PAUSED) {
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '700 56px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.fillText('Press P to keep flying', VIEW.width / 2, 380);
  } else if (a.screen === SCREEN_LANDED) {
    ctx.fillStyle = '#7dff9a';
    ctx.font = '700 60px system-ui, sans-serif';
    ctx.fillText('SORTIE COMPLETE', VIEW.width / 2, 290);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillText(`Score ${a.score} · Rings ${a.ringsHit}/5 · Missed ${m.missed} · Landing bonus +${m.landedBonus}`, VIEW.width / 2, 350);
    ctx.fillText('Press R to fly again', VIEW.width / 2, 410);
    if (a.score >= best && a.score > 0) {
      ctx.fillStyle = '#ffb347';
      ctx.fillText('New best sortie!', VIEW.width / 2, 450);
    }
  } else if (a.screen === SCREEN_CRASHED) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = '700 60px system-ui, sans-serif';
    ctx.fillText('CRASHED', VIEW.width / 2, 290);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '400 24px system-ui, sans-serif';
    ctx.fillText(a.message || 'The valley wins this round', VIEW.width / 2, 345);
    ctx.fillText(`Score ${a.score} · Rings ${a.ringsHit}/5`, VIEW.width / 2, 390);
    ctx.fillText('Press R to fly again', VIEW.width / 2, 440);
  }
  ctx.textAlign = 'left';
}

if (shot) {
  // Screenshot mode: stage the scene, paint it, and signal readiness.
  try {
    stageShot(shot, aircraft, mission);
  } catch (e) {
    window.__shotError = String(e && e.message ? e.message : e);
  }
  draw(performance.now());
  draw(performance.now());
  window.__shotReady = true;
} else {
  // Title backdrop: the cover scene, frozen behind the title.
  stageShot('cover', aircraft, mission);
  aircraft.screen = SCREEN_TITLE;
  let last = performance.now();
  let acc = 0;
  let fuelBeepAt = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    unlockAudio();
    if (wasPressed(input, 'Enter') || wasPressed(input, 'Space')) {
      if (aircraft.screen === SCREEN_TITLE || aircraft.screen === SCREEN_LANDED || aircraft.screen === SCREEN_CRASHED) startSortie();
    }
    if (wasPressed(input, 'KeyR')) {
      if (aircraft.screen !== SCREEN_TITLE) startSortie();
    }
    if (wasPressed(input, 'KeyP')) {
      if (aircraft.screen === SCREEN_PLAY) aircraft.screen = SCREEN_PAUSED;
      else if (aircraft.screen === SCREEN_PAUSED) aircraft.screen = SCREEN_PLAY;
    }
    if (wasPressed(input, 'KeyC')) {
      aircraft.camera = aircraft.camera === 'chase' ? 'cockpit' : 'chase';
    }
    if (wasPressed(input, 'KeyM')) {
      setMuted(!isMuted());
      say(aircraft, isMuted() ? 'SOUND OFF' : 'SOUND ON', 1.5);
    }
    if (aircraft.screen === SCREEN_PLAY) {
      acc += dt;
      const step = 1 / 60;
      let n = 0;
      while (acc >= step && n < 5) {
        const ctl = readControls(input, now / 1000);
        const ev = stepAircraft(aircraft, ctl, step);
        const ev2 = stepMission(mission, aircraft, step);
        if (ev) onEvent(ev);
        if (ev2 === 'ring' || ev2 === 'ring-centre' || ev2 === 'leg-rings' || ev2 === 'leg-landing') onEvent(ev2 === 'leg-rings' || ev2 === 'leg-landing' ? '' : ev2);
        acc -= step;
        n += 1;
      }
      engineSound(aircraft.throttle, aircraft.speed, aircraft.onGround);
      if (aircraft.fuel < 20 && aircraft.fuel > 0 && now - fuelBeepAt > 4000) {
        fuelBeepAt = now;
        lowFuelBeep();
      }
    }
    draw(now);
    endTick(input);
    requestAnimationFrame(frame);
  }
  draw(performance.now());
  requestAnimationFrame(frame);
}
