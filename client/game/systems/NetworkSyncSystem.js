import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { Entity } from '@engine/ecs/Entity.js';
import { Position } from '../components/Position.js';
import { Rotation } from '../components/Rotation.js';
import { MeshRef } from '../components/MeshRef.js';
import { NetworkId } from '../components/NetworkId.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Velocity } from '../components/Velocity.js';
import { Health } from '../components/Health.js';
import { Weapon } from '../components/Weapon.js';

export class NetworkSyncSystem extends System {
  constructor(networkClient, stateBuffer, renderer, inputManager) {
    super(95);
    this.networkClient = networkClient;
    this.stateBuffer = stateBuffer;
    this.renderer = renderer;
    this.inputManager = inputManager;
    this.localPlayerId = null;
    this.projectileSystem = null;  // set by Game.js
    this.enemyRenderSystem = null; // set by Game.js
    this.itemRenderSystem = null;  // set by Game.js
    this.scoreboard = null;        // set by Game.js
    this.hud = null;               // set by Game.js
    this.onGameOver = null;        // callback set by Game.js
    this._sendInterval = 1000 / 20;
    this._lastSendTime = 0;
    this._serverTimeOffset = 0;
    this._remoteEntities = new Map();
    this._latestState = null;
    this._latestEvents = [];
  }

  init(world) {
    super.init(world);

    this.networkClient.on('game_state', (data) => {
      const serverTime = data.t * 1000;
      if (this._serverTimeOffset === 0) {
        this._serverTimeOffset = serverTime - performance.now();
      }
      this.stateBuffer.push(serverTime, data.state);
      this._latestState = data.state;
      this._latestEvents = data.state.events || [];
    });
  }

  update(dt) {
    this._sendInput();
    this._applyServerState();
    this._processEvents();
    this._updateProjectiles();
    this._updateZombies();
    this._updateItems();
    this._updateScoreboard();
    this._updateLocalFromServer();
  }

  _sendInput() {
    const now = performance.now();
    if (now - this._lastSendTime < this._sendInterval) return;
    this._lastSendTime = now;

    if (!this.networkClient.connected || !this.localPlayerId) return;

    const input = this.inputManager.getState();
    let angle = 0;
    const locals = this.world.query(PlayerControlled, Rotation);
    for (const e of locals) {
      if (e.get(PlayerControlled).isLocal) {
        angle = e.get(Rotation).angle;
        break;
      }
    }

    this.networkClient.send({
      type: 'player_move',
      mx: input.moveX,
      my: input.moveY,
      angle,
    });
  }

  _applyServerState() {
    const renderTime = performance.now() + this._serverTimeOffset;
    const state = this.stateBuffer.getInterpolatedState(renderTime);
    if (!state) return;

    const seen = new Set();

    for (const playerData of state.players) {
      seen.add(playerData.id);
      if (playerData.id === this.localPlayerId) continue;

      const entityId = this._remoteEntities.get(playerData.id);
      let entity = entityId != null ? this.world.getEntity(entityId) : null;

      if (!entity) {
        entity = this._createRemotePlayer(playerData);
        this._remoteEntities.set(playerData.id, entity.id);
      }

      const pos = entity.get(Position);
      pos.x = playerData.x;
      pos.y = playerData.y;

      const rot = entity.get(Rotation);
      rot.angle = playerData.angle;

      // Toggle visibility based on alive status
      const mesh = entity.get(MeshRef).mesh;
      mesh.visible = playerData.alive !== false;
    }

    for (const [netId, entityId] of this._remoteEntities) {
      if (!seen.has(netId)) {
        const entity = this.world.getEntity(entityId);
        if (entity) {
          const meshRef = entity.get(MeshRef);
          if (meshRef) this.renderer.remove(meshRef.mesh);
          this.world.removeEntity(entityId);
        }
        this._remoteEntities.delete(netId);
      }
    }
  }

