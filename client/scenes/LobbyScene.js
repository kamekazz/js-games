export class LobbyScene {
  constructor(sceneManager, roomCode, onLeave) {
    this.sceneManager = sceneManager;
    this.roomCode = roomCode;
    this.onLeave = onLeave;
    this.el = null;
  }

  async enter(container) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      pointer-events: auto; color: white; font-family: Arial, sans-serif;
      background: rgba(0,0,0,0.6); padding: 16px 24px; border-radius: 12px;
      text-align: center; z-index: 20;
    `;
    this.el.innerHTML = `
      <p style="font-size: 14px; color: #888;">Room Code</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #4488ff;">${this.roomCode}</p>
      <p id="lobby-status" style="font-size: 14px; color: #aaa; margin-top: 8px;">Connecting...</p>
      <button id="lobby-leave" style="margin-top: 12px; padding: 8px 20px; border-radius: 6px; border: none; background: #ff4444; color: white; cursor: pointer; font-size: 14px;">
        Leave
      </button>
    `;
    container.appendChild(this.el);

    this.el.querySelector('#lobby-leave').addEventListener('click', () => {
      this.onLeave();
    });
  }

  updateStatus(text) {
    if (this.el) {
      const status = this.el.querySelector('#lobby-status');
      if (status) status.textContent = text;
    }
  }

  exit() {
    if (this.el) this.el.remove();
  }
}
