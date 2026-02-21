import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Velocity } from '../components/Velocity.js';

export class InputSystem extends System {
  constructor(inputManager) {
    super(0); // highest priority
    this.inputManager = inputManager;
  }

  update(dt) {
    const input = this.inputManager.getState();
    const entities = this.world.query(PlayerControlled, Velocity);

    for (const entity of entities) {
      const pc = entity.get(PlayerControlled);
      if (!pc.isLocal) continue;

      const vel = entity.get(Velocity);
      vel.vx = input.moveX;
      vel.vy = input.moveY;
    }
  }
}
