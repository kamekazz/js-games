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
    this.viewSize = 25;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -this.viewSize * aspect / 2,
       this.viewSize * aspect / 2,
       this.viewSize / 2,
      -this.viewSize / 2,
      0.1,
      200
    );
    // Isometric-style 3/4 view — tilted enough to see character sides
    this.camera.position.set(0, 40, 25);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    this._ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this._ambientLight);

    this._directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this._directionalLight.position.set(10, 50, 10);
    this.scene.add(this._directionalLight);

    // Lighting transition state
    this._lightTarget = null;
    this._lightTransitionTimer = 0;
    this._lightTransitionDuration = 3.0;
    this._lightFrom = null;

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

  setNightLighting(isNight, bloodMoon, instant = false) {
    let target;
    if (isNight && bloodMoon) {
      target = {
        ambientColor: new THREE.Color(0xff6666),
        ambientIntensity: 0.25,
        directionalIntensity: 0.3,
        clearColor: new THREE.Color(0x1a0a0a),
      };
    } else if (isNight) {
      target = {
        ambientColor: new THREE.Color(0x8888ff),
        ambientIntensity: 0.3,
        directionalIntensity: 0.4,
        clearColor: new THREE.Color(0x0a0a1e),
      };
    } else {
      // Dawn
      target = {
        ambientColor: new THREE.Color(0xfff8e0),
        ambientIntensity: 0.6,
        directionalIntensity: 0.8,
        clearColor: new THREE.Color(0x1a1a2e),
      };
    }

    if (instant) {
      this._ambientLight.color.copy(target.ambientColor);
      this._ambientLight.intensity = target.ambientIntensity;
      this._directionalLight.intensity = target.directionalIntensity;
      this.webglRenderer.setClearColor(target.clearColor);
      this._lightTarget = null;
      return;
    }

    // Store current state as "from"
    this._lightFrom = {
      ambientColor: this._ambientLight.color.clone(),
      ambientIntensity: this._ambientLight.intensity,
      directionalIntensity: this._directionalLight.intensity,
      clearColor: new THREE.Color().copy(this.webglRenderer.getClearColor(new THREE.Color())),
    };
    this._lightTarget = target;
    this._lightTransitionTimer = 0;
  }

  updateLighting(dt) {
    if (!this._lightTarget || !this._lightFrom) return;

    this._lightTransitionTimer += dt;
    const t = Math.min(this._lightTransitionTimer / this._lightTransitionDuration, 1.0);

    this._ambientLight.color.lerpColors(this._lightFrom.ambientColor, this._lightTarget.ambientColor, t);
    this._ambientLight.intensity = this._lightFrom.ambientIntensity + (this._lightTarget.ambientIntensity - this._lightFrom.ambientIntensity) * t;
    this._directionalLight.intensity = this._lightFrom.directionalIntensity + (this._lightTarget.directionalIntensity - this._lightFrom.directionalIntensity) * t;

    const clearColor = new THREE.Color().lerpColors(this._lightFrom.clearColor, this._lightTarget.clearColor, t);
    this.webglRenderer.setClearColor(clearColor);

    if (t >= 1.0) {
      this._lightTarget = null;
      this._lightFrom = null;
    }
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
