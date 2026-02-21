import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Position } from '../components/Position.js';

export class CameraFollowSystem extends System {
  constructor(cameraController) {
    super(90); // after movement, before render sync
    this.cameraController = cameraController;
  }

  update(dt) {
    const entities = this.world.query(PlayerControlled, Position);

    for (const entity of entities) {
      const pc = entity.get(PlayerControlled);
      if (!pc.isLocal) continue;

      const pos = entity.get(Position);
      // Game Y maps to -Z in Three.js (same as RenderSyncSystem)
      this.cameraController.setTarget(pos.x, -pos.y);
      break;
    }

    this.cameraController.update(dt);
  }
}
