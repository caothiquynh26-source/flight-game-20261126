// Meridian Run — configuration: world layout, physics and presentation constants.
// One original game, written for the make.fun "best flight game" bounty.
export const SEED = 20261126;

export const VIEW = { width: 1280, height: 720, fov: 1.22 };

export const WORLD = {
  // Playable terrain, metres. The course runs north (+z) from the home runway.
  minX: -2600, maxX: 2600, minZ: -500, maxZ: 9000,
  cell: 100,
  // Home runway: a flat strip along z, centred on x = 0.
  runway: { x0: -18, x1: 18, z0: 0, z1: 620, heading: 0 },
  // The five target rings of the ring leg, in course order.
  rings: [
    { x: 150, y: 180, z: 1500, r: 26 },
    { x: -350, y: 220, z: 2600, r: 26 },
    { x: 500, y: 200, z: 3800, r: 26 },
    { x: -150, y: 260, z: 5000, r: 26 },
    { x: 250, y: 180, z: 6200, r: 26 },
  ],
  // Final approach: start the landing leg southbound from here.
  approach: { x: 0, y: 130, z: 1100, speed: 55 },
};

export const PLANE = {
  maxSpeed: 95, // m/s, full throttle
  cruiseSpeed: 68,
  stallSpeed: 26,
  accel: 0.35, // 1/s toward throttle speed
  pitchRate: 0.55, // rad/s at full deflection
  rollRate: 1.5, // rad/s
  turnFactor: 1.6, // arcade multiplier on banked-turn rate
  fuelCapacity: 100,
  fuelBurn: 0.28, // units/s at full throttle
  fuelIdle: 0.02,
  gearHeight: 1.2, // metres: wheels to terrain
};

export const SCORE = { ring: 100, ringCentre: 50, landing: 200, landingSmooth: 100 };

// Control-surface limits, shared by the physics step.
export const LIMITS = { maxPitchUp: 0.55, maxPitchDown: -0.5, maxRoll: 1.1 };

export const COLORS = {
  skyTop: '#2f6fd0', skyMid: '#7fb2e8', skyLow: '#cfe6f7',
  sun: '#fff3c4',
  fieldA: '#5d9b4a', fieldB: '#6fae56', fieldC: '#4c8a3e',
  hill: '#7a7d4a', rock: '#8a7f72', snow: '#eef3f6', river: '#3f7fc4',
  runway: '#3c4148', runwayLine: '#f2f2e8', ring: '#ff7a1a', ringInner: '#ffffff',
  hud: '#eaf6ff', hudDim: '#9fc4e0', hudWarn: '#ff5a3c', hudGood: '#7dff9a',
  panel: '#1d2733', panelEdge: '#0d141c', gaugeFace: '#101820', gaugeTick: '#cfe3f2',
};
