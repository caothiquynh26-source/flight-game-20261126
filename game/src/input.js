// Input: keyboard and mouse, merged into one control vector each tick.
// Arrow keys / WASD fly the plane, Shift/Ctrl (or W/S) work the throttle,
// the mouse steers like a stick when it moves, C swaps the camera, P pauses.
export function newInput() {
  return {
    keys: new Set(),
    mouseX: 0, mouseY: 0, mouseActive: false, mouseTime: -99,
    wheel: 0, // throttle delta from the wheel, consumed each tick
    pressed: new Set(), // keys pressed since the last tick (edge-triggered)
  };
}

export function bindInput(input, element) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  element.addEventListener('pointermove', (e) => {
    const rect = element.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    input.mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    input.mouseActive = true;
    input.mouseTime = performance.now() / 1000;
  });
  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.wheel += e.deltaY < 0 ? 0.12 : -0.12;
  }, { passive: false });
  element.addEventListener('pointerleave', () => { input.mouseActive = false; });
}

/** Consume one tick's controls. Returns { pitch, roll, throttle, brake } in [-1, 1]. */
export function readControls(input, now) {
  const k = input.keys;
  let pitch = 0, roll = 0;
  // Keyboard: up arrow / W pulls the nose up; left / A banks left.
  if (k.has('ArrowUp') || k.has('KeyW')) pitch += 1;
  if (k.has('ArrowDown') || k.has('KeyS')) pitch -= 1;
  if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
  // Mouse stick: recent movement steers, blended under the keyboard.
  const mouseFresh = input.mouseActive && now - input.mouseTime < 2.5;
  if (mouseFresh && pitch === 0 && roll === 0) {
    pitch = clamp(-input.mouseY * 2.4, -1, 1);
    roll = clamp(input.mouseX * 2.4, -1, 1);
  }
  let throttle = input.wheel;
  input.wheel = 0;
  if (k.has('ShiftLeft') || k.has('ShiftRight')) throttle += 1;
  if (k.has('ControlLeft') || k.has('ControlRight')) throttle -= 1;
  // B is the airbrake: hold it to bleed speed for the landing.
  const brake = k.has('KeyB') ? 1 : 0;
  return { pitch: clamp(pitch, -1, 1), roll: clamp(roll, -1, 1), throttle: clamp(throttle, -1, 1), brake };
}

/** Clear held keys and edges: call on restart so a stuck key cannot carry over. */
export function resetInput(input) {
  input.keys.clear();
  input.pressed.clear();
  input.wheel = 0;
  input.mouseActive = false;
}

/** True once for a key pressed since the last tick (C, P, R, Enter, Space). */
export function wasPressed(input, code) {
  if (input.pressed.has(code)) { input.pressed.delete(code); return true; }
  return false;
}

export function endTick(input) {
  input.pressed.clear();
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
