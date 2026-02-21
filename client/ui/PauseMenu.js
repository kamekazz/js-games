/**
 * Menu button (top-left) + modal dialog to leave the game.
 */
export class PauseMenu {
  constructor(onLeave) {
    this.onLeave = onLeave;

    // Menu button (top-left corner)
    this.btn = document.createElement('button');
    this.btn.textContent = '|||';
    this.btn.style.cssText = `
      position: fixed; top: 12px; left: 12px; z-index: 20;
      width: 40px; height: 40px; border-radius: 8px;
      border: 2px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.5);
      color: white; font-size: 16px; font-weight: bold; cursor: pointer;
      pointer-events: auto; display: flex; align-items: center; justify-content: center;
      letter-spacing: 2px;
    `;
    document.body.appendChild(this.btn);

    // Modal overlay (hidden by default)
    this.modal = document.createElement('div');
    this.modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); z-index: 30; display: none;
      align-items: center; justify-content: center;
      pointer-events: auto; font-family: Arial, sans-serif;
    `;
    this.modal.innerHTML = `
      <div style="background: #1a1a2e; padding: 32px 40px; border-radius: 16px; text-align: center; border: 1px solid #333;">
        <h2 style="color: white; margin: 0 0 8px 0; font-size: 1.5rem;">Paused</h2>
        <p style="color: #888; margin: 0 0 24px 0; font-size: 14px;">What would you like to do?</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button id="pause-resume" style="
            padding: 12px 32px; border-radius: 8px; border: none;
            background: #44aa44; color: white; font-size: 16px;
            font-weight: bold; cursor: pointer;
          ">Resume</button>
          <button id="pause-leave" style="
            padding: 12px 32px; border-radius: 8px; border: none;
            background: #ff4444; color: white; font-size: 16px;
            font-weight: bold; cursor: pointer;
          ">Leave Game</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    // Events
    this.btn.addEventListener('click', () => this._open());
    this.modal.querySelector('#pause-resume').addEventListener('click', () => this._close());
    this.modal.querySelector('#pause-leave').addEventListener('click', () => {
      this._close();
      if (this.onLeave) this.onLeave();
    });

    // Escape key to toggle
    this._onKeyDown = (e) => {
      if (e.code === 'Escape') {
        if (this._isOpen) this._close();
        else this._open();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    this._isOpen = false;
  }

  _open() {
    this.modal.style.display = 'flex';
    this._isOpen = true;
  }

  _close() {
    this.modal.style.display = 'none';
    this._isOpen = false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.btn.remove();
    this.modal.remove();
  }
}
