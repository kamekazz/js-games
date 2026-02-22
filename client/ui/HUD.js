import { isTouchDevice } from '@engine/input/DeviceDetector.js';

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
        <div id="hud-action-container" style="display: none; margin-top: 4px;">
          <div style="font-size: 10px; color: #aaa;" id="hud-action-label">Action</div>
          <div style="width: 110px; height: 8px; background: #333; border-radius: 4px; overflow: hidden;">
            <div id="hud-action-bar" style="width: 0%; height: 100%; background: #ffcc44; border-radius: 4px; transition: width 0.1s;"></div>
          </div>
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
        <div id="hud-weapon-name" style="font-size: 13px; color: #ffcc44; font-weight: bold; margin-bottom: 2px;">Pistol</div>
        <div id="hud-ammo" style="font-size: 20px; font-weight: bold;">12 / 12</div>
        <div id="hud-ammo-reserve" style="font-size: 11px; color: #888;"></div>
        <div id="hud-reload-hint" style="font-size: 11px; color: #888; display: none;">[R] Reload</div>
        <div id="hud-weapon-hints" style="font-size: 10px; color: #666; margin-top: 4px;">[1] Pistol  [2] ???  [3] ???  [4] ???</div>
      </div>
    `;
    container.appendChild(this.el);

    this._hpBar = this.el.querySelector('#hud-hp-bar');
    this._staminaBar = this.el.querySelector('#hud-stamina-bar');
    this._weaponName = this.el.querySelector('#hud-weapon-name');
    this._ammo = this.el.querySelector('#hud-ammo');
    this._ammoReserve = this.el.querySelector('#hud-ammo-reserve');
    this._reloadHint = this.el.querySelector('#hud-reload-hint');
    this._weaponHints = this.el.querySelector('#hud-weapon-hints');
    this._killFeed = this.el.querySelector('#hud-kill-feed');
    this._waveEl = this.el.querySelector('#hud-wave');
    this._killsEl = this.el.querySelector('#hud-kills');
    this._scoreEl = this.el.querySelector('#hud-score');
    this._actionContainer = this.el.querySelector('#hud-action-container');
    this._actionBar = this.el.querySelector('#hud-action-bar');
    this._actionLabel = this.el.querySelector('#hud-action-label');
    if (isTouchDevice()) {
      this._weaponHints.style.display = 'none';
    }
    this._killCount = 0;
    this._killTimeout = null;
    this._waveTimeout = null;
    this._pickupTimeout = null;
    this._unlockTimeout = null;

    // Wave announcement overlay (big centered text)
    this._waveAnnounce = document.createElement('div');
    this._waveAnnounce.style.cssText = `
      position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
      font-size: 48px; font-weight: bold; color: #ffcc44;
      text-shadow: 0 0 20px rgba(255,200,0,0.5); font-family: Arial, sans-serif;
      pointer-events: none; z-index: 25; opacity: 0; transition: opacity 0.5s;
    `;
    document.body.appendChild(this._waveAnnounce);

    // Action hint overlay (bottom center)
    this._actionHint = document.createElement('div');
    this._actionHint.style.cssText = `
      position: fixed; bottom: 15%; left: 50%; transform: translateX(-50%);
      font-size: 16px; font-weight: bold; color: #fff;
      text-shadow: 0 0 10px rgba(0,0,0,0.8); font-family: Arial, sans-serif;
      pointer-events: none; z-index: 25; opacity: 0; transition: opacity 0.3s;
      background: rgba(0,0,0,0.5); padding: 6px 16px; border-radius: 8px;
    `;
    document.body.appendChild(this._actionHint);

    // Weapon unlock announcement (center screen)
    this._unlockAnnounce = document.createElement('div');
    this._unlockAnnounce.style.cssText = `
      position: fixed; top: 30%; left: 50%; transform: translateX(-50%);
      font-size: 36px; font-weight: bold; color: #ffcc44;
      text-shadow: 0 0 20px rgba(255,200,0,0.6); font-family: Arial, sans-serif;
      pointer-events: none; z-index: 25; opacity: 0; transition: opacity 0.5s;
    `;
    document.body.appendChild(this._unlockAnnounce);

    // Extraction banner
    this._extractBanner = document.createElement('div');
    this._extractBanner.style.cssText = `
      position: fixed; top: 25%; left: 50%; transform: translateX(-50%);
      font-size: 42px; font-weight: bold; color: #44ff44;
      text-shadow: 0 0 20px rgba(0,255,0,0.5); font-family: Arial, sans-serif;
      pointer-events: none; z-index: 25; opacity: 0; transition: opacity 0.5s;
    `;
    document.body.appendChild(this._extractBanner);
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

  updateAmmoReserve(reserve, weaponId) {
    if (reserve == null) return;
    const r = reserve[weaponId];
    if (r === -1) {
      this._ammoReserve.textContent = 'Reserve: \u221E';
    } else if (r != null) {
      this._ammoReserve.textContent = `Reserve: ${r}`;
    }
  }

  updateWeapon(weaponId) {
    const names = { pistol: 'Pistol', rifle: 'Rifle', uzi: 'Uzi', shotgun: 'Shotgun' };
    this._weaponName.textContent = names[weaponId] || weaponId;
  }

  updateWeaponSlots(unlockedSet) {
    const slots = [
      { key: '1', id: 'pistol', name: 'Pistol' },
      { key: '2', id: 'rifle', name: 'Rifle' },
      { key: '3', id: 'uzi', name: 'Uzi' },
      { key: '4', id: 'shotgun', name: 'Shotgun' },
    ];
    const parts = slots.map(s => {
      if (unlockedSet.has(s.id)) {
        return `[${s.key}] ${s.name}`;
      }
      return `<span style="color: #444;">[${s.key}] ???</span>`;
    });
    this._weaponHints.innerHTML = parts.join('&nbsp;&nbsp;');
  }

  updateAction(progress, duration, label) {
    if (duration <= 0) {
      this._actionContainer.style.display = 'none';
      return;
    }
    this._actionContainer.style.display = 'block';
    const pct = Math.min(100, (progress / duration) * 100);
    this._actionBar.style.width = pct + '%';
    this._actionLabel.textContent = label || 'Action';
  }

  hideAction() {
    this._actionContainer.style.display = 'none';
  }

  showActionHint(label) {
    this._actionHint.textContent = label;
    this._actionHint.style.opacity = '1';
  }

  hideActionHint() {
    this._actionHint.style.opacity = '0';
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

  showPickup(message, color = '#ffaa22') {
    this._killFeed.innerHTML = `<span style="color: ${color}; font-weight: bold;">${message}</span>`;
    if (this._pickupTimeout) clearTimeout(this._pickupTimeout);
    this._pickupTimeout = setTimeout(() => {
      this._killFeed.textContent = '';
    }, 1500);
  }

  showWeaponUnlock(weaponName) {
    this._unlockAnnounce.textContent = `${weaponName.toUpperCase()} UNLOCKED!`;
    this._unlockAnnounce.style.opacity = '1';
    if (this._unlockTimeout) clearTimeout(this._unlockTimeout);
    this._unlockTimeout = setTimeout(() => {
      this._unlockAnnounce.style.opacity = '0';
    }, 3000);
  }

  showExtracted(local) {
    if (local) {
      this._extractBanner.textContent = 'EXTRACTED \u2014 Score Saved!';
      this._extractBanner.style.opacity = '1';
      setTimeout(() => {
        this._extractBanner.style.opacity = '0';
      }, 4000);
    }
  }

  showExtractionKillFeed(playerName) {
    this._killFeed.innerHTML = `<span style="color: #44ff44; font-weight: bold;">${playerName} extracted!</span>`;
    if (this._killTimeout) clearTimeout(this._killTimeout);
    this._killTimeout = setTimeout(() => {
      this._killFeed.textContent = '';
    }, 3000);
  }

  destroy() {
    if (this._killTimeout) clearTimeout(this._killTimeout);
    if (this._waveTimeout) clearTimeout(this._waveTimeout);
    if (this._pickupTimeout) clearTimeout(this._pickupTimeout);
    if (this._unlockTimeout) clearTimeout(this._unlockTimeout);
    this._waveAnnounce.remove();
    this._actionHint.remove();
    this._unlockAnnounce.remove();
    this._extractBanner.remove();
    this.el.remove();
  }
}
