export class HUD {
  constructor(container) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0;
      pointer-events: none; padding: 12px 20px;
      display: flex; justify-content: space-between; align-items: flex-start;
      font-family: Arial, sans-serif; color: white; z-index: 15;
    `;
    this.el.innerHTML = `
      <div id="hud-left" style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 11px; color: #aaa;">HP</div>
        <div style="width: 140px; height: 14px; background: #333; border-radius: 7px; overflow: hidden;">
          <div id="hud-hp-bar" style="width: 100%; height: 100%; background: #44cc44; border-radius: 7px; transition: width 0.2s;"></div>
        </div>
        <div style="font-size: 11px; color: #aaa; margin-top: 2px;">Stamina</div>
        <div style="width: 110px; height: 8px; background: #333; border-radius: 4px; overflow: hidden;">
          <div id="hud-stamina-bar" style="width: 100%; height: 100%; background: #44aaff; border-radius: 4px; transition: width 0.15s;"></div>
        </div>
      </div>
      <div id="hud-center" style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px;">
        <div id="hud-wave" style="font-size: 13px; color: #ffcc44; font-weight: bold;"></div>
        <div style="display: flex; gap: 14px; align-items: center;">
          <div id="hud-kills" style="font-size: 13px; color: #ccc;">Kills: 0</div>
          <div id="hud-score" style="font-size: 14px; color: #ffcc44; font-weight: bold;">Score: 0</div>
        </div>
        <div id="hud-kill-feed" style="font-size: 12px; color: #ff8888; min-height: 18px;"></div>
      </div>
      <div id="hud-right" style="text-align: right; margin-top: 44px;">
        <div id="hud-ammo" style="font-size: 20px; font-weight: bold;">12 / 12</div>
        <div id="hud-reload-hint" style="font-size: 11px; color: #888; display: none;">[R] Reload</div>
      </div>
    `;
    container.appendChild(this.el);

    this._hpBar = this.el.querySelector('#hud-hp-bar');
    this._staminaBar = this.el.querySelector('#hud-stamina-bar');
    this._ammo = this.el.querySelector('#hud-ammo');
    this._reloadHint = this.el.querySelector('#hud-reload-hint');
    this._killFeed = this.el.querySelector('#hud-kill-feed');
    this._waveEl = this.el.querySelector('#hud-wave');
    this._killsEl = this.el.querySelector('#hud-kills');
    this._scoreEl = this.el.querySelector('#hud-score');
    this._killCount = 0;
    this._killTimeout = null;
    this._waveTimeout = null;
    this._pickupTimeout = null;

    // Wave announcement overlay (big centered text)
    this._waveAnnounce = document.createElement('div');
    this._waveAnnounce.style.cssText = `
      position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
      font-size: 48px; font-weight: bold; color: #ffcc44;
      text-shadow: 0 0 20px rgba(255,200,0,0.5); font-family: Arial, sans-serif;
      pointer-events: none; z-index: 25; opacity: 0; transition: opacity 0.5s;
    `;
    document.body.appendChild(this._waveAnnounce);
  }

  updateHealth(current, max) {
    const pct = Math.max(0, current / max) * 100;
    this._hpBar.style.width = pct + '%';
    if (pct > 50) this._hpBar.style.background = '#44cc44';
    else if (pct > 25) this._hpBar.style.background = '#ccaa22';
    else this._hpBar.style.background = '#cc2222';
  }

  updateStamina(current, max) {
    const pct = Math.max(0, current / max) * 100;
    this._staminaBar.style.width = pct + '%';
    if (pct > 30) this._staminaBar.style.background = '#44aaff';
    else this._staminaBar.style.background = '#aa4444';
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

  updateWave(wave, active) {
    if (wave > 0) {
      this._waveEl.textContent = `Wave ${wave}${active ? '' : ' - Complete!'}`;
    }
  }

  showWave(wave) {
    this._waveAnnounce.textContent = `Wave ${wave}`;
    this._waveAnnounce.style.opacity = '1';
    if (this._waveTimeout) clearTimeout(this._waveTimeout);
    this._waveTimeout = setTimeout(() => {
      this._waveAnnounce.style.opacity = '0';
    }, 2500);
  }

  addKill() {
    this._killCount++;
    this._killsEl.textContent = `Kills: ${this._killCount}`;
  }

  updateScore(score) {
    this._scoreEl.textContent = `Score: ${score}`;
  }

  showPickup(itemType) {
    const label = itemType === 'health' ? '+Health' : '+Ammo';
    const color = itemType === 'health' ? '#44cc44' : '#ffaa22';
    this._killFeed.innerHTML = `<span style="color: ${color}; font-weight: bold;">${label}</span>`;
    if (this._pickupTimeout) clearTimeout(this._pickupTimeout);
    this._pickupTimeout = setTimeout(() => {
      this._killFeed.textContent = '';
    }, 1500);
  }

  destroy() {
    if (this._killTimeout) clearTimeout(this._killTimeout);
    if (this._waveTimeout) clearTimeout(this._waveTimeout);
    if (this._pickupTimeout) clearTimeout(this._pickupTimeout);
    this._waveAnnounce.remove();
    this.el.remove();
  }
}
