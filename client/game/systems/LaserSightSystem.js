import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Position } from '../components/Position.js';
import { Rotation } from '../components/Rotation.js';
import { Weapon } from '../components/Weapon.js';
import { WEAPONS } from '@shared/constants.js';

export class LaserSightSystem extends System {
  constructor(renderer, inputManager) {
    super(16); // right after WeaponSystem (15)
    this.renderer = renderer;
    this.inputManager = inputManager;
    this._mesh = null;
    this._geometry = null;
    this._material = null;
    this._currentColor = null;
  }

  update(dt) {
    const input = this.inputManager.getState();
    const entities = this.world.query(PlayerControlled, Position, Rotation, Weapon);

    let localEntity = null;
    for (const entity of entities) {
      if (entity.get(PlayerControlled).isLocal) {
        localEntity = entity;
        break;
      }
    }

    if (!localEntity) {
      this._removeMesh();
      return;
    }

    if (input.shooting) {
      const weapon = localEntity.get(Weapon);
      const wDef = WEAPONS[weapon.id];
      const laserLength = wDef.laserLength;
      const laserColor = wDef.laserColor;
      const maxSpread = wDef.coneMaxSpread;
      const minSpread = wDef.coneMinSpread;
      const focusDuration = wDef.focusDuration;

      weapon.aimTime += dt;
      const progress = Math.min(weapon.aimTime / focusDuration, 1);
      const spread = minSpread + (maxSpread - minSpread) * (1 - progress);

      const pos = localEntity.get(Position);
      const angle = localEntity.get(Rotation).angle;

      const startX = pos.x;
      const startY = pos.y;
      const endX = startX + Math.cos(angle) * laserLength;
      const endY = startY + Math.sin(angle) * laserLength;

      // Perpendicular direction for cone width
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      if (!this._mesh) {
        this._geometry = new THREE.BufferGeometry();
        this._material = new THREE.MeshBasicMaterial({
          color: laserColor,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        this._currentColor = laserColor;
        const positions = new Float32Array(9); // 3 vertices * 3 components
        this._geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this._mesh = new THREE.Mesh(this._geometry, this._material);
        this._mesh.renderOrder = 999;
        this.renderer.add(this._mesh);
      }

      // Update color if weapon changed
      if (this._currentColor !== laserColor) {
        this._material.color.setHex(laserColor);
        this._currentColor = laserColor;
      }

      // More opaque as it narrows into the laser
      this._material.opacity = 0.25 + 0.45 * progress;

      const posAttr = this._geometry.attributes.position;
      const halfSpread = spread / 2;

      // Vertex 0: player position (cone tip)
      posAttr.array[0] = startX;
      posAttr.array[1] = 0.5;
      posAttr.array[2] = -startY;
      // Vertex 1: end + perpendicular offset
      posAttr.array[3] = endX + perpX * halfSpread;
      posAttr.array[4] = 0.5;
      posAttr.array[5] = -(endY + perpY * halfSpread);
      // Vertex 2: end - perpendicular offset
      posAttr.array[6] = endX - perpX * halfSpread;
      posAttr.array[7] = 0.5;
      posAttr.array[8] = -(endY - perpY * halfSpread);
      posAttr.needsUpdate = true;
    } else {
      this._removeMesh();
      // Reset aim time on the weapon component when not aiming
      const weapon = localEntity.get(Weapon);
      if (weapon) weapon.aimTime = 0;
    }
  }

  _removeMesh() {
    if (this._mesh) {
      this.renderer.remove(this._mesh);
      this._geometry.dispose();
      this._material.dispose();
      this._mesh = null;
      this._geometry = null;
      this._material = null;
      this._currentColor = null;
    }
  }

  destroy() {
    this._removeMesh();
  }
}
