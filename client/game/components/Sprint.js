import { Component } from '@engine/ecs/Component.js';

export class Sprint extends Component {
  constructor() {
    super();
    this.stamina = 100;
    this.maxStamina = 100;
    this.sprintDrain = 3;     // stamina/sec while sprinting
    this.walkDrain = 0;       // no stamina drain while walking
    this.regenRate = 25;      // stamina/sec while standing still
    this.regenDelay = 0.3;    // seconds before regen starts
    this.speedMultiplier = 1.0;
    this.exhaustionThreshold = 30;  // below this, speed drops
    this.exhaustionMinMult = 0.45;  // speed multiplier at 0 stamina
    this.isSprinting = false;
    this._regenTimer = 0;
  }
}
