import { Component } from '@engine/ecs/Component.js';

export class PlayerControlled extends Component {
  constructor(isLocal = true) {
    super();
    this.isLocal = isLocal;
  }
}
