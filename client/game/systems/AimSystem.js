import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Rotation } from '../components/Rotation.js';

export class AimSystem extends System {
  constructor(inputManager) {
    super(5); // after InputSystem (0), before MovementSystem (10)
    this.inputManager = inputManager;
  }

  update(dt) {
    const input = this.inputManager.getState();
    const entities = this.world.query(PlayerControlled, Rotation);

    for (const entity of entities) {
      const pc = entity.get(PlayerControlled);
      if (!pc.isLocal) continue;

      const rot = entity.get(Rotation);

      // Use aim input if available (right joystick or mouse)
      if (input.aimX !== 0 || input.aimY !== 0) {
        rot.angle = Math.atan2(input.aimY, input.aimX);
      } else if (input.moveX !== 0 || input.moveY !== 0) {
        // Fall back to movement direction
        rot.angle = Math.atan2(input.moveY, input.moveX);
      }
    }
  }
}
