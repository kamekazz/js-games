import * as THREE from 'three';

export class TileRenderer {
  constructor(worldSize, tileSize = 2) {
    this.worldSize = worldSize;
    this.tileSize = tileSize;
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    const { worldSize, tileSize } = this;
    const tilesPerSide = Math.ceil(worldSize / tileSize);

    // Create a canvas texture for the tile pattern
    const canvas = document.createElement('canvas');
    const res = 64;
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d');

    // Grass base
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, res, res);

    // Subtle noise variation
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * res;
      const y = Math.random() * res;
      const brightness = 35 + Math.random() * 20;
      ctx.fillStyle = `rgba(${brightness}, ${brightness + 40}, ${brightness - 10}, 0.3)`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Grid line on edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, res - 1, res - 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(tilesPerSide, tilesPerSide);
    texture.magFilter = THREE.NearestFilter;

    const geometry = new THREE.PlaneGeometry(worldSize, worldSize);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.group.add(ground);

    // World boundary lines
    const borderMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
    const half = worldSize / 2;
    const borderPoints = [
      new THREE.Vector3(-half, 0.05, -half),
      new THREE.Vector3( half, 0.05, -half),
      new THREE.Vector3( half, 0.05,  half),
      new THREE.Vector3(-half, 0.05,  half),
      new THREE.Vector3(-half, 0.05, -half),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderLine = new THREE.Line(borderGeo, borderMat);
    this.group.add(borderLine);
  }

  getObject3D() {
    return this.group;
  }
}
