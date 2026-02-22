export class World {
  constructor() {
    this.entities = new Map();
    this.systems = [];
    this._queryCache = new Map();
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity);
    this._queryCache.clear();
    return entity;
  }

  removeEntity(id) {
    this.entities.delete(id);
    this._queryCache.clear();
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
    const key = componentClasses.map(c => c.name).join(',');
    const cached = this._queryCache.get(key);
    if (cached) return cached;

    const results = [];
    for (const entity of this.entities.values()) {
      if (componentClasses.every(c => entity.has(c))) {
        results.push(entity);
      }
    }
    this._queryCache.set(key, results);
    return results;
  }

  update(dt) {
    // Clear query cache once per frame
    this._queryCache.clear();
    for (const system of this.systems) {
      system.update(dt);
    }
  }
}
