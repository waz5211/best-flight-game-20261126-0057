// Tunable constants for Ridge Runner: world size, flight model, mission pacing.
// All distances are metres, speeds are m/s, angles are radians unless named otherwise.
export const STEP = 1 / 60;

export const WORLD = {
  size: 4200, // terrain spans -2100..2100 on x and z
  segments: 150,
  seaLevel: 0,
};

export const PLANE = {
  maxSpeed: 70, // m/s at full throttle, level flight (~136 kt)
  cruiseSpeed: 55,
  stallSpeed: 26, // below this the wing stops flying and she sinks
  takeoffSpeed: 34,
  accel: 0.45, // how fast speed chases the throttle target
  pitchRate: 0.85,
  rollRate: 1.5,
  yawRate: 0.55,
  maxPitch: 0.62,
  maxRoll: 1.15,
  gearHeight: 2.3, // clearance of the fuselage belly above the wheels
  fuelBurnBase: 0.11, // %/s at idle
  fuelBurnThrottle: 0.30, // extra %/s at full throttle
};

export const SCORE = {
  ring: 100,
  legDelivery: 500,
  timeBonusPerSecond: 2, // bonus paid against the leg par time
  legParSeconds: 150,
  missionBonus: 1000,
};

// The three strips of the valley route. Heading is degrees, 0 = north (-z).
export const STRIPS = [
  { name: 'Pine Hollow', x: 0, z: 350, heading: 0, length: 300, width: 26, elevation: 46 },
  { name: 'Lake Strip', x: 980, z: -860, heading: 125, length: 260, width: 22, elevation: 38 },
  { name: 'Ridge Strip', x: -1150, z: -620, heading: 300, length: 240, width: 22, elevation: 210 },
];

export const RING_RADIUS = 14;
export const RING_COUNT_PER_LEG = 3;
