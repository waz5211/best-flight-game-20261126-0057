// Arcade flight model with real trade-offs: throttle sets the speed the engine can hold,
// the wing only flies above stall speed, a banked turn needs the rudder's help to stay
// coordinated, and flaps trade drag for a slower, safer touchdown.
import { PLANE, STRIPS } from './config.js';
import { groundHeight } from './terrain.js';

export const EVENT_NONE = 0;
export const EVENT_TOUCHDOWN = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_FUEL_EMPTY = 8;

const G = 9.81;

export function createPlaneState(strip) {
  const rad = (strip.heading * Math.PI) / 180;
  return {
    pos: new THREE.Vector3(strip.x, strip.elevation + PLANE.gearHeight, strip.z),
    pitch: 0,
    yaw: rad,
    roll: 0,
    speed: 0,
    throttle: 0,
    throttleTarget: 0,
    fuel: 100,
    damage: 0,
    flaps: false,
    gearDown: true,
    brakes: false,
    onGround: true,
    verticalSpeed: 0,
    airborneTime: 0,
    crashed: false,
    landedStrip: strip.name,
    landedReported: true, // starts parked on its home strip: nothing to report yet
  };
}

function forwardOf(state) {
  const cp = Math.cos(state.pitch);
  return new THREE.Vector3(
    -Math.sin(state.yaw) * cp,
    Math.sin(state.pitch),
    -Math.cos(state.yaw) * cp,
  );
}

export function stripAt(x, z) {
  for (const strip of STRIPS) {
    const rad = (strip.heading * Math.PI) / 180;
    const dx = x - strip.x;
    const dz = z - strip.z;
    const along = dx * Math.sin(rad) + dz * Math.cos(rad);
    const across = dx * Math.cos(rad) - dz * Math.sin(rad);
    if (Math.abs(along) <= strip.length / 2 && Math.abs(across) <= strip.width / 2) return strip;
  }
  return null;
}

function inLake(x, z) {
  // Real water is where the ground itself is below the lake's surface: the island strip
  // sits on flattened ground well above the water, so touching down there is land.
  return Math.hypot(x - 980, z + 860) < 340 && groundHeight(x, z) < 12;
}

export function applyQuaternion(state, mesh) {
  mesh.position.copy(state.pos);
  mesh.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
  if (mesh.userData.prop) {
    mesh.userData.prop.rotation.z -= (0.4 + state.throttle * 1.9) * (state.onGround ? 0.6 : 1);
  }
}

/**
 * Advance the plane one fixed step. `input` is { pitch, roll, yaw, throttleDelta, brakes }.
 * Returns an event bitmask; the caller owns scoring and screens.
 */
