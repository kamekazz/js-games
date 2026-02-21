/**
 * Manages transitions between UI scenes (menu, lobby, game).
 * Each scene has enter(container) and exit() methods.
 */
export class SceneManager {
  constructor(overlayEl) {
    this.overlayEl = overlayEl;
    this.currentScene = null;
  }

  async switchTo(scene) {
    if (this.currentScene) {
      this.currentScene.exit();
    }
    // Clear UI overlay contents (but keep joystick zones)
    const zones = this.overlayEl.querySelectorAll('[id^="joystick-zone"], #action-buttons');
    for (const child of [...this.overlayEl.children]) {
      if (!child.id?.startsWith('joystick-zone') && child.id !== 'action-buttons') {
        child.remove();
      }
    }
    this.currentScene = scene;
    await scene.enter(this.overlayEl);
  }
}
