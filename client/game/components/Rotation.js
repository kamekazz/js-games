import { Component } from '@engine/ecs/Component.js';

export class Rotation extends Component {
  constructor(angle = 0) {
    super();
    this.angle = angle; // radians, 0 = facing right (+X), PI/2 = facing up (+Y)
  }
}
