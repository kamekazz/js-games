import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';

/**
 * Renders extraction zones as blue translucent cylinders with pulsing animation.
 */
export class ExtractionZoneRenderSystem extends System {
  constructor(renderer) {
    super(96);
    this.renderer = renderer;
    this.meshes = new Map(); // zone id -> group
    this._time = 0;
    this._created = false;
  }

  setZones(zones) {
    if (this._created) return;
    this._created = true;

    for (const zone of zones) {
      const group = new THREE.Group();

      // Translucent cylinder
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(zone.r, zone.r, 0.3, 32),
        new THREE.MeshStandardMaterial({
          color: 0x2266ff,
          transparent: true,
          opacity: 0.2,
          emissive: 0x2266ff,
          emissiveIntensity: 0.3,
        })
      );
      cylinder.position.y = 0.15;
      group.add(cylinder);

      // Ring border
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(zone.r, 0.15, 8, 48),
        new THREE.MeshStandardMaterial({
          color: 0x4488ff,
          emissive: 0x4488ff,
          emissiveIntensity: 0.5,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      group.add(ring);

      // "EXTRACT" text indicator — small pillar/beacon
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 4, 8),
        new THREE.MeshStandardMaterial({
          color: 0x4488ff,
          transparent: true,
          opacity: 0.4,
          emissive: 0x4488ff,
          emissiveIntensity: 0.6,
        })
      );
      beacon.position.y = 2;
      group.add(beacon);

      group.position.set(zone.x, 0, -zone.y);
      this.renderer.add(group);
      this.meshes.set(zone.id, group);
    }
  }

  update(dt) {
    this._time += dt;
    const pulse = 0.15 + Math.sin(this._time * 2) * 0.1;

    for (const [, group] of this.meshes) {
      // Pulse the cylinder opacity
      const cylinder = group.children[0];
      if (cylinder && cylinder.material) {
        cylinder.material.opacity = pulse;
      }
      // Pulse beacon
      const beacon = group.children[2];
      if (beacon && beacon.material) {
        beacon.material.opacity = 0.3 + Math.sin(this._time * 3) * 0.15;
      }
    }
  }
}
