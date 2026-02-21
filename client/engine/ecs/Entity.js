let nextId = 0;

export class Entity {
  constructor() {
    this.id = nextId++;
    this.components = new Map();
  }

  add(component) {
    this.components.set(component.constructor, component);
    return this;
  }

  get(ComponentClass) {
    return this.components.get(ComponentClass);
  }

  has(ComponentClass) {
    return this.components.has(ComponentClass);
  }

  remove(ComponentClass) {
    this.components.delete(ComponentClass);
    return this;
  }
}
