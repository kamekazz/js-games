import * as THREE from 'three';
import { Entity } from '@engine/ecs/Entity.js';
import { Position } from '../components/Position.js';
import { Velocity } from '../components/Velocity.js';
import { MeshRef } from '../components/MeshRef.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Rotation } from '../components/Rotation.js';
import { Health } from '../components/Health.js';
import { Weapon } from '../components/Weapon.js';
import { Sprint } from '../components/Sprint.js';
import { PLAYER_SPEED } from '@shared/constants.js';

export function createPlayer(x = 0, y = 0, isLocal = true) {
  // Player body group
  const group = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x4488ff })
  );
  body.position.y = 0.6;
  group.add(body);

  // Direction indicator (barrel / nose) — points along +Z in local space
  // which maps to the "forward" after rotation is applied
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x88bbff })
  );
  nose.position.set(0, 0.6, -0.8);
  group.add(nose);

  group.position.set(x, 0, -y);

  const entity = new Entity();
  entity.add(new Position(x, y));
  entity.add(new Velocity(0, 0, PLAYER_SPEED));
  entity.add(new Rotation(0));
  entity.add(new MeshRef(group));
  entity.add(new PlayerControlled(isLocal));
  entity.add(new Health(100, 100));
  entity.add(new Weapon());
  entity.add(new Sprint());

  return entity;
}