  _updateLocalFromServer() {
    if (!this._latestState) return;

    // Sync health/ammo from server for local player
    for (const pd of this._latestState.players) {
      if (pd.id !== this.localPlayerId) continue;

      const locals = this.world.query(PlayerControlled, Health, Weapon);
      for (const e of locals) {
        if (!e.get(PlayerControlled).isLocal) continue;

        // Reconcile position with server (smooth correction)
        const pos = e.get(Position);
        const dx = pd.x - pos.x;
        const dy = pd.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          // Teleport if too far off
          pos.x = pd.x;
          pos.y = pd.y;
        } else if (dist > 0.1) {
          // Smooth correction
          pos.x += dx * 0.3;
          pos.y += dy * 0.3;
        }

        const health = e.get(Health);
        health.current = pd.hp;
        health.alive = pd.alive;

        const weapon = e.get(Weapon);
        weapon.ammo = pd.ammo;
        weapon.maxAmmo = pd.maxAmmo;
        weapon.reloading = pd.reloading;

        // Toggle mesh visibility
        const mesh = e.get(MeshRef).mesh;
        mesh.visible = pd.alive;

        // Update HUD
        if (this.hud) {
          this.hud.updateHealth(pd.hp, 100);
          this.hud.updateAmmo(pd.ammo, pd.maxAmmo, pd.reloading);
        }
      }
      break;
    }
  }

  _processEvents() {
    if (!this.hud) return;
    for (const evt of this._latestEvents) {
      if (evt.type === 'kill') {
        const killer = evt.by === 'zombie' ? 'Zombie' : this._findPlayerName(evt.by);
        const victim = this._findPlayerName(evt.pid);
        if (evt.pid === this.localPlayerId) {
          this.hud.showDeath();
        } else {
          this.hud.showKill(killer, victim);
        }
      } else if (evt.type === 'wave_start') {
        this.hud.showWave(evt.wave);
      } else if (evt.type === 'zombie_kill' && evt.by === this.localPlayerId) {
        this.hud.addKill();
      } else if (evt.type === 'item_pickup' && evt.pid === this.localPlayerId) {
        this.hud.showPickup(evt.item);
      } else if (evt.type === 'game_over') {
        if (this.onGameOver) this.onGameOver(evt);
      }
    }

    // Update wave info and score from state
    if (this._latestState) {
      this.hud.updateWave(this._latestState.wave || 0, this._latestState.waveActive || false);
      // Find local player score
      const local = this._latestState.players.find(p => p.id === this.localPlayerId);
      if (local) {
        this.hud.updateScore(local.score || 0);
      }
    }

    this._latestEvents = [];
  }

  _findPlayerName(pid) {
    if (!this._latestState) return 'Player';
    const p = this._latestState.players.find(p => p.id === pid);
    return p ? p.name : 'Player';
  }

  _updateProjectiles() {
    if (this.projectileSystem && this._latestState && this._latestState.projectiles) {
      this.projectileSystem.setProjectiles(this._latestState.projectiles);
    }
  }

  _updateZombies() {
    if (this.enemyRenderSystem && this._latestState && this._latestState.zombies) {
      this.enemyRenderSystem.setZombies(this._latestState.zombies);
    }
  }

  _updateItems() {
    if (this.itemRenderSystem && this._latestState && this._latestState.items) {
      this.itemRenderSystem.setItems(this._latestState.items);
    }
  }

  _updateScoreboard() {
    if (this.scoreboard && this._latestState && this._latestState.players) {
      this.scoreboard.update(this._latestState.players);
    }
  }

  _createRemotePlayer(playerData) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xff4444 })
    );
    body.position.y = 0.6;
    group.add(body);

    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xff8888 })
    );
    nose.position.set(0, 0.6, -0.8);
    group.add(nose);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(playerData.name || 'Player', 128, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 2.2, 0);
    sprite.scale.set(4, 1, 1);
    group.add(sprite);

    this.renderer.add(group);

    const entity = new Entity();
    entity.add(new Position(playerData.x, playerData.y));
    entity.add(new Rotation(playerData.angle));
    entity.add(new MeshRef(group));
    entity.add(new NetworkId(playerData.id));
    entity.add(new Velocity(0, 0, 0));

    this.world.addEntity(entity);
    return entity;
  }
}
