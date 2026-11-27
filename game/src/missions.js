// Missions: one sortie in three legs — take off from the home strip, fly the five
// rings of the valley course, then come home and land. Scoring rewards clean flying.
import { WORLD, SCORE } from './config.js';
import { clamp, say, SCREEN_LANDED } from './aircraft.js';

export const LEG_TAKEOFF = 'takeoff';
export const LEG_RINGS = 'rings';
export const LEG_LANDING = 'landing';
export const LEG_DONE = 'done';

export function newMission() {
  return {
    leg: LEG_TAKEOFF,
    ringIndex: 0,
    rings: WORLD.rings.map((r) => ({ ...r, hit: false, centre: false })),
    missed: 0, // rings flown past without threading
    landedBonus: 0,
    distanceToTarget: 0,
  };
}

/** The current objective: where the pilot should fly, and how high. */
export function currentTarget(m) {
  if (m.leg === LEG_TAKEOFF) return { x: 0, y: 120, z: 900, label: 'CLIMB OUT — pull up at 60 kt' };
  if (m.leg === LEG_RINGS) {
    const r = m.rings[m.ringIndex];
    return { x: r.x, y: r.y, z: r.z, label: `RING ${m.ringIndex + 1} OF ${m.rings.length}` };
  }
  if (m.leg === LEG_LANDING) return { x: 0, y: 40, z: 300, label: 'FINAL — land on the home strip' };
  return { x: 0, y: 60, z: 300, label: 'SORTIE COMPLETE' };
}

/**
 * Advance the mission from the aircraft's state. Returns an event string:
 * '' | 'ring' | 'ring-centre' | 'leg-rings' | 'leg-landing' | 'landed'.
 */
export function stepMission(m, a, dt) {
  const target = currentTarget(m);
  const dx = target.x - a.x, dy = target.y - a.y, dz = target.z - a.z;
  m.distanceToTarget = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (m.leg === LEG_TAKEOFF) {
    if (!a.onGround && a.y > 90) {
      m.leg = LEG_RINGS;
      say(a, 'RING LEG — thread all five rings', 4);
      return 'leg-rings';
    }
    return '';
  }

  if (m.leg === LEG_RINGS) {
    const ring = m.rings[m.ringIndex];
    // Crossing the ring's plane while inside it counts as a pass.
    const prevZ = a.z - Math.cos(a.heading) * a.speed * dt;
    const crossed = (prevZ - ring.z) * (a.z - ring.z) <= 0 && a.speed > 5;
    if (crossed) {
      const ddx = a.x - ring.x, ddy = a.y - ring.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist <= ring.r) {
        ring.hit = true;
        const centre = dist <= 12;
        ring.centre = centre;
        a.score += SCORE.ring + (centre ? SCORE.ringCentre : 0);
        a.ringsHit += 1;
        if (m.ringIndex + 1 >= m.rings.length) {
          m.leg = LEG_LANDING;
          say(a, 'ALL RINGS — come home and land', 4);
          return centre ? 'ring-centre' : 'ring';
        }
        m.ringIndex += 1;
        say(a, centre ? `RING ${m.ringIndex} — DEAD CENTRE +${SCORE.ring + SCORE.ringCentre}` : `RING ${m.ringIndex} +${SCORE.ring}`, 2.5);
        return centre ? 'ring-centre' : 'ring';
      }
      // Missed the ring: fly on, the next ring is already the target.
      say(a, `MISSED RING ${m.ringIndex + 1} — press on`, 2.5);
      m.missed += 1;
      m.ringIndex += 1;
      if (m.ringIndex >= m.rings.length) {
        m.leg = LEG_LANDING;
        say(a, 'COURSE DONE — come home and land', 4);
        return 'leg-landing';
      }
      return '';
    }
    return '';
  }

  if (m.leg === LEG_LANDING) {
    // The landing itself is judged by the aircraft module's touchDown.
    return '';
  }
  return '';
}

/** Called when the aircraft touches down well on the runway during the landing leg. */
export function scoreLanding(m, a) {
  if (m.leg !== LEG_LANDING) return 0;
  const smooth = clamp(1 - Math.abs(a.verticalSpeed) / 6.5, 0, 1);
  const bonus = SCORE.landing + Math.round(SCORE.landingSmooth * smooth);
  a.score += bonus;
  m.landedBonus = bonus;
  m.leg = LEG_DONE;
  a.screen = SCREEN_LANDED;
  return bonus;
}

/** Short line for the HUD: what to do next, and how far it is. */
export function missionLine(m) {
  const t = currentTarget(m);
  return `${t.label} — ${Math.round(m.distanceToTarget)} m`;
}
