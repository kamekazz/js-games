import { isTouchDevice } from '@engine/input/DeviceDetector.js';
import { TileRenderer } from '@engine/rendering/TileRenderer.js';
import { VirtualJoystick } from '@ui/VirtualJoystick.js';
import { ActionButton } from '@ui/ActionButton.js';
import { HUD } from '@ui/HUD.js';
import { PauseMenu } from '@ui/PauseMenu.js';
import { InputSystem } from './systems/InputSystem.js';
import { AimSystem } from './systems/AimSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CameraFollowSystem } from './systems/CameraFollowSystem.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { EnemyRenderSystem } from './systems/EnemyRenderSystem.js';
import { ItemRenderSystem } from './systems/ItemRenderSystem.js';
import { NetworkSyncSystem } from './systems/NetworkSyncSystem.js';
import { RenderSyncSystem } from './systems/RenderSyncSystem.js';
import { Scoreboard } from '@ui/Scoreboard.js';
import { createPlayer } from './entities/PlayerFactory.js';
import { MeshRef } from './components/MeshRef.js';
import { WORLD_SIZE, TILE_SIZE } from '@shared/constants.js';

export class Game {
  constructor(engine, networkClient, stateBuffer, localPlayerId, spawnX = 0, spawnY = 0, onGameOver = null) {
    this.engine = engine;
    this.networkClient = networkClient;
    this.stateBuffer = stateBuffer;
    this.localPlayerId = localPlayerId;
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.onGameOver = onGameOver;
    this.onLeave = null; // set externally
    this._joysticks = [];
    this._buttons = [];
    this._sceneObjects = [];
    this.hud = null;
    this._scoreboard = null;
    this._pauseMenu = null;
    this._setup();
  }

  _setup() {
    this._createGround();
    this._registerSystems();
    this._spawnPlayer();
    this._createHUD();

    if (isTouchDevice()) {
      this._setupJoysticks();
      this._setupActionButtons();
    }
  }

  _createGround() {
    const tileRenderer = new TileRenderer(WORLD_SIZE, TILE_SIZE);
    const obj = tileRenderer.getObject3D();
    this.engine.renderer.add(obj);
    this._sceneObjects.push(obj);
  }

  _createHUD() {
    const overlay = document.getElementById('ui-overlay');
    this.hud = new HUD(overlay);
    this._networkSync.hud = this.hud;

    this._scoreboard = new Scoreboard();
    this._networkSync.scoreboard = this._scoreboard;

    this._pauseMenu = new PauseMenu(() => {
      if (this.onLeave) this.onLeave();
    });
  }

  _registerSystems() {
    const { world, input, cameraController, renderer } = this.engine;

    this._networkSync = new NetworkSyncSystem(
      this.networkClient, this.stateBuffer, renderer, input
    );
    this._networkSync.localPlayerId = this.localPlayerId;

    this._projectileSystem = new ProjectileSystem(renderer);
    this._networkSync.projectileSystem = this._projectileSystem;

    this._enemyRenderSystem = new EnemyRenderSystem(renderer);
    this._networkSync.enemyRenderSystem = this._enemyRenderSystem;

    this._itemRenderSystem = new ItemRenderSystem(renderer);
    this._networkSync.itemRenderSystem = this._itemRenderSystem;

    this._networkSync.onGameOver = (data) => {
      if (this.onGameOver) this.onGameOver(data);
    };

    this._weaponSystem = new WeaponSystem(input, this.networkClient);

    world.addSystem(new InputSystem(input));
    world.addSystem(new AimSystem(input));
    world.addSystem(new MovementSystem());
    world.addSystem(this._weaponSystem);
    world.addSystem(new CameraFollowSystem(cameraController));
    world.addSystem(this._networkSync);
    world.addSystem(this._projectileSystem);
    world.addSystem(this._enemyRenderSystem);
    world.addSystem(this._itemRenderSystem);
    world.addSystem(new RenderSyncSystem());
  }

  _spawnPlayer() {
    const player = createPlayer(this.spawnX, this.spawnY, true);
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

  _setupActionButtons() {
    const container = document.getElementById('action-buttons');
    if (!container) return;

    const reloadBtn = new ActionButton(container, {
      label: 'R',
      size: 50,
      color: 'rgba(68,136,255,0.5)',
      onPress: () => this._weaponSystem.requestReload(),
    });
    this._buttons.push(reloadBtn);
  }

  destroy() {
    for (const js of this._joysticks) js.destroy();
    this._joysticks = [];
    for (const btn of this._buttons) btn.destroy();
    this._buttons = [];
    if (this.hud) { this.hud.destroy(); this.hud = null; }
    if (this._scoreboard) { this._scoreboard.destroy(); this._scoreboard = null; }
    if (this._pauseMenu) { this._pauseMenu.destroy(); this._pauseMenu = null; }

    // Clean up projectile meshes
    for (const [, mesh] of this._projectileSystem.meshes) {
      this.engine.renderer.remove(mesh);
    }

    // Clean up zombie meshes
    for (const [, entry] of this._enemyRenderSystem.meshes) {
      this.engine.renderer.remove(entry.group);
    }

    // Clean up item meshes
    for (const [, mesh] of this._itemRenderSystem.meshes) {
      this.engine.renderer.remove(mesh);
    }

    for (const obj of this._sceneObjects) {
      this.engine.renderer.remove(obj);
    }
    this._sceneObjects = [];

    this.engine.world.entities.clear();
    this.engine.world.systems.length = 0;
  }
}
