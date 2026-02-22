import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Position } from '../components/Position.js';
import { Sprint } from '../components/Sprint.js';
import { Velocity } from '../components/Velocity.js';
import { Health } from '../components/Health.js';
import { PLAYER_SPEED } from '@shared/constants.js';

const SURFACE_SPEED = {
  road: 1.0,
  sidewalk: 1.0,
  mud: 0.7,
};
const GRASS_SPEED = 0.8;

export class SprintSystem extends System {
  constructor(inputManager) {
    super(8); // after input (0), before movement (10)
    this.inputManager = inputManager;
    this.groundPatches = null; // set by NetworkSyncSystem
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

  _getSurfaceMultiplier(px, py) {
    if (!this.groundPatches) return GRASS_SPEED;
    let best = GRASS_SPEED;
    for (const gp of this.groundPatches) {
      const dx = px - gp.x;
      const dy = py - gp.y;
      const cosA = Math.cos(-gp.angle);
      const sinA = Math.sin(-gp.angle);
      const lx = dx * cosA - dy * sinA;
      const ly = dx * sinA + dy * cosA;
      if (Math.abs(lx) < gp.w / 2 && Math.abs(ly) < gp.d / 2) {
        const mult = SURFACE_SPEED[gp.type] ?? GRASS_SPEED;
        if (mult > best) best = mult;
      }
    }
    return best;
  }

  update(dt) {
    const input = this.inputManager.getState();
    const isMoving = input.moveX !== 0 || input.moveY !== 0;

    const entities = this.world.query(PlayerControlled, Sprint, Velocity, Health, Position);

    for (const entity of entities) {
      const pc = entity.get(PlayerControlled);
      if (!pc.isLocal) continue;

      const sprint = entity.get(Sprint);
      const vel = entity.get(Velocity);
      const health = entity.get(Health);
      const pos = entity.get(Position);

      if (!health.alive) {
        sprint.isSprinting = false;
        vel.speed = PLAYER_SPEED;
        continue;
      }

      // --- Stamina drain/regen ---
      if (isMoving) {
        const wantSprint = this._sprintHeld && sprint.stamina > 0;
        if (wantSprint) {
          sprint.isSprinting = true;
          sprint.stamina = Math.max(0, sprint.stamina - sprint.sprintDrain * dt);
        } else {
          sprint.isSprinting = false;
          sprint.stamina = Math.max(0, sprint.stamina - sprint.walkDrain * dt);
        }
        sprint._regenTimer = sprint.regenDelay;
      } else {
        sprint.isSprinting = false;
        // Regen when standing still
        if (sprint._regenTimer > 0) {
          sprint._regenTimer -= dt;
        } else if (sprint.stamina < sprint.maxStamina) {
          sprint.stamina = Math.min(sprint.maxStamina, sprint.stamina + sprint.regenRate * dt);
        }
      }

      // --- Exhaustion multiplier ---
      let exhaustionMult;
      if (sprint.stamina > sprint.exhaustionThreshold) {
        exhaustionMult = 1.0;
      } else {
        exhaustionMult = sprint.exhaustionMinMult +
          (sprint.stamina / sprint.exhaustionThreshold) * (1.0 - sprint.exhaustionMinMult);
      }

      // --- Surface multiplier ---
      const surfaceMult = this._getSurfaceMultiplier(pos.x, pos.y);

      // --- Sprint multiplier ---
      const sprintMult = sprint.isSprinting ? sprint.speedMultiplier : 1.0;

      // --- Final speed ---
      vel.speed = PLAYER_SPEED * sprintMult * exhaustionMult * surfaceMult;
    }
  }
}
