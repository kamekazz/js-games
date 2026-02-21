import { Component } from '@engine/ecs/Component.js';

export class Velocity extends Component {
  constructor(vx = 0, vy = 0, speed = 12) {
    super();
    this.vx = vx;
    this.vy = vy;
    this.speed = speed;
  }
}
