export class InputManager {
  constructor(renderer) {
    this.renderer = renderer; // needed for mouse→world conversion
    this.state = {
      moveX: 0,
      moveY: 0,
      aimX: 0,
      aimY: 0,
      actions: {},
    };

    this._keys = new Set();
    this._joystickMove = { x: 0, y: 0 };
    this._joystickAim = { x: 0, y: 0 };
    this._mouseAim = { x: 0, y: 0 };
    this._mouseActive = false;

    this._bindKeyboard();
    this._bindMouse();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this._keys.clear();
    });
  }

  _bindMouse() {
    window.addEventListener('mousemove', (e) => {
      // Convert screen coords to normalized -1..1 relative to center
      this._mouseAim.x = (e.clientX / window.innerWidth) * 2 - 1;
      this._mouseAim.y = -((e.clientY / window.innerHeight) * 2 - 1); // flip Y: screen-down is negative
      this._mouseActive = true;
    });
  }

  setJoystickMove(x, y) {
    this._joystickMove.x = x;
    this._joystickMove.y = y;
  }

  setJoystickAim(x, y) {
    this._joystickAim.x = x;
    this._joystickAim.y = y;
  }

  setAction(name, active) {
    this.state.actions[name] = active;
  }

  getState() {
    // Always read keyboard
    let mx = 0, my = 0;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) my += 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) my -= 1;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) mx -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) mx += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(mx * mx + my * my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }

    // Combine: joystick overrides keyboard if active
    if (this._joystickMove.x !== 0 || this._joystickMove.y !== 0) {
      this.state.moveX = this._joystickMove.x;
      this.state.moveY = this._joystickMove.y;
    } else {
      this.state.moveX = mx;
      this.state.moveY = my;
    }

    // Aim: joystick > mouse
    if (this._joystickAim.x !== 0 || this._joystickAim.y !== 0) {
      this.state.aimX = this._joystickAim.x;
      this.state.aimY = this._joystickAim.y;
    } else if (this._mouseActive) {
      this.state.aimX = this._mouseAim.x;
      this.state.aimY = this._mouseAim.y;
    }

    return this.state;
  }

  destroy() {
    // Listeners are on window, can't easily remove anonymous. Fine for single-instance usage.
  }
}
