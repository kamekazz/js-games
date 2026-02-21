export class HUD {
  constructor(container) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; bottom: 0; left: 0; right: 0;
      pointer-events: none; padding: 16px 20px;
      display: flex; justify-content: space-between; align-items: flex-end;
      font-family: Arial, sans-serif; color: white; z-index: 15;
    `;
    this.el.innerHTML = `
      <div id="hud-left" style="display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 13px; color: #aaa;">HP</div>
        <div style="width: 180px; height: 16px; background: #333; border-radius: 8px; overflow: hidden;">
          <div id="hud-hp-bar" style="width: 100%; height: 100%; background: #44cc44; border-radius: 8px; transition: width 0.2s;"></div>
        </div>
      </div>
      <div id="hud-center" style="text-align: center;">
        <div id="hud-kill-feed" style="font-size: 13px; color: #ff8888; min-height: 20px;"></div>
      </div>
      <div id="hud-right" style="text-align: right;">
        <div id="hud-ammo" style="font-size: 22px; font-weight: bold;">12 / 12</div>
        <div id="hud-reload-hint" style="font-size: 12px; color: #888; display: none;">[R] Reload</div>
      </div>
    `;
    container.appendChild(this.el);

    this._hpBar = this.el.querySelector('#hud-hp-bar');
    this._ammo = this.el.querySelector('#hud-ammo');
    this._reloadHint = this.el.querySelector('#hud-reload-hint');
    this._killFeed = this.el.querySelector('#hud-kill-feed');
    this._killTimeout = null;
  }

  updateHealth(current, max) {
    const pct = Math.max(0, current / max) * 100;
    this._hpBar.style.width = pct + '%';
    if (pct > 50) this._hpBar.style.background = '#44cc44';
    else if (pct > 25) this._hpBar.style.background = '#ccaa22';
    else this._hpBar.style.background = '#cc2222';
  }

  updateAmmo(current, max, reloading) {
    if (reloading) {
      this._ammo.textContent = 'RELOADING...';
      this._reloadHint.style.display = 'none';
    } else {
      this._ammo.textContent = `${current} / ${max}`;
      this._reloadHint.style.display = current < max ? 'block' : 'none';
    }
  }

  showKill(killerName, victimName) {
    this._killFeed.textContent = `${killerName} killed ${victimName}`;
    if (this._killTimeout) clearTimeout(this._killTimeout);
    this._killTimeout = setTimeout(() => {
      this._killFeed.textContent = '';
    }, 3000);
  }

  showDeath() {
    this._killFeed.innerHTML = '<span style="font-size: 20px; color: #ff4444;">YOU DIED</span><br><span style="font-size: 13px;">Respawning...</span>';
    if (this._killTimeout) clearTimeout(this._killTimeout);
    this._killTimeout = setTimeout(() => {
      this._killFeed.textContent = '';
    }, 3000);
  }

  destroy() {
    if (this._killTimeout) clearTimeout(this._killTimeout);
    this.el.remove();
  }
}
