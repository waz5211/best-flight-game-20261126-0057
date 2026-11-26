// Keyboard and mouse: held keys are polled every frame, single presses come back as
// actions the game loop consumes once. Mouse drag orbits the chase camera.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_FLAPS = 8;
export const ACTION_GEAR = 16;
export const ACTION_SOUND = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookX = 0;
  let lookY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyF') actions |= ACTION_FLAPS;
    if (event.code === 'KeyG') actions |= ACTION_GEAR;
    if (event.code === 'KeyM') actions |= ACTION_SOUND;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerMove(event) {
    if (!dragging) return;
    lookX += (event.clientX - lastX) * 0.004;
    lookY += (event.clientY - lastY) * 0.004;
    lookY = Math.max(-0.5, Math.min(0.6, lookY));
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerUp() {
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    /** Analogue flight inputs for this frame, -1..1 each. */
    flight() {
      const pitch = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
      const roll = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
      const yaw = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
      const throttleDelta = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      return {
        pitch,
        roll,
        yaw,
        throttleDelta: throttleDelta * 0.55 * (1 / 60),
        brakes: keys.has('KeyB'),
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeLook() {
      const look = { x: lookX, y: lookY };
      lookX *= 0.86;
      lookY *= 0.86;
      return look;
    },
  };
}
