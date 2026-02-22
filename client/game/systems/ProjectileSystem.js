import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { disposeObject3D } from '@engine/rendering/dispose.js';

const MAX_POOL_SIZE = 50;

/**
 * Renders projectiles from server state.
 * Projectiles are purely server-authoritative — we just visualize them.
 */
export class ProjectileSystem extends System {
  constructor(renderer) {
    super(96);
    this.renderer = renderer;
    this.meshes = new Map(); // projectile id -> mesh
    this._pool = [];
  }

  setProjectiles(projectiles) {
    const seen = new Set();

    for (const p of projectiles) {
      seen.add(p.id);
      let mesh = this.meshes.get(p.id);
      if (!mesh) {
        mesh = this._getFromPool();
        this.renderer.add(mesh);
        this.meshes.set(p.id, mesh);
      }
      mesh.position.x = p.x;
      mesh.position.z = -p.y;
      mesh.position.y = 0.6;
      mesh.visible = true;
    }

    // Remove stale
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        mesh.visible = false;
        this.renderer.remove(mesh);
        if (this._pool.length < MAX_POOL_SIZE) {
          this._pool.push(mesh);
        } else {
          disposeObject3D(mesh);
        }
        this.meshes.delete(id);
      }
    }
  }

  _getFromPool() {
    if (this._pool.length > 0) return this._pool.pop();
    const geo = new THREE.SphereGeometry(0.15, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.5 });
    return new THREE.Mesh(geo, mat);
  }

  update(dt) {
    // Updates driven by setProjectiles() called from NetworkSyncSystem
  }

  destroy() {
    for (const [, mesh] of this.meshes) {
      this.renderer.remove(mesh);
      disposeObject3D(mesh);
    }
    this.meshes.clear();
    for (const mesh of this._pool) {
      disposeObject3D(mesh);
    }
    this._pool = [];
  }
}
