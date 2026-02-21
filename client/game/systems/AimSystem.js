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

      // Face aim direction while holding aim input (mouse click or joystick aim)
      // On the release frame, preserve the aimed rotation so the shot fires correctly
      // Otherwise face the movement direction
      const justReleased = input.mouseJustReleased || input.aimJoystickJustReleased;
      if (input.shooting && (input.aimX !== 0 || input.aimY !== 0)) {
        rot.angle = Math.atan2(input.aimY, input.aimX);
      } else if (!justReleased && (input.moveX !== 0 || input.moveY !== 0)) {
        rot.angle = Math.atan2(input.moveY, input.moveX);
      }
    }
  }
}
