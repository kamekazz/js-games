export class System {
  constructor(priority = 0) {
    this.priority = priority;
    this.world = null;
  }

  init(world) {
    this.world = world;
  }

  update(dt) {
    // Override in subclass
  }
}
