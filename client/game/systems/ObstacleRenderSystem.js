import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';

const CAR_COLORS = [0xaa3333, 0x3355aa, 0xeeeeee, 0x222222, 0x33aa55];
const BUILDING_COLORS = [0x667777, 0x886655, 0x998877, 0x777788, 0x6a6a6a];

export class ObstacleRenderSystem extends System {
  constructor(renderer) {
    super(96);
    this.renderer = renderer;
    this.meshes = [];
    this.groundMeshes = [];
    this._created = false;
    this._groundCreated = false;
  }

  setObstacles(obstacles) {
    if (this._created) return;
    this._created = true;

    for (const obs of obstacles) {
      let group;
      if (obs.type === 'building_sm') {
        group = this._createBuilding(obs.hw * 2, obs.hd * 2, 5);
      } else if (obs.type === 'building_md') {
        group = this._createBuilding(obs.hw * 2, obs.hd * 2, 6.5);
      } else if (obs.type === 'building_lg') {
        group = this._createBuilding(obs.hw * 2, obs.hd * 2, 8);
      } else if (obs.type === 'car') {
        group = this._createCar(obs.hw * 2, obs.hd * 2);
      } else if (obs.type === 'truck') {
        group = this._createTruck(obs.hw * 2, obs.hd * 2);
      } else if (obs.type === 'barrier') {
        group = this._createBarrier(obs.hw * 2, obs.hd * 2);
      } else {
        group = this._createCrate(obs.hw * 2, obs.hd * 2);
      }

      group.position.set(obs.x, 0, -obs.y);
      group.rotation.y = obs.angle;
      this.renderer.add(group);
      this.meshes.push(group);
    }
  }

  setGround(patches) {
    if (this._groundCreated) return;
    this._groundCreated = true;

    for (const patch of patches) {
      const mesh = this._createGroundPatch(patch);
      mesh.position.set(patch.x, 0.01, -patch.y);
      mesh.rotation.y = patch.angle || 0;
      this.renderer.add(mesh);
      this.groundMeshes.push(mesh);
    }
  }

  _createBuilding(w, d, height) {
    const group = new THREE.Group();
    const color = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];

    // Main body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, height, d),
      new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = height / 2;
    group.add(body);

    // Roof edge — slightly darker strip on top
    const roofEdge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    roofEdge.position.y = height;
    group.add(roofEdge);

