import { Component } from '@engine/ecs/Component.js';

export class MeshRef extends Component {
  constructor(mesh) {
    super();
    this.mesh = mesh;
  }
}
