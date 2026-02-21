import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Sprint } from '../components/Sprint.js';
import { Velocity } from '../components/Velocity.js';
import { Health } from '../components/Health.js';
import { PLAYER_SPEED } from '@shared/constants.js';

export class SprintSystem extends System {
  constructor(inputManager) {
    super(8); // after input (0), before movement (10)
    this.inputManager = inputManager;
    this._sprintHeld = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this._sprintHeld = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this._sprintHeld = false;
    });
    window.addEventListener('blur', () => {
      this._sprintHeld = false;
    });
  }

  setSprinting(val) {
    this._sprintHeld = val;
  }

  update(dt) {
    const input = this.inputManager.getState();
    const isMoving = input.moveX !== 0 || input.moveY !== 0;

    const entities = this.world.query(PlayerControlled, Sprint, Velocity, Health);

    for (const entity of entities) {
      const pc = entity.get(PlayerControlled);
      if (!pc.isLocal) continue;

      const sprint = entity.get(Sprint);
      const vel = entity.get(Velocity);
      const health = entity.get(Health);

      if (!health.alive) {
        sprint.isSprinting = false;
        vel.speed = PLAYER_SPEED;
        continue;
      }

      const wantSprint = this._sprintHeld && isMoving && sprint.stamina > 0;

      if (wantSprint) {
        sprint.isSprinting = true;
        sprint.stamina = Math.max(0, sprint.stamina - sprint.drainRate * dt);
        sprint._regenTimer = sprint.regenDelay;
        vel.speed = PLAYER_SPEED * sprint.speedMultiplier;
      } else {
        sprint.isSprinting = false;
        vel.speed = PLAYER_SPEED;

        // Regen stamina after delay
        if (sprint._regenTimer > 0) {
          sprint._regenTimer -= dt;
        } else if (sprint.stamina < sprint.maxStamina) {
          sprint.stamina = Math.min(sprint.maxStamina, sprint.stamina + sprint.regenRate * dt);
        }
      }
    }
  }
}
