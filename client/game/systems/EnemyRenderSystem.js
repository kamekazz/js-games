import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';

/**
 * Renders zombies from server state.
 * Each type has a distinct look:
 *   Walker — green cube, standard zombie
 *   Runner — lean purple body, smaller & fast-looking
 *   Tank   — big red-brown brute, wide and armored
 */
export class EnemyRenderSystem extends System {
  constructor(renderer) {
    super(97);
    this.renderer = renderer;
    this.meshes = new Map(); // zombie id -> { group, hpBar, hpBg }
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
    if (type === 'runner') return this._createRunner();
    if (type === 'tank') return this._createTank();
    return this._createWalker();
  }

  // --- WALKER: standard green zombie cube ---
  _createWalker() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.0, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x44aa33 })
    );
    body.position.y = 0.5;
    group.add(body);

    // Head — small cube on top
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x55bb44 })
    );
    head.position.y = 1.25;
    group.add(head);

    // Eyes
    this._addEyes(group, 0xff0000, 1.0);

    return this._addHpBar(group, 1.7);
  }

  // --- RUNNER: lean purple, thin and tall ---
  _createRunner() {
    const group = new THREE.Group();

    // Thin tall body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8833aa })
    );
    body.position.y = 0.6;
    group.add(body);

    // Small pointy head
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x9944cc })
    );
    head.position.y = 1.45;
    group.add(head);

    // Arms — thin sticks angled back (looks like sprinting)
    const armGeo = new THREE.BoxGeometry(0.15, 0.7, 0.15);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x772299 });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.45, 0.7, 0.2);
    leftArm.rotation.x = 0.5;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.45, 0.7, 0.2);
    rightArm.rotation.x = -0.3;
    group.add(rightArm);

    // Glowing orange eyes
    this._addEyes(group, 0xff6600, 0.75, 1.35);

    return this._addHpBar(group, 1.9);
  }

  // --- TANK: big red-brown brute, wide & armored ---
  _createTank() {
    const group = new THREE.Group();
    const s = 1.5;

    // Wide heavy body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.3, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x883322 })
    );
    body.position.y = 0.65;
    group.add(body);

    // Armored head — flat wide box
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.6, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x994433 })
    );
    head.position.y = 1.6;
    group.add(head);

    // Shoulder armor plates
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x664422 });
    const plateGeo = new THREE.BoxGeometry(0.5, 0.4, 1.2);
    const leftPlate = new THREE.Mesh(plateGeo, plateMat);
    leftPlate.position.set(-1.0, 0.9, 0);
    group.add(leftPlate);
    const rightPlate = new THREE.Mesh(plateGeo, plateMat);
    rightPlate.position.set(1.0, 0.9, 0);
    group.add(rightPlate);

    // Big red glowing eyes
    const eyeGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.25, 1.65, -0.46);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.25, 1.65, -0.46);
    group.add(rightEye);

    return this._addHpBar(group, 2.3);
  }

  _addEyes(group, color, scale = 1.0, eyeY = null) {
    const s = scale;
    const y = eyeY || (0.65 * s + 0.5 * s);
    const eyeGeo = new THREE.BoxGeometry(0.12 * s, 0.12 * s, 0.08);
    const eyeMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15 * s, y, -0.31 * s);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15 * s, y, -0.31 * s);
    group.add(rightEye);
  }

  _addHpBar(group, barY) {
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    hpBg.position.set(0, barY, 0);
    hpBg.rotation.x = -Math.PI / 4;
    hpBg.visible = false;
    group.add(hpBg);

    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide })
    );
    hpBar.position.set(0, barY, -0.01);
    hpBar.rotation.x = -Math.PI / 4;
    hpBar.visible = false;
    group.add(hpBar);

    return { group, hpBar, hpBg };
  }

  update(dt) {
    // Driven by setZombies() from NetworkSyncSystem
  }
}
