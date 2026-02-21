export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.targetX = 0;
    this.targetZ = 0;
    this.lerpSpeed = 5;
  }

  setTarget(x, z) {
    this.targetX = x;
    this.targetZ = z;
  }

  update(dt) {
    const t = 1 - Math.exp(-this.lerpSpeed * dt);
    this.camera.position.x += (this.targetX - this.camera.position.x) * t;
    this.camera.position.z += (this.targetZ - this.camera.position.z) * t;
  }
}
