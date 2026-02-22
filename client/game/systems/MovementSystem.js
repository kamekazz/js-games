import { System } from '@engine/ecs/System.js';
import { Position } from '../components/Position.js';
import { Velocity } from '../components/Velocity.js';
import { WORLD_SIZE } from '@shared/constants.js';

export class MovementSystem extends System {
  constructor() {
    super(10);
    this.obstacles = null; // set by NetworkSyncSystem
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

      // Obstacle collision (client-side prediction)
      if (this.obstacles) {
        for (const obs of this.obstacles) {
          const result = this._pushOut(pos.x, pos.y, 0.5, obs);
          if (result) {
            pos.x = result.x;
            pos.y = result.y;
          }
        }
      }
    }
  }

  _pushOut(px, py, radius, obs) {
    const cos = Math.cos(-obs.angle);
    const sin = Math.sin(-obs.angle);
    const dx = px - obs.x;
    const dy = py - obs.y;
    let lx = dx * cos - dy * sin;
    let ly = dx * sin + dy * cos;

    const hw = obs.hw + radius;
    const hd = obs.hd + radius;

    if (Math.abs(lx) >= hw || Math.abs(ly) >= hd) return null;

    const pushRight = hw - lx;
    const pushLeft = hw + lx;
    const pushTop = hd - ly;
    const pushBottom = hd + ly;
    const min = Math.min(pushRight, pushLeft, pushTop, pushBottom);

    if (min === pushRight) lx = hw;
    else if (min === pushLeft) lx = -hw;
    else if (min === pushTop) ly = hd;
    else ly = -hd;

    return {
      x: obs.x + lx * cos + ly * sin,
      y: obs.y - lx * sin + ly * cos,
    };
  }
}
