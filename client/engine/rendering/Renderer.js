import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    this.container = container;

    // WebGL renderer
    this.webglRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webglRenderer.setClearColor(0x1a1a2e);
    container.appendChild(this.webglRenderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Orthographic camera (top-down)
    this.viewSize = 50;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -this.viewSize * aspect / 2,
       this.viewSize * aspect / 2,
       this.viewSize / 2,
      -this.viewSize / 2,
      0.1,
      200
    );
    // Slightly tilted top-down (not pure overhead) so you see the side of characters
    this.camera.position.set(0, 50, 8);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 50, 10);
    this.scene.add(directional);

    this._handleResize();
    window.addEventListener('resize', () => this._handleResize());
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    this.camera.left = -this.viewSize * aspect / 2;
    this.camera.right = this.viewSize * aspect / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.updateProjectionMatrix();

    this.webglRenderer.setSize(w, h);
  }

  render() {
    this.webglRenderer.render(this.scene, this.camera);
  }

  add(object3d) {
    this.scene.add(object3d);
  }

  remove(object3d) {
    this.scene.remove(object3d);
  }
}
