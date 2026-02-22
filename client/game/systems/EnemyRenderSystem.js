import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { disposeObject3D } from '@engine/rendering/dispose.js';

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
      const show = pct < 1;
      entry.hpBg.visible = show;
      entry.hpBar.visible = show;

      if (show) {
        // Billboard: cancel out parent rotation so HP bar faces camera
        entry.hpGroup.rotation.y = -(z.angle - Math.PI / 2);

        // Only redraw canvas when HP fraction actually changed
        if (entry.hpBar.userData.lastPct !== pct) {
          entry.hpBar.userData.lastPct = pct;
          const canvas = entry.hpBar.userData.canvas;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, 128, 16);
          const color = pct > 0.5 ? '#44cc44' : pct > 0.25 ? '#ccaa22' : '#cc2222';
          ctx.fillStyle = color;
          ctx.roundRect(0, 0, Math.round(128 * pct), 16, 4);
          ctx.fill();
          entry.hpBar.userData.texture.needsUpdate = true;
        }
      }
    }

    // Remove dead/gone zombies
    for (const [id, entry] of this.meshes) {
      if (!seen.has(id)) {
        entry.group.visible = false;
        this.renderer.remove(entry.group);
        // Dispose HP bar canvas textures to prevent GPU memory leak
        if (entry.hpBar.userData.texture) {
          entry.hpBar.userData.texture.dispose();
          entry.hpBar.material.dispose();
        }
        if (entry.hpBg.material && entry.hpBg.material.map) {
          entry.hpBg.material.map.dispose();
          entry.hpBg.material.dispose();
        }
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
    // Container that we manually billboard each frame
    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, barY, 0);
    group.add(hpGroup);

    // Background bar (dark)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 128;
    bgCanvas.height = 16;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.fillStyle = '#222222';
    bgCtx.roundRect(0, 0, 128, 16, 4);
    bgCtx.fill();
    bgCtx.strokeStyle = '#000000';
    bgCtx.lineWidth = 2;
    bgCtx.roundRect(0, 0, 128, 16, 4);
    bgCtx.stroke();
    const bgTex = new THREE.CanvasTexture(bgCanvas);
    const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ map: bgTex, depthTest: false }));
    hpBg.scale.set(1.8, 0.25, 1);
    hpBg.renderOrder = 998;
    hpBg.visible = false;
    hpGroup.add(hpBg);

    // Fill bar (colored) — we redraw the canvas each update
    const fillCanvas = document.createElement('canvas');
    fillCanvas.width = 128;
    fillCanvas.height = 16;
    const fillTex = new THREE.CanvasTexture(fillCanvas);
    const hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: fillTex, depthTest: false }));
    hpBar.scale.set(1.8, 0.25, 1);
    hpBar.renderOrder = 999;
    hpBar.visible = false;
    hpGroup.add(hpBar);

    // Store refs for redrawing
    hpBar.userData.canvas = fillCanvas;
    hpBar.userData.texture = fillTex;

    return { group, hpBar, hpBg, hpGroup };
  }

  update(dt) {
    // Driven by setZombies() from NetworkSyncSystem
  }

  destroy() {
    for (const [, entry] of this.meshes) {
      this.renderer.remove(entry.group);
      if (entry.hpBar.userData.texture) {
        entry.hpBar.userData.texture.dispose();
        entry.hpBar.material.dispose();
      }
      if (entry.hpBg.material && entry.hpBg.material.map) {
        entry.hpBg.material.map.dispose();
        entry.hpBg.material.dispose();
      }
      disposeObject3D(entry.group);
    }
    this.meshes.clear();
  }
}
