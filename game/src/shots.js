// Screenshot scenes behind ?shot=cover|cockpit|rings|landing (with &seed=N).
// Each one plays the real rules forward from a fresh sortie, steered by a simple
// autopilot (bank toward the objective, climb or descend to its height, hold a
// cruise throttle, flare on final), so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { newAircraft, stepAircraft, SCREEN_PLAY, clamp } from './aircraft.js';
import { newMission, stepMission, currentTarget, LEG_LANDING } from './missions.js';

const SAMPLE = 1 / 60;

/** Autopilot: a gentle PD controller — bank toward the objective, pitch toward
 * its height, throttle to cruise. It steers the *rates* (the aircraft integrates
 * them), so it eases into a bank and levels off instead of slamming side to side.
 * That is what keeps the plane on the course line and through the rings. */
function autopilot(a, target, landing) {
  const dx = target.x - a.x, dy = target.y - a.y, dz = target.z - a.z;
  const wantHeading = Math.atan2(dx, dz);
  let err = wantHeading - a.heading;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  const wantBank = clamp(err * 0.8, -0.5, 0.5);
  const roll = clamp((wantBank - a.roll) * 2.5, -1, 1);
  let wantPitch = clamp(dy * 0.0022, -0.28, 0.32);
  if (landing && a.y < 45) wantPitch = 0.12; // flare: ease the nose up on final
  const pitch = clamp((wantPitch - a.pitch) * 3, -1, 1);
  const cruise = landing ? 48 : 68;
  const throttle = clamp((cruise - a.speed) * 0.05, -0.6, 0.6);
  return { pitch, roll, throttle };
}

function simulate(a, m, seconds, landing) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const target = currentTarget(m);
    const ctl = autopilot(a, target, landing);
    const ev = stepAircraft(a, ctl, SAMPLE);
    stepMission(m, a, SAMPLE);
    if (ev === 'crashed' || a.screen === 'crashed') break;
    if (ev === 'landed') break;
  }
}

/**
 * Set the world to the named scene and return the screen to draw over it.
 * cover: mid-flight chase view, ring 1 ahead. cockpit: same sortie, cockpit view.
 * rings: frozen just as ring 2 is threaded. landing: staged final approach.
 */
export function stageShot(name, a, m) {
  Object.assign(a, newAircraft());
  Object.assign(m, newMission());
  a.screen = SCREEN_PLAY;
  a.camera = name === 'cockpit' ? 'cockpit' : 'chase';
  if (name === 'landing') {
    // Staged final approach: the sortie is flown to the last leg, then the plane
    // is placed on the glide path and the approach is flown for real.
    a.x = 0; a.y = 130; a.z = 1100; a.heading = Math.PI; a.speed = 55;
    a.throttle = 0.45; a.fuel = 42; a.onGround = false;
    m.leg = LEG_LANDING;
    simulate(a, m, 11, true);
    a.message = 'FINAL — LAND ON THE HOME STRIP';
    a.messageTime = 99;
    return { screen: SCREEN_PLAY };
  }
  // Take off, then fly the course. The autopilot rotates at 60 kt and climbs.
  a.throttle = 0.8;
  const takeOffSteps = Math.floor(9 / SAMPLE);
  for (let i = 0; i < takeOffSteps; i += 1) {
    const ctl = { pitch: a.speed > 30 ? 0.9 : 0, roll: 0, throttle: a.speed > 70 ? -0.3 : 0.3 };
    const ev = stepAircraft(a, ctl, SAMPLE);
    stepMission(m, a, SAMPLE);
    if (ev === 'crashed') break;
  }
  if (name === 'cover') simulate(a, m, 11, false); // ring ~150 m ahead, not on the nose
  if (name === 'cockpit') simulate(a, m, 21, false);
  if (name === 'rings') {
    simulate(a, m, 13, false);
    // Fly on until ring 1 is passed and ring 2 fills the view.
    simulate(a, m, 9, false);
  }
  a.message = '';
  a.messageTime = 0;
  return { screen: SCREEN_PLAY };
}
