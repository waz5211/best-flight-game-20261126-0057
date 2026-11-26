// The game itself: screens (title, play, pause, crash, route complete), the fixed-step
// loop glue, and what each physics event means for the mission — rings, deliveries,
// fuel warnings, crashes and the win.
import {
  ACTION_FLAPS, ACTION_GEAR, ACTION_SOUND,
} from './input.js';
import {
  createPlaneState, stepPlane, EVENT_TOUCHDOWN, EVENT_CRASH, EVENT_LANDED, EVENT_FUEL_EMPTY,
} from './physics.js';
import {
  createMission, currentLeg, checkRing, checkLanding, ringsRemaining,
} from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createWorld(seed, hud, audio, renderer) {
  const world = {
    seed,
    screen: SCREEN_TITLE,
    state: null,
    mission: null,
    overReason: '',
    fuelWarned: false,
    best: 0,
  };

  function reset(newSeed) {
    world.seed = newSeed;
    world.mission = createMission(newSeed);
    world.state = createPlaneState(currentLeg(world.mission).from);
    world.fuelWarned = false;
    world.overReason = '';
    renderer.setRings(world.mission.rings);
  }

  reset(seed);

  function startGame() {
    reset(Math.floor(Math.random() * 4294967296));
    world.screen = SCREEN_PLAY;
    hud.announce('Playing. Take off from Pine Hollow, fly the rings, land at Lake Strip.');
    hud.flash('Leg 1 — take off and fly the rings<small>Full throttle with W, pull back with ↑ past 60 kt</small>', 4);
  }

  function endGame(reason) {
    world.screen = SCREEN_OVER;
    world.overReason = reason;
    audio.crash();
    hud.announce(`Crashed. ${reason}`);
  }

  function winGame() {
    world.screen = SCREEN_WIN;
    audio.win();
    hud.announce('Route complete.');
  }

  function step(dt, input, actionBits) {
    const state = world.state;
    const mission = world.mission;

    if (world.screen !== SCREEN_PLAY) return;

    if (actionBits & ACTION_FLAPS) {
      state.flaps = !state.flaps;
      hud.flash(state.flaps ? 'Flaps down<small>Slower stall, more drag</small>' : 'Flaps up', 1.2);
    }
    if (actionBits & ACTION_GEAR) {
      state.gearDown = !state.gearDown;
      hud.flash(state.gearDown ? 'Gear down' : 'Gear up<small>Remember to lower it before landing</small>', 1.5);
    }
    if (actionBits & ACTION_SOUND) audio.toggleMute();

    mission.elapsed += dt;
    const events = stepPlane(state, input, dt);

    if (events & EVENT_FUEL_EMPTY && !world.fuelWarned) {
      world.fuelWarned = true;
      hud.flash('Fuel empty — dead stick!<small>Glide her to a strip</small>', 4);
    }
    if (checkRing(mission, state.pos)) {
      audio.ring();
      const left = ringsRemaining(mission);
      hud.flash(left > 0
        ? `Ring ${mission.ringIndex} of ${mission.rings.length} — +100<small>${left} ring${left === 1 ? '' : 's'} to go</small>`
        : 'All rings flown — land at the strip!<small>Put her down gently on the runway</small>', 2.5);
    }
    if (events & EVENT_TOUCHDOWN) {
      audio.touchdown();
      if (state.damage > 0) {
        hud.flash(`Touchdown — airframe ${Math.round(state.damage)}% worn<small>Landings on a strip patch her up</small>`, 2);
      }
    }
    if (events & EVENT_LANDED) {
      const leg = currentLeg(mission);
      const result = checkLanding(mission, state.landedStrip, mission.elapsed);
      if (result === 'delivered') {
        audio.win();
        state.fuel = 100;
        state.damage = Math.max(0, state.damage - 50);
        renderer.setRings(mission.rings);
        const next = currentLeg(mission);
        hud.flash(`Delivered! +500<small>Refuelled and patched — next: ${next.brief}</small>`, 4);
        hud.announce(`Leg delivered. Next: ${next.brief}.`);
      } else if (result === 'mission-complete') {
        state.fuel = 100;
        state.damage = 0;
        winGame();
      } else if (result === 'early') {
        hud.flash(`Too soon — ${ringsRemaining(mission)} ring${ringsRemaining(mission) === 1 ? '' : 's'} left<small>Take off again and fly them first</small>`, 3.5);
      } else if (result === 'wrong-strip') {
        hud.flash(`Wrong strip — the mail goes to ${leg.to.name}<small>Take off again and follow the beacon</small>`, 3.5);
      }
    }
    if (events & EVENT_CRASH) {
      const reason = state.fuel <= 0
        ? 'Out of fuel, she came down short of the strip.'
        : state.damage >= 100
          ? 'The old airframe finally gave out.'
          : 'She hit the ground hard.';
      endGame(reason);
      return;
    }
    if (mission.complete) winGame();
    audio.update(state.throttle, state.speed, !state.onGround);
  }

  return {
    get screen() { return world.screen; },
    set screen(value) { world.screen = value; },
    get state() { return world.state; },
    get mission() { return world.mission; },
    get overReason() { return world.overReason; },
    startGame,
    step,
    resetToTitle() {
      reset(world.seed);
      world.screen = SCREEN_TITLE;
    },
  };
}
