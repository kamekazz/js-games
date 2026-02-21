import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';

const ITEM_COLORS = {
  health: 0x44cc44,
  ammo:   0xffaa22,
};

/**
 * Renders item drops from server state.
 * Items float and bob up and down to be visible.
 */
export class ItemRenderSystem extends System {
  constructor(renderer) {
    super(97);
    this.renderer = renderer;
    this.meshes = new Map(); // item id -> mesh
    this._pool = [];
    this._time = 0;
  }

  setItems(items) {
    const seen = new Set();

    for (const item of items) {
      seen.add(item.id);
      let mesh = this.meshes.get(item.id);
      if (!mesh) {
        mesh = this._createItemMesh(item.type);
        this.renderer.add(mesh);
        this.meshes.set(item.id, mesh);
      }
      mesh.position.x = item.x;
      mesh.position.z = -item.y;
      mesh.position.y = 0.5 + Math.sin(this._time * 3 + item.id) * 0.2;
      mesh.rotation.y = this._time * 2;
      mesh.visible = true;
    }

    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        mesh.visible = false;
        this.renderer.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  _createItemMesh(type) {
    const color = ITEM_COLORS[type] || 0xffffff;
    const group = new THREE.Group();

    if (type === 'health') {
      // Green cross shape
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), mat);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), mat);
      group.add(h);
      group.add(v);
    } else {
      // Orange box for ammo
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), mat);
      group.add(box);
    }

    return group;
  }

  update(dt) {
    this._time += dt;
  }
}
