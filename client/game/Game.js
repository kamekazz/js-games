import { isTouchDevice } from '@engine/input/DeviceDetector.js';
import { TileRenderer } from '@engine/rendering/TileRenderer.js';
import { VirtualJoystick } from '@ui/VirtualJoystick.js';
import { InputSystem } from './systems/InputSystem.js';
import { AimSystem } from './systems/AimSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CameraFollowSystem } from './systems/CameraFollowSystem.js';
import { RenderSyncSystem } from './systems/RenderSyncSystem.js';
import { NetworkSyncSystem } from './systems/NetworkSyncSystem.js';
import { createPlayer } from './entities/PlayerFactory.js';
import { MeshRef } from './components/MeshRef.js';
import { WORLD_SIZE, TILE_SIZE } from '@shared/constants.js';

export class Game {
  constructor(engine, networkClient, stateBuffer, localPlayerId) {
    this.engine = engine;
    this.networkClient = networkClient;
    this.stateBuffer = stateBuffer;
    this.localPlayerId = localPlayerId;
    this._joysticks = [];
    this._sceneObjects = [];
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
    const obj = tileRenderer.getObject3D();
    this.engine.renderer.add(obj);
    this._sceneObjects.push(obj);
  }

  _registerSystems() {
    const { world, input, cameraController, renderer } = this.engine;

    this._networkSync = new NetworkSyncSystem(
      this.networkClient, this.stateBuffer, renderer, input
    );
    this._networkSync.localPlayerId = this.localPlayerId;

    world.addSystem(new InputSystem(input));
    world.addSystem(new AimSystem(input));
    world.addSystem(new MovementSystem());
    world.addSystem(new CameraFollowSystem(cameraController));
    world.addSystem(this._networkSync);
    world.addSystem(new RenderSyncSystem());
  }

  _spawnPlayer() {
    const player = createPlayer(0, 0, true);
    this.engine.world.addEntity(player);
    const mesh = player.get(MeshRef).mesh;
    this.engine.renderer.add(mesh);
    this._sceneObjects.push(mesh);
    this.playerEntity = player;
  }

  _setupJoysticks() {
    const leftZone = document.getElementById('joystick-zone-left');
    if (leftZone) {
      const js = new VirtualJoystick(leftZone, (x, y) => {
        this.engine.input.setJoystickMove(x, y);
      });
      this._joysticks.push(js);
    }

    const rightZone = document.getElementById('joystick-zone-right');
    if (rightZone) {
      const js = new VirtualJoystick(rightZone, (x, y) => {
        this.engine.input.setJoystickAim(x, y);
      });
      this._joysticks.push(js);
    }
  }

  destroy() {
    // Remove joysticks
    for (const js of this._joysticks) js.destroy();
    this._joysticks = [];

    // Remove scene objects
    for (const obj of this._sceneObjects) {
      this.engine.renderer.remove(obj);
    }
    this._sceneObjects = [];

    // Clear ECS
    this.engine.world.entities.clear();
    this.engine.world.systems.length = 0;
  }
}
