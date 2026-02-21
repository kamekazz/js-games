import { Component } from '@engine/ecs/Component.js';

export class Sprint extends Component {
  constructor() {
    super();
    this.stamina = 100;
    this.maxStamina = 100;
    this.drainRate = 30;    // stamina/sec while sprinting
    this.regenRate = 20;    // stamina/sec while not sprinting
    this.regenDelay = 0.5;  // seconds after stopping sprint before regen starts
    this.speedMultiplier = 1.7;
    this.isSprinting = false;
    this._regenTimer = 0;
  }
}
