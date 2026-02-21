import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { Entity } from '@engine/ecs/Entity.js';
import { Position } from '../components/Position.js';
import { Rotation } from '../components/Rotation.js';
import { MeshRef } from '../components/MeshRef.js';
import { NetworkId } from '../components/NetworkId.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Velocity } from '../components/Velocity.js';

export class NetworkSyncSystem extends System {
  constructor(networkClient, stateBuffer, renderer, inputManager) {
    super(95); // after camera, before render sync
    this.networkClient = networkClient;
    this.stateBuffer = stateBuffer;
    this.renderer = renderer;
    this.inputManager = inputManager;
    this.localPlayerId = null;
    this._sendInterval = 1000 / 20; // 20Hz
    this._lastSendTime = 0;
    this._serverTimeOffset = 0;
    this._remoteEntities = new Map(); // networkId -> entityId
  }

  init(world) {
    super.init(world);

    this.networkClient.on('game_state', (data) => {
      const serverTime = data.t * 1000; // convert to ms
      if (this._serverTimeOffset === 0) {
        this._serverTimeOffset = serverTime - performance.now();
      }
      this.stateBuffer.push(serverTime, data.state);
    });
  }

  update(dt) {
    this._sendInput();
    this._applyServerState();
  }

  _sendInput() {
    const now = performance.now();
    if (now - this._lastSendTime < this._sendInterval) return;
    this._lastSendTime = now;

    if (!this.networkClient.connected || !this.localPlayerId) return;

    const input = this.inputManager.getState();

    // Find local player's rotation
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

      // Skip local player — they use client-side prediction
      if (playerData.id === this.localPlayerId) continue;

      const entityId = this._remoteEntities.get(playerData.id);
      let entity = entityId != null ? this.world.getEntity(entityId) : null;

      if (!entity) {
        entity = this._createRemotePlayer(playerData);
        this._remoteEntities.set(playerData.id, entity.id);
      }

      // Update position/rotation from server
      const pos = entity.get(Position);
      pos.x = playerData.x;
      pos.y = playerData.y;

      const rot = entity.get(Rotation);
      rot.angle = playerData.angle;
    }

    // Remove players that left
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

  _createRemotePlayer(playerData) {
    const group = new THREE.Group();

    // Body — red for remote players
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xff4444 })
    );
    body.position.y = 0.6;
    group.add(body);

    // Direction indicator
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xff8888 })
    );
    nose.position.set(0, 0.6, -0.8);
    group.add(nose);

    // Name label — simple sprite
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
