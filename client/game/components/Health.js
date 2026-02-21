import { Component } from '@engine/ecs/Component.js';

export class Health extends Component {
  constructor(current = 100, max = 100) {
    super();
    this.current = current;
    this.max = max;
    this.alive = true;
  }
}
