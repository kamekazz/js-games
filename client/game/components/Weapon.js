import { Component } from '@engine/ecs/Component.js';
import { WEAPONS } from '@shared/constants.js';

export class Weapon extends Component {
  constructor(weaponId = 'pistol') {
    super();
    const w = WEAPONS[weaponId];
    this.id = weaponId;
    this.ammo = w.magazine;
    this.maxAmmo = w.magazine;
    this.fireRate = w.fireRate;
    this.cooldown = 0;
    this.reloading = false;
    this.aimTime = 0;
    this.unlockedWeapons = new Set(['pistol']);
  }

  switchTo(weaponId) {
    const w = WEAPONS[weaponId];
    if (!w) return;
    this.id = weaponId;
    this.ammo = w.magazine;
    this.maxAmmo = w.magazine;
    this.fireRate = w.fireRate;
    this.cooldown = 0;
    this.reloading = false;
    this.aimTime = 0;
  }
}
