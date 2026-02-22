import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';

/**
 * Manages visual effects: muzzle flashes, hit sparks, death bursts.
 * Uses pooled objects for performance.
 */
export class EffectsSystem extends System {
  constructor(renderer) {
    super(92); // before RenderSync, after NetworkSync
    this.renderer = renderer;
    this._effects = []; // active effects: { mesh, life, maxLife, update }

    // Shared geometries/materials
    this._flashGeo = new THREE.SphereGeometry(0.3, 6, 6);
    this._flashMat = new THREE.MeshBasicMaterial({ color: 0xffff44 });

    this._sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
    this._sparkMats = [
      new THREE.MeshBasicMaterial({ color: 0xff4444 }),
      new THREE.MeshBasicMaterial({ color: 0xff8800 }),
      new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
    ];

    this._bloodMat = new THREE.MeshBasicMaterial({ color: 0x881111 });
    this._deathMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
  }

  /**
   * Muzzle flash at position+angle
   */
  spawnMuzzleFlash(x, y, angle) {
    // Flash sphere
    const flash = new THREE.Mesh(this._flashGeo, this._flashMat);
    const ox = Math.cos(angle) * 1.2;
    const oy = Math.sin(angle) * 1.2;
    flash.position.set(x + ox, 0.6, -(y + oy));
    this.renderer.add(flash);

    // Point light
    const light = new THREE.PointLight(0xffaa22, 3, 8);
    light.position.copy(flash.position);
    this.renderer.add(light);

    this._effects.push({
      meshes: [flash, light],
      life: 0.06,
      maxLife: 0.06,
      update: (eff, t) => {
        const scale = t;
        flash.scale.setScalar(scale);
        light.intensity = 3 * t;
      },
    });
  }

  /**
   * Hit sparks (orange/yellow particles flying outward)
   */
  spawnHitSparks(x, y) {
    const count = 5;
    const meshes = [];

    for (let i = 0; i < count; i++) {
      const mat = this._sparkMats[Math.floor(Math.random() * this._sparkMats.length)];
      const spark = new THREE.Mesh(this._sparkGeo, mat);
      spark.position.set(x, 0.6, -y);
      this.renderer.add(spark);

      const ang = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 4;
      spark.userData.vx = Math.cos(ang) * spd;
      spark.userData.vz = Math.sin(ang) * spd;
      spark.userData.vy = 2 + Math.random() * 3;
      meshes.push(spark);
    }

    this._effects.push({
      meshes,
      life: 0.4,
      maxLife: 0.4,
      update: (eff, t, dt) => {
        for (const m of eff.meshes) {
          m.position.x += m.userData.vx * dt;
          m.position.z += m.userData.vz * dt;
          m.position.y += m.userData.vy * dt;
          m.userData.vy -= 12 * dt; // gravity
          m.scale.setScalar(t);
        }
      },
    });
  }

  /**
   * Blood burst on player/zombie hit
   */
  spawnBloodBurst(x, y) {
    const count = 4;
    const meshes = [];

    for (let i = 0; i < count; i++) {
      const spark = new THREE.Mesh(this._sparkGeo, this._bloodMat);
      spark.position.set(x, 0.6, -y);
      this.renderer.add(spark);

      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 3;
      spark.userData.vx = Math.cos(ang) * spd;
      spark.userData.vz = Math.sin(ang) * spd;
      spark.userData.vy = 1 + Math.random() * 2;
      meshes.push(spark);
    }

    this._effects.push({
      meshes,
      life: 0.35,
      maxLife: 0.35,
      update: (eff, t, dt) => {
        for (const m of eff.meshes) {
          m.position.x += m.userData.vx * dt;
          m.position.z += m.userData.vz * dt;
          m.position.y += m.userData.vy * dt;
          m.userData.vy -= 10 * dt;
          m.scale.setScalar(t);
        }
      },
    });
  }

  /**
   * Death burst (zombie) — green particles
   */
  spawnDeathBurst(x, y) {
    const count = 8;
    const meshes = [];

    for (let i = 0; i < count; i++) {
      const spark = new THREE.Mesh(this._sparkGeo, this._deathMat);
      spark.position.set(x, 0.6, -y);
      spark.scale.setScalar(1.5);
      this.renderer.add(spark);

      const ang = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 5;
      spark.userData.vx = Math.cos(ang) * spd;
      spark.userData.vz = Math.sin(ang) * spd;
      spark.userData.vy = 3 + Math.random() * 4;
      meshes.push(spark);
    }

    this._effects.push({
      meshes,
      life: 0.5,
      maxLife: 0.5,
      update: (eff, t, dt) => {
        for (const m of eff.meshes) {
          m.position.x += m.userData.vx * dt;
          m.position.z += m.userData.vz * dt;
          m.position.y += m.userData.vy * dt;
          m.userData.vy -= 10 * dt;
          m.scale.setScalar(1.5 * t);
        }
      },
    });
  }

  /**
   * Floating damage number above hit position (RPG-style)
   */
  spawnDamageNumber(x, y, damage) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const text = String(damage);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Black outline
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 5;
    ctx.strokeText(text, 64, 32);
    // Color based on damage amount
    if (damage >= 30) ctx.fillStyle = '#ff4444';
    else if (damage >= 15) ctx.fillStyle = '#ffaa22';
    else ctx.fillStyle = '#ffff44';
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x + (Math.random() - 0.5) * 0.5, 2.0, -y);
    sprite.scale.set(2, 1, 1);
    sprite.renderOrder = 1000;
    this.renderer.add(sprite);

    this._effects.push({
      meshes: [sprite],
      life: 0.8,
      maxLife: 0.8,
      update: (eff, t, dt) => {
        sprite.position.y += 2.5 * dt;
        mat.opacity = Math.min(t * 2, 1);
        const scale = 0.8 + 0.4 * (1 - t);
        sprite.scale.set(2 * scale, scale, 1);
      },
    });
  }

  update(dt) {
    const surviving = [];

    for (const eff of this._effects) {
      eff.life -= dt;
      if (eff.life <= 0) {
        for (const m of eff.meshes) this.renderer.remove(m);
        continue;
      }
      const t = eff.life / eff.maxLife; // 1→0
      eff.update(eff, t, dt);
      surviving.push(eff);
    }

    this._effects = surviving;
  }

  destroy() {
    for (const eff of this._effects) {
      for (const m of eff.meshes) this.renderer.remove(m);
    }
    this._effects = [];
  }
}
