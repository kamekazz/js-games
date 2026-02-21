import { World } from './ecs/World.js';
import { InputManager } from './input/InputManager.js';
import { Renderer } from './rendering/Renderer.js';
import { CameraController } from './rendering/Camera.js';

export class Engine {
  constructor(container) {
    this.renderer = new Renderer(container);
    this.cameraController = new CameraController(this.renderer.camera);
    this.input = new InputManager(this.renderer);
    this.world = new World();
    this._running = false;
    this._lastTime = 0;
  }

  start() {
    this._running = true;
    this._lastTime = performance.now();
    this._loop();
  }

  stop() {
    this._running = false;
  }

  _loop() {
    if (!this._running) return;

    requestAnimationFrame(() => this._loop());

    const now = performance.now();
    const dt = Math.min((now - this._lastTime) / 1000, 0.1); // cap at 100ms
    this._lastTime = now;

    this.input.tick();
    this.world.update(dt);
    this.renderer.render();
  }
}
