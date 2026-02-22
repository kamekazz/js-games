import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { disposeObject3D } from '@engine/rendering/dispose.js';

/**
 * Renders loot chests from server state.
 * Golden glowing boxes with slow rotation.
 */
export class ChestRenderSystem extends System {
  constructor(renderer) {
    super(97);
    this.renderer = renderer;
    this.meshes = new Map(); // chest id -> group
    this._time = 0;
  }

  setChests(chests) {
    const seen = new Set();

    for (const chest of chests) {
      if (chest.opened) continue;
      seen.add(chest.id);

      let group = this.meshes.get(chest.id);
      if (!group) {
        group = this._createChestMesh();
        this.renderer.add(group);
        this.meshes.set(chest.id, group);
      }

      group.position.x = chest.x;
      group.position.z = -chest.y;
      group.position.y = 0.6 + Math.sin(this._time * 2 + chest.id) * 0.15;
      group.rotation.y = this._time * 0.8;
      group.visible = true;
    }

    // Remove chests that are no longer in state
    for (const [id, group] of this.meshes) {
      if (!seen.has(id)) {
        group.visible = false;
        this.renderer.remove(group);
        this.meshes.delete(id);
      }
    }
  }

  _createChestMesh() {
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xddaa22,
      emissive: 0xddaa22,
      emissiveIntensity: 0.4,
    });

    // Main box body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.6),
      mat
    );
    group.add(body);

    // Lid (slightly wider)
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0xcc9900,
      emissive: 0xcc9900,
      emissiveIntensity: 0.3,
    });
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.12, 0.65),
      lidMat
    );
    lid.position.y = 0.31;
    group.add(lid);

    // Lock/clasp detail
    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.15, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x886600 })
    );
    clasp.position.set(0, 0.15, 0.34);
    group.add(clasp);

    return group;
  }

  update(dt) {
    this._time += dt;
  }

  destroy() {
    for (const [, group] of this.meshes) {
      this.renderer.remove(group);
      disposeObject3D(group);
    }
    this.meshes.clear();
  }
}
