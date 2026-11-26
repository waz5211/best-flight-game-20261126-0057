// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer and HUD paint what is there. The game moves between five
// screens: title, play, paused, crash and route complete.
//
// ?seed=N fixes the valley layout. ?shot=start|play|ring|landing (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const hud = createHud();
const audio = createAudio();
const renderer = createRenderer(canvas);
const world = createWorld(seed, hud, audio, renderer);

const screens = {
  [SCREEN_TITLE]: document.getElementById('screen-title'),
  [SCREEN_PAUSED]: document.getElementById('screen-pause'),
  [SCREEN_OVER]: document.getElementById('screen-over'),
  [SCREEN_WIN]: document.getElementById('screen-win'),
};

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
  if (name === SCREEN_OVER) {
    document.getElementById('over-title').textContent = 'Crashed';
    document.getElementById('over-text').textContent = world.overReason;
    document.getElementById('over-score').textContent =
      `Score ${world.mission.score.toLocaleString('en-US')} · ${world.mission.legsDone} leg${world.mission.legsDone === 1 ? '' : 's'} delivered · ${Math.floor(world.mission.elapsed / 60)}:${String(Math.floor(world.mission.elapsed % 60)).padStart(2, '0')}`;
  }
  if (name === SCREEN_WIN) {
    document.getElementById('win-text').textContent =
      'Three legs, every ring, three gentle landings — the mail is through and the valley has a new favourite pilot.';
    document.getElementById('win-score').textContent =
      `Final score ${world.mission.score.toLocaleString('en-US')} · ${Math.floor(world.mission.elapsed / 60)}:${String(Math.floor(world.mission.elapsed % 60)).padStart(2, '0')}`;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  world.screen = scene.screen;
  showScreen(null);
  renderer.snapCamera();
  let painted = 0;
  function paint() {
    hud.draw(world.state, world.mission);
    renderer.draw(world.state, world.mission, performance.now() / 1000);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let time = 0;

  showScreen(SCREEN_TITLE);
  hud.announce('Ridge Runner. Press Space or click Start flying.');

  function setScreen(next) {
    screen = next;
    world.screen = next;
    showScreen(next);
  }

  document.getElementById('btn-start').addEventListener('click', () => {
    audio.start();
    world.startGame();
    setScreen(SCREEN_PLAY);
  });
  document.getElementById('btn-how').addEventListener('click', () => {
    document.getElementById('how').classList.toggle('hidden');
  });
  document.getElementById('btn-resume').addEventListener('click', () => setScreen(SCREEN_PLAY));
  for (const id of ['btn-restart-pause', 'btn-restart-over', 'btn-restart-win']) {
    document.getElementById(id).addEventListener('click', () => {
      world.startGame();
      setScreen(SCREEN_PLAY);
    });
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) {
        audio.start();
        world.startGame();
        setScreen(SCREEN_PLAY);
      } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
        world.startGame();
        setScreen(SCREEN_PLAY);
      } else if (screen === SCREEN_PAUSED) {
        setScreen(SCREEN_PLAY);
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) setScreen(SCREEN_PAUSED);
      else if (screen === SCREEN_PAUSED) setScreen(SCREEN_PLAY);
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      world.startGame();
      setScreen(SCREEN_PLAY);
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY || screen === SCREEN_TITLE) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_PLAY || screen === SCREEN_TITLE)) {
        if (screen === SCREEN_PLAY) {
          world.step(STEP, input.flight(), firstStep ? actions : 0);
        } else {
          world.step(STEP, { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brakes: false }, 0);
        }
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    time += 1 / 60;
    renderer.setLook(input.takeLook());
    renderer.draw(world.state, world.mission, time);
    hud.draw(world.state, world.mission);
    if (world.screen === SCREEN_OVER && screen === SCREEN_PLAY) setScreen(SCREEN_OVER);
    if (world.screen === SCREEN_WIN && screen === SCREEN_PLAY) setScreen(SCREEN_WIN);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) setScreen(SCREEN_PAUSED);
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
