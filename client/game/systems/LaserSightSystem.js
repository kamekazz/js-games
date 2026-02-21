import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Position } from '../components/Position.js';
import { Rotation } from '../components/Rotation.js';

const LASER_LENGTH = 5;
const LASER_COLOR = 0xff3333;

export class LaserSightSystem extends System {
  constructor(renderer, inputManager) {
    super(16); // right after WeaponSystem (15)
    this.renderer = renderer;
    this.inputManager = inputManager;
    this._line = null;
    this._geometry = null;
    this._material = null;
  }

  update(dt) {
    const input = this.inputManager.getState();
    const entities = this.world.query(PlayerControlled, Position, Rotation);

    let localEntity = null;
    for (const entity of entities) {
      if (entity.get(PlayerControlled).isLocal) {
        localEntity = entity;
        break;
      }
    }

    if (!localEntity) {
      this._removeLine();
      return;
    }

    if (input.shooting) {
      const pos = localEntity.get(Position);
      const angle = localEntity.get(Rotation).angle;

      const startX = pos.x;
      const startY = pos.y;
      const endX = startX + Math.cos(angle) * LASER_LENGTH;
      const endY = startY + Math.sin(angle) * LASER_LENGTH;

      if (!this._line) {
        this._geometry = new THREE.BufferGeometry();
        this._material = new THREE.LineBasicMaterial({
          color: LASER_COLOR,
          transparent: true,
          opacity: 0.7,
        });
        const positions = new Float32Array(6); // 2 points * 3 components
        this._geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this._line = new THREE.Line(this._geometry, this._material);
        this._line.renderOrder = 999;
        this.renderer.add(this._line);
      }

      const posAttr = this._geometry.attributes.position;
      // Three.js uses Y-up; our game XY maps to Three.js XZ
      posAttr.array[0] = startX;
      posAttr.array[1] = 0.5;   // slightly above ground
      posAttr.array[2] = -startY;
      posAttr.array[3] = endX;
      posAttr.array[4] = 0.5;
      posAttr.array[5] = -endY;
      posAttr.needsUpdate = true;
    } else {
      this._removeLine();
    }
  }

  _removeLine() {
    if (this._line) {
      this.renderer.remove(this._line);
      this._geometry.dispose();
      this._material.dispose();
      this._line = null;
      this._geometry = null;
      this._material = null;
    }
  }

  destroy() {
    this._removeLine();
  }
}
