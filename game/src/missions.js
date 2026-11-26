// The route: three legs, each a chain of glowing survey rings ending in a landing at
// the next strip. Rings pay points, a gentle landing on the destination strip pays the
// delivery and refuels the plane; the clock pays a bonus against each leg's par time.
import { RING_COUNT_PER_LEG, RING_RADIUS, SCORE, STRIPS } from './config.js';
import { groundHeight } from './terrain.js';
import { createRandom } from './random.js';

export const LEGS = [
  { from: STRIPS[0], to: STRIPS[1], name: 'Leg 1 of 3', brief: 'Pine Hollow to Lake Strip' },
  { from: STRIPS[1], to: STRIPS[2], name: 'Leg 2 of 3', brief: 'Lake Strip to Ridge Strip' },
  { from: STRIPS[2], to: STRIPS[0], name: 'Leg 3 of 3', brief: 'Ridge Strip home to Pine Hollow' },
];

/** Ring positions along a leg: a gentle S-curve between the strips, high over the valley. */
export function legRings(legIndex, seed) {
  const leg = LEGS[legIndex];
  const rng = createRandom(seed + legIndex * 331);
  const rings = [];
  for (let i = 1; i <= RING_COUNT_PER_LEG; i += 1) {
    const t = i / (RING_COUNT_PER_LEG + 1);
    const x = leg.from.x + (leg.to.x - leg.from.x) * t + (rng() - 0.5) * 260;
    const z = leg.from.z + (leg.to.z - leg.from.z) * t + (rng() - 0.5) * 260;
    const y = groundHeight(x, z) + 70 + rng() * 55;
    rings.push({ x, y, z, passed: false, index: i - 1 });
  }
  return rings;
}

export function createMission(seed) {
  return {
    seed,
    legIndex: 0,
    rings: legRings(0, seed),
    ringIndex: 0,
    score: 0,
    legStartTime: 0,
    elapsed: 0,
    legsDone: 0,
    complete: false,
  };
}

export function currentLeg(mission) {
  return LEGS[mission.legIndex];
}

export function nextRing(mission) {
  return mission.rings[mission.ringIndex] ?? null;
}

/** Check the next ring: within the hoop's radius while close to its plane counts as flown. */
export function checkRing(mission, pos) {
  const ring = nextRing(mission);
  if (!ring) return false;
  const d = Math.hypot(pos.x - ring.x, pos.y - ring.y, pos.z - ring.z);
  if (d < 15) {
    ring.passed = true;
    mission.ringIndex += 1;
    mission.score += SCORE.ring;
    return true;
  }
  // Flying through the hoop: the ring faces north/south, so crossing its z-plane inside
  // the hoop's circle counts even when the pass is not dead-centre.
  const side = Math.sign(pos.z - ring.z) || 1;
  if (ring.prevSide !== undefined && side !== ring.prevSide) {
    const inPlane = Math.hypot(pos.x - ring.x, pos.y - ring.y);
    if (inPlane < RING_RADIUS + 2) {
      ring.passed = true;
      mission.ringIndex += 1;
      mission.score += SCORE.ring;
      return true;
    }
  }
  ring.prevSide = side;
  return false;
}

export function ringsRemaining(mission) {
  return mission.rings.length - mission.ringIndex;
}

/**
 * Called when the plane comes to rest on a strip. Returns 'delivered' when the leg is
 * done, 'wrong-strip' when it landed somewhere else, or null when still rolling.
 */
export function checkLanding(mission, stripName, elapsed) {
  const leg = currentLeg(mission);
  if (stripName !== leg.to.name) return 'wrong-strip';
  if (ringsRemaining(mission) > 0) return 'early';
  const legTime = elapsed - mission.legStartTime;
  const bonus = Math.max(0, Math.round((SCORE.legParSeconds - legTime) * SCORE.timeBonusPerSecond));
  mission.score += SCORE.legDelivery + bonus;
  mission.legsDone += 1;
  mission.legIndex += 1;
  if (mission.legIndex >= LEGS.length) {
    mission.complete = true;
    mission.score += SCORE.missionBonus;
    return 'mission-complete';
  }
  mission.rings = legRings(mission.legIndex, mission.seed);
  mission.ringIndex = 0;
  mission.legStartTime = elapsed;
  return 'delivered';
}
