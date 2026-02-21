import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';

const ZOMBIE_COLORS = {
  walker: { body: 0x446633, eye: 0xff0000 },
  runner: { body: 0x667744, eye: 0xff4400 },
  tank:   { body: 0x334422, eye: 0xff0000 },
};

const ZOMBIE_SCALES = {
  walker: 1.0,
  runner: 0.85,
  tank:   1.5,
};

/**
 * Renders zombies from server state.
 * Similar to ProjectileSystem — purely driven by server data.
 */
export class EnemyRenderSystem extends System {
  constructor(renderer) {
    super(97);
    this.renderer = renderer;
    this.meshes = new Map(); // zombie id -> { group, hpBar }
    this._pool = [];
  }

  setZombies(zombies) {
    const seen = new Set();

    for (const z of zombies) {
      if (!z.alive) continue;
      seen.add(z.id);

      let entry = this.meshes.get(z.id);
      if (!entry) {
        entry = this._createZombieMesh(z.type);
        this.renderer.add(entry.group);
        this.meshes.set(z.id, entry);
      }

      entry.group.position.x = z.x;
      entry.group.position.z = -z.y;
      entry.group.rotation.y = z.angle - Math.PI / 2;
      entry.group.visible = true;

      // Update HP bar
      const pct = Math.max(0, z.hp / z.maxHp);
      entry.hpBar.scale.x = pct;
      entry.hpBar.material.color.setHex(pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xccaa22 : 0xcc2222);
      entry.hpBg.visible = pct < 1;
      entry.hpBar.visible = pct < 1;
    }

    // Remove dead/gone zombies
    for (const [id, entry] of this.meshes) {
      if (!seen.has(id)) {
        entry.group.visible = false;
        this.renderer.remove(entry.group);
        this.meshes.delete(id);
      }
    }
  }

  _createZombieMesh(type) {
    const colors = ZOMBIE_COLORS[type] || ZOMBIE_COLORS.walker;
    const scale = ZOMBIE_SCALES[type] || 1.0;

    const group = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.0 * scale, 1.0 * scale, 1.0 * scale),
      new THREE.MeshStandardMaterial({ color: colors.body })
    );
    body.position.y = 0.5 * scale;
    group.add(body);

    // Eyes (two small red cubes on front face)
    const eyeGeo = new THREE.BoxGeometry(0.15 * scale, 0.15 * scale, 0.1 * scale);
    const eyeMat = new THREE.MeshStandardMaterial({ color: colors.eye, emissive: colors.eye, emissiveIntensity: 0.6 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.2 * scale, 0.65 * scale, -0.51 * scale);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.2 * scale, 0.65 * scale, -0.51 * scale);
    group.add(rightEye);

    // HP bar background (dark)
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    hpBg.position.set(0, 1.3 * scale, 0);
    hpBg.rotation.x = -Math.PI / 4;
    hpBg.visible = false;
    group.add(hpBg);

    // HP bar fill
    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide })
    );
    hpBar.position.set(0, 1.3 * scale, -0.01);
    hpBar.rotation.x = -Math.PI / 4;
    hpBar.visible = false;
    group.add(hpBar);

    return { group, hpBar, hpBg };
  }

  update(dt) {
    // Driven by setZombies() from NetworkSyncSystem
  }
}