export function stepPlane(state, input, dt) {
  if (state.crashed) return EVENT_NONE;
  let events = EVENT_NONE;
  state.brakes = input.brakes;

  // Throttle: W/S nudge the target, the lever follows at a believable spool rate.
  state.throttleTarget = Math.max(0, Math.min(1, state.throttleTarget + input.throttleDelta));
  const spool = state.throttle < state.throttleTarget ? 0.55 : 0.9;
  state.throttle += Math.max(-spool * dt, Math.min(spool * dt, state.throttleTarget - state.throttle));
  if (state.fuel <= 0) {
    if (state.throttle > 0) events |= EVENT_FUEL_EMPTY;
    state.throttle = 0;
    state.throttleTarget = 0;
  }

  // Speed chases what the throttle can hold, minus drag (flaps and gear cost speed).
  const stall = state.flaps ? PLANE.stallSpeed - 6 : PLANE.stallSpeed;
  let targetSpeed = state.throttle * PLANE.maxSpeed;
  if (!state.gearDown) targetSpeed *= 1.04;
  if (state.flaps) targetSpeed *= 0.88;
  if (state.brakes && state.onGround) targetSpeed = 0;
  state.speed += (targetSpeed - state.speed) * PLANE.accel * dt * (state.onGround ? 1.4 : 1);
  if (state.brakes && state.onGround) state.speed = Math.max(0, state.speed - 14 * dt);
  if (state.brakes && !state.onGround) state.speed = Math.max(0, state.speed - 3 * dt);

  // Attitude: pitch and roll answer the keys; the wing auto-levels gently when left alone.
  if (state.onGround) {
    state.pitch += input.pitch * PLANE.pitchRate * 0.4 * dt;
    state.pitch = Math.max(-0.05, Math.min(0.12, state.pitch));
    state.roll *= Math.max(0, 1 - 4 * dt);
    // Steering on the ground comes from the rudder.
    state.yaw += input.yaw * PLANE.yawRate * 0.9 * dt * Math.min(1, state.speed / 12 + 0.25);
  } else {
    state.pitch += input.pitch * PLANE.pitchRate * dt;
    state.pitch = Math.max(-PLANE.maxPitch, Math.min(PLANE.maxPitch, state.pitch));
    state.roll += input.roll * PLANE.rollRate * dt;
    state.roll = Math.max(-PLANE.maxRoll, Math.min(PLANE.maxRoll, state.roll));
    if (Math.abs(input.roll) < 0.05) state.roll *= Math.max(0, 1 - 0.55 * dt);
    // Banked turn: the nose follows the bank, the rudder trims it. A coordinated turn
    // turns at g·tan(bank)/speed, so a steep bank really does swing her around; the
    // factor keeps the little plane nimble enough for valley flying at cruise speed.
    const turn = Math.max(-0.9, Math.min(0.9, (Math.tan(state.roll) * G * 1.6) / Math.max(state.speed, 18)));
    state.yaw += (turn + input.yaw * PLANE.yawRate * 0.5) * dt;
    state.airborneTime += dt;
  }

  // Move along the nose.
  const fwd = forwardOf(state);
  const prevY = state.pos.y;
  state.pos.addScaledVector(fwd, state.speed * dt);
  // Below stall speed the wing gives up and she sinks.
  if (!state.onGround && state.speed < stall) {
    state.pos.y -= (stall - state.speed) * 0.55 * dt;
  }
  state.verticalSpeed = (state.pos.y - prevY) / dt;

  // Takeoff: enough speed and a pull on the stick lifts her off the strip.
  if (state.onGround && state.speed > PLANE.takeoffSpeed && state.pitch > 0.04) {
    state.onGround = false;
    state.landedStrip = null;
    state.landedReported = false;
  }
  if (state.onGround && state.speed > PLANE.takeoffSpeed + 8 && state.pitch > 0.0) {
    state.onGround = false;
    state.landedStrip = null;
    state.landedReported = false;
  }

  // Ground and water contact. A plane on the ground rides the terrain: its wheels stay
  // on the dirt even as the ground rises or falls under her, so she can never float.
  const ground = groundHeight(state.pos.x, state.pos.z);
  const clearance = state.pos.y - ground;
  if (state.onGround) {
    state.pos.y = ground + PLANE.gearHeight;
    const strip = stripAt(state.pos.x, state.pos.z);
    if (inLake(state.pos.x, state.pos.z) && !strip) {
      state.crashed = true;
      return EVENT_CRASH;
    }
    if (strip) {
      state.landedStrip = strip.name;
      if (state.speed < 10 && !state.landedReported) {
        state.landedReported = true;
        events |= EVENT_LANDED;
      }
    }
  } else if (clearance <= PLANE.gearHeight) {
    const strip = stripAt(state.pos.x, state.pos.z);
    const impact = -state.verticalSpeed;
    if (inLake(state.pos.x, state.pos.z) && !strip) {
      state.crashed = true;
      return EVENT_CRASH;
    }
    // Touchdown: judge it by sink rate and speed.
    if (impact > 7 || state.speed > 62) {
      state.damage += impact > 10 || state.speed > 70 ? 100 : 30;
      if (state.damage >= 100) {
        state.crashed = true;
        state.pos.y = ground + PLANE.gearHeight;
        return EVENT_CRASH;
      }
      state.pos.y = ground + PLANE.gearHeight;
      state.onGround = true;
      state.pitch = 0;
      state.roll = 0;
      state.speed *= 0.6;
      return EVENT_TOUCHDOWN;
    }
    if (!state.gearDown && strip) {
      state.damage += 25;
      if (state.damage >= 100) {
        state.crashed = true;
        return EVENT_CRASH;
      }
    }
    state.onGround = true;
    state.pos.y = ground + PLANE.gearHeight;
    state.pitch = 0;
    state.roll = 0;
    events |= EVENT_TOUCHDOWN;
    if (strip) {
      state.landedStrip = strip.name;
      if (state.speed < 10 && !state.landedReported) {
        state.landedReported = true;
        events |= EVENT_LANDED;
      }
    }
  }
  // Rolling off the strip into rough ground at speed hurts, but a bush plane can still
  // get airborne from a field — it costs airframe, it is not a death sentence.
  if (state.onGround && !stripAt(state.pos.x, state.pos.z) && state.speed > 22) {
    state.damage += 7 * dt;
    if (state.damage >= 100) {
      state.crashed = true;
      return EVENT_CRASH;
    }
  }
  // Hitting a mountainside while flying.
  if (!state.onGround && clearance < PLANE.gearHeight * 0.4 && state.speed > 12) {
    state.damage += 60;
    state.crashed = state.damage >= 100;
    state.pos.y = ground + PLANE.gearHeight;
    state.onGround = true;
    state.speed = 0;
    return state.crashed ? EVENT_CRASH : EVENT_TOUCHDOWN;
  }

  // Fuel burn: cruise sips, full throttle drinks.
  state.fuel = Math.max(0, state.fuel - (PLANE.fuelBurnBase + state.throttle * PLANE.fuelBurnThrottle) * dt);

  // World edge: turn back with a gentle nudge, never a wall.
  const half = 2050;
  if (Math.abs(state.pos.x) > half || Math.abs(state.pos.z) > half) {
    state.yaw += Math.PI * dt * 0.4;
    state.pos.x = Math.max(-half, Math.min(half, state.pos.x));
    state.pos.z = Math.max(-half, Math.min(half, state.pos.z));
  }
  return events;
}

/** Heading in degrees, 0 = north, from the current yaw. */
export function headingDegrees(state) {
  const deg = ((-state.yaw * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}
