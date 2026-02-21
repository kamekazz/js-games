import { Component } from '@engine/ecs/Component.js';

export class NetworkId extends Component {
  constructor(id) {
    super();
    this.id = id;
  }
}
