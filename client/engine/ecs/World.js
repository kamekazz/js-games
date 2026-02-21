export class World {
  constructor() {
    this.entities = new Map();
    this.systems = [];
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity);
    return entity;
  }

  removeEntity(id) {
    this.entities.delete(id);
  }

  getEntity(id) {
    return this.entities.get(id);
  }

  addSystem(system) {
    system.init(this);
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    return this;
  }

  query(...componentClasses) {
    const results = [];
    for (const entity of this.entities.values()) {
      if (componentClasses.every(c => entity.has(c))) {
        results.push(entity);
      }
    }
    return results;
  }

  update(dt) {
    for (const system of this.systems) {
      system.update(dt);
    }
  }
}
