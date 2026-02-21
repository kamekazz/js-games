import { System } from '@engine/ecs/System.js';
import { Position } from '../components/Position.js';
import { MeshRef } from '../components/MeshRef.js';
import { Rotation } from '../components/Rotation.js';

export class RenderSyncSystem extends System {
  constructor() {
    super(100); // runs after movement
  }

  update(dt) {
    const entities = this.world.query(Position, MeshRef);

    for (const entity of entities) {
      const pos = entity.get(Position);
      const mesh = entity.get(MeshRef).mesh;

      // 2D game coords (x, y) map to Three.js (x, 0, -z)
      mesh.position.x = pos.x;
      mesh.position.z = -pos.y;

      // Apply rotation around Y axis if entity has Rotation component
      if (entity.has(Rotation)) {
        const rot = entity.get(Rotation);
        // Nose points along local -Z. To aim toward game angle `a`:
        // Three.js world aim direction is (cos(a), 0, -sin(a))
        // Solving rotation matrix gives: rotation.y = angle - PI/2
        mesh.rotation.y = rot.angle - Math.PI / 2;
      }
    }
  }
}
