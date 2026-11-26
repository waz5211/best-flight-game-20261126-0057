// The screenshot scenes behind ?shot=start|play|ring|landing. Each one puts the real
// plane, with the real flight model, in a fixed place and flies it forward a fixed number
// of steps with fixed inputs, so the same seed always gives the same frame — a render of
// the game itself, never a staged picture.
import { STEP } from './config.js';
import { stepPlane } from './physics.js';
import { checkRing, nextRing } from './missions.js';
import { groundHeight } from './terrain.js';
import { SCREEN_PLAY } from './world.js';

/** Place the plane at an exact spot, attitude and speed, on or above the ground. */
function place(world, x, y, z, yawDeg, pitch, roll, speed, throttle) {
  const s = world.state;
  s.pos.set(x, y, z);
  s.yaw = (yawDeg * Math.PI) / 180;
  s.pitch = pitch;
  s.roll = roll;
  s.speed = speed;
  s.throttle = throttle;
  s.throttleTarget = throttle;
  s.onGround = y - groundHeight(x, z) <= 2.4;
  s.verticalSpeed = 0;
}

function flyForward(world, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepPlane(world.state, input, STEP);
    checkRing(world.mission, world.state.pos);
    world.mission.elapsed += STEP;
  }
}

const CRUISE = { pitch: 0.02, roll: 0, yaw: 0, throttleDelta: 0, brakes: false };
const IDLE = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brakes: false };

/**
 * Stage the named scene and return the screen to draw. The HUD is drawn over every shot.
 */
export function stageShot(name, world) {
  const mission = world.mission;
  if (name === 'play') {
    // Mid-flight over the river valley: town below, mountains ahead, next ring in view.
    place(world, -100, 300, 550, -30, 0.04, 0.12, 58, 0.72);
    world.state.onGround = false;
    flyForward(world, 1.2, CRUISE);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'ring') {
    // A heartbeat from the first ring, nose on it, valley and lake beyond.
    const ring = nextRing(mission);
    const dx = ring.x - 0;
    const dz = ring.z - 0;
    const dist = Math.hypot(dx, dz);
    const yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
    place(world, ring.x - (dx / dist) * 90, ring.y + 6, ring.z - (dz / dist) * 90, yaw, 0.03, 0.06, 55, 0.7);
    world.state.onGround = false;
    flyForward(world, 0.6, CRUISE);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'landing') {
    // Final approach to Lake Strip: runway ahead, flaps down, gear down, slow and low.
    // The leg's rings are already flown, so the objective reads as a landing.
    mission.rings.forEach((ring) => { ring.passed = true; });
    mission.ringIndex = mission.rings.length;
    // The plane sits behind the strip, on the extended centreline, facing down it.
    const strip = { x: 980, z: -860, heading: 125 };
    const rad = (strip.heading * Math.PI) / 180;
    const backX = strip.x + Math.sin(rad) * 620;
    const backZ = strip.z + Math.cos(rad) * 620;
    place(world, backX, groundHeight(backX, backZ) + 85, backZ, strip.heading, -0.06, 0.02, 42, 0.35);
    world.state.onGround = false;
    world.state.flaps = true;
    world.state.gearDown = true;
    flyForward(world, 0.8, { ...CRUISE, pitch: -0.04 });
    return { screen: SCREEN_PLAY };
  }
  // start: on the threshold at Pine Hollow, engine spooling, strip and valley ahead.
  place(world, 0, groundHeight(0, 350) + 2.3, 350, 0, 0, 0, 0, 0.55);
  world.state.onGround = true;
  flyForward(world, 0.4, IDLE);
  world.state.speed = 0;
  return { screen: SCREEN_PLAY };
}
