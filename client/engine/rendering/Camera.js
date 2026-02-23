export class CameraController {
  constructor(camera) {
    this.camera = camera;
    // Store the initial offset from the look-at point
    this.offsetY = camera.position.y;  // height above ground
    this.offsetZ = 15; // offset behind player for angled view
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
    const targetCamX = this.targetX;
    const targetCamZ = this.targetZ + this.offsetZ;

    this.camera.position.x += (targetCamX - this.camera.position.x) * t;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * t;

    // Always look at the player position (not the camera offset position)
    this.camera.lookAt(
      this.camera.position.x,
      0,
      this.camera.position.z - this.offsetZ
    );
  }
}
