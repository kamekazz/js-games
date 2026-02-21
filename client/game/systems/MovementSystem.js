import { System } from '@engine/ecs/System.js';
import { Position } from '../components/Position.js';
import { Velocity } from '../components/Velocity.js';
import { WORLD_SIZE } from '@shared/constants.js';

export class MovementSystem extends System {
  constructor() {
    super(10);
  }

  update(dt) {
    const entities = this.world.query(Position, Velocity);

    for (const entity of entities) {
      const pos = entity.get(Position);
      const vel = entity.get(Velocity);

      pos.x += vel.vx * vel.speed * dt;
      pos.y += vel.vy * vel.speed * dt;

      // Clamp to world bounds
      const half = WORLD_SIZE / 2;
      pos.x = Math.max(-half, Math.min(half, pos.x));
      pos.y = Math.max(-half, Math.min(half, pos.y));
    }
  }
}
