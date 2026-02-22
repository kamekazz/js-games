import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Rotation } from '../components/Rotation.js';
import { Sprint } from '../components/Sprint.js';

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
      const sprint = entity.get(Sprint);
      const isMoving = input.moveX !== 0 || input.moveY !== 0;
      const isSprinting = sprint && sprint.isSprinting;

      // Priority:
      // 1. Sprinting → face movement direction
      // 2. Mouse active (desktop) → always face mouse position
      // 3. Aim joystick used (mobile) → face last aim direction
      // 4. Moving with no aim data → face movement direction (fallback)
      if (isSprinting && isMoving) {
        rot.angle = Math.atan2(input.moveY, input.moveX);
      } else if (input.mouseActive) {
        rot.angle = Math.atan2(input.aimY, input.aimX);
      } else if (input.lastAimAngle !== null) {
        rot.angle = input.lastAimAngle;
      } else if (isMoving) {
        rot.angle = Math.atan2(input.moveY, input.moveX);
      }
    }
  }
}
