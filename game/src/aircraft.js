// The aircraft: state, arcade flight physics, takeoff, landing and crash checks.
// Units are metres, metres/second and radians. Heading 0 flies north (+z).
import { PLANE, WORLD, LIMITS } from './config.js';
import { heightAt, onRunway } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LANDED = 'landed';
export const SCREEN_CRASHED = 'crashed';

export function newAircraft() {
  return {
    x: 0, y: heightAt(0, 100) + PLANE.gearHeight, z: 100,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0, fuel: PLANE.fuelCapacity,
    damage: 0, onGround: true, verticalSpeed: 0,
    screen: SCREEN_TITLE, message: '', messageTime: 0,
    score: 0, ringsHit: 0, time: 0,
    camera: 'chase', // 'chase' | 'cockpit'
  };
}

export function resetAircraft(a) {
  const fresh = newAircraft();
  Object.assign(a, fresh);
}

/**
 * Step the aircraft one tick. `ctl` is { pitch, roll, throttle, mouse } in [-1, 1]
 * (pitch + is nose up, roll + banks right, throttle is a delta). Returns an event
 * string: '' | 'takeoff' | 'landed' | 'crashed' | 'out-of-fuel'.
 */
export function stepAircraft(a, ctl, dt) {
  a.time += dt;
  if (a.messageTime > 0) a.messageTime -= dt;

  // Throttle: keyboard nudges it, mouse wheel sets it directly.
  if (ctl.throttle !== 0) a.throttle = clamp(a.throttle + ctl.throttle * dt * 0.7, 0, 1);
  if (a.fuel <= 0) a.throttle = 0;

  const targetSpeed = a.throttle * PLANE.maxSpeed * (ctl.brake ? 0.65 : 1);
  a.speed += (targetSpeed - a.speed) * Math.min(1, dt * PLANE.accel);

  // Pitch and roll answer at every speed, but weakly when slow.
  const authority = clamp(a.speed / 50, 0.35, 1);
  a.pitch = clamp(a.pitch + ctl.pitch * PLANE.pitchRate * authority * dt, LIMITS.maxPitchDown, LIMITS.maxPitchUp);
  a.roll = clamp(a.roll + ctl.roll * PLANE.rollRate * dt, -LIMITS.maxRoll, LIMITS.maxRoll);
  // The wings level themselves when the stick is released.
  if (ctl.roll === 0) a.roll *= Math.max(0, 1 - dt * 0.9);
  if (ctl.pitch === 0) a.pitch *= Math.max(0, 1 - dt * 0.5);

  // A banked turn: heading follows the bank, faster when fast. A right bank
  // (roll > 0) turns right: heading grows, swinging the nose east from north.
  const turnRate = (9.8 * Math.tan(a.roll)) / Math.max(a.speed, 20) * PLANE.turnFactor;
  a.heading += turnRate * dt;

  const wasGround = a.onGround;
  const ground = heightAt(a.x, a.z) + PLANE.gearHeight;

  if (a.onGround) {
    // Rolling on the ground: pitch stays level, speed is ground speed.
    a.pitch = 0;
    a.y = ground;
    a.verticalSpeed = 0;
    if (!onRunway(a.x, a.z) && a.speed > 15) {
      // Rough ground at speed: ran off the end of the strip.
      a.screen = SCREEN_CRASHED;
      a.damage = 100;
      a.message = 'OFF THE STRIP — rough ground at speed';
      a.messageTime = 6;
      return 'crashed';
    }
    if (a.speed > 32 && a.pitch >= 0 && ctl.pitch > 0.2) {
      a.onGround = false; // rotate: the nose comes up and she flies
      return 'takeoff';
    }
  } else {
    // In the air: climb with pitch, sink when slow.
    const sink = a.speed < PLANE.stallSpeed ? (PLANE.stallSpeed - a.speed) * 0.35 : 0;
    a.verticalSpeed = a.speed * Math.sin(a.pitch) - sink;
    a.y += a.verticalSpeed * dt;
  }

  const fx = Math.sin(a.heading), fz = Math.cos(a.heading);
  a.x += fx * a.speed * dt;
  a.z += fz * a.speed * dt;

  // Fuel burns with throttle; empty tanks mean a glide.
  const burn = (a.throttle * PLANE.fuelBurn + PLANE.fuelIdle) * dt;
  const hadFuel = a.fuel > 0;
  a.fuel = Math.max(0, a.fuel - burn);
  if (hadFuel && a.fuel === 0) return 'out-of-fuel';

  // Stay inside the valley; the edges push back gently instead of a wall.
  if (Math.abs(a.x) > WORLD.maxX - 60) a.heading += (a.x > 0 ? -1 : 1) * dt * 0.25;
  if (a.z > WORLD.maxZ - 60) a.heading = Math.PI + (Math.PI - a.heading) * 0.2;
  if (a.z < WORLD.minZ + 60) a.heading = 0 + (0 - a.heading) * 0.2;

  // Ground contact.
  if (!a.onGround && a.y <= ground) {
    a.y = ground;
    return touchDown(a, wasGround);
  }
  return '';
}

/** Resolve a ground touch: a good landing, a roll-out, or a crash. */
function touchDown(a, wasGround) {
  const hard = a.verticalSpeed < -6.5;
  const fast = a.speed > 52;
  const banked = Math.abs(a.roll) > 0.4;
  if (onRunway(a.x, a.z) && !hard && !fast && !banked && a.pitch < 0.18) {
    a.onGround = true;
    a.verticalSpeed = 0;
    a.pitch = 0;
    return 'landed';
  }
  if (onRunway(a.x, a.z) && !hard && !banked && wasGround) {
    a.onGround = true; // rolling out after a gentle touch
    a.verticalSpeed = 0;
    return '';
  }
  a.screen = SCREEN_CRASHED;
  a.damage = 100;
  if (hard) a.message = 'HARD LANDING — the gear gave way';
  else if (fast) a.message = 'TOO FAST — she ran off the strip';
  else if (banked) a.message = 'WING STRIKE — landed banked';
  else a.message = 'TERRAIN STRIKE — the valley wins this round';
  a.messageTime = 6;
  return 'crashed';
}

export function say(a, text, seconds = 3.5) {
  a.message = text;
  a.messageTime = seconds;
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Speed in knots, for the HUD. */
export function knots(speed) { return Math.round(speed * 1.94384); }

/** Heading in degrees, 0 = north, clockwise. */
export function headingDeg(heading) {
  return ((Math.round(-heading * 180 / Math.PI) % 360) + 360) % 360;
}
