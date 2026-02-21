import { isTouchDevice } from '@engine/input/DeviceDetector.js';
import { TileRenderer } from '@engine/rendering/TileRenderer.js';
import { VirtualJoystick } from '@ui/VirtualJoystick.js';
import { InputSystem } from './systems/InputSystem.js';
import { AimSystem } from './systems/AimSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CameraFollowSystem } from './systems/CameraFollowSystem.js';
import { RenderSyncSystem } from './systems/RenderSyncSystem.js';
import { createPlayer } from './entities/PlayerFactory.js';
import { MeshRef } from './components/MeshRef.js';
import { WORLD_SIZE, TILE_SIZE } from '@shared/constants.js';

export class Game {
  constructor(engine) {
    this.engine = engine;
    this._setup();
  }

  _setup() {
    this._createGround();
    this._registerSystems();
    this._spawnPlayer();

    if (isTouchDevice()) {
      this._setupJoysticks();
    }
  }

  _createGround() {
    const tileRenderer = new TileRenderer(WORLD_SIZE, TILE_SIZE);
    this.engine.renderer.add(tileRenderer.getObject3D());
  }

  _registerSystems() {
    const { world, input, cameraController } = this.engine;
    world.addSystem(new InputSystem(input));
    world.addSystem(new AimSystem(input));
    world.addSystem(new MovementSystem());
    world.addSystem(new CameraFollowSystem(cameraController));
    world.addSystem(new RenderSyncSystem());
  }

  _spawnPlayer() {
    const player = createPlayer(0, 0, true);
    this.engine.world.addEntity(player);
    this.engine.renderer.add(player.get(MeshRef).mesh);
    this.playerEntity = player;
  }

  _setupJoysticks() {
    const leftZone = document.getElementById('joystick-zone-left');
    if (leftZone) {
      this.moveJoystick = new VirtualJoystick(leftZone, (x, y) => {
        this.engine.input.setJoystickMove(x, y);
      });
    }

    const rightZone = document.getElementById('joystick-zone-right');
    if (rightZone) {
      this.aimJoystick = new VirtualJoystick(rightZone, (x, y) => {
        this.engine.input.setJoystickAim(x, y);
      });
    }
  }
}