    // Windows grid on all 4 sides
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a });
    const windowW = 0.8;
    const windowH = 1.0;
    const windowGeo = new THREE.BoxGeometry(windowW, windowH, 0.06);

    const numCols = Math.max(1, Math.floor(w / 2.5));
    const numRows = Math.max(1, Math.floor((height - 1.5) / 2.0));

    for (let side = 0; side < 4; side++) {
      const isXSide = side < 2;
      const sideLen = isXSide ? w : d;
      const cols = isXSide ? numCols : Math.max(1, Math.floor(d / 2.5));
      const depthOffset = isXSide ? d / 2 + 0.04 : w / 2 + 0.04;
      const sign = (side % 2 === 0) ? 1 : -1;

      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < cols; col++) {
          const win = new THREE.Mesh(windowGeo, windowMat);
          const along = -sideLen / 2 + (sideLen / (cols + 1)) * (col + 1);
          const wy = 1.5 + row * 2.0;

          if (isXSide) {
            win.position.set(along, wy, sign * depthOffset);
          } else {
            win.rotation.y = Math.PI / 2;
            win.position.set(sign * depthOffset, wy, along);
          }
          group.add(win);
        }
      }
    }

    // Door on front side
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x443322 });
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.0, 0.06),
      doorMat
    );
    door.position.set(0, 1.0, d / 2 + 0.05);
    group.add(door);

    return group;
  }

  _createCar(w, d) {
    const group = new THREE.Group();
    const bodyColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, 1.2, d),
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    body.position.y = 0.6;
    group.add(body);

    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.8, d * 0.88),
      new THREE.MeshStandardMaterial({ color: bodyColor })
    );
    cabin.position.set(-0.3, 1.6, 0);
    group.add(cabin);

    // Windshield hints
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x556677, transparent: true, opacity: 0.6 });
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, d * 0.8), glassMat);
    frontGlass.position.set(0.8, 1.6, 0);
    group.add(frontGlass);

    // Wheels
    const wheelGeo = new THREE.BoxGeometry(0.4, 0.4, 0.25);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const positions = [
      [-w / 2 + 0.5, 0.2, d / 2 + 0.05],
      [-w / 2 + 0.5, 0.2, -d / 2 - 0.05],
      [w / 2 - 0.5, 0.2, d / 2 + 0.05],
      [w / 2 - 0.5, 0.2, -d / 2 - 0.05],
    ];
    for (const [wx, wy, wz] of positions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    }

    return group;
  }

  _createTruck(w, d) {
    const group = new THREE.Group();

    // Cab section (front)
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.8, d),
      new THREE.MeshStandardMaterial({ color: 0x334455 })
    );
    cab.position.set(w / 2 - 1.25, 0.9, 0);
    group.add(cab);

    // Cargo box (back)
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(w - 2.5, 2.2, d),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    cargo.position.set(-1.25, 1.1, 0);
    group.add(cargo);

    // Wheels
    const wheelGeo = new THREE.BoxGeometry(0.5, 0.5, 0.25);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const positions = [
      [-w / 2 + 0.6, 0.25, d / 2 + 0.05],
      [-w / 2 + 0.6, 0.25, -d / 2 - 0.05],
      [0, 0.25, d / 2 + 0.05],
      [0, 0.25, -d / 2 - 0.05],
      [w / 2 - 0.6, 0.25, d / 2 + 0.05],
      [w / 2 - 0.6, 0.25, -d / 2 - 0.05],
    ];
    for (const [wx, wy, wz] of positions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    }

    return group;
  }

  _createCrate(w, d) {
    const group = new THREE.Group();
    const height = 1.3;

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(w, height, d),
      new THREE.MeshStandardMaterial({ color: 0xaa8855 })
    );
    crate.position.y = height / 2;
    group.add(crate);

    // Cross detail on top
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x775533 });
    const strip1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, 0.15), stripMat);
    strip1.position.y = height + 0.01;
    group.add(strip1);

    const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, d), stripMat);
    strip2.position.y = height + 0.01;
    group.add(strip2);

    return group;
  }

  _createBarrier(w, d) {
    const group = new THREE.Group();
    const height = 1.0;

    // Jersey barrier shape — trapezoidal approximation using a box
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(w, height, d + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    barrier.position.y = height / 2;
    group.add(barrier);

    // Yellow stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.15, d + 0.32),
      new THREE.MeshStandardMaterial({ color: 0xccaa00 })
    );
    stripe.position.y = height * 0.6;
    group.add(stripe);

    return group;
  }

  _createGroundPatch(patch) {
    const group = new THREE.Group();

    if (patch.type === 'road') {
      // Dark asphalt
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(patch.w, 0.02, patch.d),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      group.add(road);

      // Yellow center line dashes
      const lineLen = 1.5;
      const gap = 2.0;
      const numDashes = Math.floor(patch.w / (lineLen + gap));
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xccaa00 });
      for (let i = 0; i < numDashes; i++) {
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(lineLen, 0.025, 0.15),
          lineMat
        );
        dash.position.x = -patch.w / 2 + (lineLen + gap) * i + lineLen / 2 + gap / 2;
        dash.position.y = 0.005;
        group.add(dash);
      }
    } else if (patch.type === 'mud') {
      const mud = new THREE.Mesh(
        new THREE.BoxGeometry(patch.w, 0.02, patch.d),
        new THREE.MeshStandardMaterial({ color: 0x4a3728 })
      );
      group.add(mud);
    } else if (patch.type === 'sidewalk') {
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(patch.w, 0.02, patch.d),
        new THREE.MeshStandardMaterial({ color: 0x999999 })
      );
      group.add(sidewalk);
    }

    return group;
  }

  update(dt) {
    // Static — driven by setObstacles() from NetworkSyncSystem
  }
}
